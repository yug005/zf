import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service.js';
import type { ScanTier, ScanCadence, SecurityPlan } from '@prisma/client';

export interface EntitlementCheck {
  allowed: boolean;
  reason?: string;
  plan: SecurityPlan;
}

/**
 * Entitlement rules — controls what actions are allowed per plan.
 * Security billing is completely independent from monitor billing.
 */
const PLAN_CAPABILITIES: Record<
  SecurityPlan,
  {
    standardScan: boolean;
    standardRecurring: boolean;
    advancedScan: boolean;
    allowedCadences: ScanCadence[];
    maxTargets: number;
  }
> = {
  FREE: {
    standardScan: true,
    standardRecurring: false,
    advancedScan: false,
    allowedCadences: ['ONCE'],
    maxTargets: 1,
  },
  STARTER: {
    standardScan: true,
    standardRecurring: true,
    advancedScan: false,
    allowedCadences: ['ONCE', 'WEEKLY', 'MONTHLY'],
    maxTargets: 3,
  },
  PROFESSIONAL: {
    standardScan: true,
    standardRecurring: true,
    advancedScan: true,
    allowedCadences: ['ONCE', 'DAILY', 'WEEKLY', 'MONTHLY'],
    maxTargets: 10,
  },
  ENTERPRISE: {
    standardScan: true,
    standardRecurring: true,
    advancedScan: true,
    allowedCadences: ['ONCE', 'DAILY', 'WEEKLY', 'MONTHLY'],
    maxTargets: 999,
  },
};

@Injectable()
export class EntitlementService {
  private readonly logger = new Logger(EntitlementService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Get or create the subscription state for a user.
   * Auto-creates a FREE plan on first access.
   */
  async getOrCreateState(userId: string) {
    let state = await this.prisma.securitySubscriptionState.findUnique({
      where: { userId },
    });

    if (!state) {
      state = await this.prisma.securitySubscriptionState.create({
        data: { userId },
      });
    }

    return state;
  }

  /**
   * Check if a user can initiate a scan of the given tier.
   */
  async canInitiateScan(
    userId: string,
    tier: ScanTier,
    cadence: ScanCadence = 'ONCE',
    isAdmin = false,
  ): Promise<EntitlementCheck> {
    if (isAdmin) {
      return { allowed: true, plan: 'ENTERPRISE' };
    }

    const state = await this.getOrCreateState(userId);
    const caps = PLAN_CAPABILITIES[state.plan];

    // Check plan status
    if (state.status !== 'ACTIVE') {
      return { allowed: false, reason: 'Security subscription is not active.', plan: state.plan };
    }

    // Check tier
    if ((tier === 'ADVANCED' || tier === 'EMULATION' || tier === 'CONTINUOUS_VALIDATION') && !caps.advancedScan) {
      return {
        allowed: false,
        reason: 'Advanced, emulation, and continuous validation scans require a Professional or Enterprise Security plan.',
        plan: state.plan,
      };
    }

    if (tier === 'STANDARD' && !caps.standardScan) {
      return { allowed: false, reason: 'Standard scans are not available on your plan.', plan: state.plan };
    }

    // Check free scan quota
    if (state.plan === 'FREE') {
      if (state.freeScanUsed >= state.freeScanQuota) {
        return {
          allowed: false,
          reason: 'Free scan quota exhausted. Upgrade to a paid Security plan for more scans.',
          plan: state.plan,
        };
      }
    }

    // Check cadence
    if (cadence !== 'ONCE' && !caps.standardRecurring) {
      return {
        allowed: false,
        reason: 'Recurring scans require a paid Security plan.',
        plan: state.plan,
      };
    }

    if (!caps.allowedCadences.includes(cadence)) {
      return {
        allowed: false,
        reason: `${cadence} cadence is not available on your ${state.plan} plan.`,
        plan: state.plan,
      };
    }

    return { allowed: true, plan: state.plan };
  }

  /**
   * Check if a user can create more targets.
   */
  async canCreateTarget(userId: string, isAdmin = false): Promise<EntitlementCheck> {
    if (isAdmin) {
      return { allowed: true, plan: 'ENTERPRISE' };
    }

    const state = await this.getOrCreateState(userId);
    const caps = PLAN_CAPABILITIES[state.plan];

    const targetCount = await this.prisma.securityTarget.count({
      where: { userId },
    });

    if (targetCount >= caps.maxTargets) {
      return {
        allowed: false,
        reason: `Target limit reached (${caps.maxTargets}). Upgrade to add more targets.`,
        plan: state.plan,
      };
    }

    return { allowed: true, plan: state.plan };
  }

  /**
   * Increment free scan usage.
   */
  async consumeFreeScan(userId: string) {
    await this.prisma.securitySubscriptionState.update({
      where: { userId },
      data: { freeScanUsed: { increment: 1 } },
    });
  }

  /**
   * Get full entitlement details for display.
   */
  async getEntitlementDetails(userId: string, isAdmin = false) {
    if (isAdmin) {
      const targetCount = await this.prisma.securityTarget.count({
        where: { userId },
      });

      return {
        plan: 'ENTERPRISE',
        status: 'ACTIVE',
        freeScanQuota: 999999,
        freeScanUsed: 0,
        freeScanRemaining: 999999,
        maxTargets: 999999,
        currentTargets: targetCount,
        capabilities: {
          standardScan: true,
          standardRecurring: true,
          advancedScan: true,
          allowedCadences: ['ONCE', 'DAILY', 'WEEKLY', 'MONTHLY'],
        },
        currentPeriodStart: null,
        currentPeriodEnd: null,
      };
    }

    const state = await this.getOrCreateState(userId);
    const caps = PLAN_CAPABILITIES[state.plan];

    const targetCount = await this.prisma.securityTarget.count({
      where: { userId },
    });

    return {
      plan: state.plan,
      status: state.status,
      freeScanQuota: state.freeScanQuota,
      freeScanUsed: state.freeScanUsed,
      freeScanRemaining: Math.max(0, state.freeScanQuota - state.freeScanUsed),
      maxTargets: caps.maxTargets,
      currentTargets: targetCount,
      capabilities: {
        standardScan: caps.standardScan,
        standardRecurring: caps.standardRecurring,
        advancedScan: caps.advancedScan,
        allowedCadences: caps.allowedCadences,
      },
      currentPeriodStart: state.currentPeriodStart,
      currentPeriodEnd: state.currentPeriodEnd,
    };
  }
}
