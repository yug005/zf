import { Injectable, Logger, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service.js';
import { diagnoseCheck } from '../../engine/check-diagnosis.js';

type CheckHistoryQuery = {
  monitorId: string;
  limit?: number;
  offset?: number;
  days?: number;
};

type CheckExportQuery = {
  monitorId: string;
  days: number;
};

@Injectable()
export class CheckService {
  private readonly logger = new Logger(CheckService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * List check results — verifies the user owns the monitor's project.
   */
  async findAllByMonitor(userId: string, query: CheckHistoryQuery) {
    await this.verifyMonitorOwnership(query.monitorId, userId);

    const limit = this.clamp(query.limit ?? 50, 1, 500);
    const offset = Math.max(query.offset ?? 0, 0);
    const where = this.buildWhere(query.monitorId, query.days);

    this.logger.debug(
      `Fetching checks for monitor ${query.monitorId} (limit=${limit}, offset=${offset}, days=${query.days ?? 'all'})`,
    );

    const [data, total] = await Promise.all([
      this.prisma.checkResult.findMany({
        where,
        orderBy: { checkedAt: 'desc' },
        take: limit,
        skip: offset,
      }),
      this.prisma.checkResult.count({ where }),
    ]);

    return {
      data: data.map((check) => ({
        ...check,
        diagnosis: diagnoseCheck({
          status: check.status,
          statusCode: check.statusCode,
          errorMessage: check.errorMessage,
        }),
      })),
      total,
      limit,
      offset,
      days: query.days ?? null,
    };
  }

  async exportChecksCsv(userId: string, query: CheckExportQuery): Promise<string> {
    await this.verifyMonitorOwnership(query.monitorId, userId);

    const where = this.buildWhere(query.monitorId, query.days);
    const checks = await this.prisma.checkResult.findMany({
      where,
      orderBy: { checkedAt: 'desc' },
      select: {
        id: true,
        status: true,
        statusCode: true,
        responseTimeMs: true,
        errorMessage: true,
        checkedAt: true,
      },
    });

    const rows = [
      ['id', 'checkedAt', 'status', 'statusCode', 'responseTimeMs', 'errorMessage', 'diagnosisCode', 'diagnosisSummary', 'diagnosisConfidence'],
      ...checks.map((check) => {
        const diagnosis = diagnoseCheck({
          status: check.status,
          statusCode: check.statusCode,
          errorMessage: check.errorMessage,
        });

        return [
          check.id,
          check.checkedAt.toISOString(),
          check.status,
          check.statusCode ?? '',
          check.responseTimeMs ?? '',
          check.errorMessage ?? '',
          diagnosis?.code ?? '',
          diagnosis?.summary ?? '',
          diagnosis?.confidence ?? '',
        ];
      }),
    ];

    return rows.map((row) => row.map((value) => this.escapeCsv(String(value))).join(',')).join('\n');
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
    return {
      ...checkData,
      diagnosis: diagnoseCheck({
        status: checkData.status,
        statusCode: checkData.statusCode,
        errorMessage: checkData.errorMessage,
      }),
    };
  }

  private buildWhere(monitorId: string, days?: number) {
    const checkedAt =
      days && days > 0
        ? {
            gte: new Date(Date.now() - days * 24 * 60 * 60 * 1000),
          }
        : undefined;

    return {
      monitorId,
      ...(checkedAt ? { checkedAt } : {}),
    };
  }

  private clamp(value: number, min: number, max: number): number {
    return Math.min(Math.max(value, min), max);
  }

  private escapeCsv(value: string): string {
    if (value.includes('"') || value.includes(',') || value.includes('\n')) {
      return `"${value.replace(/"/g, '""')}"`;
    }

    return value;
  }

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
