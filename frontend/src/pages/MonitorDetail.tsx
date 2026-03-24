import { Suspense, lazy, useMemo } from 'react';
import type { ElementType, ReactNode } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  Activity,
  AlertTriangle,
  ArrowLeft,
  BellRing,
  Clock3,
  Cpu,
  Gauge,
  Globe,
  Layers3,
  Loader2,
  Server,
  Shield,
  ShieldAlert,
  TrendingUp,
} from 'lucide-react';
import { axiosPrivate } from '../services/api';

const MonitorResponseTimeChart = lazy(() => import('../components/MonitorResponseTimeChart'));

interface MonitorAlertSummary {
  id: string;
  channel: string;
  status: 'TRIGGERED' | 'ACKNOWLEDGED' | 'RESOLVED';
  message: string;
  deliveryAttempts?: number;
  lastDeliveredAt?: string | null;
  lastSuppressedAt?: string | null;
  deliveryError?: string | null;
  createdAt: string;
  resolvedAt?: string | null;
}

interface Monitor {
  id: string;
  name: string;
  url: string;
  httpMethod: string;
  status: 'UP' | 'DOWN' | 'PAUSED' | 'DEGRADED';
  intervalSeconds: number;
  timeoutMs: number;
  lastCheckedAt?: string | null;
  avgResponseTimeMs?: number | null;
  latestResponseTimeMs?: number | null;
  uptimePercentage?: number | null;
  recentChecksCount?: number;
  latestStatusCode?: number | null;
  lastErrorMessage?: string | null;
  hasActiveAlert?: boolean;
  recentAlerts?: MonitorAlertSummary[];
  impactMetadata?: {
    serviceName?: string | null;
    featureName?: string | null;
    customerJourney?: string | null;
    teamOwner?: string | null;
    region?: string | null;
    businessCriticality: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
    slaTier: 'STANDARD' | 'PREMIUM' | 'ENTERPRISE';
  };
}

interface CheckResult {
  id: string;
  status: 'SUCCESS' | 'FAILURE' | 'TIMEOUT' | 'ERROR';
  statusCode: number | null;
  responseTimeMs: number | null;
  errorMessage: string | null;
  checkedAt: string;
}

interface CheckResultsResponse {
  data: CheckResult[];
}

interface IncidentSummary {
  id: string;
  status: 'INVESTIGATING' | 'IDENTIFIED' | 'RESOLVED';
  message: string;
  createdAt: string;
  resolvedAt?: string | null;
  durationMs: number;
}

interface IncidentTimelineEntry {
  id: string;
  type: string;
  title: string;
  description: string;
  timestamp: string;
}

interface CorrelatedChange {
  id: string;
  type: 'DEPLOY' | 'CONFIG' | 'DNS' | 'FEATURE_FLAG' | 'SSL' | 'SECRET' | 'INFRASTRUCTURE' | 'RELEASE' | 'MANUAL';
  source: 'MANUAL' | 'API' | 'GITHUB' | 'VERCEL' | 'RAILWAY' | 'SYSTEM';
  title: string;
  summary?: string | null;
  serviceName?: string | null;
  environment?: string | null;
  version?: string | null;
  happenedAt: string;
  confidence: number;
  minutesFromIncidentStart: number;
  confidenceSignals?: string[];
  recommendedAction?: string;
}

interface IncidentDetail extends IncidentSummary {
  timeline: IncidentTimelineEntry[];
  relatedChanges: CorrelatedChange[];
  likelyTrigger?: CorrelatedChange | null;
}

const formatResponseTime = (value?: number | null) => {
  if (typeof value !== 'number' || value <= 0) return 'No data';
  return `${value}ms`;
};

const formatPercentage = (value?: number | null) => {
  if (typeof value !== 'number') return 'No data';
  return `${value.toFixed(1)}%`;
};

const formatDateTime = (value?: string | null) => {
  if (!value) return 'Not checked yet';
  return new Date(value).toLocaleString();
};

