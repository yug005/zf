import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { AlertTriangle, Clock3, Loader2, ShieldAlert, Sparkles } from 'lucide-react';
import { axiosPrivate } from '../services/api';

type IncidentStatus = 'INVESTIGATING' | 'IDENTIFIED' | 'RESOLVED';
type ImpactSeverity = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

interface Incident {
  id: string;
  status: IncidentStatus;
  severity: ImpactSeverity;
  impactScore: number;
  message: string;
  createdAt: string;
  resolvedAt?: string | null;
  durationMs: number;
  impactSummary: {
    serviceName?: string | null;
    featureName?: string | null;
    customerJourney?: string | null;
    teamOwner?: string | null;
    region?: string | null;
    businessCriticality: ImpactSeverity;
    slaTier: 'STANDARD' | 'PREMIUM' | 'ENTERPRISE';
    mappedSurface?: string[];
    ownershipState?: string;
    commercialRisk?: string;
  };
  responseRecommendation?: string;
  likelyTrigger?: {
    id: string;
    title: string;
    type: string;
    source: string;
    confidence: number;
    happenedAt: string;
    confidenceSignals?: string[];
    recommendedAction?: string;
  } | null;
  monitor: {
    id: string;
    name: string;
    url: string;
    status: string;
  };
}

const formatDateTime = (value: string) => new Date(value).toLocaleString();

const formatDuration = (durationMs: number) => {
  const totalMinutes = Math.floor(durationMs / 60_000);
  if (totalMinutes < 1) return 'Under a minute';
  if (totalMinutes < 60) return `${totalMinutes}m`;
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return minutes === 0 ? `${hours}h` : `${hours}h ${minutes}m`;
};

const statusTone: Record<IncidentStatus, string> = {
  INVESTIGATING: 'border-amber-400/30 bg-amber-500/12 text-amber-200',
  IDENTIFIED: 'border-sky-400/30 bg-sky-500/12 text-sky-200',
  RESOLVED: 'border-emerald-400/30 bg-emerald-500/12 text-emerald-200',
};

const severityTone: Record<ImpactSeverity, string> = {
  LOW: 'border-slate-400/20 bg-slate-500/10 text-slate-200',
  MEDIUM: 'border-sky-400/30 bg-sky-500/12 text-sky-200',
  HIGH: 'border-amber-400/30 bg-amber-500/12 text-amber-200',
  CRITICAL: 'border-rose-400/30 bg-rose-500/12 text-rose-200',
};

const shellCard =
  'rounded-3xl border border-white/10 bg-[#08111f]/90 shadow-[0_24px_80px_rgba(2,8,23,0.38)] backdrop-blur-xl';

