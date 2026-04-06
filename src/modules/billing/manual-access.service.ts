import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  Prisma,
  SubscriptionPlan,
  SubscriptionStatus,
} from '@prisma/client';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../../prisma/prisma.service.js';
import { isAdminEmail } from '../../common/admin/admin.utils.js';
import { NotificationService as AlertNotificationService } from '../../engine/alerts/notification.service.js';
import { NotificationService as InAppNotificationService } from '../notifications/notification.service.js';
import {
  calculateEnterprisePaygAmountInr,
  ENTERPRISE_PAYG_RATES,
  PLAN_LIMITS,
  UNBOUNDED_USAGE_LIMIT,
} from './constants.js';

type BaseAccessUser = {
  id: string;
  email: string;
  trialStartAt: Date;
  trialEndAt: Date;
  subscriptionPlan: SubscriptionPlan;
  subscriptionStatus: SubscriptionStatus;
  monitorLimit: number;
  isActive?: boolean;
  archivedAt?: Date | null;
};

export const GrantLifecycleStatus = {
  PENDING: 'PENDING',
  SCHEDULED: 'SCHEDULED',
  ACTIVE: 'ACTIVE',
  EXPIRED: 'EXPIRED',
  REVOKED: 'REVOKED',
  SUPERSEDED: 'SUPERSEDED',
} as const;

export type GrantLifecycleStatus =
  (typeof GrantLifecycleStatus)[keyof typeof GrantLifecycleStatus];

export const GrantActivationMode = {
  OVERRIDE_NOW: 'OVERRIDE_NOW',
  ACTIVATE_AFTER_CURRENT_ACCESS: 'ACTIVATE_AFTER_CURRENT_ACCESS',
} as const;

export type GrantActivationMode =
  (typeof GrantActivationMode)[keyof typeof GrantActivationMode];

export const EnterpriseAccessMode = {
  STANDARD: 'STANDARD',
  PAYG: 'PAYG',
} as const;

export type EnterpriseAccessMode =
  (typeof EnterpriseAccessMode)[keyof typeof EnterpriseAccessMode];

export type GrantSummary = {
  id: string;
  email: string;
  userId: string | null;
  plan: SubscriptionPlan;
  enterpriseAccessMode: EnterpriseAccessMode | null;
  lifecycleStatus: GrantLifecycleStatus;
  activationMode: GrantActivationMode;
  startAt: Date;
  endAt: Date | null;
  activatedAt: Date | null;
  actorEmail: string;
  note: string | null;
  reason: string | null;
  createdAt: Date;
  updatedAt: Date;
};

export type ResolvedAccessSource =
  | 'ADMIN_EMAIL'
  | 'MANUAL_GRANT_ACTIVE'
  | 'MANUAL_GRANT_SCHEDULED'
  | 'PAID_SUBSCRIPTION'
  | 'TRIAL'
  | 'INACTIVE';

export type ResolvedAccessGrantMetadata = {
  activeGrant: GrantSummary | null;
  scheduledGrant: GrantSummary | null;
  availableGrants: GrantSummary[];
};

export type ResolvedAccessWithSource = {
  userId: string;
  isAdmin: boolean;
  subscriptionPlan: SubscriptionPlan;
  subscriptionStatus: SubscriptionStatus;
  trialStartAt: Date;
  trialEndAt: Date;
  monitorLimit: number;
  hasMonitoringAccess: boolean;
  canCreateMonitors: boolean;
  daysRemainingInTrial: number;
  minimumIntervalSeconds: number;
  apiKeyLimit: number;
  accessSource: ResolvedAccessSource;
  accessReason: string;
  enterpriseAccessMode: EnterpriseAccessMode | null;
  grantMetadata: ResolvedAccessGrantMetadata;
};

export type CreateAdminGrantInput = {
  email: string;
  plan: SubscriptionPlan;
  enterpriseAccessMode?: EnterpriseAccessMode | null;
  activationMode: GrantActivationMode;
  startAt?: Date;
  endAt?: Date | null;
  note?: string;
  reason?: string;
};

type AdminActor = {
  id: string;
  email: string;
};

const ADMIN_GRANT_SELECT = {
  id: true,
  email: true,
  userId: true,
  plan: true,
  enterpriseAccessMode: true,
  lifecycleStatus: true,
  activationMode: true,
  startAt: true,
  endAt: true,
  activatedAt: true,
  actorEmail: true,
  note: true,
  reason: true,
  createdAt: true,
  updatedAt: true,
};

