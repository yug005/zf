import { Suspense, lazy, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import {
  Activity,
  AlertTriangle,
  ArrowLeft,
  BellRing,
  Clock3,
  Download,
  Gauge,
  Globe,
  Layers3,
  Loader2,
  RefreshCw,
  Shield,
  ShieldAlert,
  Sparkles,
  Zap,
} from 'lucide-react';
import { axiosPrivate } from '../services/api';
import { NextCheckCountdown } from '../components/NextCheckCountdown';

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

interface CheckDiagnosis {
  code: string;
  summary: string;
  detail: string;
  confidence: number;
  suggestedAction?: string;
  isLikelyOutage: boolean;
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
  latestDiagnosis?: CheckDiagnosis | null;
  hasActiveAlert?: boolean;
  recentAlerts?: MonitorAlertSummary[];
  latestResponseSnippet?: string | null;
  latestCheckMetadata?: Record<string, unknown> | null;
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
  diagnosis?: CheckDiagnosis | null;
}

interface CheckResultsResponse {
  data: CheckResult[];
  total: number;
  limit: number;
  offset: number;
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
  type: string;
  source: string;
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

type HistoryWindow = 'all' | 7 | 30;

const HISTORY_PAGE_SIZE = 100;
const surface =
  'rounded-[30px] border border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.05),rgba(255,255,255,0.025))] shadow-[0_24px_90px_rgba(0,0,0,0.26)] backdrop-blur-xl';

const formatResponseTime = (value?: number | null) => (typeof value === 'number' && value > 0 ? `${value}ms` : 'N/A');
const formatPercentage = (value?: number | null) => (typeof value === 'number' ? `${value.toFixed(1)}%` : 'N/A');
const formatDateTime = (value?: string | null) => (value ? new Date(value).toLocaleString() : 'Not available');

const formatDuration = (durationMs?: number | null) => {
  if (typeof durationMs !== 'number' || durationMs < 0) return 'In progress';
  const totalMinutes = Math.floor(durationMs / 60_000);
  if (totalMinutes < 1) return 'Under a minute';
  if (totalMinutes < 60) return `${totalMinutes}m`;
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return minutes === 0 ? `${hours}h` : `${hours}h ${minutes}m`;
};

function Panel({ title, subtitle, icon: Icon, children, action }: { title: string; subtitle: string; icon: React.ElementType; children: ReactNode; action?: ReactNode }) {
  return (
    <section className={`${surface} p-5`}>
      <div className="mb-5 flex items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-white/8 bg-white/[0.04] text-cyan-200">
            <Icon className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-white">{title}</h2>
            <p className="mt-1 text-sm text-slate-400">{subtitle}</p>
          </div>
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}

function EmptyState({ text }: { text: string }) {
  return <div className="rounded-[24px] border border-dashed border-white/10 bg-white/[0.02] px-4 py-8 text-center text-sm text-slate-400">{text}</div>;
}

function StatusBadge({ status }: { status: Monitor['status'] }) {
  const tone = {
    UP: 'border-emerald-400/15 bg-emerald-500/10 text-emerald-200',
    DOWN: 'border-rose-400/15 bg-rose-500/10 text-rose-200',
    DEGRADED: 'border-amber-400/15 bg-amber-500/10 text-amber-100',
    PAUSED: 'border-white/10 bg-white/[0.04] text-slate-300',
  }[status];

  return <span className={`inline-flex items-center rounded-full border px-3 py-1 text-xs font-semibold ${tone}`}>{status}</span>;
}

function SummaryCard({ label, value, helper }: { label: string; value: string | number; helper: string }) {
  return (
    <div className="rounded-[24px] border border-white/8 bg-white/[0.03] p-4">
      <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-500">{label}</p>
      <p className="mt-3 text-2xl font-black text-white">{value}</p>
      <p className="mt-2 text-sm text-slate-400">{helper}</p>
    </div>
  );
}

function CheckStatusBadge({ status }: { status: CheckResult['status'] }) {
  const tone =
    status === 'SUCCESS'
      ? 'text-emerald-200 border-emerald-400/15 bg-emerald-500/10'
      : status === 'TIMEOUT'
        ? 'text-amber-100 border-amber-400/15 bg-amber-500/10'
        : 'text-rose-200 border-rose-400/15 bg-rose-500/10';
  return <span className={`inline-flex rounded-full border px-3 py-1 text-xs font-semibold ${tone}`}>{status}</span>;
}

const historyWindowLabel = (window: HistoryWindow) => (window === 'all' ? 'All' : `${window}d`);

export default function MonitorDetail() {
  const { id } = useParams<{ id: string }>();
  const [historyWindow, setHistoryWindow] = useState<HistoryWindow>('all');
  const [isExportingWindow, setIsExportingWindow] = useState<7 | 30 | null>(null);

  const { data: monitor, isLoading: isMonitorLoading, isError: isMonitorError } = useQuery({
    queryKey: ['monitor', id],
    queryFn: async () => {
      const { data } = await axiosPrivate.get<Monitor>(`/monitors/${id}`);
      return data;
    },
    enabled: !!id,
    refetchInterval: 10_000,
  });

  const { data: checks = [] } = useQuery({
    queryKey: ['checks', id],
    queryFn: async () => {
      const { data } = await axiosPrivate.get<CheckResultsResponse>(`/checks?monitorId=${id}&limit=50`);
      return data.data;
    },
    enabled: !!id,
    refetchInterval: 10_000,
  });

  const { data: historyPages, isLoading: isHistoryLoading, isFetchingNextPage, hasNextPage, fetchNextPage } = useInfiniteQuery({
    queryKey: ['check-history', id, historyWindow],
    queryFn: async ({ pageParam = 0 }) => {
      const params = new URLSearchParams({
        monitorId: id!,
        limit: String(HISTORY_PAGE_SIZE),
        offset: String(pageParam),
      });
      if (historyWindow !== 'all') params.set('days', String(historyWindow));
      const { data } = await axiosPrivate.get<CheckResultsResponse>(`/checks?${params.toString()}`);
      return data;
    },
    enabled: !!id,
    initialPageParam: 0,
    getNextPageParam: (lastPage) => {
      const nextOffset = lastPage.offset + lastPage.data.length;
      return nextOffset < lastPage.total ? nextOffset : undefined;
    },
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

  const historyChecks = useMemo(() => historyPages?.pages.flatMap((page) => page.data) ?? [], [historyPages]);
  const historyTotal = historyPages?.pages[0]?.total ?? 0;
  const recentAlerts = monitor?.recentAlerts ?? [];

  const insights = useMemo(() => {
    const success = checks.filter((check) => check.status === 'SUCCESS').length;
    const failures = checks.filter((check) => check.status !== 'SUCCESS');
    return {
      successRate: checks.length ? Math.round((success / checks.length) * 100) : 0,
      failures,
      latestFailure: failures[0] ?? null,
      activeIncidents: incidents.filter((incident) => incident.status !== 'RESOLVED'),
      deliveredAlerts: recentAlerts.filter((alert) => alert.lastDeliveredAt).length,
      deliveryIssues: recentAlerts.filter((alert) => alert.deliveryError).length,
    };
  }, [checks, incidents, recentAlerts]);

  const handleExport = async (days: 7 | 30) => {
    if (!id || !monitor) return;
    try {
      setIsExportingWindow(days);
      const { data } = await axiosPrivate.get(`/checks/export?monitorId=${id}&days=${days}`, { responseType: 'blob' });
      const blob = new Blob([data], { type: 'text/csv;charset=utf-8;' });
      const url = window.URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = `${monitor.name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-history-${days}d.csv`;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      window.URL.revokeObjectURL(url);
    } finally {
      setIsExportingWindow(null);
    }
  };

  if (isMonitorLoading) {
    return <div className="flex min-h-[400px] items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-cyan-300" /></div>;
  }

  if (isMonitorError || !monitor) {
    return <div className={`${surface} p-6 text-rose-200`}>The requested monitor could not be found or you do not have permission to view it.</div>;
  }

  return (
    <div className="mx-auto max-w-[1560px] space-y-6 pb-10">
      <section className="rounded-[34px] border border-cyan-400/12 bg-[radial-gradient(circle_at_top_left,rgba(34,211,238,0.18),transparent_35%),linear-gradient(135deg,rgba(255,255,255,0.06),rgba(255,255,255,0.02))] p-6 shadow-[0_30px_100px_rgba(0,0,0,0.28)]">
        <div className="flex flex-col gap-6 xl:flex-row xl:items-start xl:justify-between">
          <div className="max-w-3xl">
            <div className="flex flex-wrap items-center gap-3">
              <Link to="/monitors" className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.05] px-4 py-2 text-sm font-semibold text-slate-100 transition hover:bg-white/[0.08]">
                <ArrowLeft className="h-4 w-4" />
                Back to monitors
              </Link>
              <span className="rounded-full border border-cyan-400/15 bg-cyan-400/10 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.24em] text-cyan-200">
                Monitor control room
              </span>
            </div>

            <div className="mt-6 flex flex-wrap items-center gap-3">
              <h1 className="text-4xl font-black text-white">{monitor.name}</h1>
              <StatusBadge status={monitor.status} />
              {monitor.hasActiveAlert ? (
                <span className="rounded-full border border-rose-400/15 bg-rose-500/10 px-3 py-1 text-xs font-semibold text-rose-200">
                  Alert active
                </span>
              ) : null}
            </div>

            <div className="mt-4 flex flex-wrap gap-2">
              <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-xs font-semibold text-slate-200">{monitor.httpMethod}</span>
              <a href={monitor.url} target="_blank" rel="noreferrer" className="inline-flex max-w-full items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-xs font-medium text-slate-200 transition hover:bg-white/[0.08]">
                <span className="truncate">{monitor.url}</span>
                <Globe className="h-3.5 w-3.5 shrink-0" />
              </a>
            </div>

            <NextCheckCountdown
              className="mt-4"
              intervalSeconds={monitor.intervalSeconds}
              lastCheckedAt={monitor.lastCheckedAt}
              status={monitor.status}
            />

            <p className="mt-5 max-w-2xl text-sm leading-7 text-slate-300">
              Review runtime health, diagnosis confidence, historical checks, alert delivery, and incident
              correlations without leaving this control room.
            </p>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 xl:w-[380px]">
            <SummaryCard label="Availability" value={formatPercentage(monitor.uptimePercentage)} helper="Live uptime posture" />
            <SummaryCard label="Average latency" value={formatResponseTime(monitor.avgResponseTimeMs)} helper={`Latest ${formatResponseTime(monitor.latestResponseTimeMs)}`} />
            <SummaryCard label="Open incidents" value={insights.activeIncidents.length} helper="Current unresolved windows" />
            <SummaryCard label="Success rate" value={`${insights.successRate}%`} helper={`${checks.length} recent checks sampled`} />
          </div>
        </div>
      </section>

      <div className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
        <div className="space-y-6">
          <Panel title="Response shape" subtitle="Recent response behavior for this endpoint." icon={Gauge}>
            <Suspense fallback={<div className="flex h-72 items-center justify-center text-sm text-slate-500">Loading chart...</div>}>
              <MonitorResponseTimeChart checks={checks} />
            </Suspense>
          </Panel>

          <Panel title="AI-ready diagnosis" subtitle="Structured explanation of the latest observed behavior." icon={Sparkles}>
            {monitor.latestDiagnosis ? (
              <div className="space-y-4">
                <div className="flex flex-wrap gap-2">
                  <span className="rounded-full border border-cyan-400/15 bg-cyan-400/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-cyan-200">
                    {monitor.latestDiagnosis.code.replaceAll('_', ' ')}
                  </span>
                  <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-xs font-semibold text-slate-200">
                    Confidence {monitor.latestDiagnosis.confidence}%
                  </span>
                  <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-xs font-semibold text-slate-200">
                    {monitor.latestDiagnosis.isLikelyOutage ? 'Likely outage' : 'Access or config issue'}
                  </span>
                </div>
                <div className="rounded-[24px] border border-white/8 bg-slate-950/30 p-4">
                  <p className="text-lg font-semibold text-white">{monitor.latestDiagnosis.summary}</p>
                  <p className="mt-3 text-sm leading-7 text-slate-300">{monitor.latestDiagnosis.detail}</p>
                  {monitor.latestDiagnosis.suggestedAction ? (
                    <p className="mt-3 text-sm text-cyan-200">Suggested action: {monitor.latestDiagnosis.suggestedAction}</p>
                  ) : null}
                </div>
              </div>
            ) : (
              <EmptyState text="No diagnosis has been generated yet. This endpoint currently looks healthy." />
            )}
          </Panel>

          <Panel title="Failure evidence" subtitle="Masked response details and execution metadata from the latest check." icon={AlertTriangle}>
            {monitor.latestResponseSnippet || monitor.latestCheckMetadata ? (
              <div className="space-y-4">
                {monitor.latestResponseSnippet ? (
                  <pre className="overflow-x-auto rounded-[24px] border border-white/8 bg-slate-950/40 p-4 text-xs text-slate-200">
                    {monitor.latestResponseSnippet}
                  </pre>
                ) : null}
                {monitor.latestCheckMetadata ? (
                  <pre className="overflow-x-auto rounded-[24px] border border-white/8 bg-slate-950/40 p-4 text-xs text-slate-400">
                    {JSON.stringify(monitor.latestCheckMetadata, null, 2)}
                  </pre>
                ) : null}
              </div>
            ) : (
              <EmptyState text="No masked response evidence captured yet." />
            )}
          </Panel>

          <Panel
            title="Check history"
            subtitle="Browse the full history in-app or export longer windows."
            icon={Activity}
            action={
              <div className="flex flex-wrap gap-2">
                {[7, 30].map((days) => (
                  <button key={days} type="button" onClick={() => handleExport(days as 7 | 30)} disabled={isExportingWindow !== null} className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5 text-xs font-semibold text-slate-200 transition hover:bg-white/[0.08] disabled:opacity-60">
                    {isExportingWindow === days ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />}
                    Export {days}d
                  </button>
                ))}
              </div>
            }
          >
            <div className="mb-4 flex flex-wrap gap-2">
              {(['all', 7, 30] as HistoryWindow[]).map((window) => (
                <button key={window} type="button" onClick={() => setHistoryWindow(window)} className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition ${historyWindow === window ? 'border-cyan-400/15 bg-cyan-400/10 text-cyan-200' : 'border-white/10 bg-white/[0.03] text-slate-300 hover:bg-white/[0.05]'}`}>
                  {historyWindowLabel(window)}
                </button>
              ))}
            </div>
            <div className="mb-4 flex flex-wrap gap-2 text-xs text-slate-400">
              <span className="rounded-full border border-white/10 bg-white/[0.03] px-3 py-1">Showing {historyChecks.length} of {historyTotal} checks</span>
              <span className="rounded-full border border-white/10 bg-white/[0.03] px-3 py-1">Window: {historyWindowLabel(historyWindow)}</span>
            </div>

            {historyChecks.length === 0 && !isHistoryLoading ? (
              <EmptyState text="Checks will appear here once the scheduler runs against this monitor." />
            ) : (
              <div className="space-y-4">
                <div className="overflow-hidden rounded-[24px] border border-white/8">
                  <div className="overflow-x-auto">
                    <table className="min-w-full text-left text-sm">
                      <thead className="bg-white/[0.04] text-xs uppercase tracking-[0.18em] text-slate-500">
                        <tr>
                          <th className="px-4 py-3">Timestamp</th>
                          <th className="px-4 py-3">Status</th>
                          <th className="px-4 py-3">Code</th>
                          <th className="px-4 py-3">Response</th>
                          <th className="px-4 py-3">Diagnosis</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-white/6 bg-slate-950/20">
                        {isHistoryLoading ? (
                          <tr><td colSpan={5} className="px-4 py-10 text-center text-slate-400"><span className="inline-flex items-center gap-2"><Loader2 className="h-4 w-4 animate-spin" /> Loading history...</span></td></tr>
                        ) : (
                          historyChecks.map((check) => (
                            <tr key={check.id}>
                              <td className="px-4 py-3 text-slate-300">{formatDateTime(check.checkedAt)}</td>
                              <td className="px-4 py-3"><CheckStatusBadge status={check.status} /></td>
                              <td className="px-4 py-3 text-slate-200">{check.statusCode ?? '-'}</td>
                              <td className="px-4 py-3 text-slate-200">{formatResponseTime(check.responseTimeMs)}</td>
                              <td className="max-w-[360px] px-4 py-3 text-slate-400">
                                <p className="font-medium text-slate-200">{check.diagnosis?.summary || check.errorMessage || '-'}</p>
                                {check.diagnosis ? <p className="mt-1 text-xs text-slate-500">Confidence {check.diagnosis.confidence}% {check.diagnosis.isLikelyOutage ? '/ likely outage' : '/ access or config'}</p> : null}
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
                {hasNextPage ? (
                  <div className="flex justify-center">
                    <button type="button" onClick={() => fetchNextPage()} disabled={isFetchingNextPage} className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-4 py-2 text-sm font-semibold text-slate-200 transition hover:bg-white/[0.08] disabled:opacity-60">
                      {isFetchingNextPage ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                      Load more history
                    </button>
                  </div>
                ) : null}
              </div>
            )}
          </Panel>
        </div>

        <div className="space-y-6">
          <Panel title="Monitor facts" subtitle="Technical reality of this endpoint and how it is being checked." icon={Shield}>
            <div className="space-y-4">
              {[
                { label: 'Last checked', value: formatDateTime(monitor.lastCheckedAt) },
                { label: 'Latest HTTP code', value: monitor.latestStatusCode ?? 'N/A' },
                { label: 'Check interval', value: `${monitor.intervalSeconds}s` },
                { label: 'Timeout limit', value: `${monitor.timeoutMs}ms` },
                { label: 'Recent checks', value: monitor.recentChecksCount ?? checks.length },
                { label: 'Last error', value: monitor.lastErrorMessage || 'No active error' },
              ].map((fact) => (
                <div key={fact.label} className="flex items-start justify-between gap-4 border-b border-white/6 pb-4 last:border-b-0 last:pb-0">
                  <p className="text-sm text-slate-500">{fact.label}</p>
                  <p className="max-w-[62%] text-right text-sm font-semibold text-slate-100">{fact.value}</p>
                </div>
              ))}
            </div>
          </Panel>

          <Panel title="Impact context" subtitle="Business metadata used for ownership and smarter incident triage." icon={BellRing}>
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-1 2xl:grid-cols-2">
              {[
                ['Service', monitor.impactMetadata?.serviceName || 'Not mapped'],
                ['Feature', monitor.impactMetadata?.featureName || 'Not mapped'],
                ['Journey', monitor.impactMetadata?.customerJourney || 'Not mapped'],
                ['Criticality', monitor.impactMetadata?.businessCriticality || 'MEDIUM'],
                ['SLA tier', monitor.impactMetadata?.slaTier || 'STANDARD'],
                ['Owner', monitor.impactMetadata?.teamOwner || 'Unassigned'],
                ['Region', monitor.impactMetadata?.region || 'Global'],
              ].map(([label, value]) => (
                <div key={label} className="rounded-[24px] border border-white/8 bg-white/[0.03] p-4">
                  <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-500">{label}</p>
                  <p className="mt-3 text-lg font-semibold text-white">{value}</p>
                </div>
              ))}
            </div>
          </Panel>

          <Panel title="Recent alerts" subtitle="Notification history and delivery posture for this endpoint." icon={Zap}>
            {recentAlerts.length === 0 ? (
              <EmptyState text="No alert notifications have been generated for this monitor yet." />
            ) : (
              <div className="space-y-3">
                {recentAlerts.slice(0, 5).map((alert) => (
                  <div key={alert.id} className="rounded-[24px] border border-white/8 bg-white/[0.03] p-4">
                    <div className="flex flex-wrap gap-2">
                      <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-xs font-semibold text-slate-200">{alert.status}</span>
                      <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-xs font-semibold text-slate-200">{alert.channel}</span>
                      <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-xs font-semibold text-slate-200">Attempts: {alert.deliveryAttempts ?? 0}</span>
                    </div>
                    <p className="mt-3 text-sm font-semibold text-white">{alert.message}</p>
                    <p className="mt-2 text-xs text-slate-500">Created {formatDateTime(alert.createdAt)}{alert.resolvedAt ? ` / Resolved ${formatDateTime(alert.resolvedAt)}` : ''}</p>
                    {alert.deliveryError ? <p className="mt-2 text-xs text-rose-200">Delivery issue: {alert.deliveryError}</p> : null}
                  </div>
                ))}
              </div>
            )}
          </Panel>

          <Panel title="Incident trail" subtitle="Outage windows and correlated change clues for this endpoint." icon={Layers3}>
            {incidents.length === 0 ? (
              <EmptyState text="No incidents have been recorded for this monitor yet." />
            ) : (
              <div className="space-y-3">
                {incidents.map((incident) => (
                  <div key={incident.id} className="rounded-[24px] border border-white/8 bg-white/[0.03] p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold text-white">{incident.message}</p>
                        <p className="mt-2 text-xs text-slate-500">Started {formatDateTime(incident.createdAt)}</p>
                      </div>
                      <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-xs font-semibold text-slate-200">{incident.status}</span>
                    </div>
                    <p className="mt-3 text-sm text-slate-400">Duration {formatDuration(incident.durationMs)}</p>
                  </div>
                ))}
              </div>
            )}

            {latestIncident ? (
              <div className="mt-5 rounded-[24px] border border-white/8 bg-slate-950/25 p-4">
                <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-500">Latest incident narrative</p>
                {latestIncident.likelyTrigger ? (
                  <div className="mt-3 rounded-[20px] border border-rose-400/15 bg-rose-500/10 p-4">
                    <p className="text-sm font-semibold text-rose-100">Likely trigger: {latestIncident.likelyTrigger.title}</p>
                    <p className="mt-2 text-xs text-rose-200">Confidence {latestIncident.likelyTrigger.confidence}% / {latestIncident.likelyTrigger.minutesFromIncidentStart} min from start</p>
                  </div>
                ) : null}
                {latestIncident.timeline?.length ? (
                  <div className="mt-4 space-y-3">
                    {latestIncident.timeline.slice(0, 4).map((entry) => (
                      <div key={entry.id} className="rounded-[20px] border border-white/8 bg-white/[0.03] p-3">
                        <p className="text-sm font-semibold text-white">{entry.title}</p>
                        <p className="mt-1 text-sm text-slate-400">{entry.description}</p>
                        <p className="mt-2 text-xs text-slate-500">{formatDateTime(entry.timestamp)}</p>
                      </div>
                    ))}
                  </div>
                ) : null}
                {latestIncident.relatedChanges?.length ? (
                  <div className="mt-4 space-y-3">
                    {latestIncident.relatedChanges.slice(0, 3).map((change) => (
                      <div key={change.id} className="rounded-[20px] border border-white/8 bg-white/[0.03] p-3">
                        <div className="flex flex-wrap gap-2">
                          <span className="rounded-full border border-white/10 px-3 py-1 text-[11px] font-semibold text-slate-200">{change.type}</span>
                          <span className="rounded-full border border-white/10 px-3 py-1 text-[11px] font-semibold text-slate-200">{change.source}</span>
                        </div>
                        <p className="mt-3 text-sm font-semibold text-white">{change.title}</p>
                        {change.summary ? <p className="mt-2 text-sm text-slate-400">{change.summary}</p> : null}
                        <p className="mt-2 text-xs text-slate-500">Confidence {change.confidence}% / {change.minutesFromIncidentStart} min from incident start</p>
                      </div>
                    ))}
                  </div>
                ) : null}
              </div>
            ) : null}
          </Panel>
        </div>
      </div>
    </div>
  );
}
