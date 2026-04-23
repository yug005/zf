import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Clock, ArrowRight, CheckCircle, AlertTriangle } from 'lucide-react';
import { securityApi } from '../../services/security';
import { ScoreTrendChart } from '../../components/security/charts/ScoreTrendChart';
import { securityCard, scanStateColors } from '../../components/security/tokens';
import { PageMeta } from '../../components/PageMeta';

export default function ScanHistory() {
  const navigate = useNavigate();

  const { data: targets, isLoading } = useQuery({
    queryKey: ['security-targets'],
    queryFn: securityApi.listTargets,
  });

  const allScans = targets
    ?.flatMap((t) =>
      (t.scans || []).map((s) => ({ ...s, targetName: t.name, targetId: t.id }))
    )
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()) || [];

  const completedScans = allScans.filter((s) => s.status === 'COMPLETED');

  return (
    <div className="space-y-6">
      <PageMeta title="Scan History | Security | Zer0Friction" description="View all past security scans." noIndex />

      <div>
        <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-cyan-300/70">Security</p>
        <h2 className="mt-1 text-xl font-semibold text-white">Scan History</h2>
      </div>

      {/* Trend Chart */}
      {completedScans.length >= 2 && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className={`${securityCard} p-5`}
        >
          <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-500 mb-3">Score Trend</p>
          <ScoreTrendChart scans={completedScans as any} />
        </motion.div>
      )}

      {/* Scan List */}
      <div className="space-y-2">
        {isLoading ? (
          Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className={`${securityCard} h-16 animate-pulse`} />
          ))
        ) : allScans.length === 0 ? (
          <div className="py-10 text-center text-sm text-slate-500">No scans yet. Add a target to get started.</div>
        ) : (
          allScans.map((scan, i) => {
            const state = scanStateColors[scan.status] || scanStateColors.QUEUED;
            return (
              <motion.button
                key={scan.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.03 }}
                onClick={() => navigate(`/security/scans/${scan.id}/report`)}
                className={`${securityCard} flex w-full items-center gap-4 p-4 text-left transition hover:bg-white/[0.04]`}
              >
                <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${state.bg}`}>
                  {scan.status === 'COMPLETED' ? (
                    <CheckCircle className={`h-4 w-4 ${state.text}`} />
                  ) : scan.status === 'FAILED' ? (
                    <AlertTriangle className={`h-4 w-4 ${state.text}`} />
                  ) : (
                    <Clock className={`h-4 w-4 ${state.text}`} />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-white truncate">{(scan as any).targetName}</p>
                  <p className="text-[10px] text-slate-500">
                    {scan.tier} · {new Date(scan.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                  </p>
                </div>
                <span className={`rounded-lg px-2 py-1 text-[10px] font-bold ${state.bg} ${state.text}`}>{state.label}</span>
                {scan.score !== undefined && scan.score !== null && (
                  <span className="text-sm font-bold text-slate-300 tabular-nums w-8 text-right">{Math.round(scan.score)}</span>
                )}
                <ArrowRight className="h-4 w-4 text-slate-600" />
              </motion.button>
            );
          })
        )}
      </div>
    </div>
  );
}
