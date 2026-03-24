import axios, { AxiosError } from 'axios';
import dns from 'node:dns';
import net from 'node:net';
import type { MonitorCheckJobData, CheckExecutionResult } from '../constants.js';

const dnsLookup = dns.promises.lookup;

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

function isBlockedIp(address: string): boolean {
  const ipVersion = net.isIP(address);
  if (ipVersion === 4) {
    return isBlockedIpv4(address);
  }

  if (ipVersion === 6) {
    return isBlockedIpv6(address);
  }

  return true;
}

async function assertSafeTarget(parsedUrl: URL): Promise<void> {
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

  const resolvedAddresses = await dnsLookup(hostname, { all: true, verbatim: true });
  if (resolvedAddresses.length === 0) {
    throw new Error('BLOCKED: DNS resolution did not return a routable address.');
  }

  if (resolvedAddresses.some((entry) => isBlockedIp(entry.address))) {
    throw new Error('BLOCKED: Target resolves to a private or restricted IP.');
  }
}

function buildSafeLookup() {
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

export async function executeHttpCheck(
  data: MonitorCheckJobData,
): Promise<CheckExecutionResult> {
  const start = performance.now();

  try {
    const parsedUrl = new URL(data.url);
    await assertSafeTarget(parsedUrl);

    const response = await axios({
      url: data.url,
      method: data.method.toLowerCase(),
      headers: data.headers,
      data: data.body,
      timeout: data.timeoutMs,
      validateStatus: () => true,
      maxRedirects: 5,
      maxContentLength: 5 * 1024 * 1024, // 5MB limit to prevent memory spikes
      responseType: 'text', // ensure we get raw text to inspect
      lookup: buildSafeLookup() as never,
    });

    const responseTimeMs = Math.round(performance.now() - start);
    const statusCode = response.status;
    const expectedStatus = data.expectedStatus;
    let success = expectedStatus
      ? statusCode === expectedStatus
      : statusCode >= 200 && statusCode < 300;

    let errorMessage = success ? undefined : `Unexpected status: ${statusCode}`;
    const matchedKeywords: string[] = [];
    const missingKeywords: string[] = [];

    // KEYWORD VALIDATION
    if (success && data.keywordConfig) {
      if (!response.data) {
        success = false;
        errorMessage = 'EMPTY_RESPONSE: Cannot validate keywords on an empty response body';
      } else {
        let responseText = String(response.data);
        if (data.keywordConfig.stripHtml) {
          responseText = responseText.replace(/<[^>]*>?/gm, ' ');
        }
        
        const searchTarget = responseText.toLowerCase();

        // 1. Check REQUIRED keywords
        if (data.keywordConfig.required?.length) {
          for (const kw of data.keywordConfig.required) {
            const lowerKw = kw.toLowerCase();
            const isMatch = data.keywordConfig.matchExact 
              ? new RegExp(`\\b${lowerKw.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i').test(searchTarget)
              : searchTarget.includes(lowerKw);
              
            if (isMatch) matchedKeywords.push(kw);
            else missingKeywords.push(kw);
          }
          
          if (missingKeywords.length > 0) {
            success = false;
            errorMessage = `KEYWORD_MISSING: Missing required keyword(s): [${missingKeywords.join(', ')}]`;
          }
        }

        // 2. Check FORBIDDEN keywords (only if not already failed)
        if (success && data.keywordConfig.forbidden?.length) {
          const foundForbidden: string[] = [];
          for (const kw of data.keywordConfig.forbidden) {
            const lowerKw = kw.toLowerCase();
            const isMatch = data.keywordConfig.matchExact 
              ? new RegExp(`\\b${lowerKw.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i').test(searchTarget)
              : searchTarget.includes(lowerKw);
              
            if (isMatch) {
              foundForbidden.push(kw);
              matchedKeywords.push(kw);
            }
          }

          if (foundForbidden.length > 0) {
            success = false;
            errorMessage = `FORBIDDEN_KEYWORD_FOUND: Contains restricted keyword(s): [${foundForbidden.join(', ')}]`;
          }
        }
      }
    }

    return {
      success,
      statusCode,
      responseTimeMs,
      errorMessage,
      metadata: (matchedKeywords.length || missingKeywords.length) ? {
        matchedKeywords,
        missingKeywords
      } : undefined
    };
  } catch (error) {
    const responseTimeMs = Math.round(performance.now() - start);

    if (error instanceof AxiosError) {
      if (error.code === 'ECONNABORTED' || error.code === 'ETIMEDOUT') {
        return {
          success: false,
          responseTimeMs,
          errorMessage: `Timeout after ${data.timeoutMs}ms`,
        };
      }

      if (error.code === 'ECONNREFUSED') {
        return {
          success: false,
          responseTimeMs,
          errorMessage: `Connection refused: ${data.url}`,
        };
      }

      if (error.code === 'ENOTFOUND') {
        return {
          success: false,
          responseTimeMs,
          errorMessage: `DNS resolution failed: ${data.url}`,
        };
      }

      return {
        success: false,
        statusCode: error.response?.status,
        responseTimeMs,
        errorMessage: error.message,
      };
    }

    return {
      success: false,
      responseTimeMs,
      errorMessage: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}
