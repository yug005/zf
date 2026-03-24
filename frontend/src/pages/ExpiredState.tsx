import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { Clock3, BarChart3, AlertTriangle, CheckCircle } from 'lucide-react';
import { axiosPrivate } from '../services/api';
import { fetchCurrentUser } from '../services/current-user';

interface SubscriptionDetails {
  plan: 'TRIAL' | 'LITE' | 'PRO' | 'BUSINESS' | 'ENTERPRISE';
  status: 'TRIALING' | 'ACTIVE' | 'EXPIRED' | 'CANCELLED';
  daysRemainingInTrial: number;
  usage: {
    monitorsUsed: number;
    monitorsLimit: number;
  };
  hasMonitoringAccess: boolean;
}

export default function ExpiredState() {
  const { data: currentUser } = useQuery({
    queryKey: ['currentUser'],
    queryFn: fetchCurrentUser,
    staleTime: 60_000,
  });

  const { data: subDetails } = useQuery<SubscriptionDetails>({
    queryKey: ['billingSubscription'],
    queryFn: async () => {
      const { data } = await axiosPrivate.get<SubscriptionDetails>('/billing/subscription');
      return data;
    },
  });

  const isExpired =
    currentUser?.subscriptionStatus === 'EXPIRED' ||
    currentUser?.subscriptionStatus === 'CANCELLED' ||
    subDetails?.status === 'EXPIRED' ||
    subDetails?.status === 'CANCELLED';

  const monitorsUsed = subDetails?.usage.monitorsUsed ?? currentUser?.monitorLimit ?? 0;

  if (!isExpired) {
    return null;
  }

  return (
    <div className="mx-auto max-w-2xl py-16 text-center">
      {/* Icon */}
      <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-amber-100">
        <Clock3 className="h-8 w-8 text-amber-600" />
      </div>

      {/* Headline */}
      <h1 className="text-3xl font-extrabold tracking-tight text-gray-900">
        Your trial has ended
      </h1>
      <p className="mt-4 text-lg text-gray-500">
        Your monitors are paused, but everything is saved. Upgrade to resume active monitoring and keep your history.
      </p>

      {/* CTA */}
      <div className="mt-8 flex flex-col items-center gap-3">
        <Link
          to="/billing"
          className="inline-flex items-center gap-2 rounded-xl bg-green-500 px-6 py-3 text-base font-semibold text-white shadow-md transition-colors hover:bg-green-600"
        >
          Resume monitoring — upgrade now
        </Link>
        <Link
          to="/dashboard"
          className="text-sm font-medium text-gray-500 underline underline-offset-2 hover:text-gray-700"
        >
          Browse your dashboard first
        </Link>
      </div>

      {/* What you keep vs lose */}
      <div className="mt-12 grid grid-cols-2 gap-4 text-left">
        <div className="rounded-2xl border border-gray-200 bg-white p-5">
          <h3 className="flex items-center gap-2 text-sm font-semibold text-gray-900">
            <CheckCircle className="h-4 w-4 text-green-500" />
            What stays available
          </h3>
          <ul className="mt-3 space-y-2 text-sm text-gray-600">
            <li>• Dashboard and analytics</li>
            <li>• Monitor configuration</li>
            <li>• Alert history</li>
            <li>• All your settings</li>
          </ul>
        </div>
        <div className="rounded-2xl border border-gray-200 bg-white p-5">
          <h3 className="flex items-center gap-2 text-sm font-semibold text-gray-900">
            <AlertTriangle className="h-4 w-4 text-amber-500" />
            What pauses
          </h3>
          <ul className="mt-3 space-y-2 text-sm text-gray-600">
            <li>• Active health checks</li>
            <li>• New monitor creation</li>
            <li>• Alert notifications</li>
            <li>• Uptime calculations</li>
          </ul>
        </div>
      </div>

      {/* Monitor count reminder */}
      <div className="mt-8 rounded-2xl border border-slate-200 bg-slate-50 px-6 py-5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <BarChart3 className="h-5 w-5 text-slate-500" />
            <div className="text-left">
              <p className="text-sm font-medium text-slate-700">Your monitors</p>
              <p className="text-xs text-slate-500">{monitorsUsed} monitors configured</p>
            </div>
          </div>
          <Link
            to="/monitors"
            className="text-xs font-medium text-slate-600 underline underline-offset-2 hover:text-slate-900"
          >
            View monitors →
          </Link>
        </div>
      </div>

      {/* Plan comparison link */}
      <p className="mt-8 text-sm text-gray-400">
        Not ready to commit?{' '}
        <Link to="/billing" className="font-medium text-gray-600 underline underline-offset-2">
          Compare all plans
        </Link>
        .
      </p>
    </div>
  );
}
