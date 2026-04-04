import { useState, useEffect, lazy, Suspense } from 'react';
import { useQuery } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import { LayoutDashboard, Maximize2, Minimize2 } from 'lucide-react';
import { axiosPrivate } from '../../services/api';
import { fetchCurrentUser } from '../../services/current-user';
import { UpgradePrompt } from '../../components/UpgradePrompt';
import { useDashboardInsights } from './useInsights';
import { formatPercentage, formatResponseTime } from './types';
import type { Monitor, Alert, Incident, ActiveWatchChange, DashboardMode } from './types';

const CompactView = lazy(() => import('./CompactView'));
const AnalyticalView = lazy(() => import('./AnalyticalView'));

const STORAGE_KEY = 'zer0friction-dashboard-mode';

const fetchMonitors = async (): Promise<Monitor[]> => { const { data } = await axiosPrivate.get('/monitors'); return data; };
const fetchRecentAlerts = async (): Promise<Alert[]> => { const { data } = await axiosPrivate.get('/alerts?limit=8'); return data; };
const fetchOpenIncidents = async (): Promise<Incident[]> => { const { data } = await axiosPrivate.get('/incidents?limit=8'); return data; };
const fetchActiveWatchChanges = async (): Promise<ActiveWatchChange[]> => { const { data } = await axiosPrivate.get('/changes?limit=6&activeWatch=true'); return data; };

function ModeToggleSwitch({ mode, onToggle }: { mode: DashboardMode; onToggle: () => void }) {
  return (
    <button
      onClick={onToggle}
      className="group relative flex items-center gap-3 rounded-2xl border border-white/[0.08] bg-white/[0.03] px-4 py-2.5 transition-all hover:bg-white/[0.06] hover:border-white/[0.12]"
    >
      <div className="relative h-5 w-10 rounded-full bg-white/[0.06]">
        <motion.div
          className="absolute top-0.5 h-4 w-4 rounded-full"
          animate={{
            left: mode === 'compact' ? 2 : 22,
            backgroundColor: mode === 'compact' ? '#64748b' : '#10b981',
            boxShadow: mode === 'analytical' ? '0 0 10px rgba(16,185,129,0.4)' : 'none',
          }}
          transition={{ type: 'spring', stiffness: 400, damping: 25 }}
        />
      </div>
      <div className="flex items-center gap-2">
        {mode === 'compact' ? <Minimize2 className="h-3.5 w-3.5 text-slate-400" /> : <Maximize2 className="h-3.5 w-3.5 text-emerald-400" />}
        <span className="text-xs font-bold uppercase tracking-[0.15em] text-slate-400">
          {mode === 'compact' ? 'Compact' : 'Analytical'}
        </span>
      </div>
    </button>
  );
}

function DashboardSkeleton() {
  return (
    <div className="animate-pulse space-y-5">
      <div className="h-28 rounded-2xl bg-white/[0.03] border border-white/[0.04]" />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-24 rounded-2xl bg-white/[0.03] border border-white/[0.04]" />
        ))}
      </div>
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[2fr_1fr]">
        <div className="h-80 rounded-2xl bg-white/[0.03] border border-white/[0.04]" />
        <div className="h-80 rounded-2xl bg-white/[0.03] border border-white/[0.04]" />
      </div>
    </div>
  );
}

