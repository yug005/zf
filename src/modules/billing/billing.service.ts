import {
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
import { PLAN_DEFINITIONS, PLAN_LIMITS, UNBOUNDED_USAGE_LIMIT } from './constants.js';
import { ManualAccessService } from './manual-access.service.js';
import { RazorpayService } from './razorpay.service.js';
import { SubscriptionAccessService } from './subscription-access.service.js';

@Injectable()
export class BillingService {
  private readonly logger = new Logger(BillingService.name);
  private readonly planMappings: Record<string, SubscriptionPlan>;

  constructor(
    private readonly prisma: PrismaService,
    private readonly razorpayService: RazorpayService,
    private readonly configService: ConfigService,
    private readonly subscriptionAccessService: SubscriptionAccessService,
    private readonly notificationService: NotificationService,
    private readonly manualAccessService: ManualAccessService,
  ) {
    this.planMappings = {
      [this.configService.get<string>('RAZORPAY_PLAN_ID_LITE') || 'plan_lite']:
        SubscriptionPlan.LITE,
      [this.configService.get<string>('RAZORPAY_PLAN_ID_PRO') || 'plan_pro']:
        SubscriptionPlan.PRO,
      [this.configService.get<string>('RAZORPAY_PLAN_ID_BUSINESS') || 'plan_business']:
        SubscriptionPlan.BUSINESS,
    };
  }

  async getPlans() {
    const litePlanId = this.configService.get<string>('RAZORPAY_PLAN_ID_LITE') || 'plan_lite';
    const proPlanId = this.configService.get<string>('RAZORPAY_PLAN_ID_PRO') || 'plan_pro';
    const businessPlanId =
      this.configService.get<string>('RAZORPAY_PLAN_ID_BUSINESS') || 'plan_business';

    return [
      {
        id: 'trial',
        name: PLAN_DEFINITIONS[SubscriptionPlan.TRIAL].name,
        price: PLAN_DEFINITIONS[SubscriptionPlan.TRIAL].price,
        currency: PLAN_DEFINITIONS[SubscriptionPlan.TRIAL].currency,
        highlight: PLAN_DEFINITIONS[SubscriptionPlan.TRIAL].highlight,
        limits: PLAN_LIMITS[SubscriptionPlan.TRIAL],
      },
      {
        id: litePlanId,
        name: PLAN_DEFINITIONS[SubscriptionPlan.LITE].name,
        price: PLAN_DEFINITIONS[SubscriptionPlan.LITE].price,
        currency: PLAN_DEFINITIONS[SubscriptionPlan.LITE].currency,
        highlight: PLAN_DEFINITIONS[SubscriptionPlan.LITE].highlight,
        limits: PLAN_LIMITS[SubscriptionPlan.LITE],
      },
      {
        id: proPlanId,
        name: PLAN_DEFINITIONS[SubscriptionPlan.PRO].name,
        price: PLAN_DEFINITIONS[SubscriptionPlan.PRO].price,
        currency: PLAN_DEFINITIONS[SubscriptionPlan.PRO].currency,
        highlight: PLAN_DEFINITIONS[SubscriptionPlan.PRO].highlight,
        limits: PLAN_LIMITS[SubscriptionPlan.PRO],
      },
      {
        id: businessPlanId,
        name: PLAN_DEFINITIONS[SubscriptionPlan.BUSINESS].name,
        price: PLAN_DEFINITIONS[SubscriptionPlan.BUSINESS].price,
        currency: PLAN_DEFINITIONS[SubscriptionPlan.BUSINESS].currency,
        highlight: PLAN_DEFINITIONS[SubscriptionPlan.BUSINESS].highlight,
        limits: PLAN_LIMITS[SubscriptionPlan.BUSINESS],
      },
    ];
  }

  async getSubscriptionDetails(userId: string) {
    const access = await this.subscriptionAccessService.syncUserStateById(userId);
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        email: true,
        subscriptionPlan: true,
        subscriptionId: true,
        subscriptionStatus: true,
        trialStartAt: true,
        trialEndAt: true,
        monitorLimit: true,
        projects: {
          select: {
            _count: { select: { monitors: true } },
          },
        },
      },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    const activeApiKeys = await this.prisma.apiKey.count({
      where: { userId, revokedAt: null },
    });

    const totalMonitors = user.projects.reduce((acc, project) => acc + project._count.monitors, 0);
    const isAdmin = isAdminEmail(user.email, this.configService.get<string>('ADMIN_EMAIL'));
    const limits = isAdmin
      ? {
          maxMonitors: UNBOUNDED_USAGE_LIMIT,
          maxApiKeys: UNBOUNDED_USAGE_LIMIT,
          minIntervalSeconds: 10,
        }
      : PLAN_LIMITS[user.subscriptionPlan];

    const payg =
      access.subscriptionPlan === SubscriptionPlan.ENTERPRISE &&
      access.enterpriseAccessMode === 'PAYG'
        ? await this.manualAccessService.getPaygEstimateForEmail(user.email)
        : null;

    return {
      plan: access.subscriptionPlan,
      status: access.subscriptionStatus,
      accessSource: access.accessSource,
      accessReason: access.accessReason,
      enterpriseAccessMode: access.enterpriseAccessMode,
      trialStartAt: user.trialStartAt,
      trialEndAt: user.trialEndAt,
      daysRemainingInTrial: access.daysRemainingInTrial,
      usage: {
        monitorsUsed: totalMonitors,
        monitorsLimit: access.monitorLimit,
        apiKeysUsed: activeApiKeys,
        apiKeysLimit: limits.maxApiKeys,
        minimumIntervalSeconds: limits.minIntervalSeconds,
      },
      hasActiveSubscription: access.subscriptionStatus === SubscriptionStatus.ACTIVE,
      hasMonitoringAccess: access.hasMonitoringAccess,
      canCreateMonitors: access.canCreateMonitors,
      currentSubscriptionId: user.subscriptionId,
      scheduledGrant: access.grantMetadata.scheduledGrant,
      activeGrant: access.grantMetadata.activeGrant,
      paygEstimate: payg?.currentEstimate ?? null,
    };
  }

  async getRazorpayWebhookLogs(
    userEmail: string,
    options?: {
      page?: string;
      limit?: string;
      processed?: string;
      signatureValid?: string;
      eventType?: string;
      search?: string;
    },
  ) {
    if (!isAdminEmail(userEmail, this.configService.get<string>('ADMIN_EMAIL'))) {
      throw new ForbiddenException('Webhook logs are only available to the admin account.');
    }

    const take = Math.min(Math.max(Number.parseInt(options?.limit || '25', 10) || 25, 1), 100);
    const page = Math.max(Number.parseInt(options?.page || '1', 10) || 1, 1);
    const processedFilter = this.parseBooleanQuery(options?.processed);
    const signatureValidFilter = this.parseBooleanQuery(options?.signatureValid);
    const eventTypeFilter = options?.eventType?.trim();
    const searchFilter = options?.search?.trim();

    const where = {
      provider: 'RAZORPAY',
      ...(typeof processedFilter === 'boolean' ? { processed: processedFilter } : {}),
      ...(typeof signatureValidFilter === 'boolean'
        ? { signatureValid: signatureValidFilter }
        : {}),
      ...(eventTypeFilter
        ? { eventType: { contains: eventTypeFilter, mode: 'insensitive' as const } }
        : {}),
      ...(searchFilter
        ? {
            OR: [
              { externalId: { contains: searchFilter, mode: 'insensitive' as const } },
              { errorMessage: { contains: searchFilter, mode: 'insensitive' as const } },
              { eventType: { contains: searchFilter, mode: 'insensitive' as const } },
            ],
          }
        : {}),
    };

    const [items, totalItems, processedCount, failedCount, invalidSignatureCount] =
      await this.prisma.$transaction([
      this.prisma.webhookEventLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * take,
        take,
        select: {
          id: true,
          eventType: true,
          externalId: true,
          signatureValid: true,
          processed: true,
          processedAt: true,
          errorMessage: true,
          createdAt: true,
        },
      }),
      this.prisma.webhookEventLog.count({ where }),
      this.prisma.webhookEventLog.count({
        where: {
          ...where,
          processed: true,
        },
      }),
      this.prisma.webhookEventLog.count({
        where: {
          ...where,
          processed: false,
        },
      }),
      this.prisma.webhookEventLog.count({
        where: {
          ...where,
          signatureValid: false,
        },
      }),
    ]);

    return {
      items,
      page,
      limit: take,
      totalItems,
      totalPages: Math.max(1, Math.ceil(totalItems / take)),
      summary: {
        total: totalItems,
        processed: processedCount,
        failed: failedCount,
        invalidSignature: invalidSignatureCount,
      },
    };
  }

  async createSubscriptionCheckout(userId: string, planId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        name: true,
        razorpayCustomerId: true,
        subscriptionId: true,
        subscriptionStatus: true,
      },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    if (isAdminEmail(user.email, this.configService.get<string>('ADMIN_EMAIL'))) {
      throw new ForbiddenException('Billing checkout is disabled for the admin account.');
    }

    const mappedPlan = this.planMappings[planId];
    if (!mappedPlan) {
      throw new ForbiddenException('Unsupported plan selection.');
    }

    let customerId = user.razorpayCustomerId;
    if (!customerId) {
      customerId = await this.razorpayService.getOrCreateCustomer(user.email, user.name || '');
      await this.prisma.user.update({
        where: { id: user.id },
        data: { razorpayCustomerId: customerId },
      });
    }

    if (user.subscriptionId && user.subscriptionStatus === SubscriptionStatus.ACTIVE) {
      await this.razorpayService.cancelSubscription(user.subscriptionId);
    }

    const subscription = await this.razorpayService.createSubscription(customerId, planId);

    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        subscriptionId: subscription.id,
      },
    });

    return {
      subscriptionId: subscription.id,
      paymentLink: subscription.short_url,
    };
  }

  async cancelActiveSubscription(userId: string): Promise<{ success: boolean }> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        subscriptionPlan: true,
        subscriptionId: true,
        subscriptionStatus: true,
      },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    if (!user.subscriptionId || user.subscriptionStatus !== SubscriptionStatus.ACTIVE) {
      throw new ForbiddenException('No active subscription to cancel.');
    }

    try {
      await this.razorpayService.cancelSubscription(user.subscriptionId);
    } catch (error) {
      this.logger.warn(
        `Failed to cancel remote Razorpay subscription for ${userId}: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    }

    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        subscriptionStatus: SubscriptionStatus.CANCELLED,
      },
    });
    await this.subscriptionAccessService.markMonitoringPausedForUser(user.id);
    await this.createInAppNotificationIfMissing(
      user.id,
      'SUBSCRIPTION_CANCELLED',
      'Subscription cancelled',
      'Your paid plan has been cancelled. Dashboard access remains available, but monitoring is paused until you reactivate a plan.',
      24,
    );
    await this.notificationService.sendSubscriptionCancelledEmail(
      user.email,
      PLAN_DEFINITIONS[user.subscriptionPlan].name,
    );

    return { success: true };
  }

  async processWebhook(event: string, payload: Record<string, any>): Promise<void> {
    this.logger.debug(`Processing webhook event: ${event}`);

    switch (event) {
      case 'subscription.activated':
      case 'subscription.charged':
        await this.handleSubscriptionActivated(payload);
        break;
      case 'subscription.pending':
        await this.handleSubscriptionPending(payload);
        break;
      case 'subscription.cancelled':
        await this.handleSubscriptionCancelled(payload);
        break;
      case 'subscription.halted':
        await this.handleSubscriptionHalted(payload);
        break;
      default:
        this.logger.debug(`Unhandled webhook event: ${event}`);
    }
  }

  private async handleSubscriptionActivated(payload: Record<string, any>) {
    const subscription = payload?.subscription?.entity;
    if (!subscription) {
      return;
    }

    const subscriptionPlan = this.planMappings[subscription.plan_id] || SubscriptionPlan.PRO;
    const limits = PLAN_LIMITS[subscriptionPlan];
    const users = await this.prisma.user.findMany({
      where: { subscriptionId: subscription.id },
      select: {
        id: true,
        email: true,
        subscriptionPlan: true,
        subscriptionStatus: true,
      },
    });

    if (users.length === 0) {
      return;
    }

    await this.prisma.user.updateMany({
      where: { id: { in: users.map((user) => user.id) } },
      data: {
        subscriptionPlan,
        subscriptionStatus: SubscriptionStatus.ACTIVE,
        monitorLimit: limits.maxMonitors,
      },
    });

    await Promise.all(
      users.map(async (user) => {
        await this.subscriptionAccessService.restoreMonitoringForUser(user.id);

        const shouldNotify =
          user.subscriptionStatus !== SubscriptionStatus.ACTIVE ||
          user.subscriptionPlan !== subscriptionPlan;

        if (!shouldNotify) {
          return;
        }

        await this.createInAppNotificationIfMissing(
          user.id,
          'SUBSCRIPTION_ACTIVATED',
          `${PLAN_DEFINITIONS[subscriptionPlan].name} plan active`,
          `Your ${PLAN_DEFINITIONS[subscriptionPlan].name} subscription is active and monitoring has resumed.`,
          24,
        );
        await this.notificationService.sendSubscriptionActivatedEmail(
          user.email,
          PLAN_DEFINITIONS[subscriptionPlan].name,
        );
      }),
    );

    this.logger.log(`Subscription ${subscription.id} activated. Plan: ${subscriptionPlan}`);
  }

  private async handleSubscriptionCancelled(payload: Record<string, any>) {
    const subscription = payload?.subscription?.entity;
    if (!subscription) {
      return;
    }

    const users = await this.prisma.user.findMany({
      where: { subscriptionId: subscription.id },
      select: {
        id: true,
        email: true,
        subscriptionPlan: true,
        subscriptionStatus: true,
      },
    });

    if (users.length === 0) {
      return;
    }

    await this.prisma.user.updateMany({
      where: { id: { in: users.map((user) => user.id) } },
      data: {
        subscriptionStatus: SubscriptionStatus.CANCELLED,
      },
    });

    await Promise.all(
      users.map(async (user) => {
        await this.subscriptionAccessService.markMonitoringPausedForUser(user.id);

        if (user.subscriptionStatus === SubscriptionStatus.CANCELLED) {
          return;
        }

        await this.createInAppNotificationIfMissing(
          user.id,
          'SUBSCRIPTION_CANCELLED',
          'Subscription cancelled',
          'Your paid plan has been cancelled. Monitoring is paused until you reactivate a plan.',
          24,
        );
        await this.notificationService.sendSubscriptionCancelledEmail(
          user.email,
          PLAN_DEFINITIONS[user.subscriptionPlan].name,
        );
      }),
    );

    this.logger.log(`Subscription ${subscription.id} cancelled.`);
  }

  private async handleSubscriptionPending(payload: Record<string, any>) {
    const subscription = payload?.subscription?.entity;
    if (!subscription) {
      return;
    }

    const users = await this.prisma.user.findMany({
      where: { subscriptionId: subscription.id },
      select: {
        id: true,
        email: true,
        subscriptionPlan: true,
      },
    });

    if (users.length === 0) {
      return;
    }

    const retryDate = subscription.current_end
      ? new Date(subscription.current_end * 1000).toLocaleDateString('en-US', {
          weekday: 'long',
          year: 'numeric',
          month: 'long',
          day: 'numeric',
        })
      : undefined;

    await Promise.all(
      users.map(async (user) => {
        const created = await this.createInAppNotificationIfMissing(
          user.id,
          'PAYMENT_FAILED',
          'Payment issue on renewal',
          retryDate
            ? `A renewal charge failed. Please update billing before ${retryDate} to avoid interruption.`
            : 'A renewal charge failed. Please update billing to avoid interruption.',
          24,
        );

        if (!created) {
          return;
        }

        await this.notificationService.sendPaymentFailureEmail(
          user.email,
          PLAN_DEFINITIONS[user.subscriptionPlan].name,
          retryDate,
          false,
        );
      }),
    );

    this.logger.warn(`Subscription ${subscription.id} entered pending after a failed renewal.`);
  }

  private async handleSubscriptionHalted(payload: Record<string, any>) {
    const subscription = payload?.subscription?.entity;
    if (!subscription) {
      return;
    }

    const users = await this.prisma.user.findMany({
      where: { subscriptionId: subscription.id },
      select: {
        id: true,
        email: true,
        subscriptionPlan: true,
        subscriptionStatus: true,
      },
    });

    if (users.length === 0) {
      return;
    }

    await this.prisma.user.updateMany({
      where: { id: { in: users.map((user) => user.id) } },
      data: {
        subscriptionStatus: SubscriptionStatus.CANCELLED,
      },
    });

    await Promise.all(
      users.map(async (user) => {
        await this.subscriptionAccessService.markMonitoringPausedForUser(user.id);

        const created = await this.createInAppNotificationIfMissing(
          user.id,
          'PAYMENT_FAILED_FINAL',
          'Renewal failed and monitoring paused',
          'We could not renew your plan after repeated attempts. Monitoring is paused until billing is fixed.',
          48,
        );

        if (!created && user.subscriptionStatus === SubscriptionStatus.CANCELLED) {
          return;
        }

        await this.notificationService.sendPaymentFailureEmail(
          user.email,
          PLAN_DEFINITIONS[user.subscriptionPlan].name,
          undefined,
          true,
        );
      }),
    );

    this.logger.warn(`Subscription ${subscription.id} halted after failed renewals.`);
  }

  private async createInAppNotificationIfMissing(
    userId: string,
    type: string,
    title: string,
    message: string,
    dedupeHours: number,
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

  private parseBooleanQuery(value?: string): boolean | undefined {
    if (value === undefined || value === '') {
      return undefined;
    }

    if (value === 'true') {
      return true;
    }

    if (value === 'false') {
      return false;
    }

    return undefined;
  }
}
