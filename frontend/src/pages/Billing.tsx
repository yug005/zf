import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Check,
  CreditCard,
  ExternalLink,
  Loader2,
  Search,
  ShieldAlert,
  Zap,
} from 'lucide-react';
import { EnterpriseContactForm } from '../components/EnterpriseContactForm';
import { axiosPrivate } from '../services/api';
import { fetchCurrentUser } from '../services/current-user';

interface Plan {
  id: string;
  name: string;
  price: number | null;
  currency: 'INR';
  highlight: string;
  limits: {
    maxMonitors: number;
    maxApiKeys: number;
    minIntervalSeconds: number;
  };
}

interface SubscriptionDetails {
  plan: 'TRIAL' | 'LITE' | 'PRO' | 'BUSINESS' | 'ENTERPRISE';
  status: 'TRIALING' | 'ACTIVE' | 'EXPIRED' | 'CANCELLED';
  trialStartAt: string;
  trialEndAt: string;
  daysRemainingInTrial: number;
  usage: {
    monitorsUsed: number;
    monitorsLimit: number;
    apiKeysUsed: number;
    apiKeysLimit: number;
    minimumIntervalSeconds: number;
  };
  hasActiveSubscription: boolean;
  hasMonitoringAccess: boolean;
  canCreateMonitors: boolean;
}

interface CheckoutResponse {
  subscriptionId: string;
  paymentLink: string;
}

interface WebhookLog {
  id: string;
  eventType: string;
  externalId: string | null;
  signatureValid: boolean;
  processed: boolean;
  processedAt: string | null;
  errorMessage: string | null;
  createdAt: string;
}

interface WebhookLogResponse {
  items: WebhookLog[];
  page: number;
  limit: number;
  totalItems: number;
  totalPages: number;
  summary: {
    total: number;
    processed: number;
    failed: number;
    invalidSignature: number;
  };
}

const FEATURE_MAP: Record<string, string[]> = {
  Trial: [
    '5 monitors free for 14 days',
    'Dashboard and history stay visible after expiry',
    'Monitoring pauses until you upgrade',
    'No permanent free tier',
  ],
  Lite: [
    '5 monitors included',
    '2 active API keys',
    '5 min minimum interval',
    'Best for lightweight production coverage',
  ],
  Pro: [
    '50 monitors included',
    '10 active API keys',
    '60 sec minimum interval',
    'Faster operational visibility for production services',
  ],
  Business: [
    '200 monitors included',
    '50 active API keys',
    '30 sec minimum interval',
    'Built for teams running larger customer-facing stacks',
  ],
};

const formatPrice = (price: number | null, currency: string) => {
  if (price == null) {
    return 'Contact us';
  }

  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency,
    maximumFractionDigits: 0,
  }).format(price / 100);
};

const formatLimit = (value: number) => (value > 100000 ? 'Unlimited' : value.toString());

