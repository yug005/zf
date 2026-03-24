import { Injectable, Logger } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { MONITOR_CHECK_QUEUE } from '../constants.js';
import type { MonitorCheckJobData } from '../constants.js';

/**
 * Producer service — enqueues monitor check jobs into BullMQ.
 * Separates "what to check" from "how to check".
 */
@Injectable()
export class MonitorCheckProducer {
  private readonly logger = new Logger(MonitorCheckProducer.name);

  constructor(
    @InjectQueue(MONITOR_CHECK_QUEUE)
    private readonly checkQueue: Queue<MonitorCheckJobData>,
  ) {}

  /**
   * Enqueue a single monitor check job.
   * Uses monitorId as the job name for traceability.
   */
  async enqueueCheck(data: MonitorCheckJobData): Promise<void> {
    await this.checkQueue.add(`check:${data.monitorId}`, data, {
      attempts: data.retries + 1, // 1 initial + N retries
      backoff: {
        type: 'exponential',
        delay: 2000, // 2s, 4s, 8s...
      },
      removeOnComplete: {
        age: 3600,   // Keep completed jobs for 1 hour
        count: 1000, // Keep last 1000 completed jobs
      },
      removeOnFail: {
        age: 86400,  // Keep failed jobs for 24 hours
        count: 5000, // Keep last 5000 failed jobs
      },
    });

    this.logger.debug(`Enqueued check for monitor ${data.monitorId}`);
  }

  /**
   * Enqueue checks for multiple monitors in bulk.
   * More efficient than individual adds for the scheduler.
   */
  async enqueueBulk(jobs: MonitorCheckJobData[]): Promise<void> {
    if (jobs.length === 0) return;

    const bulkJobs = jobs.map((data) => ({
      name: `check:${data.monitorId}`,
      data,
      opts: {
        attempts: data.retries + 1,
        backoff: {
          type: 'exponential' as const,
          delay: 2000,
        },
        removeOnComplete: { age: 3600, count: 1000 },
        removeOnFail: { age: 86400, count: 5000 },
      },
    }));

    await this.checkQueue.addBulk(bulkJobs);

    this.logger.log(`Enqueued ${jobs.length} monitor checks in bulk`);
  }
}
