import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { AlertStatus, CheckStatus, MonitorStatus } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service.js';
import { CreateMonitorDto } from './dto/create-monitor.dto.js';
import { UpdateMonitorDto } from './dto/update-monitor.dto.js';
import { SubscriptionAccessService } from '../billing/subscription-access.service.js';

const MONITOR_INSIGHT_SAMPLE_SIZE = 20;
const RECENT_ALERT_LIMIT = 5;

@Injectable()
export class MonitorService {
  private readonly logger = new Logger(MonitorService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly subscriptionAccessService: SubscriptionAccessService,
  ) {}

  async create(userId: string, dto: CreateMonitorDto) {
    const access = await this.subscriptionAccessService.assertCanCreateMonitors(userId);
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        projects: {
          select: { _count: { select: { monitors: true } } },
        },
      },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    const currentMonitors = user.projects.reduce((acc, project) => acc + project._count.monitors, 0);
    const requestedInterval = dto.intervalSeconds ?? 60;

    this.subscriptionAccessService.assertMonitorCapacity(currentMonitors, access);
    this.subscriptionAccessService.assertIntervalAllowed(requestedInterval, access);

    await this.verifyProjectOwnership(dto.projectId, userId);

    this.logger.log(
      `Creating monitor "${dto.name}" for project ${dto.projectId} (used ${currentMonitors}/${access.monitorLimit})`,
    );

