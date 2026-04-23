import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service.js';
import type { SecurityScanJobData } from '../constants.js';
import { calculateScore, determineRiskLevel } from '../normalization/score-calculator.js';

/**
 * SCORING — Stage 6
 * Calculates the overall risk score from all findings collected
 * in the passive analysis and active probes stages.
 */
@Injectable()
export class ScoringStage {
  private readonly logger = new Logger(ScoringStage.name);

  constructor(private readonly prisma: PrismaService) {}

  async execute(data: SecurityScanJobData): Promise<void> {
    const [findings, attackPaths, controlFailures] = await Promise.all([
      this.prisma.securityFinding.findMany({
        where: { scanId: data.scanId },
        select: { severity: true, exploitability: true, confidence: true, validationState: true },
      }),
      this.prisma.securityAttackPath.findMany({
        where: { scanId: data.scanId },
        select: { score: true },
      }),
      this.prisma.securityControlVerdict.count({
        where: { scanId: data.scanId, status: { in: ['FAILED', 'DEGRADED'] } },
      }),
    ]);

    const score = calculateScore(findings, {
      attackPathScores: attackPaths.map((path) => path.score),
      controlFailures,
    });
    const riskLevel = determineRiskLevel(score);

    // Count severities
    const severityCounts = {
      critical: findings.filter((f) => f.severity === 'CRITICAL').length,
      high: findings.filter((f) => f.severity === 'HIGH').length,
      medium: findings.filter((f) => f.severity === 'MEDIUM').length,
      low: findings.filter((f) => f.severity === 'LOW').length,
      informational: findings.filter((f) => f.severity === 'INFORMATIONAL').length,
    };

    await this.prisma.securityScan.update({
      where: { id: data.scanId },
      data: {
        score,
        riskLevel,
        severityCounts,
        reportMetadata: {
          attackPathCount: attackPaths.length,
          controlFailureCount: controlFailures,
        },
      },
    });

    this.logger.log(
      `Scoring: scan ${data.scanId} score=${score.toFixed(1)}, risk=${riskLevel}, ` +
        `findings: C${severityCounts.critical} H${severityCounts.high} M${severityCounts.medium} L${severityCounts.low} I${severityCounts.informational}`,
    );
  }
}
