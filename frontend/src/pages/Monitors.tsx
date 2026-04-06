import { type FormEvent, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Activity,
  Gauge,
  Globe,
  Loader2,
  Pause,
  Pencil,
  Play,
  Plus,
  Search,
  Server,
  Shield,
  ShieldAlert,
  Trash2,
  X,
} from 'lucide-react';
import { axiosPrivate } from '../services/api';
import { QuickStartCard } from '../components/QuickStartCard';
import { UpgradePrompt } from '../components/UpgradePrompt';
import { createMonitor, deleteMonitor, fetchMonitors, toggleMonitorPause, updateMonitor } from '../services/monitors';
import type { CreateMonitorPayload, Monitor } from '../services/monitors';

interface Project {
  id: string;
  name: string;
}

interface SubscriptionDetails {
  plan: 'TRIAL' | 'LITE' | 'PRO' | 'BUSINESS' | 'ENTERPRISE';
  status: 'TRIALING' | 'ACTIVE' | 'EXPIRED' | 'CANCELLED';
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

function ensureArray<T>(value: unknown): T[] {
  return Array.isArray(value) ? (value as T[]) : [];
}

const surface =
  'rounded-[30px] border border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.05),rgba(255,255,255,0.025))] shadow-[0_24px_90px_rgba(0,0,0,0.26)] backdrop-blur-xl';
const inputClass =
  'w-full rounded-2xl border border-white/10 bg-slate-950/55 px-4 py-3 text-sm text-slate-100 placeholder:text-slate-500 focus:border-cyan-400/30 focus:outline-none';

const formatResponseTime = (value?: number | null) => {
  if (typeof value !== 'number' || value <= 0) return 'N/A';
  return `${value}ms`;
};

const formatAvailability = (value?: number | null) => {
  if (typeof value !== 'number') return 'N/A';
  return `${value.toFixed(1)}%`;
};

const formatRelativeTime = (value?: string | null) => {
  if (!value) return 'Never';
  const diff = Date.now() - new Date(value).getTime();
  if (diff < 60_000) return 'Just now';
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`;
  return `${Math.floor(diff / 86_400_000)}d ago`;
};

const statusTone: Record<Monitor['status'], string> = {
  UP: 'border-emerald-400/15 bg-emerald-500/10 text-emerald-200',
  DOWN: 'border-rose-400/15 bg-rose-500/10 text-rose-200',
  DEGRADED: 'border-amber-400/15 bg-amber-500/10 text-amber-100',
  PAUSED: 'border-white/10 bg-white/[0.04] text-slate-300',
};

const typeTone: Record<Monitor['type'], string> = {
  HTTP: 'text-cyan-200 border-cyan-400/15 bg-cyan-500/10',
  TCP: 'text-violet-200 border-violet-400/15 bg-violet-500/10',
  DNS: 'text-amber-200 border-amber-400/15 bg-amber-500/10',
  SSL: 'text-emerald-200 border-emerald-400/15 bg-emerald-500/10',
};

function TypeIcon({ type }: { type: Monitor['type'] }) {
  const map = { HTTP: Globe, TCP: Server, DNS: Search, SSL: Shield };
  const Icon = map[type];
  return <Icon className="h-3.5 w-3.5" />;
}

function SummaryCard({
  title,
  value,
  detail,
  icon: Icon,
  accent,
}: {
  title: string;
  value: string | number;
  detail: string;
  icon: React.ElementType;
  accent: string;
}) {
  return (
    <div className={`${surface} p-5`}>
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.24em] text-slate-500">{title}</p>
          <p className="mt-4 text-3xl font-black text-white">{value}</p>
          <p className="mt-2 text-sm text-slate-400">{detail}</p>
        </div>
        <div className={`flex h-12 w-12 items-center justify-center rounded-2xl border ${accent}`}>
          <Icon className="h-5 w-5" />
        </div>
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: Monitor['status'] }) {
  return <span className={`inline-flex items-center rounded-full border px-3 py-1 text-xs font-semibold ${statusTone[status]}`}>{status}</span>;
}

function TypeBadge({ type }: { type: Monitor['type'] }) {
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-semibold ${typeTone[type]}`}>
      <TypeIcon type={type} />
      {type}
    </span>
  );
}

