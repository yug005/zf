import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service.js';
import { CreateChangeEventDto } from './dto/create-change-event.dto.js';
import { IngestDeployDto } from './dto/ingest-deploy.dto.js';

type ChangeEventTypeValue =
  | 'DEPLOY'
  | 'CONFIG'
  | 'DNS'
  | 'FEATURE_FLAG'
  | 'SSL'
  | 'SECRET'
  | 'INFRASTRUCTURE'
  | 'RELEASE'
  | 'MANUAL';

type ChangeEventSourceValue = 'MANUAL' | 'API' | 'GITHUB' | 'VERCEL' | 'RAILWAY' | 'SYSTEM';

@Injectable()
export class ChangeService {
  constructor(private readonly prisma: PrismaService) {}

  async create(userId: string, dto: CreateChangeEventDto) {
    return this.createSingle(userId, dto);
  }

  async createBulk(userId: string, events: CreateChangeEventDto[]) {
    const results = await Promise.all(events.map((event) => this.createSingle(userId, event)));

    return {
      total: results.length,
      created: results.filter((result) => !result.deduped).length,
      skipped: results.filter((result) => result.deduped).length,
      items: results,
    };
  }

  async ingestDeploy(userId: string, dto: IngestDeployDto) {
    const project = await this.resolveProjectContext(userId, dto.projectId, dto.projectSlug);

    if (dto.monitorId) {
      await this.verifyMonitorOwnership(dto.monitorId, userId, project.id);
    }

    const provider = dto.provider || 'API';
    const happenedAt = dto.happenedAt || new Date().toISOString();
    const externalId =
      dto.externalId ||
      dto.deploymentId ||
      (dto.commitSha
        ? [provider, dto.commitSha, dto.environment || 'production'].join(':')
        : undefined);

    const metadata = this.compactRecord({
      ...(dto.metadata || {}),
      repository: dto.repository,
      branch: dto.branch,
      commitSha: dto.commitSha,
      deploymentId: dto.deploymentId,
      deploymentUrl: dto.deploymentUrl,
      projectSlug: project.slug,
    });

    return this.createSingle(userId, {
      projectId: project.id,
      monitorId: dto.monitorId,
      type: dto.type || 'DEPLOY',
      source: provider,
      externalId,
      title: dto.title || this.buildDeployTitle(provider, dto),
      summary: dto.summary || this.buildDeploySummary(dto),
      serviceName: dto.serviceName,
      environment: dto.environment || 'production',
      version: dto.version,
      metadata: Object.keys(metadata).length > 0 ? metadata : undefined,
      happenedAt,
      watchWindowMinutes: dto.watchWindowMinutes,
    });
  }

