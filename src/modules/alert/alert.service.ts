import { Injectable, Logger, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service.js';

@Injectable()
export class AlertService {
  private readonly logger = new Logger(AlertService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * List alerts for a monitor — verifies ownership first.
   */
  async findAllByMonitor(userId: string, monitorId?: string, status?: string, limit = 50) {
    const where: Record<string, unknown> = {};

    if (monitorId) {
      await this.verifyMonitorOwnership(monitorId, userId);
      where.monitorId = monitorId;
    } else {
      where.monitor = {
        project: { userId },
      };
    }

    if (status) {
      where.status = status;
    }

    return this.prisma.alert.findMany({
      where,
      include: {
        monitor: {
          select: {
            name: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
  }

  /**
   * Get a single alert — verifies ownership via monitor → project → user.
   */
  async findOne(userId: string, id: string) {
    const alert = await this.getAlertWithOwnership(id, userId);
    const { monitor: _monitor, ...alertData } = alert;
    return alertData;
  }

  /**
   * Acknowledge an alert — verifies ownership first.
   */
  async acknowledge(userId: string, id: string) {
    await this.getAlertWithOwnership(id, userId);

    this.logger.log(`Acknowledging alert ${id}`);
    return this.prisma.alert.update({
      where: { id },
      data: {
        status: 'ACKNOWLEDGED',
        acknowledgedAt: new Date(),
      },
    });
  }

  /**
   * Resolve an alert — verifies ownership first.
   */
  async resolve(userId: string, id: string) {
    await this.getAlertWithOwnership(id, userId);

    this.logger.log(`Resolving alert ${id}`);
    return this.prisma.alert.update({
      where: { id },
      data: {
        status: 'RESOLVED',
        resolvedAt: new Date(),
      },
    });
  }

  // ─── Private Helpers ─────────────────────────────────────────

  /**
   * Fetch alert with ownership chain and verify access.
   */
  private async getAlertWithOwnership(id: string, userId: string) {
    const alert = await this.prisma.alert.findUnique({
      where: { id },
      include: {
        monitor: {
          select: {
            project: { select: { userId: true } },
          },
        },
      },
    });

    if (!alert) {
      throw new NotFoundException(`Alert with ID "${id}" not found`);
    }

    if (alert.monitor.project.userId !== userId) {
      throw new ForbiddenException('You do not have access to this alert');
    }

    return alert;
  }

  /**
   * Verify the user owns the monitor's parent project.
   */
  private async verifyMonitorOwnership(monitorId: string, userId: string): Promise<void> {
    const monitor = await this.prisma.monitor.findUnique({
      where: { id: monitorId },
      select: {
        project: { select: { userId: true } },
      },
    });

    if (!monitor) {
      throw new NotFoundException(`Monitor with ID "${monitorId}" not found`);
    }

    if (monitor.project.userId !== userId) {
      throw new ForbiddenException('You do not have access to this monitor');
    }
  }
}
