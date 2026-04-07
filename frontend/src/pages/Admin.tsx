import { useDeferredValue, useState, type ReactNode } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  AlertTriangle,
  CalendarClock,
  Loader2,
  Mail,
  MessageSquareWarning,
  Search,
  ShieldCheck,
  Trash2,
  Users,
} from 'lucide-react';
import { axiosPrivate } from '../services/api';
import { fetchCurrentUser, type SubscriptionPlan } from '../services/current-user';

type Grant = {
  id: string;
  email: string;
  userId: string | null;
  plan: SubscriptionPlan;
  enterpriseAccessMode: 'STANDARD' | 'PAYG' | null;
  lifecycleStatus: 'PENDING' | 'SCHEDULED' | 'ACTIVE' | 'EXPIRED' | 'REVOKED' | 'SUPERSEDED';
  activationMode: 'OVERRIDE_NOW' | 'ACTIVATE_AFTER_CURRENT_ACCESS';
  startAt: string;
  endAt: string | null;
  actorEmail: string;
  note: string | null;
  reason: string | null;
  createdAt: string;
};

type SupportSnapshot = {
  accountExists: boolean;
  email?: string;
  user?: {
    id: string;
    email: string;
    archivedEmail: string | null;
    name: string | null;
    isActive: boolean;
    isVerified: boolean;
    archivedAt: string | null;
    archivedReason: string | null;
    createdAt: string;
  };
  verificationState: string;
  effectiveAccess: {
    plan: SubscriptionPlan | null;
    status?: string;
    accessSource: string;
    accessReason: string;
    enterpriseAccessMode?: 'STANDARD' | 'PAYG' | null;
    hasMonitoringAccess?: boolean;
    nextGrant?: Grant | null;
    activeGrant?: Grant | null;
  };
  subscriptionSummary: {
    plan: SubscriptionPlan;
    status: string;
    subscriptionId: string | null;
    trialStartAt: string;
    trialEndAt: string;
  } | null;
  grants: Grant[];
  supportStats: {
    projects: number;
    monitors: number;
    apiKeys: number;
    statusPages: number;
  };
  recentIncidents: Array<{
    id: string;
    status: string;
    message: string;
    createdAt: string;
    resolvedAt: string | null;
    monitor: { id: string; name: string };
  }>;
  recentChanges: Array<{
    id: string;
    type: string;
    title: string;
    source: string;
    happenedAt: string;
  }>;
  payg: {
    currentEstimate: {
      estimatedAmountInr: number;
      intervalMix: {
        tenSecondCount: number;
        thirtySecondCount: number;
        sixtyPlusCount: number;
      };
      minimumMonthlyAmountInr: number;
    } | null;
    history: Array<{
      id: string;
      monthStart: string;
      estimatedAmountInr: number;
      tenSecondCount: number;
      thirtySecondCount: number;
      sixtyPlusCount: number;
    }>;
  } | null;
  auditTrail: Array<{
    id: string;
    action: string;
    actorEmail: string;
    targetEmail: string | null;
    metadata: unknown;
    createdAt: string;
  }>;
};

type UsersOverview = {
  activeUsers: Array<{
    id: string;
    email: string;
    name: string | null;
    createdAt: string;
    subscriptionPlan: SubscriptionPlan;
    subscriptionStatus: string;
  }>;
  recentSignups: Array<{
    id: string;
    email: string;
    name: string | null;
    createdAt: string;
    isVerified: boolean;
  }>;
};

type MonitoringOpsOverview = {
  secretCount: number;
  secretKinds: Array<{
    kind: string;
    _count: {
      _all: number;
    };
  }>;
  deliveryFailures: number;
  deliveryPending: number;
  recentDeliveries: Array<{
    id: string;
    channel: string;
    status: 'PENDING' | 'SENT' | 'FAILED';
    recipient: string;
    deliveryAttempts: number;
    errorMessage: string | null;
    createdAt: string;
    deliveredAt: string | null;
    alert: {
      id: string;
      monitor: {
        id: string;
        name: string;
      };
    };
  }>;
};

