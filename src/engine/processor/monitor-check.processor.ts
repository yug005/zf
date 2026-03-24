import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { MONITOR_CHECK_QUEUE } from '../constants.js';
import type { MonitorCheckJobData, CheckExecutionResult } from '../constants.js';
import { executeHttpCheck } from '../executors/http.executor.js';
import { executeTcpCheck } from '../executors/tcp.executor.js';
import { executeDnsCheck } from '../executors/dns.executor.js';
import { executeSslCheck } from '../executors/ssl.executor.js';
import { MonitorEngineService } from '../monitor-engine.service.js';

/**
 * BullMQ worker — consumes jobs from the monitor-check-queue.
 *
 * Flow:
 *   1. Receives job with MonitorCheckJobData payload
 *   2. Executes the HTTP check via the pure executor
 *   3. Passes the result to MonitorEngineService for DB persistence,
 *      status transitions, and alert logic
 */
@Processor(MONITOR_CHECK_QUEUE)
export class MonitorCheckProcessor extends WorkerHost {
  private readonly logger = new Logger(MonitorCheckProcessor.name);

  constructor(private readonly engineService: MonitorEngineService) {
    super();
  }

  async process(job: Job<MonitorCheckJobData>): Promise<CheckExecutionResult> {
    const { monitorId, url, method, type } = job.data;

    this.logger.debug(
      `Processing check for monitor ${monitorId}: [${type}] ${method} ${url} (attempt ${job.attemptsMade + 1}/${job.opts.attempts ?? 1})`,
    );

    // 1. Execute the correct check
    let result: CheckExecutionResult;
    if (type === 'TCP') {
      const parts = url.replace(/^[a-zA-Z]+:\/\//, '').split(':');
      const host = parts[0];
      const port = parseInt(parts[1] || '80', 10);
      result = await executeTcpCheck(host, port, job.data.timeoutMs);
    } else if (type === 'DNS') {
      const bodyObj = (job.data.body as Record<string, any>) || {};
      const domain = url.replace(/^[a-zA-Z]+:\/\//, '').split('/')[0];
      result = await executeDnsCheck({
        domain,
        recordType: bodyObj.recordType || 'A',
        expectedValue: bodyObj.expectedValue,
        timeoutMs: job.data.timeoutMs,
      });
    } else if (type === 'SSL') {
      result = await executeSslCheck(url, job.data.timeoutMs);
    } else {
      result = await executeHttpCheck(job.data);
    }

    // 2. Persist result and handle status transitions + alerts
    //    Only run engine logic on the FINAL attempt (success or last retry)
    const isFinalAttempt =
      result.success || job.attemptsMade + 1 >= (job.opts.attempts ?? 1);

    if (isFinalAttempt) {
      await this.engineService.processCheckResult(monitorId, result);
    } else if (!result.success) {
      // Not final attempt and failed — throw to trigger BullMQ retry
      this.logger.warn(
        `Check failed for ${monitorId}: ${result.errorMessage} — retrying (attempt ${job.attemptsMade + 1})`,
      );
      throw new Error(result.errorMessage ?? 'Check failed');
    }

    this.logger.debug(
      `Check completed for ${monitorId}: ${result.success ? 'SUCCESS' : 'FAILURE'} — ${result.responseTimeMs}ms`,
    );

    return result;
  }
}
