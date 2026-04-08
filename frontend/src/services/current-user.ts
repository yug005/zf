import { axiosPrivate } from './api';

export type SubscriptionPlan = 'TRIAL' | 'LITE' | 'PRO' | 'BUSINESS' | 'ENTERPRISE';
export type SubscriptionStatus = 'TRIALING' | 'ACTIVE' | 'EXPIRED' | 'CANCELLED';
export type AccessSource =
  | 'ADMIN_EMAIL'
  | 'MANUAL_GRANT_ACTIVE'
  | 'MANUAL_GRANT_SCHEDULED'
  | 'PAID_SUBSCRIPTION'
  | 'TRIAL'
  | 'INACTIVE';

export interface CurrentUser {
  id: string;
  email: string;
  name: string | null;
  avatarUrl?: string | null;
  isActive: boolean;
  isVerified: boolean;
  subscriptionPlan: SubscriptionPlan;
  subscriptionStatus: SubscriptionStatus;
  accessSource?: AccessSource;
  accessReason?: string;
  enterpriseAccessMode?: 'STANDARD' | 'PAYG' | null;
  trialStartAt: string;
  trialEndAt: string;
  monitorLimit: number;
  hasMonitoringAccess: boolean;
  canCreateMonitors: boolean;
  daysRemainingInTrial: number;
  scheduledGrant?: {
    id: string;
    plan: SubscriptionPlan;
    startAt: string;
    endAt: string | null;
    lifecycleStatus: string;
  } | null;
  createdAt: string;
  isAdmin: boolean;
}

export const CURRENT_USER_QUERY_KEY = ['currentUser'] as const;
export const AUTH_HINT_STORAGE_KEY = 'zf-has-auth-session';

type CurrentUserQueryOverrides = {
  staleTime?: number;
  gcTime?: number;
  refetchOnMount?: boolean | 'always';
  retry?: boolean;
};

export function currentUserQueryOptions(
  overrides: CurrentUserQueryOverrides = {},
) {
  return {
    queryKey: CURRENT_USER_QUERY_KEY,
    queryFn: fetchCurrentUser,
    staleTime: overrides.staleTime ?? 60_000,
    gcTime: overrides.gcTime ?? 300_000,
    refetchOnMount: overrides.refetchOnMount ?? false,
    retry: overrides.retry ?? false,
  };
}

export async function fetchCurrentUser(): Promise<CurrentUser> {
  const { data } = await axiosPrivate.get<CurrentUser>('/users/me', {
    skipAuthRedirect: true,
  } as never);
  return data;
}