@Injectable()
export class ManualAccessService {
  private readonly logger = new Logger(ManualAccessService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
    private readonly alertNotificationService: AlertNotificationService,
    private readonly inAppNotificationService: InAppNotificationService,
  ) {}

  private get db(): any {
    return this.prisma as any;
  }

  async createGrant(actor: AdminActor, input: CreateAdminGrantInput): Promise<GrantSummary> {
    const email = input.email.trim().toLowerCase();
    const user = await this.prisma.user.findUnique({
      where: { email },
      select: { id: true },
    });

    const startAt = await this.resolveGrantStartAt(
      input.activationMode,
      input.startAt ?? new Date(),
      email,
      user?.id,
    );

    if (input.endAt && input.endAt <= startAt) {
      throw new BadRequestException('Grant end date must be later than the start date.');
    }

    const lifecycleStatus = user
      ? startAt <= new Date()
        ? GrantLifecycleStatus.ACTIVE
        : GrantLifecycleStatus.SCHEDULED
      : GrantLifecycleStatus.PENDING;

    if (lifecycleStatus === GrantLifecycleStatus.ACTIVE) {
      await this.supersedeOverlappingActiveGrants(email);
    }

    const grant = await this.db.adminGrant.create({
      data: {
        email,
        userId: user?.id,
        plan: input.plan,
        enterpriseAccessMode:
          input.plan === SubscriptionPlan.ENTERPRISE
            ? input.enterpriseAccessMode || EnterpriseAccessMode.STANDARD
            : null,
        lifecycleStatus,
        activationMode: input.activationMode,
        startAt,
        endAt: input.endAt ?? null,
        activatedAt: lifecycleStatus === GrantLifecycleStatus.ACTIVE ? new Date() : null,
        actorUserId: actor.id,
        actorEmail: actor.email,
        note: input.note?.trim() || null,
        reason: input.reason?.trim() || null,
      },
      select: ADMIN_GRANT_SELECT,
    });

    await this.recordAudit(actor, 'grant.created', user?.id ?? null, email, {
      grantId: grant.id,
      plan: grant.plan,
      lifecycleStatus: grant.lifecycleStatus,
      activationMode: grant.activationMode,
    });
    await this.sendGrantLifecycleNotification(grant.id, grant.lifecycleStatus);
    return this.toGrantSummary(grant);
  }

  async revokeGrant(grantId: string, actor: AdminActor, reason?: string): Promise<GrantSummary> {
    const existing = await this.db.adminGrant.findUnique({
      where: { id: grantId },
      select: ADMIN_GRANT_SELECT,
    });

    if (!existing) {
      throw new NotFoundException('Grant not found.');
    }

    const grant = await this.db.adminGrant.update({
      where: { id: grantId },
      data: {
        lifecycleStatus: GrantLifecycleStatus.REVOKED,
        revokedAt: new Date(),
        reason: reason?.trim() || existing.reason,
      },
      select: ADMIN_GRANT_SELECT,
    });

    await this.recordAudit(actor, 'grant.revoked', grant.userId, grant.email, {
      grantId,
      reason: reason?.trim() || null,
    });
    await this.sendGrantLifecycleNotification(grant.id, GrantLifecycleStatus.REVOKED);
    return this.toGrantSummary(grant);
  }

  async resendGrantEmail(grantId: string, actor: AdminActor): Promise<GrantSummary> {
    const grant = await this.db.adminGrant.findUnique({
      where: { id: grantId },
      select: ADMIN_GRANT_SELECT,
    });

    if (!grant) {
      throw new NotFoundException('Grant not found.');
    }

    await this.sendGrantLifecycleNotification(grant.id, grant.lifecycleStatus, true);
    await this.recordAudit(actor, 'grant.email_resent', grant.userId, grant.email, { grantId });
    return this.toGrantSummary(grant);
  }

  async listGrantsByLifecycle(lifecycleStatus?: GrantLifecycleStatus): Promise<GrantSummary[]> {
    await this.processLifecycle();

    const grants = await this.db.adminGrant.findMany({
      where: lifecycleStatus ? { lifecycleStatus } : undefined,
      orderBy: [{ updatedAt: 'desc' }, { createdAt: 'desc' }],
      select: ADMIN_GRANT_SELECT,
    });

    return grants.map((grant) => this.toGrantSummary(grant));
  }

