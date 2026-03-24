import dns from 'node:dns/promises';
import { performance } from 'node:perf_hooks';
import type { CheckExecutionResult } from '../constants.js';

export interface DnsCheckOptions {
  domain: string;
  recordType?: 'A' | 'AAAA' | 'CNAME';
  expectedValue?: string;
  timeoutMs: number;
}

export async function executeDnsCheck(
  options: DnsCheckOptions
): Promise<CheckExecutionResult> {
  const { domain, recordType = 'A', expectedValue, timeoutMs } = options;
  const start = performance.now();

  try {
    const resolver = new dns.Resolver();
    
    // Set up a race condition for the DNS query vs the timeout
    const resolvePromise = (async () => {
      switch (recordType) {
        case 'AAAA':
          return await resolver.resolve6(domain);
        case 'CNAME':
          return await resolver.resolveCname(domain);
        case 'A':
        default:
          return await resolver.resolve4(domain);
      }
    })();

    const timeoutPromise = new Promise<never>((_, reject) => 
      setTimeout(() => reject(new Error('DNS_TIMEOUT')), timeoutMs)
    );

    const records = await Promise.race([resolvePromise, timeoutPromise]);
    const responseTimeMs = Math.round(performance.now() - start);

    if (expectedValue) {
      // Basic tolerance/normalization logic to handle edge cases in DNS
      // like trailing dots, distinct casing, or multiple A records returning in distinct orders
      const normalizedExpected = expectedValue.toLowerCase().trim().replace(/\.$/, '');
      const match = records.some(r => r.toLowerCase().trim().replace(/\.$/, '') === normalizedExpected);
      
      if (!match) {
        return {
          success: false,
          responseTimeMs,
          errorMessage: `INVALID_RECORD: Expected ${expectedValue}, got [${records.join(', ')}]`,
        };
      }
    }

    return {
      success: true,
      responseTimeMs,
    };

  } catch (error: any) {
    const responseTimeMs = Math.round(performance.now() - start);
    let errorMessage = `UNKNOWN: ${error.message}`;

    if (error.message === 'DNS_TIMEOUT') {
      errorMessage = `DNS_TIMEOUT: Resolution timed out after ${timeoutMs}ms`;
    } else if (error.code === 'ENOTFOUND') {
      errorMessage = 'DNS_NOT_FOUND: Domain does not exist';
    } else if (error.code === 'ENODATA') {
      errorMessage = `DNS_NOT_FOUND: No ${recordType} records found for dataset`;
    }

    return {
      success: false,
      responseTimeMs,
      errorMessage,
    };
  }
}
