import { motion } from 'framer-motion';
import { ShieldCheck, Zap, Lock, Globe, AlertTriangle } from 'lucide-react';
import { verificationColors, securityCard } from '../tokens';

interface VerificationStatusProps {
  state: string;
  baseUrl: string;
  compact?: boolean;
}

export function VerificationStatus({ state, baseUrl, compact = false }: VerificationStatusProps) {
  const colors = verificationColors[state] || verificationColors.UNVERIFIED;
  const hostname = (() => { try { return new URL(baseUrl).hostname; } catch { return baseUrl; } })();
  const isFullyVerified = state === 'DNS_VERIFIED' || state === 'HTTP_VERIFIED';
  const isOwnershipOnly = state === 'OWNERSHIP_CONFIRMED';

  if (compact) {
    return (
      <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.15em] ${colors.bg} ${colors.text} border-current/20`}>
        {isFullyVerified ? <ShieldCheck className="h-3 w-3" /> : isOwnershipOnly ? <Lock className="h-3 w-3" /> : <AlertTriangle className="h-3 w-3" />}
        {colors.label}
      </span>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className={`${securityCard} relative overflow-hidden p-5`}
    >
      {isFullyVerified && (
        <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/6 via-transparent to-transparent" />
      )}

      <div className="relative flex items-start gap-4">
        <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl ${colors.bg}`}>
          {isFullyVerified ? (
            <ShieldCheck className={`h-5.5 w-5.5 ${colors.text}`} />
          ) : isOwnershipOnly ? (
            <Lock className={`h-5 w-5 ${colors.text}`} />
          ) : (
            <AlertTriangle className={`h-5 w-5 ${colors.text}`} />
          )}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <p className="text-sm font-semibold text-white">
              {isFullyVerified
                ? 'Domain Verified'
                : isOwnershipOnly
                  ? 'Ownership Confirmed'
                  : 'Unverified Domain'}
            </p>
            <span className={`rounded-full px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider ${colors.bg} ${colors.text}`}>
              {colors.label}
            </span>
          </div>
          <p className="mt-0.5 text-xs text-slate-500 font-mono">{hostname}</p>

          {isFullyVerified && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              className="mt-3 flex items-center gap-4"
            >
              <Feature icon={<Zap className="h-3 w-3" />} label="Advanced scans unlocked" color="text-emerald-400" />
              <Feature icon={<Globe className="h-3 w-3" />} label="Full domain scope" color="text-emerald-400" />
            </motion.div>
          )}

          {isOwnershipOnly && (
            <p className="mt-2 text-[11px] text-amber-300/70 leading-relaxed">
              Standard scans available. Complete DNS or HTTP verification to unlock Advanced scans.
            </p>
          )}

          {state === 'UNVERIFIED' && (
            <p className="mt-2 text-[11px] text-slate-500 leading-relaxed">
              This domain has not been verified. Complete verification to run security scans.
            </p>
          )}
        </div>
      </div>
    </motion.div>
  );
}

function Feature({ icon, label, color }: { icon: React.ReactNode; label: string; color: string }) {
  return (
    <span className={`inline-flex items-center gap-1 text-[10px] font-semibold ${color}`}>
      {icon} {label}
    </span>
  );
}