  async listPendingInviteRecords(): Promise<GrantSummary[]> {
    const grants = await this.db.adminGrant.findMany({
      where: { lifecycleStatus: GrantLifecycleStatus.PENDING },
      orderBy: { createdAt: 'desc' },
      select: ADMIN_GRANT_SELECT,
    });

    return grants.map((grant) => this.toGrantSummary(grant));
  }

  async claimPendingGrantsForUser(userId: string, email: string): Promise<void> {
    await this.db.adminGrant.updateMany({
      where: {
        email: email.trim().toLowerCase(),
        userId: null,
        lifecycleStatus: {
          in: [GrantLifecycleStatus.PENDING, GrantLifecycleStatus.SCHEDULED, GrantLifecycleStatus.ACTIVE],
        },
      },
      data: {
        userId,
        lifecycleStatus: GrantLifecycleStatus.SCHEDULED,
      },
    });
  }

  async getPaygEstimateForEmail(email: string): Promise<{
    currentEstimate: {
      email: string;
      monthStart: Date;
      monthEnd: Date;
      intervalMix: {
        tenSecondCount: number;
        thirtySecondCount: number;
        sixtyPlusCount: number;
      };
      estimatedAmountInr: number;
      minimumMonthlyAmountInr: number;
      rates: typeof ENTERPRISE_PAYG_RATES;
    } | null;
    history: Array<{
      id: string;
      monthStart: Date;
      monthEnd: Date;
      tenSecondCount: number;
      thirtySecondCount: number;
      sixtyPlusCount: number;
      estimatedAmountInr: number;
      finalizedAt: Date | null;
    }>;
  }> {
    const normalizedEmail = email.trim().toLowerCase();
    const user = await this.prisma.user.findUnique({
      where: { email: normalizedEmail },
      select: { id: true, email: true },
    });

    const currentEstimate = user
      ? await this.computeLivePaygEstimate(user.id, user.email)
      : null;

    const history = await this.db.enterprisePaygMonthlyRecord.findMany({
      where: { email: normalizedEmail },
      orderBy: { monthStart: 'desc' },
      take: 12,
      select: {
        id: true,
        monthStart: true,
        monthEnd: true,
        tenSecondCount: true,
        thirtySecondCount: true,
        sixtyPlusCount: true,
        estimatedAmountInr: true,
        finalizedAt: true,
      },
    });

    return {
      currentEstimate,
      history,
    };
  }

  async rollupCurrentMonthPayg(): Promise<void> {
    const paygUsers = await this.db.adminGrant.findMany({
      where: {
        lifecycleStatus: GrantLifecycleStatus.ACTIVE,
        plan: SubscriptionPlan.ENTERPRISE,
        enterpriseAccessMode: EnterpriseAccessMode.PAYG,
        userId: { not: null },
      },
      distinct: ['email'],
      select: { userId: true, email: true },
    });

    for (const account of paygUsers) {
      if (!account.userId) {
        continue;
      }

      const estimate = await this.computeLivePaygEstimate(account.userId, account.email);
      await this.db.enterprisePaygMonthlyRecord.upsert({
        where: {
          email_monthStart: {
            email: account.email,
            monthStart: estimate.monthStart,
          },
        },
        update: {
          userId: account.userId,
          monthEnd: estimate.monthEnd,
          tenSecondCount: estimate.intervalMix.tenSecondCount,
          thirtySecondCount: estimate.intervalMix.thirtySecondCount,
          sixtyPlusCount: estimate.intervalMix.sixtyPlusCount,
          estimatedAmountInr: estimate.estimatedAmountInr,
        },
        create: {
          userId: account.userId,
          email: account.email,
          monthStart: estimate.monthStart,
          monthEnd: estimate.monthEnd,
          tenSecondCount: estimate.intervalMix.tenSecondCount,
          thirtySecondCount: estimate.intervalMix.thirtySecondCount,
          sixtyPlusCount: estimate.intervalMix.sixtyPlusCount,
          estimatedAmountInr: estimate.estimatedAmountInr,
        },
      });
    }
  }

  @Cron(CronExpression.EVERY_HOUR)
  async handleHourlyLifecycleSweep(): Promise<void> {
    await this.processLifecycle();
    await this.rollupCurrentMonthPayg();
  }

