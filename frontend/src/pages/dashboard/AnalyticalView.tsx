import { useState, useMemo, useCallback, memo } from 'react';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ResponsiveContainer, ComposedChart, Area, Line, BarChart, Bar,
  XAxis, YAxis, Tooltip as RTooltip, CartesianGrid, PieChart, Pie, Cell,
  ReferenceLine,
} from 'recharts';
import {
  ArrowUpRight, ArrowDown, ArrowUp, BarChart3, CheckCircle, Clock3,
  Globe, TrendingUp, Zap, Layers, GitCompare, Activity,
} from 'lucide-react';
import type { DashboardInsights, Monitor, Alert, ActiveWatchChange } from './types';
import { formatResponseTime, formatPercentage, formatRelativeTime } from './types';
import {
  generateTimeSeries, generateComparisonSeries, generateSparklines,
  generateHeatmap, generateTimeline, generateDistribution,
  type TimeSeriesPoint, type SparklineData, type HeatmapCell, type TimelineEvent, type DistributionBucket,
} from './mockTimeSeries';

/* ═══════════ DESIGN TOKENS ═══════════ */
const stagger = { hidden: {}, visible: { transition: { staggerChildren: 0.04 } } };
const fadeUp = {
  hidden: { opacity: 0, y: 14 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.4, ease: [0.25, 0.46, 0.45, 0.94] as const } },
};
const tooltipStyle: React.CSSProperties = {
  backgroundColor: 'rgba(8,12,20,0.96)', border: '1px solid rgba(255,255,255,0.08)',
  borderRadius: '14px', boxShadow: '0 12px 40px rgba(0,0,0,0.5)', color: '#e2e8f0', fontSize: '11px', padding: '10px 14px',
};
const statusDot: Record<Monitor['status'], string> = {
  UP: 'bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.6)]',
  DOWN: 'bg-rose-400 shadow-[0_0_8px_rgba(251,113,133,0.6)]',
  DEGRADED: 'bg-amber-400 shadow-[0_0_8px_rgba(251,191,36,0.6)]',
  PAUSED: 'bg-slate-500',
};

