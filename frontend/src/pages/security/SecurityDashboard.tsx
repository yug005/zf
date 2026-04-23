import { useQuery } from '@tanstack/react-query';
import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  Shield, Plus, ArrowRight, Clock, Scan as ScanIcon,
  CheckCircle,
} from 'lucide-react';
import { securityApi } from '../../services/security';
import type { SecurityTarget } from '../../services/security';
import { RiskScoreGauge } from '../../components/security/ui/RiskScoreGauge';
import { SecurityEmptyState } from '../../components/security/ui/SecurityEmptyState';
import { SeverityMixChart } from '../../components/security/charts/SeverityMixChart';
import { VerificationStatus } from '../../components/security/verification/VerificationStatus';
import { scanStateColors, verificationColors, securityCard, securityCardHover } from '../../components/security/tokens';
import { PageMeta } from '../../components/PageMeta';

export default function SecurityDashboard() {
  const navigate = useNavigate();

  const { data: targets, isLoading: targetsLoading } = useQuery({
    queryKey: ['security-targets'],
    queryFn: securityApi.listTargets,
  });

  const { data: entitlement } = useQuery({
    queryKey: ['security-entitlement'],
    queryFn: securityApi.getEntitlement,
  });

  // Find the most recent completed scan across all targets
  const latestScan = targets
    ?.flatMap((t) => t.scans || [])
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .find((s) => s.status === 'COMPLETED');

  const hasTargets = (targets?.length || 0) > 0;

  if (targetsLoading) {
    return <DashboardSkeleton />;
  }

  return (
    <div className="space-y-6">
      <PageMeta
        title="Security | Zer0Friction"
        description="API security scanning dashboard — risk posture, findings, and scan management."
        noIndex
      />

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-cyan-300/70">
            Security Command Center
          </p>
          <h2 className="mt-1 text-xl font-semibold text-white">Threat Intelligence</h2>
        </div>
        <button
          onClick={() => navigate('/security/onboard')}
          className="inline-flex items-center gap-2 rounded-2xl bg-gradient-to-r from-cyan-400 to-emerald-400 px-5 py-3 text-sm font-semibold text-slate-950 transition hover:opacity-90 shadow-[0_8px_30px_rgba(34,211,238,0.25)]"
        >
          <Plus className="h-4 w-4" />
          {hasTargets ? 'Add Target' : 'Start First Scan'}
        </button>
      </div>

      {!hasTargets ? (
        <SecurityEmptyState
          type="no-targets"
          action={
            <button
              onClick={() => navigate('/security/onboard')}
              className="inline-flex items-center gap-2 rounded-2xl bg-gradient-to-r from-cyan-400 to-emerald-400 px-6 py-3 text-sm font-semibold text-slate-950 transition hover:opacity-90"
            >
              <ScanIcon className="h-4 w-4" /> Add Your First Target
            </button>
          }
        />
      ) : (
        <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
          {/* ─── Left Column: Risk Posture ─── */}
          <div className="space-y-6 xl:col-span-2">
            {/* Risk Score Card */}
            {latestScan && latestScan.score !== undefined && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className={`${securityCard} relative overflow-hidden p-6`}
              >
                <div className="absolute top-0 right-0 w-64 h-64 bg-gradient-to-bl from-cyan-500/8 to-transparent rounded-full blur-2xl" />
                <div className="flex items-center gap-8 relative">
                  <RiskScoreGauge
                    score={latestScan.score}
                    riskLevel={latestScan.riskLevel || 'SECURE'}
                    size="lg"
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-slate-500 mb-2">
                      Latest Assessment
                    </p>
                    <p className="text-sm text-slate-300 leading-relaxed">{latestScan.summary || 'Scan completed.'}</p>
                    {latestScan.severityCounts && (
                      <div className="mt-4">
                        <SeverityMixChart data={latestScan.severityCounts as any} />
                      </div>
                    )}
                  </div>
                </div>
              </motion.div>
            )}

            {/* Targets List */}
            <div>
              <h3 className="mb-3 text-[10px] font-bold uppercase tracking-[0.3em] text-slate-500">
                Security Targets ({targets?.length || 0})
              </h3>
              <div className="space-y-3">
                {targets?.map((target, i) => (
                  <TargetRow key={target.id} target={target} index={i} />
                ))}
              </div>
            </div>
          </div>

          {/* ─── Right Column: Activity & Entitlement ─── */}
          <div className="space-y-6">
            {/* Entitlement Card */}
            {entitlement && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
                className={`${securityCard} p-5`}
              >
                <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-slate-500 mb-3">
                  Security Plan
                </p>
                <p className="text-lg font-bold text-white">{entitlement.plan}</p>
                <div className="mt-3 space-y-2">
                  <EntitlementRow label="Free Scans" value={`${entitlement.freeScanRemaining} remaining`} />
                  <EntitlementRow label="Targets" value={`${entitlement.currentTargets} / ${entitlement.maxTargets}`} />
                  <EntitlementRow label="Advanced" value={entitlement.capabilities.advancedScan ? 'Enabled' : 'Upgrade'} />
                  <EntitlementRow label="Recurring" value={entitlement.capabilities.standardRecurring ? 'Enabled' : 'Upgrade'} />
                </div>
                {entitlement.plan === 'FREE' && (
                  <Link
                    to="/security/pricing"
                    className="mt-4 block w-full rounded-xl border border-cyan-400/20 bg-cyan-400/10 px-4 py-2.5 text-center text-xs font-semibold text-cyan-300 transition hover:bg-cyan-400/15"
                  >
                    Upgrade Security Plan
                  </Link>
                )}
              </motion.div>
            )}

            {/* Recent Scans */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              className={`${securityCard} p-5`}
            >
              <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-slate-500 mb-3">
                Recent Scans
              </p>
              <div className="space-y-2">
                {targets?.flatMap((t) =>
                  (t.scans || []).map((s) => ({ ...s, targetName: t.name }))
                )
                  .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
                  .slice(0, 5)
                  .map((scan) => {
                    const state = scanStateColors[scan.status] || scanStateColors.QUEUED;
                    return (
                      <button
                        key={scan.id}
                        onClick={() => scan.status === 'COMPLETED' && navigate(`/security/scans/${scan.id}/report`)}
                        className="flex w-full items-center gap-3 rounded-xl border border-white/6 bg-white/[0.02] px-3 py-2.5 text-left transition hover:bg-white/[0.04]"
                      >
                        <span className={`flex h-8 w-8 items-center justify-center rounded-lg ${state.bg}`}>
                          {scan.status === 'COMPLETED' ? (
                            <CheckCircle className={`h-4 w-4 ${state.text}`} />
                          ) : scan.status === 'RUNNING' ? (
                            <motion.div animate={{ rotate: 360 }} transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}>
                              <ScanIcon className={`h-4 w-4 ${state.text}`} />
                            </motion.div>
                          ) : (
                            <Clock className={`h-4 w-4 ${state.text}`} />
                          )}
                        </span>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-semibold text-white truncate">{(scan as any).targetName}</p>
                          <p className="text-[10px] text-slate-500">{state.label} · {scan.tier}</p>
                        </div>
                        {scan.score !== undefined && scan.score !== null && (
                          <span className="text-xs font-bold text-slate-300 tabular-nums">{Math.round(scan.score)}</span>
                        )}
                      </button>
                    );
                  })}
                </div>
                {(targets?.flatMap(t => t.scans || []).length || 0) === 0 && (
                  <p className="text-xs text-slate-600 text-center py-4">No scans yet</p>
                )}
            </motion.div>
          </div>
        </div>
      )}
    </div>
  );
}