  async resolveAccessForUser(user: BaseAccessUser): Promise<ResolvedAccessWithSource> {
    await this.claimPendingGrantsForUser(user.id, user.email);
    await this.processLifecycle(user.email, user.id);

    const grants = await this.db.adminGrant.findMany({
      where: {
        OR: [{ userId: user.id }, { email: user.email.toLowerCase() }],
        lifecycleStatus: {
          in: [GrantLifecycleStatus.ACTIVE, GrantLifecycleStatus.SCHEDULED, GrantLifecycleStatus.PENDING],
        },
      },
      orderBy: [{ startAt: 'asc' }, { createdAt: 'desc' }],
      select: ADMIN_GRANT_SELECT,
    });

    return this.buildResolvedAccess(user, grants.map((grant) => this.toGrantSummary(grant)));
  }

  async processLifecycle(email?: string, userId?: string): Promise<void> {
    const now = new Date();
    const grants = await this.db.adminGrant.findMany({
      where: email || userId
        ? {
            OR: [
              ...(email ? [{ email: email.trim().toLowerCase() }] : []),
              ...(userId ? [{ userId }] : []),
            ],
          }
        : {
            lifecycleStatus: {
              in: [
                GrantLifecycleStatus.PENDING,
                GrantLifecycleStatus.SCHEDULED,
                GrantLifecycleStatus.ACTIVE,
              ],
            },
          },
      orderBy: [{ startAt: 'asc' }, { createdAt: 'asc' }],
      select: ADMIN_GRANT_SELECT,
    });

    for (const grant of grants) {
      await this.processSingleGrantLifecycle(grant, now);
    }
  }

  private async processSingleGrantLifecycle(
    grant: any,
    now: Date,
  ): Promise<void> {
    if (
      grant.lifecycleStatus === GrantLifecycleStatus.REVOKED ||
      grant.lifecycleStatus === GrantLifecycleStatus.SUPERSEDED ||
      grant.lifecycleStatus === GrantLifecycleStatus.EXPIRED
    ) {
      return;
    }

    const user = grant.userId
      ? await this.prisma.user.findUnique({
          where: { id: grant.userId },
          select: {
            id: true,
            email: true,
            trialStartAt: true,
            trialEndAt: true,
            subscriptionPlan: true,
            subscriptionStatus: true,
            monitorLimit: true,
            isActive: true,
          },
        })
      : null;

    if (grant.endAt && grant.endAt <= now && grant.lifecycleStatus === GrantLifecycleStatus.ACTIVE) {
      await this.db.adminGrant.update({
        where: { id: grant.id },
        data: { lifecycleStatus: GrantLifecycleStatus.EXPIRED },
      });
      await this.sendGrantLifecycleNotification(grant.id, GrantLifecycleStatus.EXPIRED);
      return;
    }

    if (!user) {
      if (grant.lifecycleStatus !== GrantLifecycleStatus.PENDING) {
        await this.db.adminGrant.update({
          where: { id: grant.id },
          data: {
            lifecycleStatus: GrantLifecycleStatus.PENDING,
            userId: null,
          },
        });
      }
      return;
    }

    const shouldActivateByTime = grant.startAt <= now;
    const priorAccessEnded =
      grant.activationMode === GrantActivationMode.OVERRIDE_NOW
        ? true
        : !(await this.hasCurrentNonGrantAccess(user, grant.id, now));

    if (shouldActivateByTime && priorAccessEnded) {
      await this.supersedeOverlappingActiveGrants(grant.email, grant.id);
      await this.db.adminGrant.update({
        where: { id: grant.id },
        data: {
          lifecycleStatus: GrantLifecycleStatus.ACTIVE,
          activatedAt: grant.activatedAt ?? now,
          userId: user.id,
        },
      });

      if (grant.lifecycleStatus !== GrantLifecycleStatus.ACTIVE) {
        await this.sendGrantLifecycleNotification(grant.id, GrantLifecycleStatus.ACTIVE);
      }

      await this.sendExpiryRemindersIfNeeded(grant.id, now);
      return;
    }

    const nextStatus = grant.userId ? GrantLifecycleStatus.SCHEDULED : GrantLifecycleStatus.PENDING;
    if (grant.lifecycleStatus !== nextStatus) {
      await this.db.adminGrant.update({
        where: { id: grant.id },
        data: {
          lifecycleStatus: nextStatus,
          userId: user.id,
        },
      });
    }

    await this.sendExpiryRemindersIfNeeded(grant.id, now);
  }

