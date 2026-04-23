/**
 * Constants for the security scan engine.
 */

// ─── Queue Names ───────────────────────────────────────────────────

export const SECURITY_SCAN_QUEUE = 'security-scan-queue';

// ─── Job Options ───────────────────────────────────────────────────

export const SCAN_JOB_OPTIONS = {
  removeOnComplete: { age: 86400, count: 200 },
  removeOnFail: { age: 604800, count: 500 },
  attempts: 1, // No auto-retry — manual rescan only
  timeout: 10 * 60 * 1000, // 10 min per scan
} as const;

// ─── Stage Ordering ────────────────────────────────────────────────

export const SCAN_STAGE_ORDER = [
  'TARGET_PREP',
  'VERIFICATION_CHECK',
  'ASSET_DISCOVERY',         // NEW: Subdomain enum, DNS topology, cloud assets
  'TARGET_CLASSIFICATION',
  'SCENARIO_PLANNING',
  'SCENARIO_EXECUTION',
  'OBSERVATION_VERIFICATION',
  'VALIDATION_LOOP',         // NEW: Re-test HIGH/CRITICAL with variations
  'ATTACK_PATH_ANALYSIS',
  'SCORING',
  'HISTORICAL_COMPARISON',   // NEW: Delta vs previous scan
  'REPORT_GENERATION',
  'DONE',
] as const;

export type ScanStageName = (typeof SCAN_STAGE_ORDER)[number];

// ─── Scan Modes ────────────────────────────────────────────────────

export const SCAN_MODES = {
  PASSIVE: {
    label: 'Passive Mode',
    description: 'Headers, TLS, exposure, discovery — always safe',
    icon: 'eye',
    families: ['SURFACE_VALIDATION'],
    safetyLevel: 'SAFE',
  },
  CONTROLLED_ACTIVE: {
    label: 'Controlled Active',
    description: 'Safe payload simulation with intelligent throttling',
    icon: 'zap',
    families: ['SURFACE_VALIDATION', 'API_EXPOSURE', 'IDENTITY_AND_SECRETS', 'CLOUD_AND_PERIMETER'],
    safetyLevel: 'GUARDED',
  },
  DEEP_ANALYSIS: {
    label: 'Deep Analysis',
    description: 'Multi-step correlation, attack path construction, full coverage',
    icon: 'layers',
    families: ['SURFACE_VALIDATION', 'API_EXPOSURE', 'IDENTITY_AND_SECRETS', 'CLOUD_AND_PERIMETER', 'DETECTION_VALIDATION'],
    safetyLevel: 'GUARDED',
    requiresExplicitEnable: true,
  },
} as const;

export type ScanMode = keyof typeof SCAN_MODES;

// ─── Safety Guardrails ─────────────────────────────────────────────

export const GUARDRAILS = {
  STANDARD: {
    maxRequestsPerScan: 200,
    maxConcurrentRequests: 3,
    perRequestTimeoutMs: 10_000,
    maxResponseBodyCapture: 10 * 1024, // 10 KB
    maxRequestPayloadSize: 1024, // 1 KB
    maxResponseSize: 5 * 1024 * 1024, // 5 MB
  },
  ADVANCED: {
    maxRequestsPerScan: 500,
    maxConcurrentRequests: 5,
    perRequestTimeoutMs: 15_000,
    maxResponseBodyCapture: 10 * 1024,
    maxRequestPayloadSize: 2048,
    maxResponseSize: 5 * 1024 * 1024,
  },
  DEEP: {
    maxRequestsPerScan: 1000,
    maxConcurrentRequests: 8,
    perRequestTimeoutMs: 20_000,
    maxResponseBodyCapture: 20 * 1024,
    maxRequestPayloadSize: 4096,
    maxResponseSize: 10 * 1024 * 1024,
  },
} as const;

// ─── Finding Categories ────────────────────────────────────────────

export const FINDING_CATEGORIES = [
  'AUTH_POSTURE',
  'BROKEN_ACCESS_CONTROL',
  'MASS_ASSIGNMENT',
  'INJECTION_DETECTION',
  'SECURITY_MISCONFIGURATION',
  'SENSITIVE_DATA_EXPOSURE',
  'CORS_MISCONFIGURATION',
  'HEADER_SECURITY',
  'TLS_POSTURE',
  'TECH_DISCLOSURE',
  'DEBUG_EXPOSURE',
  'RESOURCE_ABUSE',
  'SSRF_POSTURE',
  'XSS_DETECTION',
  'OPEN_REDIRECT',
  'PATH_TRAVERSAL',
  'HEADER_INJECTION',
  'SSTI_DETECTION',
  'COMMAND_INJECTION',
  'BUSINESS_LOGIC',
  'DOM_XSS',
  'SECRET_EXPOSURE',
  'CLOUD_MISCONFIG',
  'API_ABUSE',
  'PERFORMANCE_RISK',
] as const;

export type FindingCategory = (typeof FINDING_CATEGORIES)[number];

// ─── Job data shape ────────────────────────────────────────────────

export interface AuthenticatedContext {
  /** JWT bearer token for authenticated scanning */
  bearerToken?: string;
  /** Session cookies (name=value pairs) */
  cookies?: Array<{ name: string; value: string; domain?: string }>;
  /** Custom headers for auth (e.g. X-API-Key) */
  customHeaders?: Record<string, string>;
  /** Auth method type */
  authMethod: 'JWT' | 'SESSION_COOKIE' | 'API_KEY' | 'BASIC' | 'CUSTOM';
  /** Optional: role context for role comparison scans */
  roles?: Array<{
    name: string;
    bearerToken?: string;
    cookies?: Array<{ name: string; value: string }>;
    customHeaders?: Record<string, string>;
  }>;
  /** Whether to attempt token refresh if 401 is received */
  refreshEnabled?: boolean;
  /** Token refresh endpoint, if different from default */
  refreshEndpoint?: string;
  /** Token refresh body template */
  refreshBody?: Record<string, unknown>;
}

export interface SecurityScanJobData {
  scanId: string;
  targetId: string;
  tier: 'STANDARD' | 'ADVANCED' | 'EMULATION' | 'CONTINUOUS_VALIDATION';
  executionMode?: 'STANDARD' | 'ADVANCED' | 'EMULATION' | 'CONTINUOUS_VALIDATION';
  baseUrl: string;
  userId: string;
  enabledCategories?: string[];
  assetScope?: Record<string, unknown>;
  authenticatedContext?: AuthenticatedContext;
  scanMode?: ScanMode;
  deepAnalysisEnabled?: boolean;
}

// ─── Auth Header Presets ───────────────────────────────────────────

/** Build HTTP headers from an AuthenticatedContext for use in axios requests. */
export function buildAuthHeaders(ctx?: AuthenticatedContext): Record<string, string> {
  if (!ctx) return {};
  const headers: Record<string, string> = {};

  if (ctx.bearerToken) {
    headers['Authorization'] = `Bearer ${ctx.bearerToken}`;
  }
  if (ctx.cookies && ctx.cookies.length > 0) {
    headers['Cookie'] = ctx.cookies.map(c => `${c.name}=${c.value}`).join('; ');
  }
  if (ctx.customHeaders) {
    Object.assign(headers, ctx.customHeaders);
  }
  return headers;
}
