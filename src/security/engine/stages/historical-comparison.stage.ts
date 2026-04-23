import { Injectable, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../../prisma/prisma.service.js';
import type { SecurityScanJobData } from '../constants.js';

/**
 * HISTORICAL_COMPARISON — Post-scoring stage.
 *
 * Compares current scan findings with the most recent previous scan
 * for the same target. Generates:
 *   - New findings (didn't exist before)
 *   - Resolved findings (existed before, gone now)
 *   - Escalated findings (severity increased)
 *   - De-escalated findings (severity decreased)
 *   - Persistent findings (unchanged)
 *
 * This powers:
 *   - Regression detection (previously fixed → returned)
 *   - Progress tracking (remediation effectiveness)
 *   - Smart alerting (only alert on NEW critical findings)
 */

interface FindingFingerprint {
  id: string;
  fingerprint: string;
  severity: string;
  category: string;
  title: string;
  endpoint: string | null;
  exploitability: string;
  confidence: string;
  validationState: string | null;
}

const SEVERITY_ORDER = ['INFORMATIONAL', 'LOW', 'MEDIUM', 'HIGH', 'CRITICAL'];

@Injectable()
export class HistoricalComparisonStage {
  private readonly logger = new Logger(HistoricalComparisonStage.name);

  constructor(private readonly prisma: PrismaService) {}

  async execute(data: SecurityScanJobData): Promise<void> {
    // Find the most recent COMPLETED scan for this target (excluding current)
    const previousScan = await this.prisma.securityScan.findFirst({
      where: {
        targetId: data.targetId,
        status: 'COMPLETED',
        id: { not: data.scanId },
      },
      orderBy: { completedAt: 'desc' },
      select: { id: true, score: true, severityCounts: true, completedAt: true },
    });

    if (!previousScan) {
      this.logger.log(`No previous scan for target ${data.targetId} — skipping historical comparison`);

      // Still annotate scan as "first scan"
      await this.prisma.securityScan.update({
        where: { id: data.scanId },
        data: {
          reportMetadata: {
            ...(await this.getExistingReportMetadata(data.scanId)),
            historicalComparison: {
              isFirstScan: true,
              previousScanId: null,
            },
          },
        },
      });
      return;
    }

    // Get findings from both scans
    const [currentFindings, previousFindings] = await Promise.all([
      this.prisma.securityFinding.findMany({
        where: { scanId: data.scanId, falsePositive: false },
        select: {
          id: true, fingerprint: true, severity: true, category: true,
          title: true, endpoint: true, exploitability: true, confidence: true,
          validationState: true,
        },
      }),
      this.prisma.securityFinding.findMany({
        where: { scanId: previousScan.id, falsePositive: false },
        select: {
          id: true, fingerprint: true, severity: true, category: true,
          title: true, endpoint: true, exploitability: true, confidence: true,
          validationState: true,
        },
      }),
    ]);

    // Build fingerprint indexes
    const currentByFingerprint = new Map<string, FindingFingerprint>();
    for (const f of currentFindings) {
      if (f.fingerprint) currentByFingerprint.set(f.fingerprint, f as FindingFingerprint);
    }

    const previousByFingerprint = new Map<string, FindingFingerprint>();
    for (const f of previousFindings) {
      if (f.fingerprint) previousByFingerprint.set(f.fingerprint, f as FindingFingerprint);
    }

    // Compute deltas
    const newFindings: Array<{ id: string; title: string; severity: string; category: string }> = [];
    const resolvedFindings: Array<{ id: string; title: string; severity: string; category: string }> = [];
    const escalatedFindings: Array<{ id: string; title: string; from: string; to: string }> = [];
    const deescalatedFindings: Array<{ id: string; title: string; from: string; to: string }> = [];
    const persistentFindings: Array<{ id: string; title: string; severity: string }> = [];
    const regressions: Array<{ id: string; title: string; severity: string; category: string }> = [];

    // New findings = in current but not in previous
    for (const [fp, current] of currentByFingerprint) {
      const previous = previousByFingerprint.get(fp);
      if (!previous) {
        newFindings.push({
          id: current.id,
          title: current.title,
          severity: current.severity,
          category: current.category,
        });
      } else {
        // Compare severity
        const prevIdx = SEVERITY_ORDER.indexOf(previous.severity);
        const currIdx = SEVERITY_ORDER.indexOf(current.severity);

        if (currIdx > prevIdx) {
          escalatedFindings.push({
            id: current.id,
            title: current.title,
            from: previous.severity,
            to: current.severity,
          });
        } else if (currIdx < prevIdx) {
          deescalatedFindings.push({
            id: current.id,
            title: current.title,
            from: previous.severity,
            to: current.severity,
          });
        } else {
          persistentFindings.push({
            id: current.id,
            title: current.title,
            severity: current.severity,
          });
        }
      }
    }

    // Resolved findings = in previous but not in current
    for (const [fp, previous] of previousByFingerprint) {
      if (!currentByFingerprint.has(fp)) {
        resolvedFindings.push({
          id: previous.id,
          title: previous.title,
          severity: previous.severity,
          category: previous.category,
        });
      }
    }

    // Check for regressions: resolved in any earlier scan but now returned
    const allPreviousScans = await this.prisma.securityScan.findMany({
      where: {
        targetId: data.targetId,
        status: 'COMPLETED',
        id: { not: data.scanId },
      },
      orderBy: { completedAt: 'desc' },
      take: 5,
      select: { id: true },
    });

    if (allPreviousScans.length >= 2) {
      // A finding is a regression if it existed in scan N-2+ but not N-1, and now exists again
      const olderScanIds = allPreviousScans.slice(1).map(s => s.id);
      const olderFindings = await this.prisma.securityFinding.findMany({
        where: {
          scanId: { in: olderScanIds },
          falsePositive: false,
          fingerprint: { not: null },
        },
        select: { fingerprint: true, title: true, severity: true, category: true },
      });

      const olderFingerprints = new Set(olderFindings.filter(f => f.fingerprint).map(f => f.fingerprint!));

      for (const newFinding of newFindings) {
        const current = currentByFingerprint.get(
          `${newFinding.category}:${newFinding.title}:${currentFindings.find(f => f.id === newFinding.id)?.endpoint ?? '/'}`
        );
        if (current?.fingerprint && olderFingerprints.has(current.fingerprint) && !previousByFingerprint.has(current.fingerprint)) {
          regressions.push({
            id: current.id,
            title: current.title,
            severity: current.severity,
            category: current.category,
          });
        }
      }
    }

    // Calculate score delta
    const currentScan = await this.prisma.securityScan.findUnique({
      where: { id: data.scanId },
      select: { score: true },
    });

    const scoreDelta = currentScan?.score != null && previousScan.score != null
      ? Math.round((currentScan.score - previousScan.score) * 10) / 10
      : null;

    const previousCounts = (previousScan.severityCounts as Record<string, number>) ?? {};
    const currentCounts = await this.prisma.securityFinding.groupBy({
      by: ['severity'],
      where: { scanId: data.scanId, falsePositive: false },
      _count: true,
    });

    const currentCountsMap: Record<string, number> = {};
    for (const group of currentCounts) {
      currentCountsMap[group.severity.toLowerCase()] = group._count;
    }

    // Persist delta
    const delta = {
      previousScanId: previousScan.id,
      previousScanDate: previousScan.completedAt?.toISOString(),
      isFirstScan: false,
      scoreDelta,
      severityDelta: {
        critical: (currentCountsMap.critical ?? 0) - (previousCounts.critical ?? 0),
        high: (currentCountsMap.high ?? 0) - (previousCounts.high ?? 0),
        medium: (currentCountsMap.medium ?? 0) - (previousCounts.medium ?? 0),
        low: (currentCountsMap.low ?? 0) - (previousCounts.low ?? 0),
      },
      newFindings,
      resolvedFindings,
      escalatedFindings,
      deescalatedFindings,
      persistentFindings: persistentFindings.length,
      regressions,
      summary: this.buildDeltaSummary({
        newCount: newFindings.length,
        resolvedCount: resolvedFindings.length,
        escalatedCount: escalatedFindings.length,
        regressionCount: regressions.length,
        scoreDelta,
      }),
    };

    await this.prisma.securityScan.update({
      where: { id: data.scanId },
      data: {
        reportMetadata: {
          ...(await this.getExistingReportMetadata(data.scanId)),
          historicalComparison: delta,
        },
      },
    });

    this.logger.log(
      `Historical comparison for scan ${data.scanId}: ` +
      `+${newFindings.length} new, -${resolvedFindings.length} resolved, ` +
      `↑${escalatedFindings.length} escalated, ${regressions.length} regressions, ` +
      `score Δ=${scoreDelta ?? 'N/A'}`,
    );
  }

  private buildDeltaSummary(input: {
    newCount: number;
    resolvedCount: number;
    escalatedCount: number;
    regressionCount: number;
    scoreDelta: number | null;
  }): string {
    const parts: string[] = [];

    if (input.regressionCount > 0) {
      parts.push(`⚠️ ${input.regressionCount} previously resolved issue(s) have returned (regression)`);
    }
    if (input.newCount > 0) {
      parts.push(`${input.newCount} new finding(s) discovered`);
    }
    if (input.resolvedCount > 0) {
      parts.push(`${input.resolvedCount} previously identified issue(s) have been resolved`);
    }
    if (input.escalatedCount > 0) {
      parts.push(`${input.escalatedCount} finding(s) increased in severity`);
    }
    if (input.scoreDelta !== null) {
      if (input.scoreDelta > 0) {
        parts.push(`Risk score increased by ${input.scoreDelta} points`);
      } else if (input.scoreDelta < 0) {
        parts.push(`Risk score improved by ${Math.abs(input.scoreDelta)} points`);
      }
    }

    return parts.length > 0 ? parts.join('. ') + '.' : 'No significant changes detected since the last scan.';
  }

  private async getExistingReportMetadata(scanId: string): Promise<Record<string, unknown>> {
    const scan = await this.prisma.securityScan.findUnique({
      where: { id: scanId },
      select: { reportMetadata: true },
    });
    return (scan?.reportMetadata as Record<string, unknown>) ?? {};
  }
}
