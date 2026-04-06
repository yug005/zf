import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SubscriptionPlan, SubscriptionStatus } from '@prisma/client';
import { NotificationService } from '../../engine/alerts/notification.service.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import { isAdminEmail } from '../../common/admin/admin.utils.js';
import {
  ManualAccessService,
  ResolvedAccessWithSource,
} from './manual-access.service.js';
import { PLAN_LIMITS, UNBOUNDED_USAGE_LIMIT } from './constants.js';

const TRIAL_DURATION_DAYS = 14;

type AccessUser = {
  id: string;
  email: string;
  trialStartAt: Date;
  trialEndAt: Date;
  subscriptionPlan: SubscriptionPlan;
  subscriptionStatus: SubscriptionStatus;
  monitorLimit: number;
};

export type ResolvedBillingAccess = ResolvedAccessWithSource;

@Injectable()
export class SubscriptionAccessService {
  private readonly logger = new Logger(SubscriptionAccessService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
    private readonly notificationService: NotificationService,
    private readonly manualAccessService: ManualAccessService,
  ) {}

  buildTrialWindow(referenceTime = new Date()) {
    return {
      trialStartAt: referenceTime,
      trialEndAt: new Date(referenceTime.getTime() + TRIAL_DURATION_DAYS * 24 * 60 * 60 * 1000),
    };
  }

  async expireTrials(referenceTime = new Date()): Promise<number> {
    const candidates = await this.prisma.user.findMany({
      where: {
        subscriptionStatus: SubscriptionStatus.TRIALING,
        trialEndAt: { lte: referenceTime },
      },
      select: {
        id: true,
        email: true,
        trialStartAt: true,
        trialEndAt: true,
        subscriptionPlan: true,
        monitorLimit: true,
      },
    });

    const expirableUsers = candidates.filter(
      (user) => !isAdminEmail(user.email, this.configService.get<string>('ADMIN_EMAIL')),
    );

    let expiredCount = 0;
    for (const user of expirableUsers) {
      const expired = await this.expireTrialUser(user);
      if (expired) {
        expiredCount += 1;
      }
    }

    if (expiredCount > 0) {
      this.logger.log(`Expired ${expiredCount} trial account(s).`);
    }

    return expiredCount;
  }

