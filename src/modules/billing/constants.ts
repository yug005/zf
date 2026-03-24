import { SubscriptionPlan } from '@prisma/client';

export const UNBOUNDED_USAGE_LIMIT = 2_147_483_647;

export type PlanDefinition = {
  name: string;
  price: number | null;
  currency: 'INR';
  maxMonitors: number;
  maxApiKeys: number;
  minIntervalSeconds: number;
  highlight: string;
};

export const PLAN_DEFINITIONS: Record<SubscriptionPlan, PlanDefinition> = {
  [SubscriptionPlan.TRIAL]: {
    name: 'Trial',
    price: 0,
    currency: 'INR',
    maxMonitors: 5,
    maxApiKeys: 2,
    minIntervalSeconds: 300,
    highlight: 'Start with 5 monitors free for 14 days before you move onto a paid plan.',
  },
  [SubscriptionPlan.LITE]: {
    name: 'Lite',
    price: 14900,
    currency: 'INR',
    maxMonitors: 5,
    maxApiKeys: 2,
    minIntervalSeconds: 300,
    highlight: 'Built for small teams that need a reliable paid plan without increasing monitor count yet.',
  },
  [SubscriptionPlan.PRO]: {
    name: 'Pro',
    price: 49900,
    currency: 'INR',
    maxMonitors: 50,
    maxApiKeys: 10,
    minIntervalSeconds: 60,
    highlight: 'Priced below the common solo monitoring plans while keeping fast production-friendly checks.',
  },
  [SubscriptionPlan.BUSINESS]: {
    name: 'Business',
    price: 149900,
    currency: 'INR',
    maxMonitors: 200,
    maxApiKeys: 50,
    minIntervalSeconds: 30,
    highlight: 'Cheaper than the typical team-grade monitoring plans with room for serious infrastructure growth.',
  },
  [SubscriptionPlan.ENTERPRISE]: {
    name: 'Enterprise',
    price: null,
    currency: 'INR',
    maxMonitors: UNBOUNDED_USAGE_LIMIT,
    maxApiKeys: UNBOUNDED_USAGE_LIMIT,
    minIntervalSeconds: 10,
    highlight: 'Custom limits, onboarding, and support for larger teams that need tailored rollout help.',
  },
};

export const PLAN_LIMITS: Record<
  SubscriptionPlan,
  { maxMonitors: number; maxApiKeys: number; minIntervalSeconds: number }
> = {
  [SubscriptionPlan.TRIAL]: {
    maxMonitors: PLAN_DEFINITIONS[SubscriptionPlan.TRIAL].maxMonitors,
    maxApiKeys: PLAN_DEFINITIONS[SubscriptionPlan.TRIAL].maxApiKeys,
    minIntervalSeconds: PLAN_DEFINITIONS[SubscriptionPlan.TRIAL].minIntervalSeconds,
  },
  [SubscriptionPlan.LITE]: {
    maxMonitors: PLAN_DEFINITIONS[SubscriptionPlan.LITE].maxMonitors,
    maxApiKeys: PLAN_DEFINITIONS[SubscriptionPlan.LITE].maxApiKeys,
    minIntervalSeconds: PLAN_DEFINITIONS[SubscriptionPlan.LITE].minIntervalSeconds,
  },
  [SubscriptionPlan.PRO]: {
    maxMonitors: PLAN_DEFINITIONS[SubscriptionPlan.PRO].maxMonitors,
    maxApiKeys: PLAN_DEFINITIONS[SubscriptionPlan.PRO].maxApiKeys,
    minIntervalSeconds: PLAN_DEFINITIONS[SubscriptionPlan.PRO].minIntervalSeconds,
  },
  [SubscriptionPlan.BUSINESS]: {
    maxMonitors: PLAN_DEFINITIONS[SubscriptionPlan.BUSINESS].maxMonitors,
    maxApiKeys: PLAN_DEFINITIONS[SubscriptionPlan.BUSINESS].maxApiKeys,
    minIntervalSeconds: PLAN_DEFINITIONS[SubscriptionPlan.BUSINESS].minIntervalSeconds,
  },
  [SubscriptionPlan.ENTERPRISE]: {
    maxMonitors: PLAN_DEFINITIONS[SubscriptionPlan.ENTERPRISE].maxMonitors,
    maxApiKeys: PLAN_DEFINITIONS[SubscriptionPlan.ENTERPRISE].maxApiKeys,
    minIntervalSeconds: PLAN_DEFINITIONS[SubscriptionPlan.ENTERPRISE].minIntervalSeconds,
  },
};
