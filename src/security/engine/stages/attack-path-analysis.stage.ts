import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service.js';
import type { SecurityScanJobData } from '../constants.js';

/**
 * ATTACK_PATH_ANALYSIS — Graph-based attack path correlation engine.
 *
 * Upgraded from basic grouping to true causal chain analysis:
 *   • Builds a weighted directed graph of findings
 *   • Identifies causal chains (e.g., Missing Auth → IDOR → Data Exposure)
 *   • Assigns weighted edges based on exploitability
 *   • Path scoring with risk amplification
 *   • Critical path highlighting
 *   • Multi-step attack sequence construction
 */

// Edge weight matrix: how category A enables or amplifies category B
const CAUSAL_WEIGHT_MATRIX: Record<string, Record<string, number>> = {
  AUTH_POSTURE: {
    BROKEN_ACCESS_CONTROL: 0.9,
    SENSITIVE_DATA_EXPOSURE: 0.8,
    SECRET_EXPOSURE: 0.7,
    API_ABUSE: 0.6,
    BUSINESS_LOGIC: 0.5,
  },
  BROKEN_ACCESS_CONTROL: {
    SENSITIVE_DATA_EXPOSURE: 0.85,
    SECRET_EXPOSURE: 0.8,
    API_ABUSE: 0.5,
    MASS_ASSIGNMENT: 0.7,
  },
  INJECTION_DETECTION: {
    SENSITIVE_DATA_EXPOSURE: 0.9,
    SECRET_EXPOSURE: 0.85,
    COMMAND_INJECTION: 0.7,
  },
  SECURITY_MISCONFIGURATION: {
    AUTH_POSTURE: 0.6,
    DEBUG_EXPOSURE: 0.7,
    SENSITIVE_DATA_EXPOSURE: 0.5,
    CLOUD_MISCONFIG: 0.6,
  },
  CORS_MISCONFIGURATION: {
    SENSITIVE_DATA_EXPOSURE: 0.7,
    AUTH_POSTURE: 0.5,
    SECRET_EXPOSURE: 0.6,
  },
  DEBUG_EXPOSURE: {
    SENSITIVE_DATA_EXPOSURE: 0.8,
    SECRET_EXPOSURE: 0.85,
    TECH_DISCLOSURE: 0.6,
  },
  DOM_XSS: {
    AUTH_POSTURE: 0.7,
    SECRET_EXPOSURE: 0.8,
    SENSITIVE_DATA_EXPOSURE: 0.75,
  },
  XSS_DETECTION: {
    AUTH_POSTURE: 0.7,
    SECRET_EXPOSURE: 0.75,
    SENSITIVE_DATA_EXPOSURE: 0.7,
  },
  SSRF_POSTURE: {
    CLOUD_MISCONFIG: 0.9,
    SENSITIVE_DATA_EXPOSURE: 0.85,
    SECRET_EXPOSURE: 0.8,
  },
  CLOUD_MISCONFIG: {
    SENSITIVE_DATA_EXPOSURE: 0.8,
    SECRET_EXPOSURE: 0.85,
  },
  TECH_DISCLOSURE: {
    INJECTION_DETECTION: 0.4,
    SECURITY_MISCONFIGURATION: 0.3,
  },
  MASS_ASSIGNMENT: {
    BROKEN_ACCESS_CONTROL: 0.8,
    AUTH_POSTURE: 0.6,
  },
  API_ABUSE: {
    SENSITIVE_DATA_EXPOSURE: 0.6,
    RESOURCE_ABUSE: 0.5,
    PERFORMANCE_RISK: 0.4,
  },
};

interface GraphNode {
  findingId: string;
  category: string;
  title: string;
  severity: string;
  exploitability: string;
  confidence: string;
  endpoint?: string | null;
  validationState: string;
}

interface GraphEdge {
  from: string; // findingId
  to: string;   // findingId
  weight: number;
  relationship: string;
}

@Injectable()
export class AttackPathAnalysisStage {
  private readonly logger = new Logger(AttackPathAnalysisStage.name);

  constructor(private readonly prisma: PrismaService) {}

