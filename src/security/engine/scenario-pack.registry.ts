import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service.js';

type DefaultPack = {
  slug: string;
  name: string;
  family: 'SURFACE_VALIDATION' | 'API_EXPOSURE' | 'IDENTITY_AND_SECRETS' | 'CLOUD_AND_PERIMETER' | 'DETECTION_VALIDATION';
  version: string;
  executionMode: 'STANDARD' | 'ADVANCED' | 'EMULATION' | 'CONTINUOUS_VALIDATION';
  safetyLevel: 'SAFE' | 'GUARDED' | 'COLLECTOR_ONLY';
  description: string;
  supportedAssetKinds: string[];
  attckTechniques: string[];
  prerequisites?: Record<string, unknown>;
  steps: Array<{
    orderIndex: number;
    stepType: 'HTTP_REQUEST' | 'DNS_QUERY' | 'HEADER_MUTATION' | 'AUTH_WORKFLOW' | 'CLOUD_READ' | 'IDENTITY_ENUM' | 'COLLECTOR_ACTION' | 'DETECTION_ASSERTION';
    title: string;
    config?: Record<string, unknown>;
    verificationRule?: Record<string, unknown>;
    requiresCollector?: boolean;
  }>;
};

const DEFAULT_PACKS: DefaultPack[] = [
  // ─── OWASP API1: Broken Object Level Authorization (BOLA / IDOR) ─────
  {
    slug: 'bola-idor',
    name: 'BOLA / IDOR Detection',
    family: 'API_EXPOSURE',
    version: '1.0.0',
    executionMode: 'ADVANCED',
    safetyLevel: 'GUARDED',
    description: 'Tests for Broken Object Level Authorization by enumerating IDs in API paths. The #1 vulnerability causing modern API breaches (Uber, Facebook, USPS).',
    supportedAssetKinds: ['API', 'WEB_APP'],
    attckTechniques: ['T1087', 'T1212', 'T1530'],
    steps: [
      {
        orderIndex: 1,
        stepType: 'HTTP_REQUEST',
        title: 'Discover endpoints containing object identifiers (UUIDs, numeric IDs)',
        verificationRule: { produces: ['inventory'], pattern: '/[a-f0-9-]{36}|/\\d+' },
      },
      {
        orderIndex: 2,
        stepType: 'AUTH_WORKFLOW',
        title: 'Replay requests with incremented / foreign object IDs',
        verificationRule: { produces: ['observations', 'evidence'], requiresObjectIdEnumeration: true },
      },
      {
        orderIndex: 3,
        stepType: 'HTTP_REQUEST',
        title: 'Check if responses return data that should be access-controlled',
        verificationRule: { produces: ['observations'], requiresJsonOrDataSignals: true },
      },
    ],
  },

  // ─── OWASP API2: Broken Authentication ───────────────────────────────
  {
    slug: 'broken-authentication',
    name: 'Broken Authentication',
    family: 'IDENTITY_AND_SECRETS',
    version: '1.0.0',
    executionMode: 'ADVANCED',
    safetyLevel: 'GUARDED',
    description: 'Probes for missing brute-force protection, weak JWT algorithm acceptance (alg:none), expired session tokens, and default credentials on admin endpoints.',
    supportedAssetKinds: ['API', 'WEB_APP', 'IDENTITY_TENANT'],
    attckTechniques: ['T1110', 'T1528', 'T1556'],
    steps: [
      {
        orderIndex: 1,
        stepType: 'HTTP_REQUEST',
        title: 'Identify login, token refresh, and password reset endpoints',
        verificationRule: { produces: ['inventory'] },
      },
      {
        orderIndex: 2,
        stepType: 'AUTH_WORKFLOW',
        title: 'Send JWT with alg:none header to bypass signature verification',
        verificationRule: { produces: ['observations', 'evidence'], attackVectorType: 'JWT_NONE_ALG' },
      },
      {
        orderIndex: 3,
        stepType: 'AUTH_WORKFLOW',
        title: 'Test for missing rate limiting on authentication endpoints',
        verificationRule: { produces: ['observations'], attackVectorType: 'RATE_LIMIT_PROBE' },
      },
    ],
  },

  // ─── OWASP API3: Broken Object Property Level Authorization ──────────
  {
    slug: 'mass-assignment',
    name: 'Mass Assignment / Overposting',
    family: 'API_EXPOSURE',
    version: '1.0.0',
    executionMode: 'ADVANCED',
    safetyLevel: 'GUARDED',
    description: 'Injects privileged fields (isAdmin, role, plan, verified) into PUT/PATCH/POST body. How GitHub was hacked in 2012. Still #1 in Rails/Node/Prisma stacks.',
    supportedAssetKinds: ['API', 'WEB_APP'],
    attckTechniques: ['T1548', 'T1212'],
    steps: [
      {
        orderIndex: 1,
        stepType: 'HTTP_REQUEST',
        title: 'Identify writeable endpoints (POST/PUT/PATCH) with JSON body',
        verificationRule: { produces: ['inventory'], methods: ['POST', 'PUT', 'PATCH'] },
      },
      {
        orderIndex: 2,
        stepType: 'HEADER_MUTATION',
        title: 'Replay requests injecting privileged fields (isAdmin, role, plan, credits)',
        verificationRule: { produces: ['observations', 'evidence'], attackVectorType: 'MASS_ASSIGNMENT' },
      },
    ],
  },

  // ─── OWASP API4: Unrestricted Resource Consumption / Rate Limiting ────
  {
    slug: 'rate-limit-abuse',
    name: 'Rate Limiting & DoS Vectors',
    family: 'API_EXPOSURE',
    version: '1.0.0',
    executionMode: 'ADVANCED',
    safetyLevel: 'GUARDED',
    description: 'Checks for missing rate limits on sensitive operations (login, password reset, OTP) and GraphQL query batching bypasses that allow 1000 requests in one HTTP call.',
    supportedAssetKinds: ['API', 'WEB_APP'],
    attckTechniques: ['T1499', 'T1110.004'],
    steps: [
      {
        orderIndex: 1,
        stepType: 'HTTP_REQUEST',
        title: 'Send concurrent requests to authentication endpoints to detect rate limiting',
        verificationRule: { produces: ['observations'], concurrencyLevel: 10 },
      },
      {
        orderIndex: 2,
        stepType: 'HTTP_REQUEST',
        title: 'Test GraphQL batching — send 100 mutations in a single request',
        verificationRule: { produces: ['observations'], attackVectorType: 'GRAPHQL_BATCH' },
      },
    ],
  },

  // ─── OWASP API5: Broken Function Level Authorization ─────────────────
  {
    slug: 'privilege-escalation',
    name: 'Function Level Auth & Privilege Escalation',
    family: 'IDENTITY_AND_SECRETS',
    version: '1.0.0',
    executionMode: 'ADVANCED',
    safetyLevel: 'GUARDED',
    description: 'Tests whether admin-only endpoints (/admin, /internal, /v1/manage/*) are accessible to regular user tokens. Catches missing middleware guards.',
    supportedAssetKinds: ['API', 'WEB_APP'],
    attckTechniques: ['T1078', 'T1548'],
    steps: [
      {
        orderIndex: 1,
        stepType: 'HTTP_REQUEST',
        title: 'Discover admin/management endpoints via wordlist and response fingerprinting',
        verificationRule: { produces: ['inventory'], wordlistType: 'ADMIN_PATHS' },
      },
      {
        orderIndex: 2,
        stepType: 'AUTH_WORKFLOW',
        title: 'Replay admin endpoint requests with regular user JWT and check for 200 OK',
        verificationRule: { produces: ['observations', 'evidence'] },
      },
    ],
  },

  // ─── Injection Suite (SQL, NoSQL, SSTI, Path, Log4Shell) ─────────────
  {
    slug: 'injection-suite',
    name: 'Injection Detection Suite',
    family: 'API_EXPOSURE',
    version: '1.0.0',
    executionMode: 'ADVANCED',
    safetyLevel: 'GUARDED',
    description: 'Full injection coverage: SQL, NoSQL (MongoDB $gt/$where), Server-Side Template Injection, Path Traversal, and Log4Shell patterns across all discovered parameters.',
    supportedAssetKinds: ['API', 'WEB_APP'],
    attckTechniques: ['T1190', 'T1059'],
    steps: [
      {
        orderIndex: 1,
        stepType: 'HTTP_REQUEST',
        title: 'Run SQL, NoSQL, SSTI, and path traversal payloads against query params',
        verificationRule: { produces: ['observations', 'evidence'], payloadSets: ['SQLI', 'NOSQLI', 'SSTI', 'PATH_TRAVERSAL'] },
      },
      {
        orderIndex: 2,
        stepType: 'HEADER_MUTATION',
        title: 'Inject SSTI and Log4Shell payloads in User-Agent, X-Forwarded-For headers',
        verificationRule: { produces: ['observations'], payloadSets: ['LOG4SHELL', 'SSTI'] },
      },
    ],
  },

  // ─── GraphQL Abuse ────────────────────────────────────────────────────
  {
    slug: 'graphql-abuse',
    name: 'GraphQL Attack Surface',
    family: 'API_EXPOSURE',
    version: '1.0.0',
    executionMode: 'ADVANCED',
    safetyLevel: 'GUARDED',
    description: 'Introspection schema harvesting, query depth attacks, field suggestion enumeration, and alias-based auth bypass. Critical for 80% of modern SaaS stacks.',
    supportedAssetKinds: ['API', 'WEB_APP'],
    attckTechniques: ['T1526', 'T1087', 'T1190'],
    steps: [
      {
        orderIndex: 1,
        stepType: 'HTTP_REQUEST',
        title: 'Detect GraphQL endpoint and attempt introspection schema dump',
        verificationRule: { produces: ['inventory', 'observations'], attackVectorType: 'GRAPHQL_INTROSPECTION' },
      },
      {
        orderIndex: 2,
        stepType: 'HTTP_REQUEST',
        title: 'Send deeply nested query to test for DoS / missing depth limit',
        verificationRule: { produces: ['observations'], attackVectorType: 'GRAPHQL_DEPTH' },
      },
      {
        orderIndex: 3,
        stepType: 'AUTH_WORKFLOW',
        title: 'Use field aliases to bypass per-field rate limits',
        verificationRule: { produces: ['observations'], attackVectorType: 'GRAPHQL_ALIAS_BYPASS' },
      },
    ],
  },

  // ─── Subdomain Takeover & Supply Chain ───────────────────────────────
  {
    slug: 'subdomain-takeover',
    name: 'Subdomain Takeover & Supply Chain',
    family: 'CLOUD_AND_PERIMETER',
    version: '1.0.0',
    executionMode: 'ADVANCED',
    safetyLevel: 'SAFE',
    description: 'Enumerates subdomains and checks for dangling DNS CNAME records pointing to deprovisioned Vercel, S3, GitHub Pages, or Heroku services that an attacker could claim.',
    supportedAssetKinds: ['DOMAIN', 'WEB_APP', 'API'],
    attckTechniques: ['T1584.001', 'T1526'],
    steps: [
      {
        orderIndex: 1,
        stepType: 'DNS_QUERY',
        title: 'Enumerate subdomains via DNS CNAME record analysis',
        verificationRule: { produces: ['inventory'], queryTypes: ['CNAME', 'A', 'NS'] },
      },
      {
        orderIndex: 2,
        stepType: 'HTTP_REQUEST',
        title: 'Probe dangling CNAMEs for known takeover fingerprints (Vercel 404, GitHub 404)',
        verificationRule: { produces: ['observations', 'evidence'], fingerprints: ['vercel-404', 'github-pages-404', 'heroku-no-app', 's3-no-bucket'] },
      },
    ],
  },

  // ─── OAuth / OIDC Attack Surface ─────────────────────────────────────
  {
    slug: 'oauth-oidc-abuse',
    name: 'OAuth & OIDC Misconfiguration',
    family: 'IDENTITY_AND_SECRETS',
    version: '1.0.0',
    executionMode: 'ADVANCED',
    safetyLevel: 'GUARDED',
    description: 'Detects open redirect_uri parameters, token leakage via Referer header, PKCE bypass, and implicit flow misuse in OAuth2/OIDC implementations.',
    supportedAssetKinds: ['IDENTITY_TENANT', 'WEB_APP', 'API'],
    attckTechniques: ['T1528', 'T1550.001'],
    steps: [
      {
        orderIndex: 1,
        stepType: 'HTTP_REQUEST',
        title: 'Identify OAuth authorization endpoints (/oauth/authorize, /connect)',
        verificationRule: { produces: ['inventory'] },
      },
      {
        orderIndex: 2,
        stepType: 'AUTH_WORKFLOW',
        title: 'Test for open redirect_uri — inject external domain as callback',
        verificationRule: { produces: ['observations', 'evidence'], attackVectorType: 'OAUTH_REDIRECT' },
      },
      {
        orderIndex: 3,
        stepType: 'AUTH_WORKFLOW',
        title: 'Check if access tokens leak in URL parameters or Referer headers',
        verificationRule: { produces: ['observations'], attackVectorType: 'TOKEN_LEAKAGE' },
      },
    ],
  },

  // ─── Web Cache Poisoning ──────────────────────────────────────────────
  {
    slug: 'cache-poisoning',
    name: 'Web Cache Poisoning',
    family: 'SURFACE_VALIDATION',
    version: '1.0.0',
    executionMode: 'ADVANCED',
    safetyLevel: 'GUARDED',
    description: 'Injects unkeyed headers (X-Forwarded-Host, X-Original-URL) to test if CDN/proxy caches serve poisoned responses to other users. Critical for Vercel/Cloudflare/Fastly deployments.',
    supportedAssetKinds: ['WEB_APP', 'API', 'DOMAIN'],
    attckTechniques: ['T1557', 'T1190'],
    steps: [
      {
        orderIndex: 1,
        stepType: 'HEADER_MUTATION',
        title: 'Inject X-Forwarded-Host and X-Original-URL with attacker domain',
        verificationRule: { produces: ['observations'], attackVectorType: 'CACHE_POISON_HOST' },
      },
      {
        orderIndex: 2,
        stepType: 'HTTP_REQUEST',
        title: 'Replay without injected headers to check if poisoned response was cached',
        verificationRule: { produces: ['observations', 'evidence'], attackVectorType: 'CACHE_POISON_VERIFY' },
      },
    ],
  },

  // ─── Surface Validation (STANDARD — passive) ─────────────────────────
  {
    slug: 'surface-validation',
    name: 'Surface Validation',
    family: 'SURFACE_VALIDATION',
    version: '1.1.0',
    executionMode: 'STANDARD',
    safetyLevel: 'SAFE',
    description: 'Security headers, TLS posture, CSP quality, CORS policy, cookie flags, cache-control directives, and technology disclosure. Safe for production — no attack payloads.',
    supportedAssetKinds: ['WEB_APP', 'API', 'DOMAIN'],
    attckTechniques: ['T1190'],
    steps: [
      {
        orderIndex: 1,
        stepType: 'HTTP_REQUEST',
        title: 'Probe base URL and capture passive response metadata',
        verificationRule: { requiresHeaders: true, produces: ['observations', 'evidence'] },
      },
      {
        orderIndex: 2,
        stepType: 'HEADER_MUTATION',
        title: 'Replay with hostile Origin header to validate CORS behavior',
        verificationRule: { produces: ['observations'] },
      },
    ],
  },

  // ─── API Exposure (ADVANCED) ──────────────────────────────────────────
  {
    slug: 'api-exposure',
    name: 'API Exposure',
    family: 'API_EXPOSURE',
    version: '1.0.0',
    executionMode: 'ADVANCED',
    safetyLevel: 'SAFE',
    description: 'Endpoint discovery via path wordlists + passive crawling, unauthenticated data exposure, debug route detection, and OpenAPI/Swagger schema leaks.',
    supportedAssetKinds: ['API', 'WEB_APP'],
    attckTechniques: ['T1190', 'T1087'],
    steps: [
      {
        orderIndex: 1,
        stepType: 'HTTP_REQUEST',
        title: 'Discover reachable endpoints',
        verificationRule: { produces: ['inventory'] },
      },
      {
        orderIndex: 2,
        stepType: 'AUTH_WORKFLOW',
        title: 'Probe for anonymous access and leaked data',
        verificationRule: { requiresJsonOrDataSignals: true, produces: ['observations', 'evidence'] },
      },
    ],
  },

  // ─── Identity & Secrets (ADVANCED) ───────────────────────────────────
  {
    slug: 'identity-and-secrets',
    name: 'Identity & Secrets',
    family: 'IDENTITY_AND_SECRETS',
    version: '1.0.0',
    executionMode: 'ADVANCED',
    safetyLevel: 'SAFE',
    description: 'Scans responses for leaked tokens, JWTs, private keys, API keys, cloud credentials, and callback weaknesses in identity flows.',
    supportedAssetKinds: ['API', 'WEB_APP', 'IDENTITY_TENANT'],
    attckTechniques: ['T1528', 'T1552'],
    steps: [
      {
        orderIndex: 1,
        stepType: 'HTTP_REQUEST',
        title: 'Inspect responses for secrets and identity leakage',
        verificationRule: { requiresSecondSignal: true, produces: ['observations'] },
      },
    ],
  },

  // ─── Cloud & Perimeter (EMULATION) ───────────────────────────────────
  {
    slug: 'cloud-and-perimeter',
    name: 'Cloud & Perimeter',
    family: 'CLOUD_AND_PERIMETER',
    version: '1.0.0',
    executionMode: 'EMULATION',
    safetyLevel: 'GUARDED',
    description: 'Public S3 buckets, exposed admin planes, cloud metadata endpoint reachability (AWS/GCP/Azure), debug routes (.env, .git, actuator), and risky ingress rules.',
    supportedAssetKinds: ['CLOUD_ACCOUNT', 'HOST', 'DOMAIN', 'API'],
    attckTechniques: ['T1190', 'T1552'],
    steps: [
      {
        orderIndex: 1,
        stepType: 'HTTP_REQUEST',
        title: 'Probe exposed perimeter resources with safe payloads',
        verificationRule: { produces: ['observations', 'evidence'] },
      },
    ],
  },

  // ─── Detection Validation (CONTINUOUS) ───────────────────────────────
  {
    slug: 'detection-validation',
    name: 'Detection Validation',
    family: 'DETECTION_VALIDATION',
    version: '1.0.0',
    executionMode: 'CONTINUOUS_VALIDATION',
    safetyLevel: 'COLLECTOR_ONLY',
    description: 'Continuously replays benign attack emulations through an installed collector agent to verify that your WAF, SIEM, and EDR controls are actually detecting threats.',
    supportedAssetKinds: ['COLLECTOR', 'HOST', 'CLOUD_ACCOUNT', 'IDENTITY_TENANT'],
    attckTechniques: ['T1190', 'T1110'],
    prerequisites: { requiresCollector: true },
    steps: [
      {
        orderIndex: 1,
        stepType: 'COLLECTOR_ACTION',
        title: 'Execute benign validation workflow through collector',
        requiresCollector: true,
        verificationRule: { produces: ['control_verdicts', 'evidence'] },
      },
      {
        orderIndex: 2,
        stepType: 'DETECTION_ASSERTION',
        title: 'Check expected detector outcomes',
        requiresCollector: true,
      },
    ],
  },

  // ─── Authenticated Scanning ──────────────────────────────────────────
  {
    slug: 'authenticated-scan',
    name: 'Authenticated Scanning',
    family: 'IDENTITY_AND_SECRETS',
    version: '1.0.0',
    executionMode: 'ADVANCED',
    safetyLevel: 'GUARDED',
    description: 'Auth-aware differential scanning: compares unauthenticated vs authenticated vs multi-role responses to detect access control gaps, missing auth middleware, and broken function-level authorization.',
    supportedAssetKinds: ['API', 'WEB_APP'],
    attckTechniques: ['T1078', 'T1548', 'T1087'],
    prerequisites: { requiresAuthContext: true },
    steps: [
      {
        orderIndex: 1,
        stepType: 'AUTH_WORKFLOW',
        title: 'Compare unauthenticated vs authenticated endpoint responses',
        verificationRule: { produces: ['observations', 'evidence'], attackVectorType: 'AUTH_DIFFERENTIAL' },
      },
      {
        orderIndex: 2,
        stepType: 'AUTH_WORKFLOW',
        title: 'Multi-role comparison scan (admin vs user vs guest)',
        verificationRule: { produces: ['observations', 'evidence'], attackVectorType: 'ROLE_DIFFERENTIAL' },
      },
    ],
  },

  // ─── Client-Side Analysis ────────────────────────────────────────────
  {
    slug: 'client-side-analysis',
    name: 'Client-Side Security Analysis',
    family: 'SURFACE_VALIDATION',
    version: '1.0.0',
    executionMode: 'ADVANCED',
    safetyLevel: 'SAFE',
    description: 'DOM-based XSS detection (sink/source analysis), CSP strength evaluation, JS endpoint extraction, inline secret scanning, third-party script SRI validation, and browser storage security patterns.',
    supportedAssetKinds: ['WEB_APP'],
    attckTechniques: ['T1189', 'T1059.007', 'T1552'],
    steps: [
      {
        orderIndex: 1,
        stepType: 'HTTP_REQUEST',
        title: 'Fetch HTML pages and analyze for DOM XSS patterns',
        verificationRule: { produces: ['observations'], attackVectorType: 'DOM_XSS_ANALYSIS' },
      },
      {
        orderIndex: 2,
        stepType: 'HTTP_REQUEST',
        title: 'Extract and analyze JavaScript files for secrets and endpoints',
        verificationRule: { produces: ['inventory', 'observations'], attackVectorType: 'JS_ANALYSIS' },
      },
      {
        orderIndex: 3,
        stepType: 'HTTP_REQUEST',
        title: 'Evaluate CSP policy and third-party script integrity',
        verificationRule: { produces: ['observations'], attackVectorType: 'CSP_ANALYSIS' },
      },
    ],
  },

  // ─── Secrets Detection ───────────────────────────────────────────────
  {
    slug: 'secrets-detection',
    name: 'Secrets & Credential Exposure',
    family: 'IDENTITY_AND_SECRETS',
    version: '1.0.0',
    executionMode: 'ADVANCED',
    safetyLevel: 'SAFE',
    description: 'Scans for exposed API keys (AWS, GCP, Stripe, OpenAI, GitHub), database connection strings, private keys, backup files (.env, .git/config), and JWT tokens across API responses and static files.',
    supportedAssetKinds: ['API', 'WEB_APP', 'DOMAIN'],
    attckTechniques: ['T1552', 'T1528', 'T1083'],
    steps: [
      {
        orderIndex: 1,
        stepType: 'HTTP_REQUEST',
        title: 'Probe for exposed backup and configuration files',
        verificationRule: { produces: ['observations', 'evidence'], attackVectorType: 'BACKUP_FILE_PROBE' },
      },
      {
        orderIndex: 2,
        stepType: 'HTTP_REQUEST',
        title: 'Scan API endpoint responses for leaked credentials',
        verificationRule: { produces: ['observations', 'evidence'], attackVectorType: 'RESPONSE_SECRET_SCAN' },
      },
    ],
  },

  // ─── Cloud & Infrastructure ──────────────────────────────────────────
  {
    slug: 'cloud-infrastructure',
    name: 'Cloud & Infrastructure Exposure',
    family: 'CLOUD_AND_PERIMETER',
    version: '1.0.0',
    executionMode: 'ADVANCED',
    safetyLevel: 'GUARDED',
    description: 'Exposed admin panels (phpMyAdmin, Jenkins, Grafana, etc.), service fingerprinting (Elasticsearch, K8s, Redis), SSRF-based cloud metadata probing, and storage bucket permission analysis.',
    supportedAssetKinds: ['HOST', 'DOMAIN', 'API', 'WEB_APP', 'CLOUD_ACCOUNT'],
    attckTechniques: ['T1190', 'T1552', 'T1018'],
    steps: [
      {
        orderIndex: 1,
        stepType: 'HTTP_REQUEST',
        title: 'Detect exposed admin panels and management interfaces',
        verificationRule: { produces: ['observations', 'evidence'], attackVectorType: 'ADMIN_PANEL_PROBE' },
      },
      {
        orderIndex: 2,
        stepType: 'HTTP_REQUEST',
        title: 'Probe for exposed infrastructure services',
        verificationRule: { produces: ['observations'], attackVectorType: 'SERVICE_PROBE' },
      },
      {
        orderIndex: 3,
        stepType: 'HTTP_REQUEST',
        title: 'Test for SSRF to cloud metadata endpoints',
        verificationRule: { produces: ['observations', 'evidence'], attackVectorType: 'METADATA_SSRF' },
      },
    ],
  },

  // ─── API Abuse Detection ─────────────────────────────────────────────
  {
    slug: 'api-abuse',
    name: 'API Abuse & BOPLA Detection',
    family: 'API_EXPOSURE',
    version: '1.0.0',
    executionMode: 'ADVANCED',
    safetyLevel: 'GUARDED',
    description: 'Broken Object Property Level Authorization, unbounded pagination abuse, filter/sort injection, API version downgrade detection, and GraphQL batch query cost analysis.',
    supportedAssetKinds: ['API', 'WEB_APP'],
    attckTechniques: ['T1087', 'T1499', 'T1190'],
    steps: [
      {
        orderIndex: 1,
        stepType: 'HTTP_REQUEST',
        title: 'Test pagination parameters for unbounded data extraction',
        verificationRule: { produces: ['observations'], attackVectorType: 'PAGINATION_ABUSE' },
      },
      {
        orderIndex: 2,
        stepType: 'HTTP_REQUEST',
        title: 'Inject filter/sort parameters to restrict-bypass sensitive fields',
        verificationRule: { produces: ['observations'], attackVectorType: 'FILTER_INJECTION' },
      },
      {
        orderIndex: 3,
        stepType: 'HTTP_REQUEST',
        title: 'Check for BOPLA and exposed internal properties',
        verificationRule: { produces: ['observations', 'evidence'], attackVectorType: 'BOPLA' },
      },
    ],
  },

  // ─── Business Logic Testing ──────────────────────────────────────────
  {
    slug: 'business-logic',
    name: 'Business Logic & Workflow Testing',
    family: 'API_EXPOSURE',
    version: '1.0.0',
    executionMode: 'ADVANCED',
    safetyLevel: 'GUARDED',
    description: 'Multi-step workflow bypass detection (checkout, registration, password reset flows), replay attack protection validation, and safe race condition simulation for value-sensitive operations.',
    supportedAssetKinds: ['API', 'WEB_APP'],
    attckTechniques: ['T1190', 'T1199'],
    steps: [
      {
        orderIndex: 1,
        stepType: 'HTTP_REQUEST',
        title: 'Test multi-step workflow bypass (step skipping)',
        verificationRule: { produces: ['observations'], attackVectorType: 'WORKFLOW_BYPASS' },
      },
      {
        orderIndex: 2,
        stepType: 'HTTP_REQUEST',
        title: 'Detect replay attack vulnerabilities on sensitive endpoints',
        verificationRule: { produces: ['observations'], attackVectorType: 'REPLAY_ATTACK' },
      },
      {
        orderIndex: 3,
        stepType: 'HTTP_REQUEST',
        title: 'Safe race condition simulation on value-sensitive operations',
        verificationRule: { produces: ['observations'], attackVectorType: 'RACE_CONDITION' },
      },
    ],
  },

  // ─── Credential Auditing (BEAST MODE) ────────────────────────────────
  {
    slug: 'credential-audit',
    name: 'Credential & Password Auditing',
    family: 'IDENTITY_AND_SECRETS',
    version: '1.0.0',
    executionMode: 'ADVANCED',
    safetyLevel: 'GUARDED',
    description: 'The most aggressive auth-probing capability: default credential testing (admin:admin, root:root), admin panel default creds (Jenkins, Grafana, phpMyAdmin, Tomcat, etc.), password spraying simulation, password policy analysis, breached-password detection, brute-force protection bypass via X-Forwarded-For, account lockout threshold analysis, and session/reset token entropy evaluation.',
    supportedAssetKinds: ['API', 'WEB_APP', 'IDENTITY_TENANT'],
    attckTechniques: ['T1110', 'T1110.001', 'T1110.003', 'T1110.004', 'T1078', 'T1078.001'],
    steps: [
      {
        orderIndex: 1,
        stepType: 'AUTH_WORKFLOW',
        title: 'Test default credentials against login endpoints',
        verificationRule: { produces: ['observations', 'evidence'], attackVectorType: 'DEFAULT_CREDS' },
      },
      {
        orderIndex: 2,
        stepType: 'AUTH_WORKFLOW',
        title: 'Probe known admin panels with vendor default credentials',
        verificationRule: { produces: ['observations', 'evidence'], attackVectorType: 'ADMIN_PANEL_CREDS' },
      },
      {
        orderIndex: 3,
        stepType: 'AUTH_WORKFLOW',
        title: 'Password spraying: one password across many usernames',
        verificationRule: { produces: ['observations', 'evidence'], attackVectorType: 'PASSWORD_SPRAY' },
      },
      {
        orderIndex: 4,
        stepType: 'HTTP_REQUEST',
        title: 'Evaluate password policy via registration endpoint probing',
        verificationRule: { produces: ['observations'], attackVectorType: 'PASSWORD_POLICY' },
      },
      {
        orderIndex: 5,
        stepType: 'HTTP_REQUEST',
        title: 'Test brute-force protection and lockout bypass',
        verificationRule: { produces: ['observations', 'evidence'], attackVectorType: 'LOCKOUT_BYPASS' },
      },
      {
        orderIndex: 6,
        stepType: 'HTTP_REQUEST',
        title: 'Analyze password reset token entropy and predictability',
        verificationRule: { produces: ['observations'], attackVectorType: 'TOKEN_ENTROPY' },
      },
    ],
  },

  // ─── Breach Exposure Auditing ─────────────────────────────────────────
  {
    slug: 'breach-exposure',
    name: 'Breach Exposure & Password Leak Detection',
    family: 'IDENTITY_AND_SECRETS',
    version: '1.0.0',
    executionMode: 'ADVANCED',
    safetyLevel: 'SAFE',
    description: 'Checks passwords against the HaveIBeenPwned Pwned Passwords breach database using k-anonymity (privacy-safe). Reports which passwords are leaked, breach appearance counts, and tests whether the target application rejects breached passwords on registration and password-change flows. Uses NIST 800-63B recommended breach-password detection.',
    supportedAssetKinds: ['API', 'WEB_APP', 'IDENTITY_TENANT'],
    attckTechniques: ['T1110', 'T1110.001', 'T1110.004', 'T1589'],
    steps: [
      {
        orderIndex: 1,
        stepType: 'HTTP_REQUEST',
        title: 'HIBP breach corpus scan: check 100 passwords against Pwned Passwords API (k-anonymity)',
        verificationRule: { produces: ['observations'], attackVectorType: 'HIBP_BREACH_SCAN' },
      },
      {
        orderIndex: 2,
        stepType: 'HTTP_REQUEST',
        title: 'Test target registration endpoint for breached password rejection',
        verificationRule: { produces: ['observations', 'evidence'], attackVectorType: 'BREACH_REJECTION_REGISTER' },
      },
      {
        orderIndex: 3,
        stepType: 'AUTH_WORKFLOW',
        title: 'Test target password-change endpoint for breached password rejection',
        verificationRule: { produces: ['observations', 'evidence'], attackVectorType: 'BREACH_REJECTION_CHANGE' },
      },
      {
        orderIndex: 4,
        stepType: 'HTTP_REQUEST',
        title: 'Cross-reference default credentials against breach databases',
        verificationRule: { produces: ['observations'], attackVectorType: 'DEFAULT_CRED_BREACH_XREF' },
      },
    ],
  },

  // ─── User Enumeration Detection ──────────────────────────────────────
  {
    slug: 'user-enumeration',
    name: 'User & Account Enumeration',
    family: 'IDENTITY_AND_SECRETS',
    version: '1.0.0',
    executionMode: 'ADVANCED',
    safetyLevel: 'GUARDED',
    description: 'Detects username/email enumeration across login, registration, and password reset flows via error message differential analysis, HTTP status code differential, timing-based enumeration (response delay detection), user list API disclosure, GraphQL user query exposure, and verbose auth error message analysis.',
    supportedAssetKinds: ['API', 'WEB_APP', 'IDENTITY_TENANT'],
    attckTechniques: ['T1087', 'T1087.001', 'T1087.002', 'T1589'],
    steps: [
      {
        orderIndex: 1,
        stepType: 'AUTH_WORKFLOW',
        title: 'Compare login error messages for valid vs invalid usernames',
        verificationRule: { produces: ['observations', 'evidence'], attackVectorType: 'LOGIN_ENUM' },
      },
      {
        orderIndex: 2,
        stepType: 'HTTP_REQUEST',
        title: 'Check registration endpoint for email existence disclosure',
        verificationRule: { produces: ['observations'], attackVectorType: 'REGISTER_ENUM' },
      },
      {
        orderIndex: 3,
        stepType: 'HTTP_REQUEST',
        title: 'Detect password reset response differential',
        verificationRule: { produces: ['observations'], attackVectorType: 'RESET_ENUM' },
      },
      {
        orderIndex: 4,
        stepType: 'HTTP_REQUEST',
        title: 'Probe for user list API endpoints (unauthenticated)',
        verificationRule: { produces: ['observations', 'evidence'], attackVectorType: 'USER_LIST_DISCLOSURE' },
      },
      {
        orderIndex: 5,
        stepType: 'HTTP_REQUEST',
        title: 'Timing-based enumeration via response latency analysis',
        verificationRule: { produces: ['observations'], attackVectorType: 'TIMING_ENUM' },
      },
    ],
  },

  // ─── Account Security Testing ────────────────────────────────────────
  {
    slug: 'account-security',
    name: 'Account Security & Session Hardening',
    family: 'IDENTITY_AND_SECRETS',
    version: '1.0.0',
    executionMode: 'ADVANCED',
    safetyLevel: 'GUARDED',
    description: 'Comprehensive auth-flow hardening: session fixation detection, session cookie security flags (HttpOnly/Secure/SameSite), logout completeness validation (token invalidation), password change re-authentication requirement, MFA bypass detection (empty/trivial OTP acceptance), CSRF protection on state-changing endpoints, and account takeover via email update without re-auth.',
    supportedAssetKinds: ['API', 'WEB_APP', 'IDENTITY_TENANT'],
    attckTechniques: ['T1078', 'T1539', 'T1550', 'T1556'],
    prerequisites: { preferAuthContext: true },
    steps: [
      {
        orderIndex: 1,
        stepType: 'HTTP_REQUEST',
        title: 'Audit session cookie security flags and lifetime',
        verificationRule: { produces: ['observations'], attackVectorType: 'COOKIE_SECURITY' },
      },
      {
        orderIndex: 2,
        stepType: 'AUTH_WORKFLOW',
        title: 'Detect session fixation (pre-auth == post-auth token)',
        verificationRule: { produces: ['observations', 'evidence'], attackVectorType: 'SESSION_FIXATION' },
      },
      {
        orderIndex: 3,
        stepType: 'AUTH_WORKFLOW',
        title: 'Validate logout actually invalidates the session/token',
        verificationRule: { produces: ['observations', 'evidence'], attackVectorType: 'LOGOUT_VALIDATION' },
      },
      {
        orderIndex: 4,
        stepType: 'AUTH_WORKFLOW',
        title: 'Test password change without current password (re-auth bypass)',
        verificationRule: { produces: ['observations'], attackVectorType: 'REAUTH_BYPASS' },
      },
      {
        orderIndex: 5,
        stepType: 'AUTH_WORKFLOW',
        title: 'MFA bypass: trivial/empty OTP acceptance',
        verificationRule: { produces: ['observations', 'evidence'], attackVectorType: 'MFA_BYPASS' },
      },
      {
        orderIndex: 6,
        stepType: 'AUTH_WORKFLOW',
        title: 'Account takeover chain: email update without re-authentication',
        verificationRule: { produces: ['observations', 'evidence'], attackVectorType: 'EMAIL_TAKEOVER' },
      },
    ],
  },

  // ═══════════════════════════════════════════════════════════════════
  //  ADVANCED ATTACK FRAMEWORK
  // ═══════════════════════════════════════════════════════════════════

  // ─── Intelligent Recon ───────────────────────────────────────────
  {
    slug: 'intelligent-recon',
    name: 'Intelligent API Reconnaissance',
    family: 'SURFACE_VALIDATION',
    version: '1.0.0',
    executionMode: 'ADVANCED',
    safetyLevel: 'SAFE',
    description: 'Intelligence-driven API surface discovery: OpenAPI/Swagger schema auto-ingestion, JavaScript bundle deep parsing (fetch/axios/router endpoints), source map reconstruction, GraphQL full introspection with sensitive field detection, HTML link/form extraction, and technology fingerprinting via response headers.',
    supportedAssetKinds: ['API', 'WEB_APP'],
    attckTechniques: ['T1595', 'T1595.002', 'T1592'],
    steps: [
      { orderIndex: 1, stepType: 'HTTP_REQUEST', title: 'Probe for OpenAPI/Swagger schema endpoints (16 paths)', verificationRule: { produces: ['observations', 'endpoints'], attackVectorType: 'OPENAPI_DISCOVERY' } },
      { orderIndex: 2, stepType: 'HTTP_REQUEST', title: 'Crawl HTML pages for links, forms, and JS bundle URLs', verificationRule: { produces: ['endpoints'], attackVectorType: 'HTML_CRAWL' } },
      { orderIndex: 3, stepType: 'HTTP_REQUEST', title: 'Deep-parse JavaScript bundles for API endpoints and routes', verificationRule: { produces: ['endpoints'], attackVectorType: 'JS_PARSE' } },
      { orderIndex: 4, stepType: 'HTTP_REQUEST', title: 'Detect and reconstruct source maps to reveal architecture', verificationRule: { produces: ['observations', 'endpoints'], attackVectorType: 'SOURCE_MAP' } },
      { orderIndex: 5, stepType: 'HTTP_REQUEST', title: 'GraphQL introspection: full schema extraction with sensitive field detection', verificationRule: { produces: ['observations', 'endpoints'], attackVectorType: 'GQL_INTROSPECTION' } },
      { orderIndex: 6, stepType: 'HTTP_REQUEST', title: 'Technology fingerprinting via response headers', verificationRule: { produces: ['observations'], attackVectorType: 'TECH_FINGERPRINT' } },
    ],
  },

  // ─── Adaptive Attack Engine ──────────────────────────────────────
  {
    slug: 'adaptive-attack',
    name: 'Adaptive Context-Aware Attack Engine',
    family: 'API_EXPOSURE',
    version: '1.0.0',
    executionMode: 'ADVANCED',
    safetyLevel: 'GUARDED',
    description: 'Stateful attack orchestration with endpoint context classification (auth/admin/data/file/webhook/graphql), tailored payload generation, response-diff mutation strategy, WAF/filter bypass attempts (encoding, verb tampering, header injection), multi-step attack chains (enum→reset→takeover), and a learning loop that prioritizes successful patterns.',
    supportedAssetKinds: ['API', 'WEB_APP'],
    attckTechniques: ['T1190', 'T1059', 'T1548', 'T1068'],
    steps: [
      { orderIndex: 1, stepType: 'HTTP_REQUEST', title: 'PROFILE: Classify each endpoint by context (auth/admin/data/file)', verificationRule: { produces: ['state'], attackVectorType: 'CONTEXT_CLASSIFICATION' } },
      { orderIndex: 2, stepType: 'HTTP_REQUEST', title: 'BASELINE: Establish normal response behavior per endpoint', verificationRule: { produces: ['state'], attackVectorType: 'BASELINE_COLLECTION' } },
      { orderIndex: 3, stepType: 'HTTP_REQUEST', title: 'PROBE: Execute context-aware attack probes with differential validation', verificationRule: { produces: ['observations', 'evidence'], attackVectorType: 'ADAPTIVE_PROBE' } },
      { orderIndex: 4, stepType: 'HTTP_REQUEST', title: 'BYPASS: Attempt WAF/filter bypass on blocked probes', verificationRule: { produces: ['observations', 'evidence'], attackVectorType: 'WAF_BYPASS' } },
      { orderIndex: 5, stepType: 'AUTH_WORKFLOW', title: 'CHAIN: Multi-step attack chains (auth bypass → data access → privilege escalation)', verificationRule: { produces: ['observations', 'evidence'], attackVectorType: 'ATTACK_CHAIN' } },
    ],
  },

  // ─── Injection & Deserialization Engine ───────────────────────────
  {
    slug: 'injection-deser',
    name: 'Advanced Injection & Deserialization',
    family: 'API_EXPOSURE',
    version: '1.0.0',
    executionMode: 'ADVANCED',
    safetyLevel: 'GUARDED',
    description: 'Deep injection exploitation beyond basic payloads: blind boolean-based SQLi (5 pairs with differential), blind time-based SQLi (MySQL/PostgreSQL/MSSQL), error-based SQLi, NoSQL operator injection ($gt/$ne/$where/$regex), prototype pollution (__proto__/constructor.prototype), SSTI multi-engine (Jinja2/Twig/EJS/Pug/Handlebars), SSRF via URL parameters (cloud metadata/protocol smuggling), and insecure deserialization detection (Java/PHP/Node.js/Python).',
    supportedAssetKinds: ['API', 'WEB_APP'],
    attckTechniques: ['T1190', 'T1059.007', 'T1059.001', 'T1505'],
    steps: [
      { orderIndex: 1, stepType: 'HTTP_REQUEST', title: 'Blind boolean-based SQL injection with differential analysis', verificationRule: { produces: ['observations', 'evidence'], attackVectorType: 'BOOLEAN_SQLI' } },
      { orderIndex: 2, stepType: 'HTTP_REQUEST', title: 'Blind time-based SQL injection via SLEEP/pg_sleep/WAITFOR', verificationRule: { produces: ['observations', 'evidence'], attackVectorType: 'TIME_SQLI' } },
      { orderIndex: 3, stepType: 'HTTP_REQUEST', title: 'NoSQL operator injection ($gt, $ne, $where, $regex)', verificationRule: { produces: ['observations', 'evidence'], attackVectorType: 'NOSQL_INJECTION' } },
      { orderIndex: 4, stepType: 'HTTP_REQUEST', title: 'Prototype pollution via __proto__ and constructor.prototype', verificationRule: { produces: ['observations', 'evidence'], attackVectorType: 'PROTO_POLLUTION' } },
      { orderIndex: 5, stepType: 'HTTP_REQUEST', title: 'Server-Side Template Injection (multi-engine detection)', verificationRule: { produces: ['observations', 'evidence'], attackVectorType: 'SSTI' } },
      { orderIndex: 6, stepType: 'HTTP_REQUEST', title: 'SSRF via URL parameters (cloud metadata, protocol smuggling)', verificationRule: { produces: ['observations', 'evidence'], attackVectorType: 'SSRF_URL_PARAM' } },
      { orderIndex: 7, stepType: 'HTTP_REQUEST', title: 'Insecure deserialization pattern detection (Java/PHP/Node/Python)', verificationRule: { produces: ['observations'], attackVectorType: 'DESERIALIZATION' } },
    ],
  },

  // ─── Race Condition & Concurrency Engine ─────────────────────────
  {
    slug: 'race-condition',
    name: 'Race Condition & Concurrency Testing',
    family: 'API_EXPOSURE',
    version: '1.0.0',
    executionMode: 'ADVANCED',
    safetyLevel: 'GUARDED',
    description: 'Timing-based concurrency vulnerability detection: parallel request orchestration (race burst scheduler), double-spend/multi-submit detection on payment and reward endpoints, idempotency enforcement testing, token/nonce reuse detection (OTP/reset/invite), rate-limit bypass via concurrent request flooding, and TOCTOU async state desync detection with response fingerprint diffing.',
    supportedAssetKinds: ['API', 'WEB_APP'],
    attckTechniques: ['T1499', 'T1190', 'T1068'],
    steps: [
      { orderIndex: 1, stepType: 'HTTP_REQUEST', title: 'Double-spend / multi-submit detection via simultaneous requests (LAB)', verificationRule: { produces: ['observations', 'evidence'], attackVectorType: 'DOUBLE_SPEND' } },
      { orderIndex: 2, stepType: 'HTTP_REQUEST', title: 'Idempotency enforcement testing on state-changing endpoints', verificationRule: { produces: ['observations'], attackVectorType: 'IDEMPOTENCY_CHECK' } },
      { orderIndex: 3, stepType: 'HTTP_REQUEST', title: 'Token/nonce reuse detection (OTP, password reset, invites)', verificationRule: { produces: ['observations', 'evidence'], attackVectorType: 'TOKEN_REUSE' } },
      { orderIndex: 4, stepType: 'HTTP_REQUEST', title: 'Rate-limit bypass via concurrent request flooding', verificationRule: { produces: ['observations', 'evidence'], attackVectorType: 'RATE_LIMIT_BYPASS' } },
      { orderIndex: 5, stepType: 'HTTP_REQUEST', title: 'TOCTOU async state desync detection', verificationRule: { produces: ['observations'], attackVectorType: 'TOCTOU_DESYNC' } },
    ],
  },
];