const formatDuration = (durationMs?: number | null) => {
  if (typeof durationMs !== 'number' || durationMs < 0) return 'In progress';
  const totalMinutes = Math.floor(durationMs / 60_000);
  if (totalMinutes < 1) return 'Under a minute';
  if (totalMinutes < 60) return `${totalMinutes}m`;
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return minutes === 0 ? `${hours}h` : `${hours}h ${minutes}m`;
};

const getAlertDeliveryState = (alert: MonitorAlertSummary) => {
  if (alert.lastSuppressedAt) {
    return {
      label: 'Suppressed by throttle',
      tone: 'border-amber-200 bg-amber-50 text-amber-700',
      detail: `Last suppressed ${formatDateTime(alert.lastSuppressedAt)}`,
    };
  }

  if (alert.lastDeliveredAt) {
    return {
      label: 'Delivered',
      tone: 'border-emerald-200 bg-emerald-50 text-emerald-700',
      detail: `Last delivered ${formatDateTime(alert.lastDeliveredAt)}`,
    };
  }

  if (alert.deliveryError) {
    return {
      label: 'Delivery issue',
      tone: 'border-rose-200 bg-rose-50 text-rose-700',
      detail: alert.deliveryError,
    };
  }

  return {
    label: 'Queued',
    tone: 'border-sky-200 bg-sky-50 text-sky-700',
    detail: 'Waiting for delivery processing',
  };
};

const statusTone = (status: Monitor['status']) => {
  if (status === 'UP') return 'bg-green-100 text-green-800 border-green-200';
  if (status === 'DOWN') return 'bg-red-100 text-red-800 border-red-200';
  if (status === 'DEGRADED') return 'bg-amber-100 text-amber-800 border-amber-200';
  return 'bg-slate-100 text-slate-700 border-slate-200';
};

const alertTone = (status: MonitorAlertSummary['status']) => {
  if (status === 'RESOLVED') return 'bg-green-100 text-green-800 border-green-200';
  if (status === 'ACKNOWLEDGED') return 'bg-amber-100 text-amber-800 border-amber-200';
  return 'bg-red-100 text-red-800 border-red-200';
};

const StatusBadge = ({ status }: { status: Monitor['status'] }) => (
  <span className={`inline-flex items-center rounded-full border px-3 py-1 text-sm font-semibold ${statusTone(status)}`}>
    {status}
  </span>
);

