import { useMemo } from 'react';
import type { CSSProperties, ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ResponsiveContainer, BarChart, Bar, CartesianGrid, Cell, PieChart, Pie, Tooltip as RechartsTooltip } from 'recharts';
import {
  Activity,
  ArrowUpRight,
  BellRing,
  Compass,
  Gauge,
  GitCompare,
  ShieldAlert,
  Sparkles,
  TimerReset,
  TriangleAlert,
  Waves,
  Zap,
} from 'lucide-react';
import type { ActiveWatchChange, Alert, DashboardInsights, Monitor } from './types';
import { formatPercentage, formatRelativeTime, formatResponseTime } from './types';

const fadeUp = {
  hidden: { opacity: 0, y: 22 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.42, ease: 'easeOut' } },
};

const tooltipStyle: CSSProperties = {
  backgroundColor: 'rgba(4, 8, 22, 0.96)',
  border: '1px solid rgba(255,255,255,0.08)',
  borderRadius: '18px',
  color: '#e2e8f0',
  fontSize: '12px',
  boxShadow: '0 18px 60px rgba(0,0,0,0.4)',
};

const panel =
  'rounded-[32px] border border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.055),rgba(255,255,255,0.022))] shadow-[0_30px_100px_rgba(0,0,0,0.3)] backdrop-blur-xl';

function Section({
  title,
  caption,
  icon: Icon,
  action,
  children,
  className = '',
}: {
  title: string;
  caption: string;
  icon: React.ElementType;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <motion.section variants={fadeUp} className={`${panel} p-6 ${className}`}>
      <div className="mb-6 flex items-start justify-between gap-4">
        <div className="flex items-start gap-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-white/8 bg-white/[0.05] text-cyan-200">
            <Icon className="h-5 w-5" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-white">{title}</h3>
            <p className="mt-1 text-sm text-slate-400">{caption}</p>
          </div>
        </div>
        {action}
      </div>
      {children}
    </motion.section>
  );
}

function MetricCard({
  label,
  value,
  helper,
  tone,
}: {
  label: string;
  value: string | number;
  helper: string;
  tone: string;
}) {
  return (
    <motion.div
      variants={fadeUp}
      whileHover={{ y: -4, scale: 1.01 }}
      transition={{ duration: 0.2 }}
      className="rounded-[28px] border border-white/8 bg-white/[0.035] p-5"
    >
      <p className="text-[10px] font-bold uppercase tracking-[0.24em] text-slate-500">{label}</p>
      <p className={`mt-4 text-3xl font-black ${tone}`}>{value}</p>
      <p className="mt-2 text-sm text-slate-400">{helper}</p>
    </motion.div>
  );
}

function EmptyState({ text }: { text: string }) {
  return (
    <div className="rounded-[26px] border border-dashed border-white/10 bg-white/[0.02] px-5 py-12 text-center text-sm text-slate-400">
      {text}
    </div>
  );
}

