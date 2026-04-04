import { useMemo } from 'react';
import type { CSSProperties } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  CartesianGrid,
  Cell,
  PieChart,
  Pie,
  Tooltip as RechartsTooltip,
  XAxis,
  YAxis,
} from 'recharts';
import {
  Activity,
  ArrowUpRight,
  BellRing,
  Boxes,
  Gauge,
  GitCompare,
  Globe,
  ShieldAlert,
  Sparkles,
  TowerControl,
  TriangleAlert,
  Users,
  Zap,
} from 'lucide-react';
import type { ActiveWatchChange, Alert, DashboardInsights, Monitor } from './types';
import { formatPercentage, formatRelativeTime, formatResponseTime } from './types';

const stagger = { hidden: {}, visible: { transition: { staggerChildren: 0.05 } } };
const fadeUp = {
  hidden: { opacity: 0, y: 18 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.35, ease: 'easeOut' } },
};

const tooltipStyle: CSSProperties = {
  backgroundColor: 'rgba(4, 8, 22, 0.96)',
  border: '1px solid rgba(255,255,255,0.08)',
  borderRadius: '18px',
  color: '#e2e8f0',
  fontSize: '12px',
  boxShadow: '0 18px 60px rgba(0,0,0,0.4)',
};

const chartPalette = ['#22d3ee', '#10b981', '#f59e0b', '#f43f5e', '#818cf8', '#38bdf8'];
const statusTone: Record<Monitor['status'], string> = {
  UP: 'text-emerald-300 border-emerald-400/15 bg-emerald-500/10',
  DOWN: 'text-rose-300 border-rose-400/15 bg-rose-500/10',
  DEGRADED: 'text-amber-200 border-amber-300/15 bg-amber-500/10',
  PAUSED: 'text-slate-300 border-slate-300/10 bg-white/[0.04]',
};

function Panel({
  title,
  subtitle,
  icon: Icon,
  badge,
  children,
  action,
  className = '',
}: {
  title: string;
  subtitle: string;
  icon: React.ElementType;
  badge?: string;
  children: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <motion.section
      variants={fadeUp}
      className={`rounded-[30px] border border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.05),rgba(255,255,255,0.025))] p-5 shadow-[0_24px_90px_rgba(0,0,0,0.26)] backdrop-blur-xl ${className}`}
    >
      <div className="mb-5 flex items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-white/8 bg-white/[0.04] text-cyan-300">
            <Icon className="h-5 w-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-semibold text-white">{title}</h3>
              {badge ? (
                <span className="rounded-full border border-cyan-400/15 bg-cyan-400/10 px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.18em] text-cyan-200">
                  {badge}
                </span>
              ) : null}
            </div>
            <p className="mt-1 text-sm text-slate-400">{subtitle}</p>
          </div>
        </div>
        {action}
      </div>
      {children}
    </motion.section>
  );
}

function MetricChip({
  label,
  value,
  helper,
  color,
}: {
  label: string;
  value: string | number;
  helper: string;
  color: string;
}) {
  return (
    <div className="rounded-[24px] border border-white/8 bg-white/[0.03] p-4">
      <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-slate-500">{label}</p>
      <p className={`mt-3 text-2xl font-black ${color}`}>{value}</p>
      <p className="mt-2 text-sm text-slate-400">{helper}</p>
    </div>
  );
}

