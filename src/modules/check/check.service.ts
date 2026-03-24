import { Injectable, Logger, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service.js';

@Injectable()
export class CheckService {
  private readonly logger = new Logger(CheckService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * List check results — verifies the user owns the monitor's project.
   */
  async findAllByMonitor(userId: string, monitorId: string, limit = 50, offset = 0) {
    await this.verifyMonitorOwnership(monitorId, userId);

    this.logger.debug(`Fetching checks for monitor ${monitorId} (limit=${limit}, offset=${offset})`);
    const [data, total] = await Promise.all([
      this.prisma.checkResult.findMany({
        where: { monitorId },
        orderBy: { checkedAt: 'desc' },
        take: limit,
        skip: offset,
      }),
      this.prisma.checkResult.count({ where: { monitorId } }),
    ]);

    return { data, total, limit, offset };
  }

  /**
   * Get a single check result — verifies ownership via monitor → project → user.
   */
  async findOne(userId: string, id: string) {
    const check = await this.prisma.checkResult.findUnique({
      where: { id },
      include: {
        monitor: {
          select: {
            project: { select: { userId: true } },
          },
        },
      },
    });

    if (!check) {
      throw new NotFoundException(`CheckResult with ID "${id}" not found`);
    }

    if (check.monitor.project.userId !== userId) {
      throw new ForbiddenException('You do not have access to this check result');
    }

    const { monitor: _monitor, ...checkData } = check;
    return checkData;
  }

  // ─── Private Helpers ─────────────────────────────────────────

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
