import { CheckStatus } from '@prisma/client';

export type CheckDiagnosis = {
  code: string;
  summary: string;
  detail: string;
  confidence: number;
  suggestedAction?: string;
  isLikelyOutage: boolean;
};

type DiagnoseCheckInput = {
  status?: CheckStatus | null;
  statusCode?: number | null;
  errorMessage?: string | null;
};

export function buildHttpStatusErrorMessage(
  statusCode: number,
  expectedStatus?: number,
): string {
  const expectedLabel = expectedStatus ? `Expected ${expectedStatus}, got ${statusCode}` : `Unexpected status: ${statusCode}`;

  if (statusCode === 401) {
    return `AUTH_REQUIRED: ${expectedLabel}`;
  }

  if (statusCode === 403) {
    return `ACCESS_FORBIDDEN: ${expectedLabel}`;
  }

  if (statusCode === 404) {
    return `NOT_FOUND: ${expectedLabel}`;
  }

  if (statusCode === 429) {
    return `RATE_LIMITED: ${expectedLabel}`;
  }

  if (statusCode >= 500) {
    return `SERVER_ERROR: ${expectedLabel}`;
  }

  if (statusCode >= 400) {
    return `CLIENT_ERROR: ${expectedLabel}`;
  }

  if (statusCode >= 300) {
    return `UNEXPECTED_REDIRECT: ${expectedLabel}`;
  }

  return expectedLabel;
}

