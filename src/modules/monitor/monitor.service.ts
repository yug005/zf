import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { AlertStatus, CheckStatus, MonitorSecretKind, MonitorStatus } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service.js';
import { CreateMonitorDto } from './dto/create-monitor.dto.js';
import { UpdateMonitorDto } from './dto/update-monitor.dto.js';
import { SubscriptionAccessService } from '../billing/subscription-access.service.js';
import { diagnoseCheck } from '../../engine/check-diagnosis.js';
import {
  maskSensitiveText,
  normalizeAlertConfig,
  normalizeAuthConfig,
  normalizeValidationConfig,
} from './monitor-config.js';
import { MonitorSecretService } from './monitor-secret.service.js';
import { executeHttpCheck } from '../../engine/executors/http.executor.js';
import { TestMonitorConfigDto } from './dto/test-monitor-config.dto.js';

const MONITOR_INSIGHT_SAMPLE_SIZE = 20;
const RECENT_ALERT_LIMIT = 5;

@Injectable()
export class MonitorService {
  private readonly logger = new Logger(MonitorService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly subscriptionAccessService: SubscriptionAccessService,
    private readonly monitorSecretService: MonitorSecretService,
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

    const authConfig = await this.prepareAuthConfig(userId, normalizeAuthConfig(dto.authConfig));
    const validationConfig =
      normalizeValidationConfig(dto.validationConfig) ??
      normalizeValidationConfig({
        expectedStatus: dto.expectedStatus,
        keyword:
          dto.body && typeof dto.body === 'object' && !Array.isArray(dto.body) && 'keywordConfig' in dto.body
            ? (dto.body as Record<string, unknown>).keywordConfig as any
            : undefined,
      });
    const alertConfig = normalizeAlertConfig(dto.alertConfig);

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
        authConfig: authConfig as never,
        validationConfig: validationConfig as never,
        alertConfig: alertConfig as never,
        probeRegions: (dto.probeRegions?.length ? dto.probeRegions : ['default']) as never,
        status: MonitorStatus.UP,
        isActive: true,
        pausedByBilling: false,
        failureThreshold: alertConfig?.failureThreshold ?? 3,
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

    const existingValidationConfig = (monitor.validationConfig as Record<string, unknown> | null) ?? null;
    const existingAlertConfig = (monitor.alertConfig as Record<string, unknown> | null) ?? null;
    const nextValidationConfig =
      dto.validationConfig !== undefined
        ? normalizeValidationConfig(dto.validationConfig as any)
        : existingValidationConfig;
    const nextAlertConfig =
      dto.alertConfig !== undefined ? normalizeAlertConfig(dto.alertConfig) : existingAlertConfig;
    const nextAuthConfig =
      dto.authConfig !== undefined
        ? await this.prepareAuthConfig(userId, normalizeAuthConfig(dto.authConfig as any))
        : undefined;

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
        authConfig: nextAuthConfig as any,
        validationConfig: nextValidationConfig as any,
        alertConfig: nextAlertConfig as any,
        probeRegions: dto.probeRegions !== undefined ? (dto.probeRegions as any) : undefined,
        failureThreshold:
          nextAlertConfig && typeof nextAlertConfig === 'object' && 'failureThreshold' in nextAlertConfig
            ? ((nextAlertConfig as Record<string, unknown>).failureThreshold as number | undefined)
            : undefined,
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
            body: true,
            metadata: true,
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
            deliveries: {
              select: {
                id: true,
                channel: true,
                status: true,
                recipient: true,
                deliveryAttempts: true,
                deliveredAt: true,
                errorMessage: true,
              },
            },
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
            body: true,
            metadata: true,
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
            deliveries: {
              select: {
                id: true,
                channel: true,
                status: true,
                recipient: true,
                deliveryAttempts: true,
                deliveredAt: true,
                errorMessage: true,
              },
            },
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

  async testConfiguration(userId: string, dto: TestMonitorConfigDto) {
    const authConfig = await this.buildResolvedTestAuthConfig(userId, dto.authConfig as any);
    const result = await executeHttpCheck({
      monitorId: 'preview',
      type: 'HTTP',
      url: dto.url,
      method: dto.httpMethod ?? 'GET',
      headers: dto.headers ?? {},
      body: dto.body,
      validationConfig: dto.validationConfig as any,
      keywordConfig: dto.validationConfig?.keyword as any,
      authConfig: authConfig ?? undefined,
      timeoutMs: dto.timeoutMs ?? 10000,
      expectedStatus: dto.validationConfig?.expectedStatus,
      retries: 0,
      region: 'preview',
    });

    return {
      success: result.success,
      statusCode: result.statusCode ?? null,
      responseTimeMs: result.responseTimeMs,
      errorMessage: result.errorMessage ?? null,
      metadata: result.metadata
        ? {
            ...result.metadata,
            responseSnippet:
              typeof result.metadata.responseSnippet === 'string'
                ? maskSensitiveText(result.metadata.responseSnippet)
                : result.metadata.responseSnippet,
          }
        : null,
    };
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
      authConfig?: any;
      validationConfig?: any;
      alertConfig?: any;
      probeRegions?: unknown;
      checkResults: Array<{
        id: string;
        status: CheckStatus;
        statusCode: number | null;
        responseTimeMs: number | null;
        errorMessage: string | null;
        checkedAt: Date;
        body?: string | null;
        metadata?: any;
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
        deliveries?: Array<{
          id: string;
          channel: string;
          status: string;
          recipient: string | null;
          deliveryAttempts: number;
          deliveredAt: Date | null;
          errorMessage: string | null;
        }>;
      }>;
      [key: string]: unknown;
    },
  ) {
    const { project: _project, checkResults, alerts, ...monitorData } = monitor;
    const latestCheck = checkResults[0];
    const latestDiagnosis = latestCheck
      ? diagnoseCheck({
          status: latestCheck.status,
          statusCode: latestCheck.statusCode,
          errorMessage: latestCheck.errorMessage,
        })
      : null;
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
      latestResponseSnippet: latestCheck?.body ?? null,
      latestCheckMetadata: latestCheck?.metadata ?? null,
      latestDiagnosis,
      authConfig: monitor.authConfig ?? null,
      validationConfig: monitor.validationConfig ?? null,
      alertConfig: monitor.alertConfig ?? null,
      probeRegions: Array.isArray(monitor.probeRegions) ? monitor.probeRegions : ['default'],
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
            deliveries: latestAlert.deliveries ?? [],
          }
        : null,
      recentAlerts: alerts,
    };
  }

  private async prepareAuthConfig(userId: string, authConfig: ReturnType<typeof normalizeAuthConfig>) {
    if (!authConfig) {
      return null;
    }

    const nextConfig: Record<string, unknown> = { ...authConfig };

    if (authConfig.secretValue) {
      const secret = await this.monitorSecretService.createSecret(
        userId,
        `monitor-${authConfig.type.toLowerCase()}-secret`,
        authConfig.secretValue,
        authConfig.type === 'API_KEY' ? MonitorSecretKind.API_KEY : MonitorSecretKind.TOKEN,
      );
      nextConfig.secretId = secret.id;
      delete nextConfig.secretValue;
    }

    if (authConfig.username) {
      const secret = await this.monitorSecretService.createSecret(
        userId,
        'monitor-basic-username',
        authConfig.username,
        MonitorSecretKind.BASIC_USERNAME,
      );
      nextConfig.usernameSecretId = secret.id;
      delete nextConfig.username;
    }

    if (authConfig.password) {
      const secret = await this.monitorSecretService.createSecret(
        userId,
        'monitor-basic-password',
        authConfig.password,
        MonitorSecretKind.BASIC_PASSWORD,
      );
      nextConfig.passwordSecretId = secret.id;
      delete nextConfig.password;
    }

    return nextConfig;
  }

  private async buildResolvedTestAuthConfig(userId: string, authConfig?: Record<string, any> | null) {
    if (!authConfig?.type || authConfig.type === 'NONE') {
      return undefined;
    }

    if (authConfig.type === 'BASIC') {
      return {
        type: 'BASIC' as const,
        username:
          authConfig.username ??
          (await this.monitorSecretService.resolveSecretValue(userId, authConfig.usernameSecretId)) ??
          undefined,
        password:
          authConfig.password ??
          (await this.monitorSecretService.resolveSecretValue(userId, authConfig.passwordSecretId)) ??
          undefined,
      };
    }

    if (authConfig.type === 'MULTI_STEP') {
      return {
        type: 'MULTI_STEP' as const,
        headerName: authConfig.headerName,
        multiStep: authConfig.multiStep,
      };
    }

    return {
      type: authConfig.type,
      headerName: authConfig.headerName,
      secretValue:
        authConfig.secretValue ??
        (await this.monitorSecretService.resolveSecretValue(userId, authConfig.secretId)) ??
        undefined,
    };
  }
}
