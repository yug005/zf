import { useState, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Shield, CheckCircle, Zap, ArrowRight, ArrowLeft,
  Loader2, AlertTriangle, Scan as ScanIcon,
} from 'lucide-react';
import { securityApi } from '../../services/security';
import type { SecurityVerification } from '../../services/security';
import { securityCard } from '../../components/security/tokens';
import { PageMeta } from '../../components/PageMeta';
import { VerificationMethodSelector } from '../../components/security/verification/VerificationMethodSelector';
import { DNSVerificationFlow } from '../../components/security/verification/DNSVerificationFlow';
import { HTTPVerificationFlow } from '../../components/security/verification/HTTPVerificationFlow';

// ─── Step Definitions ───────────────────────────────────────────────

type OnboardStep = 'input' | 'method' | 'verify' | 'scan';

const STEP_META: Record<OnboardStep, { label: string; title: string; subtitle: string; index: number }> = {
  input:  { label: 'Add Target',   title: 'Add Your API Target',          subtitle: 'Enter the base URL of the API you want to scan for security vulnerabilities.', index: 0 },
  method: { label: 'Verify',       title: 'Verify Domain Ownership',      subtitle: 'Choose how you\'d like to prove ownership so we can unlock the full scan suite.', index: 1 },
  verify: { label: 'Complete',     title: 'Complete Verification',         subtitle: 'Follow the guided steps to verify your domain.', index: 2 },
  scan:   { label: 'Scan',         title: 'Launch Your First Scan',       subtitle: 'Everything is ready. Choose your scan type and begin.', index: 3 },
};

const STEP_KEYS: OnboardStep[] = ['input', 'method', 'verify', 'scan'];

// ─── Component ──────────────────────────────────────────────────────