export default function Incidents() {
  const [filter, setFilter] = useState<'ALL' | IncidentStatus>('ALL');

  const { data: incidents = [], isLoading } = useQuery({
    queryKey: ['incidents-page'],
    queryFn: async () => {
      const { data } = await axiosPrivate.get<Incident[]>('/incidents?limit=50');
      return data;
    },
    refetchInterval: 15_000,
  });

  const filteredIncidents = useMemo(
    () => incidents.filter((incident) => filter === 'ALL' || incident.status === filter),
    [filter, incidents],
  );

  const summary = useMemo(
    () => ({
      total: incidents.length,
      open: incidents.filter((incident) => incident.status !== 'RESOLVED').length,
      resolved: incidents.filter((incident) => incident.status === 'RESOLVED').length,
      criticalOpen: incidents.filter(
        (incident) => incident.status !== 'RESOLVED' && incident.severity === 'CRITICAL',
      ).length,
    }),
    [incidents],
  );

  return (
    <div className="mx-auto max-w-6xl space-y-6 pb-10 text-slate-100">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">Incidents</h1>
          <p className="text-sm text-slate-400">
            Review outage windows, recovery times, and the monitors involved.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          {(['ALL', 'INVESTIGATING', 'IDENTIFIED', 'RESOLVED'] as const).map((status) => (
            <button
              key={status}
              onClick={() => setFilter(status)}
              className={`rounded-full px-4 py-2 text-sm font-medium transition ${
                filter === status
                  ? 'bg-emerald-400/15 text-emerald-100 ring-1 ring-emerald-400/30'
                  : 'bg-white/5 text-slate-300 ring-1 ring-white/10 hover:bg-white/10'
              }`}
            >
              {status === 'ALL' ? 'All' : status}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
        <div className={`${shellCard} p-5`}>
          <p className="text-sm font-medium text-slate-400">Total incidents</p>
          <p className="mt-2 text-3xl font-bold text-white">{summary.total}</p>
        </div>
        <div className={`${shellCard} p-5`}>
          <p className="text-sm font-medium text-slate-400">Open incidents</p>
          <p className="mt-2 text-3xl font-bold text-amber-200">{summary.open}</p>
        </div>
        <div className={`${shellCard} p-5`}>
          <p className="text-sm font-medium text-slate-400">Resolved incidents</p>
          <p className="mt-2 text-3xl font-bold text-emerald-200">{summary.resolved}</p>
        </div>
        <div className="rounded-3xl border border-rose-400/20 bg-rose-500/10 p-5 shadow-[0_24px_80px_rgba(136,19,55,0.2)] backdrop-blur-xl">
          <p className="text-sm font-medium text-rose-200">Critical open incidents</p>
          <p className="mt-2 text-3xl font-bold text-rose-100">{summary.criticalOpen}</p>
        </div>
      </div>

      <div className={shellCard}>
        {isLoading ? (
          <div className="flex min-h-[280px] items-center justify-center">
            <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
          </div>
        ) : filteredIncidents.length === 0 ? (
          <div className="space-y-4 px-6 py-16 text-center">
            <ShieldAlert className="mx-auto h-10 w-10 text-slate-400" />
            <p className="text-sm text-slate-400">No incidents match the current filter.</p>
          </div>
        ) : (
          <div className="divide-y divide-white/6">
            {filteredIncidents.map((incident) => (
              <div key={incident.id} className="p-6">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-3">
                      <span className={`rounded-full border px-3 py-1 text-xs font-semibold ${statusTone[incident.status]}`}>
                        {incident.status}
                      </span>
                      <span className={`rounded-full border px-3 py-1 text-xs font-semibold ${severityTone[incident.severity]}`}>
                        {incident.severity} impact
                      </span>
                      <Link
                        to={`/monitors/${incident.monitor.id}`}
                        className="text-lg font-semibold text-white transition hover:text-emerald-200"
                      >
                        {incident.monitor.name}
                      </Link>
                    </div>
                    <p className="mt-3 text-sm text-slate-300">{incident.message}</p>
                    <p className="mt-2 truncate text-xs text-slate-500">{incident.monitor.url}</p>
                  </div>

                  <div className="rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-2 text-xs font-medium text-slate-400">
                      <Clock3 className="h-3.5 w-3.5" />
                      Duration
                    </div>
                    <p className="mt-1 text-sm font-semibold text-white">{formatDuration(incident.durationMs)}</p>
                  </div>
                </div>

                <div className="mt-4 grid gap-3 text-sm md:grid-cols-2">
                  <div className="rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3">
                    <p className="text-xs uppercase tracking-wide text-slate-500">Started</p>
                    <p className="mt-1 text-slate-200">{formatDateTime(incident.createdAt)}</p>
                  </div>
                  <div className="rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3">
                    <p className="text-xs uppercase tracking-wide text-slate-500">Resolved</p>
                    <p className="mt-1 text-slate-200">
                      {incident.resolvedAt ? formatDateTime(incident.resolvedAt) : 'Still open'}
                    </p>
                  </div>
                </div>

                <div className="mt-4 flex flex-wrap gap-2 text-xs text-slate-300">
                  <span className="rounded-full border border-white/10 bg-white/[0.03] px-3 py-1">
                    Score: {incident.impactScore}
                  </span>
                  <span className="rounded-full border border-white/10 bg-white/[0.03] px-3 py-1">
                    Feature: {incident.impactSummary.featureName || 'Unmapped'}
                  </span>
                  <span className="rounded-full border border-white/10 bg-white/[0.03] px-3 py-1">
                    Journey: {incident.impactSummary.customerJourney || 'Unmapped'}
                  </span>
                  <span className="rounded-full border border-white/10 bg-white/[0.03] px-3 py-1">
                    Owner: {incident.impactSummary.teamOwner || 'Unassigned'}
                  </span>
                  <span className="rounded-full border border-white/10 bg-white/[0.03] px-3 py-1">
                    SLA: {incident.impactSummary.slaTier}
                  </span>
                  {incident.impactSummary.commercialRisk ? (
                    <span className="rounded-full border border-white/10 bg-white/[0.03] px-3 py-1">
                      {incident.impactSummary.commercialRisk}
                    </span>
                  ) : null}
                </div>

                {incident.responseRecommendation ? (
                  <div className="mt-4 rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
                      Response recommendation
                    </p>
                    <p className="mt-2 text-sm text-slate-200">{incident.responseRecommendation}</p>
                  </div>
                ) : null}

                {incident.likelyTrigger ? (
                  <div className="mt-4 rounded-2xl border border-rose-400/20 bg-rose-500/10 p-4">
                    <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-rose-200">
                      <Sparkles className="h-3.5 w-3.5" />
                      Likely Trigger
                    </div>
                    <p className="mt-3 text-sm font-semibold text-rose-100">{incident.likelyTrigger.title}</p>
                    <p className="mt-2 text-sm text-rose-200/90">
                      {incident.likelyTrigger.type} via {incident.likelyTrigger.source} with{' '}
                      {incident.likelyTrigger.confidence}% confidence.
                    </p>
                    {incident.likelyTrigger.confidenceSignals?.length ? (
                      <div className="mt-3 flex flex-wrap gap-2">
                        {incident.likelyTrigger.confidenceSignals.slice(0, 3).map((signal) => (
                          <span
                            key={signal}
                            className="rounded-full border border-rose-300/20 bg-rose-500/10 px-3 py-1 text-xs text-rose-200"
                          >
                            {signal}
                          </span>
                        ))}
                      </div>
                    ) : null}
                    {incident.likelyTrigger.recommendedAction ? (
                      <p className="mt-3 text-sm text-rose-100">{incident.likelyTrigger.recommendedAction}</p>
                    ) : null}
                  </div>
                ) : null}

                <div className="mt-4 flex items-center gap-2 text-xs text-slate-400">
                  <AlertTriangle className="h-3.5 w-3.5" />
                  Open the monitor detail page for the full timeline, related changes, and alert delivery history.
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