export function diagnoseCheck(input: DiagnoseCheckInput): CheckDiagnosis | null {
  const statusCode = input.statusCode ?? null;
  const errorMessage = input.errorMessage?.trim() ?? '';
  const normalized = errorMessage.toUpperCase();

  if (!statusCode && !normalized) {
    return null;
  }

  if (normalized.startsWith('BLOCKED:')) {
    return {
      code: 'TARGET_BLOCKED_BY_POLICY',
      summary: 'Blocked by Zer0Friction safety policy',
      detail: 'The target resolves to a private, restricted, or otherwise unsafe destination, so the probe was not allowed to run.',
      confidence: 99,
      suggestedAction: 'Use a public routable target for monitoring.',
      isLikelyOutage: false,
    };
  }

  if (statusCode === 401 || normalized.startsWith('AUTH_REQUIRED:')) {
    return {
      code: 'AUTH_REQUIRED',
      summary: 'Authentication required',
      detail: 'The origin returned HTTP 401, which usually means the page or endpoint needs valid credentials before it can be monitored successfully.',
      confidence: 96,
      suggestedAction: 'Use a public URL, an authorized API, or browser-based synthetic monitoring for logged-in flows.',
      isLikelyOutage: false,
    };
  }

  if (statusCode === 403 || normalized.startsWith('ACCESS_FORBIDDEN:')) {
    return {
      code: 'AUTH_OR_BOT_PROTECTION',
      summary: 'Likely auth or bot protection',
      detail: 'The origin returned HTTP 403. This often means the target blocks server-side probes, needs a logged-in browser session, or is protected by anti-bot rules.',
      confidence: 88,
      suggestedAction: 'Monitor a public page instead, or use authorized browser-based synthetic monitoring for protected flows.',
      isLikelyOutage: false,
    };
  }

  if (statusCode === 404 || normalized.startsWith('NOT_FOUND:')) {
    return {
      code: 'NOT_FOUND',
      summary: 'Target path not found',
      detail: 'The origin returned HTTP 404, which usually points to a wrong URL, removed page, or routing/configuration mismatch rather than a full outage.',
      confidence: 95,
      suggestedAction: 'Verify the exact URL and whether the resource is meant to be public.',
      isLikelyOutage: false,
    };
  }

  if (statusCode === 429 || normalized.startsWith('RATE_LIMITED:')) {
    return {
      code: 'RATE_LIMITED',
      summary: 'Rate limited by target',
      detail: 'The origin returned HTTP 429, which means the target is throttling requests from this probe.',
      confidence: 94,
      suggestedAction: 'Reduce check frequency, use a public health endpoint, or monitor a target that allows automated probes.',
      isLikelyOutage: false,
    };
  }

  if ((statusCode !== null && statusCode >= 500) || normalized.startsWith('SERVER_ERROR:')) {
    return {
      code: 'SERVER_ERROR',
      summary: 'Origin returned a server error',
      detail: `The target responded with ${statusCode ?? 'a 5xx status'}, which usually indicates a genuine application or infrastructure issue.`,
      confidence: 90,
      suggestedAction: 'Inspect the origin service, recent deploys, and upstream dependencies.',
      isLikelyOutage: true,
    };
  }

  if (normalized.includes('TIMEOUT')) {
    return {
      code: 'TIMEOUT',
      summary: 'Timed out waiting for target',
      detail: 'The probe could connect or start the request but did not receive a usable response before the timeout window expired.',
      confidence: 90,
      suggestedAction: 'Check origin latency, upstream health, and whether the timeout is too aggressive for this endpoint.',
      isLikelyOutage: true,
    };
  }

  if (
    normalized.includes('DNS_NOT_FOUND') ||
    normalized.includes('DNS RESOLUTION FAILED') ||
    normalized.includes('ENOTFOUND')
  ) {
    return {
      code: 'DNS_FAILURE',
      summary: 'DNS resolution failed',
      detail: 'The hostname could not be resolved from the probe environment.',
      confidence: 95,
      suggestedAction: 'Check the hostname, DNS records, and whether the domain is publicly resolvable.',
      isLikelyOutage: true,
    };
  }

  if (normalized.includes('ECONNREFUSED') || normalized.includes('CONNECTION REFUSED')) {
    return {
      code: 'CONNECTION_REFUSED',
      summary: 'Connection refused by origin',
      detail: 'The host was reachable, but the target port or service refused the connection.',
      confidence: 93,
      suggestedAction: 'Verify the origin service is listening on the expected port and accepting external traffic.',
      isLikelyOutage: true,
    };
  }

  if (normalized.includes('CERT_EXPIRED')) {
    return {
      code: 'SSL_CERT_EXPIRED',
      summary: 'SSL certificate expired',
      detail: 'The target responded, but its certificate is outside the validity window.',
      confidence: 98,
      suggestedAction: 'Renew the certificate and verify the deployed certificate chain.',
      isLikelyOutage: false,
    };
  }

  if (normalized.includes('CERT_INVALID') || normalized.includes('HANDSHAKE_FAILED')) {
    return {
      code: 'SSL_CERT_INVALID',
      summary: 'TLS or certificate validation failed',
      detail: 'The HTTPS handshake completed far enough to detect a certificate or TLS issue, but the target could not be trusted cleanly.',
      confidence: 92,
      suggestedAction: 'Check the certificate chain, hostname match, and TLS configuration.',
      isLikelyOutage: false,
    };
  }

  if (normalized.includes('KEYWORD_MISSING')) {
    return {
      code: 'KEYWORD_ASSERTION_FAILED',
      summary: 'Expected content missing',
      detail: 'The endpoint responded, but required text was missing from the body, so the content assertion failed.',
      confidence: 93,
      suggestedAction: 'Review the keyword rules and whether the response body changed.',
      isLikelyOutage: false,
    };
  }

  if (normalized.includes('FORBIDDEN_KEYWORD_FOUND')) {
    return {
      code: 'FORBIDDEN_CONTENT_DETECTED',
      summary: 'Forbidden content detected',
      detail: 'The endpoint responded, but the response body contained a keyword marked as forbidden.',
      confidence: 93,
      suggestedAction: 'Review the keyword rules and confirm the returned body is healthy.',
      isLikelyOutage: false,
    };
  }

  if (statusCode !== null && statusCode >= 400) {
    return {
      code: 'UNEXPECTED_HTTP_STATUS',
      summary: `Unexpected HTTP ${statusCode}`,
      detail: `The target responded with HTTP ${statusCode}, but the monitor expected a successful response.`,
      confidence: 80,
      suggestedAction: 'Check whether this endpoint is public, whether the expected status is correct, and whether the target is intentionally rejecting probes.',
      isLikelyOutage: statusCode >= 500,
    };
  }

  if (input.status === CheckStatus.ERROR) {
    return {
      code: 'CHECK_ERROR',
      summary: 'Check execution error',
      detail: errorMessage || 'The probe failed for a non-timeout execution reason.',
      confidence: 70,
      isLikelyOutage: true,
    };
  }

  return {
    code: 'UNKNOWN_FAILURE',
    summary: 'Check failed for an unclassified reason',
    detail: errorMessage || 'The probe failed but Zer0Friction could not classify the exact reason yet.',
    confidence: 55,
    suggestedAction: 'Review the raw error and consider adjusting monitor configuration.',
    isLikelyOutage: true,
  };
}