  private async sendExpiryRemindersIfNeeded(grantId: string, now: Date): Promise<void> {
    const grant = await this.db.adminGrant.findUnique({
      where: { id: grantId },
      select: {
        id: true,
        email: true,
        userId: true,
        plan: true,
        lifecycleStatus: true,
        endAt: true,
        reminder7SentAt: true,
        reminder1SentAt: true,
      },
    });

    if (!grant || grant.lifecycleStatus !== GrantLifecycleStatus.ACTIVE || !grant.endAt) {
      return;
    }

    const msUntilEnd = grant.endAt.getTime() - now.getTime();
    const daysUntilEnd = msUntilEnd / (24 * 60 * 60 * 1000);

    if (daysUntilEnd <= 7 && daysUntilEnd > 6 && !grant.reminder7SentAt) {
      await this.alertNotificationService.sendAdminGrantReminderEmail(grant.email, 7, grant.endAt);
      if (grant.userId) {
        await this.inAppNotificationService.createNotification(
          grant.userId,
          'ADMIN_GRANT_EXPIRING',
          'Manual access expires in 7 days',
          `Your admin-provided ${grant.plan} access ends on ${grant.endAt.toLocaleDateString('en-IN')}.`,
        );
      }
      await this.db.adminGrant.update({
        where: { id: grant.id },
        data: { reminder7SentAt: now },
      });
    }

    if (daysUntilEnd <= 1 && daysUntilEnd > 0 && !grant.reminder1SentAt) {
      await this.alertNotificationService.sendAdminGrantReminderEmail(grant.email, 1, grant.endAt);
      if (grant.userId) {
        await this.inAppNotificationService.createNotification(
          grant.userId,
          'ADMIN_GRANT_EXPIRING',
          'Manual access expires tomorrow',
          `Your admin-provided ${grant.plan} access ends on ${grant.endAt.toLocaleDateString('en-IN')}.`,
        );
      }
      await this.db.adminGrant.update({
        where: { id: grant.id },
        data: { reminder1SentAt: now },
      });
    }
  }

  private async sendGrantLifecycleNotification(
    grantId: string,
    lifecycleStatus: GrantLifecycleStatus,
    force = false,
  ): Promise<void> {
    const grant = await this.db.adminGrant.findUnique({
      where: { id: grantId },
      select: {
        id: true,
        email: true,
        userId: true,
        plan: true,
        startAt: true,
        endAt: true,
        lastNotificationType: true,
      },
    });

    if (!grant) {
      return;
    }

    const notificationKey = force ? `${lifecycleStatus}:resent` : lifecycleStatus;
    if (!force && grant.lastNotificationType === notificationKey) {
      return;
    }

    if (lifecycleStatus === GrantLifecycleStatus.ACTIVE) {
      await this.alertNotificationService.sendAdminGrantActivatedEmail(grant.email, grant.plan, grant.endAt);
      if (grant.userId) {
        await this.inAppNotificationService.createNotification(
          grant.userId,
          'ADMIN_GRANT_ACTIVE',
          `${grant.plan} access active`,
          `Support activated ${grant.plan} access on your account.`,
        );
      }
    } else if (lifecycleStatus === GrantLifecycleStatus.PENDING) {
      await this.alertNotificationService.sendAdminGrantPendingEmail(grant.email, grant.plan, grant.startAt);
    } else if (lifecycleStatus === GrantLifecycleStatus.SCHEDULED) {
      await this.alertNotificationService.sendAdminGrantQueuedEmail(grant.email, grant.plan, grant.startAt);
      if (grant.userId) {
        await this.inAppNotificationService.createNotification(
          grant.userId,
          'ADMIN_GRANT_SCHEDULED',
          `${grant.plan} access scheduled`,
          `Admin access will activate on ${grant.startAt.toLocaleDateString('en-IN')}.`,
        );
      }
    } else if (lifecycleStatus === GrantLifecycleStatus.EXPIRED) {
      await this.alertNotificationService.sendAdminGrantExpiredEmail(grant.email, grant.plan);
      if (grant.userId) {
        await this.inAppNotificationService.createNotification(
          grant.userId,
          'ADMIN_GRANT_EXPIRED',
          'Manual access expired',
          `Your admin-provided ${grant.plan} access has ended. Upgrade from billing to restore monitoring.`,
        );
      }
    } else if (
      lifecycleStatus === GrantLifecycleStatus.REVOKED ||
      lifecycleStatus === GrantLifecycleStatus.SUPERSEDED
    ) {
      await this.alertNotificationService.sendAdminGrantRevokedEmail(
        grant.email,
        grant.plan,
        lifecycleStatus === GrantLifecycleStatus.SUPERSEDED,
      );
      if (grant.userId) {
        await this.inAppNotificationService.createNotification(
          grant.userId,
          'ADMIN_GRANT_REVOKED',
          lifecycleStatus === GrantLifecycleStatus.SUPERSEDED
            ? 'Manual access replaced'
            : 'Manual access revoked',
          `Your admin-provided ${grant.plan} access no longer applies.`,
        );
      }
    }

    await this.db.adminGrant.update({
      where: { id: grant.id },
      data: {
        lastNotificationType: notificationKey,
        lastNotificationSentAt: new Date(),
        expiryNotificationSentAt:
          lifecycleStatus === GrantLifecycleStatus.EXPIRED ? new Date() : undefined,
      },
    });
  }