const CheckStatusBadge = ({ status }: { status: CheckResult['status'] }) => {
  if (status === 'SUCCESS') return <span className="font-medium text-green-600">SUCCESS</span>;
  if (status === 'TIMEOUT') return <span className="font-medium text-amber-600">TIMEOUT</span>;
  return <span className="font-medium text-red-600">{status}</span>;
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
  icon: ElementType;
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

const Panel = ({
  title,
  description,
  icon: Icon,
  children,
  className = '',
}: {
  title: string;
  description: string;
  icon: ElementType;
  children: ReactNode;
  className?: string;
}) => (
  <div className={`rounded-2xl border border-slate-200 bg-white p-6 shadow-sm ${className}`}>
    <div className="flex items-start justify-between gap-4">
      <div>
        <h2 className="text-lg font-semibold text-slate-900">{title}</h2>
        <p className="mt-1 text-sm text-slate-500">{description}</p>
      </div>
      <Icon className="h-5 w-5 text-slate-400" />
    </div>
    <div className="mt-6">{children}</div>
  </div>
);

const EmptyState = ({
  message,
  tone = 'slate',
}: {
  message: string;
  tone?: 'slate' | 'emerald' | 'amber';
}) => {
  const toneClasses =
    tone === 'emerald'
      ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
      : tone === 'amber'
        ? 'border-amber-200 bg-amber-50 text-amber-800'
        : 'border-slate-200 bg-slate-50 text-slate-500';

  return <div className={`rounded-2xl border p-4 text-sm ${toneClasses}`}>{message}</div>;
};

export default function MonitorDetail() {
  const { id } = useParams<{ id: string }>();

  const { data: monitor, isLoading: isMonitorLoading, isError: isMonitorError } = useQuery({
    queryKey: ['monitor', id],
    queryFn: async () => {
      const { data } = await axiosPrivate.get<Monitor>(`/monitors/${id}`);
      return data;
    },
    enabled: !!id,
    refetchInterval: 10_000,
  });

  const { data: checks = [], isLoading: isChecksLoading } = useQuery({
    queryKey: ['checks', id],
    queryFn: async () => {
      const { data } = await axiosPrivate.get<CheckResultsResponse>(`/checks?monitorId=${id}&limit=50`);
      return data.data;
    },
    enabled: !!id,
    refetchInterval: 10_000,
  });

  const { data: incidents = [] } = useQuery({
    queryKey: ['incidents', id],
    queryFn: async () => {
      const { data } = await axiosPrivate.get<IncidentSummary[]>(`/incidents?monitorId=${id}&limit=5`);
      return data;
    },
    enabled: !!id,
    refetchInterval: 10_000,
  });

  const latestIncidentId = incidents[0]?.id;

  const { data: latestIncident } = useQuery({
    queryKey: ['incident', latestIncidentId],
    queryFn: async () => {
      const { data } = await axiosPrivate.get<IncidentDetail>(`/incidents/${latestIncidentId}`);
      return data;
    },
    enabled: !!latestIncidentId,
    refetchInterval: 10_000,
  });

  const recentFailures = useMemo(() => checks.filter((check) => check.status !== 'SUCCESS').length, [checks]);

  const detailInsights = useMemo(() => {
    const recentWindow = checks.slice(0, 20);
    const successful = recentWindow.filter((check) => check.status === 'SUCCESS').length;
    const failureCount = recentWindow.filter((check) => check.status === 'FAILURE').length;
    const timeoutCount = recentWindow.filter((check) => check.status === 'TIMEOUT').length;
    const errorCount = recentWindow.filter((check) => check.status === 'ERROR').length;
    const successRate = recentWindow.length ? Math.round((successful / recentWindow.length) * 100) : 0;
    const latestFailure = checks.find((check) => check.status !== 'SUCCESS') || null;
    const activeIncidents = incidents.filter((incident) => incident.status !== 'RESOLVED');
    const resolvedIncidents = incidents.filter((incident) => incident.status === 'RESOLVED');
    const recentAlerts = monitor?.recentAlerts || [];
    const deliveryIssues = recentAlerts.filter((alert) => Boolean(alert.deliveryError)).length;
    const deliveredAlerts = recentAlerts.filter((alert) => Boolean(alert.lastDeliveredAt)).length;

    return {
      recentWindow: recentWindow.length,
      successRate,
      failureCount,
      timeoutCount,
      errorCount,
      latestFailure,
      activeIncidents,
      resolvedIncidents,
      deliveryIssues,
      deliveredAlerts,
    };
  }, [checks, incidents, monitor?.recentAlerts]);

  const successCount = Math.max(
    0,
    detailInsights.recentWindow -
      detailInsights.failureCount -
      detailInsights.timeoutCount -
      detailInsights.errorCount,
  );

  const recentAlerts = monitor?.recentAlerts ?? [];
  const impactMetadata = monitor?.impactMetadata;

  if (isMonitorLoading) {
    return (
      <div className="flex min-h-[400px] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-slate-400" />
      </div>
    );
  }

  if (isMonitorError || !monitor) {
    return (
      <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-red-700">
        <div className="flex items-center gap-3">
          <AlertTriangle className="h-5 w-5" />
          The requested monitor could not be found or you do not have permission to view it.
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-[1560px] space-y-8 pb-10">
      <section className="overflow-hidden rounded-[32px] border border-slate-200 bg-[radial-gradient(circle_at_top_left,_rgba(45,212,191,0.18),_transparent_30%),linear-gradient(135deg,_#020617_0%,_#0f172a_45%,_#134e4a_100%)] p-6 text-white shadow-xl sm:p-8">
        <div className="flex flex-col gap-8 xl:flex-row xl:items-start xl:justify-between">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-3">
              <Link
                to="/monitors"
                className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/10 px-3 py-2 text-sm font-medium text-slate-100 transition hover:bg-white/15"
              >
                <ArrowLeft className="h-4 w-4" />
                Back to monitors
              </Link>
              <span className="rounded-full border border-white/10 bg-white/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.22em] text-teal-100">
                Monitor Control Room
              </span>
            </div>

            <div className="mt-6 flex flex-wrap items-center gap-3">
              <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">{monitor.name}</h1>
              <StatusBadge status={monitor.status} />
              {monitor.hasActiveAlert ? (
                <span className="inline-flex items-center rounded-full border border-rose-200/70 bg-rose-50 px-3 py-1 text-sm font-semibold text-rose-700">
                  Alert active
                </span>
              ) : null}
            </div>

            <div className="mt-4 flex flex-wrap items-center gap-2 text-sm text-slate-200">
              <span className="rounded-full border border-white/10 bg-white/10 px-2.5 py-1 text-xs font-semibold">
                {monitor.httpMethod}
              </span>
              <a
                href={monitor.url}
                target="_blank"
                rel="noreferrer"
                className="inline-flex max-w-full items-center gap-2 rounded-full border border-white/10 bg-white/10 px-3 py-1 text-xs font-medium transition hover:bg-white/15"
              >
                <span className="truncate">{monitor.url}</span>
                <Globe className="h-3.5 w-3.5 shrink-0" />
              </a>
            </div>

            <p className="mt-5 max-w-3xl text-sm leading-6 text-slate-300">
              Live health, response behavior, incident pressure, alert delivery, and correlated changes are gathered here so one endpoint can be reviewed like its own control room.
            </p>
          </div>

          <div className="grid min-w-0 gap-3 sm:grid-cols-2 xl:w-[360px]">
            <div className="rounded-2xl border border-white/10 bg-white/10 p-4 backdrop-blur">
              <p className="text-sm text-slate-300">Availability</p>
              <p className="mt-2 text-2xl font-semibold">{formatPercentage(monitor.uptimePercentage)}</p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/10 p-4 backdrop-blur">
              <p className="text-sm text-slate-300">Average response</p>
              <p className="mt-2 text-2xl font-semibold">{formatResponseTime(monitor.avgResponseTimeMs)}</p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/10 p-4 backdrop-blur">
              <p className="text-sm text-slate-300">Open incidents</p>
              <p className="mt-2 text-2xl font-semibold">{detailInsights.activeIncidents.length}</p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/10 p-4 backdrop-blur">
              <p className="text-sm text-slate-300">Recent success rate</p>
              <p className="mt-2 text-2xl font-semibold">
                {detailInsights.recentWindow ? `${detailInsights.successRate}%` : 'No data'}
              </p>
            </div>
          </div>
        </div>
      </section>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        <SummaryCard
          title="Average response"
          value={formatResponseTime(monitor.avgResponseTimeMs)}
          detail={`Latest ${formatResponseTime(monitor.latestResponseTimeMs)}`}
          icon={Gauge}
          accent="bg-violet-50 text-violet-600"
        />
        <SummaryCard
          title="Check cadence"
          value={`${monitor.intervalSeconds}s`}
          detail={`Timeout ${monitor.timeoutMs}ms`}
          icon={Clock3}
          accent="bg-sky-50 text-sky-600"
        />
        <SummaryCard
          title="Failure signals"
          value={recentFailures}
          detail={monitor.lastErrorMessage || 'No recent failure message'}
          icon={ShieldAlert}
          accent="bg-amber-50 text-amber-600"
        />
        <SummaryCard
          title="Alert delivery"
          value={detailInsights.deliveredAlerts}
          detail={
            detailInsights.deliveryIssues
              ? `${detailInsights.deliveryIssues} delivery issue(s)`
              : 'Delivery looks healthy'
          }
          icon={BellRing}
          accent="bg-emerald-50 text-emerald-600"
        />
      </div>

      <section className="grid gap-6 xl:grid-cols-[1.7fr_1fr]">
        <div className="space-y-6">
          <div className="grid gap-6 lg:grid-cols-2">
            <Panel
              title="Reliability Posture"
              description="A quick read on current health, response quality, and incident pressure."
              icon={TrendingUp}
            >
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Success rate</p>
                  <p className="mt-2 text-2xl font-semibold text-slate-900">
                    {detailInsights.recentWindow ? `${detailInsights.successRate}%` : 'No data'}
                  </p>
                  <p className="mt-1 text-sm text-slate-500">
                    Based on the latest {detailInsights.recentWindow || 0} checks
                  </p>
                </div>
                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Incident load</p>
                  <p className="mt-2 text-2xl font-semibold text-slate-900">
                    {detailInsights.activeIncidents.length}
                  </p>
                  <p className="mt-1 text-sm text-slate-500">
                    {detailInsights.resolvedIncidents.length} resolved in recent history
                  </p>
                </div>
                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Latest failure</p>
                  <p className="mt-2 font-semibold text-slate-900">
                    {detailInsights.latestFailure ? detailInsights.latestFailure.status : 'None'}
                  </p>
                  <p className="mt-1 text-sm text-slate-500">
                    {detailInsights.latestFailure
                      ? formatDateTime(detailInsights.latestFailure.checkedAt)
                      : 'No recent failure signal'}
                  </p>
                </div>
                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                    Latest HTTP code
                  </p>
                  <p className="mt-2 text-2xl font-semibold text-slate-900">
                    {monitor.latestStatusCode ?? 'No data'}
                  </p>
                  <p className="mt-1 text-sm text-slate-500">Most recent observed response</p>
                </div>
              </div>
            </Panel>

            <Panel
              title="Signal Breakdown"
              description="The last checks split by success, failure, timeout, and error."
              icon={Cpu}
            >
              <div className="space-y-4">
                {[
                  { label: 'Success', value: successCount, tone: 'bg-emerald-500' },
                  { label: 'Failure', value: detailInsights.failureCount, tone: 'bg-rose-500' },
                  { label: 'Timeout', value: detailInsights.timeoutCount, tone: 'bg-amber-500' },
                  { label: 'Error', value: detailInsights.errorCount, tone: 'bg-slate-500' },
                ].map((entry) => {
                  const width = detailInsights.recentWindow
                    ? Math.max(6, (entry.value / detailInsights.recentWindow) * 100)
                    : 0;

                  return (
                    <div key={entry.label}>
                      <div className="mb-1.5 flex items-center justify-between gap-3">
                        <p className="font-medium text-slate-900">{entry.label}</p>
                        <span className="text-sm font-semibold text-slate-600">{entry.value}</span>
                      </div>
                      <div className="h-2 rounded-full bg-slate-200">
                        <div className={`h-2 rounded-full ${entry.tone}`} style={{ width: `${width}%` }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </Panel>
          </div>

          <Panel
            title="Performance Trend"
            description="Response-time behavior rendered as a larger analytical view."
            icon={Activity}
          >
            {isChecksLoading ? (
              <div className="flex h-[320px] items-center justify-center rounded-2xl border border-slate-200 bg-slate-50">
                <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
              </div>
            ) : (
              <Suspense
                fallback={
                  <div className="flex h-[320px] items-center justify-center rounded-2xl border border-slate-200 bg-slate-50 text-sm text-slate-500">
                    Loading chart view...
                  </div>
                }
              >
                <MonitorResponseTimeChart checks={checks} />
              </Suspense>
            )}
          </Panel>

          <Panel
            title="Latest Incident Timeline"
            description="The newest outage window for this endpoint, including trigger and recovery events."
            icon={ShieldAlert}
          >
            {!latestIncident ? (
              <EmptyState tone="emerald" message="No incidents recorded for this monitor yet." />
            ) : (
              <div className="space-y-4">
                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-slate-900">{latestIncident.message}</p>
                      <p className="mt-1 text-xs text-slate-500">
                        Started {formatDateTime(latestIncident.createdAt)}
                        {latestIncident.resolvedAt
                          ? ` / Resolved ${formatDateTime(latestIncident.resolvedAt)}`
                          : ' / Still open'}
                      </p>
                    </div>
                    <span
                      className={`rounded-full border px-3 py-1 text-xs font-semibold ${
                        latestIncident.status === 'RESOLVED'
                          ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                          : 'border-amber-200 bg-amber-50 text-amber-700'
                      }`}
                    >
                      {latestIncident.status} / {formatDuration(latestIncident.durationMs)}
                    </span>
                  </div>
                </div>

                <div className="space-y-3">
                  {latestIncident.timeline.map((entry) => (
                    <div key={entry.id} className="flex gap-4 rounded-2xl border border-slate-200 p-4">
                      <div className="mt-1 h-2.5 w-2.5 shrink-0 rounded-full bg-teal-600" />
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center justify-between gap-3">
                          <p className="text-sm font-semibold text-slate-900">{entry.title}</p>
                          <p className="text-xs text-slate-400">{formatDateTime(entry.timestamp)}</p>
                        </div>
                        <p className="mt-1 text-sm text-slate-600">{entry.description}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </Panel>

          <Panel
            title="Change Intelligence"
            description="Recent deploys and configuration events that overlap with this incident window."
            icon={Layers3}
          >
            {!latestIncident ? (
              <EmptyState message="Change correlation appears once an incident exists for this monitor." />
            ) : latestIncident.relatedChanges.length === 0 ? (
              <EmptyState tone="amber" message="No relevant change events were found near this incident window." />
            ) : (
              <div className="space-y-4">
                {latestIncident.likelyTrigger ? (
                  <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4">
                    <p className="text-xs font-semibold uppercase tracking-[0.22em] text-rose-600">
                      Likely trigger
                    </p>
                    <p className="mt-3 text-lg font-semibold text-rose-800">
                      {latestIncident.likelyTrigger.title}
                    </p>
                    <p className="mt-2 text-sm text-rose-700">
                      Confidence {latestIncident.likelyTrigger.confidence}% /{' '}
                      {latestIncident.likelyTrigger.minutesFromIncidentStart} min from incident start
                    </p>
                    {latestIncident.likelyTrigger.confidenceSignals?.length ? (
                      <div className="mt-3 flex flex-wrap gap-2">
                        {latestIncident.likelyTrigger.confidenceSignals.slice(0, 3).map((signal) => (
                          <span
                            key={signal}
                            className="rounded-full border border-rose-200 px-3 py-1 text-xs text-rose-700"
                          >
                            {signal}
                          </span>
                        ))}
                      </div>
                    ) : null}
                    {latestIncident.likelyTrigger.recommendedAction ? (
                      <p className="mt-3 text-sm text-rose-900">
                        {latestIncident.likelyTrigger.recommendedAction}
                      </p>
                    ) : null}
                  </div>
                ) : null}

                <div className="space-y-3">
                  {latestIncident.relatedChanges.map((change) => (
                    <div key={change.id} className="rounded-2xl border border-slate-200 p-4">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <div className="flex flex-wrap gap-2">
                            <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-semibold text-slate-700">
                              {change.type}
                            </span>
                            <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-semibold text-slate-700">
                              {change.source}
                            </span>
                          </div>
                          <p className="mt-3 text-lg font-semibold text-slate-900">{change.title}</p>
                          {change.summary ? (
                            <p className="mt-2 text-sm text-slate-600">{change.summary}</p>
                          ) : null}
                        </div>
                        <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-right">
                          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">
                            Confidence
                          </p>
                          <p className="mt-1 text-2xl font-semibold text-slate-900">{change.confidence}%</p>
                        </div>
                      </div>

                      <div className="mt-4 flex flex-wrap gap-2">
                        <span className="rounded-full border border-slate-200 px-3 py-1 text-xs text-slate-600">
                          Happened {formatDateTime(change.happenedAt)}
                        </span>
                        <span className="rounded-full border border-slate-200 px-3 py-1 text-xs text-slate-600">
                          {change.minutesFromIncidentStart} min from incident start
                        </span>
                        {change.serviceName ? (
                          <span className="rounded-full border border-slate-200 px-3 py-1 text-xs text-slate-600">
                            Service: {change.serviceName}
                          </span>
                        ) : null}
                        {change.environment ? (
                          <span className="rounded-full border border-slate-200 px-3 py-1 text-xs text-slate-600">
                            Env: {change.environment}
                          </span>
                        ) : null}
                        {change.version ? (
                          <span className="rounded-full border border-slate-200 px-3 py-1 text-xs text-slate-600">
                            Version: {change.version}
                          </span>
                        ) : null}
                      </div>
                      {change.confidenceSignals?.length ? (
                        <div className="mt-4 flex flex-wrap gap-2">
                          {change.confidenceSignals.map((signal) => (
                            <span
                              key={signal}
                              className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs text-slate-600"
                            >
                              {signal}
                            </span>
                          ))}
                        </div>
                      ) : null}
                      {change.recommendedAction ? (
                        <p className="mt-4 text-sm text-slate-700">{change.recommendedAction}</p>
                      ) : null}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </Panel>

          <Panel
            title="Check History"
            description="Latest execution results for this monitor, ordered from newest to oldest."
            icon={Activity}
          >
            {checks.length === 0 ? (
              <EmptyState message="Checks will appear here once the scheduler runs against this monitor." />
            ) : (
              <div className="overflow-hidden rounded-2xl border border-slate-200">
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-slate-200 text-sm">
                    <thead className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                      <tr>
                        <th className="px-4 py-3">Timestamp</th>
                        <th className="px-4 py-3">Status</th>
                        <th className="px-4 py-3">Code</th>
                        <th className="px-4 py-3">Response</th>
                        <th className="px-4 py-3">Message</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 bg-white">
                      {checks.slice(0, 20).map((check) => (
                        <tr key={check.id}>
                          <td className="px-4 py-3 text-slate-600">{formatDateTime(check.checkedAt)}</td>
                          <td className="px-4 py-3">
                            <CheckStatusBadge status={check.status} />
                          </td>
                          <td className="px-4 py-3 text-slate-700">{check.statusCode ?? '-'}</td>
                          <td className="px-4 py-3 text-slate-700">{formatResponseTime(check.responseTimeMs)}</td>
                          <td className="max-w-[340px] px-4 py-3 text-slate-500">
                            {check.errorMessage || '-'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </Panel>
        </div>

        <div className="space-y-6">
          <Panel
            title="Monitor Facts"
            description="Key technical details about how this endpoint is configured and observed."
            icon={Server}
          >
            <div className="space-y-4">
              {[
                { label: 'Last checked', value: formatDateTime(monitor.lastCheckedAt) },
                { label: 'Latest HTTP code', value: monitor.latestStatusCode ?? 'No data' },
                { label: 'Check interval', value: `${monitor.intervalSeconds}s` },
                { label: 'Timeout limit', value: `${monitor.timeoutMs}ms` },
                { label: 'Recent checks', value: monitor.recentChecksCount ?? checks.length },
                { label: 'Last error', value: monitor.lastErrorMessage || 'No active error' },
              ].map((fact) => (
                <div
                  key={fact.label}
                  className="flex items-start justify-between gap-4 border-b border-slate-100 pb-4 last:border-b-0 last:pb-0"
                >
                  <p className="text-sm text-slate-500">{fact.label}</p>
                  <p className="max-w-[60%] text-right text-sm font-semibold text-slate-900">{fact.value}</p>
                </div>
              ))}
            </div>
          </Panel>

          <Panel
            title="Business Impact Context"
            description="Phase B metadata used for ownership, severity, and impact-first decision making."
            icon={Shield}
          >
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-1 2xl:grid-cols-2">
              {[
                { label: 'Service', value: impactMetadata?.serviceName || 'Not mapped yet' },
                { label: 'Feature', value: impactMetadata?.featureName || 'Not mapped yet' },
                { label: 'Journey', value: impactMetadata?.customerJourney || 'Not mapped yet' },
                { label: 'Criticality', value: impactMetadata?.businessCriticality || 'MEDIUM' },
                { label: 'SLA tier', value: impactMetadata?.slaTier || 'STANDARD' },
                { label: 'Owner', value: impactMetadata?.teamOwner || 'Unassigned' },
                { label: 'Region', value: impactMetadata?.region || 'Global' },
              ].map((item) => (
                <div key={item.label} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">{item.label}</p>
                  <p className="mt-3 text-lg font-semibold text-slate-900">{item.value}</p>
                </div>
              ))}
            </div>
          </Panel>

          <Panel
            title="Recent Alerts"
            description="Incident-history notifications tied to this endpoint and their delivery state."
            icon={BellRing}
          >
            {recentAlerts.length === 0 ? (
              <EmptyState message="No alert notifications have been generated for this monitor yet." />
            ) : (
              <div className="space-y-4">
                {recentAlerts.slice(0, 5).map((alert) => {
                  const delivery = getAlertDeliveryState(alert);

                  return (
                    <div key={alert.id} className="rounded-2xl border border-slate-200 p-4">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className={`rounded-full border px-3 py-1 text-xs font-semibold ${alertTone(alert.status)}`}>
                          {alert.status}
                        </span>
                        <span className="rounded-full border border-slate-200 px-3 py-1 text-xs font-semibold text-slate-600">
                          {alert.channel}
                        </span>
                        <span className={`rounded-full border px-3 py-1 text-xs font-semibold ${delivery.tone}`}>
                          {delivery.label}
                        </span>
                        <span className="rounded-full border border-slate-200 px-3 py-1 text-xs text-slate-600">
                          Attempts: {alert.deliveryAttempts ?? 0}
                        </span>
                      </div>

                      <p className="mt-4 text-base font-medium text-slate-900">{alert.message}</p>
                      <p className="mt-2 text-sm text-slate-500">{delivery.detail}</p>
                      <p className="mt-2 text-xs text-slate-400">
                        Created {formatDateTime(alert.createdAt)}
                        {alert.resolvedAt ? ` / Resolved ${formatDateTime(alert.resolvedAt)}` : ''}
                      </p>
                    </div>
                  );
                })}
              </div>
            )}
          </Panel>

          <Panel
            title="Incident Library"
            description="Recent outage windows recorded for this monitor."
            icon={Layers3}
          >
            {incidents.length === 0 ? (
              <EmptyState tone="emerald" message="No incidents have been recorded for this monitor yet." />
            ) : (
              <div className="space-y-3">
                {incidents.map((incident) => (
                  <div key={incident.id} className="rounded-2xl border border-slate-200 p-4">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold text-slate-900">{incident.message}</p>
                        <p className="mt-1 text-xs text-slate-500">
                          Started {formatDateTime(incident.createdAt)}
                        </p>
                      </div>
                      <span
                        className={`rounded-full border px-3 py-1 text-xs font-semibold ${
                          incident.status === 'RESOLVED'
                            ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                            : 'border-amber-200 bg-amber-50 text-amber-700'
                        }`}
                      >
                        {incident.status}
                      </span>
                    </div>
                    <p className="mt-3 text-sm text-slate-500">Duration {formatDuration(incident.durationMs)}</p>
                  </div>
                ))}
              </div>
            )}
          </Panel>
        </div>
      </section>
    </div>
  );
}