export default function Billing() {
  const queryClient = useQueryClient();
  const [webhookPage, setWebhookPage] = useState(1);
  const [webhookProcessedFilter, setWebhookProcessedFilter] = useState<'ALL' | 'true' | 'false'>('ALL');
  const [webhookSignatureFilter, setWebhookSignatureFilter] = useState<'ALL' | 'true' | 'false'>('ALL');
  const [webhookEventFilter, setWebhookEventFilter] = useState('');
  const [webhookSearch, setWebhookSearch] = useState('');

  const { data: currentUser, isLoading: isUserLoading } = useQuery({
    queryKey: ['currentUser'],
    queryFn: fetchCurrentUser,
    staleTime: 60_000,
  });

  const { data: plans = [], isLoading: isPlansLoading } = useQuery({
    queryKey: ['billingPlans'],
    enabled: Boolean(currentUser && !currentUser.isAdmin),
    queryFn: async () => {
      const { data } = await axiosPrivate.get<Plan[]>('/billing/plans');
      return data;
    },
  });

  const { data: subDetails = null, isLoading: isSubLoading } = useQuery({
    queryKey: ['billingSubscription'],
    enabled: Boolean(currentUser && !currentUser.isAdmin),
    queryFn: async () => {
      const { data } = await axiosPrivate.get<SubscriptionDetails>('/billing/subscription');
      return data;
    },
  });

  const { data: webhookLogData, isLoading: isWebhookLogsLoading } = useQuery({
    queryKey: [
      'billingWebhookLogs',
      webhookPage,
      webhookProcessedFilter,
      webhookSignatureFilter,
      webhookEventFilter,
      webhookSearch,
    ],
    enabled: Boolean(currentUser?.isAdmin),
    queryFn: async () => {
      const { data } = await axiosPrivate.get<WebhookLogResponse>('/billing/webhooks/razorpay/logs', {
        params: {
          page: webhookPage,
          limit: 25,
          processed: webhookProcessedFilter === 'ALL' ? undefined : webhookProcessedFilter,
          signatureValid: webhookSignatureFilter === 'ALL' ? undefined : webhookSignatureFilter,
          eventType: webhookEventFilter || undefined,
          search: webhookSearch || undefined,
        },
      });
      return data;
    },
  });

  const checkoutMutation = useMutation({
    mutationFn: async (planId: string) => {
      const { data } = await axiosPrivate.post<CheckoutResponse>('/billing/subscription/checkout', {
        planId,
      });
      return data;
    },
    onSuccess: (data) => {
      window.location.href = data.paymentLink;
    },
  });

  const cancelMutation = useMutation({
    mutationFn: async () => {
      await axiosPrivate.post('/billing/subscription/cancel');
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['billingSubscription'] });
      queryClient.invalidateQueries({ queryKey: ['currentUser'] });
      alert('Your subscription was cancelled. Monitoring is now paused until you reactivate a paid plan.');
    },
  });

  if (
    isUserLoading ||
    (!currentUser?.isAdmin && (isPlansLoading || isSubLoading)) ||
    (currentUser?.isAdmin && isWebhookLogsLoading)
  ) {
    return (
      <div className="flex justify-center p-12">
        <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
      </div>
    );
  }

  if (currentUser?.isAdmin) {
    const webhookLogs = webhookLogData?.items || [];
    const totalLogs = webhookLogData?.summary.total || 0;
    const failedLogs = webhookLogData?.summary.failed || 0;
    const invalidSignatureLogs = webhookLogData?.summary.invalidSignature || 0;

    return (
      <div className="mx-auto max-w-6xl space-y-8 pt-10">
        <div className="rounded-3xl border border-slate-200 bg-white p-8 shadow-sm">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <h1 className="text-3xl font-extrabold tracking-tight text-slate-900">
                Admin billing operations
              </h1>
              <p className="mt-4 max-w-2xl text-slate-600">
                Your admin account keeps unrestricted product access, and this page now doubles as
                a live audit view for Razorpay webhook traffic so billing issues are visible before
                customers feel them.
              </p>
              <div className="mt-6 inline-flex rounded-full border border-emerald-200 bg-emerald-50 px-4 py-2 text-sm font-medium text-emerald-800">
                Unlimited usage active for {currentUser.email}
              </div>
            </div>

            <div className="grid min-w-[320px] gap-4 sm:grid-cols-3">
              <div className="rounded-2xl border border-slate-200 bg-slate-50 px-5 py-4">
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
                  Recent Webhooks
                </p>
                <p className="mt-3 text-3xl font-bold text-slate-900">{totalLogs}</p>
              </div>
              <div className="rounded-2xl border border-amber-200 bg-amber-50 px-5 py-4">
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-amber-700">
                  Processing Issues
                </p>
                <p className="mt-3 text-3xl font-bold text-amber-900">{failedLogs}</p>
              </div>
              <div className="rounded-2xl border border-rose-200 bg-rose-50 px-5 py-4">
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-rose-700">
                  Invalid Signatures
                </p>
                <p className="mt-3 text-3xl font-bold text-rose-900">{invalidSignatureLogs}</p>
              </div>
            </div>
          </div>
        </div>

        <div className="rounded-3xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-200 px-8 py-6">
            <h2 className="text-xl font-semibold text-slate-900">Razorpay webhook audit log</h2>
            <p className="mt-2 text-sm text-slate-500">
              Signature validation, processing results, pagination, and search are now available so you can audit billing traffic more like an ops console.
            </p>
            <div className="mt-5 grid gap-3 lg:grid-cols-[1.2fr_0.8fr_0.8fr_1fr]">
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  value={webhookSearch}
                  onChange={(event) => {
                    setWebhookPage(1);
                    setWebhookSearch(event.target.value);
                  }}
                  placeholder="Search event, external ID, or error"
                  className="w-full rounded-xl border border-slate-300 px-10 py-2.5 text-sm"
                />
              </div>
              <select
                value={webhookProcessedFilter}
                onChange={(event) => {
                  setWebhookPage(1);
                  setWebhookProcessedFilter(event.target.value as 'ALL' | 'true' | 'false');
                }}
                className="rounded-xl border border-slate-300 px-3 py-2.5 text-sm"
              >
                <option value="ALL">All processing states</option>
                <option value="true">Processed</option>
                <option value="false">Needs attention</option>
              </select>
              <select
                value={webhookSignatureFilter}
                onChange={(event) => {
                  setWebhookPage(1);
                  setWebhookSignatureFilter(event.target.value as 'ALL' | 'true' | 'false');
                }}
                className="rounded-xl border border-slate-300 px-3 py-2.5 text-sm"
              >
                <option value="ALL">All signatures</option>
                <option value="true">Valid signatures</option>
                <option value="false">Invalid signatures</option>
              </select>
              <input
                value={webhookEventFilter}
                onChange={(event) => {
                  setWebhookPage(1);
                  setWebhookEventFilter(event.target.value);
                }}
                placeholder="Filter by event type"
                className="rounded-xl border border-slate-300 px-3 py-2.5 text-sm"
              />
            </div>
          </div>

          <div className="divide-y divide-slate-100">
            {webhookLogs.length === 0 ? (
              <div className="px-8 py-10 text-sm text-slate-500">
                No Razorpay webhook events have been received yet.
              </div>
            ) : (
              webhookLogs.map((log) => (
                <div
                  key={log.id}
                  className="grid gap-4 px-8 py-6 lg:grid-cols-[1.5fr_1fr_1fr_1fr]"
                >
                  <div>
                    <div className="flex flex-wrap items-center gap-3">
                      <p className="text-sm font-semibold uppercase tracking-[0.18em] text-slate-500">
                        {log.eventType}
                      </p>
                      <span
                        className={`rounded-full px-3 py-1 text-xs font-semibold ${
                          log.signatureValid
                            ? 'bg-emerald-50 text-emerald-700'
                            : 'bg-rose-50 text-rose-700'
                        }`}
                      >
                        {log.signatureValid ? 'Signature valid' : 'Signature invalid'}
                      </span>
                      <span
                        className={`rounded-full px-3 py-1 text-xs font-semibold ${
                          log.processed
                            ? 'bg-sky-50 text-sky-700'
                            : 'bg-amber-50 text-amber-700'
                        }`}
                      >
                        {log.processed ? 'Processed' : 'Needs attention'}
                      </span>
                    </div>
                    <p className="mt-3 text-sm text-slate-600">
                      {log.externalId ? `External ID: ${log.externalId}` : 'No external entity ID'}
                    </p>
                    <p className="mt-2 text-xs text-slate-400">
                      Received {new Date(log.createdAt).toLocaleString()}
                    </p>
                  </div>

                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                      Processed At
                    </p>
                    <p className="mt-3 text-sm text-slate-700">
                      {log.processedAt
                        ? new Date(log.processedAt).toLocaleString()
                        : 'Not completed'}
                    </p>
                  </div>

                  <div className="lg:col-span-2">
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                      Last Error
                    </p>
                    <p className="mt-3 rounded-2xl bg-slate-50 px-4 py-3 text-sm text-slate-600">
                      {log.errorMessage || 'No error recorded'}
                    </p>
                  </div>
                </div>
              ))
            )}
          </div>

          {webhookLogData ? (
            <div className="flex flex-col gap-3 border-t border-slate-200 px-8 py-5 text-sm text-slate-500 sm:flex-row sm:items-center sm:justify-between">
              <p>
                Page {webhookLogData.page} of {webhookLogData.totalPages} / {webhookLogData.totalItems} matching events
              </p>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setWebhookPage((current) => Math.max(1, current - 1))}
                  disabled={webhookLogData.page <= 1}
                  className="rounded-xl border border-slate-300 px-4 py-2 font-medium text-slate-700 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Previous
                </button>
                <button
                  type="button"
                  onClick={() =>
                    setWebhookPage((current) =>
                      Math.min(webhookLogData.totalPages, current + 1),
                    )
                  }
                  disabled={webhookLogData.page >= webhookLogData.totalPages}
                  className="rounded-xl border border-slate-300 px-4 py-2 font-medium text-slate-700 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Next
                </button>
              </div>
            </div>
          ) : null}
        </div>
      </div>
    );
  }

  const currentPlan = subDetails?.plan || currentUser?.subscriptionPlan || 'TRIAL';
  const checkoutError =
    checkoutMutation.error && checkoutMutation.error instanceof Error
      ? checkoutMutation.error.message
      : 'Checkout is not available right now. Finish Razorpay setup and try again.';

  return (
    <div className="mx-auto max-w-7xl space-y-10 pb-16">
      <div className="mx-auto max-w-3xl pt-8 text-center">
        <h1 className="text-3xl font-extrabold tracking-tight text-gray-900 sm:text-4xl">
          Pricing for a trial to paid SaaS journey
        </h1>
        <p className="mt-4 text-lg text-gray-500">
          Start with a 14-day trial, keep your dashboard and history visible after expiry, and upgrade only when you are ready to resume active monitoring.
        </p>
      </div>

      {subDetails ? (
        <div className="mx-auto max-w-5xl rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <h3 className="flex items-center gap-2 text-lg font-semibold text-gray-900">
                <CreditCard className="h-5 w-5 text-gray-500" />
                Current Plan: <span className="text-primary-600">{currentPlan}</span>
              </h3>
              <p className="mt-2 text-sm text-gray-500">
                Status:{' '}
                <span
                  className={
                    subDetails.status === 'ACTIVE'
                      ? 'font-medium text-green-600'
                      : subDetails.status === 'TRIALING'
                        ? 'font-medium text-blue-600'
                        : 'font-medium text-amber-700'
                  }
                >
                  {subDetails.status}
                </span>
              </p>
              <p className="mt-2 text-sm text-gray-500">
                Minimum monitoring interval on this plan:{' '}
                <span className="font-medium text-gray-900">
                  {subDetails.usage.minimumIntervalSeconds}s
                </span>
              </p>
              {subDetails.status === 'TRIALING' ? (
                <p className="mt-2 text-sm text-blue-700">
                  Trial ends in {subDetails.daysRemainingInTrial} day
                  {subDetails.daysRemainingInTrial === 1 ? '' : 's'}.
                </p>
              ) : null}
              {subDetails.status === 'ACTIVE' ? (
                <button
                  disabled={cancelMutation.isPending}
                  onClick={() => {
                    if (
                      window.confirm(
                        'Cancel the current subscription? Monitoring will pause until you reactivate a paid plan.',
                      )
                    ) {
                      cancelMutation.mutate();
                    }
                  }}
                  className="mt-4 text-xs font-medium text-red-600 underline transition hover:text-red-700"
                >
                  {cancelMutation.isPending ? 'Processing cancellation...' : 'Cancel active subscription'}
                </button>
              ) : null}
            </div>

            <div className="grid min-w-[280px] gap-4 sm:grid-cols-2">
              <div className="rounded-xl border border-gray-100 bg-gray-50 px-5 py-4">
                <div className="mb-2 flex justify-between text-sm">
                  <span className="font-medium text-gray-700">Monitors</span>
                  <span className="text-gray-500">
                    {subDetails.usage.monitorsUsed} / {formatLimit(subDetails.usage.monitorsLimit)}
                  </span>
                </div>
                <div className="h-2 rounded-full bg-gray-200">
                  <div
                    className={`h-2 rounded-full ${
                      subDetails.usage.monitorsUsed >= subDetails.usage.monitorsLimit
                        ? 'bg-red-500'
                        : 'bg-primary-500'
                    }`}
                    style={{
                      width: `${Math.min(
                        (subDetails.usage.monitorsUsed / subDetails.usage.monitorsLimit) * 100,
                        100,
                      )}%`,
                    }}
                  />
                </div>
              </div>

              <div className="rounded-xl border border-gray-100 bg-gray-50 px-5 py-4">
                <div className="mb-2 flex justify-between text-sm">
                  <span className="font-medium text-gray-700">API Keys</span>
                  <span className="text-gray-500">
                    {subDetails.usage.apiKeysUsed} / {formatLimit(subDetails.usage.apiKeysLimit)}
                  </span>
                </div>
                <div className="h-2 rounded-full bg-gray-200">
                  <div
                    className={`h-2 rounded-full ${
                      subDetails.usage.apiKeysUsed >= subDetails.usage.apiKeysLimit
                        ? 'bg-red-500'
                        : 'bg-emerald-500'
                    }`}
                    style={{
                      width: `${Math.min(
                        (subDetails.usage.apiKeysUsed / subDetails.usage.apiKeysLimit) * 100,
                        100,
                      )}%`,
                    }}
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {subDetails?.status === 'EXPIRED' || subDetails?.status === 'CANCELLED' ? (
        <div className="mx-auto max-w-3xl rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          Your dashboard and history remain available, but active monitoring and new monitor creation are paused until you upgrade.
        </div>
      ) : null}

      {checkoutMutation.isError ? (
        <div className="mx-auto max-w-3xl rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          <div className="flex items-start gap-3">
            <ShieldAlert className="mt-0.5 h-5 w-5 shrink-0" />
            <div>
              <p className="font-semibold">Upgrade flow is ready, but checkout still needs Razorpay credentials.</p>
              <p className="mt-1">{checkoutError}</p>
            </div>
          </div>
        </div>
      ) : null}

      <div className="relative mx-auto grid max-w-7xl grid-cols-1 gap-8 pt-4 md:grid-cols-2 xl:grid-cols-4">
        {plans.map((plan) => {
          const isPro = plan.name.toLowerCase() === 'pro';
          const isCurrentPlan = currentPlan.toLowerCase() === plan.name.toLowerCase();
          const isTrial = plan.name.toLowerCase() === 'trial';
          const extraFeatures = FEATURE_MAP[plan.name] || [];

          return (
            <div
              key={plan.id}
              className={`relative flex flex-col rounded-2xl border bg-white shadow-sm transition-shadow hover:shadow-lg ${
                isPro ? 'border-primary-500 ring-2 ring-primary-500' : 'border-gray-200'
              } ${isCurrentPlan && !isPro ? 'border-transparent ring-2 ring-gray-900' : ''}`}
            >
              {isPro ? (
                <div className="absolute inset-x-0 top-0 -mt-4 flex justify-center">
                  <span className="inline-flex items-center rounded-full bg-primary-500 px-4 py-1 text-xs font-semibold uppercase tracking-wide text-white shadow-sm shadow-primary-500/30">
                    <Zap className="mr-1 h-3.5 w-3.5" />
                    Best Value
                  </span>
                </div>
              ) : null}

              <div className="flex-1 p-8">
                <h3 className="text-xl font-semibold text-gray-900">{plan.name}</h3>
                <div className="mt-4 flex items-baseline text-4xl font-extrabold text-gray-900">
                  {formatPrice(plan.price, plan.currency)}
                  {plan.price != null ? (
                    <span className="ml-2 text-base font-medium text-gray-500">/month</span>
                  ) : null}
                </div>
                <p className="mt-4 text-sm leading-relaxed text-gray-500">{plan.highlight}</p>

                <ul className="mt-8 space-y-4">
                  <li className="flex items-start">
                    <Check className="mt-0.5 h-5 w-5 shrink-0 text-green-500" />
                    <span className="ml-3 text-sm text-gray-700">
                      <span className="font-semibold text-gray-900">
                        {formatLimit(plan.limits.maxMonitors)}
                      </span>{' '}
                      monitors
                    </span>
                  </li>
                  <li className="flex items-start">
                    <Check className="mt-0.5 h-5 w-5 shrink-0 text-green-500" />
                    <span className="ml-3 text-sm text-gray-700">
                      <span className="font-semibold text-gray-900">
                        {formatLimit(plan.limits.maxApiKeys)}
                      </span>{' '}
                      active API keys
                    </span>
                  </li>
                  <li className="flex items-start">
                    <Check className="mt-0.5 h-5 w-5 shrink-0 text-green-500" />
                    <span className="ml-3 text-sm text-gray-700">
                      Minimum interval{' '}
                      <span className="font-semibold text-gray-900">
                        {plan.limits.minIntervalSeconds}s
                      </span>
                    </span>
                  </li>
                  {extraFeatures.map((feature) => (
                    <li key={feature} className="flex items-start">
                      <Check className="mt-0.5 h-5 w-5 shrink-0 text-green-500" />
                      <span className="ml-3 text-sm text-gray-700">{feature}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="flex-none rounded-b-2xl border-t border-gray-100 bg-gray-50 p-8">
                {isCurrentPlan ? (
                  <button
                    disabled
                    className="block w-full cursor-not-allowed rounded-xl border border-transparent bg-gray-900 px-4 py-3 text-center font-medium text-white opacity-50"
                  >
                    Current Plan
                  </button>
                ) : (
                  <button
                    onClick={() => checkoutMutation.mutate(plan.id)}
                    disabled={checkoutMutation.isPending || isTrial}
                    className={`block w-full rounded-xl border px-4 py-3 text-center font-medium transition-all ${
                      isPro
                        ? 'border-transparent bg-primary-500 text-white shadow-md shadow-primary-500/20 hover:bg-primary-600'
                        : 'border-gray-300 bg-white text-gray-900 shadow-sm hover:bg-gray-50'
                    } focus:outline-none focus:ring-2 focus:ring-offset-2 ${
                      isPro ? 'focus:ring-primary-500' : 'focus:ring-gray-900'
                    } disabled:opacity-50`}
                  >
                    {checkoutMutation.isPending && checkoutMutation.variables === plan.id ? (
                      <span className="flex items-center justify-center">
                        <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                        Redirecting...
                      </span>
                    ) : isTrial ? (
                      'Included on signup'
                    ) : (
                      <span className="flex items-center justify-center">
                        Upgrade to {plan.name}
                        <ExternalLink className="ml-2 h-4 w-4 text-current opacity-70" />
                      </span>
                    )}
                  </button>
                )}
              </div>
            </div>
          );
        })}
        <EnterpriseContactForm />
      </div>
    </div>
  );
}