function EmptyState({ text }: { text: string }) {
  return (
    <div className="rounded-[24px] border border-dashed border-white/10 bg-white/[0.02] px-4 py-10 text-center text-sm text-slate-400">
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
  const latencyLeaders = useMemo(
    () =>
      [...monitors]
        .filter((monitor) => typeof monitor.avgResponseTimeMs === 'number' && monitor.avgResponseTimeMs > 0)
        .sort((a, b) => (b.avgResponseTimeMs ?? 0) - (a.avgResponseTimeMs ?? 0))
        .slice(0, 6)
        .map((monitor) => ({
          name: monitor.name.length > 16 ? `${monitor.name.slice(0, 16)}…` : monitor.name,
          fullName: monitor.name,
          latency: monitor.avgResponseTimeMs ?? 0,
          uptime: monitor.uptimePercentage ?? 0,
          status: monitor.status,
        })),
    [monitors],
  );

  const statusData = useMemo(
    () => insights.statusDistribution.filter((item) => item.total > 0),
    [insights.statusDistribution],
  );

  const typeData = useMemo(
    () => insights.typeDistribution.filter((item) => item.total > 0),
    [insights.typeDistribution],
  );

  const ownerExposure = useMemo(
    () => insights.ownerExposure.slice(0, 5).map((item) => ({ ...item, label: item.owner.length > 12 ? `${item.owner.slice(0, 12)}…` : item.owner })),
    [insights.ownerExposure],
  );

  const attentionDeck = useMemo(
    () => insights.attentionMonitors.slice(0, 4),
    [insights.attentionMonitors],
  );

  const recentAlertFeed = useMemo(() => alerts.slice(0, 7), [alerts]);
  const impactIncidents = useMemo(() => insights.topImpactIncidents.slice(0, 4), [insights.topImpactIncidents]);

  return (
    <motion.div
      key="analytical-real"
      initial="hidden"
      animate="visible"
      exit={{ opacity: 0, scale: 0.985 }}
      variants={stagger}
      className="space-y-5"
    >
      <motion.section variants={fadeUp} className="grid gap-4 xl:grid-cols-[1.2fr_0.9fr_0.9fr]">
        <div className="rounded-[34px] border border-cyan-400/12 bg-[radial-gradient(circle_at_top_left,rgba(34,211,238,0.16),transparent_35%),linear-gradient(135deg,rgba(255,255,255,0.06),rgba(255,255,255,0.02))] p-6 shadow-[0_30px_100px_rgba(0,0,0,0.28)]">
          <div className="flex items-start justify-between gap-5">
            <div className="max-w-xl">
              <div className="inline-flex items-center gap-2 rounded-full border border-cyan-400/15 bg-cyan-400/10 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.24em] text-cyan-200">
                <TowerControl className="h-3.5 w-3.5" />
                Analytical control room
              </div>
              <h2 className="mt-5 text-3xl font-black leading-tight text-white">
                Fleet intelligence driven by your live monitor graph.
              </h2>
              <p className="mt-3 text-sm leading-7 text-slate-300">
                No mocked charts here. These widgets are built from current monitor health, alert volume,
                incident pressure, ownership exposure, and active deploy-watch windows.
              </p>
            </div>
            <div className="hidden rounded-[28px] border border-white/10 bg-slate-950/35 p-4 lg:block">
              <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-slate-500">Health score</p>
              <p className="mt-3 text-5xl font-black text-white">{insights.healthScore}</p>
              <p className="mt-2 text-sm text-slate-400">
                {insights.healthScore >= 90
                  ? 'Everything is riding clean.'
                  : insights.healthScore >= 70
                    ? 'Some pressure detected.'
                    : 'Service posture needs intervention.'}
              </p>
            </div>
          </div>

          <div className="mt-6 grid gap-3 sm:grid-cols-3">
            <MetricChip
              label="Availability"
              value={formatPercentage(insights.fleetAvailability)}
              helper={`${insights.healthy} healthy monitors online`}
              color="text-emerald-300"
            />
            <MetricChip
              label="Average latency"
              value={formatResponseTime(insights.avgResponseTimeMs)}
              helper={`${insights.slowestMonitors[0]?.name ?? 'No sample'} leads the slow lane`}
              color="text-cyan-200"
            />
            <MetricChip
              label="Incident pressure"
              value={insights.activeIncidents.length}
              helper={`${insights.criticalIncidentCount} critical or high severity`}
              color={insights.activeIncidents.length > 0 ? 'text-amber-200' : 'text-slate-100'}
            />
          </div>
        </div>

        <Panel
          title="Status mix"
          subtitle="Current fleet distribution by runtime state."
          icon={Gauge}
          badge="Live"
          className="min-h-[340px]"
        >
          {statusData.length === 0 ? (
            <EmptyState text="Status breakdown appears once monitors start reporting." />
          ) : (
            <div className="grid gap-4 lg:grid-cols-[0.95fr_1.05fr]">
              <div className="h-[220px]">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={statusData} dataKey="total" nameKey="label" innerRadius={52} outerRadius={84} paddingAngle={4}>
                      {statusData.map((entry, index) => (
                        <Cell key={entry.label} fill={chartPalette[index % chartPalette.length]} />
                      ))}
                    </Pie>
                    <RechartsTooltip contentStyle={tooltipStyle} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="space-y-3">
                {statusData.map((item, index) => (
                  <div key={item.label} className="rounded-[22px] border border-white/8 bg-white/[0.03] p-4">
                    <div className="flex items-center justify-between gap-4">
                      <div className="flex items-center gap-3">
                        <span className="h-3 w-3 rounded-full" style={{ backgroundColor: chartPalette[index % chartPalette.length] }} />
                        <p className="text-sm font-semibold text-white">{item.label}</p>
                      </div>
                      <p className="text-lg font-black text-slate-100">{item.total}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </Panel>

        <Panel
          title="Deploy watch"
          subtitle="Watch windows currently shaping investigation context."
          icon={GitCompare}
          badge={activeWatchChanges.length ? `${activeWatchChanges.length} active` : 'Quiet'}
          className="min-h-[340px]"
        >
          {activeWatchChanges.length === 0 ? (
            <EmptyState text="No active watch windows right now." />
          ) : (
            <div className="space-y-3">
              {activeWatchChanges.slice(0, 4).map((change) => (
                <div key={change.id} className="rounded-[24px] border border-white/8 bg-white/[0.03] p-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-white">{change.title}</p>
                      <p className="mt-1 text-xs uppercase tracking-[0.18em] text-slate-500">
                        {change.type} / {change.source}
                      </p>
                    </div>
                    <div className="rounded-full border border-emerald-400/15 bg-emerald-500/10 px-3 py-1 text-xs font-semibold text-emerald-200">
                      {change.watchMinutesRemaining ?? 0}m left
                    </div>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2 text-xs text-slate-400">
                    {change.serviceName ? <span className="rounded-full border border-white/8 px-3 py-1">Service: {change.serviceName}</span> : null}
                    <span className="rounded-full border border-white/8 px-3 py-1">{formatRelativeTime(change.happenedAt)}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Panel>
      </motion.section>

      <motion.section variants={stagger} className="grid gap-4 xl:grid-cols-[1.35fr_0.95fr]">
        <Panel
          title="Latency skyline"
          subtitle="Slowest monitors by average response time right now."
          icon={Activity}
          action={
            <Link to="/monitors" className="inline-flex items-center gap-1 text-xs font-semibold text-cyan-200 transition hover:text-white">
              Open monitors <ArrowUpRight className="h-3.5 w-3.5" />
            </Link>
          }
        >
          {latencyLeaders.length === 0 ? (
            <EmptyState text="Latency data will appear after a few successful checks." />
          ) : (
            <div className="h-[280px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={latencyLeaders} barCategoryGap="18%">
                  <CartesianGrid stroke="rgba(255,255,255,0.05)" vertical={false} />
                  <XAxis dataKey="name" tick={{ fill: '#94a3b8', fontSize: 11 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fill: '#64748b', fontSize: 11 }} axisLine={false} tickLine={false} width={42} />
                  <RechartsTooltip
                    contentStyle={tooltipStyle}
                    formatter={(value) => [`${value}ms`, 'Latency']}
                    labelFormatter={(label, payload) => (payload?.[0]?.payload as { fullName?: string })?.fullName || label}
                  />
                  <Bar dataKey="latency" radius={[12, 12, 0, 0]}>
                    {latencyLeaders.map((item) => (
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
          )}
        </Panel>

        <Panel title="Attention deck" subtitle="Highest-priority monitors needing eyes." icon={TriangleAlert} badge={`${attentionDeck.length} flagged`}>
          {attentionDeck.length === 0 ? (
            <EmptyState text="The attention deck is empty. Your fleet is calm." />
          ) : (
            <div className="space-y-3">
              {attentionDeck.map((monitor) => (
                <Link
                  key={monitor.id}
                  to={`/monitors/${monitor.id}`}
                  className="block rounded-[24px] border border-white/8 bg-white/[0.03] p-4 transition hover:border-white/14 hover:bg-white/[0.05]"
                >
                  <div className="flex items-center justify-between gap-4">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-white">{monitor.name}</p>
                      <p className="mt-1 truncate text-xs text-slate-500">{monitor.url}</p>
                    </div>
                    <span className={`rounded-full border px-3 py-1 text-[11px] font-semibold ${statusTone[monitor.status]}`}>
                      {monitor.status}
                    </span>
                  </div>
                  <div className="mt-4 grid grid-cols-3 gap-2 text-xs">
                    <div className="rounded-2xl border border-white/8 bg-slate-950/30 px-3 py-2">
                      <p className="text-slate-500">Latency</p>
                      <p className="mt-1 font-semibold text-slate-100">{formatResponseTime(monitor.avgResponseTimeMs)}</p>
                    </div>
                    <div className="rounded-2xl border border-white/8 bg-slate-950/30 px-3 py-2">
                      <p className="text-slate-500">Uptime</p>
                      <p className="mt-1 font-semibold text-slate-100">{formatPercentage(monitor.uptimePercentage)}</p>
                    </div>
                    <div className="rounded-2xl border border-white/8 bg-slate-950/30 px-3 py-2">
                      <p className="text-slate-500">Last check</p>
                      <p className="mt-1 font-semibold text-slate-100">{formatRelativeTime(monitor.lastCheckedAt)}</p>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </Panel>
      </motion.section>

      <motion.section variants={stagger} className="grid gap-4 xl:grid-cols-[0.95fr_1.05fr_1fr]">
        <Panel title="Protocol mix" subtitle="How your fleet is distributed by monitor type." icon={Boxes}>
          {typeData.length === 0 ? (
            <EmptyState text="Type distribution appears once monitors exist." />
          ) : (
            <div className="h-[250px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={typeData} layout="vertical" barCategoryGap="22%">
                  <CartesianGrid stroke="rgba(255,255,255,0.05)" horizontal={false} />
                  <XAxis type="number" tick={{ fill: '#64748b', fontSize: 11 }} axisLine={false} tickLine={false} />
                  <YAxis dataKey="type" type="category" tick={{ fill: '#cbd5e1', fontSize: 12 }} axisLine={false} tickLine={false} width={54} />
                  <RechartsTooltip contentStyle={tooltipStyle} />
                  <Bar dataKey="total" radius={[0, 12, 12, 0]}>
                    {typeData.map((item, index) => (
                      <Cell key={item.type} fill={chartPalette[index % chartPalette.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </Panel>

        <Panel title="Ownership exposure" subtitle="Teams currently holding the most active risk." icon={Users}>
          {ownerExposure.length === 0 ? (
            <EmptyState text="Ownership exposure shows up when impact metadata is mapped." />
          ) : (
            <div className="space-y-3">
              {ownerExposure.map((item, index) => (
                <div key={item.owner} className="rounded-[24px] border border-white/8 bg-white/[0.03] p-4">
                  <div className="flex items-center justify-between gap-4">
                    <p className="text-sm font-semibold text-white">{item.owner}</p>
                    <p className="text-lg font-black text-slate-100">{item.total}</p>
                  </div>
                  <div className="mt-3 h-2 rounded-full bg-white/[0.05]">
                    <div
                      className="h-2 rounded-full"
                      style={{
                        width: `${Math.min(100, (item.total / Math.max(ownerExposure[0]?.total || 1, 1)) * 100)}%`,
                        backgroundColor: chartPalette[index % chartPalette.length],
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </Panel>

        <Panel title="Impact incidents" subtitle="Highest-impact live incidents across the fleet." icon={ShieldAlert}>
          {impactIncidents.length === 0 ? (
            <EmptyState text="No open incidents right now." />
          ) : (
            <div className="space-y-3">
              {impactIncidents.map((incident) => (
                <Link
                  key={incident.id}
                  to={`/monitors/${incident.monitor.id}`}
                  className="block rounded-[24px] border border-white/8 bg-white/[0.03] p-4 transition hover:border-white/14 hover:bg-white/[0.05]"
                >
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-sm font-semibold text-white">{incident.monitor.name}</p>
                    <span className="rounded-full border border-amber-400/15 bg-amber-500/10 px-3 py-1 text-[11px] font-semibold text-amber-200">
                      {incident.severity}
                    </span>
                  </div>
                  <p className="mt-2 text-sm text-slate-400">{incident.message}</p>
                  <div className="mt-4 flex flex-wrap gap-2 text-xs text-slate-500">
                    <span className="rounded-full border border-white/8 px-3 py-1">Impact {incident.impactScore}</span>
                    <span className="rounded-full border border-white/8 px-3 py-1">{formatRelativeTime(incident.createdAt)}</span>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </Panel>
      </motion.section>

      <motion.section variants={stagger} className="grid gap-4 xl:grid-cols-[1.05fr_0.95fr]">
        <Panel title="Alert stream" subtitle="Newest alerts and resolutions flowing through the workspace." icon={BellRing}>
          {recentAlertFeed.length === 0 ? (
            <EmptyState text="No recent alerts. That is a good look." />
          ) : (
            <div className="space-y-3">
              {recentAlertFeed.map((alert) => (
                <div key={alert.id} className="rounded-[24px] border border-white/8 bg-white/[0.03] p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div
                        className={`h-2.5 w-2.5 rounded-full ${
                          alert.status === 'RESOLVED'
                            ? 'bg-emerald-400'
                            : alert.status === 'ACKNOWLEDGED'
                              ? 'bg-sky-400'
                              : 'bg-amber-400'
                        }`}
                      />
                      <p className="text-sm font-semibold text-white">{alert.monitor.name}</p>
                    </div>
                    <span className="rounded-full border border-white/8 px-3 py-1 text-[11px] font-semibold text-slate-300">
                      {alert.status}
                    </span>
                  </div>
                  <p className="mt-2 text-sm text-slate-400">{alert.message}</p>
                  <p className="mt-3 text-xs uppercase tracking-[0.18em] text-slate-500">{formatRelativeTime(alert.createdAt)}</p>
                </div>
              ))}
            </div>
          )}
        </Panel>

        <Panel
          title="Fast lane"
          subtitle="Monitors currently posting the cleanest response times."
          icon={Sparkles}
          action={
            <Link to="/monitors" className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-200 transition hover:text-white">
              Explore all <ArrowUpRight className="h-3.5 w-3.5" />
            </Link>
          }
        >
          {insights.fastestMonitors.length === 0 ? (
            <EmptyState text="Speed leaders will appear once checks start coming in." />
          ) : (
            <div className="space-y-3">
              {insights.fastestMonitors.map((monitor, index) => (
                <Link
                  key={monitor.id}
                  to={`/monitors/${monitor.id}`}
                  className="flex items-center justify-between gap-4 rounded-[24px] border border-white/8 bg-white/[0.03] p-4 transition hover:border-white/14 hover:bg-white/[0.05]"
                >
                  <div className="flex items-center gap-4">
                    <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-emerald-400/15 bg-emerald-500/10 text-sm font-black text-emerald-200">
                      0{index + 1}
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-white">{monitor.name}</p>
                      <p className="mt-1 text-xs text-slate-500">{monitor.url}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-lg font-black text-emerald-200">{formatResponseTime(monitor.avgResponseTimeMs)}</p>
                    <p className="text-xs text-slate-500">{formatPercentage(monitor.uptimePercentage)} uptime</p>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </Panel>
      </motion.section>

      <motion.section variants={fadeUp} className="grid gap-4 lg:grid-cols-4">
        <MetricChip
          label="Mapped impact"
          value={`${insights.impactCoverage}%`}
          helper={`${insights.impactMappedMonitors} of ${insights.total} monitors mapped`}
          color="text-cyan-200"
        />
        <MetricChip
          label="Affected features"
          value={insights.affectedFeatures}
          helper="Features currently touched by active issues"
          color="text-amber-200"
        />
        <MetricChip
          label="Affected journeys"
          value={insights.affectedJourneys}
          helper="Customer journeys at active risk"
          color="text-rose-200"
        />
        <MetricChip
          label="Alerts / 24h"
          value={insights.alertsLast24h}
          helper="Recent system noise across all channels"
          color="text-slate-100"
        />
      </motion.section>
    </motion.div>
  );
}