  async execute(data: SecurityScanJobData): Promise<void> {
    await this.prisma.securityAttackPath.deleteMany({
      where: { scanId: data.scanId },
    });

    const [scan, findings, assets] = await Promise.all([
      this.prisma.securityScan.findUnique({
        where: { id: data.scanId },
        include: { target: true },
      }),
      this.prisma.securityFinding.findMany({
        where: { scanId: data.scanId, falsePositive: false },
        orderBy: [{ severity: 'desc' }, { confidence: 'desc' }],
      }),
      this.prisma.securityAsset.findMany({
        where: { targetId: data.targetId },
        orderBy: [{ criticality: 'desc' }, { createdAt: 'asc' }],
      }),
    ]);

    if (!scan) {
      throw new Error(`Scan ${data.scanId} not found.`);
    }

    if (findings.length === 0) {
      this.logger.log(`No findings to analyze for scan ${data.scanId}`);
      return;
    }

    const entryAsset = assets.find((asset) => asset.reachability !== 'INTERNAL') ?? assets[0] ?? null;
    const crownJewel = assets.find((asset) => asset.criticality === 'CRITICAL' || asset.kind === 'CROWN_JEWEL')
      ?? assets.find((asset) => asset.criticality === 'HIGH')
      ?? assets[0]
      ?? null;

    // ─── Build Graph ──────────────────────────────────────────
    const nodes: GraphNode[] = findings.map(f => ({
      findingId: f.id,
      category: f.category,
      title: f.title,
      severity: f.severity,
      exploitability: f.exploitability,
      confidence: f.confidence,
      endpoint: f.endpoint,
      validationState: f.validationState,
    }));

    const edges: GraphEdge[] = [];

    // Build causal edges between findings
    for (const source of nodes) {
      const sourceWeights = CAUSAL_WEIGHT_MATRIX[source.category];
      if (!sourceWeights) continue;

      for (const target of nodes) {
        if (source.findingId === target.findingId) continue;

        const baseWeight = sourceWeights[target.category];
        if (!baseWeight) continue;

        // Amplify edge weight if findings share the same endpoint
        const sameEndpoint = source.endpoint && target.endpoint && source.endpoint === target.endpoint;
        const endpointMultiplier = sameEndpoint ? 1.3 : 1.0;

        // Amplify for proven exploitability
        const exploitMultiplier = source.exploitability === 'PROVEN' ? 1.2 : source.exploitability === 'PROBABLE' ? 1.0 : 0.7;

        const weight = Math.min(1.0, baseWeight * endpointMultiplier * exploitMultiplier);

        edges.push({
          from: source.findingId,
          to: target.findingId,
          weight,
          relationship: `${source.category} → ${target.category}`,
        });
      }
    }

    // ─── Extract Attack Paths (longest weighted paths) ────────
    const paths = this.extractCriticalPaths(nodes, edges);

    // ─── Store each path ──────────────────────────────────────
    for (const path of paths) {
      const pathFindings = path.nodeIds
        .map(id => findings.find(f => f.id === id))
        .filter(Boolean) as typeof findings;

      if (pathFindings.length === 0) continue;

      const pathScore = this.calculatePathScore(
        pathFindings, path.totalWeight,
        entryAsset?.reachability ?? 'EXTERNAL',
        crownJewel?.criticality ?? 'MEDIUM',
      );

      const title = pathFindings.length === 1
        ? pathFindings[0].title
        : `${pathFindings[0].category.replace(/_/g, ' ')} → ${pathFindings[pathFindings.length - 1].category.replace(/_/g, ' ')} chain`;

      await this.prisma.securityAttackPath.create({
        data: {
          targetId: data.targetId,
          scanId: data.scanId,
          title,
          summary: this.buildPathSummary(pathFindings, path.edges, scan.target.name),
          entryAssetId: entryAsset?.id,
          crownJewelAssetId: crownJewel?.id,
          score: pathScore,
          techniqueChain: pathFindings.flatMap((f) =>
            Array.isArray(f.attckTechniques) ? f.attckTechniques : [],
          ),
          prerequisiteNodes: pathFindings.map((f) => ({
            findingId: f.id,
            category: f.category,
            validationState: f.validationState,
          })),
          pathNodes: [
            entryAsset ? { assetId: entryAsset.id, name: entryAsset.name, role: 'entry' } : null,
            ...pathFindings.map((f, i) => ({
              findingId: f.id,
              title: f.title,
              severity: f.severity,
              exploitability: f.exploitability,
              step: i + 1,
              category: f.category,
            })),
            crownJewel ? { assetId: crownJewel.id, name: crownJewel.name, role: 'crown_jewel' } : null,
          ].filter(Boolean),
          metadata: {
            graphBased: true,
            edgeCount: path.edges.length,
            totalWeight: path.totalWeight,
            findingIds: pathFindings.map(f => f.id),
            causalChain: path.edges.map(e => e.relationship),
          },
        },
      });
    }

    // ─── Also create paths for isolated findings ──────────────
    const pathFindingIds = new Set(paths.flatMap(p => p.nodeIds));
    const isolatedFindings = findings.filter(f => !pathFindingIds.has(f.id));

    // Group isolated findings by category for standalone paths
    const grouped = new Map<string, typeof findings>();
    for (const finding of isolatedFindings) {
      const key = finding.businessAsset ?? finding.scenarioPackSlug ?? finding.category;
      if (!grouped.has(key)) grouped.set(key, []);
      grouped.get(key)?.push(finding);
    }

    for (const [key, group] of grouped) {
      const score = this.calculatePathScore(
        group, 0,
        entryAsset?.reachability ?? 'EXTERNAL',
        crownJewel?.criticality ?? 'MEDIUM',
      );

      await this.prisma.securityAttackPath.create({
        data: {
          targetId: data.targetId,
          scanId: data.scanId,
          title: group.length === 1 ? group[0].title : `Attack path through ${key.toLowerCase().replace(/_/g, ' ')}`,
          summary: `${scan.target.name} exposes ${group.length} finding(s) grouped by ${key}.`,
          entryAssetId: entryAsset?.id,
          crownJewelAssetId: crownJewel?.id,
          score,
          techniqueChain: group.flatMap(f => Array.isArray(f.attckTechniques) ? f.attckTechniques : []),
          prerequisiteNodes: group.map(f => ({
            findingId: f.id, category: f.category, validationState: f.validationState,
          })),
          pathNodes: [
            entryAsset ? { assetId: entryAsset.id, name: entryAsset.name, role: 'entry' } : null,
            ...group.map(f => ({ findingId: f.id, title: f.title, severity: f.severity, exploitability: f.exploitability })),
            crownJewel ? { assetId: crownJewel.id, name: crownJewel.name, role: 'crown_jewel' } : null,
          ].filter(Boolean),
          metadata: { groupedBy: key, findingIds: group.map(f => f.id), graphBased: false },
        },
      });
    }

    this.logger.log(`Attack path analysis: ${paths.length} causal chain(s) + ${grouped.size} grouped path(s) for scan ${data.scanId}`);
  }