  private async createSingle(userId: string, dto: CreateChangeEventDto) {
    await this.verifyProjectOwnership(dto.projectId, userId);

    if (dto.monitorId) {
      await this.verifyMonitorOwnership(dto.monitorId, userId, dto.projectId);
    }

    const happenedAt = new Date(dto.happenedAt);
    const watchWindowMinutes =
      dto.watchWindowMinutes ??
      (dto.type === 'DEPLOY' || dto.type === 'RELEASE' ? 30 : undefined);

    if (dto.externalId) {
      const existing = await (this.prisma as any).changeEvent.findFirst({
        where: {
          projectId: dto.projectId,
          source: dto.source || 'MANUAL',
          externalId: dto.externalId,
        },
        include: {
          project: {
            select: {
              id: true,
              name: true,
            },
          },
          monitor: {
            select: {
              id: true,
              name: true,
            },
          },
        },
      });

      if (existing) {
        return {
          ...this.serializeWatchState(existing),
          deduped: true,
        };
      }
    }

    const created = await (this.prisma as any).changeEvent.create({
      data: {
        projectId: dto.projectId,
        monitorId: dto.monitorId,
        type: dto.type as ChangeEventTypeValue,
        source: (dto.source || 'MANUAL') as ChangeEventSourceValue,
        externalId: dto.externalId,
        title: dto.title,
        summary: dto.summary,
        serviceName: dto.serviceName,
        environment: dto.environment,
        version: dto.version,
        metadata: dto.metadata as any,
        happenedAt,
        watchUntil: watchWindowMinutes
          ? new Date(happenedAt.getTime() + watchWindowMinutes * 60_000)
          : undefined,
      },
      include: {
        project: {
          select: {
            id: true,
            name: true,
          },
        },
        monitor: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    return {
      ...this.serializeWatchState(created),
      deduped: false,
    };
  }

  async findAll(
    userId: string,
    options: {
      projectId?: string;
      monitorId?: string;
      type?: string;
      activeWatch?: boolean;
      limit?: number;
    },
  ) {
    const { projectId, monitorId, type, activeWatch = false, limit = 25 } = options;

    if (projectId) {
      await this.verifyProjectOwnership(projectId, userId);
    }

    if (monitorId) {
      await this.verifyMonitorOwnership(monitorId, userId);
    }

    const changes = await (this.prisma as any).changeEvent.findMany({
      where: {
        ...(type ? { type } : {}),
        ...(monitorId ? { monitorId } : {}),
        ...(activeWatch
          ? {
              watchUntil: {
                gte: new Date(),
              },
            }
          : {}),
        ...(projectId
          ? { projectId }
          : {
              project: {
                userId,
              },
            }),
      },
      include: {
        project: {
          select: {
            id: true,
            name: true,
          },
        },
        monitor: {
          select: {
            id: true,
            name: true,
          },
        },
      },
      orderBy: { happenedAt: 'desc' },
      take: limit,
    });

    return changes.map((change) => this.serializeWatchState(change));
  }

  async getRecentForIncident(options: {
    userId: string;
    projectId: string;
    monitorId: string;
    serviceName?: string | null;
    incidentCreatedAt: Date;
    incidentResolvedAt?: Date | null;
  }) {
    const { userId, projectId, monitorId, serviceName, incidentCreatedAt, incidentResolvedAt } = options;

    await this.verifyProjectOwnership(projectId, userId);

    const windowStart = new Date(incidentCreatedAt.getTime() - 2 * 60 * 60 * 1000);
    const windowEnd = incidentResolvedAt ?? new Date();

    const changes = await (this.prisma as any).changeEvent.findMany({
      where: {
        projectId,
        happenedAt: {
          gte: windowStart,
          lte: windowEnd,
        },
        OR: [
          { monitorId },
          { monitorId: null },
          ...(serviceName ? [{ serviceName }] : []),
        ],
      },
      include: {
        monitor: {
          select: {
            id: true,
            name: true,
          },
        },
        project: {
          select: {
            id: true,
            name: true,
          },
        },
      },
      orderBy: { happenedAt: 'desc' },
      take: 10,
    });

    return changes
      .map((change) => {
        const minutesFromIncidentStart =
          Math.abs(incidentCreatedAt.getTime() - change.happenedAt.getTime()) / 60_000;
        const happenedDuringWatchWindow = Boolean(
          change.watchUntil &&
            new Date(change.watchUntil).getTime() >= incidentCreatedAt.getTime() &&
            new Date(change.happenedAt).getTime() <= incidentCreatedAt.getTime(),
        );
        const confidenceSignals: string[] = [];
        let confidence = 25;

        if (change.monitorId === monitorId) {
          confidence += 30;
          confidenceSignals.push('Targets the same monitor');
        }

        if (serviceName && change.serviceName && change.serviceName === serviceName) {
          confidence += 14;
          confidenceSignals.push('Matches the same service');
        }

        if (happenedDuringWatchWindow) {
          confidence += 12;
          confidenceSignals.push('Incident began during the deploy watch window');
        }

        if (change.happenedAt <= incidentCreatedAt) {
          if (minutesFromIncidentStart <= 10) {
            confidence += 18;
            confidenceSignals.push('Occurred within 10 minutes before the incident');
          } else if (minutesFromIncidentStart <= 30) {
            confidence += 12;
            confidenceSignals.push('Occurred shortly before the incident');
          } else if (minutesFromIncidentStart <= 60) {
            confidence += 6;
            confidenceSignals.push('Occurred within the previous hour');
          }
        } else {
          confidence -= 10;
          confidenceSignals.push('Recorded after the incident started');
        }

        if (change.type === 'DEPLOY' || change.type === 'RELEASE') {
          confidence += 8;
          confidenceSignals.push('Deploy and release changes are common incident triggers');
        }

        if (change.type === 'CONFIG' || change.type === 'DNS' || change.type === 'SECRET') {
          confidence += 6;
          confidenceSignals.push('Configuration-style changes can disrupt healthy endpoints quickly');
        }

        if (change.source !== 'MANUAL') {
          confidence += 3;
          confidenceSignals.push('Captured by automation rather than manual notes');
        }

        const boundedConfidence = Math.max(5, Math.min(98, confidence));
        const recommendedAction = this.buildRecommendedAction(change.type, boundedConfidence);

        return {
          ...this.serializeWatchState(change),
          confidence: Math.round(boundedConfidence),
          minutesFromIncidentStart: Math.round(minutesFromIncidentStart),
          happenedDuringWatchWindow,
          confidenceSignals,
          recommendedAction,
        };
      })
      .sort((left, right) => right.confidence - left.confidence);
  }

  private serializeWatchState(change: any) {
    const watchUntil = change.watchUntil ? new Date(change.watchUntil) : null;
    const now = Date.now();
    const isWatchActive = Boolean(watchUntil && watchUntil.getTime() >= now);
    const watchMinutesRemaining = watchUntil
      ? Math.max(0, Math.ceil((watchUntil.getTime() - now) / 60_000))
      : 0;

    return {
      ...change,
      watchUntil,
      isWatchActive,
      watchMinutesRemaining,
    };
  }

  private buildDeployTitle(provider: 'API' | 'GITHUB' | 'VERCEL' | 'RAILWAY', dto: IngestDeployDto) {
    const providerLabel = {
      API: 'API deploy',
      GITHUB: 'GitHub deploy',
      VERCEL: 'Vercel deploy',
      RAILWAY: 'Railway deploy',
    }[provider];

    const target =
      dto.serviceName ||
      dto.repository ||
      dto.environment ||
      'project update';

    const versionSuffix = dto.version ? ` ${dto.version}` : '';

    return `${providerLabel} for ${target}${versionSuffix}`.trim();
  }

  private buildDeploySummary(dto: IngestDeployDto) {
    const parts = [
      dto.repository ? `Repository ${dto.repository}` : null,
      dto.branch ? `branch ${dto.branch}` : null,
      dto.commitSha ? `commit ${dto.commitSha.slice(0, 7)}` : null,
      dto.environment ? `to ${dto.environment}` : null,
    ].filter(Boolean);

    return parts.length > 0
      ? `Automated deploy recorded from ${parts.join(', ')}.`
      : 'Automated deploy recorded from an external delivery system.';
  }

  private compactRecord(record: Record<string, unknown>) {
    return Object.fromEntries(
      Object.entries(record).filter(([, value]) => value !== undefined && value !== null && value !== ''),
    );
  }

  private buildRecommendedAction(type: ChangeEventTypeValue, confidence: number) {
    const confidencePrefix =
      confidence >= 80 ? 'High confidence' : confidence >= 60 ? 'Worth checking next' : 'Review if needed';

    switch (type) {
      case 'DEPLOY':
      case 'RELEASE':
        return `${confidencePrefix}: compare the latest deploy, rollback if customer impact is growing, and watch recovery for 10-15 minutes.`;
      case 'CONFIG':
      case 'SECRET':
        return `${confidencePrefix}: inspect recent config and secret values first, then revert the last risky change if the endpoint keeps failing.`;
      case 'DNS':
      case 'SSL':
        return `${confidencePrefix}: verify DNS or certificate propagation before changing application code.`;
      case 'FEATURE_FLAG':
        return `${confidencePrefix}: disable the newest flag treatment and confirm whether errors stop.`;
      case 'INFRASTRUCTURE':
        return `${confidencePrefix}: inspect recent infrastructure updates and provider health before redeploying.`;
      default:
        return `${confidencePrefix}: validate this change against the incident timeline before moving to deeper debugging.`;
    }
  }

  private async resolveProjectContext(userId: string, projectId?: string, projectSlug?: string) {
    if (!projectId && !projectSlug) {
      throw new BadRequestException('Either projectId or projectSlug is required');
    }

    const project = await this.prisma.project.findFirst({
      where: {
        userId,
        ...(projectId ? { id: projectId } : {}),
        ...(projectSlug ? { slug: projectSlug } : {}),
      },
      select: {
        id: true,
        name: true,
        slug: true,
      },
    });

    if (!project) {
      throw new NotFoundException('Project not found');
    }

    return project;
  }

  private async verifyProjectOwnership(projectId: string, userId: string) {
    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
      select: { userId: true },
    });

    if (!project) {
      throw new NotFoundException('Project not found');
    }

    if (project.userId !== userId) {
      throw new ForbiddenException('You do not have access to this project');
    }
  }

  private async verifyMonitorOwnership(monitorId: string, userId: string, projectId?: string) {
    const monitor = await this.prisma.monitor.findUnique({
      where: { id: monitorId },
      select: {
        projectId: true,
        project: {
          select: {
            userId: true,
          },
        },
      },
    });

    if (!monitor) {
      throw new NotFoundException('Monitor not found');
    }

    if (monitor.project.userId !== userId) {
      throw new ForbiddenException('You do not have access to this monitor');
    }

    if (projectId && monitor.projectId !== projectId) {
      throw new ForbiddenException('Monitor does not belong to the selected project');
    }
  }
}
