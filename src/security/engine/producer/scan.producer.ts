import { Injectable, Logger } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { SECURITY_SCAN_QUEUE, SCAN_JOB_OPTIONS } from '../constants.js';
import type { SecurityScanJobData } from '../constants.js';

@Injectable()
export class ScanProducer {
  private readonly logger = new Logger(ScanProducer.name);

  constructor(
    @InjectQueue(SECURITY_SCAN_QUEUE) private readonly scanQueue: Queue,
  ) {}

  async enqueueScan(data: SecurityScanJobData) {
    const job = await this.scanQueue.add('security-scan', data, {
      ...SCAN_JOB_OPTIONS,
      jobId: `scan-${data.scanId}`,
    });

    this.logger.log(`Enqueued security scan ${data.scanId} for target ${data.targetId} (${data.tier})`);
    return job;
  }
}
