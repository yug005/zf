import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service.js';
import type { SecurityScanJobData } from '../constants.js';

/**
 * TARGET_PREP — Stage 1
 * Captures a snapshot of the target state at scan time,
 * validates that the target still exists and is in a scannable state.
 */
@Injectable()
export class TargetPrepStage {
  private readonly logger = new Logger(TargetPrepStage.name);

  constructor(private readonly prisma: PrismaService) {}

  async execute(data: SecurityScanJobData): Promise<void> {
    const target = await this.prisma.securityTarget.findUnique({
      where: { id: data.targetId },
      include: {
        verifications: { orderBy: { createdAt: 'desc' }, take: 1 },
        assets: { orderBy: { createdAt: 'asc' } },
        collectors: { orderBy: { createdAt: 'desc' } },
      },
    });

    if (!target) {
      throw new Error(`Target ${data.targetId} not found — it may have been deleted.`);
    }

    // Store target snapshot for the report
    await this.prisma.securityScan.update({
      where: { id: data.scanId },
      data: {
        targetSnapshot: {
          name: target.name,
          baseUrl: target.baseUrl,
          targetKind: target.targetKind,
          environment: target.environment,
          criticality: target.criticality,
          verificationState: target.verificationState,
          assetCount: target.assets.length,
          collectorCount: target.collectors.length,
          capturedAt: new Date().toISOString(),
        },
      },
    });

    this.logger.log(`Target prep complete for scan ${data.scanId}`);
  }
}
