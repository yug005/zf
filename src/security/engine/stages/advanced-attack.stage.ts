import { Injectable, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import dns from 'node:dns';
import axios from 'axios';
import { PrismaService } from '../../../prisma/prisma.service.js';
import { assertSafeTarget, buildSafeLookup } from '../../../common/security/ssrf-guard.js';
import { GUARDRAILS } from '../constants.js';
import type { SecurityScanJobData } from '../constants.js';

/**
 * ADVANCED_ATTACK — Enterprise attack probes with industry-grade signal quality.
 *
 * Design principles:
 *  1. Every finding requires BASELINE COMPARISON — no flagging on weak signals alone.
 *  2. No production-mutating writes — mass-assignment is LAB-ONLY.
 *  3. Verdict strength is calibrated: PROVEN requires strong differential evidence.
 *  4. Each probe is gated by its corresponding scenario-pack slug.
 *
 * Trusted (ship-ready):
 *   - GraphQL Introspection + Depth
 *   - Subdomain Takeover (dangling CNAME)
 *   - OAuth open redirect_uri
 *
 * Guarded (baseline-comparison required):
 *   - BOLA / IDOR (response-diffing)
 *   - JWT alg:none (baseline auth check)
 *   - Rate Limiting (multi-signal detection)
 *   - NoSQL Injection (tightened indicators)
 *   - Cache Poisoning (conservative verdicts)
 *
 * Lab-only (writes):
 *   - Mass Assignment (real PATCH — lab/dev environments only)
 */

// ─── Multi-part TLD handling for subdomain extraction ────────────────
const MULTI_PART_TLDS = new Set([
  'co.uk', 'co.in', 'co.jp', 'co.kr', 'co.nz', 'co.za', 'co.id',
  'com.au', 'com.br', 'com.cn', 'com.mx', 'com.sg', 'com.tw', 'com.ar',
  'org.uk', 'org.au', 'net.au', 'ac.uk', 'gov.uk', 'gov.in',
  'ne.jp', 'or.jp', 'ac.in', 'edu.au', 'edu.sg',
]);

function extractRootDomain(hostname: string): string {
  const parts = hostname.split('.');
  if (parts.length <= 2) return hostname;
  const lastTwo = parts.slice(-2).join('.');
  if (MULTI_PART_TLDS.has(lastTwo)) {
    return parts.length > 3 ? parts.slice(-3).join('.') : hostname;
  }
  return parts.slice(-2).join('.');
}

// ─── BOLA / IDOR Payloads ───────────────────────────────────────────
const IDOR_ID_PATTERNS = [
  { original: /\/(\d+)(\/|$|\?)/,                    fuzzValues: ['1', '0', '999999'] },
  { original: /\/([a-f0-9-]{36})(\/|$|\?)/i,         fuzzValues: ['00000000-0000-0000-0000-000000000000'] },
];

// ─── Mass Assignment Fields ─────────────────────────────────────────
const MASS_ASSIGNMENT_FIELDS = [
  { field: 'isAdmin', value: true },
  { field: 'role', value: 'admin' },
  { field: 'plan', value: 'enterprise' },
  { field: 'verified', value: true },
  { field: 'credits', value: 999999 },
  { field: 'permissions', value: ['*'] },
];

// ─── NoSQL Injection — Tightened indicators ─────────────────────────
const NOSQL_PAYLOADS = [
  {
    payload: '{"$gt":""}',
    // Only match if response contains actual MongoDB operator reflection or error messages
    indicator: /\$gt|\$ne|\$where|MongoError|mongo|BSON|operator/i,
    name: 'NoSQL $gt Bypass',
  },
  {
    payload: '{"$ne":null}',
    indicator: /\$ne|\$gt|MongoError|CastError|ValidationError.*mongo/i,
    name: 'NoSQL $ne Bypass',
  },
];

// ─── GraphQL Payloads ───────────────────────────────────────────────
const GRAPHQL_INTROSPECTION_QUERY = `{"query":"{ __schema { types { name fields { name type { name } } } } }"}`;
const GRAPHQL_DEPTH_QUERY = `{"query":"{ __type(name:\\"Query\\") { fields { name type { fields { name type { fields { name type { fields { name } } } } } } } } }"}`;

// ─── Subdomain Takeover Fingerprints ────────────────────────────────
const TAKEOVER_FINGERPRINTS = [
  { pattern: /There isn't a GitHub Pages site here/i, provider: 'GitHub Pages' },
  { pattern: /herokucdn\.com\/error-pages\/no-such-app/i, provider: 'Heroku' },
  { pattern: /NoSuchBucket/i, provider: 'AWS S3' },
  { pattern: /DEPLOYMENT_NOT_FOUND/i, provider: 'Vercel' },
  { pattern: /The specified bucket does not exist/i, provider: 'Google Cloud Storage' },
  { pattern: /Azure Web App.*not found/i, provider: 'Azure' },
  { pattern: /Sorry, this shop is currently unavailable/i, provider: 'Shopify' },
  { pattern: /fastly error: unknown domain/i, provider: 'Fastly' },
];

const COMMON_SUBDOMAINS = [
  'www', 'api', 'app', 'staging', 'dev', 'test', 'beta',
  'admin', 'dashboard', 'mail', 'blog', 'docs', 'cdn',
  'assets', 'static', 'media', 'status', 'portal', 'shop',
];

// ─── Cache Poisoning Headers ────────────────────────────────────────
const CACHE_POISON_HEADERS = [
  { header: 'X-Forwarded-Host', value: 'zf-cache-canary.example.com' },
  { header: 'X-Original-URL', value: '/zf-cache-canary-path' },
  { header: 'X-Rewrite-URL', value: '/zf-cache-canary-rewrite' },
];

@Injectable()
export class AdvancedAttackStage {
  private readonly logger = new Logger(AdvancedAttackStage.name);

  constructor(private readonly prisma: PrismaService) {}

  async execute(data: SecurityScanJobData, selectedSlugs: Set<string>): Promise<void> {
    if (data.tier === 'STANDARD') {
      this.logger.log(`Skipping advanced attacks for STANDARD scan ${data.scanId}`);
      return;
    }

    const guardrails = GUARDRAILS.ADVANCED;
    const baseUrl = data.baseUrl.replace(/\/+$/, '');
    let requestCount = 0;
    const maxRequests = guardrails.maxRequestsPerScan / 3;

    const scan = await this.prisma.securityScan.findUnique({
      where: { id: data.scanId },
      include: { target: { include: { assets: true } } },
    });
    if (!scan) throw new Error(`Scan ${data.scanId} not found.`);

    const classification = (((scan.plannerSummary as Record<string, any> | null) ?? {}).classification ?? {}) as Record<string, any>;
    const isLabOnly = Boolean(classification.isLocal || scan.target.environment === 'LAB' || scan.target.environment === 'DEVELOPMENT');
    const rootAsset = scan.target.assets[0] ?? null;

    const endpoints = await this.prisma.securityEndpointInventory.findMany({
      where: { targetId: data.targetId, scanId: data.scanId },
      orderBy: { confidence: 'desc' },
      take: 30,
    });

    // ═══════════════════════════════════════════════════════════════
    // 1. BOLA / IDOR — with baseline comparison + response-diffing
    //    Only runs if 'bola-idor' pack is selected.
    // ═══════════════════════════════════════════════════════════════
    if (selectedSlugs.has('bola-idor')) {
      for (const ep of endpoints) {
        if (requestCount >= maxRequests) break;

        for (const pattern of IDOR_ID_PATTERNS) {
          if (!pattern.original.test(ep.path)) continue;

          // Step 1: Baseline — request the ORIGINAL endpoint
          const originalUrl = `${baseUrl}${ep.path}`;
          let baselineBody = '';
          let baselineStatus = 0;
          try {
            const parsedUrl = new URL(originalUrl);
            await assertSafeTarget(parsedUrl);

            const baselineResp = await axios.get(originalUrl, {
              timeout: guardrails.perRequestTimeoutMs,
              validateStatus: () => true,
              maxRedirects: 0,
              responseType: 'text',
              headers: { 'User-Agent': 'Zer0Friction-SecurityScanner/1.0' },
              lookup: buildSafeLookup() as never,
            });
            requestCount++;
            baselineStatus = baselineResp.status;
            baselineBody = String(baselineResp.data || '').substring(0, guardrails.maxResponseBodyCapture);
          } catch { requestCount++; continue; }

          // Only proceed if original returns JSON data (it's a data endpoint)
          const baselineLooksLikeData = baselineBody.trim().startsWith('{') || baselineBody.trim().startsWith('[');
          if (baselineStatus < 200 || baselineStatus >= 300 || !baselineLooksLikeData) continue;

          // Step 2: Fuzz with foreign IDs
          for (const fuzzVal of pattern.fuzzValues) {
            if (requestCount >= maxRequests) break;
            const fuzzedPath = ep.path.replace(pattern.original, (_, _id, suffix) => `/${fuzzVal}${suffix}`);
            const fuzzedUrl = `${baseUrl}${fuzzedPath}`;

            try {
              const parsedUrl = new URL(fuzzedUrl);
              await assertSafeTarget(parsedUrl);

              const fuzzResponse = await axios.get(fuzzedUrl, {
                timeout: guardrails.perRequestTimeoutMs,
                validateStatus: () => true,
                maxRedirects: 0,
                responseType: 'text',
                headers: { 'User-Agent': 'Zer0Friction-SecurityScanner/1.0' },
                lookup: buildSafeLookup() as never,
              });
              requestCount++;

              const fuzzBody = String(fuzzResponse.data || '').substring(0, guardrails.maxResponseBodyCapture);
              const fuzzLooksLikeData = fuzzBody.trim().startsWith('{') || fuzzBody.trim().startsWith('[');

              // Critical check: BOTH must return 200 with JSON, AND the responses must be DIFFERENT.
              // If identical → it's a public/generic endpoint (not BOLA).
              // If different → different data for different IDs without auth = BOLA candidate.
              if (
                fuzzResponse.status >= 200 && fuzzResponse.status < 300 &&
                fuzzLooksLikeData &&
                baselineBody.trim() !== fuzzBody.trim()
              ) {
                await this.createFinding({
                  scanId: data.scanId, targetId: data.targetId,
                  category: 'BROKEN_ACCESS_CONTROL',
                  title: `Possible BOLA/IDOR: ${ep.path} returns different data for foreign ID`,
                  severity: 'HIGH',
                  exploitability: 'PROBABLE',
                  confidence: 'MEDIUM',
                  endpoint: fuzzedPath,
                  parameter: 'path_id',
                  scenarioPackSlug: 'bola-idor',
                  remediation: 'Implement object-level authorization checks. Verify the requesting user owns the resource before returning data. This finding requires manual confirmation — the scanner detected different data for different IDs without authentication context.',
                  observation: `Baseline request to ${ep.path} (status ${baselineStatus}) returned different JSON than the fuzzed request to ${fuzzedPath} (status ${fuzzResponse.status}). Without authentication context, different IDs return different data, suggesting missing access controls. Manual verification is recommended.`,
                  labels: isLabOnly ? ['LAB_ONLY', 'NEEDS_MANUAL_REVIEW'] : ['NEEDS_MANUAL_REVIEW'],
                  affectedAssets: rootAsset ? [rootAsset.id] : [],
                  attackFlow: {
                    steps: [
                      { action: 'Baseline request', path: ep.path, status: baselineStatus },
                      { action: 'Fuzzed with foreign ID', path: fuzzedPath, fuzzValue: fuzzVal, status: fuzzResponse.status },
                      { action: 'Responses differ', baselineLength: baselineBody.length, fuzzedLength: fuzzBody.length },
                    ],
                  },
                });
              }
            } catch { requestCount++; }
          }
        }
      }
    }

    // ═══════════════════════════════════════════════════════════════
    // 2. JWT alg:none — with BASELINE auth check
    //    First request WITHOUT auth to prove endpoint is protected,
    //    then try with forged JWT. Only flag if baseline was 401/403.
    // ═══════════════════════════════════════════════════════════════
    if (selectedSlugs.has('broken-authentication')) {
      const authEndpoints = endpoints.filter(ep =>
        /\/(api|auth|user|me|profile|account|dashboard)/i.test(ep.path)
      );

      for (const ep of authEndpoints.slice(0, 5)) {
        if (requestCount >= maxRequests) break;

        const url = `${baseUrl}${ep.path}`;

        // Step 1: Baseline — request WITHOUT any auth header
        let baselineStatus = 0;
        try {
          const parsedUrl = new URL(url);
          await assertSafeTarget(parsedUrl);

          const baselineResp = await axios.get(url, {
            timeout: guardrails.perRequestTimeoutMs,
            validateStatus: () => true,
            maxRedirects: 0,
            responseType: 'text',
            headers: { 'User-Agent': 'Zer0Friction-SecurityScanner/1.0' },
            lookup: buildSafeLookup() as never,
          });
          requestCount++;
          baselineStatus = baselineResp.status;
        } catch { requestCount++; continue; }

        // Only proceed if the endpoint actually requires authentication
        if (baselineStatus !== 401 && baselineStatus !== 403) {
          continue; // Public endpoint — not relevant for JWT bypass
        }

        // Step 2: Send forged JWT with alg:none
        const header = Buffer.from(JSON.stringify({ alg: 'none', typ: 'JWT' })).toString('base64url');
        const payload = Buffer.from(JSON.stringify({ sub: '1', role: 'admin', iat: Math.floor(Date.now() / 1000) })).toString('base64url');
        const fakeJwt = `${header}.${payload}.`;

        try {
          const parsedUrl = new URL(url);
          await assertSafeTarget(parsedUrl);

          const forgedResp = await axios.get(url, {
            timeout: guardrails.perRequestTimeoutMs,
            validateStatus: () => true,
            maxRedirects: 0,
            responseType: 'text',
            headers: {
              'User-Agent': 'Zer0Friction-SecurityScanner/1.0',
              'Authorization': `Bearer ${fakeJwt}`,
            },
            lookup: buildSafeLookup() as never,
          });
          requestCount++;

          // Only flag if: baseline was 401/403, but forged JWT gets 200
          if (forgedResp.status >= 200 && forgedResp.status < 300) {
            const body = String(forgedResp.data || '').substring(0, guardrails.maxResponseBodyCapture);
            await this.createFinding({
              scanId: data.scanId, targetId: data.targetId,
              category: 'AUTH_POSTURE',
              title: `JWT alg:none Accepted on ${ep.path}`,
              severity: 'CRITICAL',
              exploitability: 'PROVEN',
              confidence: 'HIGH',
              endpoint: ep.path,
              scenarioPackSlug: 'broken-authentication',
              remediation: 'Reject JWTs with alg:none. Use a strict allowlist of accepted algorithms (e.g. RS256, ES256). Never trust the alg header from the token itself.',
              observation: `Baseline request without auth returned ${baselineStatus} (protected). Sending a JWT with algorithm "none" (unsigned) returned ${forgedResp.status} (access granted). The server does not validate JWT signatures.`,
              labels: isLabOnly ? ['LAB_ONLY'] : ['CORROBORATED'],
              affectedAssets: rootAsset ? [rootAsset.id] : [],
              attackFlow: {
                steps: [
                  { action: 'Baseline (no auth)', status: baselineStatus, result: 'BLOCKED' },
                  { action: 'Forged JWT with alg:none', status: forgedResp.status, result: 'ACCESS_GRANTED' },
                ],
              },
              responseSnippet: body.substring(0, 300),
            });
          }
        } catch { requestCount++; }
      }
    }

    // ═══════════════════════════════════════════════════════════════
    // 3. Mass Assignment — LAB/DEV environments ONLY
    //    Real PATCH writes are dangerous; only allowed in controlled envs.
    //    In production, we only detect if the endpoint exposes privilege
    //    fields in its GET responses (read-only analysis).
    // ═══════════════════════════════════════════════════════════════
    if (selectedSlugs.has('mass-assignment')) {
      const writeableEndpoints = endpoints.filter(ep =>
        /\/(user|profile|account|settings|me|register|signup)/i.test(ep.path)
      );

      if (isLabOnly) {
        // LAB ONLY: Actually send PATCH with injected fields
        for (const ep of writeableEndpoints.slice(0, 3)) {
          if (requestCount >= maxRequests) break;

          const url = `${baseUrl}${ep.path}`;
          const injectedBody: Record<string, unknown> = {};
          for (const field of MASS_ASSIGNMENT_FIELDS) {
            injectedBody[field.field] = field.value;
          }

          try {
            const parsedUrl = new URL(url);
            await assertSafeTarget(parsedUrl);

            const response = await axios.patch(url, injectedBody, {
              timeout: guardrails.perRequestTimeoutMs,
              validateStatus: () => true,
              maxRedirects: 0,
              responseType: 'text',
              headers: {
                'User-Agent': 'Zer0Friction-SecurityScanner/1.0',
                'Content-Type': 'application/json',
              },
              lookup: buildSafeLookup() as never,
            });
            requestCount++;

            const body = String(response.data || '').substring(0, guardrails.maxResponseBodyCapture);
            const looksLikeData = body.trim().startsWith('{') || body.trim().startsWith('[');

            if (response.status >= 200 && response.status < 300 && looksLikeData) {
              const acceptedFields = MASS_ASSIGNMENT_FIELDS
                .filter(f => body.includes(`"${f.field}"`))
                .map(f => f.field);

              if (acceptedFields.length > 0) {
                await this.createFinding({
                  scanId: data.scanId, targetId: data.targetId,
                  category: 'MASS_ASSIGNMENT',
                  title: `Mass Assignment Confirmed on ${ep.path} (Lab Environment)`,
                  severity: 'HIGH',
                  exploitability: 'PROVEN',
                  confidence: 'HIGH',
                  endpoint: ep.path,
                  parameter: acceptedFields.join(', '),
                  scenarioPackSlug: 'mass-assignment',
                  remediation: 'Use DTOs / whitelists to explicitly define writable fields. Never pass raw request bodies to ORM update methods.',
                  observation: `PATCH request with injected privilege fields (${acceptedFields.join(', ')}) was accepted and returned in response. Tested in lab environment.`,
                  labels: ['LAB_ONLY'],
                  affectedAssets: rootAsset ? [rootAsset.id] : [],
                  attackFlow: {
                    steps: [
                      { action: 'PATCH with injected fields', fields: Object.keys(injectedBody) },
                      { action: 'Fields reflected in response', acceptedFields },
                    ],
                  },
                  responseSnippet: body.substring(0, 300),
                });
              }
            }
          } catch { requestCount++; }
        }
      } else {
        // PRODUCTION: Read-only analysis — check GET responses for privilege field exposure
        for (const ep of writeableEndpoints.slice(0, 5)) {
          if (requestCount >= maxRequests) break;

          const url = `${baseUrl}${ep.path}`;
          try {
            const parsedUrl = new URL(url);
            await assertSafeTarget(parsedUrl);

            const response = await axios.get(url, {
              timeout: guardrails.perRequestTimeoutMs,
              validateStatus: () => true,
              maxRedirects: 0,
              responseType: 'text',
              headers: { 'User-Agent': 'Zer0Friction-SecurityScanner/1.0' },
              lookup: buildSafeLookup() as never,
            });
            requestCount++;

            const body = String(response.data || '').substring(0, guardrails.maxResponseBodyCapture);
            if (response.status >= 200 && response.status < 300) {
              const exposedFields = MASS_ASSIGNMENT_FIELDS
                .filter(f => body.includes(`"${f.field}"`))
                .map(f => f.field);

              if (exposedFields.length >= 2) {
                await this.createFinding({
                  scanId: data.scanId, targetId: data.targetId,
                  category: 'MASS_ASSIGNMENT',
                  title: `Privilege Fields Exposed in ${ep.path} Response (Mass Assignment Risk)`,
                  severity: 'MEDIUM',
                  exploitability: 'THEORETICAL',
                  confidence: 'MEDIUM',
                  endpoint: ep.path,
                  parameter: exposedFields.join(', '),
                  scenarioPackSlug: 'mass-assignment',
                  remediation: 'Review whether these fields are writable via PATCH/PUT. Use DTOs to whitelist mutable properties. Remove sensitive fields from API responses unless necessary.',
                  observation: `GET response from ${ep.path} exposes privilege-related fields: ${exposedFields.join(', ')}. If these are writable via PATCH/PUT without proper guards, mass assignment is possible. Run in a lab environment for active confirmation.`,
                  labels: ['NEEDS_MANUAL_REVIEW'],
                  affectedAssets: rootAsset ? [rootAsset.id] : [],
                });
              }
            }
          } catch { requestCount++; }
        }
      }
    }

    // ═══════════════════════════════════════════════════════════════
    // 4. Rate Limiting — Multi-signal detection
    //    Checks for 429, CAPTCHA indicators, lockout messages,
    //    and generic blocking signals. Reduced to 5 requests.
    // ═══════════════════════════════════════════════════════════════
    if (selectedSlugs.has('rate-limit-abuse')) {
      const loginEndpoints = endpoints.filter(ep =>
        /\/(login|auth\/login|signin|token$)/i.test(ep.path)
      );

      for (const ep of loginEndpoints.slice(0, 2)) {
        if (requestCount >= maxRequests) break;

        const url = `${baseUrl}${ep.path}`;
        let got429 = false;
        let gotCaptcha = false;
        let gotLockout = false;
        let gotBlock = false;
        const rapidRequests = 5;

        try {
          const parsedUrl = new URL(url);
          await assertSafeTarget(parsedUrl);

          const results = await Promise.allSettled(
            Array.from({ length: rapidRequests }, () =>
              axios.post(url, { email: 'ratelimit-test@zer0friction.test', password: 'test' }, {
                timeout: guardrails.perRequestTimeoutMs,
                validateStatus: () => true,
                maxRedirects: 0,
                responseType: 'text',
                headers: {
                  'User-Agent': 'Zer0Friction-SecurityScanner/1.0',
                  'Content-Type': 'application/json',
                },
                lookup: buildSafeLookup() as never,
              })
            )
          );
          requestCount += rapidRequests;

          for (const result of results) {
            if (result.status !== 'fulfilled') continue;
            const resp = result.value;
            const body = String(resp.data || '').toLowerCase();

            if (resp.status === 429) got429 = true;
            if (/captcha|recaptcha|hcaptcha|turnstile/i.test(body)) gotCaptcha = true;
            if (/locked|lockout|too many|blocked|suspended|temporarily/i.test(body)) gotLockout = true;
            if (resp.status === 403 || resp.status === 503) gotBlock = true;
          }

          // Only flag if NO blocking mechanism was detected at all
          if (!got429 && !gotCaptcha && !gotLockout && !gotBlock) {
            await this.createFinding({
              scanId: data.scanId, targetId: data.targetId,
              category: 'RESOURCE_ABUSE',
              title: `No Rate Limiting Detected on ${ep.path}`,
              severity: 'MEDIUM',
              exploitability: 'PROBABLE',
              confidence: 'MEDIUM',
              endpoint: ep.path,
              scenarioPackSlug: 'rate-limit-abuse',
              remediation: 'Implement rate limiting on authentication endpoints (e.g. express-rate-limit, @nestjs/throttler). Consider CAPTCHA after 3-5 failed attempts. Return HTTP 429 to signal throttling.',
              observation: `Sent ${rapidRequests} rapid login attempts to ${ep.path}. No 429 response, no CAPTCHA challenge, no lockout message, and no 403/503 block was returned. The endpoint may lack brute-force protection. Note: some systems use invisible rate limiting (IP-based, delayed responses) that this probe cannot detect.`,
              labels: isLabOnly ? ['LAB_ONLY', 'NEEDS_MANUAL_REVIEW'] : ['NEEDS_MANUAL_REVIEW'],
              affectedAssets: rootAsset ? [rootAsset.id] : [],
              attackFlow: {
                steps: [
                  { action: `Fire ${rapidRequests} concurrent POST requests`, endpoint: ep.path },
                  { action: 'Check for blocking signals', got429, gotCaptcha, gotLockout, gotBlock },
                ],
              },
            });
          }
        } catch { requestCount += rapidRequests; }
      }
    }

    // ═══════════════════════════════════════════════════════════════
    // 5. GraphQL Abuse — Introspection + Depth (TRUSTED — ship-ready)
    // ═══════════════════════════════════════════════════════════════
    if (selectedSlugs.has('graphql-abuse')) {
      const graphqlEndpoints = endpoints.filter(ep =>
        /\/(graphql|graphiql|gql|api\/graphql)/i.test(ep.path)
      );

      for (const ep of graphqlEndpoints.slice(0, 2)) {
        if (requestCount >= maxRequests) break;

        const url = `${baseUrl}${ep.path}`;

        // 5a. Introspection query
        try {
          const parsedUrl = new URL(url);
          await assertSafeTarget(parsedUrl);

          const response = await axios.post(url, GRAPHQL_INTROSPECTION_QUERY, {
            timeout: guardrails.perRequestTimeoutMs,
            validateStatus: () => true,
            maxRedirects: 0,
            responseType: 'text',
            headers: {
              'User-Agent': 'Zer0Friction-SecurityScanner/1.0',
              'Content-Type': 'application/json',
            },
            lookup: buildSafeLookup() as never,
          });
          requestCount++;

          const body = String(response.data || '').substring(0, guardrails.maxResponseBodyCapture);

          if (response.status === 200 && body.includes('__schema') && body.includes('types')) {
            const typeMatches = body.match(/"name"\s*:\s*"/g);
            const typeCount = typeMatches ? typeMatches.length : 0;

            await this.createFinding({
              scanId: data.scanId, targetId: data.targetId,
              category: 'SENSITIVE_DATA_EXPOSURE',
              title: `GraphQL Introspection Enabled — ${typeCount}+ types exposed`,
              severity: 'HIGH',
              exploitability: 'PROVEN',
              confidence: 'HIGH',
              endpoint: ep.path,
              scenarioPackSlug: 'graphql-abuse',
              remediation: 'Disable introspection in production (set introspection: false in Apollo/GraphQL config). Use persistent queries or allowlisted operations.',
              observation: `The GraphQL endpoint at ${ep.path} returns full schema introspection data including ${typeCount}+ type definitions. Attackers can map your entire API surface without authentication.`,
              labels: isLabOnly ? ['LAB_ONLY'] : ['CORROBORATED'],
              affectedAssets: rootAsset ? [rootAsset.id] : [],
              attackFlow: {
                steps: [
                  { action: 'Send __schema introspection query', endpoint: ep.path },
                  { action: 'Server returned full schema', typesExposed: typeCount },
                ],
              },
              responseSnippet: body.substring(0, 500),
            });
          }
        } catch { requestCount++; }

        // 5b. Depth attack
        if (requestCount >= maxRequests) break;
        try {
          const parsedUrl = new URL(url);
          await assertSafeTarget(parsedUrl);

          const response = await axios.post(url, GRAPHQL_DEPTH_QUERY, {
            timeout: guardrails.perRequestTimeoutMs,
            validateStatus: () => true,
            maxRedirects: 0,
            responseType: 'text',
            headers: {
              'User-Agent': 'Zer0Friction-SecurityScanner/1.0',
              'Content-Type': 'application/json',
            },
            lookup: buildSafeLookup() as never,
          });
          requestCount++;

          const body = String(response.data || '').substring(0, guardrails.maxResponseBodyCapture);

          // Only flag if the deep query succeeded AND the response doesn't contain
          // depth-limit error messages
          if (
            response.status === 200 &&
            body.includes('fields') &&
            !body.includes('depth') && !body.includes('limit') && !body.includes('complexity')
          ) {
            await this.createFinding({
              scanId: data.scanId, targetId: data.targetId,
              category: 'RESOURCE_ABUSE',
              title: `GraphQL Depth Limit Missing on ${ep.path}`,
              severity: 'MEDIUM',
              exploitability: 'PROBABLE',
              confidence: 'MEDIUM',
              endpoint: ep.path,
              scenarioPackSlug: 'graphql-abuse',
              remediation: 'Set a maximum query depth limit (e.g. graphql-depth-limit package, max depth 7-10). Implement query cost analysis to prevent resource exhaustion.',
              observation: `A deeply nested query (4+ levels) was accepted without error, indicating no depth limiting is enforced. This enables denial-of-service via recursive queries.`,
              labels: isLabOnly ? ['LAB_ONLY'] : [],
              affectedAssets: rootAsset ? [rootAsset.id] : [],
            });
          }
        } catch { requestCount++; }
      }
    }

    // ═══════════════════════════════════════════════════════════════
    // 6. Subdomain Takeover — Dangling CNAME (TRUSTED — ship-ready)
    //    Uses proper root domain extraction for multi-part TLDs.
    // ═══════════════════════════════════════════════════════════════
    if (selectedSlugs.has('subdomain-takeover')) {
      try {
        const hostname = new URL(baseUrl).hostname;
        const rootDomain = extractRootDomain(hostname);

        for (const sub of COMMON_SUBDOMAINS) {
          if (requestCount >= maxRequests) break;
          const fqdn = `${sub}.${rootDomain}`;

          try {
            const cnameRecords = await dns.promises.resolveCname(fqdn).catch(() => []);
            if (cnameRecords.length === 0) continue;

            const subUrl = `https://${fqdn}`;
            try {
              const parsedUrl = new URL(subUrl);
              await assertSafeTarget(parsedUrl);

              const response = await axios.get(subUrl, {
                timeout: 8000,
                validateStatus: () => true,
                maxRedirects: 3,
                responseType: 'text',
                headers: { 'User-Agent': 'Zer0Friction-SecurityScanner/1.0' },
                lookup: buildSafeLookup() as never,
              });
              requestCount++;

              const body = String(response.data || '').substring(0, 5000);

              for (const fingerprint of TAKEOVER_FINGERPRINTS) {
                if (fingerprint.pattern.test(body)) {
                  await this.createFinding({
                    scanId: data.scanId, targetId: data.targetId,
                    category: 'SECURITY_MISCONFIGURATION',
                    title: `Subdomain Takeover Possible: ${fqdn} → ${fingerprint.provider}`,
                    severity: 'CRITICAL',
                    exploitability: 'PROVEN',
                    confidence: 'HIGH',
                    endpoint: fqdn,
                    scenarioPackSlug: 'subdomain-takeover',
                    remediation: `Remove the dangling DNS CNAME record for ${fqdn} pointing to ${cnameRecords[0]}, or reclaim the ${fingerprint.provider} resource.`,
                    observation: `${fqdn} has a CNAME record pointing to ${cnameRecords[0]} but the destination returns a "${fingerprint.provider}" error page, indicating the resource has been deprovisioned. An attacker could claim this resource and hijack the subdomain.`,
                    labels: ['CORROBORATED'],
                    affectedAssets: rootAsset ? [rootAsset.id] : [],
                    attackFlow: {
                      steps: [
                        { action: 'DNS CNAME lookup', fqdn, cname: cnameRecords[0] },
                        { action: 'HTTP probe returned deprovisioned fingerprint', provider: fingerprint.provider },
                      ],
                    },
                  });
                  break;
                }
              }
            } catch { requestCount++; }
          } catch { /* DNS resolution failed — subdomain doesn't exist */ }
        }
      } catch (error) {
        this.logger.warn(`Subdomain takeover check failed: ${error}`);
      }
    }

    // ═══════════════════════════════════════════════════════════════
    // 7. OAuth / OIDC open redirect_uri (TRUSTED — ship-ready)
    // ═══════════════════════════════════════════════════════════════
    if (selectedSlugs.has('oauth-oidc-abuse')) {
      const oauthEndpoints = endpoints.filter(ep =>
        /\/(oauth|authorize|connect|auth\/callback|login\/callback)/i.test(ep.path)
      );

      for (const ep of oauthEndpoints.slice(0, 3)) {
        if (requestCount >= maxRequests) break;

        const url = `${baseUrl}${ep.path}`;
        const maliciousRedirect = `${url}${url.includes('?') ? '&' : '?'}redirect_uri=https://evil.zer0friction.test/callback`;

        try {
          const parsedUrl = new URL(maliciousRedirect);
          await assertSafeTarget(parsedUrl);

          const response = await axios.get(maliciousRedirect, {
            timeout: guardrails.perRequestTimeoutMs,
            validateStatus: () => true,
            maxRedirects: 0,
            responseType: 'text',
            headers: { 'User-Agent': 'Zer0Friction-SecurityScanner/1.0' },
            lookup: buildSafeLookup() as never,
          });
          requestCount++;

          const location = String(response.headers['location'] ?? '');
          if (
            (response.status === 301 || response.status === 302 || response.status === 303) &&
            location.includes('evil.zer0friction.test')
          ) {
            await this.createFinding({
              scanId: data.scanId, targetId: data.targetId,
              category: 'BROKEN_ACCESS_CONTROL',
              title: `Open redirect_uri in OAuth flow: ${ep.path}`,
              severity: 'HIGH',
              exploitability: 'PROVEN',
              confidence: 'HIGH',
              endpoint: ep.path,
              parameter: 'redirect_uri',
              scenarioPackSlug: 'oauth-oidc-abuse',
              remediation: 'Validate redirect_uri against a strict allowlist of registered callback URLs. Never allow arbitrary external domains.',
              observation: `Injecting redirect_uri=https://evil.zer0friction.test/callback caused the server to redirect (${response.status}) to the attacker-controlled domain. This enables token theft via OAuth code/token interception.`,
              labels: isLabOnly ? ['LAB_ONLY'] : ['CORROBORATED'],
              affectedAssets: rootAsset ? [rootAsset.id] : [],
              attackFlow: {
                steps: [
                  { action: 'Inject external redirect_uri', value: 'https://evil.zer0friction.test/callback' },
                  { action: 'Server redirected to attacker domain', status: response.status, location },
                ],
              },
            });
          }
        } catch { requestCount++; }
      }
    }

    // ═══════════════════════════════════════════════════════════════
    // 8. Web Cache Poisoning — Conservative verdicts
    //    Reflection alone → INFORMATIONAL
    //    Reflection + cached → MEDIUM (not HIGH — needs manual verify)
    // ═══════════════════════════════════════════════════════════════
    if (selectedSlugs.has('cache-poisoning') && requestCount < maxRequests) {
      const url = baseUrl;

      for (const poisonHeader of CACHE_POISON_HEADERS) {
        if (requestCount >= maxRequests) break;

        try {
          const parsedUrl = new URL(url);
          await assertSafeTarget(parsedUrl);

          const poisonedResponse = await axios.get(url, {
            timeout: guardrails.perRequestTimeoutMs,
            validateStatus: () => true,
            maxRedirects: 0,
            responseType: 'text',
            headers: {
              'User-Agent': 'Zer0Friction-SecurityScanner/1.0',
              [poisonHeader.header]: poisonHeader.value,
            },
            lookup: buildSafeLookup() as never,
          });
          requestCount++;

          const poisonedBody = String(poisonedResponse.data || '').substring(0, guardrails.maxResponseBodyCapture);

          if (poisonedBody.includes(poisonHeader.value)) {
            // Check if the poisoned response was cached
            const cleanResponse = await axios.get(url, {
              timeout: guardrails.perRequestTimeoutMs,
              validateStatus: () => true,
              maxRedirects: 0,
              responseType: 'text',
              headers: { 'User-Agent': 'Zer0Friction-SecurityScanner/1.0' },
              lookup: buildSafeLookup() as never,
            });
            requestCount++;

            const cleanBody = String(cleanResponse.data || '').substring(0, guardrails.maxResponseBodyCapture);
            const cacheStatus = String(cleanResponse.headers['x-cache'] ?? cleanResponse.headers['cf-cache-status'] ?? '').toUpperCase();

            if (cleanBody.includes(poisonHeader.value)) {
              await this.createFinding({
                scanId: data.scanId, targetId: data.targetId,
                category: 'SECURITY_MISCONFIGURATION',
                title: `Possible Web Cache Poisoning via ${poisonHeader.header}`,
                severity: 'MEDIUM',
                exploitability: 'PROBABLE',
                confidence: 'MEDIUM',
                endpoint: '/',
                parameter: poisonHeader.header,
                scenarioPackSlug: 'cache-poisoning',
                remediation: `Configure your CDN/reverse proxy to include ${poisonHeader.header} in cache keys, or strip the header at the edge layer. Verify Vary headers are set correctly.`,
                observation: `Injecting ${poisonHeader.header}: ${poisonHeader.value} was reflected in the response. A follow-up clean request also contained the injected value (cache status: ${cacheStatus || 'unknown'}). This may indicate cache poisoning, but requires manual confirmation with different clients/IPs to verify cache scope.`,
                labels: ['NEEDS_MANUAL_REVIEW'],
                affectedAssets: rootAsset ? [rootAsset.id] : [],
                attackFlow: {
                  steps: [
                    { action: `Inject ${poisonHeader.header}`, value: poisonHeader.value },
                    { action: 'Value reflected in response', reflected: true },
                    { action: 'Clean request also shows value', cacheStatus: cacheStatus || 'unknown' },
                  ],
                },
              });
            } else {
              // Reflected but NOT cached — informational only
              await this.createFinding({
                scanId: data.scanId, targetId: data.targetId,
                category: 'SECURITY_MISCONFIGURATION',
                title: `${poisonHeader.header} Reflected in Response (Not Cached)`,
                severity: 'LOW',
                exploitability: 'THEORETICAL',
                confidence: 'LOW',
                endpoint: '/',
                parameter: poisonHeader.header,
                scenarioPackSlug: 'cache-poisoning',
                remediation: `Strip or normalize the ${poisonHeader.header} header at the reverse proxy layer to prevent reflection.`,
                observation: `The ${poisonHeader.header} header value is reflected in the HTML response but was not observed in a subsequent clean request. Cache poisoning is unlikely with current configuration but the reflection itself warrants review.`,
                labels: isLabOnly ? ['LAB_ONLY'] : [],
                affectedAssets: rootAsset ? [rootAsset.id] : [],
              });
            }
          }
        } catch { requestCount++; }
      }
    }

    // ═══════════════════════════════════════════════════════════════
    // 9. NoSQL Injection — Tightened indicators, downgraded severity
    //    Only flags when response contains actual MongoDB artifacts.
    // ═══════════════════════════════════════════════════════════════
    if (selectedSlugs.has('injection-suite')) {
      const apiEndpoints = endpoints.filter(ep =>
        /\/(api|users|search|query|find|filter)/i.test(ep.path)
      );

      for (const ep of apiEndpoints.slice(0, 8)) {
        if (requestCount >= maxRequests) break;

        for (const test of NOSQL_PAYLOADS) {
          if (requestCount >= maxRequests) break;

          const url = `${baseUrl}${ep.path}`;
          try {
            const parsedUrl = new URL(`${url}?q=${encodeURIComponent(test.payload)}`);
            await assertSafeTarget(parsedUrl);

            const response = await axios.get(parsedUrl.toString(), {
              timeout: guardrails.perRequestTimeoutMs,
              validateStatus: () => true,
              maxRedirects: 0,
              responseType: 'text',
              headers: { 'User-Agent': 'Zer0Friction-SecurityScanner/1.0' },
              lookup: buildSafeLookup() as never,
            });
            requestCount++;

            const body = String(response.data || '').substring(0, guardrails.maxResponseBodyCapture);
            if (response.status >= 200 && response.status < 300 && test.indicator.test(body)) {
              await this.createFinding({
                scanId: data.scanId, targetId: data.targetId,
                category: 'INJECTION_DETECTION',
                title: `Possible ${test.name} on ${ep.path}`,
                severity: 'HIGH',
                exploitability: 'PROBABLE',
                confidence: 'MEDIUM',
                endpoint: ep.path,
                parameter: 'q',
                scenarioPackSlug: 'injection-suite',
                remediation: 'Sanitize all user inputs. For MongoDB, explicitly cast query values and disable operator injection ($gt, $ne, $where). Use parameterized queries.',
                observation: `Injecting NoSQL operator payload "${test.payload}" into query parameter returned a response containing MongoDB-specific patterns. Manual verification is recommended to confirm exploitability.`,
                labels: isLabOnly ? ['LAB_ONLY', 'NEEDS_MANUAL_REVIEW'] : ['NEEDS_MANUAL_REVIEW'],
                affectedAssets: rootAsset ? [rootAsset.id] : [],
                attackFlow: {
                  steps: [
                    { action: 'Inject NoSQL payload', payload: test.payload },
                    { action: 'Response contains MongoDB indicator', indicator: test.indicator.source },
                  ],
                },
                responseSnippet: body.substring(0, 300),
              });
            }
          } catch { requestCount++; }
        }
      }
    }

    this.logger.log(`Advanced attacks completed for scan ${data.scanId} — ${requestCount} requests used`);
  }

  // ─── Helper: Create Finding as Observation + Evidence ────────────
  private async createFinding(input: {
    scanId: string;
    targetId: string;
    category: string;
    title: string;
    severity: string;
    exploitability: 'PROVEN' | 'PROBABLE' | 'THEORETICAL';
    confidence: 'HIGH' | 'MEDIUM' | 'LOW';
    endpoint: string;
    parameter?: string;
    scenarioPackSlug: string;
    remediation: string;
    observation: string;
    labels: string[];
    affectedAssets: string[];
    attackFlow?: Record<string, unknown>;
    responseSnippet?: string;
  }) {
    const evidence = await this.prisma.securityEvidenceArtifact.create({
      data: {
        targetId: input.targetId,
        scanId: input.scanId,
        kind: 'REQUEST_REPLAY',
        name: `${input.title} evidence`,
        summary: {
          endpoint: input.endpoint,
          parameter: input.parameter,
          attackType: input.scenarioPackSlug,
        },
        rawPayload: input.responseSnippet
          ? { responseSnippet: input.responseSnippet }
          : undefined,
      },
    });

    const observation = await this.prisma.securityObservation.create({
      data: {
        scanId: input.scanId,
        targetId: input.targetId,
        category: input.category as never,
        title: input.title,
        severity: input.severity as never,
        exploitability: input.exploitability as never,
        confidence: input.confidence as never,
        proofType: (input.exploitability === 'PROVEN' ? 'AUTH_BYPASS' : input.exploitability === 'PROBABLE' ? 'RESPONSE_MATCH' : 'HEURISTIC') as never,
        scenarioPackSlug: input.scenarioPackSlug,
        endpoint: input.endpoint,
        httpMethod: 'GET',
        parameter: input.parameter,
        evidenceSummary: {
          observation: input.observation,
          attackFlow: input.attackFlow,
        } as Prisma.InputJsonValue,
        affectedAssets: input.affectedAssets,
        labels: input.labels,
        remediation: input.remediation,
      },
    });

    await this.prisma.securityEvidenceArtifact.update({
      where: { id: evidence.id },
      data: { observationId: observation.id },
    });
  }
}