const money = (value: number) =>
  new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(value);

const dateTime = (value?: string | null) =>
  value ? new Date(value).toLocaleString('en-IN') : '—';

export default function Admin() {
  const queryClient = useQueryClient();
  const [email, setEmail] = useState('');
  const [grantEmail, setGrantEmail] = useState('');
  const [plan, setPlan] = useState<SubscriptionPlan>('PRO');
  const [activationMode, setActivationMode] = useState<'override_now' | 'activate_after_current_access'>('override_now');
  const [enterpriseMode, setEnterpriseMode] = useState<'STANDARD' | 'PAYG'>('STANDARD');
  const [startAt, setStartAt] = useState('');
  const [endAt, setEndAt] = useState('');
  const [note, setNote] = useState('');
  const deferredEmail = useDeferredValue(email.trim().toLowerCase());

  const { data: currentUser, isLoading: isUserLoading } = useQuery({
    queryKey: ['currentUser'],
    queryFn: fetchCurrentUser,
    staleTime: 60_000,
  });

  const snapshotQuery = useQuery({
    queryKey: ['adminSnapshot', deferredEmail],
    enabled: Boolean(currentUser?.isAdmin && deferredEmail),
    queryFn: async () => {
      const { data } = await axiosPrivate.get<SupportSnapshot>('/admin/support-snapshot', {
        params: { email: deferredEmail },
      });
      return data;
    },
  });

  const grantsQuery = useQuery({
    queryKey: ['adminGrants'],
    enabled: Boolean(currentUser?.isAdmin),
    queryFn: async () => {
      const { data } = await axiosPrivate.get<Grant[]>('/admin/grants');
      return data;
    },
  });

  const pendingQuery = useQuery({
    queryKey: ['adminPendingRecords'],
    enabled: Boolean(currentUser?.isAdmin),
    queryFn: async () => {
      const { data } = await axiosPrivate.get<Grant[]>('/admin/pending-records');
      return data;
    },
  });

  const overviewQuery = useQuery({
    queryKey: ['adminUsersOverview'],
    enabled: Boolean(currentUser?.isAdmin),
    queryFn: async () => {
      const { data } = await axiosPrivate.get<UsersOverview>('/admin/users/overview');
      return data;
    },
  });

  const monitoringOpsQuery = useQuery({
    queryKey: ['adminMonitoringOps'],
    enabled: Boolean(currentUser?.isAdmin),
    queryFn: async () => {
      const { data } = await axiosPrivate.get<MonitoringOpsOverview>('/admin/monitoring-ops');
      return data;
    },
    refetchInterval: 60_000,
  });

  const createGrantMutation = useMutation({
    mutationFn: async () => {
      await axiosPrivate.post('/admin/grants', {
        email: grantEmail || deferredEmail,
        plan,
        activationMode,
        startAt: startAt || undefined,
        endAt: endAt || undefined,
        enterpriseMode,
        note,
      });
    },
    onSuccess: async () => {
      setNote('');
      setEndAt('');
      setStartAt('');
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['adminSnapshot', deferredEmail] }),
        queryClient.invalidateQueries({ queryKey: ['adminGrants'] }),
        queryClient.invalidateQueries({ queryKey: ['adminPendingRecords'] }),
      ]);
    },
  });

  const revokeGrantMutation = useMutation({
    mutationFn: async (grantId: string) => {
      await axiosPrivate.post(`/admin/grants/${grantId}/revoke`);
    },
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['adminSnapshot', deferredEmail] }),
        queryClient.invalidateQueries({ queryKey: ['adminGrants'] }),
      ]);
    },
  });

  const resendGrantMutation = useMutation({
    mutationFn: async (grantId: string) => {
      await axiosPrivate.post(`/admin/grants/${grantId}/resend`);
    },
  });

  const archiveUserMutation = useMutation({
    mutationFn: async (userId: string) => {
      await axiosPrivate.post(`/admin/users/${userId}/archive`, {
        reason: 'Archived from admin console',
      });
    },
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['adminSnapshot', deferredEmail] }),
        queryClient.invalidateQueries({ queryKey: ['adminUsersOverview'] }),
      ]);
    },
  });

  const purgeUserMutation = useMutation({
    mutationFn: async (userId: string) => {
      await axiosPrivate.post(`/admin/users/${userId}/remove-operational-data`);
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['adminSnapshot', deferredEmail] });
    },
  });

  if (isUserLoading) {
    return (
      <div className="flex justify-center p-10">
        <Loader2 className="h-7 w-7 animate-spin text-slate-400" />
      </div>
    );
  }

  if (!currentUser?.isAdmin) {
    return (
      <div className="rounded-[28px] border border-rose-500/20 bg-rose-500/10 p-8 text-rose-100">
        This route is restricted to admin operators.
      </div>
    );
  }

  const snapshot = snapshotQuery.data;
  const grantTables = grantsQuery.data || [];
  const activeUsers = overviewQuery.data?.activeUsers || [];
  const recentSignups = overviewQuery.data?.recentSignups || [];
  const monitoringOps = monitoringOpsQuery.data;

  return (
    <div className="space-y-6 pb-12">
      <div className="rounded-[30px] border border-white/10 bg-white/[0.04] p-5 backdrop-blur-xl">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.28em] text-cyan-300/70">
              Support Surface
            </p>
            <h1 className="mt-2 text-2xl font-semibold text-white">Admin Ops Console</h1>
            <p className="mt-2 max-w-3xl text-sm text-slate-400">
              Search by email, inspect effective access, queue or override grants, review PAYG estimates, and archive accounts without touching the database.
            </p>
          </div>

          <div className="relative w-full max-w-xl">
            <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
            <input
              value={email}
              onChange={(event) => {
                setEmail(event.target.value);
                setGrantEmail(event.target.value.trim().toLowerCase());
              }}
              placeholder="Lookup user or pending grant by email"
              className="w-full rounded-2xl border border-white/10 bg-slate-950/50 px-11 py-3 text-sm text-white outline-none transition placeholder:text-slate-500 focus:border-cyan-400/40"
            />
          </div>
        </div>
      </div>

      <div className="grid gap-5 xl:grid-cols-[1.5fr_0.9fr]">
        <div className="space-y-5">
          <section className="rounded-[28px] border border-white/10 bg-slate-950/55 p-5">
            <div className="flex items-center gap-2 text-sm font-semibold text-white">
              <ShieldCheck className="h-4 w-4 text-cyan-300" />
              Effective access
            </div>
            {snapshotQuery.isLoading ? (
              <div className="mt-4 flex items-center gap-3 text-sm text-slate-400">
                <Loader2 className="h-4 w-4 animate-spin" />
                Loading support snapshot
              </div>
            ) : snapshot ? (
              <div className="mt-4 grid gap-4 lg:grid-cols-3">
                <StatCard label="Source" value={snapshot.effectiveAccess.accessSource} />
                <StatCard label="Plan" value={snapshot.effectiveAccess.plan || 'None'} />
                <StatCard
                  label="Verification"
                  value={snapshot.verificationState}
                  subtle={snapshot.accountExists ? undefined : 'Pending email only'}
                />
                <WideCard title="Reason" value={snapshot.effectiveAccess.accessReason} />
                <WideCard
                  title="Scheduled next access"
                  value={
                    snapshot.effectiveAccess.nextGrant
                      ? `${snapshot.effectiveAccess.nextGrant.plan} on ${dateTime(snapshot.effectiveAccess.nextGrant.startAt)}`
                      : 'No queued grant'
                  }
                />
                <WideCard
                  title="Subscription / trial"
                  value={
                    snapshot.subscriptionSummary
                      ? `${snapshot.subscriptionSummary.plan} / ${snapshot.subscriptionSummary.status}`
                      : 'No account yet'
                  }
                />
              </div>
            ) : (
              <p className="mt-4 text-sm text-slate-500">Search for an email to load support details.</p>
            )}
          </section>

          <section className="rounded-[28px] border border-white/10 bg-slate-950/55 p-5">
            <div className="flex items-center gap-2 text-sm font-semibold text-white">
              <CalendarClock className="h-4 w-4 text-emerald-300" />
              Manual grant form
            </div>
            <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              <Field label="Email">
                <input value={grantEmail} onChange={(e) => setGrantEmail(e.target.value)} className="admin-input" />
              </Field>
              <Field label="Plan">
                <select value={plan} onChange={(e) => setPlan(e.target.value as SubscriptionPlan)} className="admin-input">
                  <option value="LITE">LITE</option>
                  <option value="PRO">PRO</option>
                  <option value="BUSINESS">BUSINESS</option>
                  <option value="ENTERPRISE">ENTERPRISE</option>
                </select>
              </Field>
              <Field label="Activation">
                <select value={activationMode} onChange={(e) => setActivationMode(e.target.value as 'override_now' | 'activate_after_current_access')} className="admin-input">
                  <option value="override_now">override_now</option>
                  <option value="activate_after_current_access">activate_after_current_access</option>
                </select>
              </Field>
              <Field label="Start">
                <input type="datetime-local" value={startAt} onChange={(e) => setStartAt(e.target.value)} className="admin-input" />
              </Field>
              <Field label="End">
                <input type="datetime-local" value={endAt} onChange={(e) => setEndAt(e.target.value)} className="admin-input" />
              </Field>
              <Field label="Enterprise mode">
                <select value={enterpriseMode} onChange={(e) => setEnterpriseMode(e.target.value as 'STANDARD' | 'PAYG')} className="admin-input" disabled={plan !== 'ENTERPRISE'}>
                  <option value="STANDARD">STANDARD</option>
                  <option value="PAYG">PAYG</option>
                </select>
              </Field>
            </div>
            <Field label="Note" className="mt-3">
              <input value={note} onChange={(e) => setNote(e.target.value)} className="admin-input" placeholder="Reason, ticket, internal note" />
            </Field>
            <div className="mt-4 flex flex-wrap gap-3">
              <button
                type="button"
                onClick={() => createGrantMutation.mutate()}
                disabled={createGrantMutation.isPending || !(grantEmail || deferredEmail)}
                className="rounded-2xl bg-cyan-400 px-4 py-2.5 text-sm font-semibold text-slate-950 transition hover:bg-cyan-300 disabled:opacity-50"
              >
                {createGrantMutation.isPending ? 'Saving grant...' : 'Create grant'}
              </button>
            </div>
          </section>

          <section className="rounded-[28px] border border-white/10 bg-slate-950/55 p-5">
            <div className="grid gap-4 lg:grid-cols-4">
              <StatCard label="Projects" value={String(snapshot?.supportStats.projects ?? 0)} />
              <StatCard label="Monitors" value={String(snapshot?.supportStats.monitors ?? 0)} />
              <StatCard label="API Keys" value={String(snapshot?.supportStats.apiKeys ?? 0)} />
              <StatCard label="Status Pages" value={String(snapshot?.supportStats.statusPages ?? 0)} />
            </div>
            <div className="mt-4 grid gap-4 xl:grid-cols-2">
              <MiniTable
                title="Recent incidents"
                rows={(snapshot?.recentIncidents || []).map((incident) => ({
                  key: incident.id,
                  primary: incident.monitor.name,
                  secondary: incident.message,
                  meta: `${incident.status} • ${dateTime(incident.createdAt)}`,
                }))}
              />
              <MiniTable
                title="Recent changes"
                rows={(snapshot?.recentChanges || []).map((change) => ({
                  key: change.id,
                  primary: change.title,
                  secondary: change.type,
                  meta: `${change.source} • ${dateTime(change.happenedAt)}`,
                }))}
              />
            </div>
          </section>

          <GrantTable
            title="All grants"
            grants={grantTables}
            onRevoke={(grantId) => revokeGrantMutation.mutate(grantId)}
            onResend={(grantId) => resendGrantMutation.mutate(grantId)}
          />

          <GrantTable
            title="Pending invite / grant records"
            grants={pendingQuery.data || []}
            onRevoke={(grantId) => revokeGrantMutation.mutate(grantId)}
            onResend={(grantId) => resendGrantMutation.mutate(grantId)}
          />
        </div>

        <div className="space-y-5">
          <section className="rounded-[28px] border border-white/10 bg-slate-950/55 p-5">
            <div className="flex items-center gap-2 text-sm font-semibold text-white">
              <Mail className="h-4 w-4 text-amber-300" />
              Enterprise PAYG
            </div>
            {snapshot?.payg?.currentEstimate ? (
              <div className="mt-4 space-y-3">
                <StatCard label="Estimate" value={money(snapshot.payg.currentEstimate.estimatedAmountInr)} subtle={`Minimum ${money(snapshot.payg.currentEstimate.minimumMonthlyAmountInr)}`} />
                <div className="grid gap-3 sm:grid-cols-3">
                  <StatCard label="10s" value={String(snapshot.payg.currentEstimate.intervalMix.tenSecondCount)} />
                  <StatCard label="30s" value={String(snapshot.payg.currentEstimate.intervalMix.thirtySecondCount)} />
                  <StatCard label="60s+" value={String(snapshot.payg.currentEstimate.intervalMix.sixtyPlusCount)} />
                </div>
                <MiniTable
                  title="Monthly history"
                  rows={snapshot.payg.history.map((row) => ({
                    key: row.id,
                    primary: money(row.estimatedAmountInr),
                    secondary: new Date(row.monthStart).toLocaleDateString('en-IN', {
                      month: 'short',
                      year: 'numeric',
                    }),
                    meta: `10s ${row.tenSecondCount} • 30s ${row.thirtySecondCount} • 60s+ ${row.sixtyPlusCount}`,
                  }))}
                />
              </div>
            ) : (
              <p className="mt-4 text-sm text-slate-500">No PAYG enterprise estimate for the selected account.</p>
            )}
          </section>

          <MiniTable
            title="Audit timeline"
            rows={(snapshot?.auditTrail || []).map((entry) => ({
              key: entry.id,
              primary: entry.action,
              secondary: entry.actorEmail,
              meta: dateTime(entry.createdAt),
            }))}
          />

          <section className="rounded-[28px] border border-white/10 bg-slate-950/55 p-5">
            <div className="flex items-center gap-2 text-sm font-semibold text-white">
              <MessageSquareWarning className="h-4 w-4 text-cyan-300" />
              Monitoring ops
            </div>
            {monitoringOpsQuery.isLoading ? (
              <div className="mt-4 flex items-center gap-3 text-sm text-slate-400">
                <Loader2 className="h-4 w-4 animate-spin" />
                Loading monitoring operations snapshot
              </div>
            ) : monitoringOps ? (
              <>
                <div className="mt-4 grid gap-3 sm:grid-cols-3">
                  <StatCard label="Stored secrets" value={String(monitoringOps.secretCount)} />
                  <StatCard label="Delivery failures" value={String(monitoringOps.deliveryFailures)} />
                  <StatCard label="Pending deliveries" value={String(monitoringOps.deliveryPending)} />
                </div>

                <div className="mt-4 grid gap-4 xl:grid-cols-2">
                  <MiniTable
                    title="Secret mix"
                    rows={monitoringOps.secretKinds.map((row) => ({
                      key: row.kind,
                      primary: row.kind,
                      secondary: `${row._count._all} secret${row._count._all === 1 ? '' : 's'}`,
                      meta: 'Encrypted workspace-linked credentials',
                    }))}
                  />
                  <MiniTable
                    title="Recent alert deliveries"
                    rows={monitoringOps.recentDeliveries.map((delivery) => ({
                      key: delivery.id,
                      primary: `${delivery.channel} → ${delivery.status}`,
                      secondary: `${delivery.alert.monitor.name} • ${delivery.recipient}`,
                      meta:
                        delivery.status === 'FAILED' && delivery.errorMessage
                          ? `${dateTime(delivery.createdAt)} • ${delivery.errorMessage}`
                          : delivery.deliveredAt
                            ? `${dateTime(delivery.createdAt)} • delivered ${dateTime(delivery.deliveredAt)}`
                            : `${dateTime(delivery.createdAt)} • attempts ${delivery.deliveryAttempts}`,
                    }))}
                  />
                </div>
              </>
            ) : (
              <p className="mt-4 text-sm text-slate-500">Monitoring ops snapshot unavailable.</p>
            )}
          </section>

          <MiniTable
            title="Active users"
            rows={activeUsers.map((user) => ({
              key: user.id,
              primary: user.name || user.email,
              secondary: `${user.subscriptionPlan} • ${user.subscriptionStatus}`,
              meta: user.email,
            }))}
          />

          <MiniTable
            title="Recent signups"
            rows={recentSignups.map((user) => ({
              key: user.id,
              primary: user.name || user.email,
              secondary: user.isVerified ? 'Verified' : 'Unverified',
              meta: dateTime(user.createdAt),
            }))}
          />

          <section className="rounded-[28px] border border-rose-500/20 bg-rose-500/10 p-5">
            <div className="flex items-center gap-2 text-sm font-semibold text-rose-100">
              <AlertTriangle className="h-4 w-4" />
              Destructive actions
            </div>
            <p className="mt-2 text-sm text-rose-100/75">
              Archive first to remove active access. Only remove operational data after explicit confirmation.
            </p>
            <div className="mt-4 flex flex-col gap-3">
              <button
                type="button"
                disabled={!snapshot?.user?.id || archiveUserMutation.isPending}
                onClick={() => {
                  if (snapshot?.user?.id && window.confirm('Archive this user account?')) {
                    archiveUserMutation.mutate(snapshot.user.id);
                  }
                }}
                className="flex items-center justify-center gap-2 rounded-2xl border border-rose-400/30 px-4 py-3 text-sm font-semibold text-rose-100 transition hover:bg-rose-500/10 disabled:opacity-50"
              >
                <Trash2 className="h-4 w-4" />
                Archive user account
              </button>
              <button
                type="button"
                disabled={!snapshot?.user?.id || purgeUserMutation.isPending}
                onClick={() => {
                  if (
                    snapshot?.user?.id &&
                    window.confirm('Remove projects, monitors, API keys, and status pages for this user?')
                  ) {
                    purgeUserMutation.mutate(snapshot.user.id);
                  }
                }}
                className="flex items-center justify-center gap-2 rounded-2xl border border-amber-400/30 px-4 py-3 text-sm font-semibold text-amber-100 transition hover:bg-amber-500/10 disabled:opacity-50"
              >
                <Users className="h-4 w-4" />
                Remove user-owned operational data
              </button>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}

