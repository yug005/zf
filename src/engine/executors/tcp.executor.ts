import net from 'node:net';
import { performance } from 'node:perf_hooks';
import type { CheckExecutionResult } from '../constants.js';

export async function executeTcpCheck(
  host: string,
  port: number,
  timeoutMs: number = 5000,
): Promise<CheckExecutionResult> {
  return new Promise((resolve) => {
    // Add jitter (10-50ms) to prevent exact-moment network congestion false positives
    const jitter = Math.floor(Math.random() * 40) + 10;

    setTimeout(() => {
      const start = performance.now();
      const socket = new net.Socket();
      
      socket.setTimeout(timeoutMs);

      socket.connect(port, host, () => {
        const responseTimeMs = Math.round(performance.now() - start);
        socket.destroy();
        resolve({ success: true, responseTimeMs });
      });

      socket.on('timeout', () => {
        socket.destroy();
        resolve({
          success: false,
          responseTimeMs: Math.round(performance.now() - start),
          errorMessage: `TCP connection timed out after ${timeoutMs}ms`,
        });
      });

      socket.on('error', (err: NodeJS.ErrnoException) => {
        socket.destroy();
        const responseTimeMs = Math.round(performance.now() - start);
        
        // Enhance error message based on code
        let message = err.message;
        if (err.code === 'ECONNREFUSED') message = `Connection Refused: ${host}:${port}`;
        else if (err.code === 'ENOTFOUND' || err.code === 'EAI_AGAIN') message = `DNS Resolution Failed: ${host}`;

        resolve({
          success: false,
          responseTimeMs,
          errorMessage: message,
        });
      });
    }, jitter);
  });
}