@Injectable()
export class ScenarioPackRegistry {
  constructor(private readonly prisma: PrismaService) {}

  async ensureDefaultPacks() {
    for (const pack of DEFAULT_PACKS) {
      const created = await this.prisma.securityScenarioPack.upsert({
        where: { slug: pack.slug },
        update: {
          name: pack.name,
          family: pack.family as never,
          version: pack.version,
          executionMode: pack.executionMode as never,
          safetyLevel: pack.safetyLevel as never,
          description: pack.description,
          supportedAssetKinds: pack.supportedAssetKinds,
          attckTechniques: pack.attckTechniques,
          prerequisites: toJson(pack.prerequisites),
          packMetadata: toJson({ managedBy: 'system', seeded: true }),
        },
        create: {
          slug: pack.slug,
          name: pack.name,
          family: pack.family as never,
          version: pack.version,
          executionMode: pack.executionMode as never,
          safetyLevel: pack.safetyLevel as never,
          description: pack.description,
          supportedAssetKinds: pack.supportedAssetKinds,
          attckTechniques: pack.attckTechniques,
          prerequisites: toJson(pack.prerequisites),
          packMetadata: toJson({ managedBy: 'system', seeded: true }),
        },
      });

      await this.prisma.securityScenarioStep.deleteMany({
        where: { scenarioPackId: created.id },
      });

      if (pack.steps.length > 0) {
        await this.prisma.securityScenarioStep.createMany({
          data: pack.steps.map((step) => ({
            scenarioPackId: created.id,
            orderIndex: step.orderIndex,
            stepType: step.stepType as never,
            title: step.title,
            config: toJson(step.config),
            verificationRule: toJson(step.verificationRule),
            requiresCollector: step.requiresCollector ?? false,
          })),
        });
      }
    }
  }

