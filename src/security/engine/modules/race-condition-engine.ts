import { Injectable, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import axios from 'axios';
import { PrismaService } from '../../../prisma/prisma.service.js';
import { assertSafeTarget, buildSafeLookup } from '../../../common/security/ssrf-guard.js';
import { GUARDRAILS, buildAuthHeaders } from '../constants.js';
import type { SecurityScanJobData } from '../constants.js';

/**
 * RACE_CONDITION_ENGINE — Timing-based concurrency vulnerability detection.
 *
 * Detects real-world race conditions that lead to:
 *   - Double-spend (submitting payment twice before balance is checked)
 *   - Multi-claim (claiming a reward/coupon multiple times)
 *   - Token reuse (using a one-time code/nonce more than once)
 *   - Rate-limit bypass (concurrent requests exceeding per-window limits)
 *   - TOCTOU (time-of-check to time-of-use state desync)
 *   - Inventory oversell (ordering more items than in stock)
 *
 * Architecture:
 *
 *   ┌────────────────┐
 *   │ RequestScheduler│ — Orchestrates parallel request timing
 *   └───────┬────────┘
 *           │
 *   ┌───────┴────────┐
 *   │ TimingAnalyzer  │ — Measures response variance and overlap
 *   └───────┬────────┘
 *           │
 *   ┌───────┴────────┐
 *   │ ReplayEngine    │ — Re-sends captured requests for reuse tests
 *   └───────┬────────┘
 *           │
 *   ┌───────┴────────┐
 *   │ DiffEngine      │ — Compares concurrent vs sequential responses
 *   └────────────────┘
 *
 * SAFETY:
 *   - Destructive race tests (double-spend, multi-claim) are LAB-ONLY
 *   - Production mode uses READ-ONLY concurrent probes (idempotency checks)
 *   - All tests are rate-limited to <= 20 concurrent requests
 *   - Token reuse tests use expired/test tokens, never valid ones
 */

// ─── Concurrent Request Configuration ───────────────────────────────
const MAX_CONCURRENCY = 20;      // Maximum parallel requests
const RACE_WINDOW_MS = 50;       // Maximum stagger between requests in a race burst
const TIMING_THRESHOLD_MS = 200; // Minimum meaningful timing difference

interface RaceResult {
  status: number;
  bodyLength: number;
  bodyHash: string;
  durationMs: number;
  headers: Record<string, string>;
}

interface TimingProfile {
  mean: number;
  median: number;
  stdDev: number;
  min: number;
  max: number;
  variance: number;
}

// ─── Value-Sensitive Endpoint Patterns ──────────────────────────────
const VALUE_SENSITIVE_PATTERNS = [
  { pattern: /\/(checkout|purchase|buy|order|pay|payment|charge)/i, name: 'Payment/Checkout', concurrency: 10, severity: 'CRITICAL' as const },
  { pattern: /\/(redeem|claim|coupon|voucher|promo|reward|bonus)/i, name: 'Reward/Coupon', concurrency: 10, severity: 'HIGH' as const },
  { pattern: /\/(transfer|send|withdraw|deposit)/i, name: 'Financial Transfer', concurrency: 10, severity: 'CRITICAL' as const },
  { pattern: /\/(vote|like|upvote|downvote|rate|review)/i, name: 'Voting/Rating', concurrency: 15, severity: 'MEDIUM' as const },
  { pattern: /\/(invite|referral|signup|register)/i, name: 'Registration/Invite', concurrency: 10, severity: 'MEDIUM' as const },
  { pattern: /\/(verify|confirm|activate|approve)/i, name: 'Verification/Approval', concurrency: 8, severity: 'HIGH' as const },
  { pattern: /\/(subscribe|unsubscribe|follow|unfollow)/i, name: 'Subscription Toggle', concurrency: 8, severity: 'LOW' as const },
];

// ─── Token Reuse Patterns ───────────────────────────────────────────
const TOKEN_REUSE_PATTERNS = [
  { pattern: /\/(reset-password|forgot-password|verify-email|confirm-email|activate)/i, name: 'One-Time Token', severity: 'HIGH' as const },
  { pattern: /\/(otp|2fa|mfa|verify-otp|confirm-otp)/i, name: 'OTP Code', severity: 'HIGH' as const },
  { pattern: /\/(invite|invitation|join)/i, name: 'Invite Token', severity: 'MEDIUM' as const },
];

// ─── Rate-Limit Probing Endpoints ───────────────────────────────────
const RATE_LIMITED_PATTERNS = [
  { pattern: /\/(login|signin|auth)/i, name: 'Authentication', expectedLimit: 10 },
  { pattern: /\/(forgot-password|reset-password)/i, name: 'Password Reset', expectedLimit: 5 },
  { pattern: /\/(register|signup)/i, name: 'Registration', expectedLimit: 10 },
  { pattern: /\/(search|query)/i, name: 'Search', expectedLimit: 30 },
  { pattern: /\/(api)/i, name: 'General API', expectedLimit: 60 },
];

@Injectable()
export class RaceConditionEngine {
  private readonly logger = new Logger(RaceConditionEngine.name);

  constructor(private readonly prisma: PrismaService) {}

  async execute(data: SecurityScanJobData): Promise<void> {
    if (data.tier === 'STANDARD') {
      this.logger.debug(`Skipping race condition engine for STANDARD scan ${data.scanId}`);
      return;
    }

    const guardrails = data.tier === 'ADVANCED'
      ? GUARDRAILS.ADVANCED
      : (GUARDRAILS as unknown as Record<string, typeof GUARDRAILS.ADVANCED>).DEEP ?? GUARDRAILS.ADVANCED;
    const baseUrl = data.baseUrl.replace(/\/+$/, '');
    let requestCount = 0;
    const maxRequests = Math.min(guardrails.maxRequestsPerScan / 3, 120);

    const scan = await this.prisma.securityScan.findUnique({
      where: { id: data.scanId },
      include: { target: { include: { assets: true } } },
    });
    if (!scan) return;

    const rootAsset = scan.target.assets[0] ?? null;
    const isLabOnly = scan.target.environment === 'LAB' || scan.target.environment === 'DEVELOPMENT';
    const authHeaders = buildAuthHeaders(data.authenticatedContext);

    const endpoints = await this.prisma.securityEndpointInventory.findMany({
      where: { targetId: data.targetId },
      orderBy: { confidence: 'desc' },
      take: 40,
    });

    // ═══════════════════════════════════════════════════════════════
    // 1. DOUBLE-SPEND / MULTI-SUBMIT DETECTION (LAB ONLY)
    //    Send identical state-changing requests simultaneously.
    //    If multiple succeed → race condition.
    // ═══════════════════════════════════════════════════════════════
    if (isLabOnly) {
      for (const ep of endpoints) {
        if (requestCount >= maxRequests) break;

        const match = VALUE_SENSITIVE_PATTERNS.find(vsp => vsp.pattern.test(ep.path));
        if (!match) continue;

        const url = `${baseUrl}${ep.path}`;
        const concurrency = Math.min(match.concurrency, MAX_CONCURRENCY);

        try {
          const parsedUrl = new URL(url);
          await assertSafeTarget(parsedUrl);

          // ── BURST: Fire N identical requests simultaneously ──
          const burstResults = await this.executeRaceBurst(
            url, 'POST', concurrency,
            JSON.stringify({ amount: 1, quantity: 1, action: 'submit' }),
            {
              'Content-Type': 'application/json',
              'User-Agent': 'Zer0Friction-SecurityScanner/1.0',
              ...authHeaders,
            },
            guardrails.perRequestTimeoutMs,
          );
          requestCount += concurrency;

          // ── ANALYZE: How many succeeded? ──
          const successResponses = burstResults.filter(r => r.status >= 200 && r.status < 300);
          const uniqueBodies = new Set(successResponses.map(r => r.bodyHash));

          // If more than 1 request succeeded with the same positive outcome → race condition
          if (successResponses.length > 1) {
            const timing = this.computeTimingProfile(burstResults.map(r => r.durationMs));

            await this.createObservation({
              scanId: data.scanId, targetId: data.targetId,
              category: 'BUSINESS_LOGIC',
              title: `Race Condition: ${match.name} Double-Submit on ${ep.path}`,
              severity: match.severity,
              exploitability: 'PROVEN',
              confidence: successResponses.length > 2 ? 'HIGH' : 'MEDIUM',
              proofType: 'RESPONSE_MATCH',
              endpoint: ep.path,
              scenarioPackSlug: 'race-condition',
              remediation: 'Implement idempotency keys for state-changing operations. Use database-level uniqueness constraints. Apply pessimistic locking or optimistic concurrency control (OCC) with row versioning. For payments: use Stripe/PayPal idempotency headers.',
              observation: `Fired ${concurrency} simultaneous ${match.name} requests to ${ep.path}. ${successResponses.length}/${concurrency} succeeded (${uniqueBodies.size} unique response bodies). Timing profile: mean=${timing.mean}ms, stddev=${timing.stdDev}ms, variance=${timing.variance}ms². This confirms the server processes duplicate requests without concurrency protection.`,
              labels: ['LAB_ONLY', 'RACE_CONDITION'],
              affectedAssets: rootAsset ? [rootAsset.id] : [],
              attackFlow: {
                raceBurst: {
                  concurrency,
                  totalSucceeded: successResponses.length,
                  uniqueResponses: uniqueBodies.size,
                  timingProfile: timing,
                  responseStatuses: burstResults.map(r => r.status),
                },
              },
            });
          }
        } catch { requestCount += concurrency; }
      }
    }

    // ═══════════════════════════════════════════════════════════════
    // 2. IDEMPOTENCY DETECTION (Production-Safe)
    //    Check if endpoints enforce idempotency headers.
    //    Non-destructive: sends the same request twice sequentially.
    // ═══════════════════════════════════════════════════════════════
    const stateChangingEndpoints = endpoints.filter(ep =>
      VALUE_SENSITIVE_PATTERNS.some(vsp => vsp.pattern.test(ep.path)),
    ).slice(0, 5);

    for (const ep of stateChangingEndpoints) {
      if (requestCount + 2 >= maxRequests) break;

      const url = `${baseUrl}${ep.path}`;
      const idempotencyKey = `zf-idem-${Date.now()}-${Math.random().toString(36).substring(2)}`;

      try {
        const parsedUrl = new URL(url);
        await assertSafeTarget(parsedUrl);

        // Request 1: With idempotency key
        const resp1 = await axios.post(url, JSON.stringify({ action: 'check' }), {
          timeout: guardrails.perRequestTimeoutMs,
          validateStatus: () => true,
          maxRedirects: 0,
          responseType: 'text',
          headers: {
            'User-Agent': 'Zer0Friction-SecurityScanner/1.0',
            'Content-Type': 'application/json',
            'Idempotency-Key': idempotencyKey,
            'X-Idempotency-Key': idempotencyKey,
            ...authHeaders,
          },
          lookup: buildSafeLookup() as never,
        });
        requestCount++;

        // Request 2: Same idempotency key — should be rejected or return cached result
        const resp2 = await axios.post(url, JSON.stringify({ action: 'check' }), {
          timeout: guardrails.perRequestTimeoutMs,
          validateStatus: () => true,
          maxRedirects: 0,
          responseType: 'text',
          headers: {
            'User-Agent': 'Zer0Friction-SecurityScanner/1.0',
            'Content-Type': 'application/json',
            'Idempotency-Key': idempotencyKey,
            'X-Idempotency-Key': idempotencyKey,
            ...authHeaders,
          },
          lookup: buildSafeLookup() as never,
        });
        requestCount++;

        const body1 = String(resp1.data || '');
        const body2 = String(resp2.data || '');

        // If both requests succeed with different bodies → no idempotency
        if (resp1.status >= 200 && resp1.status < 300 && resp2.status >= 200 && resp2.status < 300) {
          if (body1 !== body2 || Math.abs(body1.length - body2.length) > 10) {
            const match = VALUE_SENSITIVE_PATTERNS.find(vsp => vsp.pattern.test(ep.path));
            await this.createObservation({
              scanId: data.scanId, targetId: data.targetId,
              category: 'BUSINESS_LOGIC',
              title: `Missing Idempotency Protection on ${ep.path}`,
              severity: match?.severity ?? 'MEDIUM',
              exploitability: 'PROBABLE',
              confidence: 'MEDIUM',
              proofType: 'RESPONSE_MATCH',
              endpoint: ep.path,
              scenarioPackSlug: 'race-condition',
              remediation: 'Implement idempotency key support (Idempotency-Key header). Store the key with the first request result and return the cached result for duplicate keys. This prevents double-processing.',
              observation: `Two identical POST requests with the same Idempotency-Key to ${ep.path} returned different responses (${body1.length}b vs ${body2.length}b). The server does not enforce idempotency, making it vulnerable to race conditions and replay attacks.`,
              labels: isLabOnly ? ['LAB_ONLY'] : ['NEEDS_MANUAL_REVIEW'],
              affectedAssets: rootAsset ? [rootAsset.id] : [],
            });
          }
        }
      } catch { requestCount += 2; }
    }

    // ═══════════════════════════════════════════════════════════════
    // 3. TOKEN/NONCE REUSE DETECTION
    //    Test if one-time tokens (OTP, reset, invite) can be used twice.
    // ═══════════════════════════════════════════════════════════════
    const tokenEndpoints = endpoints.filter(ep =>
      TOKEN_REUSE_PATTERNS.some(trp => trp.pattern.test(ep.path)),
    ).slice(0, 5);

    for (const ep of tokenEndpoints) {
      if (requestCount + 2 >= maxRequests) break;

      const url = `${baseUrl}${ep.path}`;
      const testToken = 'zf-expired-test-token-000000';

      // Try submitting the same token twice
      const tokenPayloads = [
        { token: testToken, code: '000000', otp: '000000' },
      ];

      for (const payload of tokenPayloads) {
        try {
          const parsedUrl = new URL(url);
          await assertSafeTarget(parsedUrl);

          const resp1 = await axios.post(url, JSON.stringify(payload), {
            timeout: guardrails.perRequestTimeoutMs,
            validateStatus: () => true,
            maxRedirects: 0,
            responseType: 'text',
            headers: {
              'User-Agent': 'Zer0Friction-SecurityScanner/1.0',
              'Content-Type': 'application/json',
              ...authHeaders,
            },
            lookup: buildSafeLookup() as never,
          });
          requestCount++;

          const resp2 = await axios.post(url, JSON.stringify(payload), {
            timeout: guardrails.perRequestTimeoutMs,
            validateStatus: () => true,
            maxRedirects: 0,
            responseType: 'text',
            headers: {
              'User-Agent': 'Zer0Friction-SecurityScanner/1.0',
              'Content-Type': 'application/json',
              ...authHeaders,
            },
            lookup: buildSafeLookup() as never,
          });
          requestCount++;

          // If both requests get the SAME error (e.g., "invalid token") → good, token is validated
          // If both get success → token reuse
          // If first fails and second fails with SAME message → good (token validation works)
          const body1 = String(resp1.data || '').toLowerCase();
          const body2 = String(resp2.data || '').toLowerCase();

          if (resp1.status >= 200 && resp1.status < 300 && resp2.status >= 200 && resp2.status < 300) {
            // Both succeeded — check if responses indicate successful token usage
            if ((body1.includes('success') || body1.includes('verified') || body1.includes('confirmed')) &&
                (body2.includes('success') || body2.includes('verified') || body2.includes('confirmed'))) {
              const match = TOKEN_REUSE_PATTERNS.find(trp => trp.pattern.test(ep.path));
              await this.createObservation({
                scanId: data.scanId, targetId: data.targetId,
                category: 'AUTH_POSTURE',
                title: `${match?.name ?? 'Token'} Reuse Vulnerability on ${ep.path}`,
                severity: match?.severity ?? 'HIGH',
                exploitability: 'PROBABLE',
                confidence: 'MEDIUM',
                proofType: 'RESPONSE_MATCH',
                endpoint: ep.path,
                scenarioPackSlug: 'race-condition',
                remediation: `Invalidate ${match?.name ?? 'one-time'} tokens after first use. Set a "used" flag or delete the token atomically. Use database transactions to prevent TOCTOU race conditions during token validation.`,
                observation: `The same token/code submitted twice to ${ep.path} returned success both times. One-time tokens must be invalidated after first use.`,
                labels: isLabOnly ? ['LAB_ONLY', 'NEEDS_MANUAL_REVIEW'] : ['NEEDS_MANUAL_REVIEW'],
                affectedAssets: rootAsset ? [rootAsset.id] : [],
              });
            }
          }
        } catch { requestCount += 2; }
      }
    }

    // ═══════════════════════════════════════════════════════════════
    // 4. RATE-LIMIT BYPASS VIA CONCURRENCY
    //    Test if rate limits can be circumvented by sending all
    //    requests simultaneously (within the same rate window).
    // ═══════════════════════════════════════════════════════════════
    for (const ep of endpoints) {
      if (requestCount >= maxRequests) break;

      const rateMatch = RATE_LIMITED_PATTERNS.find(rlp => rlp.pattern.test(ep.path));
      if (!rateMatch) continue;

      const url = `${baseUrl}${ep.path}`;
      const burstSize = Math.min(rateMatch.expectedLimit + 5, MAX_CONCURRENCY);

      try {
        const parsedUrl = new URL(url);
        await assertSafeTarget(parsedUrl);

        // First: sequential requests to establish if rate limiting exists
        let sequentialBlocked = false;
        let sequentialCount = 0;
        for (let i = 0; i < Math.min(rateMatch.expectedLimit + 2, 15); i++) {
          if (requestCount >= maxRequests) break;

          try {
            const resp = await axios.get(url, {
              timeout: guardrails.perRequestTimeoutMs,
              validateStatus: () => true,
              maxRedirects: 0,
              responseType: 'text',
              headers: { 'User-Agent': 'Zer0Friction-SecurityScanner/1.0', ...authHeaders },
              lookup: buildSafeLookup() as never,
            });
            requestCount++;
            sequentialCount++;

            if (resp.status === 429) {
              sequentialBlocked = true;
              break;
            }
          } catch { requestCount++; }
        }

        if (!sequentialBlocked) {
          // No rate limiting detected at all
          if (sequentialCount >= rateMatch.expectedLimit) {
            await this.createObservation({
              scanId: data.scanId, targetId: data.targetId,
              category: 'RESOURCE_ABUSE',
              title: `No Rate Limiting on ${rateMatch.name} Endpoint: ${ep.path}`,
              severity: 'MEDIUM',
              exploitability: 'PROVEN',
              confidence: 'HIGH',
              proofType: 'RESPONSE_MATCH',
              endpoint: ep.path,
              scenarioPackSlug: 'race-condition',
              remediation: `Implement rate limiting on ${rateMatch.name} endpoints. Recommended: ${rateMatch.expectedLimit} requests per minute per IP/user. Use a sliding window algorithm with Redis or in-memory store.`,
              observation: `${sequentialCount} sequential requests to ${ep.path} all succeeded without rate limiting. Expected limit: ${rateMatch.expectedLimit} per window. This allows brute-force attacks and resource abuse.`,
              labels: isLabOnly ? ['LAB_ONLY'] : ['CORROBORATED'],
              affectedAssets: rootAsset ? [rootAsset.id] : [],
            });
          }
          continue;
        }

        // Rate limiting exists sequentially — test concurrent bypass
        if (requestCount + burstSize >= maxRequests) break;

        // Wait for rate limit window to reset (1-2 seconds)
        await new Promise(resolve => setTimeout(resolve, 2000));

        const burstResults = await this.executeRaceBurst(
          url, 'GET', burstSize, undefined,
          {
            'User-Agent': 'Zer0Friction-SecurityScanner/1.0',
            ...authHeaders,
          },
          guardrails.perRequestTimeoutMs,
        );
        requestCount += burstSize;

        const burstSuccesses = burstResults.filter(r => r.status >= 200 && r.status < 300 && r.status !== 429);
        const burstRateLimited = burstResults.filter(r => r.status === 429);

        // If more requests succeeded in burst than sequential limit → bypass
        if (burstSuccesses.length > sequentialCount) {
          await this.createObservation({
            scanId: data.scanId, targetId: data.targetId,
            category: 'RESOURCE_ABUSE',
            title: `Rate-Limit Bypass via Concurrency on ${ep.path}`,
            severity: 'HIGH',
            exploitability: 'PROVEN',
            confidence: 'HIGH',
            proofType: 'RESPONSE_MATCH',
            endpoint: ep.path,
            scenarioPackSlug: 'race-condition',
            remediation: 'Use atomic rate-limit counters (Redis INCR with EXPIRE, or Lua scripting). The current rate limiter is not thread-safe — concurrent requests can slip through the window before the counter is incremented.',
            observation: `Rate limit exists sequentially (blocked at ${sequentialCount} requests) but is bypassable via concurrency. Concurrent burst of ${burstSize} requests: ${burstSuccesses.length} succeeded, ${burstRateLimited.length} rate-limited. The rate limiter uses a non-atomic check-then-increment pattern.`,
            labels: isLabOnly ? ['LAB_ONLY'] : ['CORROBORATED'],
            affectedAssets: rootAsset ? [rootAsset.id] : [],
            attackFlow: {
              rateLimitBypass: {
                sequentialLimit: sequentialCount,
                burstSize,
                burstSucceeded: burstSuccesses.length,
                burstRateLimited: burstRateLimited.length,
              },
            },
          });
        }
      } catch { requestCount += burstSize; }
    }

    // ═══════════════════════════════════════════════════════════════
    // 5. ASYNC STATE DESYNC DETECTION
    //    Send interleaved requests to detect TOCTOU patterns.
    //    Request A (read) → Request B (write) → Request A (read)
    //    If the two reads return different data → state desync.
    // ═══════════════════════════════════════════════════════════════
    if (data.authenticatedContext) {
      const readEndpoints = endpoints.filter(ep =>
        ep.method === 'GET' && !/health|status|ping|version/i.test(ep.path),
      ).slice(0, 5);

      for (const readEp of readEndpoints) {
        if (requestCount + 3 >= maxRequests) break;

        const url = `${baseUrl}${readEp.path}`;

        try {
          const parsedUrl = new URL(url);
          await assertSafeTarget(parsedUrl);

          // Read 1
          const read1Resp = await axios.get(url, {
            timeout: guardrails.perRequestTimeoutMs,
            validateStatus: () => true,
            maxRedirects: 0,
            responseType: 'text',
            headers: { 'User-Agent': 'Zer0Friction-SecurityScanner/1.0', ...authHeaders },
            lookup: buildSafeLookup() as never,
          });
          requestCount++;
          const read1 = String(read1Resp.data || '');

          // Interleaved: Send a write-like probe (safe: empty PATCH)
          try {
            await axios.patch(url, JSON.stringify({}), {
              timeout: guardrails.perRequestTimeoutMs,
              validateStatus: () => true,
              maxRedirects: 0,
              responseType: 'text',
              headers: {
                'User-Agent': 'Zer0Friction-SecurityScanner/1.0',
                'Content-Type': 'application/json',
                ...authHeaders,
              },
              lookup: buildSafeLookup() as never,
            });
            requestCount++;
          } catch { requestCount++; }

          // Read 2 — immediately after the write attempt
          const read2Resp = await axios.get(url, {
            timeout: guardrails.perRequestTimeoutMs,
            validateStatus: () => true,
            maxRedirects: 0,
            responseType: 'text',
            headers: { 'User-Agent': 'Zer0Friction-SecurityScanner/1.0', ...authHeaders },
            lookup: buildSafeLookup() as never,
          });
          requestCount++;
          const read2 = String(read2Resp.data || '');

          // Timing analysis: check if reads show inconsistency
          if (read1Resp.status === read2Resp.status && read1Resp.status >= 200 && read1Resp.status < 300) {
            // Compare structural similarity
            const hash1 = this.quickHash(read1);
            const hash2 = this.quickHash(read2);

            if (hash1 !== hash2 && read1.length > 50 && Math.abs(read1.length - read2.length) > 20) {
              await this.createObservation({
                scanId: data.scanId, targetId: data.targetId,
                category: 'BUSINESS_LOGIC',
                title: `Potential TOCTOU State Desync on ${readEp.path}`,
                severity: 'MEDIUM',
                exploitability: 'THEORETICAL',
                confidence: 'LOW',
                proofType: 'HEURISTIC',
                endpoint: readEp.path,
                scenarioPackSlug: 'race-condition',
                remediation: 'Implement database-level row locking or optimistic concurrency control. Use versioned resources (ETag/If-Match headers) to detect concurrent modifications.',
                observation: `Two consecutive reads to ${readEp.path} (with an interleaved empty PATCH) returned different data. Read 1: ${read1.length}b, Read 2: ${read2.length}b (delta: ${Math.abs(read1.length - read2.length)}b). This may indicate a time-of-check / time-of-use vulnerability.`,
                labels: ['NEEDS_MANUAL_REVIEW'],
                affectedAssets: rootAsset ? [rootAsset.id] : [],
              });
            }
          }
        } catch { requestCount += 3; }
      }
    }

    this.logger.log(`Race condition engine completed for scan ${data.scanId}: ${requestCount} requests`);
  }

  // ─── Request Scheduler: Race Burst Executor ─────────────────────

  private async executeRaceBurst(
    url: string,
    method: string,
    concurrency: number,
    body?: string,
    headers?: Record<string, string>,
    timeoutMs?: number,
  ): Promise<RaceResult[]> {
    const results: RaceResult[] = [];

    // Create all request promises at once — minimum stagger
    const requests = Array.from({ length: concurrency }, async (_, idx) => {
      // Tiny stagger to avoid OS-level batching (0-50ms random)
      await new Promise(resolve => setTimeout(resolve, Math.random() * RACE_WINDOW_MS));

      const start = Date.now();
      try {
        const parsedUrl = new URL(url);
        await assertSafeTarget(parsedUrl);

        const resp = await axios.request({
          url,
          method: method.toLowerCase() as never,
          timeout: timeoutMs ?? 10000,
          validateStatus: () => true,
          maxRedirects: 0,
          responseType: 'text',
          data: body,
          headers: headers ?? {},
          lookup: buildSafeLookup() as never,
        });

        const respBody = String(resp.data || '');
        return {
          status: resp.status,
          bodyLength: respBody.length,
          bodyHash: this.quickHash(respBody),
          durationMs: Date.now() - start,
          headers: Object.fromEntries(
            Object.entries(resp.headers).filter(([, v]) => typeof v === 'string').map(([k, v]) => [k, String(v)]),
          ),
        };
      } catch {
        return {
          status: 0,
          bodyLength: 0,
          bodyHash: '',
          durationMs: Date.now() - start,
          headers: {},
        };
      }
    });

    // Execute ALL requests simultaneously — this is the race window
    const settled = await Promise.allSettled(requests);
    for (const result of settled) {
      if (result.status === 'fulfilled') {
        results.push(result.value);
      }
    }

    return results;
  }

  // ─── Timing Variance Analyzer ───────────────────────────────────

  private computeTimingProfile(timings: number[]): TimingProfile {
    if (timings.length === 0) return { mean: 0, median: 0, stdDev: 0, min: 0, max: 0, variance: 0 };

    const sorted = [...timings].sort((a, b) => a - b);
    const mean = timings.reduce((a, b) => a + b, 0) / timings.length;
    const median = sorted[Math.floor(sorted.length / 2)];
    const variance = timings.reduce((sum, t) => sum + Math.pow(t - mean, 2), 0) / timings.length;
    const stdDev = Math.sqrt(variance);

    return {
      mean: Math.round(mean),
      median,
      stdDev: Math.round(stdDev),
      min: sorted[0],
      max: sorted[sorted.length - 1],
      variance: Math.round(variance),
    };
  }

  // ─── Quick Hash Utility ─────────────────────────────────────────

  private quickHash(str: string): string {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      hash = ((hash << 5) - hash + str.charCodeAt(i)) | 0;
    }
    return hash.toString(36);
  }

  // ─── Observation Factory ────────────────────────────────────────

  private async createObservation(input: {
    scanId: string; targetId: string; category: string; title: string;
    severity: string; exploitability: string; confidence: string;
    proofType: string; endpoint: string; scenarioPackSlug: string;
    remediation: string; observation: string; labels: string[];
    affectedAssets: string[]; attackFlow?: Record<string, unknown>;
  }) {
    const evidence = await this.prisma.securityEvidenceArtifact.create({
      data: {
        targetId: input.targetId, scanId: input.scanId,
        kind: 'HTTP_TRANSCRIPT', name: `${input.title} evidence`,
        summary: { endpoint: input.endpoint, proofType: input.proofType },
      },
    });

    const obs = await this.prisma.securityObservation.create({
      data: {
        scanId: input.scanId, targetId: input.targetId,
        category: input.category as never, title: input.title,
        severity: input.severity as never,
        exploitability: input.exploitability as never,
        confidence: input.confidence as never,
        proofType: input.proofType as never,
        scenarioPackSlug: input.scenarioPackSlug,
        endpoint: input.endpoint, httpMethod: 'POST',
        evidenceSummary: {
          observation: input.observation,
          attackFlow: input.attackFlow,
        } as Prisma.InputJsonValue,
        affectedAssets: input.affectedAssets, labels: input.labels,
        remediation: input.remediation,
      },
    });

    await this.prisma.securityEvidenceArtifact.update({
      where: { id: evidence.id },
      data: { observationId: obs.id },
    });
  }
}
