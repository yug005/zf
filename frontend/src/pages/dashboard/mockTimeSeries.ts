/**
 * Generate realistic time-series mock data for all analytical charts.
 * Every function is deterministic per seed for consistent renders.
 */

function seededRandom(seed: number) {
  let s = seed;
  return () => {
    s = (s * 16807 + 0) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

/* ── Multi-layer graph data ──────────────────────────── */
export interface TimeSeriesPoint {
  time: string;        // e.g. "14:30"
  timestamp: number;
  latency: number;     // ms
  errorRate: number;   // percentage 0-100
  requestVolume: number;
  p95: number;
  successRate: number;
  throughput: number;  // req/s
  isSpike?: boolean;
}

export function generateTimeSeries(hours = 24, intervalMin = 15): TimeSeriesPoint[] {
  const rng = seededRandom(42);
  const points: TimeSeriesPoint[] = [];
  const now = Date.now();
  const totalPoints = Math.floor((hours * 60) / intervalMin);

  for (let i = 0; i < totalPoints; i++) {
    const t = now - (totalPoints - i) * intervalMin * 60_000;
    const hour = new Date(t).getHours();
    const isBusinessHours = hour >= 8 && hour <= 20;

    // Base latency with daily pattern
    const baseLatency = isBusinessHours ? 120 + rng() * 80 : 60 + rng() * 40;
    // Occasional spikes
    const spikeChance = rng();
    const isSpike = spikeChance > 0.96;
    const spikeMult = isSpike ? 2.5 + rng() * 3 : 1;
    const latency = Math.round(baseLatency * spikeMult);

    // Error rate correlates with spikes
    const baseError = isSpike ? 5 + rng() * 15 : 0.1 + rng() * 1.5;
    const errorRate = Math.round(baseError * 100) / 100;

    // Request volume follows business hours
    const baseVolume = isBusinessHours ? 800 + rng() * 1200 : 200 + rng() * 400;
    const requestVolume = Math.round(baseVolume);

    const p95 = Math.round(latency * (1.3 + rng() * 0.5));
    const successRate = Math.round((100 - errorRate) * 100) / 100;
    const throughput = Math.round(requestVolume / (intervalMin * 60) * 10) / 10;

    const d = new Date(t);
    const time = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;

    points.push({ time, timestamp: t, latency, errorRate, requestVolume, p95, successRate, throughput, isSpike });
  }
  return points;
}

/* ── Comparison data (previous period) ───────────────── */
export function generateComparisonSeries(hours = 24, intervalMin = 15): TimeSeriesPoint[] {
  const rng = seededRandom(99);
  const points: TimeSeriesPoint[] = [];
  const now = Date.now();
  const totalPoints = Math.floor((hours * 60) / intervalMin);

  for (let i = 0; i < totalPoints; i++) {
    const t = now - (totalPoints - i) * intervalMin * 60_000;
    const hour = new Date(t).getHours();
    const isBusinessHours = hour >= 8 && hour <= 20;
    const baseLatency = isBusinessHours ? 140 + rng() * 60 : 70 + rng() * 30;
    const latency = Math.round(baseLatency);
    const errorRate = Math.round((0.2 + rng() * 2) * 100) / 100;
    const requestVolume = Math.round(isBusinessHours ? 700 + rng() * 1000 : 180 + rng() * 350);
    const p95 = Math.round(latency * (1.3 + rng() * 0.5));
    const successRate = Math.round((100 - errorRate) * 100) / 100;
    const throughput = Math.round(requestVolume / (intervalMin * 60) * 10) / 10;
    const d = new Date(t);
    const time = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
    points.push({ time, timestamp: t, latency, errorRate, requestVolume, p95, successRate, throughput });
  }
  return points;
}

/* ── Mini sparkline data ─────────────────────────────── */
export interface SparklineData {
  key: string;
  label: string;
  value: string;
  change: number; // percentage
  data: number[];
  unit: string;
  color: string;
}

export function generateSparklines(series: TimeSeriesPoint[]): SparklineData[] {
  const last = series.slice(-24);
  const prev = series.slice(-48, -24);

  const avgLatency = Math.round(last.reduce((s, p) => s + p.latency, 0) / last.length);
  const prevAvgLatency = prev.length ? Math.round(prev.reduce((s, p) => s + p.latency, 0) / prev.length) : avgLatency;

  const avgError = Math.round(last.reduce((s, p) => s + p.errorRate, 0) / last.length * 100) / 100;
  const prevAvgError = prev.length ? Math.round(prev.reduce((s, p) => s + p.errorRate, 0) / prev.length * 100) / 100 : avgError;

  const avgThroughput = Math.round(last.reduce((s, p) => s + p.throughput, 0) / last.length * 10) / 10;
  const prevAvgThroughput = prev.length ? Math.round(prev.reduce((s, p) => s + p.throughput, 0) / prev.length * 10) / 10 : avgThroughput;

  const avgSuccess = Math.round(last.reduce((s, p) => s + p.successRate, 0) / last.length * 100) / 100;
  const prevAvgSuccess = prev.length ? Math.round(prev.reduce((s, p) => s + p.successRate, 0) / prev.length * 100) / 100 : avgSuccess;

  const avgP95 = Math.round(last.reduce((s, p) => s + p.p95, 0) / last.length);
  const prevAvgP95 = prev.length ? Math.round(prev.reduce((s, p) => s + p.p95, 0) / prev.length) : avgP95;

  const avgVolume = Math.round(last.reduce((s, p) => s + p.requestVolume, 0) / last.length);
  const prevAvgVolume = prev.length ? Math.round(prev.reduce((s, p) => s + p.requestVolume, 0) / prev.length) : avgVolume;

  const pctChange = (cur: number, prev: number) => prev === 0 ? 0 : Math.round(((cur - prev) / prev) * 1000) / 10;

  return [
    { key: 'latency', label: 'Avg Latency', value: `${avgLatency}ms`, change: pctChange(avgLatency, prevAvgLatency), data: last.map(p => p.latency), unit: 'ms', color: '#2dd4bf' },
    { key: 'errorRate', label: 'Error Rate', value: `${avgError}%`, change: pctChange(avgError, prevAvgError), data: last.map(p => p.errorRate), unit: '%', color: '#f87171' },
    { key: 'throughput', label: 'Throughput', value: `${avgThroughput}/s`, change: pctChange(avgThroughput, prevAvgThroughput), data: last.map(p => p.throughput), unit: 'req/s', color: '#818cf8' },
    { key: 'successRate', label: 'Success Rate', value: `${avgSuccess}%`, change: pctChange(avgSuccess, prevAvgSuccess), data: last.map(p => p.successRate), unit: '%', color: '#10b981' },
    { key: 'p95', label: 'P95 Latency', value: `${avgP95}ms`, change: pctChange(avgP95, prevAvgP95), data: last.map(p => p.p95), unit: 'ms', color: '#f59e0b' },
    { key: 'volume', label: 'Req Volume', value: `${avgVolume}`, change: pctChange(avgVolume, prevAvgVolume), data: last.map(p => p.requestVolume), unit: 'req', color: '#a78bfa' },
  ];
}

/* ── Heatmap data ────────────────────────────────────── */
export interface HeatmapCell {
  service: string;
  hour: number;
  hourLabel: string;
  health: number; // 0-1, 0=failure, 1=healthy
  latency: number;
  errors: number;
}

export function generateHeatmap(serviceNames: string[]): HeatmapCell[] {
  const rng = seededRandom(77);
  const cells: HeatmapCell[] = [];

  for (const service of serviceNames) {
    // Each service has a base health tendency
    const baseHealth = 0.7 + rng() * 0.3;
    for (let h = 0; h < 24; h++) {
      const hourVariance = Math.sin((h - 14) * 0.3) * 0.15; // worse around 2pm
      let health = Math.min(1, Math.max(0, baseHealth + hourVariance + (rng() - 0.5) * 0.3));
      // Some services have problems at specific hours
      if (service === 'Payment Gateway' && h >= 10 && h <= 14) health = Math.max(0, health - 0.4);
      if (service === 'Status Page CDN' && h >= 12 && h <= 16) health = Math.max(0, health - 0.25);

      cells.push({
        service,
        hour: h,
        hourLabel: `${String(h).padStart(2, '0')}:00`,
        health: Math.round(health * 100) / 100,
        latency: Math.round((1 - health) * 800 + 50),
        errors: Math.round((1 - health) * 20),
      });
    }
  }
  return cells;
}

/* ── Incident timeline data ──────────────────────────── */
export interface TimelineEvent {
  id: string;
  time: number;
  timeLabel: string;
  type: 'incident' | 'spike' | 'deploy' | 'recovery';
  severity: 'critical' | 'high' | 'medium' | 'low';
  title: string;
  description: string;
  service: string;
  duration?: number; // minutes
}

export function generateTimeline(): TimelineEvent[] {
  const now = Date.now();
  return [
    { id: 'ev1', time: now - 3 * 3600_000, timeLabel: '3h ago', type: 'incident', severity: 'critical', title: 'Payment Gateway DOWN', description: 'HTTP 503 — Connection refused on billing-service', service: 'Payment Gateway', duration: 45 },
    { id: 'ev2', time: now - 5 * 3600_000, timeLabel: '5h ago', type: 'deploy', severity: 'low', title: 'billing-service v3.2.1', description: 'Deployed via GitHub Actions', service: 'Billing' },
    { id: 'ev3', time: now - 8 * 3600_000, timeLabel: '8h ago', type: 'spike', severity: 'high', title: 'Latency spike on CDN', description: 'P95 latency exceeded 2000ms for 12 minutes', service: 'Status Page CDN', duration: 12 },
    { id: 'ev4', time: now - 10 * 3600_000, timeLabel: '10h ago', type: 'recovery', severity: 'low', title: 'Email Service recovered', description: 'Timeout resolved after 2 retries', service: 'Email Service' },
    { id: 'ev5', time: now - 14 * 3600_000, timeLabel: '14h ago', type: 'deploy', severity: 'low', title: 'frontend v2.8.0', description: 'Deployed via Vercel', service: 'Frontend' },
    { id: 'ev6', time: now - 18 * 3600_000, timeLabel: '18h ago', type: 'spike', severity: 'medium', title: 'DB connection pool saturated', description: 'Max connections reached briefly', service: 'Database Primary', duration: 5 },
    { id: 'ev7', time: now - 22 * 3600_000, timeLabel: '22h ago', type: 'incident', severity: 'medium', title: 'DNS propagation delay', description: 'Certificate renewal caused brief resolution failure', service: 'DNS Resolution', duration: 8 },
  ];
}

/* ── Distribution buckets ───────────────────────────── */
export interface DistributionBucket {
  range: string;
  count: number;
  percentage: number;
  quality: 'excellent' | 'good' | 'acceptable' | 'poor' | 'critical';
}

export function generateDistribution(series: TimeSeriesPoint[]): DistributionBucket[] {
  const buckets = { '0–50ms': 0, '50–100ms': 0, '100–200ms': 0, '200–500ms': 0, '500ms–1s': 0, '>1s': 0 };
  const qualities: Record<string, DistributionBucket['quality']> = {
    '0–50ms': 'excellent', '50–100ms': 'good', '100–200ms': 'acceptable',
    '200–500ms': 'poor', '500ms–1s': 'critical', '>1s': 'critical',
  };
  for (const p of series) {
    if (p.latency <= 50) buckets['0–50ms']++;
    else if (p.latency <= 100) buckets['50–100ms']++;
    else if (p.latency <= 200) buckets['100–200ms']++;
    else if (p.latency <= 500) buckets['200–500ms']++;
    else if (p.latency <= 1000) buckets['500ms–1s']++;
    else buckets['>1s']++;
  }
  const total = series.length || 1;
  return Object.entries(buckets).map(([range, count]) => ({
    range, count, percentage: Math.round((count / total) * 1000) / 10, quality: qualities[range],
  }));
}