export default function AnalyticalView({
  insights,
  monitors,
  alerts,
  activeWatchChanges,
}: {
  insights: DashboardInsights;
  monitors: Monitor[];
  alerts: Alert[];
  activeWatchChanges: ActiveWatchChange[];
}) {
  const slowLane = useMemo(
    () =>
      [...monitors]
        .filter((monitor) => typeof monitor.avgResponseTimeMs === 'number' && monitor.avgResponseTimeMs > 0)
        .sort((a, b) => (b.avgResponseTimeMs ?? 0) - (a.avgResponseTimeMs ?? 0))
        .slice(0, 5)
        .map((monitor) => ({
          name: monitor.name.length > 14 ? `${monitor.name.slice(0, 14)}…` : monitor.name,
          fullName: monitor.name,
          latency: monitor.avgResponseTimeMs ?? 0,
          status: monitor.status,
        })),
    [monitors],
  );

  const posture = useMemo(
    () => insights.statusDistribution.filter((item) => item.total > 0),
    [insights.statusDistribution],
  );

  const attentionMonitors = useMemo(
    () => insights.attentionMonitors.slice(0, 4),
    [insights.attentionMonitors],
  );

  const freshAlerts = useMemo(() => alerts.slice(0, 5), [alerts]);
  const activeChanges = useMemo(() => activeWatchChanges.slice(0, 3), [activeWatchChanges]);

  const postureColors = ['#22d3ee', '#10b981', '#f59e0b', '#f43f5e'];

  return (
    <motion.div
      key="analytical-premium"
      initial="hidden"
      animate="visible"
      exit={{ opacity: 0, y: 8 }}
      transition={{ staggerChildren: 0.05 }}
      className="space-y-5"
    >
      <motion.section
        variants={fadeUp}
        className="overflow-hidden rounded-[36px] border border-cyan-400/12 bg-[radial-gradient(circle_at_top_left,rgba(34,211,238,0.18),transparent_28%),radial-gradient(circle_at_80%_20%,rgba(16,185,129,0.14),transparent_22%),linear-gradient(135deg,rgba(255,255,255,0.06),rgba(255,255,255,0.02))] p-6 shadow-[0_36px_120px_rgba(0,0,0,0.32)]"
      >
        <div className="flex flex-col gap-8 xl:flex-row xl:items-end xl:justify-between">
          <div className="max-w-3xl">
            <div className="inline-flex items-center gap-2 rounded-full border border-cyan-400/15 bg-cyan-400/10 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.26em] text-cyan-200">
              <Compass className="h-3.5 w-3.5" />
              Analytical mode
            </div>
            <h2 className="mt-5 max-w-2xl text-4xl font-black leading-tight text-white">
              Cleaner board. Bigger signal. Less dashboard noise.
            </h2>
            <p className="mt-4 max-w-2xl text-sm leading-7 text-slate-300">
              This view is intentionally more editorial than dense: top KPIs, active risk, slow lane,
              alert motion, and deploy-watch context without burying you under synthetic charts.
            </p>
          </div>

          <motion.div
            animate={{ y: [0, -6, 0] }}
            transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
            className="grid gap-3 sm:grid-cols-2 xl:w-[440px]"
          >
            <div className="rounded-[28px] border border-white/8 bg-slate-950/30 p-5">
              <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-slate-500">Health score</p>
              <p className="mt-3 text-5xl font-black text-white">{insights.healthScore}</p>
              <p className="mt-2 text-sm text-slate-400">
                {insights.healthScore >= 90
                  ? 'Everything is stable.'
                  : insights.healthScore >= 70
                    ? 'Some pressure detected.'
                    : 'Intervention needed.'}
              </p>
            </div>
            <div className="rounded-[28px] border border-white/8 bg-slate-950/30 p-5">
              <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-slate-500">Open incidents</p>
              <p className="mt-3 text-5xl font-black text-white">{insights.activeIncidents.length}</p>
              <p className="mt-2 text-sm text-slate-400">
                {insights.criticalIncidentCount} high or critical
              </p>
            </div>
          </motion.div>
        </div>
      </motion.section>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          label="Fleet availability"
          value={formatPercentage(insights.fleetAvailability)}
          helper={`${insights.healthy} healthy monitors live`}
          tone="text-emerald-300"
        />
        <MetricCard
          label="Average latency"
          value={formatResponseTime(insights.avgResponseTimeMs)}
          helper={insights.slowestMonitors[0]?.name || 'Waiting for samples'}
          tone="text-cyan-200"
        />
        <MetricCard
          label="Alerts / 24h"
          value={insights.alertsLast24h}
          helper="Recent noise across channels"
          tone="text-slate-100"
        />
        <MetricCard
          label="Impact coverage"
          value={`${insights.impactCoverage}%`}
          helper={`${insights.impactMappedMonitors} mapped monitors`}
          tone="text-violet-200"
        />
      </div>

      <div className="grid gap-5 xl:grid-cols-[1.15fr_0.85fr]">
        <Section
          title="Latency slow lane"
          caption="A single graph, focused on the monitors currently dragging the fleet."
          icon={Gauge}
          action={
            <Link to="/monitors" className="inline-flex items-center gap-1 text-xs font-semibold text-cyan-200 transition hover:text-white">
              Open monitors <ArrowUpRight className="h-3.5 w-3.5" />
            </Link>
          }
        >
          {slowLane.length === 0 ? (
            <EmptyState text="Latency rankings appear as checks come in." />
          ) : (
            <div className="grid gap-5 lg:grid-cols-[1.15fr_0.85fr]">
              <div className="h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={slowLane} barCategoryGap="18%">
                    <CartesianGrid stroke="rgba(255,255,255,0.05)" vertical={false} />
                    <RechartsTooltip
                      contentStyle={tooltipStyle}
                      formatter={(value) => [`${value}ms`, 'Latency']}
                      labelFormatter={(label, payload) => (payload?.[0]?.payload as { fullName?: string })?.fullName || label}
                    />
                    <Bar dataKey="latency" radius={[14, 14, 0, 0]}>
                      {slowLane.map((item) => (
                        <Cell
                          key={item.fullName}
                          fill={
                            item.status === 'DOWN'
                              ? '#f43f5e'
                              : item.status === 'DEGRADED'
                                ? '#f59e0b'
                                : '#22d3ee'
                          }
                        />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <div className="space-y-3">
                {slowLane.map((monitor) => (
                  <motion.div
                    key={monitor.fullName}
                    whileHover={{ x: 4 }}
                    className="rounded-[24px] border border-white/8 bg-white/[0.03] p-4"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-sm font-semibold text-white">{monitor.fullName}</p>
                      <p className="text-lg font-black text-slate-100">{monitor.latency}ms</p>
                    </div>
                    <p className="mt-2 text-xs uppercase tracking-[0.18em] text-slate-500">{monitor.status}</p>
                  </motion.div>
                ))}
              </div>
            </div>
          )}
        </Section>

        <Section title="Fleet posture" caption="Current state distribution across the monitor stack." icon={Waves}>
          {posture.length === 0 ? (
            <EmptyState text="Posture appears once monitors are reporting." />
          ) : (
            <div className="grid items-center gap-5 sm:grid-cols-[1fr_1fr]">
              <div className="h-[240px]">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={posture} dataKey="total" nameKey="label" innerRadius={56} outerRadius={84} paddingAngle={4}>
                      {posture.map((entry, index) => (
                        <Cell key={entry.label} fill={postureColors[index % postureColors.length]} />
                      ))}
                    </Pie>
                    <RechartsTooltip contentStyle={tooltipStyle} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="space-y-3">
                {posture.map((item, index) => (
                  <div key={item.label} className="rounded-[24px] border border-white/8 bg-white/[0.03] p-4">
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <span className="h-3 w-3 rounded-full" style={{ backgroundColor: postureColors[index % postureColors.length] }} />
                        <p className="text-sm font-semibold text-white">{item.label}</p>
                      </div>
                      <p className="text-lg font-black text-slate-100">{item.total}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </Section>
      </div>

      <div className="grid gap-5 xl:grid-cols-[1fr_1fr_1fr]">
        <Section title="Attention deck" caption="Only the monitors that need human eyes right now." icon={TriangleAlert}>
          {attentionMonitors.length === 0 ? (
            <EmptyState text="No monitors are demanding attention right now." />
          ) : (
            <div className="space-y-3">
              {attentionMonitors.map((monitor) => (
                <Link
                  key={monitor.id}
                  to={`/monitors/${monitor.id}`}
                  className="block rounded-[24px] border border-white/8 bg-white/[0.03] p-4 transition hover:border-white/14 hover:bg-white/[0.05]"
                >
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-sm font-semibold text-white">{monitor.name}</p>
                    <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-[11px] font-semibold text-slate-200">
                      {monitor.status}
                    </span>
                  </div>
                  <p className="mt-2 text-sm text-slate-400">
                    {monitor.latestDiagnosis?.summary || monitor.lastErrorMessage || 'Needs review'}
                  </p>
                  <p className="mt-3 text-xs text-slate-500">{formatRelativeTime(monitor.lastCheckedAt)}</p>
                </Link>
              ))}
            </div>
          )}
        </Section>

        <Section title="Alert stream" caption="Recent state changes and operator-visible noise." icon={BellRing}>
          {freshAlerts.length === 0 ? (
            <EmptyState text="No fresh alerts. The stream is calm." />
          ) : (
            <div className="space-y-3">
              {freshAlerts.map((alert) => (
                <motion.div
                  key={alert.id}
                  whileHover={{ scale: 1.01 }}
                  className="rounded-[24px] border border-white/8 bg-white/[0.03] p-4"
                >
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-sm font-semibold text-white">{alert.monitor.name}</p>
                    <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-[11px] font-semibold text-slate-200">
                      {alert.status}
                    </span>
                  </div>
                  <p className="mt-2 text-sm text-slate-400">{alert.message}</p>
                  <p className="mt-3 text-xs uppercase tracking-[0.18em] text-slate-500">
                    {formatRelativeTime(alert.createdAt)}
                  </p>
                </motion.div>
              ))}
            </div>
          )}
        </Section>

        <Section title="Deploy watch" caption="Changes still sitting inside active observation windows." icon={GitCompare}>
          {activeChanges.length === 0 ? (
            <EmptyState text="No active watch windows at the moment." />
          ) : (
            <div className="space-y-3">
              {activeChanges.map((change) => (
                <motion.div
                  key={change.id}
                  whileHover={{ scale: 1.01 }}
                  className="rounded-[24px] border border-white/8 bg-white/[0.03] p-4"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="text-sm font-semibold text-white">{change.title}</p>
                      <p className="mt-2 text-xs uppercase tracking-[0.18em] text-slate-500">
                        {change.type} / {change.source}
                      </p>
                    </div>
                    <div className="rounded-full border border-emerald-400/15 bg-emerald-500/10 px-3 py-1 text-xs font-semibold text-emerald-200">
                      {change.watchMinutesRemaining ?? 0}m
                    </div>
                  </div>
                  <p className="mt-3 text-sm text-slate-400">
                    {change.serviceName || 'Service not mapped'}
                  </p>
                </motion.div>
              ))}
            </div>
          )}
        </Section>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          label="Mapped impact"
          value={`${insights.impactCoverage}%`}
          helper={`${insights.affectedFeatures} features touched`}
          tone="text-cyan-200"
        />
        <MetricCard
          label="Affected journeys"
          value={insights.affectedJourneys}
          helper="Journeys under active risk"
          tone="text-amber-200"
        />
        <MetricCard
          label="Watch time"
          value={`${insights.activeWatchMinutes}m`}
          helper="Active deploy-watch minutes"
          tone="text-emerald-200"
        />
        <MetricCard
          label="Fastest monitor"
          value={formatResponseTime(insights.fastestMonitor?.avgResponseTimeMs)}
          helper={insights.fastestMonitor?.name || 'No sample yet'}
          tone="text-slate-100"
        />
      </div>
    </motion.div>
  );
}