  private async supersedeOverlappingActiveGrants(email: string, excludeGrantId?: string): Promise<void> {
    await this.db.adminGrant.updateMany({
      where: {
        email,
        lifecycleStatus: GrantLifecycleStatus.ACTIVE,
        ...(excludeGrantId ? { id: { not: excludeGrantId } } : {}),
      },
      data: {
        lifecycleStatus: GrantLifecycleStatus.SUPERSEDED,
        supersededAt: new Date(),
      },
    });
  }

  private async resolveGrantStartAt(
    activationMode: GrantActivationMode,
    requestedStartAt: Date,
    email: string,
    userId?: string,
  ): Promise<Date> {
    if (activationMode === GrantActivationMode.OVERRIDE_NOW) {
      return requestedStartAt;
    }

    const currentAccessEnd = await this.getCurrentEffectiveAccessEnd(email, userId);
    if (!currentAccessEnd) {
      return requestedStartAt;
    }

    return currentAccessEnd.getTime() > requestedStartAt.getTime()
      ? currentAccessEnd
      : requestedStartAt;
  }

  private async getCurrentEffectiveAccessEnd(email: string, userId?: string): Promise<Date | null> {
    const activeGrant = await this.db.adminGrant.findFirst({
      where: { email, lifecycleStatus: GrantLifecycleStatus.ACTIVE },
      orderBy: { startAt: 'desc' },
      select: { endAt: true },
    });

    if (activeGrant?.endAt) {
      return activeGrant.endAt;
    }

    const user = userId
      ? await this.prisma.user.findUnique({
          where: { id: userId },
          select: {
            email: true,
            trialEndAt: true,
            subscriptionStatus: true,
          },
        })
      : await this.prisma.user.findUnique({
          where: { email },
          select: {
            email: true,
            trialEndAt: true,
            subscriptionStatus: true,
          },
        });

    if (!user) {
      return null;
    }

    if (isAdminEmail(user.email, this.configService.get<string>('ADMIN_EMAIL'))) {
      throw new BadRequestException(
        'Queued grants cannot follow a hard admin-access account with no end date.',
      );
    }

    if (user.subscriptionStatus === SubscriptionStatus.TRIALING) {
      return user.trialEndAt;
    }

    if (user.subscriptionStatus === SubscriptionStatus.ACTIVE) {
      throw new BadRequestException(
        'Queued grants cannot follow an active paid subscription with no known end date.',
      );
    }

    return null;
  }

  private async hasCurrentNonGrantAccess(
    user: BaseAccessUser,
    grantIdToIgnore: string,
    now: Date,
  ): Promise<boolean> {
    if (isAdminEmail(user.email, this.configService.get<string>('ADMIN_EMAIL'))) {
      return true;
    }

    const otherActiveGrant = await this.db.adminGrant.findFirst({
      where: {
        email: user.email,
        id: { not: grantIdToIgnore },
        lifecycleStatus: GrantLifecycleStatus.ACTIVE,
        OR: [{ endAt: null }, { endAt: { gt: now } }],
      },
      select: { id: true },
    });

    if (otherActiveGrant) {
      return true;
    }

    if (user.subscriptionStatus === SubscriptionStatus.ACTIVE) {
      return true;
    }

    return (
      user.subscriptionStatus === SubscriptionStatus.TRIALING &&
      user.trialEndAt.getTime() > now.getTime()
    );
  }

