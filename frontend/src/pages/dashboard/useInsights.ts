import { useMemo } from 'react';
import type { Monitor, Alert, Incident, ActiveWatchChange, DashboardInsights } from './types';

export function useDashboardInsights(
  monitors: Monitor[],
  alerts: Alert[],
  incidents: Incident[],
  activeWatchChanges: ActiveWatchChange[],
): DashboardInsights {
  return useMemo(() => {
    const now = Date.now();
    const healthyMonitors = monitors.filter((m) => m.status === 'UP');
    const degradedMonitors = monitors.filter((m) => m.status === 'DEGRADED');
    const downMonitors = monitors.filter((m) => m.status === 'DOWN');
    const pausedMonitors = monitors.filter((m) => m.status === 'PAUSED');
    const attentionMonitors = monitors.filter(
      (m) => m.status === 'DOWN' || m.status === 'DEGRADED' || Boolean(m.hasActiveAlert),
    );

    const responseSamples = monitors
      .map((m) => m.avgResponseTimeMs)
      .filter((v): v is number => typeof v === 'number' && v > 0);
    const availabilitySamples = monitors
      .map((m) => m.uptimePercentage)
      .filter((v): v is number => typeof v === 'number');

    const avgResponseTimeMs = responseSamples.length
      ? Math.round(responseSamples.reduce((a, b) => a + b, 0) / responseSamples.length)
      : null;
    const fleetAvailability = availabilitySamples.length
      ? Number((availabilitySamples.reduce((a, b) => a + b, 0) / availabilitySamples.length).toFixed(1))
      : null;

    const monitorsByResponse = [...monitors]
      .filter((m) => typeof m.avgResponseTimeMs === 'number' && m.avgResponseTimeMs > 0)
      .sort((a, b) => (a.avgResponseTimeMs ?? 0) - (b.avgResponseTimeMs ?? 0));

    const highImpactAttention = attentionMonitors.filter((m) => {
      const c = m.impactMetadata?.businessCriticality;
      return c === 'HIGH' || c === 'CRITICAL';
    });

    const impactMappedMonitors = monitors.filter(
      (m) => Boolean(m.impactMetadata?.serviceName || m.impactMetadata?.featureName || m.impactMetadata?.customerJourney),
    );

    const affectedJourneys = new Set(
      attentionMonitors.map((m) => m.impactMetadata?.customerJourney).filter(Boolean),
    ).size;
    const affectedFeatures = new Set(
      attentionMonitors.map((m) => m.impactMetadata?.featureName).filter(Boolean),
    ).size;

    const openIncidents = incidents.filter((i) => i.status !== 'RESOLVED');
    const alertsLast24h = alerts.filter((a) => now - new Date(a.createdAt).getTime() <= 86_400_000).length;
    const criticalIncidentCount = openIncidents.filter(
      (i) => i.severity === 'CRITICAL' || i.severity === 'HIGH',
    ).length;
    const activeWatchMinutes = activeWatchChanges.reduce((t, c) => t + (c.watchMinutesRemaining ?? 0), 0);

    const typeDistribution = (['HTTP', 'TCP', 'DNS', 'SSL'] as const).map((type) => ({
      type, total: monitors.filter((m) => m.type === type).length,
    }));
    const statusDistribution = [
      { label: 'Up', total: healthyMonitors.length, tone: 'bg-emerald-500' },
      { label: 'Down', total: downMonitors.length, tone: 'bg-rose-500' },
      { label: 'Degraded', total: degradedMonitors.length, tone: 'bg-amber-500' },
      { label: 'Paused', total: pausedMonitors.length, tone: 'bg-slate-400' },
    ];

    const ownerExposure = Object.entries(
      attentionMonitors.reduce<Record<string, number>>((acc, m) => {
        const o = m.impactMetadata?.teamOwner || 'Unassigned';
        acc[o] = (acc[o] || 0) + 1;
        return acc;
      }, {}),
    ).map(([owner, total]) => ({ owner, total })).sort((a, b) => b.total - a.total);

    const regionExposure = Object.entries(
      attentionMonitors.reduce<Record<string, number>>((acc, m) => {
        const r = m.impactMetadata?.region || 'Global';
        acc[r] = (acc[r] || 0) + 1;
        return acc;
      }, {}),
    ).map(([region, total]) => ({ region, total })).sort((a, b) => b.total - a.total);

    const slaPressure = Object.entries(
      attentionMonitors.reduce<Record<string, number>>((acc, m) => {
        const t = m.impactMetadata?.slaTier || 'STANDARD';
        acc[t] = (acc[t] || 0) + 1;
        return acc;
      }, {}),
    ).map(([tier, total]) => ({ tier, total })).sort((a, b) => b.total - a.total);

    const topImpactIncidents = [...openIncidents].sort((a, b) => b.impactScore - a.impactScore);

    // Health score: 100-based, penalized for down/degraded/incidents
    const downPenalty = downMonitors.length * 15;
    const degradedPenalty = degradedMonitors.length * 5;
    const incidentPenalty = criticalIncidentCount * 10 + (openIncidents.length - criticalIncidentCount) * 3;
    const healthScore = monitors.length === 0 ? 100 : Math.max(0, Math.min(100, 100 - downPenalty - degradedPenalty - incidentPenalty));

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
      affectedJourneys,
      affectedFeatures,
      impactCoverage: monitors.length ? Number(((impactMappedMonitors.length / monitors.length) * 100).toFixed(0)) : 0,
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
      healthScore,
    };
  }, [monitors, alerts, incidents, activeWatchChanges]);
}