function InsightBlock({ monitor }: { monitor: Monitor }) {
  if (monitor.type === 'SSL' && monitor.metadata?.daysRemaining !== undefined) {
    return (
      <div className="space-y-1">
        <p className="text-sm font-semibold text-slate-100">Certificate expires in {monitor.metadata.daysRemaining} days</p>
        <p className="text-xs text-slate-500">{monitor.metadata.issuer || 'Issuer unavailable'}</p>
      </div>
    );
  }

  if (monitor.type === 'DNS' && monitor.metadata?.resolvedIps?.length) {
    return (
      <div className="flex flex-wrap gap-2">
        {monitor.metadata.resolvedIps.slice(0, 3).map((ip: string) => (
          <span key={ip} className="rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-1 font-mono text-[11px] text-slate-300">
            {ip}
          </span>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-1">
      <p className="text-sm font-semibold text-slate-100">
        {monitor.latestDiagnosis?.summary || monitor.lastErrorMessage || (monitor.latestStatusCode ? `HTTP ${monitor.latestStatusCode}` : 'Healthy')}
      </p>
      {monitor.latestDiagnosis ? (
        <p className="text-xs text-slate-500">
          Confidence {monitor.latestDiagnosis.confidence}% {monitor.latestDiagnosis.isLikelyOutage ? '/ likely outage' : '/ access or config'}
        </p>
      ) : null}
    </div>
  );
}

function CreateMonitorModal({
  isOpen,
  onClose,
  projectId,
  minimumIntervalSeconds,
  initialData = null,
}: {
  isOpen: boolean;
  onClose: () => void;
  projectId?: string;
  minimumIntervalSeconds: number;
  initialData?: Monitor | null;
}) {
  const queryClient = useQueryClient();
  const [formData, setFormData] = useState<CreateMonitorPayload & { rawBody?: string }>({
    name: '',
    url: '',
    type: 'HTTP',
    httpMethod: 'GET',
    serviceName: '',
    featureName: '',
    customerJourney: '',
    teamOwner: '',
    region: '',
    businessCriticality: 'MEDIUM',
    slaTier: 'STANDARD',
    intervalSeconds: minimumIntervalSeconds,
    timeoutMs: 5000,
    projectId: projectId || '',
    rawBody: '',
  });

  useEffect(() => {
    if (!isOpen) return;
    if (initialData) {
      setFormData({
        name: initialData.name,
        url: initialData.url,
        type: initialData.type,
        httpMethod: initialData.httpMethod,
        serviceName: initialData.impactMetadata?.serviceName || '',
        featureName: initialData.impactMetadata?.featureName || '',
        customerJourney: initialData.impactMetadata?.customerJourney || '',
        teamOwner: initialData.impactMetadata?.teamOwner || '',
        region: initialData.impactMetadata?.region || '',
        businessCriticality: initialData.impactMetadata?.businessCriticality || 'MEDIUM',
        slaTier: initialData.impactMetadata?.slaTier || 'STANDARD',
        intervalSeconds: initialData.intervalSeconds,
        timeoutMs: initialData.timeoutMs,
        projectId: projectId || '',
        rawBody: initialData.body ? JSON.stringify(initialData.body) : '',
      });
      return;
    }

    setFormData({
      name: '',
      url: '',
      type: 'HTTP',
      httpMethod: 'GET',
      serviceName: '',
      featureName: '',
      customerJourney: '',
      teamOwner: '',
      region: '',
      businessCriticality: 'MEDIUM',
      slaTier: 'STANDARD',
      intervalSeconds: minimumIntervalSeconds,
      timeoutMs: 5000,
      projectId: projectId || '',
      rawBody: '',
    });
  }, [initialData, isOpen, minimumIntervalSeconds, projectId]);

  const saveMutation = useMutation({
    mutationFn: (payload: Partial<CreateMonitorPayload>) =>
      initialData ? updateMonitor({ id: initialData.id, ...payload }) : createMonitor(payload as CreateMonitorPayload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['monitors'] });
      queryClient.invalidateQueries({ queryKey: ['billingSubscription'] });
      onClose();
    },
  });

  if (!isOpen) return null;

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    let finalBody = undefined;
    if (formData.rawBody?.trim()) {
      try {
        finalBody = JSON.parse(formData.rawBody);
      } catch {
        finalBody = formData.rawBody;
      }
    }

    saveMutation.mutate({
      name: formData.name,
      url: formData.url,
      type: formData.type,
      httpMethod: formData.httpMethod,
      serviceName: formData.serviceName || undefined,
      featureName: formData.featureName || undefined,
      customerJourney: formData.customerJourney || undefined,
      teamOwner: formData.teamOwner || undefined,
      region: formData.region || undefined,
      businessCriticality: formData.businessCriticality,
      slaTier: formData.slaTier,
      intervalSeconds: formData.intervalSeconds,
      timeoutMs: formData.timeoutMs,
      body: finalBody,
      ...(initialData ? {} : { projectId: projectId || '' }),
    });
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/80 backdrop-blur-md">
      <div className="flex min-h-full items-start justify-center p-3 sm:items-center sm:p-4">
        <div className="my-auto flex max-h-[calc(100vh-1.5rem)] w-full max-w-5xl flex-col overflow-hidden rounded-[32px] border border-white/10 bg-[#07111f] shadow-[0_30px_120px_rgba(0,0,0,0.55)] sm:max-h-[94vh]">
          <div className="flex items-center justify-between border-b border-white/8 px-6 py-5">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.24em] text-cyan-300/70">Monitor editor</p>
              <h2 className="mt-2 text-2xl font-black text-white">{initialData ? 'Tune monitor' : 'Create monitor'}</h2>
            </div>
            <button onClick={onClose} className="inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-white/8 bg-white/[0.04] text-slate-300 transition hover:bg-white/[0.08] hover:text-white">
              <X className="h-5 w-5" />
            </button>
          </div>
          <form className="flex min-h-0 flex-1 flex-col" onSubmit={handleSubmit}>
            <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-6 py-6">
              <div className="space-y-6">
                {!projectId ? (
                  <div className="rounded-[24px] border border-amber-400/15 bg-amber-500/10 p-4 text-sm text-amber-100">
                    No project is attached to this session yet. Refresh your workspace or create a project before adding monitors.
                  </div>
                ) : null}

                {saveMutation.isError ? (
                  <div className="rounded-[24px] border border-rose-400/15 bg-rose-500/10 p-4 text-sm text-rose-200">
                    {saveMutation.error instanceof Error ? saveMutation.error.message : 'Could not save this monitor.'}
                  </div>
                ) : null}

                <section className={`${surface} p-5`}>
                  <p className="text-[10px] font-bold uppercase tracking-[0.24em] text-slate-500">Core setup</p>
                  <div className="mt-5 grid grid-cols-1 gap-4 md:grid-cols-2">
                    <div className="md:col-span-2">
                      <label className="mb-2 block text-sm font-semibold text-slate-300">Monitor name</label>
                      <input required value={formData.name} onChange={(e) => setFormData((current) => ({ ...current, name: e.target.value }))} className={inputClass} placeholder="Production API" />
                    </div>
                    <div>
                      <label className="mb-2 block text-sm font-semibold text-slate-300">Monitor type</label>
                      <select value={formData.type} onChange={(e) => setFormData((current) => ({ ...current, type: e.target.value as Monitor['type'] }))} className={inputClass}>
                        <option value="HTTP">HTTP</option>
                        <option value="TCP">TCP</option>
                        <option value="DNS">DNS</option>
                        <option value="SSL">SSL</option>
                      </select>
                    </div>
                    <div>
                      <label className="mb-2 block text-sm font-semibold text-slate-300">HTTP method</label>
                      <select value={formData.httpMethod} onChange={(e) => setFormData((current) => ({ ...current, httpMethod: e.target.value }))} className={inputClass}>
                        <option value="GET">GET</option>
                        <option value="POST">POST</option>
                        <option value="PUT">PUT</option>
                        <option value="PATCH">PATCH</option>
                      </select>
                    </div>
                    <div className="md:col-span-2">
                      <label className="mb-2 block text-sm font-semibold text-slate-300">Target URL</label>
                      <input required type="url" value={formData.url} onChange={(e) => setFormData((current) => ({ ...current, url: e.target.value }))} className={inputClass} placeholder="https://api.example.com/health" />
                    </div>
                    <div>
                      <label className="mb-2 block text-sm font-semibold text-slate-300">Interval (seconds)</label>
                      <input required type="number" min={minimumIntervalSeconds} value={formData.intervalSeconds} onChange={(e) => setFormData((current) => ({ ...current, intervalSeconds: Number(e.target.value) }))} className={inputClass} />
                    </div>
                    <div>
                      <label className="mb-2 block text-sm font-semibold text-slate-300">Timeout (ms)</label>
                      <input required type="number" min={1000} max={120000} value={formData.timeoutMs} onChange={(e) => setFormData((current) => ({ ...current, timeoutMs: Number(e.target.value) }))} className={inputClass} />
                    </div>
                  </div>
                </section>

                {(formData.type === 'HTTP' || formData.type === 'DNS') && (
                  <section className={`${surface} p-5`}>
                    <p className="text-[10px] font-bold uppercase tracking-[0.24em] text-slate-500">Payload and request options</p>
                    <textarea rows={5} value={formData.rawBody} onChange={(e) => setFormData((current) => ({ ...current, rawBody: e.target.value }))} placeholder={formData.type === 'DNS' ? '{"recordType":"A","expectedValue":"1.1.1.1"}' : '{"keywordConfig":{"required":["success"]}}'} className={`${inputClass} mt-4 font-mono`} />
                  </section>
                )}

                <section className={`${surface} p-5`}>
                  <p className="text-[10px] font-bold uppercase tracking-[0.24em] text-slate-500">Impact mapping</p>
                  <div className="mt-5 grid grid-cols-1 gap-4 md:grid-cols-2">
                    <div><label className="mb-2 block text-sm font-semibold text-slate-300">Service</label><input value={formData.serviceName || ''} onChange={(e) => setFormData((current) => ({ ...current, serviceName: e.target.value }))} className={inputClass} placeholder="Checkout API" /></div>
                    <div><label className="mb-2 block text-sm font-semibold text-slate-300">Feature</label><input value={formData.featureName || ''} onChange={(e) => setFormData((current) => ({ ...current, featureName: e.target.value }))} className={inputClass} placeholder="Customer payments" /></div>
                    <div><label className="mb-2 block text-sm font-semibold text-slate-300">Customer journey</label><input value={formData.customerJourney || ''} onChange={(e) => setFormData((current) => ({ ...current, customerJourney: e.target.value }))} className={inputClass} placeholder="Sign-up to checkout" /></div>
                    <div><label className="mb-2 block text-sm font-semibold text-slate-300">Team owner</label><input value={formData.teamOwner || ''} onChange={(e) => setFormData((current) => ({ ...current, teamOwner: e.target.value }))} className={inputClass} placeholder="Growth Engineering" /></div>
                    <div><label className="mb-2 block text-sm font-semibold text-slate-300">Region</label><input value={formData.region || ''} onChange={(e) => setFormData((current) => ({ ...current, region: e.target.value }))} className={inputClass} placeholder="India / APAC" /></div>
                    <div>
                      <label className="mb-2 block text-sm font-semibold text-slate-300">Business criticality</label>
                      <select value={formData.businessCriticality || 'MEDIUM'} onChange={(e) => setFormData((current) => ({ ...current, businessCriticality: e.target.value as CreateMonitorPayload['businessCriticality'] }))} className={inputClass}>
                        <option value="LOW">Low</option>
                        <option value="MEDIUM">Medium</option>
                        <option value="HIGH">High</option>
                        <option value="CRITICAL">Critical</option>
                      </select>
                    </div>
                    <div>
                      <label className="mb-2 block text-sm font-semibold text-slate-300">SLA tier</label>
                      <select value={formData.slaTier || 'STANDARD'} onChange={(e) => setFormData((current) => ({ ...current, slaTier: e.target.value as CreateMonitorPayload['slaTier'] }))} className={inputClass}>
                        <option value="STANDARD">Standard</option>
                        <option value="PREMIUM">Premium</option>
                        <option value="ENTERPRISE">Enterprise</option>
                      </select>
                    </div>
                  </div>
                </section>
              </div>
            </div>
            <div className="flex justify-end gap-3 border-t border-white/8 bg-slate-950/35 px-6 py-4">
              <button type="button" onClick={onClose} className="rounded-2xl border border-white/10 px-5 py-3 text-sm font-semibold text-slate-300 transition hover:bg-white/[0.04] hover:text-white">
                Cancel
              </button>
              <button type="submit" disabled={saveMutation.isPending || !projectId} className="inline-flex items-center gap-2 rounded-2xl bg-gradient-to-r from-cyan-400 to-emerald-400 px-5 py-3 text-sm font-semibold text-slate-950 transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60">
                {saveMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                {initialData ? 'Save changes' : 'Create monitor'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

export default function MonitorsList() {
  const queryClient = useQueryClient();
  const [isModalOpen, setModalOpen] = useState(false);
  const [editingMonitor, setEditingMonitor] = useState<Monitor | null>(null);

  const { data: monitors = [], isLoading, isError } = useQuery<Monitor[]>({
    queryKey: ['monitors'],
    queryFn: fetchMonitors,
    refetchInterval: 10_000,
  });

  const { data: projects = [] } = useQuery<Project[]>({
    queryKey: ['projects'],
    queryFn: async () => {
      const { data } = await axiosPrivate.get<Project[]>('/projects');
      return ensureArray<Project>(data);
    },
  });

  const { data: subDetails = null } = useQuery<SubscriptionDetails>({
    queryKey: ['billingSubscription'],
    queryFn: async () => {
      const { data } = await axiosPrivate.get<SubscriptionDetails>('/billing/subscription');
      return data && typeof data === 'object' ? data : null;
    },
  });

  const togglePauseMutation = useMutation({
    mutationFn: toggleMonitorPause,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['monitors'] }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteMonitor(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['monitors'] }),
  });

  const summary = useMemo(() => {
    const healthy = monitors.filter((monitor) => monitor.status === 'UP').length;
    const attention = monitors.filter((monitor) => monitor.status === 'DOWN' || monitor.status === 'DEGRADED').length;
    const paused = monitors.filter((monitor) => monitor.status === 'PAUSED').length;
    const responseSamples = monitors.map((monitor) => monitor.avgResponseTimeMs).filter((value): value is number => typeof value === 'number' && value > 0);
    const averageLatency = responseSamples.length ? Math.round(responseSamples.reduce((sum, value) => sum + value, 0) / responseSamples.length) : null;
    const strongestMonitor = [...monitors].filter((monitor) => typeof monitor.uptimePercentage === 'number').sort((a, b) => (b.uptimePercentage ?? 0) - (a.uptimePercentage ?? 0))[0] ?? null;

    return {
      total: monitors.length,
      healthy,
      attention,
      paused,
      averageLatency,
      strongestMonitor,
    };
  }, [monitors]);

  const attentionMonitors = useMemo(
    () => monitors.filter((monitor) => monitor.status === 'DOWN' || monitor.status === 'DEGRADED').slice(0, 3),
    [monitors],
  );

  if (isLoading) {
    return (
      <div className="flex min-h-[420px] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-cyan-300" />
      </div>
    );
  }

  if (isError) {
    return <div className={`${surface} p-8 text-rose-200`}>Monitor inventory could not be loaded from the API.</div>;
  }

  const monitorUsageLabel = subDetails
    ? `${subDetails.usage.monitorsUsed} / ${subDetails.usage.monitorsLimit > 100000 ? 'Unlimited' : subDetails.usage.monitorsLimit}`
    : null;
  const isCreationBlocked = Boolean(subDetails && !subDetails.canCreateMonitors);

  return (
    <div className="mx-auto max-w-[1560px] space-y-6 pb-10">
      <section className="grid gap-4 xl:grid-cols-[1.3fr_0.9fr]">
        <div className="rounded-[34px] border border-cyan-400/12 bg-[radial-gradient(circle_at_top_left,rgba(34,211,238,0.15),transparent_35%),linear-gradient(135deg,rgba(255,255,255,0.06),rgba(255,255,255,0.02))] p-6 shadow-[0_30px_100px_rgba(0,0,0,0.28)]">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
            <div className="max-w-2xl">
              <div className="inline-flex items-center gap-2 rounded-full border border-cyan-400/15 bg-cyan-400/10 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.24em] text-cyan-200">
                <Activity className="h-3.5 w-3.5" />
                Fleet control
              </div>
              <h1 className="mt-5 text-4xl font-black text-white">Monitors with stronger signal and cleaner control.</h1>
              <p className="mt-4 max-w-xl text-sm leading-7 text-slate-300">
                Run your whole monitoring fleet from one dark control surface: uptime, latency, impact
                mapping, diagnosis confidence, and operator controls all in one place.
              </p>
              {subDetails ? (
                <div className="mt-5 flex flex-wrap gap-2 text-xs text-slate-300">
                  <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5">Plan: {subDetails.plan}</span>
                  <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5">Usage: {monitorUsageLabel}</span>
                  <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5">Minimum interval: {subDetails.usage.minimumIntervalSeconds}s</span>
                </div>
              ) : null}
            </div>

            <div className="flex flex-col items-start gap-3 lg:items-end">
              <Link to="/billing" className="rounded-full border border-white/10 bg-white/[0.04] px-4 py-2 text-sm font-semibold text-slate-200 transition hover:bg-white/[0.08]">
                Upgrade plan
              </Link>
              <button onClick={() => setModalOpen(true)} disabled={isCreationBlocked} className="inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-cyan-400 to-emerald-400 px-5 py-3 text-sm font-semibold text-slate-950 transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60">
                <Plus className="h-4 w-4" />
                Add monitor
              </button>
            </div>
          </div>
        </div>

        <div className={`${surface} p-4`}>
          <QuickStartCard type="monitoring" />
        </div>
      </section>

      {subDetails?.status === 'TRIALING' ? <UpgradePrompt reason="trial_expiring" /> : null}
      {subDetails?.status === 'EXPIRED' || subDetails?.status === 'CANCELLED' ? <UpgradePrompt reason="expired" /> : null}
      {subDetails && subDetails.usage.monitorsUsed >= subDetails.usage.monitorsLimit ? <UpgradePrompt reason="monitor_limit" /> : null}

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <SummaryCard title="Fleet coverage" value={summary.total} detail={`${summary.healthy} healthy now`} icon={Activity} accent="border-cyan-400/15 bg-cyan-500/10 text-cyan-200" />
        <SummaryCard title="Attention required" value={summary.attention} detail={`${summary.paused} paused monitors`} icon={ShieldAlert} accent="border-amber-400/15 bg-amber-500/10 text-amber-200" />
        <SummaryCard title="Average latency" value={formatResponseTime(summary.averageLatency)} detail="Across active monitors" icon={Gauge} accent="border-violet-400/15 bg-violet-500/10 text-violet-200" />
        <SummaryCard title="Best uptime" value={summary.strongestMonitor ? formatAvailability(summary.strongestMonitor.uptimePercentage) : 'N/A'} detail={summary.strongestMonitor?.name || 'Waiting for samples'} icon={Shield} accent="border-emerald-400/15 bg-emerald-500/10 text-emerald-200" />
      </section>

      <section className="grid gap-4 xl:grid-cols-[1.15fr_0.85fr]">
        <div className={`${surface} p-5`}>
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.24em] text-slate-500">Monitor stack</p>
              <h2 className="mt-3 text-xl font-bold text-white">Each monitor, with operator controls and diagnosis.</h2>
            </div>
            <div className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5 text-xs font-semibold text-slate-300">{monitors.length} total</div>
          </div>

          {monitors.length === 0 ? (
            <div className="mt-6 rounded-[28px] border border-dashed border-white/10 bg-white/[0.02] px-6 py-16 text-center text-slate-400">
              <Activity className="mx-auto h-10 w-10 text-slate-600" />
              <p className="mt-4 text-sm">No monitors are active in this workspace yet.</p>
            </div>
          ) : (
            <div className="mt-6 space-y-4">
              {monitors.map((monitor) => {
                const isPaused = monitor.status === 'PAUSED';
                return (
                  <div key={monitor.id} className="rounded-[28px] border border-white/8 bg-white/[0.03] p-5 transition hover:border-white/14 hover:bg-white/[0.05]">
                    <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <Link to={`/monitors/${monitor.id}`} className="text-lg font-semibold text-white transition hover:text-cyan-200">{monitor.name}</Link>
                          <TypeBadge type={monitor.type} />
                          <StatusBadge status={monitor.status} />
                        </div>
                        <p className="mt-2 truncate text-sm text-slate-500">{monitor.url}</p>
                        <div className="mt-5 grid gap-3 md:grid-cols-3 xl:grid-cols-4">
                          <div className="rounded-[22px] border border-white/8 bg-slate-950/30 px-4 py-3"><p className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-500">Latency</p><p className="mt-2 text-lg font-bold text-white">{formatResponseTime(monitor.avgResponseTimeMs)}</p></div>
                          <div className="rounded-[22px] border border-white/8 bg-slate-950/30 px-4 py-3"><p className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-500">Uptime</p><p className="mt-2 text-lg font-bold text-white">{formatAvailability(monitor.uptimePercentage)}</p></div>
                          <div className="rounded-[22px] border border-white/8 bg-slate-950/30 px-4 py-3"><p className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-500">Latest code</p><p className="mt-2 text-lg font-bold text-white">{monitor.latestStatusCode ?? '-'}</p></div>
                          <div className="rounded-[22px] border border-white/8 bg-slate-950/30 px-4 py-3"><p className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-500">Last check</p><p className="mt-2 text-lg font-bold text-white">{formatRelativeTime(monitor.lastCheckedAt)}</p></div>
                        </div>
                        <div className="mt-5 rounded-[24px] border border-white/8 bg-slate-950/25 p-4">
                          <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-500">Diagnosis</p>
                          <div className="mt-3"><InsightBlock monitor={monitor} /></div>
                          {monitor.impactMetadata ? (
                            <div className="mt-4 flex flex-wrap gap-2">
                              {monitor.impactMetadata.featureName ? <span className="rounded-full border border-white/10 px-3 py-1 text-xs text-slate-300">Feature: {monitor.impactMetadata.featureName}</span> : null}
                              <span className="rounded-full border border-white/10 px-3 py-1 text-xs text-slate-300">Criticality: {monitor.impactMetadata.businessCriticality}</span>
                              <span className="rounded-full border border-white/10 px-3 py-1 text-xs text-slate-300">SLA: {monitor.impactMetadata.slaTier}</span>
                            </div>
                          ) : null}
                        </div>
                      </div>
                      <div className="flex shrink-0 items-start gap-2 xl:flex-col">
                        <button onClick={() => { setEditingMonitor(monitor); setModalOpen(true); }} className="inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.04] text-sky-200 transition hover:bg-sky-500/10" title="Edit monitor"><Pencil className="h-4 w-4" /></button>
                        <button onClick={() => togglePauseMutation.mutate({ id: monitor.id, isPaused })} className="inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.04] text-slate-200 transition hover:bg-white/[0.08]" title={isPaused ? 'Resume monitor' : 'Pause monitor'}>{isPaused ? <Play className="h-4 w-4 text-emerald-300" /> : <Pause className="h-4 w-4 text-amber-200" />}</button>
                        <button onClick={() => { if (window.confirm('Are you sure you want to delete this monitor?')) { deleteMutation.mutate(monitor.id); } }} className={`inline-flex h-11 w-11 items-center justify-center rounded-2xl border transition ${isPaused ? 'border-rose-400/15 bg-rose-500/10 text-rose-200 hover:bg-rose-500/16' : 'cursor-not-allowed border-white/8 bg-white/[0.03] text-slate-600'}`} disabled={!isPaused} title={isPaused ? 'Delete monitor' : 'Pause monitor before deleting'}><Trash2 className="h-4 w-4" /></button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="space-y-4">
          <div className={`${surface} p-5`}>
            <p className="text-[10px] font-bold uppercase tracking-[0.24em] text-slate-500">Hot monitors</p>
            <h2 className="mt-3 text-xl font-bold text-white">Attention queue</h2>
            <p className="mt-2 text-sm text-slate-400">Quickly surface what needs action before you dive deeper.</p>
            <div className="mt-5 space-y-3">
              {attentionMonitors.length === 0 ? (
                <div className="rounded-[24px] border border-dashed border-white/10 bg-white/[0.02] px-4 py-10 text-center text-sm text-slate-400">Everything in the fleet is healthy right now.</div>
              ) : (
                attentionMonitors.map((monitor) => (
                  <Link key={monitor.id} to={`/monitors/${monitor.id}`} className="block rounded-[24px] border border-white/8 bg-white/[0.03] p-4 transition hover:border-white/14 hover:bg-white/[0.05]">
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-sm font-semibold text-white">{monitor.name}</p>
                      <StatusBadge status={monitor.status} />
                    </div>
                    <p className="mt-2 text-sm text-slate-400">{monitor.latestDiagnosis?.summary || monitor.lastErrorMessage || 'Needs review'}</p>
                  </Link>
                ))
              )}
            </div>
          </div>

          <div className={`${surface} p-5`}>
            <p className="text-[10px] font-bold uppercase tracking-[0.24em] text-slate-500">Operator notes</p>
            <div className="mt-4 space-y-3">
              <div className="rounded-[24px] border border-white/8 bg-white/[0.03] p-4"><p className="text-sm font-semibold text-white">Fastest monitor cadence</p><p className="mt-2 text-sm text-slate-400">{subDetails ? `${subDetails.usage.minimumIntervalSeconds}s minimum interval on this plan.` : 'Plan data unavailable.'}</p></div>
              <div className="rounded-[24px] border border-white/8 bg-white/[0.03] p-4"><p className="text-sm font-semibold text-white">Deletion safety</p><p className="mt-2 text-sm text-slate-400">Monitors must be paused before deletion so accidental removals stay harder.</p></div>
              <div className="rounded-[24px] border border-white/8 bg-white/[0.03] p-4"><p className="text-sm font-semibold text-white">Impact mapping</p><p className="mt-2 text-sm text-slate-400">Service, feature, and ownership fields sharpen incident diagnosis and routing later.</p></div>
            </div>
          </div>
        </div>
      </section>

      <CreateMonitorModal
        isOpen={isModalOpen}
        onClose={() => {
          setModalOpen(false);
          setEditingMonitor(null);
        }}
        projectId={projects[0]?.id}
        minimumIntervalSeconds={subDetails?.usage.minimumIntervalSeconds ?? 300}
        initialData={editingMonitor}
      />
    </div>
  );
}
