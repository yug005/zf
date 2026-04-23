import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service.js';
import type { SecurityScanJobData } from '../constants.js';

/**
 * REPORT_GENERATION — Stage 7
 * Compiles the executive report metadata: summary text,
 * prioritized findings, remediation queue, timeline, and endpoint inventory.
 */
@Injectable()
export class ReportGenerationStage {
  private readonly logger = new Logger(ReportGenerationStage.name);

  constructor(private readonly prisma: PrismaService) {}

  async execute(data: SecurityScanJobData): Promise<void> {
    const scan = await this.prisma.securityScan.findUnique({
      where: { id: data.scanId },
      include: {
        findings: { orderBy: [{ severity: 'desc' }, { exploitability: 'desc' }] },
      },
    });

    if (!scan) throw new Error(`Scan ${data.scanId} not found.`);

    const findings = scan.findings;
    const [endpoints, attackPaths, controlVerdicts] = await Promise.all([
      this.prisma.securityEndpointInventory.findMany({
        where: { targetId: data.targetId },
      }),
      this.prisma.securityAttackPath.findMany({
        where: { scanId: data.scanId },
        orderBy: [{ score: 'desc' }, { createdAt: 'asc' }],
      }),
      this.prisma.securityControlVerdict.findMany({
        where: { scanId: data.scanId },
        orderBy: { createdAt: 'asc' },
      }),
    ]);

    // Build summary text
    const criticalCount = findings.filter((f) => f.severity === 'CRITICAL').length;
    const highCount = findings.filter((f) => f.severity === 'HIGH').length;
    const totalFindings = findings.length;

    let summary: string;
    if (attackPaths.length > 0) {
      summary = `${totalFindings} findings resolved into ${attackPaths.length} prioritized attack path${attackPaths.length > 1 ? 's' : ''}. Focus first on the highest-scoring path and any failed control verdicts.`;
    } else if (totalFindings === 0) {
      summary = 'No security findings were identified during this scan. Your API displays a strong security posture.';
    } else if (criticalCount > 0) {
      summary = `${totalFindings} findings identified, including ${criticalCount} critical issue${criticalCount > 1 ? 's' : ''} requiring immediate attention. Priority remediation is recommended.`;
    } else if (highCount > 0) {
      summary = `${totalFindings} findings identified, including ${highCount} high-severity issue${highCount > 1 ? 's' : ''}. Review and remediate at your earliest convenience.`;
    } else {
      summary = `${totalFindings} findings identified, primarily low and informational severity. Continue monitoring and address as part of regular maintenance.`;
    }

    // Top remediations (deduplicated by category)
    const topRemediations = this.deduplicateRemediations(findings);

    // Scan timeline
    const timeline = {
      queuedAt: scan.createdAt,
      startedAt: scan.startedAt,
      completedAt: new Date(),
      durationMs: scan.startedAt ? Date.now() - scan.startedAt.getTime() : null,
    };

    await this.prisma.securityScan.update({
      where: { id: data.scanId },
      data: {
        summary,
        reportMetadata: {
          generatedAt: new Date().toISOString(),
          totalFindings,
          endpointCount: endpoints.length,
          attackPathCount: attackPaths.length,
          controlVerdictCount: controlVerdicts.length,
          topRemediations,
          timeline,
          findingsByCategory: this.groupByCategory(findings),
          topAttackPaths: attackPaths.slice(0, 5).map((path) => ({
            id: path.id,
            title: path.title,
            score: path.score,
            summary: path.summary,
          })),
        },
      },
    });

    this.logger.log(`Report generated for scan ${data.scanId}: ${totalFindings} findings, ${endpoints.length} endpoints`);
  }

  private deduplicateRemediations(findings: Array<{ category: string; remediation: string | null; severity: string }>) {
    const seen = new Set<string>();
    const result: Array<{ category: string; remediation: string; priority: string }> = [];

    for (const finding of findings) {
      if (!finding.remediation || seen.has(finding.category)) continue;
      seen.add(finding.category);
      result.push({
        category: finding.category,
        remediation: finding.remediation,
        priority: finding.severity,
      });
    }

    return result.slice(0, 10);
  }

  private groupByCategory(findings: Array<{ category: string }>) {
    const groups: Record<string, number> = {};
    for (const f of findings) {
      groups[f.category] = (groups[f.category] || 0) + 1;
    }
    return groups;
  }
}