  async syncUserStateById(userId: string): Promise<ResolvedBillingAccess> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        trialStartAt: true,
        trialEndAt: true,
        subscriptionPlan: true,
        subscriptionStatus: true,
        monitorLimit: true,
      },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    const normalizedUser = await this.normalizeUserState(user);
    return this.manualAccessService.resolveAccessForUser(normalizedUser);
  }

  async refreshStoredLimits(userId: string, subscriptionPlan: SubscriptionPlan): Promise<void> {
    const limits = PLAN_LIMITS[subscriptionPlan];
    await this.prisma.user.update({
      where: { id: userId },
      data: {
        subscriptionPlan,
        monitorLimit: limits.maxMonitors,
      },
    });
  }

  async markMonitoringPausedForUser(userId: string): Promise<void> {
    await this.pauseMonitoringForUsers([userId]);
  }

  async restoreMonitoringForUser(userId: string): Promise<void> {
    const monitors = await this.prisma.monitor.findMany({
      where: {
        project: { userId },
        pausedByBilling: true,
      },
      select: { id: true },
    });

    if (monitors.length === 0) {
      return;
    }

    await this.prisma.monitor.updateMany({
      where: { id: { in: monitors.map((monitor) => monitor.id) } },
      data: {
        isActive: true,
        pausedByBilling: false,
        status: 'UP',
        lastCheckedAt: null,
      },
    });
  }

  async assertCanCreateMonitors(userId: string): Promise<ResolvedBillingAccess> {
    const access = await this.syncUserStateById(userId);

    if (!access.canCreateMonitors) {
      throw new ForbiddenException(
        access.subscriptionStatus === SubscriptionStatus.EXPIRED
          ? 'Your 14-day trial has expired. Upgrade to create new monitors.'
          : 'Your subscription is inactive. Upgrade to create new monitors.',
      );
    }

    return access;
  }

  async assertCanRunMonitoring(userId: string): Promise<ResolvedBillingAccess> {
    const access = await this.syncUserStateById(userId);

    if (!access.hasMonitoringAccess) {
      throw new ForbiddenException(
        'Monitoring is paused because your trial or subscription is inactive. Upgrade to resume checks.',
      );
    }

    return access;
  }

  private async normalizeUserState(user: AccessUser): Promise<AccessUser> {
    const isAdmin = isAdminEmail(user.email, this.configService.get<string>('ADMIN_EMAIL'));
    if (isAdmin) {
      return user;
    }

    if (
      user.subscriptionStatus === SubscriptionStatus.TRIALING &&
      user.trialEndAt.getTime() <= Date.now()
    ) {
      const updated = await this.expireTrialUser(user);
      if (updated) {
        return updated;
      }

      return {
        ...user,
        subscriptionStatus: SubscriptionStatus.EXPIRED,
      };
    }

    return user;
  }

  private async pauseMonitoringForUsers(userIds: string[]): Promise<void> {
    if (userIds.length === 0) {
      return;
    }

    const monitors = await this.prisma.monitor.findMany({
      where: {
        project: {
          userId: { in: userIds },
        },
        isActive: true,
        pausedByBilling: false,
      },
      select: { id: true },
    });

    if (monitors.length === 0) {
      return;
    }

    await this.prisma.monitor.updateMany({
      where: { id: { in: monitors.map((monitor) => monitor.id) } },
      data: {
        isActive: false,
        pausedByBilling: true,
        status: 'PAUSED',
      },
    });
  }

  private async expireTrialUser(
    user: Pick<AccessUser, 'id' | 'email' | 'trialStartAt' | 'trialEndAt' | 'subscriptionPlan' | 'monitorLimit'>,
  ): Promise<AccessUser | null> {
    const result = await this.prisma.user.updateMany({
      where: {
        id: user.id,
        subscriptionStatus: SubscriptionStatus.TRIALING,
      },
      data: {
        subscriptionStatus: SubscriptionStatus.EXPIRED,
      },
    });

    if (result.count === 0) {
      return null;
    }

    await this.pauseMonitoringForUsers([user.id]);

    const notificationCreated = await this.createInAppNotificationIfMissing(
      user.id,
      'TRIAL_EXPIRED',
      'Trial expired',
      'Your 14-day trial has ended. Dashboard access stays available, but monitoring is paused until you upgrade.',
    );

    if (notificationCreated) {
      await this.notificationService.sendTrialExpiredEmail(
        user.email,
        user.trialEndAt.toLocaleDateString('en-US', {
          weekday: 'long',
          year: 'numeric',
          month: 'long',
          day: 'numeric',
        }),
      );
    }

    return {
      ...user,
      subscriptionStatus: SubscriptionStatus.EXPIRED,
    };
  }

  private async createInAppNotificationIfMissing(
    userId: string,
    type: string,
    title: string,
    message: string,
    dedupeHours = 72,
  ): Promise<boolean> {
    const existing = await this.prisma.inAppNotification.findFirst({
      where: {
        userId,
        type,
        title,
        createdAt: {
          gte: new Date(Date.now() - dedupeHours * 60 * 60 * 1000),
        },
      },
      select: { id: true },
    });

    if (existing) {
      return false;
    }

    await this.prisma.inAppNotification.create({
      data: {
        userId,
        type,
        title,
        message,
        read: false,
      },
    });

    return true;
  }

  assertMonitorCapacity(currentMonitors: number, access: ResolvedBillingAccess): void {
    if (currentMonitors >= access.monitorLimit) {
      throw new BadRequestException(
        `Monitor limit reached for ${access.subscriptionPlan} plan (${access.monitorLimit} max). Please upgrade to add more.`,
      );
    }
  }

  assertIntervalAllowed(requestedInterval: number, access: ResolvedBillingAccess): void {
    if (requestedInterval < access.minimumIntervalSeconds) {
      throw new BadRequestException(
        `${access.subscriptionPlan} plan supports a minimum check interval of ${access.minimumIntervalSeconds} seconds. Upgrade your plan for faster monitoring.`,
      );
    }
  }
}
