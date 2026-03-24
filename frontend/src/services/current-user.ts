import { axiosPrivate } from './api';

export type SubscriptionPlan = 'TRIAL' | 'LITE' | 'PRO' | 'BUSINESS' | 'ENTERPRISE';
export type SubscriptionStatus = 'TRIALING' | 'ACTIVE' | 'EXPIRED' | 'CANCELLED';

export interface CurrentUser {
  id: string;
  email: string;
  name: string | null;
  avatarUrl?: string | null;
  isActive: boolean;
  isVerified: boolean;
  subscriptionPlan: SubscriptionPlan;
  subscriptionStatus: SubscriptionStatus;
  trialStartAt: string;
  trialEndAt: string;
  monitorLimit: number;
  hasMonitoringAccess: boolean;
  canCreateMonitors: boolean;
  daysRemainingInTrial: number;
  createdAt: string;
  isAdmin: boolean;
}

export async function fetchCurrentUser(): Promise<CurrentUser> {
  const { data } = await axiosPrivate.get<CurrentUser>('/users/me');
  return data;
}
