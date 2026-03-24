import { Link } from 'react-router-dom';
import { Suspense, lazy, useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { motion, AnimatePresence, Reorder, useDragControls } from 'framer-motion';
import { BarChart, Bar, XAxis, YAxis, Tooltip as RechartsTooltip, ResponsiveContainer, PieChart, Pie, Cell, Radar, RadarChart, PolarGrid, PolarAngleAxis } from 'recharts';
import {
  Activity,
  AlertTriangle,
  BarChart3,
  BellRing,
  CheckCircle,
  Clock3,
  ExternalLink,
  Gauge,
  Globe,
  GripVertical,
  Layers3,
  LayoutDashboard,
  Map,
  Search,
  Server,
  Shield,
  ShieldAlert,
  Siren,
  SlidersHorizontal,
  TrendingUp,
  Users,
} from 'lucide-react';
import { axiosPrivate } from '../services/api';
import { fetchCurrentUser } from '../services/current-user';
import { UpgradePrompt } from '../components/UpgradePrompt';

const DashboardPerformanceChart = lazy(() => import('../components/DashboardPerformanceChart'));

interface MonitorAlertSummary {
  id: string;
  channel: string;
  status: 'TRIGGERED' | 'ACKNOWLEDGED' | 'RESOLVED';
  message: string;
  createdAt: string;
  resolvedAt?: string | null;
}

interface Monitor {
  id: string;
  name: string;
  url: string;
  status: 'UP' | 'DOWN' | 'DEGRADED' | 'PAUSED';
  type: 'HTTP' | 'TCP' | 'DNS' | 'SSL';
  lastCheckedAt?: string | null;
  avgResponseTimeMs?: number | null;
  latestResponseTimeMs?: number | null;
  uptimePercentage?: number | null;
  latestStatusCode?: number | null;
  lastErrorMessage?: string | null;
  metadata?: any;
  hasActiveAlert?: boolean;
  latestAlert?: MonitorAlertSummary | null;
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

interface Alert {
  id: string;
  monitorId: string;
  message: string;
  status: 'TRIGGERED' | 'ACKNOWLEDGED' | 'RESOLVED';
  createdAt: string;
  resolvedAt?: string | null;
  monitor: {
    name: string;
  };
}

interface Incident {
  id: string;
  status: 'INVESTIGATING' | 'IDENTIFIED' | 'RESOLVED';
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  impactScore: number;
  message: string;
  createdAt: string;
  likelyTrigger?: {
    id: string;
    title: string;
    type: string;
    source: string;
    confidence: number;
  } | null;
  impactSummary: {
    featureName?: string | null;
    customerJourney?: string | null;
    teamOwner?: string | null;
  };
  monitor: {
    id: string;
    name: string;
  };
}

interface ActiveWatchChange {
  id: string;
  title: string;
  type: string;
  source: string;
  happenedAt: string;
  watchUntil?: string | null;
  watchMinutesRemaining?: number;
  serviceName?: string | null;
  monitor?: {
    id: string;
    name: string;
  } | null;
}

type DashboardMode = 'compact' | 'analytical';
type WidgetId =
  | 'customer-impact'
  | 'performance-chart'
  | 'recent-alerts'
  | 'impact-command'
  | 'deploy-watch'
  | 'latency-board'
  | 'ownership-radar'
  | 'regional-exposure'
  | 'service-mix'
  | 'monitor-table';

const DASHBOARD_MODE_STORAGE_KEY = 'zer0friction-dashboard-mode';
const DASHBOARD_COMPACT_WIDGETS_STORAGE_KEY = 'zer0friction-dashboard-compact-widgets';

const WIDGET_CATALOG: Array<{ id: WidgetId; label: string; description: string }> = [
  { id: 'customer-impact', label: 'Customer Impact', description: 'High-risk monitors with business context.' },
  { id: 'impact-command', label: 'Impact Command', description: 'Rank open incidents by business impact.' },
  { id: 'deploy-watch', label: 'Deploy Watch', description: 'Recent deploy windows still under observation.' },
  { id: 'recent-alerts', label: 'Recent Alerts', description: 'Latest triggered and resolved alert activity.' },
  { id: 'performance-chart', label: 'Performance Chart', description: 'Response-time bars across your monitor fleet.' },
  { id: 'latency-board', label: 'Latency Board', description: 'Fastest and slowest endpoints side by side.' },
  { id: 'ownership-radar', label: 'Ownership Radar', description: 'Teams and SLA tiers carrying the most pressure.' },
  { id: 'regional-exposure', label: 'Regional Exposure', description: 'Attention monitors grouped by operating region.' },
  { id: 'service-mix', label: 'Service Mix', description: 'Status and monitor-type distribution at a glance.' },
  { id: 'monitor-table', label: 'Monitor Table', description: 'Detailed monitor-level health and latest signal.' },
];

const COMPACT_WIDGET_PRESET: WidgetId[] = ['impact-command', 'recent-alerts', 'deploy-watch', 'monitor-table'];

const fetchMonitors = async (): Promise<Monitor[]> => {
  const { data } = await axiosPrivate.get('/monitors');
  return data;
};

const fetchRecentAlerts = async (): Promise<Alert[]> => {
  const { data } = await axiosPrivate.get('/alerts?limit=8');
  return data;
};

const fetchOpenIncidents = async (): Promise<Incident[]> => {
  const { data } = await axiosPrivate.get('/incidents?limit=8');
  return data;
};

const fetchActiveWatchChanges = async (): Promise<ActiveWatchChange[]> => {
  const { data } = await axiosPrivate.get('/changes?limit=6&activeWatch=true');
  return data;
};

const formatResponseTime = (value?: number | null) => {
  if (typeof value !== 'number' || value <= 0) return 'No data';
  return `${value}ms`;
};

const formatPercentage = (value?: number | null) => {
  if (typeof value !== 'number') return 'No data';
  return `${value.toFixed(1)}%`;
};

const formatRelativeTime = (value?: string | null) => {
  if (!value) return 'Not checked yet';

  return new Date(value).toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

const readDashboardMode = (): DashboardMode => {
  if (typeof window === 'undefined') return 'compact';
  const value = window.localStorage.getItem(DASHBOARD_MODE_STORAGE_KEY);
  return value === 'analytical' ? 'analytical' : 'compact';
};

const readCompactWidgetSelection = (): WidgetId[] => {
  if (typeof window === 'undefined') return COMPACT_WIDGET_PRESET;
  const raw =
    window.localStorage.getItem(DASHBOARD_COMPACT_WIDGETS_STORAGE_KEY) ||
    window.localStorage.getItem('zer0friction-dashboard-widgets');

  if (!raw) {
    return COMPACT_WIDGET_PRESET;
  }

  try {
    const parsed = JSON.parse(raw) as string[];
    const allowed = new Set(WIDGET_CATALOG.map((widget) => widget.id));
    return parsed.filter((id): id is WidgetId => allowed.has(id as WidgetId));
  } catch {
    return COMPACT_WIDGET_PRESET;
  }
};

const alertTone = (status: Alert['status']) => {
  if (status === 'RESOLVED') return 'bg-emerald-100 text-emerald-800 border-emerald-200';
  if (status === 'ACKNOWLEDGED') return 'bg-blue-100 text-blue-800 border-blue-200';
  return 'bg-amber-100 text-amber-800 border-amber-200';
};

const monitorTone = (status: Monitor['status']) => {
  if (status === 'UP') return 'bg-green-50 text-green-700 border-green-200';
  if (status === 'DOWN') return 'bg-red-50 text-red-700 border-red-200';
  if (status === 'DEGRADED') return 'bg-amber-50 text-amber-700 border-amber-200';
  return 'bg-slate-100 text-slate-700 border-slate-200';
};

const incidentSeverityTone = (severity: Incident['severity']) => {
  if (severity === 'CRITICAL') return 'border-rose-200 bg-rose-50 text-rose-700';
  if (severity === 'HIGH') return 'border-amber-200 bg-amber-50 text-amber-700';
  if (severity === 'MEDIUM') return 'border-sky-200 bg-sky-50 text-sky-700';
  return 'border-slate-200 bg-slate-100 text-slate-700';
};

const impactTone = (criticality?: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL') => {
  if (criticality === 'CRITICAL') return 'bg-rose-50 text-rose-700 border-rose-200';
  if (criticality === 'HIGH') return 'bg-amber-50 text-amber-700 border-amber-200';
  if (criticality === 'LOW') return 'bg-slate-100 text-slate-700 border-slate-200';
  return 'bg-sky-50 text-sky-700 border-sky-200';
};

const TypeBadge = ({ type }: { type: Monitor['type'] }) => {
  const icons: Record<Monitor['type'], React.ReactNode> = {
    HTTP: <Globe className="mr-1 h-3 w-3" />,
    TCP: <Server className="mr-1 h-3 w-3" />,
    DNS: <Search className="mr-1 h-3 w-3" />,
    SSL: <Shield className="mr-1 h-3 w-3" />,
  };

  return (
    <span className="inline-flex items-center rounded border border-slate-200 bg-slate-100 px-1.5 py-0.5 text-[10px] font-bold uppercase text-slate-500">
      {icons[type]} {type}
    </span>
  );
};

const StatCard = ({
  title,
  value,
  detail,
  icon: Icon,
  accent,
}: {
  title: string;
  value: string | number;
  detail: string;
  icon: React.ElementType;
  accent: string;
}) => (
  <motion.div
    layout
    initial={{ opacity: 0, y: 20 }}
    animate={{ opacity: 1, y: 0 }}
    whileHover={{ y: -4, scale: 1.01, boxShadow: "0 20px 40px -15px rgba(0,0,0,0.2)" }}
    transition={{ type: "spring", stiffness: 300, damping: 20 }}
    className="relative overflow-hidden flex flex-col justify-between rounded-3xl border border-slate-200/50 dark:border-white/5 bg-white/60 dark:bg-slate-900/40 backdrop-blur-2xl p-6 shadow-sm transition-all duration-300 before:absolute before:inset-0 before:bg-gradient-to-br before:from-white/40 before:to-transparent before:dark:from-white/5 before:pointer-events-none group"
  >
    <div className="absolute -right-10 -top-10 h-32 w-32 rounded-full bg-slate-100/50 dark:bg-slate-800/50 blur-2xl transition-all duration-500 group-hover:scale-150 group-hover:bg-emerald-500/10 dark:group-hover:bg-emerald-500/20" />
    <div className="relative z-10 flex items-start justify-between gap-4">
      <div>
        <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">{title}</p>
        <p className="mt-3 text-4xl font-extrabold tracking-tight bg-gradient-to-br from-slate-900 to-slate-600 dark:from-white dark:to-slate-300 bg-clip-text text-transparent drop-shadow-sm">{value}</p>
        <p className="mt-2 text-[13px] font-medium text-slate-500 dark:text-slate-500">{detail}</p>
      </div>
      <div className={`rounded-2xl p-3.5 ${accent.includes('bg-') ? accent : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200'} shadow-sm ring-1 ring-black/5 dark:ring-white/10 group-hover:-rotate-3 group-hover:scale-110 transition-transform duration-300`}>
        <Icon className="h-5 w-5" />
      </div>
    </div>
  </motion.div>
);

const Panel = ({
  title,
  description,
  icon: Icon,
  children,
  action,
}: {
  title: string;
  description: string;
  icon: React.ElementType;
  children: React.ReactNode;
  action?: React.ReactNode;
}) => (
  <motion.div
    layout
    initial={{ opacity: 0, scale: 0.98, y: 15 }}
    animate={{ opacity: 1, scale: 1, y: 0 }}
    transition={{ type: "spring", stiffness: 200, damping: 20 }}
    className="relative overflow-hidden rounded-[2rem] border border-slate-200/50 dark:border-white/5 bg-white/70 dark:bg-[#0c121e]/70 backdrop-blur-2xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] dark:shadow-[0_8px_30px_rgba(0,0,0,0.2)] before:absolute before:inset-0 before:bg-gradient-to-br before:from-white/20 before:to-transparent before:dark:from-white/5 before:pointer-events-none flex flex-col h-full ring-1 ring-inset ring-white/50 dark:ring-white/5"
  >
    <div className="relative z-10 border-b border-slate-200/50 dark:border-white/5 px-6 py-5 bg-white/30 dark:bg-slate-900/30 backdrop-blur-sm">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="flex items-center gap-2.5 text-lg font-bold tracking-tight text-slate-900 dark:text-white">
            {Icon && <Icon className="h-5 w-5 text-emerald-500 dark:text-emerald-400" />}
            {title}
          </h2>
          <p className="mt-1.5 text-sm font-medium text-slate-500 dark:text-slate-400 leading-relaxed">{description}</p>
        </div>
        {action && (
          <div className="flex items-center gap-3">
            {action}
          </div>
        )}
      </div>
    </div>
    <div className="relative z-10 p-6 flex-1 bg-white/20 dark:bg-transparent">
       {children}
    </div>
  </motion.div>
);

const EmptyState = ({ message, tone = 'slate' }: { message: string; tone?: 'slate' | 'emerald' }) => (
  <div
    className={`rounded-2xl border p-6 text-sm flex items-center justify-center text-center font-medium backdrop-blur-md shadow-inner ${
      tone === 'emerald'
        ? 'border-emerald-200/50 dark:border-emerald-900/50 bg-emerald-50/50 dark:bg-emerald-900/20 text-emerald-800 dark:text-emerald-300'
        : 'border-slate-200/50 dark:border-slate-700/50 bg-slate-50/50 dark:bg-slate-800/30 text-slate-500 dark:text-slate-400'
    }`}
  >
    {message}
  </div>
);

const SkeletonLoader = () => (
  <div className="animate-pulse space-y-6">
    <div className="h-56 rounded-3xl bg-slate-200" />
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
      {Array.from({ length: 4 }).map((_, index) => (
        <div key={index} className="h-36 rounded-2xl bg-slate-200" />
      ))}
    </div>
    <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
      <div className="h-96 rounded-2xl bg-slate-200 xl:col-span-2" />
      <div className="h-96 rounded-2xl bg-slate-200" />
    </div>
  </div>
);

const DraggableWidget = ({ widgetId, children }: { widgetId: WidgetId; children: React.ReactNode }) => {
  const controls = useDragControls();

  return (
    <Reorder.Item
      value={widgetId}
      dragListener={false}
      dragControls={controls}
      className="relative z-0 group"
      whileDrag={{ scale: 1.02, zIndex: 50, filter: 'drop-shadow(0 20px 25px rgba(0,0,0,0.15))' }}
      initial={{ opacity: 0, scale: 0.95, y: 15 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95 }}
      transition={{ type: "spring", stiffness: 200, damping: 20 }}
    >
      <div 
        className="absolute left-1/2 top-1 -translate-x-1/2 z-20 cursor-grab active:cursor-grabbing opacity-0 group-hover:opacity-100 transition-opacity bg-slate-200/50 hover:bg-slate-300/60 backdrop-blur-sm rounded-b-xl py-1.5 px-6 flex items-center justify-center pointer-events-auto shadow-sm"
        onPointerDown={(e) => controls.start(e)}
        title="Drag to reorder widget"
      >
        <div className="h-1.5 w-10 bg-slate-500/50 rounded-full" />
      </div>
      {children}
    </Reorder.Item>
  );
};

export default function Dashboard() {
  const [dashboardMode, setDashboardMode] = useState<DashboardMode>(readDashboardMode);
  const [compactWidgets, setCompactWidgets] = useState<WidgetId[]>(readCompactWidgetSelection);
  const [dockTab, setDockTab] = useState<'pinned' | 'library'>('pinned');

  useEffect(() => {
    window.localStorage.setItem(DASHBOARD_MODE_STORAGE_KEY, dashboardMode);
  }, [dashboardMode]);

  useEffect(() => {
    window.localStorage.setItem(DASHBOARD_COMPACT_WIDGETS_STORAGE_KEY, JSON.stringify(compactWidgets));
  }, [compactWidgets]);

  const { data: currentUser } = useQuery({
    queryKey: ['currentUser'],
    queryFn: fetchCurrentUser,
    staleTime: 60_000,
  });

  const {
    data: monitors = [],
    isLoading: isMonitorsLoading,
    isError: isMonitorsError,
  } = useQuery({
    queryKey: ['monitors'],
    queryFn: fetchMonitors,
    refetchInterval: 10_000,
  });

  const {
    data: alerts = [],
    isLoading: isAlertsLoading,
  } = useQuery({
    queryKey: ['recentAlerts'],
    queryFn: fetchRecentAlerts,
    refetchInterval: 10_000,
  });

  const {
    data: incidents = [],
    isLoading: isIncidentsLoading,
  } = useQuery({
    queryKey: ['dashboardIncidents'],
    queryFn: fetchOpenIncidents,
    refetchInterval: 10_000,
  });

  const {
    data: activeWatchChanges = [],
    isLoading: isWatchLoading,
  } = useQuery({
    queryKey: ['activeWatchChanges'],
    queryFn: fetchActiveWatchChanges,
    refetchInterval: 10_000,
  });

  const insights = useMemo(() => {
    const now = Date.now();
    const healthyMonitors = monitors.filter((monitor) => monitor.status === 'UP');
    const degradedMonitors = monitors.filter((monitor) => monitor.status === 'DEGRADED');
    const downMonitors = monitors.filter((monitor) => monitor.status === 'DOWN');
    const pausedMonitors = monitors.filter((monitor) => monitor.status === 'PAUSED');
    const attentionMonitors = monitors.filter(
      (monitor) =>
        monitor.status === 'DOWN' ||
        monitor.status === 'DEGRADED' ||
        Boolean(monitor.hasActiveAlert),
    );
    const responseSamples = monitors
      .map((monitor) => monitor.avgResponseTimeMs)
      .filter((value): value is number => typeof value === 'number' && value > 0);
    const availabilitySamples = monitors
      .map((monitor) => monitor.uptimePercentage)
      .filter((value): value is number => typeof value === 'number');
    const avgResponseTimeMs = responseSamples.length
      ? Math.round(responseSamples.reduce((total, value) => total + value, 0) / responseSamples.length)
      : null;
    const fleetAvailability = availabilitySamples.length
      ? Number(
          (
            availabilitySamples.reduce((total, value) => total + value, 0) /
            availabilitySamples.length
          ).toFixed(1),
        )
      : null;
    const monitorsByResponse = [...monitors]
      .filter((monitor) => typeof monitor.avgResponseTimeMs === 'number' && monitor.avgResponseTimeMs > 0)
      .sort((left, right) => (left.avgResponseTimeMs ?? 0) - (right.avgResponseTimeMs ?? 0));
    const highImpactAttention = attentionMonitors.filter((monitor) => {
      const criticality = monitor.impactMetadata?.businessCriticality;
      return criticality === 'HIGH' || criticality === 'CRITICAL';
    });
    const impactMappedMonitors = monitors.filter(
      (monitor) =>
        Boolean(
          monitor.impactMetadata?.serviceName ||
            monitor.impactMetadata?.featureName ||
            monitor.impactMetadata?.customerJourney,
        ),
    );
    const affectedJourneys = new Set(
      attentionMonitors
        .map((monitor) => monitor.impactMetadata?.customerJourney)
        .filter((value): value is string => Boolean(value)),
    );
    const affectedFeatures = new Set(
      attentionMonitors
        .map((monitor) => monitor.impactMetadata?.featureName)
        .filter((value): value is string => Boolean(value)),
    );
    const openIncidents = incidents.filter((incident) => incident.status !== 'RESOLVED');
    const alertsLast24h = alerts.filter(
      (alert) => now - new Date(alert.createdAt).getTime() <= 24 * 60 * 60 * 1000,
    ).length;
    const criticalIncidentCount = openIncidents.filter(
      (incident) => incident.severity === 'CRITICAL' || incident.severity === 'HIGH',
    ).length;
    const activeWatchMinutes = activeWatchChanges.reduce(
      (total, change) => total + (change.watchMinutesRemaining ?? 0),
      0,
    );
    const typeDistribution = (['HTTP', 'TCP', 'DNS', 'SSL'] as const).map((type) => ({
      type,
      total: monitors.filter((monitor) => monitor.type === type).length,
    }));
    const statusDistribution = [
      { label: 'Up', total: healthyMonitors.length, tone: 'bg-emerald-500' },
      { label: 'Down', total: downMonitors.length, tone: 'bg-rose-500' },
      { label: 'Degraded', total: degradedMonitors.length, tone: 'bg-amber-500' },
      { label: 'Paused', total: pausedMonitors.length, tone: 'bg-slate-400' },
    ];
    const ownerExposure = Object.entries(
      attentionMonitors.reduce<Record<string, number>>((acc, monitor) => {
        const owner = monitor.impactMetadata?.teamOwner || 'Unassigned';
        acc[owner] = (acc[owner] || 0) + 1;
        return acc;
      }, {}),
    )
      .map(([owner, total]) => ({ owner, total }))
      .sort((left, right) => right.total - left.total);
    const regionExposure = Object.entries(
      attentionMonitors.reduce<Record<string, number>>((acc, monitor) => {
        const region = monitor.impactMetadata?.region || 'Global';
        acc[region] = (acc[region] || 0) + 1;
        return acc;
      }, {}),
    )
      .map(([region, total]) => ({ region, total }))
      .sort((left, right) => right.total - left.total);
    const slaPressure = Object.entries(
      attentionMonitors.reduce<Record<string, number>>((acc, monitor) => {
        const tier = monitor.impactMetadata?.slaTier || 'STANDARD';
        acc[tier] = (acc[tier] || 0) + 1;
        return acc;
      }, {}),
    )
      .map(([tier, total]) => ({ tier, total }))
      .sort((left, right) => right.total - left.total);
    const topImpactIncidents = [...openIncidents].sort((left, right) => right.impactScore - left.impactScore);

    return {
      total: monitors.length,
      healthy: healthyMonitors.length,
      degraded: degradedMonitors.length,
      down: downMonitors.length,
      paused: pausedMonitors.length,
      attentionMonitors,
      avgResponseTimeMs,
      fleetAvailability,
      activeIncidents: openIncidents,
      highImpactAttention,
      affectedJourneys: affectedJourneys.size,
      affectedFeatures: affectedFeatures.size,
      impactCoverage: monitors.length
        ? Number(((impactMappedMonitors.length / monitors.length) * 100).toFixed(0))
        : 0,
      impactMappedMonitors: impactMappedMonitors.length,
      fastestMonitor: monitorsByResponse[0] ?? null,
      slowestMonitors: monitorsByResponse.slice(-3).reverse(),
      fastestMonitors: monitorsByResponse.slice(0, 3),
      alertsLast24h,
      criticalIncidentCount,
      activeWatchMinutes,
      typeDistribution,
      statusDistribution,
      ownerExposure,
      regionExposure,
      slaPressure,
      topImpactIncidents,
    };
  }, [activeWatchChanges, alerts, incidents, monitors]);

  const compactWidgetSet = useMemo(() => new Set(compactWidgets), [compactWidgets]);

  const toggleWidget = (widgetId: WidgetId) => {
    setCompactWidgets((current) =>
      current.includes(widgetId)
        ? current.filter((id) => id !== widgetId)
        : [...current, widgetId],
    );
  };



  const applyWidgetPreset = (mode: DashboardMode) => {
    setDashboardMode(mode);
    if (mode === 'compact') {
      setCompactWidgets(COMPACT_WIDGET_PRESET);
    }
  };

  const compactRenderedWidgets = useMemo(
    () =>
      compactWidgets.filter((widgetId): widgetId is WidgetId =>
        WIDGET_CATALOG.some((widget) => widget.id === widgetId),
      ),
    [compactWidgets],
  );

  if (isMonitorsLoading || isAlertsLoading || isIncidentsLoading || isWatchLoading) {
    return (
      <div className="mx-auto max-w-7xl pb-10">
        <SkeletonLoader />
      </div>
    );
  }

  if (isMonitorsError) {
    return (
      <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-center">
        <AlertTriangle className="mx-auto mb-3 h-8 w-8 text-red-500" />
        <h3 className="text-lg font-semibold text-red-900">Dashboard unavailable</h3>
        <p className="mt-2 text-sm text-red-700">
          The frontend could not load live monitoring data from the API.
        </p>
      </div>
    );
  }

  const summaryMessage =
    insights.total === 0
      ? 'No monitors are live yet. Create one endpoint to start collecting response time, uptime, and incident data.'
      : insights.activeIncidents.length > 0
        ? `${insights.activeIncidents.length} open incident${insights.activeIncidents.length === 1 ? '' : 's'} and ${insights.attentionMonitors.length} endpoint${insights.attentionMonitors.length === 1 ? '' : 's'} need attention.`
        : `All monitored services are currently stable across ${insights.total} endpoint${insights.total === 1 ? '' : 's'}.`;

  const analyticalMessage =
    dashboardMode === 'analytical'
      ? 'Analytical mode expands the dashboard with deeper team, region, latency, and incident-risk panels.'
      : 'Compact mode keeps only the essential operational summary visible while optional widgets stay under your control.';

  const renderCustomerImpactWidget = () => (
    <Panel
      title="Customer Impact Snapshot"
      description="Highest-risk monitors based on current health and mapped business context."
      icon={ShieldAlert}
    >
      {insights.highImpactAttention.length === 0 ? (
        <EmptyState
          tone="emerald"
          message="No high-impact monitors are currently in trouble. As you map more services and journeys, this becomes your customer-risk view."
        />
      ) : (
        <div className="space-y-3">
          {insights.highImpactAttention.slice(0, dashboardMode === 'analytical' ? 6 : 4).map((monitor) => (
            <Link
              key={monitor.id}
              to={`/monitors/${monitor.id}`}
              className="block rounded-2xl border border-slate-200 p-4 transition hover:border-slate-300 hover:bg-slate-50"
            >
              <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-semibold text-slate-900">{monitor.name}</p>
                    <span className={`rounded-full border px-2.5 py-1 text-xs font-semibold ${monitorTone(monitor.status)}`}>
                      {monitor.status}
                    </span>
                    <span className={`rounded-full border px-2.5 py-1 text-xs font-semibold ${impactTone(monitor.impactMetadata?.businessCriticality)}`}>
                      {monitor.impactMetadata?.businessCriticality || 'MEDIUM'} impact
                    </span>
                  </div>
                  <p className="mt-3 text-sm text-slate-700">
                    {monitor.impactMetadata?.featureName || 'Unmapped feature'} / {monitor.impactMetadata?.customerJourney || 'Unmapped journey'}
                  </p>
                  <p className="mt-1 text-sm text-slate-500">
                    Owner: {monitor.impactMetadata?.teamOwner || 'Unassigned'} / Region: {monitor.impactMetadata?.region || 'Global'}
                  </p>
                </div>

                <div className="grid gap-2 text-sm text-slate-500 sm:grid-cols-2 lg:min-w-[260px]">
                  <div>
                    <p className="text-xs uppercase tracking-wide text-slate-400">Service</p>
                    <p className="mt-1 font-semibold text-slate-900">
                      {monitor.impactMetadata?.serviceName || 'Not mapped'}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs uppercase tracking-wide text-slate-400">SLA tier</p>
                    <p className="mt-1 font-semibold text-slate-900">
                      {monitor.impactMetadata?.slaTier || 'STANDARD'}
                    </p>
                  </div>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </Panel>
  );

  const renderImpactCommandWidget = () => (
    <Panel
      title="Impact Command"
      description="Open incidents ranked by impact score with trigger context."
      icon={Siren}
    >
      {insights.topImpactIncidents.length === 0 ? (
        <EmptyState tone="emerald" message="No open incidents are currently carrying impact risk." />
      ) : (
        <div className="space-y-3">
          {insights.topImpactIncidents.slice(0, dashboardMode === 'analytical' ? 5 : 3).map((incident) => (
            <Link
              key={incident.id}
              to={`/monitors/${incident.monitor.id}`}
              className="block rounded-2xl border border-slate-200 p-4 transition hover:border-slate-300 hover:bg-slate-50"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-semibold text-slate-900">{incident.monitor.name}</p>
                    <span className={`rounded-full border px-2.5 py-1 text-xs font-semibold ${incidentSeverityTone(incident.severity)}`}>
                      {incident.severity}
                    </span>
                  </div>
                  <p className="mt-2 text-sm text-slate-700">{incident.message}</p>
                  <p className="mt-2 text-xs text-slate-500">
                    {incident.impactSummary.featureName || 'Unmapped feature'} / {incident.impactSummary.customerJourney || 'Unmapped journey'}
                  </p>
                  {incident.likelyTrigger ? (
                    <p className="mt-2 text-xs text-slate-400">Likely trigger: {incident.likelyTrigger.title}</p>
                  ) : null}
                </div>
                <div className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2 text-right">
                  <p className="text-[10px] uppercase tracking-wide text-slate-400">Impact</p>
                  <p className="mt-1 text-sm font-semibold text-slate-900">{incident.impactScore}</p>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </Panel>
  );

  const renderDeployWatchWidget = () => (
    <Panel
      title="Deploy Watch"
      description="Deploys and releases still inside their active observation window."
      icon={Clock3}
    >
      {activeWatchChanges.length === 0 ? (
        <EmptyState message="No active deploy or release watch windows right now." />
      ) : (
        <div className="space-y-3">
          {activeWatchChanges.map((change) => (
            <div key={change.id} className="rounded-2xl border border-slate-200 p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-semibold text-slate-900">{change.title}</p>
                  <p className="mt-2 text-sm text-slate-600">
                    {change.monitor?.name || change.serviceName || 'Project-wide deployment'}
                  </p>
                  <p className="mt-2 text-xs text-slate-400">
                    {change.type} via {change.source} / started {formatRelativeTime(change.happenedAt)}
                  </p>
                </div>
                <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-right">
                  <p className="text-[10px] uppercase tracking-wide text-emerald-700">Watch Left</p>
                  <p className="mt-1 text-sm font-semibold text-emerald-900">
                    {change.watchMinutesRemaining ?? 0}m
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </Panel>
  );

  const renderRecentAlertsWidget = () => (
    <Panel
      title="Recent Alerts"
      description="Latest triggered, acknowledged, and resolved alert activity."
      icon={BellRing}
    >
      {alerts.length === 0 ? (
        <EmptyState
          tone="emerald"
          message="No alerts have been recorded recently. Alert history will appear here as monitors trigger and recover."
        />
      ) : (
        <div className="space-y-3">
          {alerts.map((alert) => (
            <div key={alert.id} className="rounded-2xl border border-slate-200 p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-semibold text-slate-900">{alert.monitor?.name || 'Unknown monitor'}</p>
                  <p className="mt-2 text-sm text-slate-600">{alert.message}</p>
                </div>
                <span className={`rounded-full border px-2.5 py-1 text-xs font-semibold ${alertTone(alert.status)}`}>
                  {alert.status}
                </span>
              </div>
              <p className="mt-3 text-xs text-slate-400">{formatRelativeTime(alert.createdAt)}</p>
            </div>
          ))}
        </div>
      )}
    </Panel>
  );

  const renderPerformanceChartWidget = () => (
    <Panel
      title="Performance Snapshot"
      description="Average response times across monitored endpoints."
      icon={BarChart3}
    >
      {monitors.length === 0 ? (
        <div className="flex h-64 items-center justify-center rounded-xl bg-slate-50 text-sm text-slate-500">
          No monitors active yet.
        </div>
      ) : (
        <Suspense
          fallback={
            <div className="flex h-64 items-center justify-center rounded-xl bg-slate-50 text-sm text-slate-500">
              Loading chart view...
            </div>
          }
        >
          <DashboardPerformanceChart monitors={monitors} />
        </Suspense>
      )}
    </Panel>
  );

  const renderLatencyBoardWidget = () => (
    <Panel
      title="Latency Board"
      description="Fastest and slowest endpoints based on recent average response time."
      icon={Gauge}
    >
      {insights.fastestMonitors.length === 0 ? (
        <EmptyState message="More successful checks are needed before latency leaders can be ranked." />
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-700">Fastest</p>
            <div className="mt-4 space-y-3">
              {insights.fastestMonitors.map((monitor) => (
                <div key={monitor.id} className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate font-semibold text-slate-900">{monitor.name}</p>
                    <p className="text-xs text-slate-500">{monitor.url}</p>
                  </div>
                  <p className="text-sm font-semibold text-emerald-700">{formatResponseTime(monitor.avgResponseTimeMs)}</p>
                </div>
              ))}
            </div>
          </div>
          <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-amber-700">Slowest</p>
            <div className="mt-4 space-y-3">
              {insights.slowestMonitors.map((monitor) => (
                <div key={monitor.id} className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate font-semibold text-slate-900">{monitor.name}</p>
                    <p className="text-xs text-slate-500">{monitor.url}</p>
                  </div>
                  <p className="text-sm font-semibold text-amber-700">{formatResponseTime(monitor.avgResponseTimeMs)}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </Panel>
  );

  const renderOwnershipRadarWidget = () => (
    <Panel
      title="Ownership Radar"
      description="Who is carrying the most pressure, and which SLA tiers are currently exposed."
      icon={Users}
    >
      <div className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-2xl border border-slate-200/60 bg-white/50 p-4 relative overflow-hidden flex flex-col items-center">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500 w-full text-center mb-4">Team Exposure</p>
          {insights.ownerExposure.length === 0 ? (
            <p className="mt-4 text-sm text-slate-500">No team-owned issues are currently active.</p>
          ) : (
            <div className="h-[200px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <RadarChart data={insights.ownerExposure}>
                  <PolarGrid stroke="#e2e8f0" />
                  <PolarAngleAxis dataKey="owner" tick={{fill: '#64748b', fontSize: 10}} />
                  <Radar name="Alerts" dataKey="total" stroke="#059669" fill="#10b981" fillOpacity={0.6} />
                  <RechartsTooltip contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} />
                </RadarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
        <div className="rounded-2xl border border-slate-200/60 bg-white/50 p-4 relative overflow-hidden flex flex-col items-center">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500 w-full text-center mb-4">SLA Pressure</p>
          {insights.slaPressure.length === 0 ? (
            <p className="mt-4 text-sm text-slate-500">No SLA-tier issues are currently active.</p>
          ) : (
            <div className="h-[200px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={insights.slaPressure} layout="vertical" margin={{ top: 0, right: 30, left: 0, bottom: 0 }}>
                  <XAxis type="number" hide />
                  <YAxis type="category" dataKey="tier" axisLine={false} tickLine={false} tick={{fill: '#475569', fontSize: 11, fontWeight: 600}} width={80} />
                  <RechartsTooltip cursor={{fill: '#f1f5f9'}} contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} />
                  <Bar dataKey="total" fill="#3b82f6" radius={[0, 4, 4, 0]} barSize={24} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      </div>
    </Panel>
  );

  const renderRegionalExposureWidget = () => (
    <Panel
      title="Regional Exposure"
      description="Attention monitors grouped by their mapped operating region."
      icon={Map}
    >
      {insights.regionExposure.length === 0 ? (
        <EmptyState message="No mapped regional issues are active right now." />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {insights.regionExposure.map((entry) => (
            <div key={entry.region} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <div className="flex items-center justify-between gap-3">
                <p className="font-semibold text-slate-900">{entry.region}</p>
                <span className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-700">
                  {entry.total}
                </span>
              </div>
              <p className="mt-2 text-sm text-slate-500">
                {entry.total === 1 ? '1 attention monitor' : `${entry.total} attention monitors`}
              </p>
            </div>
          ))}
        </div>
      )}
    </Panel>
  );

  const pieColors = ['#10b981', '#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6'];
  const statusColors = { 'Up': '#10b981', 'Down': '#ef4444', 'Degraded': '#f59e0b', 'Paused': '#94a3b8' };

  const renderServiceMixWidget = () => (
    <Panel
      title="Service Mix"
      description="Monitor-type and status distribution for the full fleet."
      icon={Layers3}
    >
      <div className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-2xl border border-slate-200/60 bg-white/50 p-4 flex flex-col items-center">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500 w-full text-center mb-4">By Monitor Type</p>
          {insights.typeDistribution.every(t => t.total === 0) ? (
            <p className="text-sm text-slate-500 mt-10">No monitors created yet.</p>
          ) : (
            <div className="h-[200px] w-full relative">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <RechartsTooltip contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} />
                  <Pie data={insights.typeDistribution.filter(t => t.total > 0)} innerRadius={60} outerRadius={80} paddingAngle={5} dataKey="total" nameKey="type">
                    {insights.typeDistribution.filter(t => t.total > 0).map((_, index) => (
                      <Cell key={`cell-${index}`} fill={pieColors[index % pieColors.length]} />
                    ))}
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none flex-col mt-4">
                <span className="text-3xl font-bold text-slate-800">{insights.total}</span>
                <span className="text-[10px] uppercase text-slate-400 font-bold tracking-widest mt-1">Total</span>
              </div>
            </div>
          )}
        </div>
        <div className="rounded-2xl border border-slate-200/60 bg-white/50 p-4 flex flex-col items-center">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500 w-full text-center mb-4">By Status</p>
          {insights.statusDistribution.every(s => s.total === 0) ? (
            <p className="text-sm text-slate-500 mt-10">No statuses to track.</p>
          ) : (
            <div className="h-[200px] w-full relative">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <RechartsTooltip contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} />
                  <Pie data={insights.statusDistribution.filter(s => s.total > 0)} innerRadius={50} outerRadius={80} paddingAngle={2} dataKey="total" nameKey="label">
                    {insights.statusDistribution.filter(s => s.total > 0).map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={statusColors[entry.label as keyof typeof statusColors] || '#000'} />
                    ))}
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      </div>
    </Panel>
  );

  const renderMonitorTableWidget = () => (
    <Panel
      title="Monitor Table"
      description="Detailed monitor-level health, response speed, and latest signal."
      icon={LayoutDashboard}
      action={
        <Link
          to="/monitors"
          className="inline-flex items-center gap-2 rounded-full border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 transition hover:border-slate-300 hover:bg-slate-50"
        >
          Open monitors
          <ExternalLink className="h-4 w-4" />
        </Link>
      }
    >
      {monitors.length === 0 ? (
        <EmptyState message="Create your first monitor to start building uptime and latency insights." />
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200 text-sm">
            <thead className="bg-slate-50 text-slate-500">
              <tr>
                <th className="px-4 py-3 text-left font-medium">Monitor</th>
                <th className="px-4 py-3 text-left font-medium">Status</th>
                <th className="px-4 py-3 text-left font-medium">Avg. response</th>
                <th className="px-4 py-3 text-left font-medium">Availability</th>
                <th className="px-4 py-3 text-left font-medium">Latest signal</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white">
              {monitors.map((monitor) => (
                <tr key={monitor.id} className="hover:bg-slate-50">
                  <td className="px-4 py-4">
                    <Link to={`/monitors/${monitor.id}`} className="block">
                      <div className="flex items-center gap-2">
                        <div className="max-w-[220px] truncate font-semibold text-slate-900 hover:text-blue-600">
                          {monitor.name}
                        </div>
                        <TypeBadge type={monitor.type} />
                      </div>
                      <p className="mt-1 max-w-[320px] truncate font-mono text-xs text-slate-500">{monitor.url}</p>
                      {monitor.impactMetadata?.featureName || monitor.impactMetadata?.businessCriticality ? (
                        <p className="mt-2 text-[11px] uppercase tracking-wide text-slate-400">
                          {monitor.impactMetadata?.featureName || 'Unmapped feature'} / {monitor.impactMetadata?.businessCriticality || 'MEDIUM'} impact
                        </p>
                      ) : null}
                    </Link>
                  </td>
                  <td className="px-4 py-4">
                    <span className={`rounded-full border px-2.5 py-1 text-xs font-semibold ${monitorTone(monitor.status)}`}>
                      {monitor.status}
                    </span>
                  </td>
                  <td className="px-4 py-4 font-medium text-slate-900">{formatResponseTime(monitor.avgResponseTimeMs)}</td>
                  <td className="px-4 py-4 font-medium text-slate-900">{formatPercentage(monitor.uptimePercentage)}</td>
                  <td className="max-w-[220px] px-4 py-4 text-slate-600">
                    {monitor.type === 'SSL' && monitor.metadata?.daysRemaining !== undefined ? (
                      <div className="flex flex-col gap-0.5">
                        <span className="text-xs font-semibold text-slate-700">
                          Expires in {monitor.metadata.daysRemaining} days
                        </span>
                        <span className="truncate text-[10px] text-slate-400">{monitor.metadata.issuer}</span>
                      </div>
                    ) : monitor.type === 'DNS' && monitor.metadata?.resolvedIps ? (
                      <div className="flex flex-wrap gap-1">
                        {monitor.metadata.resolvedIps.slice(0, 2).map((ip: string) => (
                          <span key={ip} className="rounded border border-slate-200 bg-slate-100 px-1 py-0.5 font-mono text-[9px]">
                            {ip}
                          </span>
                        ))}
                        {monitor.metadata.resolvedIps.length > 2 ? (
                          <span className="text-[9px] text-slate-400">+{monitor.metadata.resolvedIps.length - 2} more</span>
                        ) : null}
                      </div>
                    ) : monitor.metadata?.missingKeywords && monitor.metadata.missingKeywords.length > 0 ? (
                      <span className="inline-flex items-center rounded border border-amber-200 bg-amber-50 px-2 py-0.5 text-xs text-amber-700">
                        <AlertTriangle className="mr-1 h-3 w-3" /> Missing keywords
                      </span>
                    ) : (
                      <span className="block truncate">
                        {monitor.lastErrorMessage
                          ? monitor.lastErrorMessage
                          : monitor.latestStatusCode
                            ? `HTTP ${monitor.latestStatusCode}`
                            : 'Waiting for more checks'}
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Panel>
  );

  const renderWidgetById = (widgetId: WidgetId) => {
    switch (widgetId) {
      case 'customer-impact':
        return renderCustomerImpactWidget();
      case 'impact-command':
        return renderImpactCommandWidget();
      case 'deploy-watch':
        return renderDeployWatchWidget();
      case 'recent-alerts':
        return renderRecentAlertsWidget();
      case 'performance-chart':
        return renderPerformanceChartWidget();
      case 'latency-board':
        return renderLatencyBoardWidget();
      case 'ownership-radar':
        return renderOwnershipRadarWidget();
      case 'regional-exposure':
        return renderRegionalExposureWidget();
      case 'service-mix':
        return renderServiceMixWidget();
      case 'monitor-table':
        return renderMonitorTableWidget();
      default:
        return null;
    }
  };

  return (
    <div className="mx-auto max-w-[1520px] space-y-8 pb-10">
      <motion.section 
        layout
        className="relative overflow-hidden rounded-[2.5rem] border border-emerald-900/30 dark:border-white/10 bg-[#080c14] p-8 sm:p-12 text-white shadow-[0_20px_50px_rgba(0,0,0,0.3)] ring-1 ring-inset ring-white/10 group"
      >
        <div className="absolute -inset-[150%] animate-[spin_40s_linear_infinite] bg-[conic-gradient(from_90deg_at_50%_50%,#080c14_0%,#064e3b_50%,#080c14_100%)] opacity-40 blur-3xl transition-opacity group-hover:opacity-60" />
        <div className="absolute inset-0 bg-[#080c14]/70 backdrop-blur-3xl" />
        
        <div className="relative z-10 flex flex-col gap-8 xl:flex-row xl:items-end xl:justify-between">
          <div className="max-w-3xl">
            <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.1 }} className="inline-flex items-center gap-2 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 text-[10px] font-bold uppercase tracking-widest text-emerald-400 backdrop-blur mb-4">
              <div className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
              Dashboard Command
            </motion.div>
            <motion.h1 initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2, type: "spring" }} className="text-4xl font-extrabold tracking-tight sm:text-5xl lg:text-6xl lg:leading-[1.1] bg-gradient-to-br from-white via-slate-200 to-slate-500 bg-clip-text text-transparent drop-shadow-sm">
              Switch between a clean operational summary and a deeper analytical control room.
            </motion.h1>
            <motion.p initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }} className="mt-6 max-w-2xl text-[15px] font-medium leading-relaxed text-slate-300 sm:text-base">
              {summaryMessage}
            </motion.p>
            <motion.p initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }} className="mt-2 max-w-2xl text-[15px] font-medium leading-relaxed text-slate-500">
              {analyticalMessage}
            </motion.p>
          </div>

          <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.5, type: "spring", stiffness: 200 }} className="grid min-w-[320px] gap-3 sm:grid-cols-2">
            <div className="rounded-[1.25rem] border border-white/10 bg-white/[0.03] p-5 backdrop-blur-xl transition-all hover:bg-white/10 hover:scale-[1.02]">
              <p className="text-slate-400 text-xs font-bold uppercase tracking-wider">Fleet availability</p>
              <p className="mt-2 text-3xl font-extrabold tracking-tight text-white">{formatPercentage(insights.fleetAvailability)}</p>
            </div>
            <div className="rounded-[1.25rem] border border-white/10 bg-white/[0.03] p-5 backdrop-blur-xl transition-all hover:bg-white/10 hover:scale-[1.02]">
              <p className="text-slate-400 text-xs font-bold uppercase tracking-wider">Avg. response</p>
              <p className="mt-2 text-3xl font-extrabold tracking-tight text-white">{formatResponseTime(insights.avgResponseTimeMs)}</p>
            </div>
            <div className="rounded-[1.25rem] border border-white/10 bg-white/[0.03] p-5 backdrop-blur-xl transition-all hover:bg-white/10 hover:scale-[1.02]">
              <p className="text-slate-400 text-xs font-bold uppercase tracking-wider">Open incidents</p>
              <p className="mt-2 text-3xl font-extrabold tracking-tight text-white">{insights.activeIncidents.length}</p>
            </div>
            <div className="rounded-[1.25rem] border border-white/10 bg-white/[0.03] p-5 backdrop-blur-xl transition-all hover:bg-white/10 hover:scale-[1.02]">
              <p className="text-slate-400 text-xs font-bold uppercase tracking-wider">Alerts in 24h</p>
              <p className="mt-2 text-3xl font-extrabold tracking-tight text-white">{insights.alertsLast24h}</p>
            </div>
          </motion.div>
        </div>
      </motion.section>

      {currentUser?.subscriptionStatus === 'TRIALING' ? <UpgradePrompt reason="trial_expiring" /> : null}
      {currentUser?.subscriptionStatus === 'EXPIRED' || currentUser?.subscriptionStatus === 'CANCELLED' ? (
        <UpgradePrompt reason="expired" />
      ) : null}

      <section className="rounded-[2rem] border border-slate-200/50 dark:border-white/5 bg-white/70 dark:bg-[#0c121e]/70 backdrop-blur-2xl p-6 shadow-[0_8px_30px_rgb(0,0,0,0.04)] dark:shadow-[0_8px_30px_rgba(0,0,0,0.2)] ring-1 ring-inset ring-white/50 dark:ring-white/5 relative z-20">
        <div className="flex flex-col gap-6 xl:flex-row xl:items-start xl:justify-between">
          <div className="max-w-2xl">
            <div className="flex items-center gap-2.5">
              <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-emerald-100/50 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400">
                <SlidersHorizontal className="h-4 w-4" />
              </div>
              <h2 className="text-lg font-bold tracking-tight text-slate-900 dark:text-white">Dashboard Modes</h2>
            </div>
            <p className="mt-2 text-sm font-medium leading-relaxed text-slate-500 dark:text-slate-400 pl-[2.625rem]">
              Compact mode keeps the page focused and lets you curate a smaller dashboard from the right-side widget dock.
              Analytical mode opens the full control room with larger graphs and deeper operational context.
            </p>
          </div>

          <div className="flex rounded-2xl bg-slate-100/80 dark:bg-slate-900/80 p-1.5 backdrop-blur-md shadow-inner ring-1 ring-inset ring-slate-200/50 dark:ring-white/10">
            <button
              type="button"
              onClick={() => setDashboardMode('compact')}
              className={`relative rounded-full px-5 py-2 text-sm font-medium transition-colors ${
                dashboardMode === 'compact' ? 'text-white' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              {dashboardMode === 'compact' && (
                <motion.div
                  layoutId="mode-bg"
                  className="absolute inset-0 rounded-full bg-slate-900"
                  transition={{ type: "spring", bounce: 0.2, duration: 0.6 }}
                />
              )}
              <span className="relative z-10">Compact Dashboard</span>
            </button>
            <button
              type="button"
              onClick={() => setDashboardMode('analytical')}
              className={`relative rounded-full px-5 py-2 text-sm font-medium transition-colors ${
                dashboardMode === 'analytical' ? 'text-white' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              {dashboardMode === 'analytical' && (
                <motion.div
                  layoutId="mode-bg"
                  className="absolute inset-0 rounded-full bg-emerald-600 shadow-[0_4px_14px_0_rgba(5,150,105,0.39)]"
                  transition={{ type: "spring", bounce: 0.2, duration: 0.6 }}
                />
              )}
              <span className="relative z-10">Analytical Dashboard</span>
            </button>
          </div>
        </div>
      </section>

      <motion.section layout className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard
          title="Total monitors"
          value={insights.total}
          detail={`${insights.paused} paused / ${insights.impactMappedMonitors} mapped`}
          icon={Activity}
          accent="bg-sky-50 text-sky-600"
        />
        <StatCard
          title="Healthy services"
          value={insights.healthy}
          detail="Monitors currently responding normally"
          icon={CheckCircle}
          accent="bg-emerald-50 text-emerald-600"
        />
        <StatCard
          title="Need attention"
          value={insights.degraded + insights.down}
          detail={`${insights.degraded} degraded / ${insights.down} down`}
          icon={ShieldAlert}
          accent="bg-amber-50 text-amber-600"
        />
        <StatCard
          title="Open incidents"
          value={insights.activeIncidents.length}
          detail={`${insights.criticalIncidentCount} high-priority / ${activeWatchChanges.length} active watch windows`}
          icon={Siren}
          accent="bg-rose-50 text-rose-600"
        />
      </motion.section>

      <AnimatePresence mode="popLayout">
        {dashboardMode === 'analytical' ? (
        <motion.section
          initial={{ opacity: 0, height: 0, scale: 0.95, overflow: 'hidden' }}
          animate={{ opacity: 1, height: 'auto', scale: 1 }}
          exit={{ opacity: 0, height: 0, scale: 0.95 }}
          transition={{ duration: 0.4 }}
          className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4"
        >
          <StatCard
            title="Affected journeys"
            value={insights.affectedJourneys}
            detail={`${insights.affectedFeatures} features touched by live issues`}
            icon={TrendingUp}
            accent="bg-amber-50 text-amber-600"
          />
          <StatCard
            title="Impact coverage"
            value={`${insights.impactCoverage}%`}
            detail="Monitors carrying customer-impact metadata"
            icon={LayoutDashboard}
            accent="bg-sky-50 text-sky-600"
          />
          <StatCard
            title="Alerts in 24h"
            value={insights.alertsLast24h}
            detail={`${insights.activeIncidents.length} incidents still open`}
            icon={BellRing}
            accent="bg-violet-50 text-violet-600"
          />
          <StatCard
            title="Watch minutes"
            value={insights.activeWatchMinutes}
            detail="Total active deploy-watch time remaining"
            icon={Clock3}
            accent="bg-emerald-50 text-emerald-600"
          />
        </motion.section>
        ) : null}
      </AnimatePresence>

      <motion.div layout className="space-y-8 relative">
      <section className="grid grid-cols-1 gap-6 xl:grid-cols-[1.6fr_1fr]">
        <Panel
          title="Action Center"
          description="Monitors that need follow-up because they are down, degraded, or carrying an unresolved signal."
          icon={ShieldAlert}
          action={
            <Link
              to="/monitors"
              className="inline-flex items-center gap-2 rounded-full border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 transition hover:border-slate-300 hover:bg-slate-50"
            >
              Open monitors
              <ExternalLink className="h-4 w-4" />
            </Link>
          }
        >
          {insights.attentionMonitors.length === 0 ? (
            <EmptyState tone="emerald" message="No urgent action is required right now. Every active monitor is either healthy or cleanly paused." />
          ) : (
            <div className="space-y-3">
              {insights.attentionMonitors.slice(0, dashboardMode === 'analytical' ? 6 : 4).map((monitor) => (
                <Link
                  key={monitor.id}
                  to={`/monitors/${monitor.id}`}
                  className="block rounded-2xl border border-slate-200 p-4 transition hover:border-slate-300 hover:bg-slate-50"
                >
                  <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-semibold text-slate-900">{monitor.name}</p>
                        <span className={`rounded-full border px-2.5 py-1 text-xs font-semibold ${monitorTone(monitor.status)}`}>
                          {monitor.status}
                        </span>
                        <TypeBadge type={monitor.type} />
                      </div>
                      <p className="mt-2 truncate text-sm text-slate-500">{monitor.url}</p>
                      <p className="mt-3 text-sm text-slate-700">
                        {monitor.lastErrorMessage || monitor.latestAlert?.message || 'Health signal requires review.'}
                      </p>
                    </div>
                    <div className="grid gap-2 text-sm text-slate-500 sm:grid-cols-3 lg:min-w-[300px]">
                      <div>
                        <p className="text-xs uppercase tracking-wide text-slate-400">Response</p>
                        <p className="mt-1 font-semibold text-slate-900">{formatResponseTime(monitor.latestResponseTimeMs)}</p>
                      </div>
                      <div>
                        <p className="text-xs uppercase tracking-wide text-slate-400">Availability</p>
                        <p className="mt-1 font-semibold text-slate-900">{formatPercentage(monitor.uptimePercentage)}</p>
                      </div>
                      <div>
                        <p className="text-xs uppercase tracking-wide text-slate-400">Last checked</p>
                        <p className="mt-1 font-semibold text-slate-900">{formatRelativeTime(monitor.lastCheckedAt)}</p>
                      </div>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </Panel>

        <Panel
          title="Executive Snapshot"
          description="Short-form command view for uptime, incidents, and deploy timing."
          icon={TrendingUp}
        >
          <div className="grid gap-4">
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Fastest endpoint</p>
              <p className="mt-2 font-semibold text-slate-900">{insights.fastestMonitor?.name || 'No data yet'}</p>
              <p className="mt-1 text-sm text-slate-500">
                {insights.fastestMonitor ? formatResponseTime(insights.fastestMonitor.avgResponseTimeMs) : 'Waiting for successful checks'}
              </p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">High-impact issues</p>
              <p className="mt-2 text-2xl font-semibold text-slate-900">{insights.highImpactAttention.length}</p>
              <p className="mt-1 text-sm text-slate-500">
                {insights.affectedJourneys} journey{insights.affectedJourneys === 1 ? '' : 's'} currently exposed
              </p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Deploy watch</p>
              <p className="mt-2 text-2xl font-semibold text-slate-900">{activeWatchChanges.length}</p>
              <p className="mt-1 text-sm text-slate-500">
                {insights.activeWatchMinutes} minute{insights.activeWatchMinutes === 1 ? '' : 's'} of active watch time left
              </p>
            </div>
          </div>
        </Panel>
      </section>

      <AnimatePresence mode="wait">
      {dashboardMode === 'analytical' ? (
        <motion.section 
          key="analytical-view"
          initial={{ opacity: 0, scale: 0.98, y: 15 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.98, filter: 'blur(2px)', y: -10 }}
          transition={{ duration: 0.4, type: 'spring', bounce: 0, stiffness: 100 }}
          className="grid gap-6 xl:grid-cols-[1.6fr_1fr]"
        >
          <div className="space-y-6">
            <div className="rounded-2xl border border-slate-200 bg-gradient-to-br from-slate-950 via-slate-900 to-slate-800 p-6 text-white shadow-sm">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-200">Analytical Overview</p>
                  <h3 className="mt-2 text-2xl font-semibold">Full control room with large visuals and deeper context.</h3>
                  <p className="mt-2 max-w-2xl text-sm text-slate-300">
                    Analytical mode keeps the broader health story visible at once: impact, latency, ownership, regions, and live deploy watch.
                  </p>
                </div>
                <BarChart3 className="h-8 w-8 text-emerald-300" />
              </div>
            </div>
            <div className="min-h-[420px]">{renderPerformanceChartWidget()}</div>
            <div className="grid gap-6 xl:grid-cols-2">
              {renderCustomerImpactWidget()}
              {renderImpactCommandWidget()}
            </div>
            <div className="grid gap-6 xl:grid-cols-2">
              {renderLatencyBoardWidget()}
              {renderServiceMixWidget()}
            </div>
            <div className="grid gap-6 xl:grid-cols-2">
              {renderOwnershipRadarWidget()}
              {renderRegionalExposureWidget()}
            </div>
            <div className="grid gap-6 xl:grid-cols-2">
              {renderRecentAlertsWidget()}
              {renderDeployWatchWidget()}
            </div>
            {renderMonitorTableWidget()}
          </div>

          <div className="space-y-6">
            <Panel
              title="Analytical Stack"
              description="This mode intentionally shows the full operational picture without per-widget toggles."
              icon={Layers3}
            >
              <div className="space-y-3">
                {WIDGET_CATALOG.map((widget) => (
                  <div key={widget.id} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                    <p className="font-semibold text-slate-900">{widget.label}</p>
                    <p className="mt-2 text-sm text-slate-500">{widget.description}</p>
                  </div>
                ))}
              </div>
            </Panel>

            <Panel
              title="Why Analytical"
              description="Use this mode when you are triaging incidents, releases, or customer impact."
              icon={TrendingUp}
            >
              <div className="space-y-3 text-sm text-slate-600">
                <p>Large charts stay visible by default.</p>
                <p>Impact, ownership, and region views appear together.</p>
                <p>Deploy watch and alert streams stay nearby for faster correlation.</p>
              </div>
            </Panel>
          </div>
        </motion.section>
      ) : (
        <motion.section 
          key="compact-view"
          initial={{ opacity: 0, scale: 0.98, y: 15 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.98, filter: 'blur(2px)', y: -10 }}
          transition={{ duration: 0.4, type: 'spring', bounce: 0, stiffness: 100 }}
          className="grid gap-6 xl:grid-cols-[minmax(0,1.65fr)_360px]"
        >
          <div className="space-y-6">
            {compactRenderedWidgets.length === 0 ? (
              <Panel
                title="Compact Widget Area"
                description="Turn on any compact widget from the dock to personalize this shorter dashboard."
                icon={SlidersHorizontal}
              >
                <EmptyState message="No compact widgets are active right now. Use the dock on the right to choose the cards you want." />
              </Panel>
            ) : (
            <Reorder.Group axis="y" values={compactWidgets} onReorder={setCompactWidgets} className="space-y-6">
              <AnimatePresence mode="popLayout">
                {compactRenderedWidgets.map((widgetId) => (
                  <DraggableWidget key={widgetId} widgetId={widgetId}>
                    {renderWidgetById(widgetId)}
                  </DraggableWidget>
                ))}
              </AnimatePresence>
            </Reorder.Group>
            )}
          </div>

          <div className="space-y-6">
            <div className="xl:sticky xl:top-24">
              <Panel
                title="Compact Widget Dock"
                description="Choose what appears in compact mode, then drag active widgets to reorder them."
                icon={SlidersHorizontal}
                action={
                  <button
                    type="button"
                    onClick={() => applyWidgetPreset('compact')}
                    className="rounded-full border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-slate-50"
                  >
                    Restore defaults
                  </button>
                }
              >
                <div className="space-y-4">
                  <div className="flex rounded-full bg-slate-100/80 p-1 backdrop-blur shadow-inner">
                    <button
                      type="button"
                      onClick={() => setDockTab('pinned')}
                      className={`relative flex-1 rounded-full px-5 py-2 text-sm font-medium transition-colors ${
                        dockTab === 'pinned' ? 'text-white' : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      {dockTab === 'pinned' && (
                        <motion.div
                          layoutId="dockTab-bg"
                          className="absolute inset-0 rounded-full bg-slate-900"
                          transition={{ type: "spring", bounce: 0.2, duration: 0.6 }}
                        />
                      )}
                      <span className="relative z-10 block text-center">Pinned Widgets</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setDockTab('library')}
                      className={`relative flex-1 rounded-full px-5 py-2 text-sm font-medium transition-colors ${
                        dockTab === 'library' ? 'text-white' : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      {dockTab === 'library' && (
                        <motion.div
                          layoutId="dockTab-bg"
                          className="absolute inset-0 rounded-full bg-emerald-600 shadow-[0_4px_14px_0_rgba(5,150,105,0.39)]"
                          transition={{ type: "spring", bounce: 0.2, duration: 0.6 }}
                        />
                      )}
                      <span className="relative z-10 block text-center">Widget Library</span>
                    </button>
                  </div>

                  <div className="relative pt-2">
                    <AnimatePresence mode="wait">
                      {dockTab === 'pinned' ? (
                        <motion.div
                          key="pinned-tab"
                          initial={{ opacity: 0, x: -10 }}
                          animate={{ opacity: 1, x: 0 }}
                          exit={{ opacity: 0, x: -10 }}
                          transition={{ duration: 0.2 }}
                        >
                          {compactRenderedWidgets.length === 0 ? (
                            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-6 text-center shadow-inner">
                              <SlidersHorizontal className="mx-auto mb-3 h-6 w-6 text-slate-400" />
                              <p className="text-sm font-medium text-slate-600">No widgets pinned.</p>
                              <p className="mt-1 text-xs text-slate-500">Open the Library to add your favorites.</p>
                            </div>
                          ) : (
                            <Reorder.Group axis="y" values={compactRenderedWidgets} onReorder={setCompactWidgets} className="space-y-2">
                              {compactRenderedWidgets.map((widgetId, index) => {
                                const widget = WIDGET_CATALOG.find((item) => item.id === widgetId);
                                if (!widget) return null;

                                return (
                                  <Reorder.Item
                                    key={widget.id}
                                    value={widget.id}
                                    whileDrag={{ scale: 1.03, boxShadow: "0 10px 25px -5px rgba(0, 0, 0, 0.1)" }}
                                    className="cursor-grab active:cursor-grabbing rounded-2xl border border-slate-200/60 bg-white/70 backdrop-blur-md p-4 transition-all hover:bg-slate-50"
                                  >
                                    <div className="pointer-events-none flex items-start gap-4">
                                      <div className="mt-1 text-slate-400 transition-colors">
                                        <GripVertical className="h-5 w-5" />
                                      </div>
                                      <div className="min-w-0 flex-1">
                                        <div className="flex items-center justify-between gap-3">
                                          <p className="font-semibold text-slate-900">{widget.label}</p>
                                          <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-bold uppercase text-slate-500 shadow-sm border border-slate-200">
                                            {index + 1}
                                          </span>
                                        </div>
                                        <p className="mt-1 text-sm text-slate-500 line-clamp-2">{widget.description}</p>
                                      </div>
                                    </div>
                                  </Reorder.Item>
                                );
                              })}
                            </Reorder.Group>
                          )}
                        </motion.div>
                      ) : (
                        <motion.div
                          key="library-tab"
                          initial={{ opacity: 0, x: 10 }}
                          animate={{ opacity: 1, x: 0 }}
                          exit={{ opacity: 0, x: 10 }}
                          transition={{ duration: 0.2 }}
                          className="space-y-2"
                        >
                          {WIDGET_CATALOG.map((widget) => {
                            const active = compactWidgetSet.has(widget.id);
                            return (
                              <div key={widget.id} className={`rounded-2xl border p-4 transition-all duration-300 ${active ? 'border-slate-900 bg-slate-900 text-white shadow-lg' : 'border-slate-200/60 bg-white/70 backdrop-blur-md text-slate-700 hover:border-slate-300 hover:shadow-sm'}`}>
                                <div className="flex items-start justify-between gap-3">
                                  <div className="min-w-0">
                                    <p className="font-semibold">{widget.label}</p>
                                    <p className={`mt-1 text-xs sm:text-sm ${active ? 'text-slate-300' : 'text-slate-500'}`}>{widget.description}</p>
                                  </div>
                                  <button
                                    type="button"
                                    onClick={() => toggleWidget(widget.id)}
                                    className={`rounded-full px-3 py-1.5 text-[10px] sm:text-xs font-bold uppercase transition ${
                                      active ? 'bg-white/10 text-white hover:bg-white/20' : 'bg-white text-slate-600 border border-slate-200 shadow-sm hover:bg-slate-50 hover:text-slate-900'
                                    }`}
                                  >
                                    {active ? 'Remove' : 'Add'}
                                  </button>
                                </div>
                              </div>
                            );
                          })}
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                </div>
              </Panel>
            </div>
          </div>
        </motion.section>
      )}
      </AnimatePresence>
      </motion.div>
    </div>
  );
}
