import { type FormEvent, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Activity,
  Gauge,
  Loader2,
  Plus,
  ShieldAlert,
  Server, Search, Globe, Shield, AlertTriangle,
  Play, Pause, Trash2, Pencil,
  X,
} from 'lucide-react';
import { axiosPrivate } from '../services/api';
import { QuickStartCard } from '../components/QuickStartCard';
import { UpgradePrompt } from '../components/UpgradePrompt';
import { createMonitor, fetchMonitors, toggleMonitorPause, deleteMonitor, updateMonitor } from '../services/monitors';
import type { CreateMonitorPayload, Monitor } from '../services/monitors';

interface Project {
  id: string;
  name: string;
}

interface SubscriptionDetails {
  plan: 'TRIAL' | 'LITE' | 'PRO' | 'BUSINESS' | 'ENTERPRISE';
  status: 'TRIALING' | 'ACTIVE' | 'EXPIRED' | 'CANCELLED';
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

const formatResponseTime = (value?: number | null) => {
  if (typeof value !== 'number' || value <= 0) return 'No data';
  return `${value}ms`;
};

const formatAvailability = (value?: number | null) => {
  if (typeof value !== 'number') return 'No data';
  return `${value.toFixed(1)}%`;
};

const statusTone = (status: Monitor['status']) => {
  if (status === 'UP') return 'bg-green-100 text-green-800 border-green-200';
  if (status === 'DOWN') return 'bg-red-100 text-red-800 border-red-200';
  if (status === 'DEGRADED') return 'bg-amber-100 text-amber-800 border-amber-200';
  return 'bg-slate-100 text-slate-700 border-slate-200';
};

const StatusBadge = ({ status }: { status: Monitor['status'] }) => (
  <span className={`inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-semibold ${statusTone(status)}`}>
    {status}
  </span>
);

const confidenceTone = (confidence?: number | null) => {
  if (typeof confidence !== 'number') return 'text-slate-400';
  if (confidence >= 90) return 'text-emerald-700';
  if (confidence >= 75) return 'text-amber-700';
  return 'text-slate-500';
};

const TypeBadge = ({ type }: { type: Monitor['type'] }) => {
  const icons: Record<string, any> = {
    HTTP: <Globe className="w-3 h-3 mr-1" />,
    TCP: <Server className="w-3 h-3 mr-1" />,
    DNS: <Search className="w-3 h-3 mr-1" />,
    SSL: <Shield className="w-3 h-3 mr-1" />,
  };
  return (
    <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] uppercase font-bold bg-slate-100 text-slate-500 border border-slate-200">
      {icons[type]} {type}
    </span>
  );
};

