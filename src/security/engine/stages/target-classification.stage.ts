import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service.js';
import type { SecurityScanJobData } from '../constants.js';

@Injectable()
export class TargetClassificationStage {
  private readonly logger = new Logger(TargetClassificationStage.name);

  constructor(private readonly prisma: PrismaService) {}

  async execute(data: SecurityScanJobData): Promise<void> {
    const target = await this.prisma.securityTarget.findUnique({
      where: { id: data.targetId },
      include: {
        assets: { orderBy: { createdAt: 'asc' } },
        collectors: { orderBy: { createdAt: 'desc' }, take: 5 },
      },
    });

    if (!target) {
      throw new Error(`Target ${data.targetId} not found.`);
    }

    const url = new URL(target.baseUrl);
    const hostname = url.hostname.toLowerCase();
    const isLocal = hostname === 'localhost' || hostname.startsWith('127.') || hostname.endsWith('.local');
    const isDevFrontend = isLocal && url.port === '5173';
    const targetSurface = target.targetKind === 'API' ? 'api' : isDevFrontend ? 'frontend-dev' : 'web-app';
    const labels = [
      ...(isLocal ? ['LAB_ONLY'] : []),
      ...(isDevFrontend ? ['DEV_FRONTEND'] : []),
      target.targetKind,
      target.environment,
    ];

    await this.prisma.securityScan.update({
      where: { id: data.scanId },
      data: {
        plannerSummary: {
          ...(target.metadata as Record<string, unknown> | null ?? {}),
          classification: {
            targetKind: target.targetKind,
            environment: target.environment,
            targetSurface,
            isLocal,
            isDevFrontend,
            hostname,
            collectorCount: target.collectors.length,
            assetCount: target.assets.length,
            labels,
          },
        },
      },
    });

    this.logger.log(`Target classification complete for scan ${data.scanId}: ${targetSurface}`);
  }
}
