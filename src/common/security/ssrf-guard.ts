/**
 * Shared SSRF (Server-Side Request Forgery) protection utilities.
 *
 * Extracted from the monitor engine's HTTP executor so both the
 * monitor-check pipeline and the security-scan pipeline share
 * identical network-safety guardrails.
 */
import dns from 'node:dns';
import net from 'node:net';

// ─── IPv4 blocklist ──────────────────────────────────────────────

function isBlockedIpv4(address: string): boolean {
  const octets = address.split('.').map(Number);
  if (octets.length !== 4 || octets.some((value) => Number.isNaN(value))) {
    return true;
  }

  const [first, second] = octets;

  if (first === 0 || first === 10 || first === 127) return true;
  if (first === 169 && second === 254) return true;
  if (first === 172 && second >= 16 && second <= 31) return true;
  if (first === 192 && second === 168) return true;
  if (first === 100 && second >= 64 && second <= 127) return true;
  if (first === 198 && (second === 18 || second === 19)) return true;
  if (first >= 224) return true;

  return false;
}

// ─── IPv6 blocklist ──────────────────────────────────────────────

function isBlockedIpv6(address: string): boolean {
  const normalized = address.toLowerCase();

  if (
    normalized === '::' ||
    normalized === '::1' ||
    normalized.startsWith('fc') ||
    normalized.startsWith('fd') ||
    normalized.startsWith('fe8') ||
    normalized.startsWith('fe9') ||
    normalized.startsWith('fea') ||
    normalized.startsWith('feb')
  ) {
    return true;
  }

  if (normalized.startsWith('::ffff:')) {
    return isBlockedIp(normalized.replace('::ffff:', ''));
  }

  return false;
}

// ─── Public helpers ──────────────────────────────────────────────

/**
 * Returns `true` when the given IP (v4 or v6) falls inside a
 * private, loopback, link-local, or otherwise restricted range.
 */
export function isBlockedIp(address: string): boolean {
  const ipVersion = net.isIP(address);
  if (ipVersion === 4) return isBlockedIpv4(address);
  if (ipVersion === 6) return isBlockedIpv6(address);
  return true; // unknown format → block
}

/**
 * Validates that a parsed URL targets a safe, routable public address.
 * Throws on localhost, private IPs, non-HTTP protocols, etc.
 */
export async function assertSafeTarget(parsedUrl: URL): Promise<void> {
  if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
    throw new Error('BLOCKED: Only HTTP and HTTPS targets are allowed.');
  }

  const hostname = parsedUrl.hostname.toLowerCase();
  if (hostname === 'localhost') {
    throw new Error('BLOCKED: Localhost targets are not allowed.');
  }

  if (net.isIP(hostname)) {
    if (isBlockedIp(hostname)) {
      throw new Error('BLOCKED: Target resolves to a private or restricted IP.');
    }
    return;
  }

  const dnsLookup = dns.promises.lookup;
  const resolvedAddresses = await dnsLookup(hostname, { all: true, verbatim: true });
  if (resolvedAddresses.length === 0) {
    throw new Error('BLOCKED: DNS resolution did not return a routable address.');
  }

  if (resolvedAddresses.some((entry) => isBlockedIp(entry.address))) {
    throw new Error('BLOCKED: Target resolves to a private or restricted IP.');
  }
}

/**
 * Returns a custom DNS lookup function that silently drops any
 * private/restricted addresses from the resolution result, blocking
 * requests whose target DNS only resolves to internal IPs.
 */
export function buildSafeLookup() {
  return (
    hostname: string,
    options: dns.LookupOneOptions | dns.LookupAllOptions,
    callback: (
      err: NodeJS.ErrnoException | null,
      address: string | dns.LookupAddress[],
      family?: number,
    ) => void,
  ) => {
    dns.lookup(hostname, { ...options, all: true, verbatim: true }, (error, addresses) => {
      if (error) {
        callback(error, Array.isArray(addresses) ? addresses : '', undefined);
        return;
      }

      const safeAddresses = addresses.filter((entry) => !isBlockedIp(entry.address));
      if (safeAddresses.length === 0) {
        callback(
          new Error('BLOCKED: DNS lookup resolved only private or restricted addresses.') as NodeJS.ErrnoException,
          '',
          undefined,
        );
        return;
      }

      if ('all' in options && options.all) {
        callback(null, safeAddresses);
        return;
      }

      callback(null, safeAddresses[0].address, safeAddresses[0].family);
    });
  };
}
