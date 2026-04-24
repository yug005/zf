import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { CheckCircle, AlertTriangle, Clock3, ArrowUpRight, Zap, Shield, Globe, Server, Search } from 'lucide-react';
import type { DashboardInsights, Monitor } from './types';
import { formatResponseTime, formatPercentage, formatRelativeTime } from './types';

const statusDot: Record<Monitor['status'], string> = {
  UP: 'bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.6)]',
  DOWN: 'bg-rose-400 shadow-[0_0_8px_rgba(251,113,133,0.6)]',
  DEGRADED: 'bg-amber-400 shadow-[0_0_8px_rgba(251,191,36,0.6)]',
  PAUSED: 'bg-slate-500',
};

const statusBg: Record<Monitor['status'], string> = {
  UP: 'border-emerald-500/20 bg-emerald-500/5',
  DOWN: 'border-rose-500/20 bg-rose-500/5',
  DEGRADED: 'border-amber-500/20 bg-amber-500/5',
  PAUSED: 'border-slate-500/20 bg-slate-500/5',
};

const typeIcon: Record<Monitor['type'], React.ElementType> = {
  HTTP: Globe, TCP: Server, DNS: Search, SSL: Shield,
};

const stagger = { hidden: {}, visible: { transition: { staggerChildren: 0.04 } } };
const fadeUp = {
  hidden: { opacity: 0, y: 12 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.35, ease: [0.25, 0.46, 0.45, 0.94] as const } },
};

