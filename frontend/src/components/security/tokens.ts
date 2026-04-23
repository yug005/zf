/**
 * Security-specific design tokens and shared utility classes.
 * These extend the existing dashboard design language with
 * security-focused severity colors, scan states, and trust surfaces.
 */

// ─── Severity Color System ─────────────────────────────────────────

export const severityColors: Record<string, { bg: string; text: string; border: string; glow: string; dot: string }> = {
  CRITICAL: { bg: 'bg-rose-500/15', text: 'text-rose-400', border: 'border-rose-500/30', glow: 'shadow-[0_0_20px_rgba(244,63,94,0.3)]', dot: 'bg-rose-400' },
  HIGH:     { bg: 'bg-orange-500/15', text: 'text-orange-400', border: 'border-orange-500/30', glow: 'shadow-[0_0_20px_rgba(249,115,22,0.3)]', dot: 'bg-orange-400' },
  MEDIUM:   { bg: 'bg-amber-500/15', text: 'text-amber-400', border: 'border-amber-500/30', glow: 'shadow-[0_0_20px_rgba(245,158,11,0.3)]', dot: 'bg-amber-400' },
  LOW:      { bg: 'bg-sky-500/15', text: 'text-sky-400', border: 'border-sky-500/30', glow: 'shadow-[0_0_20px_rgba(14,165,233,0.3)]', dot: 'bg-sky-400' },
  INFORMATIONAL: { bg: 'bg-slate-500/15', text: 'text-slate-400', border: 'border-slate-500/30', glow: 'shadow-none', dot: 'bg-slate-400' },
};

// ─── Risk Level Colors (for score gauges) ──────────────────────────

export const riskLevelColors: Record<string, { text: string; gradient: string; bgGlow: string }> = {
  CRITICAL:      { text: 'text-rose-400', gradient: 'from-rose-500 to-red-600', bgGlow: 'bg-rose-500/20' },
  HIGH:          { text: 'text-orange-400', gradient: 'from-orange-500 to-amber-600', bgGlow: 'bg-orange-500/20' },
  MEDIUM:        { text: 'text-amber-400', gradient: 'from-amber-400 to-yellow-500', bgGlow: 'bg-amber-500/20' },
  LOW:           { text: 'text-sky-400', gradient: 'from-sky-400 to-blue-500', bgGlow: 'bg-sky-500/20' },
  INFORMATIONAL: { text: 'text-slate-400', gradient: 'from-slate-400 to-slate-500', bgGlow: 'bg-slate-500/20' },
  SECURE:        { text: 'text-emerald-400', gradient: 'from-emerald-400 to-teal-500', bgGlow: 'bg-emerald-500/20' },
};

// ─── Compliance Framework Colors ───────────────────────────────────

export const complianceColors: Record<string, { bg: string; text: string; border: string; label: string }> = {
  SOC2:       { bg: 'bg-violet-500/15', text: 'text-violet-400', border: 'border-violet-500/30', label: 'SOC 2' },
  ISO27001:   { bg: 'bg-blue-500/15', text: 'text-blue-400', border: 'border-blue-500/30', label: 'ISO 27001' },
  OWASP_TOP10: { bg: 'bg-orange-500/15', text: 'text-orange-400', border: 'border-orange-500/30', label: 'OWASP Top 10' },
  PCI_DSS:    { bg: 'bg-emerald-500/15', text: 'text-emerald-400', border: 'border-emerald-500/30', label: 'PCI DSS' },
};

// ─── Scan State Colors ─────────────────────────────────────────────

export const scanStateColors: Record<string, { bg: string; text: string; label: string }> = {
  QUEUED:    { bg: 'bg-slate-500/15', text: 'text-slate-400', label: 'Queued' },
  RUNNING:   { bg: 'bg-cyan-500/15', text: 'text-cyan-400', label: 'Scanning' },
  COMPLETED: { bg: 'bg-emerald-500/15', text: 'text-emerald-400', label: 'Completed' },
  FAILED:    { bg: 'bg-rose-500/15', text: 'text-rose-400', label: 'Failed' },
  TIMED_OUT: { bg: 'bg-amber-500/15', text: 'text-amber-400', label: 'Timed Out' },
  CANCELLED: { bg: 'bg-slate-500/15', text: 'text-slate-400', label: 'Cancelled' },
};

// ─── Verification State Colors ─────────────────────────────────────

export const verificationColors: Record<string, { bg: string; text: string; label: string }> = {
  UNVERIFIED:          { bg: 'bg-slate-500/15', text: 'text-slate-400', label: 'Unverified' },
  OWNERSHIP_CONFIRMED: { bg: 'bg-amber-500/15', text: 'text-amber-400', label: 'Ownership Confirmed' },
  DNS_VERIFIED:        { bg: 'bg-emerald-500/15', text: 'text-emerald-400', label: 'DNS Verified' },
  HTTP_VERIFIED:       { bg: 'bg-emerald-500/15', text: 'text-emerald-400', label: 'HTTP Verified' },
};

// ─── Scan Stages (updated for new pipeline) ────────────────────────

