import { useMemo } from 'react';
import type { CSSProperties, ReactNode } from 'react';
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
  LineChart,
  Line,
  AreaChart,
  Area,
} from 'recharts';
import {
  Activity,
  ArrowUpRight,
  BellRing,
  Compass,
  Gauge,
  GitCompare,
  Globe2,
  Layers3,
  Orbit,
  ShieldAlert,
  Sparkles,
  Target,
  TowerControl,
  TriangleAlert,
  Trophy,
  Users,
  Waves,
  Zap,
} from 'lucide-react';
import type { ActiveWatchChange, Alert, DashboardInsights, Monitor } from './types';
import { formatPercentage, formatRelativeTime, formatResponseTime } from './types';

const fadeUp = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.38, ease: 'easeOut' } },
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
  'rounded-[32px] border border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.055),rgba(255,255,255,0.02))] shadow-[0_30px_100px_rgba(0,0,0,0.3)] backdrop-blur-xl';

function Section({
  title,
  caption,
  icon: Icon,
  action,
  children,
}: {
  title: string;
  caption: string;
  icon: React.ElementType;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <motion.section variants={fadeUp} className={`${panel} p-6`}>
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

function RankedStrip({
  items,
  color,
  suffix = '',
}: {
  items: Array<{ label: string; value: number; helper?: string }>;
  color: string;
  suffix?: string;
}) {
  if (items.length === 0) {
    return <EmptyState text="No data available yet." />;
  }

  const max = Math.max(...items.map((item) => item.value), 1);

  return (
    <div className="space-y-3">
      {items.map((item, index) => (
        <div key={item.label} className="rounded-[22px] border border-white/8 bg-white/[0.03] p-3">
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm font-semibold text-white">{item.label}</p>
            <p className="text-sm font-black text-slate-100">
              {item.value}
              {suffix}
            </p>
          </div>
          {item.helper ? <p className="mt-1 text-xs text-slate-500">{item.helper}</p> : null}
          <div className="mt-3 h-2 rounded-full bg-white/[0.05]">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${(item.value / max) * 100}%` }}
              transition={{ duration: 0.7, delay: index * 0.06 }}
              className="h-2 rounded-full"
              style={{ backgroundColor: color }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}

function hourLabel(dateString: string) {
  return new Date(dateString).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
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
  const monitorSeries = useMemo(() => {
    return [...monitors]
      .filter((monitor) => monitor.lastCheckedAt)
      .sort((a, b) => new Date(a.lastCheckedAt ?? 0).getTime() - new Date(b.lastCheckedAt ?? 0).getTime())
      .slice(-12)
      .map((monitor) => ({
        label: hourLabel(monitor.lastCheckedAt as string),
        latency: monitor.avgResponseTimeMs ?? 0,
        uptime: Number((monitor.uptimePercentage ?? 0).toFixed(1)),
        name: monitor.name,
      }));
  }, [monitors]);

  const eventSeries = useMemo(() => {
    const bucketMap = new Map<string, { label: string; alerts: number; changes: number }>();

    for (const alert of alerts) {
      const key = hourLabel(alert.createdAt);
      const current = bucketMap.get(key) ?? { label: key, alerts: 0, changes: 0 };
      current.alerts += 1;
      bucketMap.set(key, current);
    }

    for (const change of activeWatchChanges) {
      const key = hourLabel(change.happenedAt);
      const current = bucketMap.get(key) ?? { label: key, alerts: 0, changes: 0 };
      current.changes += 1;
      bucketMap.set(key, current);
    }

    return [...bucketMap.values()].slice(-10);
  }, [alerts, activeWatchChanges]);

  const slowLane = useMemo(
    () =>
      [...monitors]
        .filter((monitor) => typeof monitor.avgResponseTimeMs === 'number' && monitor.avgResponseTimeMs > 0)
        .sort((a, b) => (b.avgResponseTimeMs ?? 0) - (a.avgResponseTimeMs ?? 0))
        .slice(0, 6)
        .map((monitor) => ({
          label: monitor.name,
          value: monitor.avgResponseTimeMs ?? 0,
          helper: `${formatPercentage(monitor.uptimePercentage)} uptime`,
        })),
    [monitors],
  );

  const fastLane = useMemo(
    () =>
      [...monitors]
        .filter((monitor) => typeof monitor.avgResponseTimeMs === 'number' && monitor.avgResponseTimeMs > 0)
        .sort((a, b) => (a.avgResponseTimeMs ?? 0) - (b.avgResponseTimeMs ?? 0))
        .slice(0, 5)
        .map((monitor) => ({
          label: monitor.name,
          value: monitor.avgResponseTimeMs ?? 0,
          helper: `${formatPercentage(monitor.uptimePercentage)} uptime`,
        })),
    [monitors],
  );

  const weakestUptime = useMemo(
    () =>
      [...monitors]
        .filter((monitor) => typeof monitor.uptimePercentage === 'number')
        .sort((a, b) => (a.uptimePercentage ?? 0) - (b.uptimePercentage ?? 0))
        .slice(0, 5)
        .map((monitor) => ({
          label: monitor.name,
          value: Math.round(monitor.uptimePercentage ?? 0),
          helper: formatResponseTime(monitor.avgResponseTimeMs),
        })),
    [monitors],
  );

  const posture = useMemo(
    () => insights.statusDistribution.filter((item) => item.total > 0),
    [insights.statusDistribution],
  );

  const typeMix = useMemo(
    () => insights.typeDistribution.filter((item) => item.total > 0),
    [insights.typeDistribution],
  );

  const ownerPressure = useMemo(
    () => insights.ownerExposure.slice(0, 5).map((item) => ({ label: item.owner, value: item.total })),
    [insights.ownerExposure],
  );

  const regionPressure = useMemo(
    () => insights.regionExposure.slice(0, 5).map((item) => ({ label: item.region, value: item.total })),
    [insights.regionExposure],
  );

  const slaPressure = useMemo(
    () => insights.slaPressure.slice(0, 4).map((item) => ({ label: item.tier, value: item.total })),
    [insights.slaPressure],
  );

  const attentionMonitors = useMemo(
    () =>
      insights.attentionMonitors.slice(0, 4).map((monitor) => ({
        id: monitor.id,
        name: monitor.name,
        status: monitor.status,
        summary:
          monitor.latestDiagnosis?.summary ||
          monitor.lastErrorMessage ||
          `${formatResponseTime(monitor.avgResponseTimeMs)} avg response`,
        checkedAt: monitor.lastCheckedAt,
      })),
    [insights.attentionMonitors],
  );

  const freshAlerts = useMemo(() => alerts.slice(0, 6), [alerts]);
  const activeChanges = useMemo(() => activeWatchChanges.slice(0, 4), [activeWatchChanges]);
  const impactIncidents = useMemo(() => insights.topImpactIncidents.slice(0, 4), [insights.topImpactIncidents]);

  const missingMapping = useMemo(() => {
    return monitors
      .filter(
        (monitor) =>
          !monitor.impactMetadata?.serviceName ||
          !monitor.impactMetadata?.teamOwner ||
          !monitor.impactMetadata?.featureName,
      )
      .slice(0, 5)
      .map((monitor) => ({
        label: monitor.name,
        value:
          Number(!monitor.impactMetadata?.serviceName) +
          Number(!monitor.impactMetadata?.teamOwner) +
          Number(!monitor.impactMetadata?.featureName),
        helper: 'mapping gaps',
      }));
  }, [monitors]);

  const diagnosisMix = useMemo(() => {
    const buckets = new Map<string, number>();
    for (const monitor of monitors) {
      const code = monitor.latestDiagnosis?.code;
      if (!code) continue;
      buckets.set(code, (buckets.get(code) || 0) + 1);
    }
    return [...buckets.entries()]
      .map(([label, value]) => ({ label: label.replaceAll('_', ' '), value, helper: 'monitors' }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 5);
  }, [monitors]);

  const protocolColors = ['#22d3ee', '#10b981', '#f59e0b', '#8b5cf6'];
  const postureColors = ['#10b981', '#f43f5e', '#f59e0b', '#64748b'];

  return (
    <motion.div
      key="analytical-premium-dense"
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
              <TowerControl className="h-3.5 w-3.5" />
              Analytical mode
            </div>
            <h2 className="mt-5 max-w-2xl text-4xl font-black leading-tight text-white">
              Clean board with real X-Y analytics.
            </h2>
            <p className="mt-4 max-w-2xl text-sm leading-7 text-slate-300">
              This board now mixes trend charts with ranked intelligence: response movement, alert/change
              motion, fleet posture, ownership pressure, protocol mix, and impact context.
            </p>
          </div>

          <motion.div
            animate={{ y: [0, -6, 0] }}
            transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
            className="grid gap-3 sm:grid-cols-2 xl:w-[460px]"
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
              <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-slate-500">Active incidents</p>
              <p className="mt-3 text-5xl font-black text-white">{insights.activeIncidents.length}</p>
              <p className="mt-2 text-sm text-slate-400">{insights.criticalIncidentCount} high or critical severity</p>
            </div>
          </motion.div>
        </div>
      </motion.section>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard label="Fleet availability" value={formatPercentage(insights.fleetAvailability)} helper={`${insights.healthy} healthy monitors live`} tone="text-emerald-300" />
        <MetricCard label="Average latency" value={formatResponseTime(insights.avgResponseTimeMs)} helper={insights.slowestMonitors[0]?.name || 'Waiting for samples'} tone="text-cyan-200" />
        <MetricCard label="Alerts / 24h" value={insights.alertsLast24h} helper="Recent operator-visible noise" tone="text-slate-100" />
        <MetricCard label="Impact coverage" value={`${insights.impactCoverage}%`} helper={`${insights.impactMappedMonitors} mapped monitors`} tone="text-violet-200" />
      </div>

      <div className="grid gap-5 xl:grid-cols-[1.2fr_0.8fr]">
        <Section
          title="Response movement"
          caption="Monitor check freshness plotted as a true X-Y performance trend."
          icon={Gauge}
          action={
            <Link to="/monitors" className="inline-flex items-center gap-1 text-xs font-semibold text-cyan-200 transition hover:text-white">
              Open monitors <ArrowUpRight className="h-3.5 w-3.5" />
            </Link>
          }
        >
          {monitorSeries.length === 0 ? (
            <EmptyState text="Response trend appears once recent checks have been recorded." />
          ) : (
            <div className="grid gap-5 lg:grid-cols-[1.2fr_0.8fr]">
              <div className="h-[320px]">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={monitorSeries}>
                    <CartesianGrid stroke="rgba(255,255,255,0.05)" vertical={false} />
                    <XAxis dataKey="label" tick={{ fill: '#64748b', fontSize: 10 }} axisLine={false} tickLine={false} />
                    <YAxis yAxisId="latency" tick={{ fill: '#64748b', fontSize: 10 }} axisLine={false} tickLine={false} width={42} />
                    <YAxis yAxisId="uptime" orientation="right" tick={{ fill: '#64748b', fontSize: 10 }} axisLine={false} tickLine={false} width={42} />
                    <RechartsTooltip
                      contentStyle={tooltipStyle}
                      formatter={(value, name) => [name === 'latency' ? `${value}ms` : `${value}%`, name === 'latency' ? 'Latency' : 'Uptime']}
                      labelFormatter={(_label, payload) => (payload?.[0]?.payload as { name?: string })?.name || ''}
                    />
                    <Line yAxisId="latency" type="monotone" dataKey="latency" stroke="#22d3ee" strokeWidth={3} dot={{ r: 4, fill: '#22d3ee' }} activeDot={{ r: 6 }} />
                    <Line yAxisId="uptime" type="monotone" dataKey="uptime" stroke="#10b981" strokeWidth={2.5} dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              </div>

              <div className="space-y-3">
                {monitorSeries.slice(-5).reverse().map((point) => (
                  <div key={`${point.name}-${point.label}`} className="rounded-[24px] border border-white/8 bg-white/[0.03] p-4">
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-sm font-semibold text-white">{point.name}</p>
                      <p className="text-xs uppercase tracking-[0.18em] text-slate-500">{point.label}</p>
                    </div>
                    <div className="mt-3 grid grid-cols-2 gap-3 text-sm">
                      <div className="rounded-2xl border border-white/8 bg-slate-950/25 px-3 py-2">
                        <p className="text-xs text-slate-500">Latency</p>
                        <p className="mt-1 font-black text-cyan-200">{point.latency}ms</p>
                      </div>
                      <div className="rounded-2xl border border-white/8 bg-slate-950/25 px-3 py-2">
                        <p className="text-xs text-slate-500">Uptime</p>
                        <p className="mt-1 font-black text-emerald-200">{point.uptime}%</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </Section>

        <Section title="Fleet posture" caption="Current status mix across all active monitors." icon={Waves}>
          {posture.length === 0 ? (
            <EmptyState text="Posture appears once monitors are reporting." />
          ) : (
            <div className="grid items-center gap-5 sm:grid-cols-[1fr_1fr]">
              <motion.div
                animate={{ rotate: [0, 360] }}
                transition={{ duration: 42, repeat: Infinity, ease: 'linear' }}
                className="h-[250px]"
              >
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
              </motion.div>
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
        <Section title="Alert and change motion" caption="Real event flow over time, using alerts and active changes." icon={BellRing}>
          {eventSeries.length === 0 ? (
            <EmptyState text="Event trend appears once alerts or change-watch events exist." />
          ) : (
            <div className="h-[280px]">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={eventSeries}>
                  <defs>
                    <linearGradient id="alertsFill" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#f43f5e" stopOpacity={0.28} />
                      <stop offset="100%" stopColor="#f43f5e" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="changesFill" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#10b981" stopOpacity={0.24} />
                      <stop offset="100%" stopColor="#10b981" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid stroke="rgba(255,255,255,0.05)" vertical={false} />
                  <XAxis dataKey="label" tick={{ fill: '#64748b', fontSize: 10 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fill: '#64748b', fontSize: 10 }} axisLine={false} tickLine={false} width={34} />
                  <RechartsTooltip contentStyle={tooltipStyle} />
                  <Area type="monotone" dataKey="alerts" stroke="#f43f5e" fill="url(#alertsFill)" strokeWidth={2.5} />
                  <Area type="monotone" dataKey="changes" stroke="#10b981" fill="url(#changesFill)" strokeWidth={2.5} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          )}
        </Section>

        <Section title="Attention deck" caption="Monitors that currently need human eyes." icon={TriangleAlert}>
          {attentionMonitors.length === 0 ? (
            <EmptyState text="No monitors are demanding attention right now." />
          ) : (
            <div className="space-y-3">
              {attentionMonitors.map((monitor) => (
                <Link key={monitor.id} to={`/monitors/${monitor.id}`} className="block rounded-[24px] border border-white/8 bg-white/[0.03] p-4 transition hover:border-white/14 hover:bg-white/[0.05]">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-sm font-semibold text-white">{monitor.name}</p>
                    <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-[11px] font-semibold text-slate-200">{monitor.status}</span>
                  </div>
                  <p className="mt-2 text-sm text-slate-400">{monitor.summary}</p>
                  <p className="mt-3 text-xs text-slate-500">{formatRelativeTime(monitor.checkedAt)}</p>
                </Link>
              ))}
            </div>
          )}
        </Section>

        <Section title="Deploy watch" caption="Changes still inside active observation windows." icon={GitCompare}>
          {activeChanges.length === 0 ? (
            <EmptyState text="No active watch windows at the moment." />
          ) : (
            <div className="space-y-3">
              {activeChanges.map((change) => (
                <motion.div key={change.id} whileHover={{ scale: 1.01 }} className="rounded-[24px] border border-white/8 bg-white/[0.03] p-4">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="text-sm font-semibold text-white">{change.title}</p>
                      <p className="mt-2 text-xs uppercase tracking-[0.18em] text-slate-500">{change.type} / {change.source}</p>
                    </div>
                    <div className="rounded-full border border-emerald-400/15 bg-emerald-500/10 px-3 py-1 text-xs font-semibold text-emerald-200">{change.watchMinutesRemaining ?? 0}m</div>
                  </div>
                  <p className="mt-3 text-sm text-slate-400">{change.serviceName || 'Service not mapped'}</p>
                </motion.div>
              ))}
            </div>
          )}
        </Section>
      </div>

      <div className="grid gap-5 xl:grid-cols-[1.05fr_0.95fr]">
        <Section title="Impact matrix" caption="Ownership, region, SLA, and monitor quality context." icon={Layers3}>
          <div className="grid gap-4 lg:grid-cols-2">
            <div className="space-y-4">
              <div>
                <div className="mb-3 flex items-center gap-2">
                  <Users className="h-4 w-4 text-cyan-200" />
                  <p className="text-xs font-bold uppercase tracking-[0.2em] text-slate-500">Owner pressure</p>
                </div>
                <RankedStrip items={ownerPressure} color="#22d3ee" />
              </div>
              <div>
                <div className="mb-3 flex items-center gap-2">
                  <Globe2 className="h-4 w-4 text-emerald-200" />
                  <p className="text-xs font-bold uppercase tracking-[0.2em] text-slate-500">Region pressure</p>
                </div>
                <RankedStrip items={regionPressure} color="#10b981" />
              </div>
            </div>
            <div className="space-y-4">
              <div>
                <div className="mb-3 flex items-center gap-2">
                  <ShieldAlert className="h-4 w-4 text-amber-200" />
                  <p className="text-xs font-bold uppercase tracking-[0.2em] text-slate-500">SLA pressure</p>
                </div>
                <RankedStrip items={slaPressure} color="#f59e0b" />
              </div>
              <div>
                <div className="mb-3 flex items-center gap-2">
                  <Target className="h-4 w-4 text-rose-200" />
                  <p className="text-xs font-bold uppercase tracking-[0.2em] text-slate-500">Missing mapping</p>
                </div>
                <RankedStrip items={missingMapping} color="#f43f5e" />
              </div>
            </div>
          </div>
        </Section>

        <Section title="Composition and quality" caption="Protocol mix, diagnosis spread, and quality leaders." icon={Orbit}>
          <div className="grid gap-4 lg:grid-cols-[0.9fr_1.1fr]">
            <div className="space-y-4">
              <motion.div
                animate={{ rotate: [0, 360] }}
                transition={{ duration: 50, repeat: Infinity, ease: 'linear' }}
                className="h-[220px]"
              >
                {typeMix.length === 0 ? (
                  <EmptyState text="Type mix appears once monitors exist." />
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={typeMix} dataKey="total" nameKey="type" innerRadius={50} outerRadius={78} paddingAngle={4}>
                        {typeMix.map((entry, index) => (
                          <Cell key={entry.type} fill={protocolColors[index % protocolColors.length]} />
                        ))}
                      </Pie>
                      <RechartsTooltip contentStyle={tooltipStyle} />
                    </PieChart>
                  </ResponsiveContainer>
                )}
              </motion.div>

              <div>
                <div className="mb-3 flex items-center gap-2">
                  <Zap className="h-4 w-4 text-violet-200" />
                  <p className="text-xs font-bold uppercase tracking-[0.2em] text-slate-500">Diagnosis mix</p>
                </div>
                <RankedStrip items={diagnosisMix} color="#8b5cf6" />
              </div>
            </div>

            <div className="space-y-4">
              <div>
                <div className="mb-3 flex items-center gap-2">
                  <Trophy className="h-4 w-4 text-emerald-200" />
                  <p className="text-xs font-bold uppercase tracking-[0.2em] text-slate-500">Fast lane</p>
                </div>
                <RankedStrip items={fastLane} color="#10b981" suffix="ms" />
              </div>

              <div>
                <div className="mb-3 flex items-center gap-2">
                  <Activity className="h-4 w-4 text-amber-200" />
                  <p className="text-xs font-bold uppercase tracking-[0.2em] text-slate-500">Weak uptime</p>
                </div>
                <RankedStrip items={weakestUptime} color="#f59e0b" suffix="%" />
              </div>
            </div>
          </div>
        </Section>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard label="Affected features" value={insights.affectedFeatures} helper="Features under active stress" tone="text-cyan-200" />
        <MetricCard label="Affected journeys" value={insights.affectedJourneys} helper="Journeys currently touched" tone="text-amber-200" />
        <MetricCard label="Watch time" value={`${insights.activeWatchMinutes}m`} helper="Deploy-watch still in play" tone="text-emerald-200" />
        <MetricCard label="Fastest monitor" value={formatResponseTime(insights.fastestMonitor?.avgResponseTimeMs)} helper={insights.fastestMonitor?.name || 'No sample yet'} tone="text-slate-100" />
      </div>

      <Section title="Impact incidents" caption="High-impact incident queue with severity, ownership hints, and recent motion." icon={Sparkles}>
        {impactIncidents.length === 0 ? (
          <EmptyState text="No open impact incidents right now." />
        ) : (
          <div className="grid gap-4 xl:grid-cols-2">
            {impactIncidents.map((incident) => (
              <motion.div key={incident.id} whileHover={{ scale: 1.01 }} className="rounded-[24px] border border-white/8 bg-white/[0.03] p-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-white">{incident.monitor.name}</p>
                    <p className="mt-1 text-xs uppercase tracking-[0.18em] text-slate-500">{incident.severity}</p>
                  </div>
                  <div className="rounded-full border border-amber-400/15 bg-amber-500/10 px-3 py-1 text-xs font-semibold text-amber-200">
                    Impact {incident.impactScore}
                  </div>
                </div>
                <p className="mt-3 text-sm text-slate-400">{incident.message}</p>
                <div className="mt-3 flex flex-wrap gap-2 text-xs text-slate-500">
                  <span className="rounded-full border border-white/10 px-3 py-1">{formatRelativeTime(incident.createdAt)}</span>
                  {incident.impactSummary.featureName ? <span className="rounded-full border border-white/10 px-3 py-1">{incident.impactSummary.featureName}</span> : null}
                  {incident.impactSummary.teamOwner ? <span className="rounded-full border border-white/10 px-3 py-1">{incident.impactSummary.teamOwner}</span> : null}
                  {incident.impactSummary.customerJourney ? <span className="rounded-full border border-white/10 px-3 py-1">{incident.impactSummary.customerJourney}</span> : null}
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </Section>
    </motion.div>
  );
}