    return this.prisma.monitor.create({
      data: {
        name: dto.name,
        url: dto.url,
        type: dto.type as any,
        serviceName: dto.serviceName,
        featureName: dto.featureName,
        customerJourney: dto.customerJourney,
        teamOwner: dto.teamOwner,
        region: dto.region,
        businessCriticality: dto.businessCriticality,
        slaTier: dto.slaTier,
        httpMethod: dto.httpMethod,
        intervalSeconds: dto.intervalSeconds,
        timeoutMs: dto.timeoutMs,
        expectedStatus: dto.expectedStatus,
        headers: dto.headers as never,
        body: dto.body as never,
        retries: dto.retries,
        status: MonitorStatus.UP,
        isActive: true,
        pausedByBilling: false,
        projectId: dto.projectId,
      },
    });
  }

  async update(userId: string, id: string, dto: UpdateMonitorDto) {
    const monitor = await this.prisma.monitor.findUnique({
       where: { id },
       include: { project: { select: { userId: true } } }
    });

    if (!monitor) throw new NotFoundException('Monitor not found');
    if (monitor.project.userId !== userId) throw new ForbiddenException('Forbidden');

    if (dto.intervalSeconds) {
       const access = await this.subscriptionAccessService.syncUserStateById(userId);
       this.subscriptionAccessService.assertIntervalAllowed(dto.intervalSeconds, access);
    }

    return this.prisma.monitor.update({
      where: { id },
      data: {
        name: dto.name,
        url: dto.url,
        type: dto.type as any,
        serviceName: dto.serviceName,
        featureName: dto.featureName,
        customerJourney: dto.customerJourney,
        teamOwner: dto.teamOwner,
        region: dto.region,
        businessCriticality: dto.businessCriticality,
        slaTier: dto.slaTier,
        httpMethod: dto.httpMethod,
        intervalSeconds: dto.intervalSeconds,
        timeoutMs: dto.timeoutMs,
        expectedStatus: dto.expectedStatus,
        headers: dto.headers as any,
        body: dto.body as any,
        retries: dto.retries,
      },
    });
  }

  async findAllByProject(userId: string, projectId?: string) {
    const where = projectId
      ? { projectId }
      : {
          project: { userId },
        };

    if (projectId) {
      await this.verifyProjectOwnership(projectId, userId);
    }

    const monitors = await this.prisma.monitor.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: {
        checkResults: {
          orderBy: { checkedAt: 'desc' },
          take: MONITOR_INSIGHT_SAMPLE_SIZE,
          select: {
            id: true,
            status: true,
            statusCode: true,
            responseTimeMs: true,
            errorMessage: true,
            checkedAt: true,
          },
        },
        alerts: {
          orderBy: { createdAt: 'desc' },
          take: RECENT_ALERT_LIMIT,
          select: {
            id: true,
            channel: true,
            status: true,
            message: true,
            deliveryAttempts: true,
            lastDeliveredAt: true,
            lastSuppressedAt: true,
            deliveryError: true,
            createdAt: true,
            resolvedAt: true,
          },
        },
      },
    });

    return monitors.map((monitor) => this.serializeMonitorWithInsights(monitor));
  }

  async findOne(userId: string, id: string) {
    const monitor = await this.prisma.monitor.findUnique({
      where: { id },
      include: {
        project: { select: { userId: true } },
        checkResults: {
          orderBy: { checkedAt: 'desc' },
          take: MONITOR_INSIGHT_SAMPLE_SIZE,
          select: {
            id: true,
            status: true,
            statusCode: true,
            responseTimeMs: true,
            errorMessage: true,
            checkedAt: true,
          },
        },
        alerts: {
          orderBy: { createdAt: 'desc' },
          take: RECENT_ALERT_LIMIT,
          select: {
            id: true,
            channel: true,
            status: true,
            message: true,
            deliveryAttempts: true,
            lastDeliveredAt: true,
            lastSuppressedAt: true,
            deliveryError: true,
            createdAt: true,
            resolvedAt: true,
          },
        },
      },
    });

    if (!monitor) {
      throw new NotFoundException(`Monitor with ID "${id}" not found`);
    }

    if (monitor.project.userId !== userId) {
      throw new ForbiddenException('You do not have access to this monitor');
    }

    return this.serializeMonitorWithInsights(monitor);
  }

  async togglePause(userId: string, id: string, pause: boolean) {
    const monitor = await this.prisma.monitor.findUnique({
      where: { id },
      include: {
        project: {
          select: { userId: true },
        },
      },
    });

    if (!monitor) {
      throw new NotFoundException(`Monitor with ID "${id}" not found`);
    }

    if (monitor.project.userId !== userId) {
      throw new ForbiddenException('You do not have access to this monitor');
    }

    if (!pause) {
      await this.subscriptionAccessService.assertCanRunMonitoring(userId);
    }

    this.logger.log(`${pause ? 'Pausing' : 'Resuming'} monitor ${id}`);
    return this.prisma.monitor.update({
      where: { id },
      data: {
        status: pause ? MonitorStatus.PAUSED : MonitorStatus.UP,
        isActive: !pause,
        pausedByBilling: false,
      },
    });
  }

  async deleteMonitor(userId: string, id: string) {
    const monitor = await this.prisma.monitor.findUnique({
      where: { id },
      include: { project: { select: { userId: true } } },
    });

    if (!monitor) {
      throw new NotFoundException(`Monitor with ID "${id}" not found`);
    }

    if (monitor.project.userId !== userId) {
      throw new ForbiddenException('You do not have access to delete this monitor');
    }

    if (monitor.status !== MonitorStatus.PAUSED) {
      throw new BadRequestException('Monitor must be PAUSED before it can be deleted.');
    }

    this.logger.log(`Deleting monitor ${id}`);
    await this.prisma.monitor.delete({ where: { id } });
    return { success: true };
  }

  private async verifyProjectOwnership(projectId: string, userId: string): Promise<void> {
    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
      select: { userId: true },
    });

    if (!project) {
      throw new NotFoundException(`Project with ID "${projectId}" not found`);
    }

    if (project.userId !== userId) {
      throw new ForbiddenException('You do not have access to this project');
    }
  }

  private serializeMonitorWithInsights(
    monitor: {
      project?: { userId: string };
      serviceName?: string | null;
      featureName?: string | null;
      customerJourney?: string | null;
      teamOwner?: string | null;
      region?: string | null;
      businessCriticality?: string;
      slaTier?: string;
      checkResults: Array<{
        id: string;
        status: CheckStatus;
        statusCode: number | null;
        responseTimeMs: number | null;
        errorMessage: string | null;
        checkedAt: Date;
      }>;
      alerts: Array<{
        id: string;
        channel: string;
        status: AlertStatus;
        message: string;
        deliveryAttempts: number;
        lastDeliveredAt: Date | null;
        lastSuppressedAt: Date | null;
        deliveryError: string | null;
        createdAt: Date;
        resolvedAt: Date | null;
      }>;
      [key: string]: unknown;
    },
  ) {
    const { project: _project, checkResults, alerts, ...monitorData } = monitor;
    const latestCheck = checkResults[0];
    const successfulChecks = checkResults.filter((check) => check.status === CheckStatus.SUCCESS);
    const responseSamples = checkResults
      .map((check) => check.responseTimeMs)
      .filter((value): value is number => typeof value === 'number' && value > 0);
    const latestAlert = alerts[0] ?? null;

    return {
      ...monitorData,
      impactMetadata: {
        serviceName: monitor.serviceName ?? null,
        featureName: monitor.featureName ?? null,
        customerJourney: monitor.customerJourney ?? null,
        teamOwner: monitor.teamOwner ?? null,
        region: monitor.region ?? null,
        businessCriticality: monitor.businessCriticality ?? 'MEDIUM',
        slaTier: monitor.slaTier ?? 'STANDARD',
      },
      avgResponseTimeMs: responseSamples.length
        ? Math.round(responseSamples.reduce((total, value) => total + value, 0) / responseSamples.length)
        : null,
      latestResponseTimeMs:
        typeof latestCheck?.responseTimeMs === 'number' ? latestCheck.responseTimeMs : null,
      uptimePercentage: checkResults.length
        ? Number(((successfulChecks.length / checkResults.length) * 100).toFixed(1))
        : null,
      recentChecksCount: checkResults.length,
      successfulChecksCount: successfulChecks.length,
      latestStatusCode: latestCheck?.statusCode ?? null,
      lastErrorMessage: latestCheck?.errorMessage ?? null,
      hasActiveAlert: alerts.some((alert) => alert.status !== AlertStatus.RESOLVED),
      latestAlert: latestAlert
        ? {
            id: latestAlert.id,
            channel: latestAlert.channel,
            status: latestAlert.status,
            message: latestAlert.message,
            deliveryAttempts: latestAlert.deliveryAttempts,
            lastDeliveredAt: latestAlert.lastDeliveredAt,
            lastSuppressedAt: latestAlert.lastSuppressedAt,
            deliveryError: latestAlert.deliveryError,
            createdAt: latestAlert.createdAt,
            resolvedAt: latestAlert.resolvedAt,
          }
        : null,
      recentAlerts: alerts,
    };
  }
}
