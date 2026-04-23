import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service.js';
import { ComplianceService } from '../engine/normalization/compliance.service.js';

@Injectable()
export class ReportService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly complianceService: ComplianceService,
  ) {}

  async getExecutiveReport(scanId: string, userId: string) {
    const scan = await this.prisma.securityScan.findUnique({
      where: { id: scanId },
      include: {
        target: {
          select: {
            id: true,
            name: true,
            baseUrl: true,
            userId: true,
            verificationState: true,
            targetKind: true,
            environment: true,
            criticality: true,
          },
        },
        findings: {
          orderBy: [{ severity: 'desc' }, { exploitability: 'desc' }],
        },
      },
    });

    if (!scan || scan.target.userId !== userId) {
      throw new NotFoundException('Scan not found.');
    }

    const [endpoints, attackPaths, evidenceArtifacts, controlVerdicts, assets, relationships] = await Promise.all([
      this.prisma.securityEndpointInventory.findMany({
        where: { targetId: scan.targetId },
      }),
      this.prisma.securityAttackPath.findMany({
        where: { scanId },
        orderBy: [{ score: 'desc' }, { createdAt: 'asc' }],
      }),
      this.prisma.securityEvidenceArtifact.findMany({
        where: { scanId },
        orderBy: { createdAt: 'asc' },
      }),
      this.prisma.securityControlVerdict.findMany({
        where: { scanId },
        orderBy: { createdAt: 'asc' },
      }),
      this.prisma.securityAsset.findMany({
        where: { targetId: scan.targetId },
        orderBy: [{ criticality: 'desc' }, { createdAt: 'asc' }],
      }),
      this.prisma.securityRelationship.findMany({
        where: { targetId: scan.targetId },
        orderBy: { createdAt: 'asc' },
      }),
    ]);

    // Get trend history (last 10 scans for this target)
    const trendHistory = await this.prisma.securityScan.findMany({
      where: { targetId: scan.targetId, status: 'COMPLETED' },
      orderBy: { completedAt: 'desc' },
      take: 10,
      select: {
        id: true,
        score: true,
        riskLevel: true,
        severityCounts: true,
        completedAt: true,
        tier: true,
      },
    });

    // ─── Compliance Mapping ─────────────────────────────────────
    const findingCategories = [...new Set(scan.findings.map(f => f.category))];
    const complianceMappings = this.complianceService.getMappings(findingCategories);
    const complianceScores = this.complianceService.calculateComplianceScores(
      scan.findings.map(f => ({ category: f.category, severity: f.severity, falsePositive: f.falsePositive })),
    );

    // ─── Remediation Priority Queue ─────────────────────────────
    const remediationQueue = this.buildRemediationQueue(scan.findings);

    // ─── Historical Comparison (from report metadata) ───────────
    const historicalComparison = (scan.reportMetadata as Record<string, unknown>)?.historicalComparison ?? null;

    // ─── Asset Topology (graph-ready format) ────────────────────
    const assetTopology = {
      nodes: assets.map(a => ({
        id: a.id,
        kind: a.kind,
        name: a.name,
        hostname: a.hostname,
        criticality: a.criticality,
        reachability: a.reachability,
        environment: a.environment,
        riskLevel: this.getAssetRiskLevel(a.id, scan.findings),
        findingCount: scan.findings.filter(f =>
          Array.isArray(f.affectedAssets) && (f.affectedAssets as string[]).includes(a.id),
        ).length,
      })),
      edges: relationships.map(r => ({
        id: r.id,
        from: r.fromAssetId,
        to: r.toAssetId,
        kind: r.kind,
        confidence: r.confidence,
      })),
    };

    return {
      scan: {
        id: scan.id,
        status: scan.status,
        tier: scan.tier,
        executionMode: scan.executionMode,
        score: scan.score,
        riskLevel: scan.riskLevel,
        severityCounts: scan.severityCounts,
        summary: scan.summary,
        startedAt: scan.startedAt,
        completedAt: scan.completedAt,
        stage: scan.stage,
        stageProgress: scan.stageProgress,
        errorMessage: scan.errorMessage,
      },
      target: scan.target,
      findings: scan.findings,
      endpointInventory: endpoints,
      assets,
      assetTopology,
      attackPaths,
      evidenceArtifacts,
      controlVerdicts,
      reportMetadata: scan.reportMetadata,
      trendHistory,
      complianceMappings,
      complianceScores,
      remediationQueue,
      historicalComparison,
    };
  }

  async getAttackPaths(scanId: string, userId: string) {
    const report = await this.getExecutiveReport(scanId, userId);
    return report.attackPaths;
  }

  async getEvidence(scanId: string, userId: string) {
    const report = await this.getExecutiveReport(scanId, userId);
    return report.evidenceArtifacts;
  }

  /**
   * Build a prioritized remediation queue with "Fix this first" recommendations.
   */
  private buildRemediationQueue(findings: Array<{
    id: string;
    category: string;
    title: string;
    severity: string;
    exploitability: string;
    confidence: string;
    remediation: string | null;
    validationState: string | null;
    endpoint: string | null;
    falsePositive: boolean;
  }>) {
    const activeFindings = findings.filter(f => !f.falsePositive);

    // Score each finding for priority
    const scored = activeFindings
      .filter(f => f.remediation)
      .map(f => {
        const severityScore = f.severity === 'CRITICAL' ? 100 : f.severity === 'HIGH' ? 80 : f.severity === 'MEDIUM' ? 50 : f.severity === 'LOW' ? 20 : 5;
        const exploitabilityBoost = f.exploitability === 'PROVEN' ? 30 : f.exploitability === 'PROBABLE' ? 15 : 0;
        const validationBoost = f.validationState === 'VALIDATED' ? 20 : f.validationState === 'LAB_ONLY' ? -10 : 0;
        const confidenceBoost = f.confidence === 'HIGH' ? 10 : f.confidence === 'MEDIUM' ? 5 : 0;

        return {
          findingId: f.id,
          title: f.title,
          category: f.category,
          severity: f.severity,
          exploitability: f.exploitability,
          endpoint: f.endpoint,
          remediation: f.remediation!,
          priorityScore: severityScore + exploitabilityBoost + validationBoost + confidenceBoost,
          isValidated: f.validationState === 'VALIDATED',
          isFixFirst: severityScore + exploitabilityBoost >= 110, // CRITICAL + PROVEN
        };
      })
      .sort((a, b) => b.priorityScore - a.priorityScore);

    // Deduplicate by remediation text (group similar fixes)
    const seen = new Set<string>();
    const deduped = scored.filter(item => {
      const key = `${item.category}:${item.remediation.substring(0, 100)}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

    return deduped.slice(0, 15);
  }

  /**
   * Determine asset risk level based on related findings.
   */
  private getAssetRiskLevel(assetId: string, findings: Array<{ severity: string; affectedAssets: unknown }>) {
    const related = findings.filter(f =>
      Array.isArray(f.affectedAssets) && (f.affectedAssets as string[]).includes(assetId),
    );

    if (related.some(f => f.severity === 'CRITICAL')) return 'CRITICAL';
    if (related.some(f => f.severity === 'HIGH')) return 'HIGH';
    if (related.some(f => f.severity === 'MEDIUM')) return 'MEDIUM';
    if (related.length > 0) return 'LOW';
    return 'SECURE';
  }
}