function Field({
  label,
  className,
  children,
}: {
  label: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <label className={className}>
      <span className="mb-1.5 block text-[11px] font-bold uppercase tracking-[0.22em] text-slate-500">
        {label}
      </span>
      {children}
    </label>
  );
}

function StatCard({ label, value, subtle }: { label: string; value: string; subtle?: string }) {
  return (
    <div className="rounded-3xl border border-white/8 bg-white/[0.03] p-4">
      <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-slate-500">{label}</p>
      <p className="mt-3 text-lg font-semibold text-white">{value}</p>
      {subtle ? <p className="mt-1 text-xs text-slate-500">{subtle}</p> : null}
    </div>
  );
}

function WideCard({ title, value }: { title: string; value: string }) {
  return (
    <div className="rounded-3xl border border-white/8 bg-white/[0.03] p-4 lg:col-span-3">
      <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-slate-500">{title}</p>
      <p className="mt-3 text-sm leading-6 text-slate-200">{value}</p>
    </div>
  );
}

function MiniTable({
  title,
  rows,
}: {
  title: string;
  rows: Array<{ key: string; primary: string; secondary: string; meta: string }>;
}) {
  return (
    <section className="rounded-[28px] border border-white/10 bg-slate-950/55 p-5">
      <h2 className="text-sm font-semibold text-white">{title}</h2>
      <div className="mt-4 space-y-3">
        {rows.length === 0 ? (
          <p className="text-sm text-slate-500">Nothing to show.</p>
        ) : (
          rows.map((row) => (
            <div key={row.key} className="rounded-2xl border border-white/8 bg-white/[0.03] p-3">
              <p className="text-sm font-medium text-white">{row.primary}</p>
              <p className="mt-1 text-sm text-slate-300">{row.secondary}</p>
              <p className="mt-1 text-xs text-slate-500">{row.meta}</p>
            </div>
          ))
        )}
      </div>
    </section>
  );
}