const SummaryCard = ({
  title,
  value,
  detail,
  icon: Icon,
  accent,
}: {
  title: string;
  value: string | number;
  detail: string;
  icon: any;
  accent: string;
}) => (
  <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
    <div className="flex items-start justify-between gap-4">
      <div>
        <p className="text-sm font-medium text-slate-500">{title}</p>
        <p className="mt-2 text-3xl font-bold text-slate-900">{value}</p>
        <p className="mt-2 text-sm text-slate-500">{detail}</p>
      </div>
      <div className={`rounded-2xl p-3 ${accent}`}>
        <Icon className="h-5 w-5" />
      </div>
    </div>
  </div>
);

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
    } else {
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
    }
  }, [initialData, isOpen, minimumIntervalSeconds, projectId]);

  const createMutation = useMutation({
    mutationFn: (payload: any) => initialData ? updateMonitor({ id: initialData.id, ...payload }) : createMonitor(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['monitors'] });
      queryClient.invalidateQueries({ queryKey: ['billingSubscription'] });
      onClose();
    },
  });

  if (!isOpen) return null;

  const errorMessage =
    createMutation.error instanceof Error
      ? createMutation.error.message
      : 'Failed to create monitor. Please verify the form and try again.';

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    let finalBody = undefined;
    if (formData.rawBody && formData.rawBody.trim() !== '') {
       try {
          finalBody = JSON.parse(formData.rawBody);
       } catch {
          finalBody = formData.rawBody; // Fallback to raw string
       }
    }

    const payload = {
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
    };

    createMutation.mutate(
      initialData
        ? payload
        : {
            ...payload,
            projectId: projectId || '',
          },
    );
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm">
      <div className="flex h-full items-center justify-center p-3 sm:p-4">
        <div className="flex max-h-[92vh] w-full max-w-4xl flex-col overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-200 px-6 py-5">
          <h2 className="text-xl font-bold">{initialData ? 'Edit Monitor' : 'Create Monitor'}</h2>
          <button onClick={onClose} className="rounded-lg p-1 hover:bg-slate-100">
            <X className="h-5 w-5" />
          </button>
        </div>
        <form className="flex min-h-0 flex-1 flex-col" onSubmit={handleSubmit}>
          <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5">
            <div className="space-y-6">
              {!projectId ? (
                <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
                  No project is available for this account yet. Please sign out and back in once, or create a project before adding monitors.
                </div>
              ) : null}

              {createMutation.isError ? (
                <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
                  {errorMessage}
                  <div className="mt-2">
                    <Link to="/billing" className="font-semibold underline underline-offset-2">
                      Review plans and upgrade
                    </Link>
                  </div>
                </div>
              ) : null}

              <section className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div className="md:col-span-2">
                  <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">Core Details</p>
                </div>

                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-700">Monitor Name</label>
                  <input
                    required
                    value={formData.name}
                    onChange={(event) => setFormData((current) => ({ ...current, name: event.target.value }))}
                    className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
                    placeholder="Production API"
                  />
                </div>

                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-700">Monitor Type</label>
                  <select
                    value={formData.type}
                    onChange={(event) => setFormData((current) => ({ ...current, type: event.target.value as any }))}
                    className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm"
                  >
                    <option value="HTTP">HTTP (API / Website)</option>
                    <option value="TCP">TCP (Port Reachability)</option>
                    <option value="DNS">DNS (Domain Resolution)</option>
                    <option value="SSL">SSL (Certificate Health)</option>
                  </select>
                </div>

                <div className="md:col-span-2">
                  <label className="mb-1 block text-sm font-medium text-slate-700">Target URL</label>
                  <input
                    required
                    type="url"
                    value={formData.url}
                    onChange={(event) => setFormData((current) => ({ ...current, url: event.target.value }))}
                    className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
                    placeholder="https://api.example.com/health"
                  />
                </div>

                {formData.type === 'HTTP' ? (
                  <div>
                    <label className="mb-1 block text-sm font-medium text-slate-700">HTTP Method</label>
                    <select
                      value={formData.httpMethod}
                      onChange={(event) => setFormData((current) => ({ ...current, httpMethod: event.target.value }))}
                      className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm"
                    >
                      <option value="GET">GET</option>
                      <option value="POST">POST</option>
                      <option value="PUT">PUT</option>
                      <option value="PATCH">PATCH</option>
                    </select>
                  </div>
                ) : (
                  <div />
                )}

                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-700">Interval (sec)</label>
                  <input
                    required
                    type="number"
                    min={minimumIntervalSeconds}
                    value={formData.intervalSeconds}
                    onChange={(event) =>
                      setFormData((current) => ({
                        ...current,
                        intervalSeconds: Number(event.target.value),
                      }))
                    }
                    className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
                  />
                </div>

                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-700">Timeout (ms)</label>
                  <input
                    required
                    type="number"
                    min={1000}
                    max={120000}
                    value={formData.timeoutMs}
                    onChange={(event) =>
                      setFormData((current) => ({
                        ...current,
                        timeoutMs: Number(event.target.value),
                      }))
                    }
                    className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
                  />
                </div>
              </section>

              {(formData.type === 'HTTP' || formData.type === 'DNS') && (
                <section className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <div className="mb-3">
                    <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">Request Options</p>
                    <p className="mt-1 text-sm text-slate-500">
                      Use JSON to define advanced payload or DNS expectations.
                    </p>
                  </div>
                  <div>
                    <label className="mb-1 block text-sm font-medium text-slate-700">
                      {formData.type === 'DNS' ? 'DNS Options (JSON)' : 'Payload / Options (JSON)'}
                    </label>
                    <textarea
                      rows={4}
                      value={formData.rawBody}
                      onChange={(e) => setFormData(c => ({...c, rawBody: e.target.value}))}
                      placeholder={formData.type === 'DNS'
                        ? '{"recordType": "A", "expectedValue": "1.1.1.1"}'
                        : '{"keywordConfig": {"required": ["success"]}}'}
                      className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm font-mono placeholder:text-slate-300"
                    />
                    <p className="mt-1 text-xs text-slate-400">
                      {formData.type === 'HTTP'
                        ? 'Supports HTTP body or advanced keywordConfig mapping.'
                        : 'Set recordType (A, AAAA, CNAME) and optional expectedValue here.'}
                    </p>
                  </div>
                </section>
              )}

              <section className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <div className="mb-3">
                  <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">Customer Impact Context</p>
                  <p className="mt-1 text-sm text-slate-500">
                    Add ownership and business context so incidents become more meaningful later.
                  </p>
                </div>

                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <div>
                    <label className="mb-1 block text-sm font-medium text-slate-700">Service Name</label>
                    <input
                      value={formData.serviceName || ''}
                      onChange={(event) => setFormData((current) => ({ ...current, serviceName: event.target.value }))}
                      className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
                      placeholder="Checkout API"
                    />
                  </div>

                  <div>
                    <label className="mb-1 block text-sm font-medium text-slate-700">Feature</label>
                    <input
                      value={formData.featureName || ''}
                      onChange={(event) => setFormData((current) => ({ ...current, featureName: event.target.value }))}
                      className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
                      placeholder="Customer payments"
                    />
                  </div>

                  <div>
                    <label className="mb-1 block text-sm font-medium text-slate-700">Customer Journey</label>
                    <input
                      value={formData.customerJourney || ''}
                      onChange={(event) => setFormData((current) => ({ ...current, customerJourney: event.target.value }))}
                      className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
                      placeholder="Sign-up to checkout"
                    />
                  </div>

                  <div>
                    <label className="mb-1 block text-sm font-medium text-slate-700">Team Owner</label>
                    <input
                      value={formData.teamOwner || ''}
                      onChange={(event) => setFormData((current) => ({ ...current, teamOwner: event.target.value }))}
                      className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
                      placeholder="Growth Engineering"
                    />
                  </div>

                  <div>
                    <label className="mb-1 block text-sm font-medium text-slate-700">Region</label>
                    <input
                      value={formData.region || ''}
                      onChange={(event) => setFormData((current) => ({ ...current, region: event.target.value }))}
                      className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
                      placeholder="India / APAC"
                    />
                  </div>

                  <div>
                    <label className="mb-1 block text-sm font-medium text-slate-700">Business Criticality</label>
                    <select
                      value={formData.businessCriticality || 'MEDIUM'}
                      onChange={(event) => setFormData((current) => ({ ...current, businessCriticality: event.target.value as CreateMonitorPayload['businessCriticality'] }))}
                      className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm"
                    >
                      <option value="LOW">Low</option>
                      <option value="MEDIUM">Medium</option>
                      <option value="HIGH">High</option>
                      <option value="CRITICAL">Critical</option>
                    </select>
                  </div>

                  <div>
                    <label className="mb-1 block text-sm font-medium text-slate-700">SLA Tier</label>
                    <select
                      value={formData.slaTier || 'STANDARD'}
                      onChange={(event) => setFormData((current) => ({ ...current, slaTier: event.target.value as CreateMonitorPayload['slaTier'] }))}
                      className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm"
                    >
                      <option value="STANDARD">Standard</option>
                      <option value="PREMIUM">Premium</option>
                      <option value="ENTERPRISE">Enterprise</option>
                    </select>
                  </div>
                </div>
              </section>
            </div>
          </div>

          <div className="flex justify-end gap-3 border-t border-slate-200 bg-white px-6 py-4">
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={createMutation.isPending || !projectId}
              className="inline-flex items-center rounded-xl bg-green-500 px-4 py-2 text-sm font-medium text-white hover:bg-green-600 disabled:opacity-50"
            >
              {createMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : (initialData ? 'Save Changes' : 'Create Monitor')}
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
    refetchInterval: 10000,
  });

  const { data: projects = [] } = useQuery<Project[]>({
    queryKey: ['projects'],
    queryFn: async () => {
      const { data } = await axiosPrivate.get<Project[]>('/projects');
      return data;
    },
  });

  const { data: subDetails = null } = useQuery<SubscriptionDetails>({
    queryKey: ['billingSubscription'],
    queryFn: async () => {
      const { data } = await axiosPrivate.get<SubscriptionDetails>('/billing/subscription');
      return data;
    },
  });

  const togglePauseMutation = useMutation({
    mutationFn: toggleMonitorPause,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['monitors'] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteMonitor(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['monitors'] });
    },
  });

  const summary = useMemo(() => {
    const up = monitors.filter((m) => m.status === 'UP').length;
    const down = monitors.filter((m) => m.status === 'DOWN').length;
    const degraded = monitors.filter((m) => m.status === 'DEGRADED').length;
    const responseSamples = monitors
      .map((m) => m.avgResponseTimeMs)
      .filter((v): v is number => typeof v === 'number' && v > 0);
    const avgResponse = responseSamples.length
      ? Math.round(responseSamples.reduce((a, b) => a + b, 0) / responseSamples.length)
      : null;

    return {
      total: monitors.length,
      up,
      issues: down + degraded,
      avgResponse,
    };
  }, [monitors]);

  if (isLoading) return <div className="flex justify-center p-12"><Loader2 className="animate-spin" /></div>;
  if (isError) return <div className="rounded-xl border border-red-100 bg-red-50 p-8 text-red-500">Error loading monitors</div>;

  const monitorUsageLabel = subDetails
    ? `${subDetails.usage.monitorsUsed} / ${subDetails.usage.monitorsLimit > 100000 ? 'Unlimited' : subDetails.usage.monitorsLimit}`
    : null;
  const isCreationBlocked = Boolean(subDetails && !subDetails.canCreateMonitors);

  return (
    <div className="mx-auto max-w-7xl space-y-6 pb-10">
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Monitors</h1>
          <p className="text-sm text-slate-500">Track endpoint health and availability.</p>
          {subDetails ? (
            <p className="mt-2 text-xs font-medium text-slate-600">
              Plan usage: <span className="text-slate-900">{monitorUsageLabel}</span> monitors on {subDetails.plan}. Minimum interval: {subDetails.usage.minimumIntervalSeconds}s.
            </p>
          ) : null}
        </div>
        <div className="flex items-center gap-3">
          <Link to="/billing" className="text-sm font-medium text-slate-600 underline underline-offset-2 hover:text-slate-900">
            Upgrade plan
          </Link>
          <button
            onClick={() => setModalOpen(true)}
            disabled={isCreationBlocked}
            className="flex items-center gap-2 rounded-xl bg-green-500 px-4 py-2 font-medium text-white transition-colors hover:bg-green-600"
          >
            <Plus className="h-4 w-4" /> Add Monitor
          </button>
        </div>
      </div>

      {subDetails?.status === 'TRIALING' ? (
        <UpgradePrompt reason="trial_expiring" />
      ) : null}

      {subDetails?.status === 'EXPIRED' || subDetails?.status === 'CANCELLED' ? (
        <UpgradePrompt reason="expired" />
      ) : null}

      {subDetails && subDetails.usage.monitorsUsed >= subDetails.usage.monitorsLimit ? (
        <UpgradePrompt reason="monitor_limit" />
      ) : null}

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-4">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3 lg:col-span-3">
          <SummaryCard
            title="Coverage"
            value={summary.total}
            detail={`${summary.up} services healthy`}
            icon={Activity}
            accent="bg-sky-50 text-sky-600"
          />
          <SummaryCard
            title="Issues"
            value={summary.issues}
            detail="Requires attention"
            icon={ShieldAlert}
            accent="bg-amber-50 text-amber-600"
          />
          <SummaryCard
            title="Avg. Latency"
            value={formatResponseTime(summary.avgResponse)}
            detail="Across all nodes"
            icon={Gauge}
            accent="bg-violet-50 text-violet-600"
          />
        </div>

        <div className="lg:col-span-1">
          <QuickStartCard type="monitoring" />
        </div>
      </div>

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        {monitors.length === 0 ? (
          <div className="space-y-4 p-20 text-center">
            <Activity className="mx-auto h-12 w-12 text-slate-300" />
            <p className="text-slate-500">No monitors active in this workspace.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-slate-200 bg-slate-50 text-slate-500">
                <tr>
                  <th className="px-6 py-4 text-[10px] font-semibold uppercase tracking-wider">Endpoint</th>
                  <th className="px-6 py-4 text-[10px] font-semibold uppercase tracking-wider">Status</th>
                  <th className="px-6 py-4 text-[10px] font-semibold uppercase tracking-wider">Latency</th>
                  <th className="px-6 py-4 text-[10px] font-semibold uppercase tracking-wider">Uptime</th>
                  <th className="px-6 py-4 text-[10px] font-semibold uppercase tracking-wider">Insight</th>
                  <th className="px-6 py-4 text-right text-[10px] font-semibold uppercase tracking-wider">Control</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {monitors.map((m) => {
                  const isPaused = m.status === 'PAUSED';
                  return (
                    <tr key={m.id} className="transition-colors hover:bg-slate-50/50">
                      <td className="px-6 py-4">
                        <Link to={`/monitors/${m.id}`} className="block">
                          <div className="flex items-center gap-2">
                             <div className="font-bold text-slate-900 hover:text-blue-600 truncate max-w-[200px]">{m.name}</div>
                             {m.type && <TypeBadge type={m.type} />}
                          </div>
                          <div className="mt-0.5 font-mono text-xs text-slate-400 truncate max-w-[250px]">{m.url}</div>
                        </Link>
                      </td>
                      <td className="px-6 py-4">
                        <StatusBadge status={m.status} />
                      </td>
                      <td className="px-6 py-4 font-medium text-slate-600">
                        {formatResponseTime(m.avgResponseTimeMs)}
                      </td>
                      <td className="px-6 py-4 font-medium text-slate-600">
                        {formatAvailability(m.uptimePercentage)}
                      </td>
                      <td className="px-6 py-4 text-sm text-slate-500 max-w-[200px]">
                        {m.type === 'SSL' && m.metadata?.daysRemaining !== undefined ? (
                          <div className="flex flex-col gap-0.5">
                            <span className="text-xs font-semibold text-slate-700">Expires in {m.metadata.daysRemaining} days</span>
                            <span className="text-[10px] text-slate-400 truncate">{m.metadata.issuer}</span>
                          </div>
                        ) : m.type === 'DNS' && m.metadata?.resolvedIps ? (
                          <div className="flex flex-wrap gap-1">
                            {m.metadata.resolvedIps.slice(0, 2).map((ip: string) => (
                              <span key={ip} className="px-1 py-0.5 bg-slate-100 rounded text-[9px] font-mono border border-slate-200">{ip}</span>
                            ))}
                            {m.metadata.resolvedIps.length > 2 && <span className="text-[9px] text-slate-400">+{m.metadata.resolvedIps.length - 2} more</span>}
                          </div>
                        ) : m.metadata?.missingKeywords && m.metadata.missingKeywords.length > 0 ? (
                           <span className="inline-flex items-center text-xs text-amber-700 bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
                             <AlertTriangle className="w-3 h-3 mr-1" /> Missing keywords
                           </span>
                        ) : (
                          <div className="space-y-1">
                            <span className="truncate block font-medium text-slate-700">
                              {m.latestDiagnosis?.summary || m.lastErrorMessage || (m.latestStatusCode ? `HTTP ${m.latestStatusCode}` : 'Healthy')}
                            </span>
                            {m.latestDiagnosis ? (
                              <span className={`block text-[11px] ${confidenceTone(m.latestDiagnosis.confidence)}`}>
                                Confidence {m.latestDiagnosis.confidence}%{m.latestDiagnosis.isLikelyOutage ? ' • likely outage' : ' • access/config issue'}
                              </span>
                            ) : null}
                            {m.impactMetadata?.featureName || m.impactMetadata?.businessCriticality ? (
                              <span className="block text-[10px] uppercase tracking-wide text-slate-400">
                                {(m.impactMetadata?.featureName || 'Unmapped feature')} • {(m.impactMetadata?.businessCriticality || 'MEDIUM')} impact
                              </span>
                            ) : null}
                          </div>
                        )}
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            onClick={() => {
                              setEditingMonitor(m);
                              setModalOpen(true);
                            }}
                            className="rounded-full p-2 transition-colors hover:bg-blue-50 text-blue-400 hover:text-blue-600"
                            title="Edit Monitor"
                          >
                            <Pencil className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => togglePauseMutation.mutate({ id: m.id, isPaused })}
                            className="rounded-full p-2 transition-colors hover:bg-slate-100"
                            title={isPaused ? 'Resume' : 'Pause'}
                          >
                            {isPaused ? <Play className="h-4 w-4 text-green-500" /> : <Pause className="h-4 w-4 text-slate-400" />}
                          </button>
                          <button
                            onClick={() => {
                              if (window.confirm('Are you sure you want to delete this monitor?')) {
                                deleteMutation.mutate(m.id);
                              }
                            }}
                            className={`rounded-full p-2 transition-colors ${isPaused ? 'hover:bg-red-50 text-red-400 hover:text-red-600' : 'opacity-20 cursor-not-allowed'}`}
                            title={isPaused ? 'Delete' : 'Pause monitor first to delete'}
                            disabled={!isPaused}
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

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