  private buildResolvedAccess(
    user: BaseAccessUser,
    grants: GrantSummary[],
  ): ResolvedAccessWithSource {
    const now = Date.now();
    const isAdmin = isAdminEmail(user.email, this.configService.get<string>('ADMIN_EMAIL'));
    const msRemaining = Math.max(user.trialEndAt.getTime() - now, 0);
    const daysRemainingInTrial =
      user.subscriptionStatus === SubscriptionStatus.TRIALING
        ? Math.max(Math.ceil(msRemaining / (24 * 60 * 60 * 1000)), 0)
        : 0;
    const activeGrant =
      grants.find(
        (grant) =>
          grant.lifecycleStatus === GrantLifecycleStatus.ACTIVE &&
          (!grant.endAt || grant.endAt.getTime() > now),
      ) || null;
    const scheduledGrant =
      grants.find((grant) =>
        ([GrantLifecycleStatus.PENDING, GrantLifecycleStatus.SCHEDULED] as string[]).includes(
          grant.lifecycleStatus,
        ),
      ) || null;

    if (isAdmin) {
      return {
        userId: user.id,
        isAdmin: true,
        subscriptionPlan: SubscriptionPlan.ENTERPRISE,
        subscriptionStatus: SubscriptionStatus.ACTIVE,
        trialStartAt: user.trialStartAt,
        trialEndAt: user.trialEndAt,
        monitorLimit: UNBOUNDED_USAGE_LIMIT,
        hasMonitoringAccess: true,
        canCreateMonitors: true,
        daysRemainingInTrial,
        minimumIntervalSeconds: 10,
        apiKeyLimit: UNBOUNDED_USAGE_LIMIT,
        accessSource: 'ADMIN_EMAIL',
        accessReason: 'Hard admin email access is active for this account.',
        enterpriseAccessMode: EnterpriseAccessMode.STANDARD,
        grantMetadata: { activeGrant, scheduledGrant, availableGrants: grants },
      };
    }

    if (activeGrant) {
      const limits = PLAN_LIMITS[activeGrant.plan];
      const unbounded = activeGrant.plan === SubscriptionPlan.ENTERPRISE;
      return {
        userId: user.id,
        isAdmin: false,
        subscriptionPlan: activeGrant.plan,
        subscriptionStatus: SubscriptionStatus.ACTIVE,
        trialStartAt: user.trialStartAt,
        trialEndAt: user.trialEndAt,
        monitorLimit: unbounded ? UNBOUNDED_USAGE_LIMIT : limits.maxMonitors,
        hasMonitoringAccess: true,
        canCreateMonitors: true,
        daysRemainingInTrial,
        minimumIntervalSeconds: limits.minIntervalSeconds,
        apiKeyLimit: unbounded ? UNBOUNDED_USAGE_LIMIT : limits.maxApiKeys,
        accessSource: 'MANUAL_GRANT_ACTIVE',
        accessReason: activeGrant.reason || activeGrant.note || 'Manual admin grant is active.',
        enterpriseAccessMode: activeGrant.enterpriseAccessMode,
        grantMetadata: { activeGrant, scheduledGrant, availableGrants: grants },
      };
    }

    if (user.subscriptionStatus === SubscriptionStatus.ACTIVE) {
      const limits = PLAN_LIMITS[user.subscriptionPlan];
      return {
        userId: user.id,
        isAdmin: false,
        subscriptionPlan: user.subscriptionPlan,
        subscriptionStatus: SubscriptionStatus.ACTIVE,
        trialStartAt: user.trialStartAt,
        trialEndAt: user.trialEndAt,
        monitorLimit: user.monitorLimit,
        hasMonitoringAccess: true,
        canCreateMonitors: true,
        daysRemainingInTrial,
        minimumIntervalSeconds: limits.minIntervalSeconds,
        apiKeyLimit: limits.maxApiKeys,
        accessSource: 'PAID_SUBSCRIPTION',
        accessReason: 'Paid subscription is the current effective access source.',
        enterpriseAccessMode: null,
        grantMetadata: { activeGrant, scheduledGrant, availableGrants: grants },
      };
    }

    if (user.subscriptionStatus === SubscriptionStatus.TRIALING && user.trialEndAt.getTime() > now) {
      const limits = PLAN_LIMITS[SubscriptionPlan.TRIAL];
      return {
        userId: user.id,
        isAdmin: false,
        subscriptionPlan: SubscriptionPlan.TRIAL,
        subscriptionStatus: SubscriptionStatus.TRIALING,
        trialStartAt: user.trialStartAt,
        trialEndAt: user.trialEndAt,
        monitorLimit: user.monitorLimit,
        hasMonitoringAccess: true,
        canCreateMonitors: true,
        daysRemainingInTrial,
        minimumIntervalSeconds: limits.minIntervalSeconds,
        apiKeyLimit: limits.maxApiKeys,
        accessSource: scheduledGrant ? 'MANUAL_GRANT_SCHEDULED' : 'TRIAL',
        accessReason: scheduledGrant
          ? `Trial access is active; a ${scheduledGrant.plan} manual grant is queued next.`
          : 'Trial access is active.',
        enterpriseAccessMode: null,
        grantMetadata: { activeGrant, scheduledGrant, availableGrants: grants },
      };
    }

    const fallbackPlan =
      user.subscriptionPlan === SubscriptionPlan.ENTERPRISE
        ? SubscriptionPlan.ENTERPRISE
        : user.subscriptionPlan;
    const limits = PLAN_LIMITS[fallbackPlan];

    return {
      userId: user.id,
      isAdmin: false,
      subscriptionPlan: fallbackPlan,
      subscriptionStatus:
        user.archivedAt || user.isActive === false ? SubscriptionStatus.CANCELLED : user.subscriptionStatus,
      trialStartAt: user.trialStartAt,
      trialEndAt: user.trialEndAt,
      monitorLimit: user.monitorLimit,
      hasMonitoringAccess: false,
      canCreateMonitors: false,
      daysRemainingInTrial,
      minimumIntervalSeconds: limits.minIntervalSeconds,
      apiKeyLimit: limits.maxApiKeys,
      accessSource: scheduledGrant ? 'MANUAL_GRANT_SCHEDULED' : 'INACTIVE',
      accessReason: scheduledGrant
        ? `No current access is active. A ${scheduledGrant.plan} grant is scheduled next.`
        : 'No active trial, subscription, or manual grant is currently in effect.',
      enterpriseAccessMode: null,
      grantMetadata: { activeGrant, scheduledGrant, availableGrants: grants },
    };
  }