  /**
   * Extract critical attack paths from the finding graph.
   * Uses a greedy approach: start from highest-severity nodes with
   * outgoing causal edges, and follow the heaviest path.
   */
  private extractCriticalPaths(
    nodes: GraphNode[],
    edges: GraphEdge[],
  ): Array<{ nodeIds: string[]; edges: GraphEdge[]; totalWeight: number }> {
    if (edges.length === 0) return [];

    const paths: Array<{ nodeIds: string[]; edges: GraphEdge[]; totalWeight: number }> = [];
    const used = new Set<string>();

    // Sort nodes by severity (CRITICAL first) and exploitability
    const sortedNodes = [...nodes].sort((a, b) => {
      const sevOrder = ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW', 'INFORMATIONAL'];
      return sevOrder.indexOf(a.severity) - sevOrder.indexOf(b.severity);
    });

    for (const startNode of sortedNodes) {
      if (used.has(startNode.findingId)) continue;

      // Find outgoing edges
      const outgoingEdges = edges
        .filter(e => e.from === startNode.findingId && !used.has(e.to))
        .sort((a, b) => b.weight - a.weight);

      if (outgoingEdges.length === 0) continue;

      // Build path by following heaviest edges (max depth 5)
      const pathNodeIds = [startNode.findingId];
      const pathEdges: GraphEdge[] = [];
      let currentId = startNode.findingId;
      let totalWeight = 0;

      for (let depth = 0; depth < 5; depth++) {
        const nextEdge = edges
          .filter(e => e.from === currentId && !pathNodeIds.includes(e.to))
          .sort((a, b) => b.weight - a.weight)[0];

        if (!nextEdge) break;

        pathNodeIds.push(nextEdge.to);
        pathEdges.push(nextEdge);
        totalWeight += nextEdge.weight;
        currentId = nextEdge.to;
      }

      if (pathNodeIds.length >= 2) {
        pathNodeIds.forEach(id => used.add(id));
        paths.push({ nodeIds: pathNodeIds, edges: pathEdges, totalWeight });
      }
    }

    return paths.sort((a, b) => b.totalWeight - a.totalWeight).slice(0, 10);
  }

  private calculatePathScore(
    findings: Array<{ severity: string; exploitability: string }>,
    graphWeight: number,
    reachability: string,
    criticality: string,
  ): number {
    const severityWeight = findings.reduce((sum, finding) => {
      const value = finding.severity === 'CRITICAL' ? 25
        : finding.severity === 'HIGH' ? 18
        : finding.severity === 'MEDIUM' ? 12
        : finding.severity === 'LOW' ? 6 : 2;
      const exploitability = finding.exploitability === 'PROVEN' ? 1.2
        : finding.exploitability === 'PROBABLE' ? 1 : 0.65;
      return sum + value * exploitability;
    }, 0);

    const reachabilityWeight = reachability === 'EXTERNAL' ? 1.2 : reachability === 'HYBRID' ? 1.05 : 0.85;
    const criticalityWeight = criticality === 'CRITICAL' ? 1.25 : criticality === 'HIGH' ? 1.1 : criticality === 'LOW' ? 0.9 : 1;

    // Graph-based paths get a chain amplification bonus
    const chainAmplification = graphWeight > 0 ? 1 + (graphWeight * 0.15) : 1;

    return Math.round(Math.min(100, severityWeight * reachabilityWeight * criticalityWeight * chainAmplification) * 10) / 10;
  }

  private buildPathSummary(
    findings: Array<{ title: string; severity: string; category: string }>,
    edges: GraphEdge[],
    targetName: string,
  ): string {
    if (findings.length === 1) {
      return `${targetName} is affected by ${findings[0].title} (${findings[0].severity}).`;
    }

    const chain = findings.map(f => f.category.replace(/_/g, ' ').toLowerCase()).join(' → ');
    const causalDescription = edges.map(e => e.relationship).join(', ');

    return `${targetName} exposes a ${findings.length}-step attack chain: ${chain}. Causal links: ${causalDescription}. The lead finding is ${findings[0].title} (${findings[0].severity}).`;
  }
}
