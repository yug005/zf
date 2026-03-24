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
  INVESTIGATING: 'border-amber-200 bg-amber-50 text-amber-700',
  IDENTIFIED: 'border-blue-200 bg-blue-50 text-blue-700',
  RESOLVED: 'border-emerald-200 bg-emerald-50 text-emerald-700',
};

const severityTone: Record<ImpactSeverity, string> = {
  LOW: 'border-slate-200 bg-slate-100 text-slate-700',
  MEDIUM: 'border-sky-200 bg-sky-50 text-sky-700',
  HIGH: 'border-amber-200 bg-amber-50 text-amber-700',
  CRITICAL: 'border-rose-200 bg-rose-50 text-rose-700',
};

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
    <div className="mx-auto max-w-6xl space-y-6 pb-10">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Incidents</h1>
          <p className="text-sm text-slate-500">
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
                  ? 'bg-slate-900 text-white'
                  : 'bg-white text-slate-600 ring-1 ring-slate-200 hover:bg-slate-50'
              }`}
            >
              {status === 'ALL' ? 'All' : status}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-sm font-medium text-slate-500">Total incidents</p>
          <p className="mt-2 text-3xl font-bold text-slate-900">{summary.total}</p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-sm font-medium text-slate-500">Open incidents</p>
          <p className="mt-2 text-3xl font-bold text-amber-600">{summary.open}</p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-sm font-medium text-slate-500">Resolved incidents</p>
          <p className="mt-2 text-3xl font-bold text-emerald-600">{summary.resolved}</p>
        </div>
        <div className="rounded-2xl border border-rose-200 bg-rose-50 p-5 shadow-sm">
          <p className="text-sm font-medium text-rose-700">Critical open incidents</p>
          <p className="mt-2 text-3xl font-bold text-rose-900">{summary.criticalOpen}</p>
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
        {isLoading ? (
          <div className="flex min-h-[280px] items-center justify-center">
            <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
          </div>
        ) : filteredIncidents.length === 0 ? (
          <div className="space-y-4 px-6 py-16 text-center">
            <ShieldAlert className="mx-auto h-10 w-10 text-slate-300" />
            <p className="text-sm text-slate-500">No incidents match the current filter.</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
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
                        className="text-lg font-semibold text-slate-900 hover:text-primary-600"
                      >
                        {incident.monitor.name}
                      </Link>
                    </div>
                    <p className="mt-3 text-sm text-slate-700">{incident.message}</p>
                    <p className="mt-2 truncate text-xs text-slate-400">{incident.monitor.url}</p>
                  </div>

                    <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-2 text-xs font-medium text-slate-500">
                        <Clock3 className="h-3.5 w-3.5" />
                        Duration
                    </div>
                    <p className="mt-1 text-sm font-semibold text-slate-900">
                      {formatDuration(incident.durationMs)}
                    </p>
                  </div>
                </div>

                <div className="mt-4 grid gap-3 text-sm text-slate-500 md:grid-cols-2">
                  <div className="rounded-xl border border-slate-200 px-4 py-3">
                    <p className="text-xs uppercase tracking-wide text-slate-400">Started</p>
                    <p className="mt-1 text-slate-700">{formatDateTime(incident.createdAt)}</p>
                  </div>
                  <div className="rounded-xl border border-slate-200 px-4 py-3">
                    <p className="text-xs uppercase tracking-wide text-slate-400">Resolved</p>
                    <p className="mt-1 text-slate-700">
                      {incident.resolvedAt ? formatDateTime(incident.resolvedAt) : 'Still open'}
                    </p>
                  </div>
                </div>

                <div className="mt-4 flex flex-wrap gap-2 text-xs text-slate-500">
                  <span className="rounded-full border border-slate-200 px-3 py-1">
                    Score: {incident.impactScore}
                  </span>
                  <span className="rounded-full border border-slate-200 px-3 py-1">
                    Feature: {incident.impactSummary.featureName || 'Unmapped'}
                  </span>
                  <span className="rounded-full border border-slate-200 px-3 py-1">
                    Journey: {incident.impactSummary.customerJourney || 'Unmapped'}
                  </span>
                  <span className="rounded-full border border-slate-200 px-3 py-1">
                    Owner: {incident.impactSummary.teamOwner || 'Unassigned'}
                  </span>
                  <span className="rounded-full border border-slate-200 px-3 py-1">
                    SLA: {incident.impactSummary.slaTier}
                  </span>
                  {incident.impactSummary.commercialRisk ? (
                    <span className="rounded-full border border-slate-200 px-3 py-1">
                      {incident.impactSummary.commercialRisk}
                    </span>
                  ) : null}
                </div>

                {incident.responseRecommendation ? (
                  <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-4">
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                      Response recommendation
                    </p>
                    <p className="mt-2 text-sm text-slate-700">{incident.responseRecommendation}</p>
                  </div>
                ) : null}

                {incident.likelyTrigger ? (
                  <div className="mt-4 rounded-2xl border border-rose-200 bg-rose-50 p-4">
                    <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-rose-700">
                      <Sparkles className="h-3.5 w-3.5" />
                      Likely Trigger
                    </div>
                    <p className="mt-3 text-sm font-semibold text-rose-900">
                      {incident.likelyTrigger.title}
                    </p>
                    <p className="mt-2 text-sm text-rose-800">
                      {incident.likelyTrigger.type} via {incident.likelyTrigger.source} with {incident.likelyTrigger.confidence}% confidence.
                    </p>
                    {incident.likelyTrigger.confidenceSignals?.length ? (
                      <div className="mt-3 flex flex-wrap gap-2">
                        {incident.likelyTrigger.confidenceSignals.slice(0, 3).map((signal) => (
                          <span
                            key={signal}
                            className="rounded-full border border-rose-200 px-3 py-1 text-xs text-rose-700"
                          >
                            {signal}
                          </span>
                        ))}
                      </div>
                    ) : null}
                    {incident.likelyTrigger.recommendedAction ? (
                      <p className="mt-3 text-sm text-rose-900">
                        {incident.likelyTrigger.recommendedAction}
                      </p>
                    ) : null}
                  </div>
                ) : null}

                <div className="mt-4 flex items-center gap-2 text-xs text-slate-500">
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
