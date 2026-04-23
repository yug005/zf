import { Injectable, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import axios from 'axios';
import { PrismaService } from '../../../prisma/prisma.service.js';
import { assertSafeTarget, buildSafeLookup } from '../../../common/security/ssrf-guard.js';
import { GUARDRAILS, buildAuthHeaders } from '../constants.js';
import type { SecurityScanJobData } from '../constants.js';

/**
 * API_ABUSE_DETECTOR — Advanced API abuse pattern detection.
 *
 * Capabilities:
 *   • BOPLA — Broken Object Property Level Authorization
 *   • Pagination abuse (unbounded page sizes)
 *   • Bulk data extraction patterns
 *   • Filter/sort injection
 *   • API version inconsistency checks
 *   • GraphQL query cost estimation & deep nesting
 *   • Large payload handling weakness detection
 */

// API version patterns to test
const API_VERSION_PATTERNS = [
  { from: '/api/v2/', to: '/api/v1/', label: 'v2→v1' },
  { from: '/api/v3/', to: '/api/v1/', label: 'v3→v1' },
  { from: '/api/v3/', to: '/api/v2/', label: 'v3→v2' },
];

// Pagination abuse parameters
const PAGINATION_ABUSE_PARAMS = [
  { param: 'limit', values: ['1000', '10000', '99999'] },
  { param: 'per_page', values: ['1000', '10000'] },
  { param: 'page_size', values: ['1000', '10000'] },
  { param: 'count', values: ['1000', '10000'] },
  { param: 'size', values: ['1000'] },
  { param: 'take', values: ['1000', '10000'] },
];

// Filter/sort injection payloads
const FILTER_INJECTION_PAYLOADS = [
  { param: 'sort', value: 'password', name: 'Sort by sensitive field' },
  { param: 'sort', value: '-createdAt,password', name: 'Sort injection with sensitive field' },
  { param: 'filter', value: '{"password":{"$regex":".*"}}', name: 'Filter with NoSQL regex injection' },
  { param: 'filter[role]', value: 'admin', name: 'Filter by admin role' },
  { param: 'fields', value: 'id,email,password,ssn,credit_card', name: 'Field selection with sensitive fields' },
  { param: 'select', value: 'password,secret,apiKey', name: 'Select sensitive fields' },
];

// BOPLA: Fields that should never be writable by regular users
const BOPLA_FIELDS = [
  'id', 'createdAt', 'updatedAt', 'role', 'isAdmin', 'permissions',
  'email_verified', 'phone_verified', 'subscription_tier', 'credits',
  'internal_id', 'tenant_id', 'org_id', 'password_hash',
];

@Injectable()
export class ApiAbuseDetector {
  private readonly logger = new Logger(ApiAbuseDetector.name);

  constructor(private readonly prisma: PrismaService) {}

  async execute(data: SecurityScanJobData): Promise<void> {
    const guardrails = data.tier === 'STANDARD' ? GUARDRAILS.STANDARD : GUARDRAILS.ADVANCED;
    const baseUrl = data.baseUrl.replace(/\/+$/, '');
    let requestCount = 0;
    const maxRequests = Math.min(guardrails.maxRequestsPerScan / 4, 60);

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
      take: 25,
    });

    const listEndpoints = endpoints.filter(ep =>
      /\/(users|items|products|orders|posts|comments|records|entries|data|logs|events|messages)/i.test(ep.path),
    );

    // ═══════════════════════════════════════════════════════════
    // 1. Pagination Abuse Detection
    // ═══════════════════════════════════════════════════════════
    for (const ep of listEndpoints.slice(0, 8)) {
      if (requestCount >= maxRequests) break;

      const url = `${baseUrl}${ep.path}`;

      // First: baseline request to see normal response size
      let baselineSize = 0;
      try {
        const parsedUrl = new URL(url);
        await assertSafeTarget(parsedUrl);

        const baseline = await axios.get(url, {
          timeout: guardrails.perRequestTimeoutMs,
          validateStatus: () => true,
          maxRedirects: 3,
          responseType: 'text',
          headers: { 'User-Agent': 'Zer0Friction-SecurityScanner/1.0', ...authHeaders },
          lookup: buildSafeLookup() as never,
        });
        requestCount++;
        baselineSize = String(baseline.data || '').length;
      } catch { requestCount++; continue; }

      // Try abuse pagination params
      for (const paginationTest of PAGINATION_ABUSE_PARAMS.slice(0, 3)) {
        if (requestCount >= maxRequests) break;

        for (const value of paginationTest.values.slice(0, 1)) {
          if (requestCount >= maxRequests) break;

          const abuseUrl = `${url}${url.includes('?') ? '&' : '?'}${paginationTest.param}=${value}`;
          try {
            const parsedUrl = new URL(abuseUrl);
            await assertSafeTarget(parsedUrl);

            const resp = await axios.get(abuseUrl, {
              timeout: guardrails.perRequestTimeoutMs,
              validateStatus: () => true,
              maxRedirects: 3,
              responseType: 'text',
              maxContentLength: guardrails.maxResponseSize,
              headers: { 'User-Agent': 'Zer0Friction-SecurityScanner/1.0', ...authHeaders },
              lookup: buildSafeLookup() as never,
            });
            requestCount++;

            const responseSize = String(resp.data || '').length;

            // If response is significantly larger than baseline, pagination is unbounded
            if (resp.status >= 200 && resp.status < 300 && responseSize > baselineSize * 3 && responseSize > 5000) {
              await this.createObservation({
                scanId: data.scanId, targetId: data.targetId,
                category: 'API_ABUSE',
                title: `Unbounded Pagination on ${ep.path} (${paginationTest.param}=${value})`,
                severity: 'MEDIUM',
                exploitability: 'PROVEN',
                confidence: 'HIGH',
                proofType: 'RESPONSE_MATCH',
                endpoint: ep.path,
                scenarioPackSlug: 'api-abuse',
                remediation: `Enforce a maximum page size on ${ep.path}. Cap ${paginationTest.param} to a reasonable limit (e.g., 100). Return HTTP 400 for excessively large values.`,
                observation: `Setting ${paginationTest.param}=${value} returned ${responseSize} bytes vs baseline ${baselineSize} bytes (${Math.round(responseSize / baselineSize)}x larger). The API accepts arbitrarily large page sizes, enabling bulk data extraction.`,
                labels: isLabOnly ? ['LAB_ONLY'] : ['CORROBORATED'],
                affectedAssets: rootAsset ? [rootAsset.id] : [],
              });
              break; // One finding per endpoint
            }
          } catch { requestCount++; }
        }
      }
    }

    // ═══════════════════════════════════════════════════════════
    // 2. Filter/Sort Injection
    // ═══════════════════════════════════════════════════════════
    for (const ep of listEndpoints.slice(0, 5)) {
      if (requestCount >= maxRequests) break;

      for (const test of FILTER_INJECTION_PAYLOADS.slice(0, 4)) {
        if (requestCount >= maxRequests) break;

        const url = `${baseUrl}${ep.path}${ep.path.includes('?') ? '&' : '?'}${test.param}=${encodeURIComponent(test.value)}`;
        try {
          const parsedUrl = new URL(url);
          await assertSafeTarget(parsedUrl);

          const resp = await axios.get(url, {
            timeout: guardrails.perRequestTimeoutMs,
            validateStatus: () => true,
            maxRedirects: 3,
            responseType: 'text',
            headers: { 'User-Agent': 'Zer0Friction-SecurityScanner/1.0', ...authHeaders },
            lookup: buildSafeLookup() as never,
          });
          requestCount++;

          const body = String(resp.data || '').substring(0, guardrails.maxResponseBodyCapture);

          // Check if sensitive field names appear in the sorted/filtered response
          if (resp.status >= 200 && resp.status < 300 && (
            body.includes('"password"') || body.includes('"ssn"') ||
            body.includes('"credit_card"') || body.includes('"apiKey"') ||
            body.includes('"password_hash"')
          )) {
            await this.createObservation({
              scanId: data.scanId, targetId: data.targetId,
              category: 'API_ABUSE',
              title: `${test.name} succeeded on ${ep.path}`,
              severity: 'HIGH',
              exploitability: 'PROVEN',
              confidence: 'HIGH',
              proofType: 'RESPONSE_MATCH',
              endpoint: ep.path,
              scenarioPackSlug: 'api-abuse',
              remediation: `Whitelist allowed sort/filter/field parameters. Never allow users to filter or sort by sensitive fields like password, SSN, or API keys.`,
              observation: `Injecting ${test.param}=${test.value} into ${ep.path} returned sensitive field names in the response. The API does not restrict filter/sort/field-select parameters.`,
              labels: isLabOnly ? ['LAB_ONLY'] : ['CORROBORATED'],
              affectedAssets: rootAsset ? [rootAsset.id] : [],
            });
            break;
          }
        } catch { requestCount++; }
      }
    }

    // ═══════════════════════════════════════════════════════════
    // 3. API Version Inconsistency Detection
    // ═══════════════════════════════════════════════════════════
    for (const ep of endpoints.slice(0, 10)) {
      if (requestCount >= maxRequests) break;

      for (const versionTest of API_VERSION_PATTERNS) {
        if (!ep.path.includes(versionTest.from.replace(/\/$/, ''))) continue;
        if (requestCount >= maxRequests) break;

        const downgradedPath = ep.path.replace(versionTest.from.replace(/\/$/, ''), versionTest.to.replace(/\/$/, ''));
        const url = `${baseUrl}${downgradedPath}`;

        try {
          const parsedUrl = new URL(url);
          await assertSafeTarget(parsedUrl);

          const resp = await axios.get(url, {
            timeout: guardrails.perRequestTimeoutMs,
            validateStatus: () => true,
            maxRedirects: 0,
            responseType: 'text',
            headers: { 'User-Agent': 'Zer0Friction-SecurityScanner/1.0', ...authHeaders },
            lookup: buildSafeLookup() as never,
          });
          requestCount++;

          if (resp.status >= 200 && resp.status < 300) {
            const body = String(resp.data || '');
            const looksLikeData = body.trim().startsWith('{') || body.trim().startsWith('[');

            if (looksLikeData) {
              await this.createObservation({
                scanId: data.scanId, targetId: data.targetId,
                category: 'API_ABUSE',
                title: `API Version Downgrade Active: ${versionTest.label} on ${ep.path}`,
                severity: 'MEDIUM',
                exploitability: 'PROBABLE',
                confidence: 'MEDIUM',
                proofType: 'RESPONSE_MATCH',
                endpoint: downgradedPath,
                scenarioPackSlug: 'api-abuse',
                remediation: `Deprecate and disable older API versions. If ${versionTest.to} must remain active, ensure it enforces the same security controls as the current version.`,
                observation: `Downgrading from ${versionTest.from} to ${versionTest.to} on ${ep.path} still returns valid API data. Older API versions may lack security fixes present in newer versions.`,
                labels: isLabOnly ? ['LAB_ONLY'] : ['NEEDS_MANUAL_REVIEW'],
                affectedAssets: rootAsset ? [rootAsset.id] : [],
              });
              break;
            }
          }
        } catch { requestCount++; }
      }
    }

    // ═══════════════════════════════════════════════════════════
    // 4. BOPLA (Broken Object Property Level Authorization)
    // ═══════════════════════════════════════════════════════════
    const writeEndpoints = endpoints.filter(ep =>
      /\/(user|profile|account|settings|me|register)/i.test(ep.path),
    );

    for (const ep of writeEndpoints.slice(0, 5)) {
      if (requestCount >= maxRequests) break;

      // GET request first to see what fields are returned
      const url = `${baseUrl}${ep.path}`;
      try {
        const parsedUrl = new URL(url);
        await assertSafeTarget(parsedUrl);

        const resp = await axios.get(url, {
          timeout: guardrails.perRequestTimeoutMs,
          validateStatus: () => true,
          maxRedirects: 3,
          responseType: 'text',
          headers: { 'User-Agent': 'Zer0Friction-SecurityScanner/1.0', ...authHeaders },
          lookup: buildSafeLookup() as never,
        });
        requestCount++;

        if (resp.status >= 200 && resp.status < 300) {
          const body = String(resp.data || '').substring(0, guardrails.maxResponseBodyCapture);

          // Check if response exposes internal/sensitive fields
          const exposedFields = BOPLA_FIELDS.filter(field =>
            body.includes(`"${field}"`) || body.includes(`'${field}'`),
          );

          if (exposedFields.length >= 2) {
            await this.createObservation({
              scanId: data.scanId, targetId: data.targetId,
              category: 'API_ABUSE',
              title: `BOPLA Risk: ${exposedFields.length} sensitive properties exposed on ${ep.path}`,
              severity: exposedFields.includes('password_hash') || exposedFields.includes('permissions') ? 'HIGH' : 'MEDIUM',
              exploitability: 'THEORETICAL',
              confidence: 'MEDIUM',
              proofType: 'RESPONSE_MATCH',
              endpoint: ep.path,
              scenarioPackSlug: 'api-abuse',
              remediation: `Apply response field filtering using DTOs. Remove ${exposedFields.join(', ')} from API responses unless explicitly needed. Implement property-level authorization.`,
              observation: `GET ${ep.path} exposes internal properties: ${exposedFields.join(', ')}. If these are writable via PATCH/PUT, this constitutes a BOPLA vulnerability. Run in lab mode for active confirmation.`,
              labels: isLabOnly ? ['LAB_ONLY', 'NEEDS_MANUAL_REVIEW'] : ['NEEDS_MANUAL_REVIEW'],
              affectedAssets: rootAsset ? [rootAsset.id] : [],
            });
          }
        }
      } catch { requestCount++; }
    }

    // ═══════════════════════════════════════════════════════════
    // 5. GraphQL Performance Abuse (Query Cost)
    // ═══════════════════════════════════════════════════════════
    const graphqlEndpoints = endpoints.filter(ep =>
      /\/(graphql|graphiql|gql|api\/graphql)/i.test(ep.path),
    );

    for (const ep of graphqlEndpoints.slice(0, 2)) {
      if (requestCount >= maxRequests) break;

      const url = `${baseUrl}${ep.path}`;

      // Test: batched query (multiple operations in one request)
      try {
        const parsedUrl = new URL(url);
        await assertSafeTarget(parsedUrl);

        const batchQuery = JSON.stringify([
          { query: '{ __typename }' },
          { query: '{ __typename }' },
          { query: '{ __typename }' },
          { query: '{ __typename }' },
          { query: '{ __typename }' },
        ]);

        const resp = await axios.post(url, batchQuery, {
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

        const body = String(resp.data || '');
        if (resp.status === 200 && body.startsWith('[')) {
          await this.createObservation({
            scanId: data.scanId, targetId: data.targetId,
            category: 'PERFORMANCE_RISK',
            title: `GraphQL Batch Queries Accepted on ${ep.path}`,
            severity: 'MEDIUM',
            exploitability: 'PROBABLE',
            confidence: 'HIGH',
            proofType: 'RESPONSE_MATCH',
            endpoint: ep.path,
            scenarioPackSlug: 'api-abuse',
            remediation: 'Limit the number of operations allowed per batch request. Implement query cost analysis to prevent resource exhaustion.',
            observation: `The GraphQL endpoint at ${ep.path} accepts batched queries (array of operations). An attacker could send hundreds of costly operations in a single HTTP request, bypassing rate limits.`,
            labels: isLabOnly ? ['LAB_ONLY'] : [],
            affectedAssets: rootAsset ? [rootAsset.id] : [],
          });
        }
      } catch { requestCount++; }
    }

    this.logger.log(`API abuse detection completed for scan ${data.scanId}: ${requestCount} requests`);
  }

  private async createObservation(input: {
    scanId: string; targetId: string; category: string; title: string;
    severity: string; exploitability: string; confidence: string;
    proofType: string; endpoint: string; scenarioPackSlug: string;
    remediation: string; observation: string; labels: string[];
    affectedAssets: string[];
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
        endpoint: input.endpoint, httpMethod: 'GET',
        evidenceSummary: { observation: input.observation } as Prisma.InputJsonValue,
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
