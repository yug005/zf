import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { IncidentStatus } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service.js';
import { ChangeService } from '../change/change.service.js';

type ImpactSeverity = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

@Injectable()
export class IncidentService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly changeService: ChangeService,
  ) {}

  async findAll(
    userId: string,
    options: {
      monitorId?: string;
      status?: IncidentStatus;
      limit?: number;
    },
  ) {
    const { monitorId, status, limit = 20 } = options;

    if (monitorId) {
      await this.verifyMonitorOwnership(monitorId, userId);
    }

    const incidents = await this.prisma.incident.findMany({
      where: {
        ...(status ? { status } : {}),
        ...(monitorId
          ? { monitorId }
          : {
              monitor: {
                project: { userId },
              },
            }),
      },
      include: {
        monitor: {
          select: {
            id: true,
            name: true,
            url: true,
            status: true,
            serviceName: true,
            featureName: true,
            customerJourney: true,
            teamOwner: true,
            region: true,
            businessCriticality: true,
            slaTier: true,
            projectId: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });

    return Promise.all(
      incidents.map(async (incident) => {
        const impact = this.buildImpactProfile(incident.monitor, incident.status);
        const relatedChanges = await this.changeService.getRecentForIncident({
          userId,
          projectId: incident.monitor.projectId,
          monitorId: incident.monitorId,
          serviceName: incident.monitor.serviceName,
          incidentCreatedAt: incident.createdAt,
          incidentResolvedAt: incident.resolvedAt,
        });

        return {
          ...incident,
          durationMs: (incident.resolvedAt ?? new Date()).getTime() - incident.createdAt.getTime(),
          severity: impact.severity,
          impactScore: impact.score,
          impactSummary: impact.summary,
          responseRecommendation: impact.recommendation,
          likelyTrigger: relatedChanges[0]
            ? {
                id: relatedChanges[0].id,
                title: relatedChanges[0].title,
                type: relatedChanges[0].type,
                source: relatedChanges[0].source,
                confidence: relatedChanges[0].confidence,
                happenedAt: relatedChanges[0].happenedAt,
                confidenceSignals: relatedChanges[0].confidenceSignals,
                recommendedAction: relatedChanges[0].recommendedAction,
              }
            : null,
        };
      }),
    );
  }

  async findOne(userId: string, id: string) {
    const incident = await this.prisma.incident.findUnique({
      where: { id },
      include: {
        monitor: {
          select: {
            id: true,
            name: true,
            url: true,
            status: true,
            serviceName: true,
            featureName: true,
            customerJourney: true,
            teamOwner: true,
            region: true,
            businessCriticality: true,
            slaTier: true,
            projectId: true,
            project: {
              select: {
                userId: true,
              },
            },
          },
        },
      },
    });

    if (!incident) {
      throw new NotFoundException('Incident not found');
    }

    if (incident.monitor.project.userId !== userId) {
      throw new ForbiddenException('You do not have access to this incident');
    }

    const endBoundary = incident.resolvedAt ?? new Date();
    const alerts = await this.prisma.alert.findMany({
      where: {
        monitorId: incident.monitorId,
        createdAt: {
          gte: incident.createdAt,
          lte: endBoundary,
        },
      },
      orderBy: { createdAt: 'asc' },
      select: {
        id: true,
        status: true,
        message: true,
        channel: true,
        createdAt: true,
        acknowledgedAt: true,
        resolvedAt: true,
      },
    });

    const checks = await this.prisma.checkResult.findMany({
      where: {
        monitorId: incident.monitorId,
        checkedAt: {
          gte: incident.createdAt,
          lte: endBoundary,
        },
      },
      orderBy: { checkedAt: 'asc' },
      take: 50,
      select: {
        id: true,
        status: true,
        statusCode: true,
        responseTimeMs: true,
        errorMessage: true,
        checkedAt: true,
      },
    });

    const timeline = [
      {
        id: `${incident.id}-opened`,
        type: 'incident_opened',
        title: 'Incident opened',
        description: incident.message,
        timestamp: incident.createdAt,
      },
      ...alerts.flatMap((alert) => {
        const entries = [
          {
            id: `${alert.id}-triggered`,
            type: 'alert_triggered',
            title: `${alert.channel} alert triggered`,
            description: alert.message,
            timestamp: alert.createdAt,
          },
        ];

        if (alert.acknowledgedAt) {
          entries.push({
            id: `${alert.id}-acknowledged`,
            type: 'alert_acknowledged',
            title: 'Alert acknowledged',
            description: alert.message,
            timestamp: alert.acknowledgedAt,
          });
        }

        if (alert.resolvedAt) {
          entries.push({
            id: `${alert.id}-resolved`,
            type: 'alert_resolved',
            title: 'Alert resolved',
            description: alert.message,
            timestamp: alert.resolvedAt,
          });
        }

        return entries;
      }),
      ...(incident.resolvedAt
        ? [
            {
              id: `${incident.id}-resolved`,
              type: 'incident_resolved',
              title: 'Incident resolved',
              description: `Monitor ${incident.monitor.name} recovered.`,
              timestamp: incident.resolvedAt,
            },
          ]
        : []),
    ].sort((left, right) => new Date(left.timestamp).getTime() - new Date(right.timestamp).getTime());

    const relatedChanges = await this.changeService.getRecentForIncident({
      userId,
      projectId: incident.monitor.projectId,
      monitorId: incident.monitorId,
      serviceName: incident.monitor.serviceName,
      incidentCreatedAt: incident.createdAt,
      incidentResolvedAt: incident.resolvedAt,
    });

    const { monitor } = incident;
    const impact = this.buildImpactProfile(monitor, incident.status);

    return {
      ...incident,
      monitor: {
        id: monitor.id,
        name: monitor.name,
        url: monitor.url,
        status: monitor.status,
        serviceName: monitor.serviceName,
        projectId: monitor.projectId,
        featureName: monitor.featureName,
        customerJourney: monitor.customerJourney,
        teamOwner: monitor.teamOwner,
        region: monitor.region,
        businessCriticality: monitor.businessCriticality,
        slaTier: monitor.slaTier,
      },
      alerts,
      checks,
      timeline,
      relatedChanges,
      likelyTrigger: relatedChanges[0] ?? null,
      severity: impact.severity,
      impactScore: impact.score,
      impactSummary: impact.summary,
      responseRecommendation: impact.recommendation,
      durationMs: (incident.resolvedAt ?? new Date()).getTime() - incident.createdAt.getTime(),
    };
  }

  private buildImpactProfile(
    monitor: {
      serviceName?: string | null;
      featureName?: string | null;
      customerJourney?: string | null;
      teamOwner?: string | null;
      region?: string | null;
      businessCriticality?: string | null;
      slaTier?: string | null;
      status?: string | null;
    },
    incidentStatus: IncidentStatus,
  ) {
    let score = 20;

    switch (monitor.businessCriticality) {
      case 'CRITICAL':
        score += 40;
        break;
      case 'HIGH':
        score += 25;
        break;
      case 'LOW':
        score += 0;
        break;
      default:
        score += 12;
    }

    switch (monitor.slaTier) {
      case 'ENTERPRISE':
        score += 20;
        break;
      case 'PREMIUM':
        score += 10;
        break;
      default:
        score += 0;
    }

    if (monitor.featureName) score += 5;
    if (monitor.customerJourney) score += 5;
    if (monitor.teamOwner) score += 3;
    if (incidentStatus !== IncidentStatus.RESOLVED) score += 7;
    if (monitor.status === 'DOWN') score += 8;
    if (monitor.region && monitor.region.toLowerCase() !== 'global') score += 2;

    const boundedScore = Math.max(0, Math.min(100, score));

    let severity: ImpactSeverity = 'LOW';
    if (boundedScore >= 80) {
      severity = 'CRITICAL';
    } else if (boundedScore >= 60) {
      severity = 'HIGH';
    } else if (boundedScore >= 35) {
      severity = 'MEDIUM';
    }

    const mappedSurface = [
      monitor.serviceName ? `service ${monitor.serviceName}` : null,
      monitor.featureName ? `feature ${monitor.featureName}` : null,
      monitor.customerJourney ? `journey ${monitor.customerJourney}` : null,
    ].filter(Boolean);

    const ownershipState = monitor.teamOwner
      ? `Owned by ${monitor.teamOwner}`
      : 'Owner not assigned';
    const commercialRisk =
      monitor.slaTier === 'ENTERPRISE'
        ? 'Enterprise SLA exposure'
        : monitor.slaTier === 'PREMIUM'
          ? 'Premium SLA exposure'
          : 'Standard SLA exposure';

    const recommendation =
      severity === 'CRITICAL'
        ? 'Escalate immediately, open customer communications, and review the most recent linked changes first.'
        : severity === 'HIGH'
          ? 'Prioritize investigation now, validate likely triggers, and confirm the owning team is engaged.'
          : severity === 'MEDIUM'
            ? 'Review during the current response window and confirm customer-facing impact stays limited.'
            : 'Track the incident, but a lightweight review is usually enough unless the signal grows.';

    return {
      score: boundedScore,
      severity,
      summary: {
        serviceName: monitor.serviceName ?? null,
        featureName: monitor.featureName ?? null,
        customerJourney: monitor.customerJourney ?? null,
        teamOwner: monitor.teamOwner ?? null,
        region: monitor.region ?? null,
        businessCriticality: monitor.businessCriticality ?? 'MEDIUM',
        slaTier: monitor.slaTier ?? 'STANDARD',
        mappedSurface,
        ownershipState,
        commercialRisk,
      },
      recommendation,
    };
  }

  private async verifyMonitorOwnership(monitorId: string, userId: string) {
    const monitor = await this.prisma.monitor.findUnique({
      where: { id: monitorId },
      select: {
        project: {
          select: { userId: true },
        },
      },
    });

    if (!monitor) {
      throw new NotFoundException('Monitor not found');
    }

    if (monitor.project.userId !== userId) {
      throw new ForbiddenException('You do not have access to this monitor');
    }
  }
}
