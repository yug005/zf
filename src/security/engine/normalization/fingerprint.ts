import { createHash } from 'node:crypto';

/**
 * Generates a stable fingerprint for a finding, allowing scan-to-scan
 * comparison (detect new, resolved, and changed findings).
 *
 * Fingerprint = SHA-256(category + title + endpoint)
 */
export function generateFingerprint(
  category: string,
  title: string,
  endpoint: string,
): string {
  const input = `${category}::${title}::${endpoint}`;
  return createHash('sha256').update(input).digest('hex').substring(0, 32);
}
