import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { ALERT_DELIVERY_QUEUE } from '../constants.js';
import type { AlertDeliveryJobData } from '../constants.js';
import { NotificationService } from '../alerts/notification.service.js';
import { PrismaService } from '../../prisma/prisma.service.js';

@Processor(ALERT_DELIVERY_QUEUE)
export class AlertProcessor extends WorkerHost {
  private readonly logger = new Logger(AlertProcessor.name);

  constructor(
    private readonly notificationService: NotificationService,
    private readonly prisma: PrismaService,
  ) {
    super();
  }

  async process(job: Job<AlertDeliveryJobData>): Promise<void> {
    const { alertId, type, monitorName } = job.data;

    this.logger.debug(
      `Processing delivery for alert ${alertId} (${type}: ${monitorName}) - Attempt ${job.attemptsMade + 1}`,
    );

    try {
      await this.prisma.alert.update({
        where: { id: alertId },
        data: {
          deliveryAttempts: { increment: 1 },
          lastDeliveryAttemptAt: new Date(),
        },
      });

      await this.notificationService.sendNotifications(job.data);
      await this.prisma.alert.update({
        where: { id: alertId },
        data: {
          lastDeliveredAt: new Date(),
          deliveryError: null,
        },
      });
      this.logger.debug(`Successfully delivered alert ${alertId}`);
    } catch (error: any) {
      await this.prisma.alert.update({
        where: { id: alertId },
        data: {
          deliveryError: error.message,
        },
      }).catch(() => undefined);
      this.logger.error(`Error delivering alert ${alertId}: ${error.message}`);
      throw error; // Let BullMQ retry
    }
  }
}
