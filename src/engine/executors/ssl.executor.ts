import tls from 'node:tls';
import { performance } from 'node:perf_hooks';
import type { CheckExecutionResult } from '../constants.js';

export async function executeSslCheck(
  url: string,
  timeoutMs: number = 5000,
): Promise<CheckExecutionResult> {
  const start = performance.now();
  let host = url;

  try {
    const parsed = new URL(url);
    if (parsed.protocol !== 'https:') {
      return {
        success: false,
        responseTimeMs: 0,
        errorMessage: `INVALID_PROTOCOL: SSL checks only support HTTPS URLs (received ${parsed.protocol})`,
      };
    }
    host = parsed.hostname;
  } catch {
    host = url.replace(/^[a-zA-Z]+:\/\//, '').split('/')[0];
  }

  return new Promise((resolve) => {
    let resolved = false;

    const socket = tls.connect(
      {
        host,
        port: 443,
        servername: host,
        rejectUnauthorized: false, // Required to fetch the cert details even if expired/invalid
        timeout: timeoutMs,
      },
      () => {
        if (resolved) return;
        resolved = true;

        const responseTimeMs = Math.round(performance.now() - start);
        const cert = socket.getPeerCertificate();
        const authorized = socket.authorized;
        const errorAuth = socket.authorizationError as any;
        const errorStr = errorAuth?.code || errorAuth?.message || String(errorAuth);

        socket.destroy();

        if (!cert || Object.keys(cert).length === 0) {
          return resolve({
            success: false,
            responseTimeMs,
            errorMessage: 'CERT_INVALID: No certificate presented by server',
          });
        }

        const validTo = new Date(cert.valid_to);
        const daysRemaining = Math.ceil(
          (validTo.getTime() - Date.now()) / (1000 * 60 * 60 * 24),
        );
        const issuer = cert.issuer?.O || cert.issuer?.CN || 'Unknown Issuer';

        const status =
          daysRemaining < 0 ? 'DOWN' : daysRemaining < 7 ? 'WARNING' : 'UP';

        const metadata = {
          sslExpiry: cert.valid_to,
          daysRemaining,
          issuer,
          status,
        };

        if (!authorized && errorStr === 'CERT_HAS_EXPIRED') {
          return resolve({
            success: false,
            responseTimeMs,
            errorMessage: `CERT_EXPIRED: Certificate expired`,
            metadata,
          });
        }

        if (!authorized) {
          return resolve({
            success: false,
            responseTimeMs,
            errorMessage: `CERT_INVALID: ${errorStr}`,
            metadata,
          });
        }

        if (daysRemaining < 0) {
          return resolve({
            success: false,
            responseTimeMs,
            errorMessage: 'CERT_EXPIRED: Certificate is past validity date',
            metadata,
          });
        }

        if (daysRemaining < 7) {
          return resolve({
            success: true, // Let engine decide how to flag warnings (usually keeps UP but logs message)
            responseTimeMs,
            errorMessage: `SSL_WARNING: Certificate expires in ${daysRemaining} days`,
            metadata,
          });
        }

        resolve({
          success: true,
          responseTimeMs,
          metadata,
        });
      },
    );

    socket.on('timeout', () => {
      if (resolved) return;
      resolved = true;
      socket.destroy();
      resolve({
        success: false,
        responseTimeMs: Math.round(performance.now() - start),
        errorMessage: `TIMEOUT: TLS handshake exceeded ${timeoutMs}ms`,
      });
    });

    socket.on('error', (err: any) => {
      if (resolved) return;
      resolved = true;
      socket.destroy();
      resolve({
        success: false,
        responseTimeMs: Math.round(performance.now() - start),
        errorMessage: `HANDSHAKE_FAILED: ${err.message}`,
      });
    });
  });
}
