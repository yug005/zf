import { Injectable, NotFoundException } from '@nestjs/common';
import { SubscriptionPlan, SubscriptionStatus } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service.js';
import {
  CreateAdminGrantInput,
  EnterpriseAccessMode,
  GrantActivationMode,
  GrantSummary,
  GrantLifecycleStatus,
  ManualAccessService,
} from '../billing/manual-access.service.js';
import { SubscriptionAccessService } from '../billing/subscription-access.service.js';

type AdminActor = {
  id: string;
  email: string;
};

const ADMIN_GRANT_SUPPORT_SELECT = {
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
export class AdminService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly manualAccessService: ManualAccessService,
    private readonly subscriptionAccessService: SubscriptionAccessService,
  ) {}

  private get db(): any {
    return this.prisma as any;
  }

  async searchByEmail(email: string) {
    return this.getSupportSnapshot(email);
  }

  async getSupportSnapshot(email: string) {
    const normalizedEmail = email.trim().toLowerCase();
    const user = await this.db.user.findFirst({
      where: {
        OR: [{ email: normalizedEmail }, { archivedEmail: normalizedEmail }],
      },
      select: {
        id: true,
        email: true,
        archivedEmail: true,
        name: true,
        isActive: true,
        isVerified: true,
        archivedAt: true,
        archivedReason: true,
        createdAt: true,
        subscriptionPlan: true,
        subscriptionStatus: true,
        subscriptionId: true,
        trialStartAt: true,
        trialEndAt: true,
        monitorLimit: true,
      },
    });

    const grantRows = await this.db.adminGrant.findMany({
      where: { email: normalizedEmail },
      orderBy: [{ startAt: 'desc' }, { createdAt: 'desc' }],
      select: ADMIN_GRANT_SUPPORT_SELECT,
    });
    const grants = grantRows.map((grant) => this.toGrantSummary(grant));

    if (!user) {
      return {
        accountExists: false,
        email: normalizedEmail,
        verificationState: 'NO_ACCOUNT',
        effectiveAccess: {
          plan: grants.find((grant) => grant.lifecycleStatus === GrantLifecycleStatus.PENDING)?.plan || null,
          accessSource: grants.length > 0 ? 'MANUAL_GRANT_PENDING' : 'NONE',
          accessReason:
            grants.length > 0
              ? 'Manual grant exists for an email that has not created an account yet.'
              : 'No account and no manual grant were found for this email.',
        },
        subscriptionSummary: null,
        grants,
        supportStats: {
          projects: 0,
          monitors: 0,
          apiKeys: 0,
          statusPages: 0,
        },
        recentIncidents: [],
        recentChanges: [],
        payg: null,
        auditTrail: await this.listAuditTrail(undefined, normalizedEmail),
      };
    }

    const access = await this.subscriptionAccessService.syncUserStateById(user.id);
    const [projectCount, monitorCount, apiKeyCount, statusPageCount, recentIncidents, recentChanges, payg] =
      await Promise.all([
        this.prisma.project.count({ where: { userId: user.id } }),
        this.prisma.monitor.count({ where: { project: { userId: user.id } } }),
        this.prisma.apiKey.count({ where: { userId: user.id, revokedAt: null } }),
        this.prisma.statusPage.count({ where: { userId: user.id } }),
        this.prisma.incident.findMany({
          where: { monitor: { project: { userId: user.id } } },
          orderBy: { createdAt: 'desc' },
          take: 5,
          select: {
            id: true,
            status: true,
            message: true,
            createdAt: true,
            resolvedAt: true,
            monitor: { select: { id: true, name: true } },
          },
        }),
        this.prisma.changeEvent.findMany({
          where: { project: { userId: user.id } },
          orderBy: { happenedAt: 'desc' },
          take: 5,
          select: {
            id: true,
            type: true,
            title: true,
            source: true,
            happenedAt: true,
          },
        }),
        access.subscriptionPlan === SubscriptionPlan.ENTERPRISE &&
        access.enterpriseAccessMode === EnterpriseAccessMode.PAYG
          ? this.manualAccessService.getPaygEstimateForEmail(user.email)
          : Promise.resolve(null),
      ]);

    return {
      accountExists: true,
      user: {
        id: user.id,
        email: user.email,
        archivedEmail: user.archivedEmail,
        name: user.name,
        isActive: user.isActive,
        isVerified: user.isVerified,
        archivedAt: user.archivedAt,
        archivedReason: user.archivedReason,
        createdAt: user.createdAt,
      },
      verificationState: user.isVerified ? 'VERIFIED' : 'UNVERIFIED',
      effectiveAccess: {
        plan: access.subscriptionPlan,
        status: access.subscriptionStatus,
        accessSource: access.accessSource,
        accessReason: access.accessReason,
        enterpriseAccessMode: access.enterpriseAccessMode,
        hasMonitoringAccess: access.hasMonitoringAccess,
        nextGrant: access.grantMetadata.scheduledGrant,
        activeGrant: access.grantMetadata.activeGrant,
      },
      subscriptionSummary: {
        plan: user.subscriptionPlan,
        status: user.subscriptionStatus,
        subscriptionId: user.subscriptionId,
        trialStartAt: user.trialStartAt,
        trialEndAt: user.trialEndAt,
      },
      grants,
      supportStats: {
        projects: projectCount,
        monitors: monitorCount,
        apiKeys: apiKeyCount,
        statusPages: statusPageCount,
      },
      recentIncidents,
      recentChanges,
      payg,
      auditTrail: await this.listAuditTrail(user.id, normalizedEmail),
    };
  }

  async createGrant(
    actor: AdminActor,
    payload: {
      email: string;
      plan: SubscriptionPlan;
      activationMode: 'override_now' | 'activate_after_current_access';
      startAt?: string;
      endAt?: string;
      enterpriseMode?: 'STANDARD' | 'PAYG';
      note?: string;
      reason?: string;
    },
  ) {
    const input: CreateAdminGrantInput = {
      email: payload.email,
      plan: payload.plan,
      activationMode:
        payload.activationMode === 'override_now'
          ? GrantActivationMode.OVERRIDE_NOW
          : GrantActivationMode.ACTIVATE_AFTER_CURRENT_ACCESS,
      startAt: payload.startAt ? new Date(payload.startAt) : undefined,
      endAt: payload.endAt ? new Date(payload.endAt) : null,
      enterpriseAccessMode:
        payload.enterpriseMode === 'PAYG' ? EnterpriseAccessMode.PAYG : EnterpriseAccessMode.STANDARD,
      note: payload.note,
      reason: payload.reason,
    };

    return this.manualAccessService.createGrant(actor, input);
  }

  async revokeGrant(grantId: string, actor: AdminActor, reason?: string) {
    return this.manualAccessService.revokeGrant(grantId, actor, reason);
  }

  async listGrants(state?: string) {
    return this.manualAccessService.listGrantsByLifecycle(state as GrantLifecycleStatus | undefined);
  }

  async listPendingInviteRecords() {
    return this.manualAccessService.listPendingInviteRecords();
  }

  async resendGrantEmail(grantId: string, actor: AdminActor) {
    return this.manualAccessService.resendGrantEmail(grantId, actor);
  }

  async getPaygEstimateHistory(email: string) {
    return this.manualAccessService.getPaygEstimateForEmail(email);
  }

  async listActiveUsersAndRecentSignups() {
    const [activeUsers, recentSignups] = await Promise.all([
      this.db.user.findMany({
        where: { isActive: true, archivedAt: null },
        orderBy: { updatedAt: 'desc' },
        take: 50,
        select: {
          id: true,
          email: true,
          name: true,
          createdAt: true,
          subscriptionPlan: true,
          subscriptionStatus: true,
        },
      }),
      this.db.user.findMany({
        where: { archivedAt: null },
        orderBy: { createdAt: 'desc' },
        take: 25,
        select: {
          id: true,
          email: true,
          name: true,
          createdAt: true,
          isVerified: true,
        },
      }),
    ]);

    return { activeUsers, recentSignups };
  }

  async getMonitoringOpsOverview() {
    const [secretCount, secretKinds, deliveryFailures, deliveryPending, recentDeliveries] =
      await Promise.all([
        this.prisma.monitorSecret.count(),
        this.prisma.monitorSecret.groupBy({
          by: ['kind'],
          _count: { _all: true },
        }),
        this.prisma.alertDelivery.count({ where: { status: 'FAILED' } }),
        this.prisma.alertDelivery.count({ where: { status: 'PENDING' } }),
        this.prisma.alertDelivery.findMany({
          orderBy: { createdAt: 'desc' },
          take: 20,
          select: {
            id: true,
            channel: true,
            status: true,
            recipient: true,
            deliveryAttempts: true,
            errorMessage: true,
            createdAt: true,
            deliveredAt: true,
            alert: {
              select: {
                id: true,
                monitor: {
                  select: {
                    id: true,
                    name: true,
                  },
                },
              },
            },
          },
        }),
      ]);

    return {
      secretCount,
      secretKinds,
      deliveryFailures,
      deliveryPending,
      recentDeliveries,
    };
  }

  async softDeleteUser(actor: AdminActor, userId: string, reason?: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, email: true },
    });

    if (!user) {
      throw new NotFoundException('User not found.');
    }

    const archivedAlias = `archived+${user.id}+${Date.now()}@deleted.zer0friction.in`;

    const updated = await this.db.user.update({
      where: { id: user.id },
      data: {
        archivedEmail: user.email,
        email: archivedAlias,
        isActive: false,
        archivedAt: new Date(),
        archivedReason: reason?.trim() || null,
        refreshTokenHash: null,
        subscriptionStatus: SubscriptionStatus.CANCELLED,
        sessionVersion: { increment: 1 },
      },
      select: {
        id: true,
        email: true,
        archivedEmail: true,
        archivedAt: true,
        archivedReason: true,
      },
    });

    await this.subscriptionAccessService.markMonitoringPausedForUser(user.id);
    await this.db.adminAuditLog.create({
      data: {
        actorUserId: actor.id,
        actorEmail: actor.email,
        action: 'user.archived',
        targetUserId: user.id,
        targetEmail: user.email,
        metadata: {
          archivedAlias,
          reason: reason?.trim() || null,
        },
      },
    });

    return updated;
  }

  async removeUserOwnedOperationalData(actor: AdminActor, userId: string) {
    const user = await this.db.user.findUnique({
      where: { id: userId },
      select: { id: true, email: true, archivedEmail: true },
    });

    if (!user) {
      throw new NotFoundException('User not found.');
    }

    await this.prisma.$transaction([
      this.prisma.apiKey.deleteMany({ where: { userId } }),
      this.prisma.statusPage.deleteMany({ where: { userId } }),
      this.prisma.project.deleteMany({ where: { userId } }),
    ]);

    await this.db.adminAuditLog.create({
      data: {
        actorUserId: actor.id,
        actorEmail: actor.email,
        action: 'user.operational_data_removed',
        targetUserId: user.id,
        targetEmail: user.archivedEmail || user.email,
      },
    });

    return { success: true };
  }

  private async listAuditTrail(userId?: string, email?: string) {
    return this.db.adminAuditLog.findMany({
      where: {
        OR: [
          ...(userId ? [{ targetUserId: userId }] : []),
          ...(email ? [{ targetEmail: email }] : []),
        ],
      },
      orderBy: { createdAt: 'desc' },
      take: 25,
      select: {
        id: true,
        action: true,
        actorEmail: true,
        targetEmail: true,
        metadata: true,
        createdAt: true,
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
