import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { Shield, Play, Loader2, ArrowRight, CheckCircle2 } from 'lucide-react';
import { securityApi, type SecurityVerification } from '../../services/security';
import { securityCard, verificationColors, scanStateColors } from '../../components/security/tokens';
import { PageMeta } from '../../components/PageMeta';
import { VerificationStatus } from '../../components/security/verification/VerificationStatus';
import { VerificationMethodSelector } from '../../components/security/verification/VerificationMethodSelector';
import { DNSVerificationFlow } from '../../components/security/verification/DNSVerificationFlow';
import { HTTPVerificationFlow } from '../../components/security/verification/HTTPVerificationFlow';

type VerificationMethod = 'DNS_TXT' | 'HTTP_TOKEN' | 'OWNERSHIP_DECLARATION';

export default function ScanConfiguration() {
  const { targetId } = useParams<{ targetId: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [verificationNotice, setVerificationNotice] = useState<string | null>(null);
  const [selectedMethod, setSelectedMethod] = useState<'DNS_TXT' | 'HTTP_TOKEN' | null>(null);
  const [activeVerification, setActiveVerification] = useState<SecurityVerification | null>(null);

  const { data: target, isLoading } = useQuery({
    queryKey: ['security-target', targetId],
    queryFn: () => securityApi.getTarget(targetId!),
    enabled: !!targetId,
  });

  const { data: entitlement } = useQuery({
    queryKey: ['security-entitlement'],
    queryFn: securityApi.getEntitlement,
  });

  const initScan = useMutation({
    mutationFn: (data: { tier: string }) => securityApi.initiateScan(targetId!, data),
    onSuccess: (scan) => {
      queryClient.invalidateQueries({ queryKey: ['security-targets'] });
      queryClient.invalidateQueries({ queryKey: ['security-target', targetId] });
      navigate(`/security/scans/${scan.id}/report`);
    },
  });

  const createVerification = useMutation({
    mutationFn: (method: VerificationMethod) =>
      securityApi.createVerification(targetId!, { method }),
    onSuccess: (verification, method) => {
      queryClient.invalidateQueries({ queryKey: ['security-target', targetId] });
      queryClient.invalidateQueries({ queryKey: ['security-targets'] });

      if (method === 'OWNERSHIP_DECLARATION') {
        setSelectedMethod(null);
        setActiveVerification(null);
        setVerificationNotice('Ownership confirmed. You can now run Standard scans for this target.');
        return;
      }

      setSelectedMethod(method);
      setActiveVerification(verification);
      setVerificationNotice(
        method === 'DNS_TXT'
          ? 'DNS verification challenge created. Add the TXT record, then verify it below.'
          : 'HTTP verification challenge created. Publish the token file, then verify it below.',
      );
    },
  });

  const checkVerification = useMutation({
    mutationFn: (verificationId?: string) =>
      securityApi.checkVerification(targetId!, verificationId),
    onSuccess: (verification) => {
      setActiveVerification(verification);
      queryClient.invalidateQueries({ queryKey: ['security-target', targetId] });
      queryClient.invalidateQueries({ queryKey: ['security-targets'] });
    },
  });

  const latestPendingVerification = useMemo(
    () =>
      target?.verifications?.find(
        (verification) =>
          (verification.method === 'DNS_TXT' || verification.method === 'HTTP_TOKEN') &&
          verification.state === 'PENDING',
      ) ?? null,
    [target?.verifications],
  );

  useEffect(() => {
    if (!verificationNotice) {
      return undefined;
    }

    const timeout = window.setTimeout(() => {
      setVerificationNotice(null);
    }, 5000);

    return () => window.clearTimeout(timeout);
  }, [verificationNotice]);

  useEffect(() => {
    if (!target) {
      return;
    }

    if (target.verificationState === 'DNS_VERIFIED' || target.verificationState === 'HTTP_VERIFIED') {
      setSelectedMethod(null);
      setActiveVerification(null);
      return;
    }

    if (!activeVerification && latestPendingVerification) {
      setActiveVerification(latestPendingVerification);
      setSelectedMethod(latestPendingVerification.method as 'DNS_TXT' | 'HTTP_TOKEN');
    }
  }, [target, latestPendingVerification, activeVerification]);

  if (isLoading || !target) {
    return (
      <div className="mx-auto max-w-3xl space-y-6">
        <div className={`${securityCard} h-48 animate-pulse`} />
        <div className={`${securityCard} h-64 animate-pulse`} />
      </div>
    );
  }

  const vColors = verificationColors[target.verificationState] || verificationColors.UNVERIFIED;
  const canStandard = target.verificationState !== 'UNVERIFIED';
  const canAdvanced = target.verificationState === 'DNS_VERIFIED' || target.verificationState === 'HTTP_VERIFIED';
  const verificationError =
    (createVerification.error as any)?.response?.data?.message ||
    (checkVerification.error as any)?.response?.data?.message ||
    null;

  const handleMethodSelect = (method: 'DNS_TXT' | 'HTTP_TOKEN') => {
    setSelectedMethod(method);
    createVerification.mutate(method);
  };

  const handleOwnershipSkip = () => {
    createVerification.mutate('OWNERSHIP_DECLARATION');
  };

  const handleVerificationSuccess = () => {
    setVerificationNotice('Domain verified successfully. You can now run Advanced Security Scans.');
  };

  const handleVerify = () => {
    if (!activeVerification) {
      return Promise.reject(new Error('Missing verification challenge.'));
    }

    return checkVerification.mutateAsync(activeVerification.id);
  };

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <PageMeta
        title={`${target.name} Configuration | Security | Zer0Friction`}
        description={`Configure security scanning for ${target.name}`}
        noIndex
      />

      {verificationNotice ? (
        <motion.div
          initial={{ opacity: 0, y: -12 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -12 }}
          className="rounded-2xl border border-emerald-400/20 bg-emerald-500/10 px-5 py-4 text-sm text-emerald-100 shadow-[0_14px_40px_rgba(16,185,129,0.16)]"
        >
          <div className="flex items-start gap-3">
            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-300" />
            <p>{verificationNotice}</p>
          </div>
        </motion.div>
      ) : null}

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className={`${securityCard} p-6`}
      >
        <div className="flex items-center gap-4">
          <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl ${vColors.bg}`}>
            <Shield className={`h-6 w-6 ${vColors.text}`} />
          </div>
          <div className="min-w-0 flex-1">
            <h2 className="truncate text-lg font-semibold text-white">{target.name}</h2>
            <p className="truncate font-mono text-xs text-slate-500">{target.baseUrl}</p>
          </div>
          <span className={`rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider ${vColors.bg} ${vColors.text}`}>
            {vColors.label}
          </span>
        </div>
      </motion.div>

      <VerificationStatus state={target.verificationState} baseUrl={target.baseUrl} />

      {!canAdvanced && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.08 }}
          className={`${securityCard} p-6`}
        >
          <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
            <div className="max-w-2xl">
              <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-cyan-300/70">
                Domain Verification
              </p>
              <h3 className="mt-2 text-lg font-semibold text-white">
                Unlock Advanced scans for this target
              </h3>
              <p className="mt-2 text-sm leading-7 text-slate-400">
                Complete a DNS or HTTP ownership check with the guided flow below. Your progress stays on this target, so you can come back and finish verification any time.
              </p>
            </div>
            <span className="rounded-full border border-amber-400/15 bg-amber-500/10 px-3 py-1 text-xs font-semibold text-amber-200">
              Current state: {vColors.label}
            </span>
          </div>

          <div className="mt-6 space-y-5">
            {activeVerification && selectedMethod ? (
              selectedMethod === 'DNS_TXT' ? (
                <DNSVerificationFlow
                  verification={activeVerification}
                  baseUrl={target.baseUrl}
                  onVerify={handleVerify}
                  onBack={() => {
                    setSelectedMethod(null);
                    setActiveVerification(null);
                  }}
                  onSuccess={handleVerificationSuccess}
                  isVerifying={checkVerification.isPending}
                />
              ) : (
                <HTTPVerificationFlow
                  verification={activeVerification}
                  baseUrl={target.baseUrl}
                  onVerify={handleVerify}
                  onBack={() => {
                    setSelectedMethod(null);
                    setActiveVerification(null);
                  }}
                  onSuccess={handleVerificationSuccess}
                  isVerifying={checkVerification.isPending}
                />
              )
            ) : (
              <VerificationMethodSelector
                baseUrl={target.baseUrl}
                onSelect={handleMethodSelect}
                onSkipToOwnership={handleOwnershipSkip}
              />
            )}

            {createVerification.isPending && (
              <div className="flex items-center justify-center gap-2 text-xs text-cyan-400">
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                Preparing your verification challenge...
              </div>
            )}

            {verificationError ? (
              <p className="text-center text-sm text-rose-400">{verificationError}</p>
            ) : null}
          </div>
        </motion.div>
      )}

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="grid grid-cols-1 gap-4 sm:grid-cols-2"
      >
        <div className={`${securityCard} p-5 space-y-4`}>
          <div>
            <h3 className="text-sm font-semibold text-white">Standard Scan</h3>
            <p className="mt-1 text-xs text-slate-400">
              Broad non-destructive security checks including headers, CORS, TLS, injection detection, and more.
            </p>
          </div>
          <button
            onClick={() => initScan.mutate({ tier: 'STANDARD' })}
            disabled={!canStandard || initScan.isPending}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-cyan-400 to-emerald-400 py-2.5 text-xs font-semibold text-slate-950 transition hover:opacity-90 disabled:opacity-30"
          >
            {initScan.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Play className="h-3.5 w-3.5" />}
            Run Standard Scan
          </button>
          {!canStandard && (
            <p className="text-[10px] text-amber-400">Requires ownership confirmation</p>
          )}
        </div>

        <div className={`${securityCard} p-5 space-y-4 ${!canAdvanced ? 'opacity-60' : ''}`}>
          <div>
            <h3 className="text-sm font-semibold text-white">Advanced Scan</h3>
            <p className="mt-1 text-xs text-slate-400">
              Deeper probing with wider endpoint discovery, more payload variants, and multi-step auth checks.
            </p>
          </div>
          <button
            onClick={() => initScan.mutate({ tier: 'ADVANCED' })}
            disabled={!canAdvanced || initScan.isPending || !entitlement?.capabilities.advancedScan}
            className="flex w-full items-center justify-center gap-2 rounded-xl border border-cyan-400/20 bg-cyan-400/10 py-2.5 text-xs font-semibold text-cyan-300 transition hover:bg-cyan-400/15 disabled:opacity-30"
          >
            <Play className="h-3.5 w-3.5" />
            Run Advanced Scan
          </button>
          {!canAdvanced && (
            <p className="text-[10px] text-amber-400">Requires DNS or HTTP verification</p>
          )}
          {canAdvanced && !entitlement?.capabilities.advancedScan && (
            <div className="space-y-2">
              <p className="text-[10px] text-amber-400">Requires Professional Security plan</p>
              <Link to="/security/pricing" className="inline-flex text-[10px] font-semibold text-cyan-300 hover:text-cyan-200">
                View Security pricing
              </Link>
            </div>
          )}
        </div>
      </motion.div>

      {target.scans && target.scans.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className={`${securityCard} p-5`}
        >
          <p className="mb-3 text-[10px] font-bold uppercase tracking-[0.3em] text-slate-500">
            Recent Scans
          </p>
          <div className="space-y-2">
            {target.scans.map((scan) => {
              const state = scanStateColors[scan.status] || scanStateColors.QUEUED;
              return (
                <button
                  key={scan.id}
                  onClick={() => navigate(`/security/scans/${scan.id}/report`)}
                  className="flex w-full items-center gap-3 rounded-xl border border-white/6 bg-white/[0.02] px-3 py-2.5 text-left transition hover:bg-white/[0.04]"
                >
                  <span className={`rounded-lg px-2 py-1 text-[10px] font-bold ${state.bg} ${state.text}`}>
                    {state.label}
                  </span>
                  <span className="text-xs text-slate-400">{scan.tier}</span>
                  <span className="flex-1" />
                  {scan.score !== undefined && scan.score !== null && (
                    <span className="tabular-nums text-sm font-bold text-slate-300">{Math.round(scan.score)}</span>
                  )}
                  <ArrowRight className="h-3.5 w-3.5 text-slate-600" />
                </button>
              );
            })}
          </div>
        </motion.div>
      )}

      {initScan.isError && (
        <p className="text-center text-xs text-rose-400">
          {(initScan.error as any)?.response?.data?.message || 'Failed to initiate scan.'}
        </p>
      )}
    </div>
  );
}