export const scanStageLabels: Record<string, { label: string; description: string }> = {
  TARGET_PREP:             { label: 'Preparing', description: 'Capturing target snapshot' },
  VERIFICATION_CHECK:      { label: 'Verifying', description: 'Checking ownership verification' },
  ASSET_DISCOVERY:         { label: 'Discovering Assets', description: 'Mapping attack surface' },
  TARGET_CLASSIFICATION:   { label: 'Classifying', description: 'Analyzing target type' },
  SCENARIO_PLANNING:       { label: 'Planning', description: 'Selecting scenario packs' },
  SCENARIO_EXECUTION:      { label: 'Executing', description: 'Running security probes' },
  OBSERVATION_VERIFICATION: { label: 'Verifying', description: 'Validating observations' },
  VALIDATION_LOOP:         { label: 'Re-Validating', description: 'Confirming critical findings' },
  ATTACK_PATH_ANALYSIS:    { label: 'Analyzing Paths', description: 'Constructing attack chains' },
  SCORING:                 { label: 'Scoring', description: 'Calculating risk score' },
  HISTORICAL_COMPARISON:   { label: 'Comparing', description: 'Analyzing changes since last scan' },
  REPORT_GENERATION:       { label: 'Reporting', description: 'Generating executive report' },
  DONE:                    { label: 'Complete', description: 'Scan finished' },
};

// ─── Category Labels ───────────────────────────────────────────────

export const categoryLabels: Record<string, string> = {
  AUTH_POSTURE: 'Authentication',
  BROKEN_ACCESS_CONTROL: 'Access Control',
  MASS_ASSIGNMENT: 'Mass Assignment',
  SECURITY_MISCONFIGURATION: 'Misconfiguration',
  INJECTION_DETECTION: 'Injection',
  SSRF_POSTURE: 'SSRF',
  RESOURCE_ABUSE: 'Resource Abuse',
  ENDPOINT_DISCOVERY: 'Endpoint Discovery',
  SENSITIVE_DATA_EXPOSURE: 'Data Exposure',
  TLS_POSTURE: 'TLS/HTTPS',
  CORS_MISCONFIGURATION: 'CORS',
  HEADER_SECURITY: 'Security Headers',
  DEBUG_EXPOSURE: 'Debug Exposure',
  TECH_DISCLOSURE: 'Tech Disclosure',
  XSS_DETECTION: 'Cross-Site Scripting',
  OPEN_REDIRECT: 'Open Redirect',
  PATH_TRAVERSAL: 'Path Traversal',
  HEADER_INJECTION: 'Header Injection',
  SSTI_DETECTION: 'Template Injection',
  COMMAND_INJECTION: 'Command Injection',
  BUSINESS_LOGIC: 'Business Logic',
  DOM_XSS: 'DOM-Based XSS',
  SECRET_EXPOSURE: 'Secret Exposure',
  CLOUD_MISCONFIG: 'Cloud Misconfig',
  API_ABUSE: 'API Abuse',
  PERFORMANCE_RISK: 'Performance Risk',
};

// ─── Category Icons ────────────────────────────────────────────────

export const categoryIcons: Record<string, string> = {
  AUTH_POSTURE: '🔐',
  BROKEN_ACCESS_CONTROL: '🚪',
  MASS_ASSIGNMENT: '✏️',
  SECURITY_MISCONFIGURATION: '⚙️',
  INJECTION_DETECTION: '💉',
  SSRF_POSTURE: '🌐',
  RESOURCE_ABUSE: '⚡',
  SENSITIVE_DATA_EXPOSURE: '📄',
  TLS_POSTURE: '🔒',
  CORS_MISCONFIGURATION: '🌍',
  HEADER_SECURITY: '🛡️',
  DEBUG_EXPOSURE: '🐛',
  TECH_DISCLOSURE: '🏷️',
  XSS_DETECTION: '🔗',
  OPEN_REDIRECT: '↗️',
  PATH_TRAVERSAL: '📂',
  HEADER_INJECTION: '📋',
  SSTI_DETECTION: '📝',
  COMMAND_INJECTION: '⌨️',
  BUSINESS_LOGIC: '🧩',
  DOM_XSS: '🕸️',
  SECRET_EXPOSURE: '🔑',
  CLOUD_MISCONFIG: '☁️',
  API_ABUSE: '🦠',
  PERFORMANCE_RISK: '⏱️',
};

// ─── Shared Styles ─────────────────────────────────────────────────

export const securityCard =
  'rounded-[24px] border border-white/8 bg-[linear-gradient(180deg,rgba(255,255,255,0.05),rgba(255,255,255,0.02))] backdrop-blur-xl';

export const securityCardHover =
  'transition-all duration-300 hover:border-white/14 hover:shadow-[0_8px_40px_rgba(0,0,0,0.25)]';

export const glassPanel =
  'rounded-[20px] border border-white/6 bg-white/[0.03] backdrop-blur-lg';

export const premiumGradient =
  'bg-gradient-to-r from-cyan-400 via-blue-500 to-violet-500';

export const premiumGradientText =
  'bg-gradient-to-r from-cyan-400 via-blue-400 to-violet-400 bg-clip-text text-transparent';