/* ═══════════ SHARED PRIMITIVES ═══════════ */
function SectionHeader({ title, icon: Icon, count, action, badge }: {
  title: string; icon: React.ElementType; count?: number; action?: React.ReactNode; badge?: string;
}) {
  return (
    <div className="flex items-center justify-between mb-4">
      <div className="flex items-center gap-2">
        <Icon className="h-4 w-4 text-emerald-400" />
        <h3 className="text-[11px] font-bold uppercase tracking-[0.2em] text-slate-500">{title}</h3>
        {typeof count === 'number' && <span className="rounded-full bg-white/[0.06] px-2 py-0.5 text-[10px] font-bold text-slate-400">{count}</span>}
        {badge && <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-[9px] font-bold text-emerald-400 uppercase">{badge}</span>}
      </div>
      {action}
    </div>
  );
}
function GP({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <motion.div variants={fadeUp} className={`rounded-2xl border border-white/[0.06] bg-white/[0.015] backdrop-blur-sm ${className}`}>{children}</motion.div>;
}

/* ════════════════════════════════════════════════════════
   1. 🧬 MULTI-LAYER MAIN GRAPH
   ════════════════════════════════════════════════════════ */

interface MainGraphProps { series: TimeSeriesPoint[]; comparison?: TimeSeriesPoint[]; showComparison: boolean; }

const MultiLayerGraph = memo(function MultiLayerGraph({ series, comparison, showComparison }: MainGraphProps) {
  const data = useMemo(() => {
    return series.map((p, i) => ({
      ...p,
      prevLatency: showComparison && comparison?.[i] ? comparison[i].latency : undefined,
    }));
  }, [series, comparison, showComparison]);

  const spikeLine = useMemo(() => {
    const avg = series.reduce((s, p) => s + p.latency, 0) / (series.length || 1);
    return Math.round(avg * 2.5);
  }, [series]);

  return (
    <GP className="p-5">
      <SectionHeader title="System Performance" icon={BarChart3} badge="Multi-layer" />
      <div className="h-[320px]">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id="volumeGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#818cf8" stopOpacity={0.15} />
                <stop offset="100%" stopColor="#818cf8" stopOpacity={0} />
              </linearGradient>
              <linearGradient id="latencyGlow" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#2dd4bf" stopOpacity={0.25} />
                <stop offset="100%" stopColor="#2dd4bf" stopOpacity={0} />
              </linearGradient>
              <filter id="glow"><feGaussianBlur stdDeviation="2" result="blur" /><feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge></filter>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.03)" vertical={false} />
            <XAxis dataKey="time" tick={{ fill: '#475569', fontSize: 9 }} axisLine={false} tickLine={false} interval={Math.floor(data.length / 8)} />
            <YAxis yAxisId="latency" tick={{ fill: '#475569', fontSize: 9 }} axisLine={false} tickLine={false} tickFormatter={(v) => `${v}ms`} width={48} />
            <YAxis yAxisId="volume" orientation="right" tick={{ fill: '#475569', fontSize: 9 }} axisLine={false} tickLine={false} tickFormatter={(v) => `${v}`} width={40} hide />
            <YAxis yAxisId="error" orientation="right" hide />
            <RTooltip
              contentStyle={tooltipStyle}
              content={({ active, payload, label }) => {
                if (!active || !payload?.length) return null;
                const p = payload[0]?.payload as TimeSeriesPoint & { prevLatency?: number };
                return (
                  <div className="space-y-1.5">
                    <p className="text-[10px] text-slate-500 font-mono">{label}</p>
                    <div className="flex items-center gap-2"><span className="h-1.5 w-1.5 rounded-full bg-teal-400" /><span className="text-slate-300">Latency</span><span className="ml-auto font-bold text-white">{p?.latency}ms</span></div>
                    <div className="flex items-center gap-2"><span className="h-1.5 w-1.5 rounded-full bg-rose-400" /><span className="text-slate-300">Error Rate</span><span className="ml-auto font-bold text-white">{p?.errorRate}%</span></div>
                    <div className="flex items-center gap-2"><span className="h-1.5 w-1.5 rounded-full bg-violet-400" /><span className="text-slate-300">Requests</span><span className="ml-auto font-bold text-white">{p?.requestVolume?.toLocaleString()}</span></div>
                    {p?.prevLatency !== undefined && <div className="flex items-center gap-2 border-t border-white/5 pt-1.5"><span className="h-1.5 w-1.5 rounded-full bg-slate-500" /><span className="text-slate-500">Prev Period</span><span className="ml-auto font-bold text-slate-400">{p.prevLatency}ms</span></div>}
                    {p?.isSpike && <div className="rounded-md bg-amber-500/15 px-2 py-1 text-[9px] font-bold text-amber-400 text-center mt-1">⚡ SPIKE DETECTED</div>}
                  </div>
                );
              }}
            />
            <ReferenceLine yAxisId="latency" y={spikeLine} stroke="rgba(239,68,68,0.2)" strokeDasharray="6 4" label={{ value: `Spike threshold: ${spikeLine}ms`, position: 'insideTopRight', fill: '#64748b', fontSize: 9 }} />
            {/* Volume area (background) */}
            <Area yAxisId="volume" type="monotone" dataKey="requestVolume" fill="url(#volumeGrad)" stroke="none" />
            {/* Comparison line */}
            {showComparison && <Line yAxisId="latency" type="monotone" dataKey="prevLatency" stroke="#475569" strokeWidth={1.5} strokeDasharray="6 4" dot={false} />}
            {/* Main latency line */}
            <Area yAxisId="latency" type="monotone" dataKey="latency" stroke="#2dd4bf" strokeWidth={2} fill="url(#latencyGlow)" dot={false} filter="url(#glow)" />
            {/* Error rate line */}
            <Line yAxisId="error" type="monotone" dataKey="errorRate" stroke="#f87171" strokeWidth={1.5} strokeDasharray="4 3" dot={false} />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
      <div className="mt-3 flex items-center gap-4 text-[9px] font-bold uppercase tracking-wider text-slate-600">
        <span className="flex items-center gap-1.5"><span className="h-0.5 w-4 rounded bg-teal-400" /> Latency</span>
        <span className="flex items-center gap-1.5"><span className="h-0.5 w-4 rounded bg-rose-400 opacity-70" style={{ backgroundImage: 'repeating-linear-gradient(90deg, transparent, transparent 3px, rgba(8,12,20,0.8) 3px, rgba(8,12,20,0.8) 6px)' }} /> Error Rate</span>
        <span className="flex items-center gap-1.5"><span className="h-2 w-4 rounded bg-violet-400/20" /> Req. Volume</span>
        {showComparison && <span className="flex items-center gap-1.5"><span className="h-0.5 w-4 rounded bg-slate-500" style={{ backgroundImage: 'repeating-linear-gradient(90deg, transparent, transparent 4px, rgba(8,12,20,0.8) 4px, rgba(8,12,20,0.8) 8px)' }} /> Previous</span>}
      </div>
    </GP>
  );
});

/* ════════════════════════════════════════════════════════
   2. 📊 MINI SPARKLINE GRID
   ════════════════════════════════════════════════════════ */

function SparklineCard({ item }: { item: SparklineData }) {
  const points = item.data;
  const min = Math.min(...points);
  const max = Math.max(...points);
  const range = max - min || 1;
  const w = 120, h = 32;
  const path = points.map((v, i) => `${i === 0 ? 'M' : 'L'}${(i / (points.length - 1)) * w},${h - ((v - min) / range) * h}`).join(' ');

  return (
    <GP className="p-4 group hover:border-white/[0.1] transition-colors">
      <div className="flex items-start justify-between mb-2">
        <p className="text-[9px] font-bold uppercase tracking-[0.15em] text-slate-600">{item.label}</p>
        <span className={`flex items-center gap-0.5 text-[10px] font-bold ${item.change > 0 ? (item.key === 'errorRate' ? 'text-rose-400' : 'text-emerald-400') : item.change < 0 ? (item.key === 'errorRate' ? 'text-emerald-400' : 'text-amber-400') : 'text-slate-500'}`}>
          {item.change > 0 ? <ArrowUp className="h-2.5 w-2.5" /> : item.change < 0 ? <ArrowDown className="h-2.5 w-2.5" /> : null}
          {Math.abs(item.change)}%
        </span>
      </div>
      <p className="text-lg font-extrabold text-white mb-2">{item.value}</p>
      <svg viewBox={`0 0 ${w} ${h}`} className="w-full h-8 overflow-visible">
        <path d={path} fill="none" stroke={item.color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" opacity={0.8} />
        <path d={`${path} L${w},${h} L0,${h} Z`} fill={item.color} opacity={0.06} />
      </svg>
    </GP>
  );
}

const SparklineGrid = memo(function SparklineGrid({ sparklines }: { sparklines: SparklineData[] }) {
  return (
    <motion.div variants={stagger} className="grid grid-cols-2 gap-3 lg:grid-cols-3 xl:grid-cols-6">
      {sparklines.map((s) => <SparklineCard key={s.key} item={s} />)}
    </motion.div>
  );
});

/* ════════════════════════════════════════════════════════
   3. 🌡️ SERVICE HEATMAP
   ════════════════════════════════════════════════════════ */

const Heatmap = memo(function Heatmap({ cells, services }: { cells: HeatmapCell[]; services: string[] }) {
  const [hovered, setHovered] = useState<HeatmapCell | null>(null);

  const cellColor = useCallback((health: number) => {
    if (health >= 0.9) return 'bg-emerald-500/60';
    if (health >= 0.7) return 'bg-emerald-500/30';
    if (health >= 0.5) return 'bg-amber-500/40';
    if (health >= 0.3) return 'bg-amber-500/60';
    return 'bg-rose-500/60';
  }, []);

  return (
    <GP className="p-5 overflow-hidden">
      <SectionHeader title="Service Health Map" icon={Layers} badge="24h" />
      <div className="overflow-x-auto relative">
        <div className="min-w-[700px]">
          {/* Hour labels */}
          <div className="flex ml-[140px] mb-1">
            {Array.from({ length: 24 }, (_, h) => (
              <div key={h} className="flex-1 text-center text-[8px] text-slate-600 font-mono">{h % 3 === 0 ? `${String(h).padStart(2, '0')}` : ''}</div>
            ))}
          </div>
          {/* Rows */}
          {services.map((svc) => (
            <div key={svc} className="flex items-center mb-0.5">
              <div className="w-[140px] pr-3 text-right text-[10px] font-semibold text-slate-400 truncate flex-shrink-0">{svc}</div>
              <div className="flex flex-1 gap-[1px]">
                {cells.filter(c => c.service === svc).map((cell) => (
                  <div
                    key={`${cell.service}-${cell.hour}`}
                    className={`flex-1 h-5 rounded-[3px] ${cellColor(cell.health)} transition-all cursor-pointer hover:ring-1 hover:ring-white/20 hover:scale-y-125`}
                    onMouseEnter={() => setHovered(cell)}
                    onMouseLeave={() => setHovered(null)}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
        {/* Tooltip */}
        <AnimatePresence>
          {hovered && (
            <motion.div
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="absolute top-0 right-4 rounded-xl border border-white/[0.08] bg-[#0c121e]/95 backdrop-blur-md p-3 shadow-xl pointer-events-none z-10"
            >
              <p className="text-[10px] font-bold text-white">{hovered.service}</p>
              <p className="text-[9px] text-slate-500 mb-1.5 font-mono">{hovered.hourLabel}</p>
              <div className="space-y-1 text-[10px]">
                <div className="flex justify-between gap-6"><span className="text-slate-400">Health</span><span className={`font-bold ${hovered.health >= 0.7 ? 'text-emerald-400' : hovered.health >= 0.4 ? 'text-amber-400' : 'text-rose-400'}`}>{Math.round(hovered.health * 100)}%</span></div>
                <div className="flex justify-between gap-6"><span className="text-slate-400">Latency</span><span className="font-bold text-white">{hovered.latency}ms</span></div>
                <div className="flex justify-between gap-6"><span className="text-slate-400">Errors</span><span className="font-bold text-white">{hovered.errors}</span></div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
      {/* Legend */}
      <div className="flex items-center gap-3 mt-3 text-[8px] font-bold uppercase tracking-wider text-slate-600">
        <span className="flex items-center gap-1"><span className="h-2.5 w-5 rounded-sm bg-emerald-500/60" /> Healthy</span>
        <span className="flex items-center gap-1"><span className="h-2.5 w-5 rounded-sm bg-amber-500/40" /> Degraded</span>
        <span className="flex items-center gap-1"><span className="h-2.5 w-5 rounded-sm bg-rose-500/60" /> Failing</span>
      </div>
    </GP>
  );
});

/* ════════════════════════════════════════════════════════
   4. 🔴 INCIDENT TIMELINE
   ════════════════════════════════════════════════════════ */

const typeIcon: Record<TimelineEvent['type'], string> = { incident: '🔴', spike: '⚡', deploy: '🚀', recovery: '✅' };
const sevColor: Record<TimelineEvent['severity'], string> = { critical: 'border-rose-500/40 bg-rose-500/10', high: 'border-amber-500/40 bg-amber-500/10', medium: 'border-sky-500/40 bg-sky-500/10', low: 'border-slate-500/40 bg-slate-500/10' };

const IncidentTimeline = memo(function IncidentTimeline({ events }: { events: TimelineEvent[] }) {
  return (
    <GP className="p-5 overflow-hidden">
      <SectionHeader title="Incident Timeline" icon={Clock3} count={events.length} badge="24h" />
      <div className="relative">
        {/* Line */}
        <div className="absolute left-3 top-0 bottom-0 w-px bg-white/[0.06]" />
        <div className="space-y-3 pl-8">
          {events.map((ev, i) => (
            <motion.div key={ev.id} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.05 }}
              className={`rounded-xl border p-3 transition-colors hover:bg-white/[0.02] ${sevColor[ev.severity]}`}
            >
              {/* Dot on timeline */}
              <div className="absolute -left-[1px] mt-1" style={{ marginLeft: '-4px' }}>
                <div className={`h-2.5 w-2.5 rounded-full border-2 border-[#080c14] ${ev.type === 'incident' ? 'bg-rose-400' : ev.type === 'spike' ? 'bg-amber-400' : ev.type === 'deploy' ? 'bg-sky-400' : 'bg-emerald-400'}`} />
              </div>
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-xs">{typeIcon[ev.type]}</span>
                    <span className="text-xs font-bold text-white">{ev.title}</span>
                  </div>
                  <p className="text-[10px] text-slate-500 mt-0.5">{ev.description}</p>
                </div>
                <div className="flex flex-col items-end gap-1 flex-shrink-0">
                  <span className="text-[9px] font-mono text-slate-600">{ev.timeLabel}</span>
                  {ev.duration && <span className="text-[9px] text-slate-600">{ev.duration}m</span>}
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </GP>
  );
});

/* ════════════════════════════════════════════════════════
   5. 📈 RESPONSE DISTRIBUTION
   ════════════════════════════════════════════════════════ */

const qualityColor: Record<DistributionBucket['quality'], string> = {
  excellent: '#10b981', good: '#2dd4bf', acceptable: '#f59e0b', poor: '#f97316', critical: '#ef4444',
};

const DistributionChart = memo(function DistributionChart({ buckets }: { buckets: DistributionBucket[] }) {
  return (
    <GP className="p-5">
      <SectionHeader title="Response Distribution" icon={TrendingUp} badge="Quality" />
      <div className="h-44">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={buckets} barCategoryGap="15%">
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.03)" vertical={false} />
            <XAxis dataKey="range" tick={{ fill: '#64748b', fontSize: 8 }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fill: '#64748b', fontSize: 9 }} axisLine={false} tickLine={false} width={30} />
            <RTooltip contentStyle={tooltipStyle} formatter={(v, _n, entry) => [`${v} requests (${(entry?.payload as DistributionBucket)?.percentage}%)`, '']} />
            <Bar dataKey="count" radius={[6, 6, 0, 0]}>
              {buckets.map((b, i) => <Cell key={i} fill={qualityColor[b.quality]} />)}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
      {/* Quality strip */}
      <div className="flex gap-1 mt-2">
        {buckets.map((b) => (
          <div key={b.range} className="flex-1 rounded-md py-1 text-center text-[8px] font-bold uppercase" style={{ backgroundColor: `${qualityColor[b.quality]}15`, color: qualityColor[b.quality] }}>
            {b.percentage}%
          </div>
        ))}
      </div>
    </GP>
  );
});

/* ════════════════════════════════════════════════════════
   6. 🧾 ENHANCED LIVE LOG STREAM
   ════════════════════════════════════════════════════════ */

const LiveLogStream = memo(function LiveLogStream({ alerts }: { alerts: Alert[] }) {
  const statusCode = (status: Alert['status']) => status === 'RESOLVED' ? '200' : status === 'TRIGGERED' ? '500' : '429';
  const statusColor = (status: Alert['status']) => status === 'RESOLVED' ? 'bg-emerald-500/15 text-emerald-400' : status === 'TRIGGERED' ? 'bg-rose-500/15 text-rose-400' : 'bg-sky-500/15 text-sky-400';

  return (
    <GP className="p-5 max-h-[400px] overflow-hidden flex flex-col">
      <SectionHeader title="Live Activity" icon={Zap} count={alerts.length} badge="Stream" />
      <div className="flex-1 overflow-y-auto space-y-1 custom-scrollbar">
        {alerts.length === 0 ? (
          <p className="text-sm text-emerald-400/70 flex items-center gap-2 py-4"><CheckCircle className="h-4 w-4" /> No recent activity</p>
        ) : (
          alerts.map((alert, i) => (
            <motion.div key={alert.id} initial={{ opacity: 0, x: -6 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.03 }}
              className="flex items-center gap-3 rounded-lg px-3 py-2.5 hover:bg-white/[0.03] transition group"
            >
              <div className={`h-1.5 w-1.5 rounded-full flex-shrink-0 ${alert.status === 'RESOLVED' ? 'bg-emerald-400' : alert.status === 'ACKNOWLEDGED' ? 'bg-sky-400' : 'bg-amber-400 animate-pulse'}`} />
              <span className="font-mono text-[10px] text-slate-600 flex-shrink-0 w-12">{formatRelativeTime(alert.createdAt)}</span>
              <span className="text-[11px] text-slate-300 truncate flex-1 group-hover:text-white transition">{alert.monitor?.name}</span>
              <span className="text-[10px] text-slate-600 truncate max-w-[200px] hidden lg:block">{alert.message}</span>
              <span className={`text-[9px] font-bold font-mono px-2 py-0.5 rounded-md ${statusColor(alert.status)}`}>{statusCode(alert.status)}</span>
            </motion.div>
          ))
        )}
      </div>
    </GP>
  );
});

/* ════════════════════════════════════════════════════════
   7. 🧠 ENHANCED HEALTH SCORE
   ════════════════════════════════════════════════════════ */

function HealthGauge({ score, insights }: { score: number; insights: DashboardInsights }) {
  const circumference = 2 * Math.PI * 52;
  const offset = circumference - (score / 100) * circumference;
  const color = score >= 90 ? '#10b981' : score >= 70 ? '#f59e0b' : '#ef4444';
  const [expanded, setExpanded] = useState(false);

  return (
    <GP className="p-5">
      <div className="flex items-center gap-5 cursor-pointer" onClick={() => setExpanded(!expanded)}>
        <div className="relative h-24 w-24 flex-shrink-0">
          <svg viewBox="0 0 120 120" className="h-full w-full -rotate-90">
            <circle cx="60" cy="60" r="52" fill="none" stroke="rgba(255,255,255,0.04)" strokeWidth="5" />
            <motion.circle cx="60" cy="60" r="52" fill="none" stroke={color} strokeWidth="5" strokeLinecap="round" strokeDasharray={circumference}
              initial={{ strokeDashoffset: circumference }} animate={{ strokeDashoffset: offset }} transition={{ duration: 1.5, ease: 'easeOut', delay: 0.2 }}
              style={{ filter: `drop-shadow(0 0 10px ${color}50)` }} />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <motion.span className="text-2xl font-black text-white" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.6 }}>{score}</motion.span>
            <span className="text-[7px] font-bold uppercase tracking-[0.2em] text-slate-500 mt-0.5">/100</span>
          </div>
        </div>
        <div className="flex-1">
          <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-slate-500">System Health</p>
          <p className="mt-1 text-sm text-slate-400">{score >= 90 ? 'All systems nominal.' : score >= 70 ? 'Minor degradation.' : 'Critical issues.'}</p>
          <p className="text-[9px] text-slate-600 mt-1">Click to expand breakdown ↓</p>
        </div>
      </div>
      <AnimatePresence>
        {expanded && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
            <div className="grid grid-cols-3 gap-2 mt-4 pt-4 border-t border-white/[0.04]">
              <div className="rounded-lg bg-white/[0.02] p-2.5 text-center">
                <p className="text-[8px] font-bold uppercase text-slate-600">Uptime</p>
                <p className="text-sm font-extrabold text-emerald-400 mt-0.5">{formatPercentage(insights.fleetAvailability)}</p>
              </div>
              <div className="rounded-lg bg-white/[0.02] p-2.5 text-center">
                <p className="text-[8px] font-bold uppercase text-slate-600">Latency</p>
                <p className="text-sm font-extrabold text-teal-400 mt-0.5">{formatResponseTime(insights.avgResponseTimeMs)}</p>
              </div>
              <div className="rounded-lg bg-white/[0.02] p-2.5 text-center">
                <p className="text-[8px] font-bold uppercase text-slate-600">Errors</p>
                <p className="text-sm font-extrabold text-rose-400 mt-0.5">{insights.down + insights.degraded}</p>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </GP>
  );
}

/* ════════════════════════════════════════════════════════
   8. STATUS DONUT (kept from before)
   ════════════════════════════════════════════════════════ */

function StatusBreakdown({ insights }: { insights: DashboardInsights }) {
  const data = insights.statusDistribution.filter((s) => s.total > 0);
  const colors: Record<string, string> = { Up: '#10b981', Down: '#ef4444', Degraded: '#f59e0b', Paused: '#64748b' };
  return (
    <GP className="p-5">
      <SectionHeader title="Status Overview" icon={CheckCircle} />
      <div className="h-40 relative">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart><RTooltip contentStyle={tooltipStyle} />
            <Pie data={data} cx="50%" cy="50%" innerRadius={48} outerRadius={64} paddingAngle={3} dataKey="total" nameKey="label">
              {data.map((entry) => <Cell key={entry.label} fill={colors[entry.label] || '#64748b'} />)}
            </Pie>
          </PieChart>
        </ResponsiveContainer>
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
          <span className="text-xl font-black text-white">{insights.total}</span>
          <span className="text-[7px] font-bold uppercase tracking-[0.2em] text-slate-500">monitors</span>
        </div>
      </div>
    </GP>
  );
}

/* ════════════════════════════════════════════════════════
   9. MONITOR TABLE
   ════════════════════════════════════════════════════════ */

function MonitorTable({ monitors }: { monitors: Monitor[] }) {
  return (
    <GP className="overflow-hidden">
      <div className="p-5 border-b border-white/[0.04]">
        <SectionHeader title="Monitor Fleet" icon={Globe} count={monitors.length}
          action={<Link to="/monitors" className="flex items-center gap-1 text-[10px] font-semibold text-emerald-400 hover:text-emerald-300 transition"><span>View all</span><ArrowUpRight className="h-3 w-3" /></Link>} />
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead><tr className="border-b border-white/[0.04]">
            {['Monitor', 'Status', 'Response', 'Uptime', 'Last Check'].map((h) => <th key={h} className="px-5 py-2.5 text-left text-[9px] font-bold uppercase tracking-wider text-slate-600">{h}</th>)}
          </tr></thead>
          <tbody>
            {monitors.slice(0, 10).map((m) => (
              <tr key={m.id} className="border-b border-white/[0.02] hover:bg-white/[0.015] transition">
                <td className="px-5 py-2.5"><Link to={`/monitors/${m.id}`} className="group"><p className="text-xs font-semibold text-white group-hover:text-emerald-400 transition truncate max-w-[180px]">{m.name}</p><p className="text-[9px] text-slate-600 font-mono truncate max-w-[180px]">{m.url}</p></Link></td>
                <td className="px-5 py-2.5"><div className="flex items-center gap-2"><div className={`h-2 w-2 rounded-full ${statusDot[m.status]}`} /><span className="text-[10px] font-bold text-slate-400">{m.status}</span></div></td>
                <td className="px-5 py-2.5 text-[10px] font-bold text-slate-300">{formatResponseTime(m.avgResponseTimeMs)}</td>
                <td className="px-5 py-2.5 text-[10px] font-bold text-slate-300">{formatPercentage(m.uptimePercentage)}</td>
                <td className="px-5 py-2.5 text-[10px] text-slate-500">{formatRelativeTime(m.lastCheckedAt)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </GP>
  );
}

/* ═══════════════════════════════════════════════════════
   DEPLOY WATCH
   ═══════════════════════════════════════════════════════ */
function DeployWatch({ changes }: { changes: ActiveWatchChange[] }) {
  return (
    <GP className="p-5">
      <SectionHeader title="Deploy Watch" icon={Activity} count={changes.length} />
      {changes.length === 0 ? <p className="text-sm text-slate-500 py-3">No active watch windows.</p> : (
        <div className="space-y-2">
          {changes.slice(0, 4).map((c) => (
            <div key={c.id} className="flex items-center justify-between gap-3 rounded-xl border border-white/[0.04] bg-white/[0.02] p-3">
              <div className="min-w-0"><p className="text-[11px] font-semibold text-white truncate">{c.title}</p><p className="text-[9px] text-slate-500 mt-0.5">{c.type} • {c.source}</p></div>
              <div className="flex-shrink-0 rounded-lg border border-emerald-500/20 bg-emerald-500/10 px-2.5 py-1"><span className="text-[10px] font-bold text-emerald-400">{c.watchMinutesRemaining ?? 0}m</span></div>
            </div>
          ))}
        </div>
      )}
    </GP>
  );
}

/* ═══════════════════════════════════════════════════════════
   MAIN EXPORT
   ═══════════════════════════════════════════════════════════ */

export default function AnalyticalView({
  insights, monitors, alerts, activeWatchChanges,
}: {
  insights: DashboardInsights; monitors: Monitor[]; alerts: Alert[];
  activeWatchChanges: ActiveWatchChange[];
}) {
  const [showComparison, setShowComparison] = useState(false);

  const series = useMemo(() => generateTimeSeries(24, 15), []);
  const comparisonSeries = useMemo(() => generateComparisonSeries(24, 15), []);
  const sparklines = useMemo(() => generateSparklines(series), [series]);
  const heatmapServices = useMemo(() => monitors.slice(0, 8).map(m => m.name), [monitors]);
  const heatmapCells = useMemo(() => generateHeatmap(heatmapServices), [heatmapServices]);
  const timeline = useMemo(() => generateTimeline(), []);
  const distribution = useMemo(() => generateDistribution(series), [series]);

  return (
    <motion.div key="analytical-v2" initial="hidden" animate="visible" exit={{ opacity: 0, scale: 0.97, transition: { duration: 0.25 } }} variants={stagger} className="space-y-4">

      {/* Row 1: Health + Metrics + Status */}
      <motion.div variants={stagger} className="grid grid-cols-1 gap-4 xl:grid-cols-[280px_1fr_220px]">
        <HealthGauge score={insights.healthScore} insights={insights} />
        <GP className="p-5">
          <div className="flex items-center justify-between mb-3">
            <SectionHeader title="Fleet Metrics" icon={BarChart3} />
            <button onClick={() => setShowComparison(!showComparison)}
              className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[9px] font-bold uppercase tracking-wider transition-colors ${showComparison ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30' : 'bg-white/[0.03] text-slate-500 border border-white/[0.06] hover:text-slate-300'}`}>
              <GitCompare className="h-3 w-3" /> Compare
            </button>
          </div>
          <div className="grid grid-cols-4 gap-2">
            {[
              { label: 'Monitors', value: insights.total, c: 'text-sky-400' },
              { label: 'Healthy', value: insights.healthy, c: 'text-emerald-400' },
              { label: 'Attention', value: insights.degraded + insights.down, c: insights.down > 0 ? 'text-rose-400' : 'text-amber-400' },
              { label: 'Avg Latency', value: formatResponseTime(insights.avgResponseTimeMs), c: 'text-teal-400' },
            ].map((s) => (
              <div key={s.label} className="rounded-xl border border-white/[0.04] bg-white/[0.02] p-3 text-center">
                <p className="text-[8px] font-bold uppercase tracking-wider text-slate-600">{s.label}</p>
                <p className={`mt-1 text-lg font-extrabold ${s.c}`}>{s.value}</p>
              </div>
            ))}
          </div>
        </GP>
        <StatusBreakdown insights={insights} />
      </motion.div>

      {/* Row 2: Sparkline grid */}
      <SparklineGrid sparklines={sparklines} />

      {/* Row 3: Main multi-layer graph + Live logs */}
      <motion.div variants={stagger} className="grid grid-cols-1 gap-4 xl:grid-cols-[2fr_1fr]">
        <MultiLayerGraph series={series} comparison={comparisonSeries} showComparison={showComparison} />
        <LiveLogStream alerts={alerts} />
      </motion.div>

      {/* Row 4: Heatmap */}
      <motion.div variants={fadeUp}>
        <Heatmap cells={heatmapCells} services={heatmapServices} />
      </motion.div>

      {/* Row 5: Distribution + Timeline + Deploy */}
      <motion.div variants={stagger} className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <DistributionChart buckets={distribution} />
        <IncidentTimeline events={timeline} />
        <DeployWatch changes={activeWatchChanges} />
      </motion.div>

      {/* Row 6: Monitor table */}
      <motion.div variants={fadeUp}>
        <MonitorTable monitors={monitors} />
      </motion.div>
    </motion.div>
  );
}
