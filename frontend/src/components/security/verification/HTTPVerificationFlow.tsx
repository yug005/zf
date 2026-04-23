import { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Copy, Check, ArrowLeft, Loader2, RefreshCw,
  FileText, AlertTriangle, ExternalLink,
} from 'lucide-react';
import type { SecurityVerification } from '../../../services/security';
import { securityCard } from '../tokens';
import { SuccessCard, FailureCard } from './DNSVerificationFlow';

interface HTTPVerificationFlowProps {
  verification: SecurityVerification;
  baseUrl: string;
  onVerify: () => Promise<SecurityVerification>;
  onBack: () => void;
  onSuccess: () => void;
  isVerifying: boolean;
}

export function HTTPVerificationFlow({
  verification,
  baseUrl,
  onVerify,
  onBack,
  onSuccess,
  isVerifying,
}: HTTPVerificationFlowProps) {
  const [copied, setCopied] = useState<string | null>(null);
  const [verifyResult, setVerifyResult] = useState<SecurityVerification | null>(null);
  const [currentStep, setCurrentStep] = useState(1);

  const fileContent = verification.instructions?.fileContent || verification.token;
  const filePath = '/.well-known/zer0friction-verify.txt';
  const fullUrl = verification.instructions?.url || `${baseUrl.replace(/\/+$/, '')}${filePath}`;

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
      // error handled by parent
    }
  };

  const isVerified = verifyResult?.state === 'VERIFIED';

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
        <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-full border border-cyan-400/20 bg-cyan-400/10">
          <FileText className="h-7 w-7 text-cyan-400" />
        </div>
        <h3 className="text-lg font-semibold text-white">HTTP File Verification</h3>
        <p className="mt-1 text-xs text-slate-400">
          Place a verification file on your web server
        </p>
      </motion.div>

      {/* Progress */}
      <StepProgressBar currentStep={currentStep} totalSteps={3} />

      {/* Step 1: Create the file */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className={`${securityCard} overflow-hidden`}
      >
        <StepHeader number={1} title="Create the Verification File" active={currentStep >= 1} complete={currentStep > 1} />
        <div className="p-5 space-y-4">
          {/* File path */}
          <div>
            <p className="mb-1.5 text-[10px] font-bold uppercase tracking-[0.2em] text-slate-500">File Path</p>
            <div className="group relative">
              <div className="rounded-xl border border-white/8 bg-black/40 px-4 py-3 font-mono text-sm text-cyan-300">
                {filePath}
              </div>
              <button
                onClick={() => copyToClipboard(filePath, 'path')}
                className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1 rounded-lg bg-white/8 px-2.5 py-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-300 transition hover:bg-white/12 hover:text-white"
              >
                {copied === 'path' ? (
                  <><Check className="h-3 w-3 text-emerald-400" /> Copied</>
                ) : (
                  <><Copy className="h-3 w-3" /> Copy</>
                )}
              </button>
            </div>
          </div>

          {/* File content */}
          <div>
            <p className="mb-1.5 text-[10px] font-bold uppercase tracking-[0.2em] text-slate-500">File Content</p>
            <div className="group relative">
              <div className="rounded-xl border border-white/8 bg-black/40 px-4 py-3 font-mono text-sm text-emerald-300 break-all leading-relaxed">
                {fileContent}
              </div>
              <button
                onClick={() => copyToClipboard(fileContent, 'content')}
                className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1 rounded-lg bg-white/8 px-2.5 py-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-300 transition hover:bg-white/12 hover:text-white"
              >
                {copied === 'content' ? (
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
            I've created the file <ArrowLeft className="h-3.5 w-3.5 rotate-180" />
          </button>
        </div>
      </motion.div>

      {/* Step 2: Upload and test */}
      <AnimatePresence>
        {currentStep >= 2 && (
          <motion.div
            initial={{ opacity: 0, y: 16, height: 0 }}
            animate={{ opacity: 1, y: 0, height: 'auto' }}
            exit={{ opacity: 0, y: -10, height: 0 }}
            transition={{ duration: 0.35 }}
            className={`${securityCard} overflow-hidden`}
          >
            <StepHeader number={2} title="Upload to Your Web Server" active={currentStep >= 2} complete={currentStep > 2} />
            <div className="p-5 space-y-4">
              <div className="rounded-xl border border-white/6 bg-white/[0.02] p-4 space-y-3">
                <p className="text-xs text-slate-300 leading-relaxed">
                  Upload the file to your server root directory so it's accessible at:
                </p>
                <div className="group relative">
                  <div className="overflow-x-auto rounded-xl border border-white/8 bg-black/40 px-4 py-3 font-mono text-xs text-cyan-300 leading-relaxed">
                    {fullUrl}
                  </div>
                  <button
                    onClick={() => copyToClipboard(fullUrl, 'url')}
                    className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1 rounded-lg bg-white/8 px-2.5 py-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-300 transition hover:bg-white/12 hover:text-white"
                  >
                    {copied === 'url' ? (
                      <><Check className="h-3 w-3 text-emerald-400" /> Copied</>
                    ) : (
                      <><Copy className="h-3 w-3" /> Copy</>
                    )}
                  </button>
                </div>
              </div>

              {/* Test link */}
              <a
                href={fullUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center gap-2 rounded-xl border border-white/6 bg-white/[0.02] px-4 py-2.5 text-xs text-cyan-400 transition hover:bg-white/[0.04]"
              >
                <ExternalLink className="h-3.5 w-3.5" />
                Test URL in browser
              </a>

              {/* Terminal instructions */}
              <div className="rounded-xl border border-white/6 bg-black/50 p-3">
                <p className="mb-1.5 text-[10px] font-bold uppercase tracking-[0.15em] text-slate-600">Quick setup (terminal)</p>
                <pre className="text-[11px] text-slate-400 font-mono leading-relaxed overflow-x-auto">
{`mkdir -p .well-known
echo "${fileContent}" > .well-known/zer0friction-verify.txt`}
                </pre>
                <button
                  onClick={() => copyToClipboard(`mkdir -p .well-known\necho "${fileContent}" > .well-known/zer0friction-verify.txt`, 'cmd')}
                  className="mt-2 flex items-center gap-1 text-[10px] font-semibold text-slate-500 hover:text-slate-300 transition"
                >
                  {copied === 'cmd' ? (
                    <><Check className="h-3 w-3 text-emerald-400" /> Copied</>
                  ) : (
                    <><Copy className="h-3 w-3" /> Copy commands</>
                  )}
                </button>
              </div>

              <div className="flex items-start gap-2 rounded-xl border border-amber-500/15 bg-amber-500/5 px-3.5 py-2.5">
                <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-400" />
                <p className="text-[11px] text-amber-300/80 leading-relaxed">
                  Ensure the file returns plain text content with an HTTP 200 response. No HTML wrappers.
                </p>
              </div>

              <button
                onClick={handleVerify}
                disabled={isVerifying}
                className="flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-cyan-400 to-emerald-400 py-3 text-sm font-semibold text-slate-950 transition hover:opacity-90 disabled:opacity-50 shadow-[0_8px_30px_rgba(34,211,238,0.2)]"
              >
                {isVerifying ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Checking file…
                  </>
                ) : (
                  <>
                    <RefreshCw className="h-4 w-4" />
                    Verify File
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
              <SuccessCard method="HTTP" />
            ) : (
              <FailureCard
                message={verifyResult.message || 'Token not found at the expected URL.'}
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

/* ─── Shared components ─────────────────────────────────────── */

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