export default function SecurityOnboarding() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  // ── State
  const [step, setStep] = useState<OnboardStep>('input');
  const [name, setName] = useState('');
  const [baseUrl, setBaseUrl] = useState('');
  const [targetId, setTargetId] = useState<string | null>(null);
  const [verificationMethod, setVerificationMethod] = useState<'DNS_TXT' | 'HTTP_TOKEN' | null>(null);
  const [verification, setVerification] = useState<SecurityVerification | null>(null);
  const [isVerified, setIsVerified] = useState(false);

  // ── Queries
  const { data: entitlement } = useQuery({
    queryKey: ['security-entitlement'],
    queryFn: securityApi.getEntitlement,
  });

  // ── Mutations
  const createTarget = useMutation({
    mutationFn: (data: { name: string; baseUrl: string }) => securityApi.createTarget(data),
    onSuccess: (target) => {
      setTargetId(target.id);
      setStep('method');
      queryClient.invalidateQueries({ queryKey: ['security-targets'] });
    },
  });

  const createVerification = useMutation({
    mutationFn: (data: { targetId: string; method: string }) =>
      securityApi.createVerification(data.targetId, { method: data.method }),
    onSuccess: (v) => {
      setVerification(v);
      if (v.state === 'VERIFIED') {
        // Ownership declaration auto-verifies
        setIsVerified(true);
        setStep('scan');
      } else {
        setStep('verify');
      }
    },
  });

  const checkVerification = useMutation({
    mutationFn: (data: { targetId: string; verificationId?: string }) =>
      securityApi.checkVerification(data.targetId, data.verificationId),
  });

  const initiateScan = useMutation({
    mutationFn: (data: { targetId: string; tier: string }) =>
      securityApi.initiateScan(data.targetId, { tier: data.tier }),
    onSuccess: (scan) => {
      queryClient.invalidateQueries({ queryKey: ['security-targets'] });
      navigate(`/security/scans/${scan.id}/report`);
    },
  });

  // ── Handlers
  const handleMethodSelect = useCallback((method: 'DNS_TXT' | 'HTTP_TOKEN') => {
    if (!targetId) return;
    setVerificationMethod(method);
    createVerification.mutate({ targetId, method });
  }, [targetId, createVerification]);

  const handleOwnershipSkip = useCallback(() => {
    if (!targetId) return;
    createVerification.mutate({ targetId, method: 'OWNERSHIP_DECLARATION' });
  }, [targetId, createVerification]);

  const handleVerifyCheck = useCallback(async (): Promise<SecurityVerification> => {
    if (!targetId || !verification) throw new Error('Missing data');
    return checkVerification.mutateAsync({
      targetId,
      verificationId: verification.id,
    });
  }, [targetId, verification, checkVerification]);

  const handleVerificationSuccess = useCallback(() => {
    setIsVerified(true);
    queryClient.invalidateQueries({ queryKey: ['security-targets'] });
    // Short delay for the success animation to play
    setTimeout(() => setStep('scan'), 1500);
  }, [queryClient]);

  const canScan = entitlement && entitlement.freeScanRemaining > 0;
  const currentMeta = STEP_META[step];

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <PageMeta
        title="Add Target | Security | Zer0Friction"
        description="Add an API target for security scanning."
        noIndex
      />

      {/* ── Header ── */}
      <motion.div
        key={step}
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-center"
      >
        <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-cyan-300/70">
          Security Onboarding
        </p>
        <h2 className="mt-2 text-2xl font-semibold text-white">{currentMeta.title}</h2>
        <p className="mt-2 text-sm text-slate-400">{currentMeta.subtitle}</p>
      </motion.div>

      {/* ── Step Indicator ── */}
      <div className="flex items-center justify-center gap-1.5">
        {STEP_KEYS.map((s, i) => {
          const meta = STEP_META[s];
          const isCurrent = step === s;
          const isPast = STEP_META[step].index > i;

          return (
            <div key={s} className="flex items-center gap-1.5">
              <motion.div
                layout
                className={`flex items-center gap-1.5 rounded-full px-2.5 py-1.5 text-[10px] font-bold uppercase tracking-[0.12em] transition-all duration-300 ${
                  isCurrent
                    ? 'bg-cyan-400/15 text-cyan-400 border border-cyan-400/25 shadow-[0_0_12px_rgba(34,211,238,0.15)]'
                    : isPast
                      ? 'bg-emerald-400/10 text-emerald-400 border border-emerald-400/20'
                      : 'bg-white/[0.03] text-slate-600 border border-white/6'
                }`}
              >
                <span className={`flex h-5 w-5 items-center justify-center rounded-full text-[9px] ${
                  isPast ? 'bg-emerald-400/20' : isCurrent ? 'bg-cyan-400/20' : 'bg-white/5'
                }`}>
                  {isPast ? <CheckCircle className="h-3 w-3" /> : i + 1}
                </span>
                {(isCurrent || isPast) && (
                  <motion.span
                    initial={{ width: 0, opacity: 0 }}
                    animate={{ width: 'auto', opacity: 1 }}
                    transition={{ duration: 0.3 }}
                    className="overflow-hidden whitespace-nowrap"
                  >
                    {meta.label}
                  </motion.span>
                )}
              </motion.div>

              {i < STEP_KEYS.length - 1 && (
                <div className={`h-px w-4 transition-colors ${isPast ? 'bg-emerald-400/30' : 'bg-white/8'}`} />
              )}
            </div>
          );
        })}
      </div>

      {/* ── Step Content ── */}
      <AnimatePresence mode="wait">
        {/* STEP 1: Add Target */}
        {step === 'input' && (
          <motion.div
            key="input"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.3 }}
            className={`${securityCard} p-6 space-y-5`}
          >
            <div>
              <label className="block text-[10px] font-bold uppercase tracking-[0.2em] text-slate-500 mb-2">
                Target Name
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="My Production API"
                className="w-full rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3 text-sm text-white placeholder-slate-600 outline-none transition focus:border-cyan-400/40 focus:ring-1 focus:ring-cyan-400/20"
              />
            </div>
            <div>
              <label className="block text-[10px] font-bold uppercase tracking-[0.2em] text-slate-500 mb-2">
                Base URL
              </label>
              <input
                type="url"
                value={baseUrl}
                onChange={(e) => setBaseUrl(e.target.value)}
                placeholder="https://api.example.com"
                className="w-full rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3 text-sm text-white placeholder-slate-600 font-mono outline-none transition focus:border-cyan-400/40 focus:ring-1 focus:ring-cyan-400/20"
              />
            </div>

            {!canScan && (
              <div className="rounded-xl border border-amber-500/20 bg-amber-500/8 px-4 py-3 text-xs text-amber-300">
                <AlertTriangle className="inline h-3.5 w-3.5 mr-1" />
                Free scan quota exhausted. Upgrade to a paid Security plan.
              </div>
            )}

            <button
              onClick={() => name && baseUrl && createTarget.mutate({ name, baseUrl })}
              disabled={!name || !baseUrl || createTarget.isPending}
              className="flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-cyan-400 to-emerald-400 py-3.5 text-sm font-semibold text-slate-950 transition hover:opacity-90 disabled:opacity-40 shadow-[0_8px_30px_rgba(34,211,238,0.2)]"
            >
              {createTarget.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <>Continue <ArrowRight className="h-4 w-4" /></>
              )}
            </button>

            {createTarget.isError && (
              <p className="text-xs text-rose-400 text-center">
                {(createTarget.error as any)?.response?.data?.message || 'Failed to create target.'}
              </p>
            )}
          </motion.div>
        )}

        {/* STEP 2: Verification Method Selection */}
        {step === 'method' && targetId && (
          <motion.div
            key="method"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.3 }}
          >
            <VerificationMethodSelector
              baseUrl={baseUrl}
              onSelect={handleMethodSelect}
              onSkipToOwnership={handleOwnershipSkip}
            />

            {createVerification.isPending && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="mt-4 flex items-center justify-center gap-2 text-xs text-cyan-400"
              >
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                Setting up verification challenge…
              </motion.div>
            )}

            {createVerification.isError && (
              <p className="mt-3 text-xs text-rose-400 text-center">
                {(createVerification.error as any)?.response?.data?.message || 'Failed to create verification.'}
              </p>
            )}
          </motion.div>
        )}

        {/* STEP 3: Verification Flow (DNS or HTTP) */}
        {step === 'verify' && targetId && verification && (
          <motion.div
            key="verify"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.3 }}
          >
            {verificationMethod === 'DNS_TXT' ? (
              <DNSVerificationFlow
                verification={verification}
                baseUrl={baseUrl}
                onVerify={handleVerifyCheck}
                onBack={() => setStep('method')}
                onSuccess={handleVerificationSuccess}
                isVerifying={checkVerification.isPending}
              />
            ) : (
              <HTTPVerificationFlow
                verification={verification}
                baseUrl={baseUrl}
                onVerify={handleVerifyCheck}
                onBack={() => setStep('method')}
                onSuccess={handleVerificationSuccess}
                isVerifying={checkVerification.isPending}
              />
            )}
          </motion.div>
        )}

        {/* STEP 4: Launch Scan */}
        {step === 'scan' && targetId && (
          <motion.div
            key="scan"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.3 }}
            className="space-y-5"
          >
            {/* Verification status badge */}
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className={`${securityCard} relative overflow-hidden p-5 text-center`}
            >
              {isVerified && (
                <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/6 to-transparent" />
              )}
              <div className="relative">
                <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-full border border-emerald-400/20 bg-emerald-400/10">
                  <Zap className="h-7 w-7 text-emerald-400" />
                </div>
                <p className="text-lg font-semibold text-white">
                  {isVerified ? 'All Set — Run Your Scan' : 'Ready to Scan'}
                </p>
                <p className="mt-2 text-sm text-slate-400">
                  {isVerified
                    ? 'Your domain is verified. Both Standard and Advanced scans are available.'
                    : 'Ownership confirmed. Standard scans are unlocked.'}
                </p>
              </div>
            </motion.div>

            {/* Scan Tier Cards */}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              {/* Standard */}
              <ScanTierCard
                title="Standard Scan"
                description="Broad non-destructive checks: headers, CORS, TLS, injection, auth posture, endpoint discovery."
                features={['Security Headers', 'CORS Config', 'TLS Check', 'Injection Detection', 'Auth Posture', 'Debug Exposure']}
                color="cyan"
                enabled={true}
                loading={initiateScan.isPending}
                onLaunch={() => initiateScan.mutate({ targetId, tier: 'STANDARD' })}
              />

              {/* Advanced */}
              <ScanTierCard
                title="Advanced Scan"
                description="Deeper probing with wider endpoint discovery, multi-step auth, and more payload variants."
                features={['Everything in Standard', 'Wider Endpoint Discovery', 'Multi-step Auth Checks', 'More Payload Variants']}
                color="emerald"
                enabled={isVerified && !!entitlement?.capabilities.advancedScan}
                locked={!isVerified}
                lockedMessage={!isVerified ? 'Requires DNS/HTTP verification' : 'Requires Professional plan'}
                loading={initiateScan.isPending}
                onLaunch={() => initiateScan.mutate({ targetId, tier: 'ADVANCED' })}
              />
            </div>

            {initiateScan.isError && (
              <p className="text-xs text-rose-400 text-center">
                {(initiateScan.error as any)?.response?.data?.message || 'Failed to initiate scan.'}
              </p>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ─── Scan Tier Card ─────────────────────────────────────────────────

function ScanTierCard({
  title,
  description,
  features,
  color,
  enabled,
  locked,
  lockedMessage,
  loading,
  onLaunch,
}: {
  title: string;
  description: string;
  features: string[];
  color: 'cyan' | 'emerald';
  enabled: boolean;
  locked?: boolean;
  lockedMessage?: string;
  loading: boolean;
  onLaunch: () => void;
}) {
  const gradientClass = color === 'cyan'
    ? 'from-cyan-400 to-emerald-400'
    : 'from-emerald-400 to-teal-400';

  const shadowClass = color === 'cyan'
    ? 'shadow-[0_8px_30px_rgba(34,211,238,0.2)]'
    : 'shadow-[0_8px_30px_rgba(52,211,153,0.2)]';

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      className={`${securityCard} overflow-hidden p-5 space-y-3 ${!enabled ? 'opacity-60' : ''}`}
    >
      <div>
        <h3 className="text-sm font-semibold text-white">{title}</h3>
        <p className="mt-1 text-xs text-slate-400 leading-relaxed">{description}</p>
      </div>

      <div className="rounded-xl border border-white/6 bg-white/[0.02] p-3">
        <div className="grid grid-cols-1 gap-1.5">
          {features.map((f) => (
            <div key={f} className="flex items-center gap-1.5 text-[11px] text-slate-400">
              <CheckCircle className="h-3 w-3 shrink-0 text-emerald-400/50" />
              {f}
            </div>
          ))}
        </div>
      </div>

      {locked && lockedMessage && (
        <p className="text-[10px] text-amber-400 flex items-center gap-1">
          <AlertTriangle className="h-3 w-3" /> {lockedMessage}
        </p>
      )}

      <button
        onClick={onLaunch}
        disabled={!enabled || loading}
        className={`flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r ${gradientClass} py-3 text-sm font-semibold text-slate-950 transition hover:opacity-90 disabled:opacity-30 disabled:cursor-not-allowed ${shadowClass}`}
      >
        {loading ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <>
            <ScanIcon className="h-4 w-4" />
            Launch {title.split(' ')[0]} Scan
          </>
        )}
      </button>
    </motion.div>
  );
}