export default function Dashboard() {
  const [mode, setMode] = useState<DashboardMode>(() => {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    return stored === 'analytical' ? 'analytical' : 'compact';
  });

  useEffect(() => { window.localStorage.setItem(STORAGE_KEY, mode); }, [mode]);

  const { data: currentUser } = useQuery({ queryKey: ['currentUser'], queryFn: fetchCurrentUser, staleTime: 60_000 });
  const { data: monitors = [], isLoading: ml, isError: me } = useQuery({ queryKey: ['monitors'], queryFn: fetchMonitors, refetchInterval: 10_000 });
  const { data: alerts = [], isLoading: al } = useQuery({ queryKey: ['recentAlerts'], queryFn: fetchRecentAlerts, refetchInterval: 10_000 });
  const { data: incidents = [], isLoading: il } = useQuery({ queryKey: ['dashboardIncidents'], queryFn: fetchOpenIncidents, refetchInterval: 10_000 });
  const { data: activeWatchChanges = [], isLoading: wl } = useQuery({ queryKey: ['activeWatchChanges'], queryFn: fetchActiveWatchChanges, refetchInterval: 10_000 });

  const insights = useDashboardInsights(monitors, alerts, incidents, activeWatchChanges);
  const isLoading = ml || al || il || wl;
  const toggleMode = () => setMode((m) => m === 'compact' ? 'analytical' : 'compact');

  if (isLoading) return <div className="mx-auto max-w-[1520px] pb-10"><DashboardSkeleton /></div>;

  if (me) {
    return (
      <div className="rounded-2xl border border-rose-500/20 bg-rose-500/5 p-8 text-center">
        <h3 className="text-lg font-bold text-rose-400">Dashboard unavailable</h3>
        <p className="mt-2 text-sm text-slate-400">Could not load monitoring data from the API.</p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-[1520px] space-y-6 pb-10">
      {/* Command Header */}
      <motion.section
        layout
        className="relative overflow-hidden rounded-2xl border border-white/[0.06] bg-white/[0.02] backdrop-blur-sm"
      >
        {/* Ambient glow */}
        <div className="absolute -inset-[200%] animate-[spin_60s_linear_infinite] bg-[conic-gradient(from_90deg,transparent_0%,rgba(16,185,129,0.04)_25%,transparent_50%)] blur-3xl pointer-events-none" />
        <div className="absolute inset-0 bg-[#080c14]/40 pointer-events-none" />

        <div className="relative z-10 p-6 lg:p-8">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <div className="flex items-center gap-3 mb-3">
                <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-emerald-500/10 border border-emerald-500/20">
                  <LayoutDashboard className="h-4 w-4 text-emerald-400" />
                </div>
                <div className="flex items-center gap-2">
                  <div className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse shadow-[0_0_8px_rgba(52,211,153,0.6)]" />
                  <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-emerald-400/70">Live Dashboard</span>
                </div>
              </div>
              <h1 className="text-2xl font-extrabold text-white lg:text-3xl">
                {mode === 'compact' ? 'Operational Overview' : 'Control Room'}
              </h1>
              <p className="mt-2 text-sm text-slate-500 max-w-lg">
                {monitors.length === 0
                  ? 'Create your first monitor to begin tracking uptime, latency, and incidents.'
                  : mode === 'compact'
                    ? `${insights.total} endpoints monitored. ${insights.activeIncidents.length} open incidents.`
                    : 'Full analytical view with performance graphs, incident board, and fleet metrics.'}
              </p>
            </div>

            <div className="flex flex-col items-start gap-4 lg:items-end">
              <ModeToggleSwitch mode={mode} onToggle={toggleMode} />
              {/* Mini stat pills in header */}
              <div className="flex items-center gap-3">
                {[
                  { label: 'Availability', value: formatPercentage(insights.fleetAvailability), color: 'text-emerald-400' },
                  { label: 'Latency', value: formatResponseTime(insights.avgResponseTimeMs), color: 'text-teal-400' },
                  { label: 'Incidents', value: insights.activeIncidents.length, color: insights.activeIncidents.length > 0 ? 'text-amber-400' : 'text-slate-500' },
                ].map((s) => (
                  <div key={s.label} className="text-right">
                    <p className="text-[8px] font-bold uppercase tracking-[0.2em] text-slate-600">{s.label}</p>
                    <p className={`text-sm font-extrabold ${s.color}`}>{s.value}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </motion.section>

      {/* Subscription prompts */}
      {currentUser?.subscriptionStatus === 'TRIALING' && <UpgradePrompt reason="trial_expiring" />}
      {(currentUser?.subscriptionStatus === 'EXPIRED' || currentUser?.subscriptionStatus === 'CANCELLED') && <UpgradePrompt reason="expired" />}

      {/* Mode content */}
      <Suspense fallback={<DashboardSkeleton />}>
        <AnimatePresence mode="wait">
          {mode === 'compact' ? (
            <CompactView key="compact" insights={insights} monitors={monitors} />
          ) : (
            <AnalyticalView
              key="analytical"
              insights={insights}
              monitors={monitors}
              alerts={alerts}
              activeWatchChanges={activeWatchChanges}
            />
          )}
        </AnimatePresence>
      </Suspense>
    </div>
  );
}