function GrantTable({
  title,
  grants,
  onRevoke,
  onResend,
}: {
  title: string;
  grants: Grant[];
  onRevoke: (grantId: string) => void;
  onResend: (grantId: string) => void;
}) {
  return (
    <section className="rounded-[28px] border border-white/10 bg-slate-950/55 p-5">
      <h2 className="text-sm font-semibold text-white">{title}</h2>
      <div className="mt-4 overflow-x-auto">
        <table className="min-w-full text-left text-sm text-slate-300">
          <thead className="text-[11px] uppercase tracking-[0.2em] text-slate-500">
            <tr>
              <th className="pb-3 pr-4">Email</th>
              <th className="pb-3 pr-4">Plan</th>
              <th className="pb-3 pr-4">State</th>
              <th className="pb-3 pr-4">Window</th>
              <th className="pb-3 pr-4">Note</th>
              <th className="pb-3">Actions</th>
            </tr>
          </thead>
          <tbody>
            {grants.length === 0 ? (
              <tr>
                <td colSpan={6} className="py-4 text-sm text-slate-500">
                  No records.
                </td>
              </tr>
            ) : (
              grants.map((grant) => (
                <tr key={grant.id} className="border-t border-white/6 align-top">
                  <td className="py-3 pr-4">{grant.email}</td>
                  <td className="py-3 pr-4">
                    {grant.plan}
                    {grant.enterpriseAccessMode ? ` / ${grant.enterpriseAccessMode}` : ''}
                  </td>
                  <td className="py-3 pr-4">{grant.lifecycleStatus}</td>
                  <td className="py-3 pr-4 text-xs text-slate-400">
                    {dateTime(grant.startAt)}
                    <br />
                    {grant.endAt ? `to ${dateTime(grant.endAt)}` : 'open-ended'}
                  </td>
                  <td className="py-3 pr-4 text-xs text-slate-400">{grant.note || grant.reason || '—'}</td>
                  <td className="py-3">
                    <div className="flex flex-wrap gap-2">
                      <button type="button" onClick={() => onResend(grant.id)} className="rounded-xl border border-white/10 px-3 py-1.5 text-xs font-semibold text-slate-200">
                        Resend
                      </button>
                      {grant.lifecycleStatus !== 'REVOKED' && grant.lifecycleStatus !== 'EXPIRED' ? (
                        <button type="button" onClick={() => onRevoke(grant.id)} className="rounded-xl border border-rose-400/30 px-3 py-1.5 text-xs font-semibold text-rose-200">
                          Revoke
                        </button>
                      ) : null}
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}