  async listApplicablePacks(input: {
    targetKind: string;
    executionMode: 'STANDARD' | 'ADVANCED' | 'EMULATION' | 'CONTINUOUS_VALIDATION';
    hasCollector: boolean;
  }) {
    await this.ensureDefaultPacks();

    const packs = await this.prisma.securityScenarioPack.findMany({
      include: {
        steps: { orderBy: { orderIndex: 'asc' } },
      },
      orderBy: [{ family: 'asc' }, { name: 'asc' }],
    });

    return packs.filter((pack) => {
      const kinds = Array.isArray(pack.supportedAssetKinds) ? pack.supportedAssetKinds : [];
      const prereqs = (pack.prerequisites ?? {}) as Record<string, unknown>;
      const requiresCollector = Boolean(prereqs.requiresCollector);

      if (requiresCollector && !input.hasCollector) {
        return false;
      }

      if (kinds.length > 0 && !kinds.includes(input.targetKind)) {
        return false;
      }

      if (input.executionMode === 'STANDARD') {
        return pack.executionMode === 'STANDARD';
      }

      if (input.executionMode === 'ADVANCED') {
        return pack.executionMode === 'STANDARD' || pack.executionMode === 'ADVANCED';
      }

      return pack.executionMode === input.executionMode || pack.executionMode === 'STANDARD';
    });
  }
}

function toJson(value: unknown): Prisma.InputJsonValue | undefined {
  return value === undefined ? undefined : (value as Prisma.InputJsonValue);
}
