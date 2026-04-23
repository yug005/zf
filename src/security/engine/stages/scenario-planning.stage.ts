import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service.js';
import type { SecurityScanJobData } from '../constants.js';
import { ScenarioPackRegistry } from '../scenario-pack.registry.js';

@Injectable()
export class ScenarioPlanningStage {
  private readonly logger = new Logger(ScenarioPlanningStage.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly scenarioPackRegistry: ScenarioPackRegistry,
  ) {}

  async execute(data: SecurityScanJobData): Promise<void> {
    const scan = await this.prisma.securityScan.findUnique({
      where: { id: data.scanId },
      include: {
        target: {
          include: {
            collectors: { where: { status: { in: ['ACTIVE', 'DEGRADED'] } } },
          },
        },
      },
    });

    if (!scan) {
      throw new Error(`Scan ${data.scanId} not found.`);
    }

    const executionMode = (scan.executionMode ?? data.executionMode ?? data.tier) as
      | 'STANDARD'
      | 'ADVANCED'
      | 'EMULATION'
      | 'CONTINUOUS_VALIDATION';

    const packs = await this.scenarioPackRegistry.listApplicablePacks({
      targetKind: scan.target.targetKind,
      executionMode,
      hasCollector: scan.target.collectors.length > 0,
    });

    await this.prisma.securityScan.update({
      where: { id: data.scanId },
      data: {
        plannerSummary: {
          ...((scan.plannerSummary as Record<string, unknown> | null) ?? {}),
          executionMode,
          selectedPacks: packs.map((pack) => ({
            slug: pack.slug,
            family: pack.family,
            safetyLevel: pack.safetyLevel,
            steps: pack.steps.length,
          })),
          safetyPolicy: {
            destructiveActionsAllowed: false,
            requiresCollectorsForDetectionValidation: true,
            localTargetsDowngraded: scan.target.environment === 'LAB' || scan.target.environment === 'DEVELOPMENT',
          },
          budget: {
            tier: data.tier,
            assetScope: scan.assetScope,
          },
        },
      },
    });

    this.logger.log(`Scenario planning selected ${packs.length} packs for scan ${data.scanId}`);
  }
}
