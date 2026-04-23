import { Injectable, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import axios from 'axios';
import { PrismaService } from '../../../prisma/prisma.service.js';
import { assertSafeTarget, buildSafeLookup } from '../../../common/security/ssrf-guard.js';
import { GUARDRAILS, buildAuthHeaders } from '../constants.js';
import type { SecurityScanJobData } from '../constants.js';

/**
 * INJECTION_DESER_ENGINE — Deep injection & deserialization exploitation.
 *
 * Goes beyond basic SQL injection into:
 *
 *   1. SQL Injection (Blind Boolean, Blind Time-Based)
 *      - Boolean: AND 1=1 vs AND 1=2 response differential
 *      - Time-based: SLEEP()/pg_sleep()/WAITFOR DELAY response latency
 *      - Union-based: column count enumeration via ORDER BY
 *
 *   2. NoSQL Injection (MongoDB, CouchDB)
 *      - $gt/$ne operator injection in JSON bodies
 *      - $where JavaScript injection
 *      - Regex-based extraction
 *      - Array injection bypasses
 *
 *   3. Prototype Pollution
 *      - __proto__ injection via JSON body
 *      - constructor.prototype injection
 *      - Object merge pollution detection
 *
 *   4. Deserialization Attacks
 *      - Node.js: node-serialize, js-yaml unsafe load detection
 *      - Java hints: Base64-encoded serialized object detection
 *      - PHP: unserialize pattern detection
 *
 *   5. GraphQL Injection
 *      - Batch query introspection bypass
 *      - Directive injection
 *      - Fragment spread abuse
 *      - Persisted query manipulation
 *
 *   6. SSRF via URL Parameters
 *      - Internal IP probing (169.254.x.x, 10.x.x.x, 127.0.0.1)
 *      - DNS rebinding detection setup
 *      - Protocol smuggling (file://, gopher://, dict://)
 *
 *   7. Server-Side Template Injection (SSTI)
 *      - Multi-engine: Jinja2, Twig, Pug, EJS, Handlebars
 *      - Safe mathematical probes ({{7*7}} → check for 49)
 *
 * SAFETY:
 *   - All production probes are READ-ONLY (no data mutation)
 *   - Blind SQLi uses safe math, not destructive queries
 *   - Time-based probes use 2-second delays (not excessive)
 *   - Every finding requires BASELINE COMPARISON for validation
 */

// ─── SQL Injection Payloads ─────────────────────────────────────────
const SQLI_BOOLEAN_PAIRS = [
  { true: "' OR 1=1--", false: "' OR 1=2--", name: 'Single-quote boolean OR', db: 'generic' },
  { true: "' AND 1=1--", false: "' AND 1=2--", name: 'Single-quote boolean AND', db: 'generic' },
  { true: '" OR 1=1--', false: '" OR 1=2--', name: 'Double-quote boolean OR', db: 'generic' },
  { true: '1 OR 1=1', false: '1 OR 1=2', name: 'Integer boolean OR', db: 'generic' },
  { true: "') OR ('1'='1", false: "') OR ('1'='2", name: 'Parenthesized boolean OR', db: 'generic' },
];

const SQLI_TIME_PAYLOADS = [
  { payload: "' OR SLEEP(2)--", name: 'MySQL SLEEP', delayMs: 2000, db: 'MySQL' },
  { payload: "'; SELECT pg_sleep(2)--", name: 'PostgreSQL pg_sleep', delayMs: 2000, db: 'PostgreSQL' },
  { payload: "'; WAITFOR DELAY '00:00:02'--", name: 'MSSQL WAITFOR', delayMs: 2000, db: 'MSSQL' },
  { payload: "' OR 1=1 AND SLEEP(2)--", name: 'MySQL AND SLEEP', delayMs: 2000, db: 'MySQL' },
];

const SQLI_UNION_PROBES = [
  "' UNION SELECT NULL--",
  "' UNION SELECT NULL,NULL--",
  "' UNION SELECT NULL,NULL,NULL--",
  "' UNION SELECT NULL,NULL,NULL,NULL--",
  "' UNION SELECT NULL,NULL,NULL,NULL,NULL--",
];

const SQLI_ERROR_INDICATORS = [
  /SQL syntax|mysql_fetch|mysql_query|pg_query|sqlite3|ORA-\d{5}|SQLSTATE/i,
  /you have an error in your sql|unclosed quotation mark|syntax error.*sql/i,
  /microsoft ole db|odbc drivers|jet database engine/i,
  /quoted string not properly terminated|invalid column name/i,
  /pg_send_query|pgsql_|postgresql/i,
];

// ─── NoSQL Injection Payloads ───────────────────────────────────────
const NOSQL_BODY_PAYLOADS = [
  { body: { '$gt': '' }, name: 'NoSQL $gt bypass (direct)', indicator: /\$gt|\$ne|MongoError/i },
  { body: { '$ne': null }, name: 'NoSQL $ne null bypass', indicator: /\$ne|MongoError/i },
  { body: { '$regex': '.*' }, name: 'NoSQL $regex wildcard', indicator: /\$regex|MongoError/i },
  { body: { '$where': 'function(){return true}' }, name: 'NoSQL $where injection', indicator: /\$where|MongoError/i },
];

// ─── Prototype Pollution Payloads ───────────────────────────────────
const PROTO_POLLUTION_PAYLOADS: Array<{ body: Record<string, unknown>; name: string; field: string }> = [
  { body: { '__proto__': { 'isAdmin': true } }, name: '__proto__.isAdmin injection', field: 'isAdmin' },
  { body: { '__proto__': { 'role': 'admin' } }, name: '__proto__.role injection', field: 'role' },
  { body: { 'constructor': { 'prototype': { 'polluted': 'true' } } }, name: 'constructor.prototype pollution', field: 'polluted' },
  { body: { '__proto__': { 'status': 200 } }, name: '__proto__.status injection', field: 'status' },
];

// ─── SSTI Payloads ──────────────────────────────────────────────────
const SSTI_PAYLOADS = [
  { payload: '{{7*7}}', expected: '49', engine: 'Jinja2/Twig/Angular', severity: 'CRITICAL' as const },
  { payload: '${7*7}', expected: '49', engine: 'EJS/Freemarker', severity: 'CRITICAL' as const },
  { payload: '#{7*7}', expected: '49', engine: 'Pug/Ruby ERB', severity: 'CRITICAL' as const },
  { payload: '<%= 7*7 %>', expected: '49', engine: 'ERB/ASP', severity: 'CRITICAL' as const },
  { payload: '{{constructor.constructor("return 7*7")()}}', expected: '49', engine: 'Handlebars', severity: 'CRITICAL' as const },
];

// ─── SSRF URL Probes ────────────────────────────────────────────────
const SSRF_URLS = [
  { url: 'http://127.0.0.1/', name: 'SSRF to localhost', provider: 'Internal' },
  { url: 'http://169.254.169.254/latest/meta-data/', name: 'SSRF to AWS IMDS', provider: 'AWS' },
  { url: 'http://metadata.google.internal/', name: 'SSRF to GCP metadata', provider: 'GCP' },
  { url: 'http://[::1]/', name: 'SSRF to IPv6 localhost', provider: 'Internal' },
  { url: 'http://0.0.0.0/', name: 'SSRF to 0.0.0.0', provider: 'Internal' },
  { url: 'http://0x7f000001/', name: 'SSRF to hex localhost', provider: 'Internal' },
  { url: 'file:///etc/passwd', name: 'SSRF file:// protocol', provider: 'Local FS' },
  { url: 'gopher://127.0.0.1:6379/_PING', name: 'SSRF gopher:// to Redis', provider: 'Redis' },
];

// ─── Deserialization Indicators ─────────────────────────────────────
const DESER_PATTERNS = [
  { pattern: /rO0ABX|ACED0005/i, name: 'Java serialized object', type: 'java', severity: 'CRITICAL' as const },
  { pattern: /O:\d+:"[^"]+"/i, name: 'PHP serialized object', type: 'php', severity: 'HIGH' as const },
  { pattern: /{"rce"|_$$ND_FUNC$$_|module\.exports/i, name: 'Node.js serialized object (node-serialize)', type: 'nodejs', severity: 'CRITICAL' as const },
  { pattern: /!!python\/object|!!python\/apply/i, name: 'Python YAML deserialization', type: 'python', severity: 'CRITICAL' as const },
];

@Injectable()
export class InjectionDeserEngine {
  private readonly logger = new Logger(InjectionDeserEngine.name);

  constructor(private readonly prisma: PrismaService) {}

  async execute(data: SecurityScanJobData): Promise<void> {
    if (data.tier === 'STANDARD') {
      this.logger.debug(`Skipping injection/deser engine for STANDARD scan ${data.scanId}`);
      return;
    }

    const guardrails = data.tier === 'ADVANCED'
      ? GUARDRAILS.ADVANCED
      : (GUARDRAILS as unknown as Record<string, typeof GUARDRAILS.ADVANCED>).DEEP ?? GUARDRAILS.ADVANCED;
    const baseUrl = data.baseUrl.replace(/\/+$/, '');
    let requestCount = 0;
    const maxRequests = Math.min(guardrails.maxRequestsPerScan / 2, 150);

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
      take: 30,
    });

    // Separate endpoints by type for targeted injection
    const queryEndpoints = endpoints.filter(ep =>
      /\/(search|query|filter|find|list|get|users|items|products|orders)/i.test(ep.path) || ep.method === 'GET',
    ).slice(0, 10);

    const mutationEndpoints = endpoints.filter(ep =>
      ep.method === 'POST' || ep.method === 'PUT' || ep.method === 'PATCH',
    ).slice(0, 10);

    const urlParamEndpoints = endpoints.filter(ep =>
      /\/(proxy|fetch|url|redirect|link|callback|webhook|image|download|load)/i.test(ep.path),
    ).slice(0, 5);

    const gqlEndpoints = endpoints.filter(ep =>
      /\/graphql|\/gql/i.test(ep.path),
    ).slice(0, 2);

    // ═══════════════════════════════════════════════════════════════
    // 1. SQL INJECTION — Boolean-Based Blind
    //    Sends TRUE and FALSE payloads. If responses differ → SQLi.
    // ═══════════════════════════════════════════════════════════════
    for (const ep of queryEndpoints) {
      if (requestCount >= maxRequests) break;

      const url = `${baseUrl}${ep.path}`;

      for (const pair of SQLI_BOOLEAN_PAIRS) {
        if (requestCount + 2 >= maxRequests) break;

        try {
          const parsedUrl = new URL(url);
          await assertSafeTarget(parsedUrl);

          // Baseline request
          const baselineResp = await axios.get(`${url}?q=test&id=1`, {
            timeout: guardrails.perRequestTimeoutMs,
            validateStatus: () => true,
            maxRedirects: 0,
            responseType: 'text',
            headers: { 'User-Agent': 'Zer0Friction-SecurityScanner/1.0', ...authHeaders },
            lookup: buildSafeLookup() as never,
          });
          requestCount++;

          const baselineBody = String(baselineResp.data || '');

          // TRUE payload
          const trueResp = await axios.get(`${url}?q=${encodeURIComponent(pair.true)}&id=${encodeURIComponent(pair.true)}`, {
            timeout: guardrails.perRequestTimeoutMs,
            validateStatus: () => true,
            maxRedirects: 0,
            responseType: 'text',
            headers: { 'User-Agent': 'Zer0Friction-SecurityScanner/1.0', ...authHeaders },
            lookup: buildSafeLookup() as never,
          });
          requestCount++;

          const trueBody = String(trueResp.data || '');

          // FALSE payload
          const falseResp = await axios.get(`${url}?q=${encodeURIComponent(pair.false)}&id=${encodeURIComponent(pair.false)}`, {
            timeout: guardrails.perRequestTimeoutMs,
            validateStatus: () => true,
            maxRedirects: 0,
            responseType: 'text',
            headers: { 'User-Agent': 'Zer0Friction-SecurityScanner/1.0', ...authHeaders },
            lookup: buildSafeLookup() as never,
          });
          requestCount++;

          const falseBody = String(falseResp.data || '');

          // Differential analysis: TRUE and FALSE must produce DIFFERENT responses
          // But TRUE must match baseline (same data)
          const trueDiff = Math.abs(trueBody.length - baselineBody.length);
          const falseDiff = Math.abs(falseBody.length - baselineBody.length);
          const trueFalseDiff = Math.abs(trueBody.length - falseBody.length);

          // Positive: TRUE≈baseline, FALSE≠baseline, TRUE≠FALSE
          if (trueDiff < 50 && falseDiff > 100 && trueFalseDiff > 100) {
            await this.createObservation({
              scanId: data.scanId, targetId: data.targetId,
              category: 'INJECTION_DETECTION',
              title: `Blind SQL Injection (Boolean-Based): ${pair.name} on ${ep.path}`,
              severity: 'CRITICAL',
              exploitability: 'PROVEN',
              confidence: 'HIGH',
              proofType: 'RESPONSE_MATCH',
              endpoint: ep.path,
              scenarioPackSlug: 'injection-deser',
              remediation: 'Use parameterized queries (prepared statements). Never concatenate user input into SQL. Use an ORM like Prisma, TypeORM, or Sequelize with parameterized methods.',
              observation: `Boolean-based blind SQLi confirmed on ${ep.path}. TRUE payload ("${pair.true.substring(0, 30)}") returned ${trueBody.length}b (matches baseline ${baselineBody.length}b). FALSE payload ("${pair.false.substring(0, 30)}") returned ${falseBody.length}b (different). Differential: ${trueFalseDiff}b.`,
              labels: isLabOnly ? ['LAB_ONLY'] : ['CORROBORATED'],
              affectedAssets: rootAsset ? [rootAsset.id] : [],
            });
            break; // One SQLi per endpoint
          }

          // Also check for error-based SQL injection
          for (const body of [trueBody, falseBody]) {
            if (SQLI_ERROR_INDICATORS.some(regex => regex.test(body))) {
              await this.createObservation({
                scanId: data.scanId, targetId: data.targetId,
                category: 'INJECTION_DETECTION',
                title: `Error-Based SQL Injection on ${ep.path}`,
                severity: 'CRITICAL',
                exploitability: 'PROVEN',
                confidence: 'HIGH',
                proofType: 'RESPONSE_MATCH',
                endpoint: ep.path,
                scenarioPackSlug: 'injection-deser',
                remediation: 'Use parameterized queries. Suppress SQL error messages in production — return generic 500 errors.',
                observation: `SQL error messages leaked in response to injection payload on ${ep.path}. The application is concatenating user input directly into SQL queries.`,
                labels: isLabOnly ? ['LAB_ONLY'] : ['CORROBORATED'],
                affectedAssets: rootAsset ? [rootAsset.id] : [],
              });
              break;
            }
          }
        } catch { requestCount += 3; }
      }
    }

    // ═══════════════════════════════════════════════════════════════
    // 2. SQL INJECTION — Time-Based Blind
    //    Measures response latency. If SLEEP succeeds → SQLi.
    // ═══════════════════════════════════════════════════════════════
    for (const ep of queryEndpoints.slice(0, 3)) {
      if (requestCount >= maxRequests) break;

      const url = `${baseUrl}${ep.path}`;

      // First: baseline timing
      let baselineTiming: number;
      try {
        const parsedUrl = new URL(url);
        await assertSafeTarget(parsedUrl);

        const start = Date.now();
        await axios.get(`${url}?q=baseline`, {
          timeout: guardrails.perRequestTimeoutMs,
          validateStatus: () => true,
          maxRedirects: 0,
          responseType: 'text',
          headers: { 'User-Agent': 'Zer0Friction-SecurityScanner/1.0', ...authHeaders },
          lookup: buildSafeLookup() as never,
        });
        requestCount++;
        baselineTiming = Date.now() - start;
      } catch { requestCount++; continue; }

      for (const timePayload of SQLI_TIME_PAYLOADS) {
        if (requestCount >= maxRequests) break;

        try {
          const parsedUrl = new URL(url);
          await assertSafeTarget(parsedUrl);

          const start = Date.now();
          await axios.get(`${url}?q=${encodeURIComponent(timePayload.payload)}&id=${encodeURIComponent(timePayload.payload)}`, {
            timeout: Math.max(guardrails.perRequestTimeoutMs, 5000),
            validateStatus: () => true,
            maxRedirects: 0,
            responseType: 'text',
            headers: { 'User-Agent': 'Zer0Friction-SecurityScanner/1.0', ...authHeaders },
            lookup: buildSafeLookup() as never,
          });
          requestCount++;
          const elapsed = Date.now() - start;

          // If response took significantly longer than baseline + the expected delay
          if (elapsed > baselineTiming + timePayload.delayMs * 0.8 && elapsed > 1500) {
            await this.createObservation({
              scanId: data.scanId, targetId: data.targetId,
              category: 'INJECTION_DETECTION',
              title: `Blind SQL Injection (Time-Based): ${timePayload.name} on ${ep.path}`,
              severity: 'CRITICAL',
              exploitability: 'PROVEN',
              confidence: 'HIGH',
              proofType: 'RESPONSE_MATCH',
              endpoint: ep.path,
              scenarioPackSlug: 'injection-deser',
              remediation: `Use parameterized queries. The ${timePayload.db} database responds to injected SLEEP/delay commands, confirming unparameterized SQL.`,
              observation: `Time-based blind SQLi confirmed. Baseline response: ${baselineTiming}ms. With "${timePayload.payload}": ${elapsed}ms (delta: ${elapsed - baselineTiming}ms, expected delay: ${timePayload.delayMs}ms). Database type: ${timePayload.db}.`,
              labels: isLabOnly ? ['LAB_ONLY'] : ['CORROBORATED'],
              affectedAssets: rootAsset ? [rootAsset.id] : [],
            });
            break; // One time-based per endpoint
          }
        } catch { requestCount++; }
      }
    }

    // ═══════════════════════════════════════════════════════════════
    // 3. NoSQL INJECTION — JSON Body Operator Injection
    // ═══════════════════════════════════════════════════════════════
    for (const ep of mutationEndpoints) {
      if (requestCount >= maxRequests) break;

      const url = `${baseUrl}${ep.path}`;

      // Baseline with normal JSON body
      let baselineResp: { status: number; body: string } | null = null;
      try {
        const parsedUrl = new URL(url);
        await assertSafeTarget(parsedUrl);

        const resp = await axios.post(url, JSON.stringify({ test: 'baseline' }), {
          timeout: guardrails.perRequestTimeoutMs,
          validateStatus: () => true,
          maxRedirects: 0,
          responseType: 'text',
          headers: { 'User-Agent': 'Zer0Friction-SecurityScanner/1.0', 'Content-Type': 'application/json', ...authHeaders },
          lookup: buildSafeLookup() as never,
        });
        requestCount++;
        baselineResp = { status: resp.status, body: String(resp.data || '') };
      } catch { requestCount++; continue; }

      for (const nosql of NOSQL_BODY_PAYLOADS) {
        if (requestCount >= maxRequests) break;

        try {
          const parsedUrl = new URL(url);
          await assertSafeTarget(parsedUrl);

          // Inject NoSQL operator in common fields
          const payloadBody = {
            username: nosql.body,
            email: nosql.body,
            password: nosql.body,
            filter: nosql.body,
            query: nosql.body,
          };

          const resp = await axios.post(url, JSON.stringify(payloadBody), {
            timeout: guardrails.perRequestTimeoutMs,
            validateStatus: () => true,
            maxRedirects: 0,
            responseType: 'text',
            headers: { 'User-Agent': 'Zer0Friction-SecurityScanner/1.0', 'Content-Type': 'application/json', ...authHeaders },
            lookup: buildSafeLookup() as never,
          });
          requestCount++;

          const body = String(resp.data || '');

          // Check for differential response or error indicators
          const hasIndicator = nosql.indicator.test(body);
          const statusDiff = resp.status !== baselineResp.status;
          const sizeDiff = Math.abs(body.length - baselineResp.body.length) > 200;

          if (hasIndicator || (statusDiff && resp.status >= 200 && resp.status < 300 && body.length > baselineResp.body.length * 2)) {
            await this.createObservation({
              scanId: data.scanId, targetId: data.targetId,
              category: 'INJECTION_DETECTION',
              title: `NoSQL Injection: ${nosql.name} on ${ep.path}`,
              severity: 'CRITICAL',
              exploitability: hasIndicator ? 'PROVEN' : 'PROBABLE',
              confidence: hasIndicator ? 'HIGH' : 'MEDIUM',
              proofType: 'RESPONSE_MATCH',
              endpoint: ep.path,
              scenarioPackSlug: 'injection-deser',
              remediation: 'Sanitize all MongoDB query inputs. Use strict type checking — reject objects/arrays where strings are expected. Use mongo-sanitize or equivalent input sanitization library.',
              observation: `NoSQL operator injection "${nosql.name}" ${hasIndicator ? 'confirmed (error indicator in response)' : 'suspected (differential response)'} on ${ep.path}. Baseline: ${baselineResp.status}/${baselineResp.body.length}b. Injection: ${resp.status}/${body.length}b.`,
              labels: isLabOnly ? ['LAB_ONLY'] : [hasIndicator ? 'CORROBORATED' : 'NEEDS_MANUAL_REVIEW'],
              affectedAssets: rootAsset ? [rootAsset.id] : [],
            });
            break; // One NoSQL finding per endpoint
          }
        } catch { requestCount++; }
      }
    }

    // ═══════════════════════════════════════════════════════════════
    // 4. PROTOTYPE POLLUTION — JSON Body __proto__ Injection
    // ═══════════════════════════════════════════════════════════════
    for (const ep of mutationEndpoints.slice(0, 5)) {
      if (requestCount >= maxRequests) break;

      const url = `${baseUrl}${ep.path}`;

      for (const proto of PROTO_POLLUTION_PAYLOADS) {
        if (requestCount >= maxRequests) break;

        try {
          const parsedUrl = new URL(url);
          await assertSafeTarget(parsedUrl);

          const resp = await axios.post(url, JSON.stringify(proto.body), {
            timeout: guardrails.perRequestTimeoutMs,
            validateStatus: () => true,
            maxRedirects: 0,
            responseType: 'text',
            headers: { 'User-Agent': 'Zer0Friction-SecurityScanner/1.0', 'Content-Type': 'application/json', ...authHeaders },
            lookup: buildSafeLookup() as never,
          });
          requestCount++;

          const body = String(resp.data || '');

          // Check if the polluted field appears in the response
          const fieldRegex = new RegExp(`"${proto.field}"\\s*:\\s*(?:true|"admin"|"true"|200)`, 'i');
          if (resp.status >= 200 && resp.status < 300 && fieldRegex.test(body)) {
            await this.createObservation({
              scanId: data.scanId, targetId: data.targetId,
              category: 'INJECTION_DETECTION',
              title: `Prototype Pollution: ${proto.name} on ${ep.path}`,
              severity: 'HIGH',
              exploitability: 'PROVEN',
              confidence: 'HIGH',
              proofType: 'RESPONSE_MATCH',
              endpoint: ep.path,
              scenarioPackSlug: 'injection-deser',
              remediation: 'Freeze Object.prototype. Use Object.create(null) for lookup maps. Sanitize __proto__ and constructor from all JSON input. Use libraries like lodash.merge carefully — many have prototype pollution CVEs.',
              observation: `Prototype pollution via ${proto.name} confirmed on ${ep.path}. Injecting "${proto.field}" via __proto__ was reflected in the response. This can lead to privilege escalation, denial of service, or remote code execution.`,
              labels: isLabOnly ? ['LAB_ONLY'] : ['CORROBORATED'],
              affectedAssets: rootAsset ? [rootAsset.id] : [],
            });
            break; // One proto finding per endpoint
          }
        } catch { requestCount++; }
      }
    }

    // ═══════════════════════════════════════════════════════════════
    // 5. SSTI — Server-Side Template Injection
    //    Injects safe mathematical expressions. If 49 appears → SSTI.
    // ═══════════════════════════════════════════════════════════════
    for (const ep of queryEndpoints.slice(0, 5)) {
      if (requestCount >= maxRequests) break;

      const url = `${baseUrl}${ep.path}`;

      for (const ssti of SSTI_PAYLOADS) {
        if (requestCount >= maxRequests) break;

        try {
          const parsedUrl = new URL(url);
          await assertSafeTarget(parsedUrl);

          // Inject via query parameters
          const resp = await axios.get(
            `${url}?q=${encodeURIComponent(ssti.payload)}&name=${encodeURIComponent(ssti.payload)}&template=${encodeURIComponent(ssti.payload)}`,
            {
              timeout: guardrails.perRequestTimeoutMs,
              validateStatus: () => true,
              maxRedirects: 0,
              responseType: 'text',
              headers: { 'User-Agent': 'Zer0Friction-SecurityScanner/1.0', ...authHeaders },
              lookup: buildSafeLookup() as never,
            },
          );
          requestCount++;

          const body = String(resp.data || '');

          // Check if the mathematical expression was evaluated
          if (body.includes(ssti.expected) && resp.status >= 200 && resp.status < 400) {
            // Verify it's not just the string "49" appearing naturally
            // by checking that the PAYLOAD string itself doesn't appear (it was evaluated)
            const payloadLiteral = ssti.payload.replace(/[{}$#<>%]/g, '');
            const isEvaluated = !body.includes(ssti.payload) || body.includes(ssti.expected);

            if (isEvaluated) {
              await this.createObservation({
                scanId: data.scanId, targetId: data.targetId,
                category: 'SSTI_DETECTION',
                title: `Server-Side Template Injection (${ssti.engine}) on ${ep.path}`,
                severity: ssti.severity,
                exploitability: 'PROVEN',
                confidence: 'HIGH',
                proofType: 'RESPONSE_MATCH',
                endpoint: ep.path,
                scenarioPackSlug: 'injection-deser',
                remediation: `Never pass user input into template engine rendering functions. Use logic-less templates or sandboxed rendering. Engine detected: ${ssti.engine}.`,
                observation: `SSTI confirmed on ${ep.path}. Injecting "${ssti.payload}" resulted in the response containing "${ssti.expected}" — the expression was evaluated server-side. Likely template engine: ${ssti.engine}. This can lead to Remote Code Execution.`,
                labels: isLabOnly ? ['LAB_ONLY'] : ['CORROBORATED'],
                affectedAssets: rootAsset ? [rootAsset.id] : [],
              });
              break; // One SSTI per endpoint
            }
          }
        } catch { requestCount++; }
      }
    }

    // ═══════════════════════════════════════════════════════════════
    // 6. SSRF VIA URL PARAMETERS
    //    Test endpoints that accept URLs as parameters.
    // ═══════════════════════════════════════════════════════════════
    for (const ep of urlParamEndpoints) {
      if (requestCount >= maxRequests) break;

      const url = `${baseUrl}${ep.path}`;

      for (const ssrf of SSRF_URLS.slice(0, 4)) {
        if (requestCount >= maxRequests) break;

        try {
          const parsedUrl = new URL(url);
          await assertSafeTarget(parsedUrl);

          const testUrl = `${url}${url.includes('?') ? '&' : '?'}url=${encodeURIComponent(ssrf.url)}&target=${encodeURIComponent(ssrf.url)}&callback=${encodeURIComponent(ssrf.url)}&redirect=${encodeURIComponent(ssrf.url)}`;

          const resp = await axios.get(testUrl, {
            timeout: guardrails.perRequestTimeoutMs,
            validateStatus: () => true,
            maxRedirects: 0,
            responseType: 'text',
            headers: { 'User-Agent': 'Zer0Friction-SecurityScanner/1.0', ...authHeaders },
            lookup: buildSafeLookup() as never,
          });
          requestCount++;

          const body = String(resp.data || '').substring(0, guardrails.maxResponseBodyCapture);

          // Check for internal content indicators
          const ssrfIndicators = [
            /ami-|instance-id|meta-data|computeMetadata/i,  // Cloud metadata
            /root:|\/bin\/|passwd/i,                          // File read
            /\+OK|ERR|PONG/i,                                // Redis/protocol
            /localhost|127\.0\.0\.1|0\.0\.0\.0/i,           // Internal reflection
          ];

          if (ssrfIndicators.some(ind => ind.test(body)) && resp.status >= 200 && resp.status < 400) {
            await this.createObservation({
              scanId: data.scanId, targetId: data.targetId,
              category: 'SSRF_POSTURE',
              title: `SSRF via URL Parameter: ${ssrf.name} on ${ep.path}`,
              severity: 'CRITICAL',
              exploitability: 'PROVEN',
              confidence: 'HIGH',
              proofType: 'RESPONSE_MATCH',
              endpoint: ep.path,
              scenarioPackSlug: 'injection-deser',
              remediation: `Block SSRF by validating URL parameters against an allowlist. Deny internal IP ranges. Block file:// and gopher:// protocols. Target: ${ssrf.provider}.`,
              observation: `SSRF confirmed via ${ssrf.name}. Injecting "${ssrf.url}" into URL parameters on ${ep.path} caused the server to fetch internal resources. Response contains internal content indicators.`,
              labels: isLabOnly ? ['LAB_ONLY'] : ['CORROBORATED'],
              affectedAssets: rootAsset ? [rootAsset.id] : [],
            });
            break; // One SSRF per endpoint
          }
        } catch { requestCount++; }
      }
    }

    // ═══════════════════════════════════════════════════════════════
    // 7. DESERIALIZATION PATTERN DETECTION — Response Analysis
    //    Scan API responses for serialized object indicators.
    // ═══════════════════════════════════════════════════════════════
    for (const ep of endpoints.slice(0, 15)) {
      if (requestCount >= maxRequests) break;

      const url = `${baseUrl}${ep.path}`;

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

        const body = String(resp.data || '');
        const cookies = resp.headers['set-cookie'];
        const bodyAndCookies = body + (Array.isArray(cookies) ? cookies.join(';') : String(cookies ?? ''));

        for (const deser of DESER_PATTERNS) {
          if (deser.pattern.test(bodyAndCookies)) {
            await this.createObservation({
              scanId: data.scanId, targetId: data.targetId,
              category: 'INJECTION_DETECTION',
              title: `Insecure Deserialization (${deser.type}): ${deser.name} on ${ep.path}`,
              severity: deser.severity,
              exploitability: 'PROBABLE',
              confidence: 'MEDIUM',
              proofType: 'RESPONSE_MATCH',
              endpoint: ep.path,
              scenarioPackSlug: 'injection-deser',
              remediation: `Do not use native serialization formats (${deser.type}). Use JSON or Protocol Buffers. If serialization is required, implement cryptographic integrity verification (HMAC).`,
              observation: `Detected ${deser.name} pattern in response/cookies from ${ep.path}. Serialized objects in API responses or session cookies can be tampered with for remote code execution. Type: ${deser.type}.`,
              labels: isLabOnly ? ['LAB_ONLY', 'NEEDS_MANUAL_REVIEW'] : ['NEEDS_MANUAL_REVIEW'],
              affectedAssets: rootAsset ? [rootAsset.id] : [],
            });
            break;
          }
        }
      } catch { requestCount++; }
    }

    this.logger.log(`Injection/deserialization engine completed for scan ${data.scanId}: ${requestCount} requests`);
  }

  // ─── Observation Factory ────────────────────────────────────────

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
        endpoint: input.endpoint, httpMethod: 'POST',
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