  private async computeLivePaygEstimate(userId: string, email: string) {
    const monitors = await this.prisma.monitor.findMany({
      where: {
        project: { userId },
        isActive: true,
      },
      select: { intervalSeconds: true },
    });

    const intervalMix = monitors.reduce(
      (acc, monitor) => {
        if (monitor.intervalSeconds <= 10) {
          acc.tenSecondCount += 1;
        } else if (monitor.intervalSeconds <= 30) {
          acc.thirtySecondCount += 1;
        } else {
          acc.sixtyPlusCount += 1;
        }

        return acc;
      },
      { tenSecondCount: 0, thirtySecondCount: 0, sixtyPlusCount: 0 },
    );

    const now = new Date();
    const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
    const monthEnd = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1));

    return {
      email,
      monthStart,
      monthEnd,
      intervalMix,
      estimatedAmountInr: calculateEnterprisePaygAmountInr(intervalMix),
      minimumMonthlyAmountInr: ENTERPRISE_PAYG_RATES.minimumMonthlyAmountInr,
      rates: ENTERPRISE_PAYG_RATES,
    };
  }

  private async recordAudit(
    actor: AdminActor,
    action: string,
    targetUserId: string | null,
    targetEmail: string | null,
    metadata?: Prisma.InputJsonValue,
  ): Promise<void> {
    await this.db.adminAuditLog.create({
      data: {
        actorUserId: actor.id,
        actorEmail: actor.email,
        action,
        targetUserId,
        targetEmail,
        metadata,
      },
    });
  }

  private toGrantSummary(
    grant: any,
  ): GrantSummary {
    return {
      id: grant.id,
      email: grant.email,
      userId: grant.userId,
      plan: grant.plan,
      enterpriseAccessMode: grant.enterpriseAccessMode,
      lifecycleStatus: grant.lifecycleStatus,
      activationMode: grant.activationMode,
      startAt: grant.startAt,
      endAt: grant.endAt,
      activatedAt: grant.activatedAt,
      actorEmail: grant.actorEmail,
      note: grant.note,
      reason: grant.reason,
      createdAt: grant.createdAt,
      updatedAt: grant.updatedAt,
    };
  }
}