function TargetRow({ target, index }: { target: SecurityTarget; index: number }) {
  const navigate = useNavigate();
  const vColors = verificationColors[target.verificationState] || verificationColors.UNVERIFIED;
  const latestScan = target.scans?.[0];

  return (
    <motion.button
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: index * 0.06 }}
      onClick={() => navigate(`/security/targets/${target.id}/configure`)}
      className={`${securityCard} ${securityCardHover} flex w-full items-center gap-4 p-4 text-left`}
    >
      <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl ${vColors.bg}`}>
        <Shield className={`h-5 w-5 ${vColors.text}`} />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-white truncate">{target.name}</p>
        <p className="text-xs text-slate-500 font-mono truncate">{target.baseUrl}</p>
      </div>
      <div className="flex items-center gap-3 shrink-0">
        <VerificationStatus state={target.verificationState} baseUrl={target.baseUrl} compact />
        {latestScan?.score !== undefined && latestScan?.score !== null && (
          <span className="text-sm font-bold text-slate-300 tabular-nums">{Math.round(latestScan.score)}</span>
        )}
        <ArrowRight className="h-4 w-4 text-slate-600" />
      </div>
    </motion.button>
  );
}

function EntitlementRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-xs text-slate-500">{label}</span>
      <span className="text-xs font-semibold text-slate-300">{value}</span>
    </div>
  );
}

function DashboardSkeleton() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <div className="h-3 w-40 animate-pulse rounded bg-white/10" />
          <div className="mt-2 h-6 w-48 animate-pulse rounded bg-white/10" />
        </div>
        <div className="h-11 w-36 animate-pulse rounded-2xl bg-white/10" />
      </div>
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        <div className="xl:col-span-2 space-y-6">
          <div className={`${securityCard} h-72 animate-pulse`} />
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className={`${securityCard} h-20 animate-pulse`} />
            ))}
          </div>
        </div>
        <div className="space-y-6">
          <div className={`${securityCard} h-48 animate-pulse`} />
          <div className={`${securityCard} h-64 animate-pulse`} />
        </div>
      </div>
    </div>
  );
}
