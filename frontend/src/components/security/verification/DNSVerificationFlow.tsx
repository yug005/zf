import { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Copy, Check, ArrowLeft, Loader2, RefreshCw,
  ChevronDown, ExternalLink, Globe, AlertTriangle,
  HelpCircle, CheckCircle,
} from 'lucide-react';
import type { SecurityVerification } from '../../../services/security';
import { securityCard } from '../tokens';

interface DNSVerificationFlowProps {
  verification: SecurityVerification;
  baseUrl: string;
  onVerify: () => Promise<SecurityVerification>;
  onBack: () => void;
  onSuccess: () => void;
  isVerifying: boolean;
}

const DNS_PROVIDERS = [
  { name: 'Cloudflare', url: 'https://dash.cloudflare.com' },
  { name: 'GoDaddy', url: 'https://www.godaddy.com/help/manage-dns-records-680' },
  { name: 'Google Domains', url: 'https://support.google.com/domains/answer/3290350' },
  { name: 'Namecheap', url: 'https://www.namecheap.com/support/knowledgebase/article.aspx/317' },
  { name: 'AWS Route 53', url: 'https://docs.aws.amazon.com/Route53/latest/DeveloperGuide/resource-record-sets-creating.html' },
  { name: 'Vercel', url: 'https://vercel.com/docs/projects/domains/working-with-dns' },
];

