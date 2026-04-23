import { Injectable, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import axios from 'axios';
import { PrismaService } from '../../../prisma/prisma.service.js';
import { assertSafeTarget, buildSafeLookup } from '../../../common/security/ssrf-guard.js';
import { GUARDRAILS, buildAuthHeaders } from '../constants.js';
import type { SecurityScanJobData } from '../constants.js';

/**
 * INTELLIGENT_RECON — Intelligence-driven API surface discovery.
 *
 * Replaces brute-force endpoint guessing with multi-source intelligence:
 *
 *   1. JavaScript Bundle Parsing
 *      - Extracts fetch/axios/XMLHttpRequest calls with full URL + method
 *      - Detects route definitions (React Router, Vue Router, Angular)
 *      - Parses API client configurations (baseURL, endpoints map objects)
 *      - Identifies GraphQL operation names + query strings embedded in bundles
 *
 *   2. Source Map Reconstruction
 *      - Detects .js.map via header (SourceMappingURL) and path convention
 *      - Extracts original file tree from source map "sources" array
 *      - Identifies API route files from original source structure
 *
 *   3. OpenAPI / Swagger Auto-Ingestion
 *      - Probes 12+ common schema paths (/openapi.json, /swagger.json, etc.)
 *      - Parses discovered specs to extract every path + method + parameter
 *      - Stores parameter metadata for targeted fuzzing by other modules
 *
 *   4. GraphQL Introspection & Schema Extraction
 *      - Full __schema introspection (types, fields, args, mutations)
 *      - Extracts hidden mutations/queries not exposed in documentation
 *      - Identifies sensitive field names (password, ssn, secret, token)
 *
 *   5. HTML Link & Form Extraction
 *      - Parses <a href>, <form action>, <link> from HTML pages
 *      - Extracts hidden form fields that reveal internal parameters
 *
 *   6. Response Header Intelligence
 *      - X-Powered-By, Server, X-Request-Id for tech stack fingerprint
 *      - Link headers for API pagination/discovery
 *      - API versioning detection from response structure
 *
 *   7. Endpoint Clustering & Confidence Scoring
 *      - Groups discovered endpoints by resource (users, orders, etc.)
 *      - Assigns confidence: CONFIRMED (actually responded) > HIGH (in JS) > MEDIUM (in source map) > LOW (inferred)
 *      - Deduplicates parameterized paths (/users/123 → /users/:id)
 *
 * Every discovered endpoint is stored in securityEndpointInventory for
 * downstream modules (injection, BOLA, auth scanning) to consume.
 */

// ─── OpenAPI Schema Discovery Paths ─────────────────────────────────
const OPENAPI_PROBE_PATHS = [
  '/openapi.json', '/openapi.yaml', '/swagger.json', '/swagger.yaml',
  '/api-docs', '/api-docs.json', '/api/docs', '/api/openapi.json',
  '/api/swagger.json', '/api/v1/openapi.json', '/api/v1/swagger.json',
  '/docs/openapi.json', '/v2/api-docs', '/v3/api-docs',
  '/.well-known/openapi.json', '/.well-known/openapi.yaml',
];

// ─── Source Map Probe Suffixes ──────────────────────────────────────
const SOURCE_MAP_SUFFIXES = ['.map', '.js.map'];

// ─── JS Endpoint Extraction Patterns ────────────────────────────────
const JS_ENDPOINT_PATTERNS = [
  // fetch / axios / http calls
  { regex: /(?:fetch|axios\.(?:get|post|put|patch|delete|request|head|options))\s*\(\s*[`'"](\/[a-zA-Z0-9/_\-{}\.:]+)[`'"]/gi, method: 'INFER' },
  { regex: /(?:fetch|axios)\s*\(\s*\{\s*(?:url|path)\s*:\s*[`'"](\/[a-zA-Z0-9/_\-{}\.:]+)[`'"]/gi, method: 'INFER' },
  // Axios instance method chains: apiClient.get('/users')
  { regex: /\.\s*(?:get|post|put|patch|delete|head|options)\s*\(\s*[`'"](\/[a-zA-Z0-9/_\-{}\.:]+)[`'"]/gi, method: 'INFER' },
  // Explicit URL/endpoint/path assignments
  { regex: /(?:url|endpoint|apiUrl|apiEndpoint|path|route|href)\s*[:=]\s*[`'"](\/api[/a-zA-Z0-9/_\-{}\.:]*)[`'"]/gi, method: 'GET' },
  // Router definitions (React Router, Vue Router, Express)
  { regex: /(?:path|to|route|navigate)\s*[:=]\s*[`'"](\/[a-zA-Z0-9/_\-{}\.:]+)[`'"]/gi, method: 'GET' },
  // Express-style route definitions: app.get('/api/users', ...)
  { regex: /(?:app|router|server)\.\s*(get|post|put|patch|delete)\s*\(\s*[`'"](\/[a-zA-Z0-9/_\-{}\.:]+)[`'"]/gi, method: 'EXTRACT' },
  // API object maps: { users: '/api/users', orders: '/api/orders' }
  { regex: /['"]?\w+['"]?\s*:\s*[`'"](\/api[/a-zA-Z0-9/_\-{}\.:]+)[`'"]/gi, method: 'GET' },
  // Template literals with base URL concatenation: `${baseUrl}/users`
  { regex: /`\$\{[^}]+\}(\/[a-zA-Z0-9/_\-{}\.:]+)`/gi, method: 'INFER' },
];

// ─── GraphQL Operation Extraction ───────────────────────────────────
const GQL_OPERATION_PATTERNS = [
  // Named operations in JS bundles
  /(?:query|mutation|subscription)\s+(\w+)\s*(?:\([^)]*\))?\s*\{/gi,
  // gql tagged templates
  /gql\s*`\s*(query|mutation|subscription)\s+(\w+)/gi,
  // Document nodes
  /operationName\s*:\s*['"]([\w]+)['"]/gi,
];

// ─── HTML Extraction Patterns ───────────────────────────────────────
const HTML_LINK_PATTERNS = [
  /<a\s+[^>]*href\s*=\s*["']([/][^"'#?]+)/gi,
  /<form\s+[^>]*action\s*=\s*["']([/][^"'#?]+)/gi,
  /<link\s+[^>]*href\s*=\s*["']([/][^"'#?]+)/gi,
];

// ─── Tech Fingerprint Headers ───────────────────────────────────────
const TECH_FINGERPRINT_HEADERS = [
  'x-powered-by', 'server', 'x-aspnet-version', 'x-aspnetmvc-version',
  'x-generator', 'x-drupal-cache', 'x-varnish', 'x-cache',
  'x-runtime', 'x-request-id', 'x-correlation-id',
  'x-amzn-requestid', 'x-cloud-trace-context',
];

interface DiscoveredEndpoint {
  path: string;
  method: string;
  source: string;
  confidence: 'CONFIRMED' | 'HIGH' | 'MEDIUM' | 'LOW';
  metadata: Record<string, unknown>;
}

@Injectable()
export class IntelligentRecon {
  private readonly logger = new Logger(IntelligentRecon.name);

  constructor(private readonly prisma: PrismaService) {}

  async execute(data: SecurityScanJobData): Promise<void> {
    const guardrails = data.tier === 'STANDARD' ? GUARDRAILS.STANDARD : GUARDRAILS.ADVANCED;
    const baseUrl = data.baseUrl.replace(/\/+$/, '');
    let requestCount = 0;
    const maxRequests = Math.min(guardrails.maxRequestsPerScan / 3, 100);

    const scan = await this.prisma.securityScan.findUnique({
      where: { id: data.scanId },
      include: { target: { include: { assets: true } } },
    });
    if (!scan) return;

    const rootAsset = scan.target.assets[0] ?? null;
    const isLabOnly = scan.target.environment === 'LAB' || scan.target.environment === 'DEVELOPMENT';
    const authHeaders = buildAuthHeaders(data.authenticatedContext);
    const discovered: DiscoveredEndpoint[] = [];
    const techFingerprints: Record<string, string> = {};

    // ═══════════════════════════════════════════════════════════════
    // 1. OPENAPI / SWAGGER SCHEMA INGESTION
    //    The highest-fidelity discovery source. If we find a spec,
    //    we get every path, method, parameter, and response schema.
    // ═══════════════════════════════════════════════════════════════
    let openApiIngested = false;
    for (const schemaPath of OPENAPI_PROBE_PATHS) {
      if (requestCount >= maxRequests || openApiIngested) break;

      const url = `${baseUrl}${schemaPath}`;
      try {
        const parsedUrl = new URL(url);
        await assertSafeTarget(parsedUrl);

        const resp = await axios.get(url, {
          timeout: guardrails.perRequestTimeoutMs,
          validateStatus: () => true,
          maxRedirects: 3,
          responseType: 'text',
          headers: { 'User-Agent': 'Zer0Friction-SecurityScanner/1.0', 'Accept': 'application/json,application/yaml', ...authHeaders },
          lookup: buildSafeLookup() as never,
        });
        requestCount++;

        if (resp.status >= 200 && resp.status < 300) {
          const body = String(resp.data || '');
          const parsed = this.tryParseOpenApi(body);

          if (parsed) {
            const { endpoints, schemaVersion, info } = parsed;
            openApiIngested = true;

            for (const ep of endpoints) {
              discovered.push({
                path: ep.path,
                method: ep.method,
                source: 'OPENAPI_SCHEMA',
                confidence: 'CONFIRMED',
                metadata: {
                  schemaSource: schemaPath,
                  schemaVersion,
                  parameters: ep.parameters,
                  operationId: ep.operationId,
                  tags: ep.tags,
                  description: ep.description,
                  requestBody: ep.requestBody,
                },
              });
            }

            // Report OpenAPI discovery as intelligence
            await this.createObservation({
              scanId: data.scanId, targetId: data.targetId,
              category: 'TECH_DISCLOSURE',
              title: `OpenAPI Schema Publicly Accessible: ${schemaPath}`,
              severity: 'MEDIUM',
              exploitability: 'PROVEN',
              confidence: 'HIGH',
              proofType: 'RESPONSE_MATCH',
              endpoint: schemaPath,
              scenarioPackSlug: 'intelligent-recon',
              remediation: `Restrict access to ${schemaPath} in production. OpenAPI schemas expose every API endpoint, parameter name, data type, and often example values — a complete attacker blueprint.`,
              observation: `OpenAPI ${schemaVersion} schema discovered at ${schemaPath}. Title: "${info?.title ?? 'unknown'}". Extracted ${endpoints.length} endpoints with full method/parameter metadata. This gives attackers complete API surface knowledge.`,
              labels: isLabOnly ? ['LAB_ONLY'] : ['CORROBORATED'],
              affectedAssets: rootAsset ? [rootAsset.id] : [],
            });

            this.logger.log(`Ingested OpenAPI schema from ${schemaPath}: ${endpoints.length} endpoints`);
          }
        }
      } catch { requestCount++; }
    }

    // ═══════════════════════════════════════════════════════════════
    // 2. HTML PAGE CRAWLING — Links, Forms, Tech Fingerprinting
    //    Crawl key pages to extract navigation links, form actions,
    //    JS bundle URLs, and response headers for tech fingerprinting.
    // ═══════════════════════════════════════════════════════════════
    const crawlPaths = ['/', '/login', '/app', '/dashboard', '/admin', '/docs'];
    const jsFileUrls: string[] = [];

    for (const crawlPath of crawlPaths) {
      if (requestCount >= maxRequests) break;

      const url = `${baseUrl}${crawlPath}`;
      try {
        const parsedUrl = new URL(url);
        await assertSafeTarget(parsedUrl);

        const resp = await axios.get(url, {
          timeout: guardrails.perRequestTimeoutMs,
          validateStatus: () => true,
          maxRedirects: 3,
          responseType: 'text',
          headers: { 'User-Agent': 'Zer0Friction-SecurityScanner/1.0', 'Accept': 'text/html', ...authHeaders },
          lookup: buildSafeLookup() as never,
        });
        requestCount++;

        // Collect tech fingerprints from headers
        for (const header of TECH_FINGERPRINT_HEADERS) {
          const val = resp.headers[header];
          if (val && typeof val === 'string') {
            techFingerprints[header] = val;
          }
        }

        if (resp.status >= 200 && resp.status < 300) {
          const body = String(resp.data || '').substring(0, 200_000); // Larger capture for recon
          const contentType = String(resp.headers['content-type'] ?? '').toLowerCase();

          if (contentType.includes('text/html')) {
            // Extract links and form actions
            for (const pattern of HTML_LINK_PATTERNS) {
              let match: RegExpExecArray | null;
              while ((match = pattern.exec(body)) !== null) {
                const href = match[1];
                if (href.length > 1 && href.length < 200 && !href.includes('.css') && !href.includes('.png') && !href.includes('.jpg') && !href.includes('.svg') && !href.includes('.ico')) {
                  const normalized = this.normalizeEndpoint(href);
                  discovered.push({ path: normalized, method: 'GET', source: 'HTML_CRAWL', confidence: 'MEDIUM', metadata: { foundOn: crawlPath } });
                }
              }
              pattern.lastIndex = 0;
            }

            // Extract hidden form fields (reveal parameter names)
            const hiddenInputs = [...body.matchAll(/<input\s+[^>]*type\s*=\s*["']hidden["'][^>]*name\s*=\s*["']([^"']+)["']/gi)];
            const hiddenParams = hiddenInputs.map(m => m[1]).filter(Boolean);

            if (hiddenParams.length > 0) {
              // Store as recon intelligence for downstream fuzzers
              const currentProgress = (scan.stageProgress as Record<string, unknown>) ?? {};
              await this.prisma.securityScan.update({
                where: { id: data.scanId },
                data: {
                  stageProgress: {
                    ...currentProgress,
                    hiddenFormParams: hiddenParams,
                    discoveredOn: crawlPath,
                  } as Prisma.InputJsonValue,
                },
              });
            }

            // Extract JS bundle URLs
            const scriptMatches = [...body.matchAll(/<script[^>]+src=["']([^"']+)["']/gi)];
            for (const m of scriptMatches) {
              const src = m[1];
              let fullUrl: string;
              if (src.startsWith('http')) fullUrl = src;
              else if (src.startsWith('//')) fullUrl = `https:${src}`;
              else if (src.startsWith('/')) fullUrl = `${baseUrl}${src}`;
              else continue;

              // Only analyze same-origin JS
              try {
                if (new URL(fullUrl).hostname === new URL(baseUrl).hostname) {
                  jsFileUrls.push(fullUrl);
                }
              } catch { /* invalid URL, skip */ }
            }
          }
        }
      } catch { requestCount++; }
    }

    // ═══════════════════════════════════════════════════════════════
    // 3. JAVASCRIPT BUNDLE DEEP PARSING
    //    Parse every discovered JS file for API endpoints, route
    //    definitions, GraphQL operations, and API client configs.
    //    Also check for source maps.
    // ═══════════════════════════════════════════════════════════════
    const uniqueJsUrls = [...new Set(jsFileUrls)].slice(0, 15);
    const sourceMapUrls: string[] = [];

    for (const jsUrl of uniqueJsUrls) {
      if (requestCount >= maxRequests) break;

      try {
        const parsedUrl = new URL(jsUrl);
        await assertSafeTarget(parsedUrl);

        const resp = await axios.get(jsUrl, {
          timeout: guardrails.perRequestTimeoutMs,
          validateStatus: () => true,
          maxRedirects: 3,
          responseType: 'text',
          headers: { 'User-Agent': 'Zer0Friction-SecurityScanner/1.0' },
          lookup: buildSafeLookup() as never,
        });
        requestCount++;

        if (resp.status >= 200 && resp.status < 300) {
          const jsBody = String(resp.data || '').substring(0, 500_000); // Large capture for bundles
          const jsPath = new URL(jsUrl).pathname;

          // 3a. Extract API endpoints from JS
          for (const ep of JS_ENDPOINT_PATTERNS) {
            let match: RegExpExecArray | null;
            while ((match = ep.regex.exec(jsBody)) !== null) {
              // Handle patterns where method is captured (Express-style)
              let method = ep.method;
              let path: string;
              if (method === 'EXTRACT' && match[2]) {
                method = match[1].toUpperCase();
                path = match[2];
              } else {
                path = match[1];
              }

              const normalized = this.normalizeEndpoint(path);
              if (normalized.length > 1 && normalized.length < 200) {
                discovered.push({
                  path: normalized,
                  method: method === 'INFER' ? 'GET' : method,
                  source: 'JS_BUNDLE_PARSE',
                  confidence: 'HIGH',
                  metadata: { discoveredIn: jsPath, rawMatch: match[0].substring(0, 100) },
                });
              }
            }
            ep.regex.lastIndex = 0;
          }

          // 3b. Extract GraphQL operation names
          for (const gqlPattern of GQL_OPERATION_PATTERNS) {
            let match: RegExpExecArray | null;
            while ((match = gqlPattern.exec(jsBody)) !== null) {
              const opName = match[2] ?? match[1];
              if (opName && opName.length > 2 && opName.length < 100) {
                discovered.push({
                  path: '/graphql',
                  method: 'POST',
                  source: 'GQL_OPERATION_PARSE',
                  confidence: 'HIGH',
                  metadata: { operationName: opName, discoveredIn: jsPath },
                });
              }
            }
            gqlPattern.lastIndex = 0;
          }

          // 3c. Detect source map reference
          const sourceMapHeader = resp.headers['sourcemap'] || resp.headers['x-sourcemap'];
          const sourceMapComment = jsBody.match(/\/\/[#@]\s*sourceMappingURL\s*=\s*(\S+)/);
          const mapRef = sourceMapHeader || sourceMapComment?.[1];

          if (mapRef) {
            let mapUrl: string;
            if (typeof mapRef === 'string' && mapRef.startsWith('http')) {
              mapUrl = mapRef;
            } else if (typeof mapRef === 'string' && mapRef.startsWith('/')) {
              mapUrl = `${baseUrl}${mapRef}`;
            } else {
              // Relative to JS file
              const jsDir = jsUrl.substring(0, jsUrl.lastIndexOf('/'));
              mapUrl = `${jsDir}/${mapRef}`;
            }
            sourceMapUrls.push(mapUrl);
          } else {
            // Try conventional .map suffix
            for (const suffix of SOURCE_MAP_SUFFIXES) {
              sourceMapUrls.push(`${jsUrl}${suffix}`);
            }
          }
        }
      } catch { requestCount++; }
    }

    // ═══════════════════════════════════════════════════════════════
    // 4. SOURCE MAP RECONSTRUCTION
    //    Source maps expose the ENTIRE original source tree.
    //    We extract file paths to identify API routes, middleware,
    //    controller files, and config that reveal the architecture.
    // ═══════════════════════════════════════════════════════════════
    const uniqueMapUrls = [...new Set(sourceMapUrls)].slice(0, 10);

    for (const mapUrl of uniqueMapUrls) {
      if (requestCount >= maxRequests) break;

      try {
        const parsedUrl = new URL(mapUrl);
        if (parsedUrl.hostname !== new URL(baseUrl).hostname) continue;
        await assertSafeTarget(parsedUrl);

        const resp = await axios.get(mapUrl, {
          timeout: guardrails.perRequestTimeoutMs,
          validateStatus: () => true,
          maxRedirects: 0,
          responseType: 'text',
          maxContentLength: 10 * 1024 * 1024, // Source maps can be large
          headers: { 'User-Agent': 'Zer0Friction-SecurityScanner/1.0' },
          lookup: buildSafeLookup() as never,
        });
        requestCount++;

        if (resp.status >= 200 && resp.status < 300) {
          const body = String(resp.data || '');
          const map = this.tryParseSourceMap(body);

          if (map) {
            // Extract API-related source files
            const apiFiles = map.sources.filter(s =>
              /(?:api|route|controller|handler|endpoint|service|middleware|auth|admin)/i.test(s),
            );

            // Infer endpoints from file paths
            for (const filePath of apiFiles) {
              const inferredPaths = this.inferEndpointsFromSourceFile(filePath);
              for (const ep of inferredPaths) {
                discovered.push({
                  path: ep,
                  method: 'GET',
                  source: 'SOURCE_MAP',
                  confidence: 'MEDIUM',
                  metadata: { sourceFile: filePath, mapUrl: new URL(mapUrl).pathname },
                });
              }
            }

            // Source map exposure is itself a finding
            await this.createObservation({
              scanId: data.scanId, targetId: data.targetId,
              category: 'SENSITIVE_DATA_EXPOSURE',
              title: `JavaScript Source Map Exposed: ${new URL(mapUrl).pathname}`,
              severity: 'HIGH',
              exploitability: 'PROVEN',
              confidence: 'HIGH',
              proofType: 'RESPONSE_MATCH',
              endpoint: new URL(mapUrl).pathname,
              scenarioPackSlug: 'intelligent-recon',
              remediation: 'Remove source maps from production deployments. Configure your build tool (webpack/vite/esbuild) to disable source map generation for production, or restrict access via server configuration.',
              observation: `Source map at ${new URL(mapUrl).pathname} exposes ${map.sources.length} original source files. API-related files found: ${apiFiles.slice(0, 10).join(', ')}. This reveals the entire application architecture, internal routes, and potentially sensitive logic.`,
              labels: isLabOnly ? ['LAB_ONLY'] : ['CORROBORATED'],
              affectedAssets: rootAsset ? [rootAsset.id] : [],
            });
          }
        }
      } catch { requestCount++; }
    }

    // ═══════════════════════════════════════════════════════════════
    // 5. GRAPHQL SCHEMA INTROSPECTION
    //    Full schema extraction — types, fields, arguments, mutations.
    //    Discovers hidden queries/mutations not in documentation.
    // ═══════════════════════════════════════════════════════════════
    const gqlPaths = ['/graphql', '/api/graphql', '/graphiql', '/api/v1/graphql', '/gql'];
    for (const gqlPath of gqlPaths) {
      if (requestCount >= maxRequests) break;

      const url = `${baseUrl}${gqlPath}`;
      try {
        const parsedUrl = new URL(url);
        await assertSafeTarget(parsedUrl);

        const introspectionQuery = {
          query: `{
            __schema {
              queryType { name }
              mutationType { name }
              subscriptionType { name }
              types {
                name kind
                fields {
                  name
                  args { name type { name kind ofType { name kind } } }
                  type { name kind ofType { name kind } }
                }
              }
            }
          }`,
        };

        const resp = await axios.post(url, JSON.stringify(introspectionQuery), {
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

        if (resp.status >= 200 && resp.status < 300) {
          const body = String(resp.data || '');
          const gqlSchema = this.parseGraphQLSchema(body);

          if (gqlSchema) {
            // Register each query/mutation as an endpoint
            for (const op of gqlSchema.operations) {
              discovered.push({
                path: gqlPath,
                method: 'POST',
                source: 'GQL_INTROSPECTION',
                confidence: 'CONFIRMED',
                metadata: {
                  operationType: op.type,
                  operationName: op.name,
                  args: op.args,
                  returnType: op.returnType,
                },
              });
            }

            // Detect sensitive fields in the schema
            const sensitiveFields = gqlSchema.sensitiveFields;
            if (sensitiveFields.length > 0) {
              await this.createObservation({
                scanId: data.scanId, targetId: data.targetId,
                category: 'SENSITIVE_DATA_EXPOSURE',
                title: `GraphQL Schema Exposes Sensitive Fields (${sensitiveFields.length} found)`,
                severity: 'MEDIUM',
                exploitability: 'PROBABLE',
                confidence: 'HIGH',
                proofType: 'RESPONSE_MATCH',
                endpoint: gqlPath,
                scenarioPackSlug: 'intelligent-recon',
                remediation: 'Remove sensitive fields from the GraphQL schema or implement field-level authorization. Apply query depth limiting and complexity analysis to prevent deep extraction.',
                observation: `GraphQL introspection reveals ${sensitiveFields.length} potentially sensitive fields: ${sensitiveFields.slice(0, 15).map(f => `${f.type}.${f.field}`).join(', ')}. Attackers can query these directly.`,
                labels: isLabOnly ? ['LAB_ONLY'] : ['CORROBORATED'],
                affectedAssets: rootAsset ? [rootAsset.id] : [],
              });
            }

            // Introspection enabled is itself a finding
            await this.createObservation({
              scanId: data.scanId, targetId: data.targetId,
              category: 'TECH_DISCLOSURE',
              title: `GraphQL Introspection Enabled on ${gqlPath}`,
              severity: 'LOW',
              exploitability: 'PROVEN',
              confidence: 'HIGH',
              proofType: 'RESPONSE_MATCH',
              endpoint: gqlPath,
              scenarioPackSlug: 'intelligent-recon',
              remediation: 'Disable GraphQL introspection in production. Most GraphQL servers support this via configuration (e.g., Apollo: introspection: false).',
              observation: `Full GraphQL schema introspection succeeded on ${gqlPath}. Discovered ${gqlSchema.operations.length} operations (queries/mutations/subscriptions) across ${gqlSchema.typeCount} types.`,
              labels: isLabOnly ? ['LAB_ONLY'] : ['CORROBORATED'],
              affectedAssets: rootAsset ? [rootAsset.id] : [],
            });

            break; // Found a working GraphQL endpoint
          }
        }
      } catch { requestCount++; }
    }

    // ═══════════════════════════════════════════════════════════════
    // 6. TECH FINGERPRINT ANALYSIS
    //    Report technology stack indicators from response headers.
    // ═══════════════════════════════════════════════════════════════
    if (Object.keys(techFingerprints).length > 0) {
      const dangerousHeaders = Object.entries(techFingerprints).filter(([h]) =>
        ['x-powered-by', 'server', 'x-aspnet-version', 'x-aspnetmvc-version', 'x-generator', 'x-runtime'].includes(h),
      );

      if (dangerousHeaders.length > 0) {
        await this.createObservation({
          scanId: data.scanId, targetId: data.targetId,
          category: 'TECH_DISCLOSURE',
          title: `Technology Stack Exposed via HTTP Headers (${dangerousHeaders.length} headers)`,
          severity: 'LOW',
          exploitability: 'THEORETICAL',
          confidence: 'HIGH',
          proofType: 'RESPONSE_MATCH',
          endpoint: '/',
          scenarioPackSlug: 'intelligent-recon',
          remediation: 'Remove or obfuscate technology-revealing headers (X-Powered-By, Server, X-AspNet-Version). In Express: app.disable("x-powered-by"). In Nginx: server_tokens off.',
          observation: `Response headers reveal technology stack: ${dangerousHeaders.map(([h, v]) => `${h}: ${v}`).join(', ')}. This helps attackers select version-specific exploits.`,
          labels: isLabOnly ? ['LAB_ONLY'] : [],
          affectedAssets: rootAsset ? [rootAsset.id] : [],
        });
      }
    }

    // ═══════════════════════════════════════════════════════════════
    // 7. ENDPOINT DEDUPLICATION, CLUSTERING & PERSISTENCE
    //    Merge all discovered endpoints, deduplicate, and score.
    // ═══════════════════════════════════════════════════════════════
    const merged = this.deduplicateAndCluster(discovered);

    let persistedCount = 0;
    for (const ep of merged) {
      try {
        await this.prisma.securityEndpointInventory.upsert({
          where: {
            targetId_path_method: {
              targetId: data.targetId,
              path: ep.path,
              method: ep.method,
            },
          },
          update: {
            lastSeenAt: new Date(),
            source: ep.source,
            confidence: ep.confidence as never,
            metadata: ep.metadata as Prisma.InputJsonValue,
          },
          create: {
            targetId: data.targetId,
            path: ep.path,
            method: ep.method,
            source: ep.source,
            confidence: ep.confidence as never,
            metadata: ep.metadata as Prisma.InputJsonValue,
          },
        });
        persistedCount++;
      } catch {
        // Unique constraint race — ignore
      }
    }

    // Store recon summary for downstream modules
    const currentProgress = (scan.stageProgress as Record<string, unknown>) ?? {};
    await this.prisma.securityScan.update({
      where: { id: data.scanId },
      data: {
        stageProgress: {
          ...currentProgress,
          intelligentRecon: {
            totalDiscovered: merged.length,
            persisted: persistedCount,
            sources: this.countBySources(merged),
            techFingerprints,
            openApiIngested,
            jsFilesAnalyzed: uniqueJsUrls.length,
            sourceMapFound: sourceMapUrls.some(u => merged.some(m => m.source === 'SOURCE_MAP')),
            completedAt: new Date().toISOString(),
          },
        } as Prisma.InputJsonValue,
      },
    });

    this.logger.log(
      `Intelligent recon completed for scan ${data.scanId}: ${merged.length} endpoints discovered, ` +
      `${persistedCount} persisted, ${requestCount} requests used`,
    );
  }

  // ─── OpenAPI Parser ─────────────────────────────────────────────

  private tryParseOpenApi(raw: string): {
    endpoints: Array<{
      path: string; method: string; operationId?: string;
      parameters?: unknown[]; tags?: string[]; description?: string;
      requestBody?: unknown;
    }>;
    schemaVersion: string;
    info?: { title?: string; version?: string };
  } | null {
    try {
      const spec = JSON.parse(raw);
      if (!spec.paths && !spec.openapi && !spec.swagger) return null;

      const version = spec.openapi ?? spec.swagger ?? 'unknown';
      const endpoints: Array<{
        path: string; method: string; operationId?: string;
        parameters?: unknown[]; tags?: string[]; description?: string;
        requestBody?: unknown;
      }> = [];

      for (const [path, methods] of Object.entries(spec.paths ?? {})) {
        if (typeof methods !== 'object' || methods === null) continue;
        for (const [method, operation] of Object.entries(methods as Record<string, unknown>)) {
          if (['get', 'post', 'put', 'patch', 'delete', 'head', 'options'].includes(method)) {
            const op = operation as Record<string, unknown>;
            endpoints.push({
              path,
              method: method.toUpperCase(),
              operationId: op.operationId as string | undefined,
              parameters: op.parameters as unknown[] | undefined,
              tags: op.tags as string[] | undefined,
              description: (op.summary ?? op.description) as string | undefined,
              requestBody: op.requestBody,
            });
          }
        }
      }

      return endpoints.length > 0
        ? { endpoints, schemaVersion: version, info: spec.info }
        : null;
    } catch {
      return null;
    }
  }

  // ─── Source Map Parser ──────────────────────────────────────────

  private tryParseSourceMap(raw: string): { sources: string[]; version: number } | null {
    try {
      const map = JSON.parse(raw);
      if (map.version && Array.isArray(map.sources)) {
        return { sources: map.sources as string[], version: map.version as number };
      }
      return null;
    } catch {
      return null;
    }
  }

  private inferEndpointsFromSourceFile(filePath: string): string[] {
    const endpoints: string[] = [];
    // Example: src/api/users/route.ts → /api/users
    // Example: pages/api/orders/[id].ts → /api/orders/:id
    // Example: controllers/AdminController.ts → /admin

    const normalized = filePath
      .replace(/^\.\/|^webpack:\/\/\/|^~\//g, '')
      .replace(/\.(ts|tsx|js|jsx|mjs|cjs)$/, '')
      .replace(/\/index$/, '')
      .replace(/\/route$/, '')
      .replace(/\[([^\]]+)\]/g, ':$1'); // Next.js dynamic routes

    // Only infer if it looks like an API path
    if (/(?:api|route|controller|handler|pages\/api)/i.test(normalized)) {
      const parts = normalized.split('/');
      const apiIdx = parts.findIndex(p => /^api|pages$/i.test(p));
      if (apiIdx >= 0) {
        const path = '/' + parts.slice(apiIdx).join('/');
        endpoints.push(path.replace(/\/pages\/api/, '/api'));
      }
    }

    return endpoints;
  }

  // ─── GraphQL Schema Parser ──────────────────────────────────────

  private parseGraphQLSchema(raw: string): {
    operations: Array<{ name: string; type: string; args: string[]; returnType: string }>;
    sensitiveFields: Array<{ type: string; field: string }>;
    typeCount: number;
  } | null {
    try {
      const parsed = JSON.parse(raw);
      const schema = parsed?.data?.__schema;
      if (!schema?.types) return null;

      const operations: Array<{ name: string; type: string; args: string[]; returnType: string }> = [];
      const sensitiveFields: Array<{ type: string; field: string }> = [];
      const sensitivePatterns = /password|secret|token|ssn|credit.?card|cvv|pin|private.?key|api.?key|salt|hash/i;

      const queryTypeName = schema.queryType?.name;
      const mutationTypeName = schema.mutationType?.name;
      const subscriptionTypeName = schema.subscriptionType?.name;

      let typeCount = 0;

      for (const type of schema.types) {
        if (type.name?.startsWith('__')) continue; // Skip introspection types
        typeCount++;

        const isQuery = type.name === queryTypeName;
        const isMutation = type.name === mutationTypeName;
        const isSubscription = type.name === subscriptionTypeName;

        if (Array.isArray(type.fields)) {
          for (const field of type.fields) {
            // Register operations
            if (isQuery || isMutation || isSubscription) {
              operations.push({
                name: field.name,
                type: isQuery ? 'query' : isMutation ? 'mutation' : 'subscription',
                args: (field.args ?? []).map((a: Record<string, unknown>) => a.name as string),
                returnType: this.resolveGqlTypeName(field.type),
              });
            }

            // Detect sensitive fields anywhere in schema
            if (sensitivePatterns.test(field.name)) {
              sensitiveFields.push({ type: type.name, field: field.name });
            }
          }
        }
      }

      return operations.length > 0 ? { operations, sensitiveFields, typeCount } : null;
    } catch {
      return null;
    }
  }

  private resolveGqlTypeName(type: Record<string, unknown>): string {
    if (type.name) return type.name as string;
    if (type.ofType) return this.resolveGqlTypeName(type.ofType as Record<string, unknown>);
    return 'Unknown';
  }

  // ─── Endpoint Processing ────────────────────────────────────────

  private normalizeEndpoint(path: string): string {
    return path
      .replace(/\{[^}]+\}/g, ':id')           // OpenAPI params
      .replace(/\$\{[^}]+\}/g, ':id')         // Template literals
      .replace(/\/\d+\//g, '/:id/')            // Numeric IDs
      .replace(/\/\d+$/g, '/:id')              // Trailing numeric ID
      .replace(/\/[a-f0-9-]{36}/gi, '/:uuid')  // UUIDs
      .replace(/\/+/g, '/')                     // Double slashes
      .replace(/\/$/, '')                        // Trailing slash
      || '/';
  }

  private deduplicateAndCluster(endpoints: DiscoveredEndpoint[]): DiscoveredEndpoint[] {
    const byKey = new Map<string, DiscoveredEndpoint>();
    const confidenceRank: Record<string, number> = { CONFIRMED: 4, HIGH: 3, MEDIUM: 2, LOW: 1 };

    for (const ep of endpoints) {
      const key = `${ep.method}:${ep.path}`;
      const existing = byKey.get(key);
      if (!existing || (confidenceRank[ep.confidence] ?? 0) > (confidenceRank[existing.confidence] ?? 0)) {
        byKey.set(key, ep);
      }
    }

    return [...byKey.values()];
  }

  private countBySources(endpoints: DiscoveredEndpoint[]): Record<string, number> {
    const counts: Record<string, number> = {};
    for (const ep of endpoints) {
      counts[ep.source] = (counts[ep.source] ?? 0) + 1;
    }
    return counts;
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
