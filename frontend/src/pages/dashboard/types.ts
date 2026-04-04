export interface MonitorAlertSummary {
  id: string;
  channel: string;
  status: 'TRIGGERED' | 'ACKNOWLEDGED' | 'RESOLVED';
  message: string;
  createdAt: string;
  resolvedAt?: string | null;
}

export interface Monitor {
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

export interface Alert {
  id: string;
  monitorId: string;
  message: string;
  status: 'TRIGGERED' | 'ACKNOWLEDGED' | 'RESOLVED';
  createdAt: string;
  resolvedAt?: string | null;
  monitor: { name: string };
}

export interface Incident {
  id: string;
  status: 'INVESTIGATING' | 'IDENTIFIED' | 'RESOLVED';
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  impactScore: number;
  message: string;
  createdAt: string;
  likelyTrigger?: { id: string; title: string; type: string; source: string; confidence: number } | null;
  impactSummary: { featureName?: string | null; customerJourney?: string | null; teamOwner?: string | null };
  monitor: { id: string; name: string };
}

export interface ActiveWatchChange {
  id: string;
  title: string;
  type: string;
  source: string;
  happenedAt: string;
  watchUntil?: string | null;
  watchMinutesRemaining?: number;
  serviceName?: string | null;
  monitor?: { id: string; name: string } | null;
}

export type DashboardMode = 'compact' | 'analytical';
export type TimeRange = '5m' | '1h' | '24h' | '7d';

export interface DashboardInsights {
  total: number;
  healthy: number;
  degraded: number;
  down: number;
  paused: number;
  attentionMonitors: Monitor[];
  avgResponseTimeMs: number | null;
  fleetAvailability: number | null;
  activeIncidents: Incident[];
  highImpactAttention: Monitor[];
  affectedJourneys: number;
  affectedFeatures: number;
  impactCoverage: number;
  impactMappedMonitors: number;
  fastestMonitor: Monitor | null;
  slowestMonitors: Monitor[];
  fastestMonitors: Monitor[];
  alertsLast24h: number;
  criticalIncidentCount: number;
  activeWatchMinutes: number;
  typeDistribution: Array<{ type: string; total: number }>;
  statusDistribution: Array<{ label: string; total: number; tone: string }>;
  ownerExposure: Array<{ owner: string; total: number }>;
  regionExposure: Array<{ region: string; total: number }>;
  slaPressure: Array<{ tier: string; total: number }>;
  topImpactIncidents: Incident[];
  healthScore: number;
}

export const formatResponseTime = (value?: number | null) => {
  if (typeof value !== 'number' || value <= 0) return 'N/A';
  return `${value}ms`;
};

export const formatPercentage = (value?: number | null) => {
  if (typeof value !== 'number') return 'N/A';
  return `${value.toFixed(1)}%`;
};

export const formatRelativeTime = (value?: string | null) => {
  if (!value) return 'Never';
  const diff = Date.now() - new Date(value).getTime();
  if (diff < 60_000) return 'Just now';
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`;
  return `${Math.floor(diff / 86_400_000)}d ago`;
};
