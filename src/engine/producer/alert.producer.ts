import { Injectable, Logger } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { ConfigService } from '@nestjs/config';
import { Queue } from 'bullmq';
import { ALERT_DELIVERY_QUEUE } from '../constants.js';
import type { AlertDeliveryJobData } from '../constants.js';
import { PrismaService } from '../../prisma/prisma.service.js';

@Injectable()
export class AlertProducer {
  private readonly logger = new Logger(AlertProducer.name);
  private readonly throttleTtlSeconds: number;

  constructor(
    @InjectQueue(ALERT_DELIVERY_QUEUE)
    private readonly alertQueue: Queue<AlertDeliveryJobData>,
    private readonly configService: ConfigService,
    private readonly prisma: PrismaService,
  ) {
    this.throttleTtlSeconds = this.configService.get<number>('ALERT_THROTTLE_TTL_SECONDS', 300);
  }

  /**
   * Enqueue an alert job, applying rate limit/throttling per monitor.
   */
  async enqueueAlert(data: AlertDeliveryJobData): Promise<void> {
    const client = await this.alertQueue.client;

    // Use Redis SET NX with EX to throttle alerts per monitor
    // We throttle TRIGGERED and RESOLVED separately so we don't accidentally swallow a recovery just because an alert just fired.
    const throttleKey = `throttle:alert:${data.monitorId}:${data.type}:${data.channel ?? 'ALL'}`;
    
    // Set NX (Not eXists), EX (Expire in seconds)
    const acquired = await client.set(throttleKey, '1', 'EX', this.throttleTtlSeconds, 'NX');

    if (!acquired) {
      await this.prisma.alert.update({
        where: { id: data.alertId },
        data: {
          lastSuppressedAt: new Date(),
          deliveryError: `Suppressed by alert throttle for ${this.throttleTtlSeconds} seconds.`,
        },
      }).catch(() => undefined);
      this.logger.warn(`Alert for monitor ${data.monitorId} (${data.type}) blocked by throttle (${this.throttleTtlSeconds}s).`);
      return; // Skip enqueueing
    }

    await this.alertQueue.add(`alert:${data.alertId}`, data, {
      attempts: 5, // retry 4 times after first attempt
      backoff: {
        type: 'exponential',
        delay: 5000, // 5s, 10s, 20s, 40s
      },
      removeOnComplete: { age: 86400, count: 500 },
      removeOnFail: { age: 86400 * 7, count: 1000 },
    });

    this.logger.log(`Enqueued delivery for alert ${data.alertId} (${data.type})`);
  }
}