// Health score ring
function HealthRing({ score }: { score: number }) {
  const circumference = 2 * Math.PI * 38;
  const offset = circumference - (score / 100) * circumference;
  const color = score >= 90 ? '#10b981' : score >= 70 ? '#f59e0b' : '#ef4444';

  return (
    <div className="relative h-24 w-24 flex-shrink-0">
      <svg viewBox="0 0 80 80" className="h-full w-full -rotate-90">
        <circle cx="40" cy="40" r="38" fill="none" stroke="currentColor" strokeWidth="4" className="text-slate-200 dark:text-white/5" />
        <motion.circle
          cx="40" cy="40" r="38" fill="none" stroke={color} strokeWidth="4"
          strokeLinecap="round" strokeDasharray={circumference}
          initial={{ strokeDashoffset: circumference }}
          animate={{ strokeDashoffset: offset }}
          transition={{ duration: 1.2, ease: 'easeOut', delay: 0.3 }}
          style={{ filter: `drop-shadow(0 0 6px ${color}50)` }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <motion.span
          className="text-2xl font-black"
          initial={{ opacity: 0, scale: 0.5 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.5, type: 'spring' }}
        >
          {score}
        </motion.span>
        <span className="text-[8px] font-bold uppercase tracking-[0.2em] text-[var(--color-text-tertiary)]">score</span>
      </div>
    </div>
  );
}

// Compact stat pill
function StatPill({ label, value, accent }: { label: string; value: string | number; accent: string }) {
  return (
    <motion.div
      variants={fadeUp}
      className="flex items-center gap-3 rounded-2xl border px-5 py-4 backdrop-blur-sm"
      style={{ borderColor: 'var(--color-border-primary)', background: 'var(--color-surface-glass)' }}
    >
      <div className={`h-2 w-2 rounded-full ${accent}`} />
      <div>
        <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-[var(--color-text-tertiary)]">{label}</p>
        <p className="mt-0.5 text-lg font-extrabold">{value}</p>
      </div>
    </motion.div>
  );
}

export default function CompactView({
  insights,
  monitors,
}: {
  insights: DashboardInsights;
  monitors: Monitor[];
}) {
  return (
    <motion.div
      key="compact"
      initial="hidden"
      animate="visible"
      exit={{ opacity: 0, scale: 0.97, transition: { duration: 0.3 } }}
      variants={stagger}
      className="space-y-6"
    >
      {/* Top stats row */}
      <motion.div variants={stagger} className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        <motion.div
          variants={fadeUp}
          className="col-span-2 lg:col-span-1 flex items-center gap-5 rounded-2xl border px-5 py-4"
          style={{ borderColor: 'var(--color-border-primary)', background: 'var(--color-surface-glass)' }}
        >
          <HealthRing score={insights.healthScore} />
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-[var(--color-text-tertiary)]">System Health</p>
            <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
              {insights.healthScore >= 90 ? 'All systems nominal' : insights.healthScore >= 70 ? 'Minor issues detected' : 'Immediate attention needed'}
            </p>
          </div>
        </motion.div>
        <StatPill label="Total Monitors" value={insights.total} accent="bg-sky-400" />
        <StatPill label="Healthy" value={insights.healthy} accent="bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.4)]" />
        <StatPill label="Avg Latency" value={formatResponseTime(insights.avgResponseTimeMs)} accent="bg-violet-400" />
        <StatPill label="Availability" value={formatPercentage(insights.fleetAvailability)} accent="bg-teal-400" />
      </motion.div>

      {/* Monitor cards grid */}
      <motion.div variants={stagger}>
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-xs font-bold uppercase tracking-[0.2em] text-[var(--color-text-tertiary)]">Service Status</h3>
          <Link to="/monitors" className="flex items-center gap-1 text-xs font-semibold text-emerald-400 hover:text-emerald-300 transition-colors">
            View all <ArrowUpRight className="h-3 w-3" />
          </Link>
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {monitors.slice(0, 9).map((monitor) => {
            const Icon = typeIcon[monitor.type];
            return (
              <motion.div key={monitor.id} variants={fadeUp} layout>
                <Link
                  to={`/monitors/${monitor.id}`}
                  className={`group block rounded-2xl border p-4 transition-all duration-200 hover:scale-[1.01] hover:border-white/10 ${statusBg[monitor.status]}`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <div className={`h-2 w-2 rounded-full ${statusDot[monitor.status]}`} />
                        <span className="truncate text-sm font-bold">{monitor.name}</span>
                      </div>
                      <p className="mt-1.5 truncate font-mono text-[10px] text-[var(--color-text-tertiary)]">{monitor.url}</p>
                    </div>
                    <div className="flex-shrink-0 rounded-lg border p-1.5" style={{ borderColor: 'var(--color-border-secondary)', background: 'var(--color-surface-glass)' }}>
                      <Icon className="h-3.5 w-3.5 text-[var(--color-text-tertiary)]" />
                    </div>
                  </div>
                  <div className="mt-4 grid grid-cols-3 gap-2">
                    <div>
                      <p className="text-[9px] font-semibold uppercase tracking-wider text-[var(--color-text-tertiary)]">Uptime</p>
                      <p className="mt-0.5 text-xs font-bold text-[var(--color-text-secondary)]">{formatPercentage(monitor.uptimePercentage)}</p>
                    </div>
                    <div>
                      <p className="text-[9px] font-semibold uppercase tracking-wider text-[var(--color-text-tertiary)]">Latency</p>
                      <p className="mt-0.5 text-xs font-bold text-[var(--color-text-secondary)]">{formatResponseTime(monitor.avgResponseTimeMs)}</p>
                    </div>
                    <div>
                      <p className="text-[9px] font-semibold uppercase tracking-wider text-[var(--color-text-tertiary)]">Checked</p>
                      <p className="mt-0.5 text-xs font-bold text-[var(--color-text-secondary)]">{formatRelativeTime(monitor.lastCheckedAt)}</p>
                    </div>
                  </div>
                </Link>
              </motion.div>
            );
          })}
        </div>
      </motion.div>

      {/* Attention strip */}
      {insights.attentionMonitors.length > 0 && (
        <motion.div variants={fadeUp} className="rounded-2xl border border-rose-500/20 bg-rose-500/5 p-5">
          <div className="flex items-center gap-2 mb-3">
            <AlertTriangle className="h-4 w-4 text-rose-500 dark:text-rose-400" />
            <h3 className="text-xs font-bold uppercase tracking-[0.15em] text-rose-500 dark:text-rose-400">Requires Attention</h3>
          </div>
          <div className="space-y-2">
            {insights.attentionMonitors.slice(0, 4).map((m) => (
              <Link
                key={m.id}
                to={`/monitors/${m.id}`}
                className="flex items-center justify-between gap-4 rounded-xl border px-4 py-3 transition hover:bg-[var(--color-surface-hover)]"
                style={{ borderColor: 'var(--color-border-secondary)', background: 'var(--color-surface-glass)' }}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className={`h-2 w-2 rounded-full flex-shrink-0 ${statusDot[m.status]}`} />
                  <span className="text-sm font-semibold truncate">{m.name}</span>
                  <span className="text-[10px] font-bold uppercase text-[var(--color-text-tertiary)]">{m.status}</span>
                </div>
                <span className="text-xs font-mono text-[var(--color-text-tertiary)] flex-shrink-0">
                  {m.lastErrorMessage ? m.lastErrorMessage.slice(0, 40) : formatResponseTime(m.latestResponseTimeMs)}
                </span>
              </Link>
            ))}
          </div>
        </motion.div>
      )}

      {/* Quick incidents + alerts row */}
      <motion.div variants={stagger} className="grid grid-cols-1 gap-3 lg:grid-cols-2">
        <motion.div variants={fadeUp} className="rounded-2xl border p-5" style={{ borderColor: 'var(--color-border-primary)', background: 'var(--color-surface-glass)' }}>
          <div className="flex items-center gap-2 mb-4">
            <Zap className="h-4 w-4 text-amber-400" />
            <h3 className="text-xs font-bold uppercase tracking-[0.15em] text-[var(--color-text-tertiary)]">
              Open Incidents <span className="text-amber-400 ml-1">{insights.activeIncidents.length}</span>
            </h3>
          </div>
          {insights.activeIncidents.length === 0 ? (
            <p className="text-sm text-emerald-400/70 flex items-center gap-2">
              <CheckCircle className="h-4 w-4" /> No active incidents
            </p>
          ) : (
            <div className="space-y-2">
              {insights.activeIncidents.slice(0, 3).map((inc) => (
                <Link key={inc.id} to={`/monitors/${inc.monitor.id}`} className="flex items-center justify-between gap-3 rounded-xl border px-4 py-3 transition" style={{ borderColor: 'var(--color-border-secondary)', background: 'var(--color-surface-glass)' }}>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold truncate">{inc.monitor.name}</p>
                    <p className="text-[10px] text-[var(--color-text-tertiary)] mt-0.5 truncate">{inc.message}</p>
                  </div>
                  <span className={`text-[10px] font-bold uppercase px-2 py-1 rounded-full ${
                    inc.severity === 'CRITICAL' ? 'bg-rose-500/20 text-rose-400' :
                    inc.severity === 'HIGH' ? 'bg-amber-500/20 text-amber-400' :
                    'bg-slate-500/20 text-slate-400'
                  }`}>{inc.severity}</span>
                </Link>
              ))}
            </div>
          )}
        </motion.div>

        <motion.div variants={fadeUp} className="rounded-2xl border p-5" style={{ borderColor: 'var(--color-border-primary)', background: 'var(--color-surface-glass)' }}>
          <div className="flex items-center gap-2 mb-4">
            <Clock3 className="h-4 w-4 text-sky-400" />
            <h3 className="text-xs font-bold uppercase tracking-[0.15em] text-[var(--color-text-tertiary)]">Quick Stats</h3>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-xl border p-3" style={{ borderColor: 'var(--color-border-secondary)', background: 'var(--color-surface-glass)' }}>
              <p className="text-[9px] font-bold uppercase tracking-wider text-[var(--color-text-tertiary)]">Alerts 24h</p>
              <p className="mt-1 text-xl font-extrabold">{insights.alertsLast24h}</p>
            </div>
            <div className="rounded-xl border p-3" style={{ borderColor: 'var(--color-border-secondary)', background: 'var(--color-surface-glass)' }}>
              <p className="text-[9px] font-bold uppercase tracking-wider text-[var(--color-text-tertiary)]">Critical</p>
              <p className="mt-1 text-xl font-extrabold">{insights.criticalIncidentCount}</p>
            </div>
            <div className="rounded-xl border p-3" style={{ borderColor: 'var(--color-border-secondary)', background: 'var(--color-surface-glass)' }}>
              <p className="text-[9px] font-bold uppercase tracking-wider text-[var(--color-text-tertiary)]">Impact Coverage</p>
              <p className="mt-1 text-xl font-extrabold">{insights.impactCoverage}%</p>
            </div>
            <div className="rounded-xl border p-3" style={{ borderColor: 'var(--color-border-secondary)', background: 'var(--color-surface-glass)' }}>
              <p className="text-[9px] font-bold uppercase tracking-wider text-[var(--color-text-tertiary)]">Watch time</p>
              <p className="mt-1 text-xl font-extrabold">{insights.activeWatchMinutes}m</p>
            </div>
          </div>
        </motion.div>
      </motion.div>
    </motion.div>
  );
}