export function DNSVerificationFlow({
  verification,
  baseUrl,
  onVerify,
  onBack,
  onSuccess,
  isVerifying,
}: DNSVerificationFlowProps) {
  const [copied, setCopied] = useState<string | null>(null);
  const [verifyResult, setVerifyResult] = useState<SecurityVerification | null>(null);
  const [helpOpen, setHelpOpen] = useState(false);
  const [currentStep, setCurrentStep] = useState(1);

  const hostname = (() => { try { return new URL(baseUrl).hostname; } catch { return baseUrl; } })();
  const recordValue = verification.instructions?.record?.value || verification.challengeValue || verification.token;
  const recordName = verification.instructions?.record?.name || hostname;
  const providerHostHint = recordName;

  const copyToClipboard = useCallback((text: string, label: string) => {
    navigator.clipboard.writeText(text);
    setCopied(label);
    setTimeout(() => setCopied(null), 2000);
  }, []);

  const handleVerify = async () => {
    setCurrentStep(3);
    try {
      const result = await onVerify();
      setVerifyResult(result);
      if (result.state === 'VERIFIED') {
        onSuccess();
      }
    } catch {
      // error handled by parent mutation
    }
  };

  const isVerified = verifyResult?.state === 'VERIFIED';
  const isFailed = verifyResult && verifyResult.state !== 'VERIFIED';

  return (
    <div className="space-y-5">
      {/* Back button */}
      <motion.button
        initial={{ opacity: 0, x: -10 }}
        animate={{ opacity: 1, x: 0 }}
        onClick={onBack}
        className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-300 transition"
      >
        <ArrowLeft className="h-3.5 w-3.5" /> Change verification method
      </motion.button>

      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-center"
      >
        <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-full border border-emerald-400/20 bg-emerald-400/10">
          <Globe className="h-7 w-7 text-emerald-400" />
        </div>
        <h3 className="text-lg font-semibold text-white">DNS Verification</h3>
        <p className="mt-1 text-xs text-slate-400">
          Add a TXT record to <span className="font-mono text-cyan-400">{hostname}</span>
        </p>
      </motion.div>

      {/* Step Progress Bar */}
      <StepProgressBar currentStep={currentStep} totalSteps={3} />

      {/* Step 1: Get the record value */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className={`${securityCard} overflow-hidden`}
      >
        <StepHeader
          number={1}
          title="Copy Your Verification Record"
          active={currentStep >= 1}
          complete={currentStep > 1}
        />

        <div className="p-5 space-y-4">
          {/* Record Type */}
          <div className="grid grid-cols-3 gap-3">
            <RecordField label="Type" value="TXT" />
            <RecordField label="Name / Host" value={providerHostHint} subtitle={`for ${hostname}`} />
            <RecordField label="TTL" value="3600" subtitle="or default" />
          </div>

          {/* Record Value */}
          <div>
            <p className="mb-1.5 text-[10px] font-bold uppercase tracking-[0.2em] text-slate-500">Value</p>
            <div className="group relative">
              <div className="overflow-x-auto rounded-xl border border-white/8 bg-black/40 px-4 py-3 font-mono text-sm text-emerald-300 leading-relaxed">
                {recordValue}
              </div>
              <button
                onClick={() => copyToClipboard(recordValue, 'value')}
                className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1 rounded-lg bg-white/8 px-2.5 py-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-300 transition hover:bg-white/12 hover:text-white"
              >
                {copied === 'value' ? (
                  <><Check className="h-3 w-3 text-emerald-400" /> Copied</>
                ) : (
                  <><Copy className="h-3 w-3" /> Copy</>
                )}
              </button>
            </div>
          </div>

          <button
            onClick={() => setCurrentStep(2)}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-white/[0.06] py-2.5 text-xs font-semibold text-white transition hover:bg-white/[0.1]"
          >
            I've copied the record <ArrowLeft className="h-3.5 w-3.5 rotate-180" />
          </button>
        </div>
      </motion.div>

      {/* Step 2: Add to DNS */}
      <AnimatePresence>
        {currentStep >= 2 && (
          <motion.div
            initial={{ opacity: 0, y: 16, height: 0 }}
            animate={{ opacity: 1, y: 0, height: 'auto' }}
            exit={{ opacity: 0, y: -10, height: 0 }}
            transition={{ duration: 0.35 }}
            className={`${securityCard} overflow-hidden`}
          >
            <StepHeader
              number={2}
              title="Add TXT Record to Your DNS"
              active={currentStep >= 2}
              complete={currentStep > 2}
            />

            <div className="p-5 space-y-4">
              <div className="rounded-xl border border-white/6 bg-white/[0.02] p-4 space-y-3">
                <p className="text-xs text-slate-300 leading-relaxed">
                  Log into your DNS provider and add a new <span className="font-mono text-amber-300 bg-amber-400/10 px-1 rounded">TXT</span> record with the value above.
                </p>
                <div className="flex flex-wrap gap-2">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Provider:</span>
                  <span className="text-[10px] text-slate-500">Host = <span className="font-mono text-slate-300">{providerHostHint}</span></span>
                  <span className="text-[10px] text-slate-500">Value = <span className="font-mono text-emerald-300/80">{recordValue.substring(0, 24)}…</span></span>
                </div>
              </div>

              {/* DNS Provider Help */}
              <button
                onClick={() => setHelpOpen(!helpOpen)}
                className="flex w-full items-center justify-between rounded-xl border border-white/6 bg-white/[0.02] px-4 py-2.5 text-left transition hover:bg-white/[0.04]"
              >
                <span className="flex items-center gap-2 text-xs text-slate-400">
                  <HelpCircle className="h-3.5 w-3.5" />
                  Where do I add DNS records?
                </span>
                <motion.div animate={{ rotate: helpOpen ? 180 : 0 }} transition={{ duration: 0.2 }}>
                  <ChevronDown className="h-3.5 w-3.5 text-slate-600" />
                </motion.div>
              </button>

              <AnimatePresence>
                {helpOpen && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.25 }}
                    className="overflow-hidden"
                  >
                    <div className="grid grid-cols-2 gap-2">
                      {DNS_PROVIDERS.map((p) => (
                        <a
                          key={p.name}
                          href={p.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-2 rounded-lg border border-white/4 bg-white/[0.02] px-3 py-2 text-xs text-slate-400 transition hover:bg-white/[0.05] hover:text-white"
                        >
                          <ExternalLink className="h-3 w-3 text-cyan-400/60" />
                          {p.name}
                        </a>
                      ))}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              <div className="flex items-start gap-2 rounded-xl border border-amber-500/15 bg-amber-500/5 px-3.5 py-2.5">
                <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-400" />
                <p className="text-[11px] text-amber-300/80 leading-relaxed">
                  DNS changes may take a few minutes to propagate. Make sure the TXT record is created on <span className="font-mono text-amber-200">{providerHostHint}</span>, then wait 5-10 minutes and try again.
                </p>
              </div>

              <button
                onClick={handleVerify}
                disabled={isVerifying}
                className="flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-emerald-400 to-teal-400 py-3 text-sm font-semibold text-slate-950 transition hover:opacity-90 disabled:opacity-50 shadow-[0_8px_30px_rgba(52,211,153,0.2)]"
              >
                {isVerifying ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Checking DNS records…
                  </>
                ) : (
                  <>
                    <RefreshCw className="h-4 w-4" />
                    Verify DNS Record
                  </>
                )}
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Step 3: Result */}
      <AnimatePresence>
        {currentStep >= 3 && verifyResult && (
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
          >
            {isVerified ? (
              <SuccessCard method="DNS" />
            ) : (
              <FailureCard
                message={verifyResult.message || 'DNS TXT record not found.'}
                onRetry={handleVerify}
                isRetrying={isVerifying}
              />
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/* ─── Shared Sub-components ─────────────────────────────────────── */

function StepProgressBar({ currentStep, totalSteps }: { currentStep: number; totalSteps: number }) {
  const progress = Math.min((currentStep - 0.5) / totalSteps, 1);
  return (
    <div className="relative h-1 overflow-hidden rounded-full bg-white/6">
      <motion.div
        className="absolute inset-y-0 left-0 rounded-full bg-gradient-to-r from-cyan-400 to-emerald-400"
        initial={{ width: '0%' }}
        animate={{ width: `${progress * 100}%` }}
        transition={{ duration: 0.6, ease: 'easeOut' }}
      />
    </div>
  );
}

function StepHeader({ number, title, active, complete }: { number: number; title: string; active: boolean; complete: boolean }) {
  return (
    <div className="flex items-center gap-3 border-b border-white/6 px-5 py-3.5">
      <div className={`flex h-7 w-7 items-center justify-center rounded-full text-[10px] font-bold transition ${
        complete
          ? 'bg-emerald-400/20 text-emerald-400 border border-emerald-400/30'
          : active
            ? 'bg-cyan-400/20 text-cyan-400 border border-cyan-400/30'
            : 'bg-white/5 text-slate-600 border border-white/10'
      }`}>
        {complete ? <Check className="h-3.5 w-3.5" /> : number}
      </div>
      <p className={`text-sm font-semibold ${active ? 'text-white' : 'text-slate-500'}`}>{title}</p>
    </div>
  );
}

function RecordField({ label, value, subtitle }: { label: string; value: string; subtitle?: string }) {
  return (
    <div className="rounded-xl border border-white/6 bg-white/[0.02] px-3 py-2.5">
      <p className="text-[9px] font-bold uppercase tracking-[0.2em] text-slate-600">{label}</p>
      <p className="mt-0.5 text-sm font-bold text-white font-mono">{value}</p>
      {subtitle && <p className="text-[10px] text-slate-500 font-mono truncate">{subtitle}</p>}
    </div>
  );
}

export function SuccessCard({ method }: { method: string }) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className={`${securityCard} relative overflow-hidden p-6 text-center`}
    >
      <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/10 via-teal-500/5 to-transparent" />
      <div className="relative">
        {/* Animated Checkmark */}
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ type: 'spring', bounce: 0.5, delay: 0.15 }}
          className="mx-auto mb-4 flex h-16 w-16 items-center justify-center"
        >
          <div className="absolute h-16 w-16 rounded-full bg-emerald-400/20 animate-ping" style={{ animationDuration: '2s' }} />
          <div className="relative flex h-16 w-16 items-center justify-center rounded-full border border-emerald-400/30 bg-emerald-400/15">
            <motion.svg
              className="h-8 w-8 text-emerald-400"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2.5}
            >
              <motion.path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M5 13l4 4L19 7"
                initial={{ pathLength: 0 }}
                animate={{ pathLength: 1 }}
                transition={{ duration: 0.5, delay: 0.3 }}
              />
            </motion.svg>
          </div>
        </motion.div>

        <motion.h3
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
          className="text-lg font-semibold text-white"
        >
          Domain Verified Successfully
        </motion.h3>
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.65 }}
          className="mt-2 text-sm text-slate-400"
        >
          {method} verification complete. You can now run <span className="text-emerald-300 font-semibold">Advanced Security Scans</span>.
        </motion.p>

        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.85 }}
          className="mt-4 inline-flex items-center gap-1.5 rounded-full bg-emerald-500/15 border border-emerald-500/20 px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.15em] text-emerald-400"
        >
          <CheckCircle className="h-3 w-3" /> Verified
        </motion.div>
      </div>
    </motion.div>
  );
}

export function FailureCard({ message, onRetry, isRetrying }: { message: string; onRetry: () => void; isRetrying: boolean }) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className={`${securityCard} relative overflow-hidden p-5`}
    >
      <div className="absolute inset-0 bg-gradient-to-br from-amber-500/5 via-transparent to-transparent" />
      <div className="relative flex items-start gap-4">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-amber-500/20 bg-amber-500/10">
          <AlertTriangle className="h-5 w-5 text-amber-400" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-white">Verification Not Found</p>
          <p className="mt-1 text-xs text-slate-400 leading-relaxed">{message}</p>
          <button
            onClick={onRetry}
            disabled={isRetrying}
            className="mt-3 inline-flex items-center gap-1.5 rounded-xl border border-cyan-400/20 bg-cyan-400/8 px-4 py-2 text-xs font-semibold text-cyan-300 transition hover:bg-cyan-400/15 disabled:opacity-50"
          >
            {isRetrying ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
            Try Again
          </button>
        </div>
      </div>
    </motion.div>
  );
}
