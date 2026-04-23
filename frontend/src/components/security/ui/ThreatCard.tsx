import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDown, ExternalLink, ShieldAlert } from 'lucide-react';
import { SeverityBadge } from './SeverityBadge';
import { categoryLabels, severityColors } from '../tokens';
import type { SecurityFinding } from '../../../services/security';

interface ThreatCardProps {
  finding: SecurityFinding;
  index?: number;
}

export function ThreatCard({ finding, index = 0 }: ThreatCardProps) {
  const [expanded, setExpanded] = useState(false);
  const colors = severityColors[finding.severity] || severityColors.INFORMATIONAL;

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.04, duration: 0.3 }}
      className={`group relative overflow-hidden rounded-[20px] border ${colors.border} bg-white/[0.03] backdrop-blur-sm transition-all duration-300 hover:bg-white/[0.05]`}
    >
      {/* Severity stripe */}
      <div className={`absolute left-0 top-0 bottom-0 w-1 ${colors.dot} rounded-l-[20px]`} />

      {/* Header */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex w-full items-start gap-4 px-5 py-4 text-left"
      >
        <div className="flex-1 min-w-0 pl-2">
          <div className="flex items-center gap-2.5 mb-1.5">
            <SeverityBadge severity={finding.severity} size="sm" />
            <span className="text-[10px] font-bold uppercase tracking-[0.15em] text-slate-500">
              {categoryLabels[finding.category] || finding.category}
            </span>
            {finding.validationState && (
              <span className={`rounded-full px-2 py-0.5 text-[9px] font-bold uppercase tracking-[0.12em] ${
                finding.validationState === 'VALIDATED'
                  ? 'bg-emerald-500/10 text-emerald-300'
                  : finding.validationState === 'LAB_ONLY'
                    ? 'bg-amber-500/10 text-amber-300'
                    : 'bg-white/5 text-slate-400'
              }`}>
                {finding.validationState.replace(/_/g, ' ')}
              </span>
            )}
          </div>
          <h3 className="text-sm font-semibold text-white leading-snug">{finding.title}</h3>
          {finding.endpoint && (
            <p className="mt-1 text-xs text-slate-500">
              <span className="text-cyan-400/60 font-mono">{finding.httpMethod || 'GET'}</span>{' '}
              <span className="font-mono text-slate-400">{finding.endpoint}</span>
              {finding.parameter && (
                <span className="text-amber-400/60 ml-1">?{finding.parameter}</span>
              )}
            </p>
          )}
        </div>

        <div className="flex items-center gap-2 pt-1">
          <span className={`text-[10px] font-bold uppercase tracking-[0.15em] ${
            finding.exploitability === 'PROVEN'
              ? 'text-rose-400'
              : finding.exploitability === 'PROBABLE'
                ? 'text-amber-400'
                : 'text-slate-500'
          }`}>
            {finding.exploitability}
          </span>
          <motion.div
            animate={{ rotate: expanded ? 180 : 0 }}
            transition={{ duration: 0.2 }}
          >
            <ChevronDown className="h-4 w-4 text-slate-500" />
          </motion.div>
        </div>
      </button>

      {/* Expanded Content */}
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3, ease: 'easeInOut' }}
            className="overflow-hidden"
          >
            <div className="border-t border-white/6 px-5 py-4 pl-7 space-y-4">
              {/* Attack Flow */}
              {finding.attackFlow && (
                <Section title="Attack Flow">
                  <div className="space-y-2">
                    {(finding.attackFlow as any).steps?.map((step: any, i: number) => (
                      <div key={i} className="flex items-start gap-2">
                        <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-white/6 text-[10px] font-bold text-cyan-400">
                          {i + 1}
                        </span>
                        <div className="min-w-0">
                          <p className="text-xs text-slate-300">{step.action}</p>
                          {step.payload && (
                            <code className="mt-0.5 block text-[11px] text-amber-400/80 font-mono break-all">{step.payload}</code>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </Section>
              )}

              {/* Evidence */}
              {finding.evidence && (
                <Section title="Evidence">
                  <div className="rounded-xl border border-white/6 bg-black/30 p-3">
                    {(finding.evidence as any).observation && (
                      <p className="text-xs text-slate-300 mb-2">{(finding.evidence as any).observation}</p>
                    )}
                    {(finding.evidence as any).responseSnippet && (
                      <pre className="text-[10px] text-slate-500 font-mono overflow-x-auto max-h-32 leading-relaxed">
                        {(finding.evidence as any).responseSnippet.substring(0, 500)}
                      </pre>
                    )}
                    {(finding.evidence as any).statusCode && (
                      <p className="mt-1 text-[10px] text-slate-500">
                        Status: <span className="text-slate-300">{(finding.evidence as any).statusCode}</span>
                      </p>
                    )}
                    {(finding.evidence as any).proofType && (
                      <p className="mt-1 text-[10px] text-slate-500">
                        Proof: <span className="text-slate-300">{String((finding.evidence as any).proofType).replace(/_/g, ' ')}</span>
                      </p>
                    )}
                    {Array.isArray((finding.evidence as any).attckTechniques) && (finding.evidence as any).attckTechniques.length > 0 && (
                      <p className="mt-1 text-[10px] text-slate-500">
                        ATT&CK: <span className="text-slate-300">{(finding.evidence as any).attckTechniques.join(', ')}</span>
                      </p>
                    )}
                  </div>
                </Section>
              )}

              {finding.labels && finding.labels.length > 0 && (
                <Section title="Labels">
                  <div className="flex flex-wrap gap-2">
                    {finding.labels.map((label) => (
                      <span key={label} className="rounded-full border border-white/10 bg-white/[0.03] px-2 py-1 text-[10px] font-bold uppercase tracking-[0.12em] text-slate-300">
                        {label.replace(/_/g, ' ')}
                      </span>
                    ))}
                  </div>
                </Section>
              )}

              {/* Remediation */}
              {finding.remediation && (
                <Section title="Remediation">
                  <p className="text-xs text-emerald-300/80 leading-relaxed">{finding.remediation}</p>
                </Section>
              )}

              {/* References */}
              {finding.references && (finding.references as string[]).length > 0 && (
                <Section title="References">
                  <div className="space-y-1">
                    {(finding.references as string[]).map((ref, i) => (
                      <a
                        key={i}
                        href={ref}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-1 text-xs text-cyan-400 hover:text-cyan-300 transition"
                      >
                        <ExternalLink className="h-3 w-3" /> {ref}
                      </a>
                    ))}
                  </div>
                </Section>
              )}

              {/* Status & Confidence */}
              <div className="flex items-center gap-4 pt-1">
                <span className="text-[10px] font-bold uppercase tracking-[0.15em] text-slate-600">
                  Confidence: <span className="text-slate-400">{finding.confidence}</span>
                </span>
                <span className="text-[10px] font-bold uppercase tracking-[0.15em] text-slate-600">
                  Status: <span className="text-slate-400">{finding.status}</span>
                </span>
                {finding.falsePositive && (
                  <span className="text-[10px] font-bold uppercase tracking-[0.15em] text-amber-400">
                    Marked as false positive
                  </span>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="mb-1.5 text-[10px] font-bold uppercase tracking-[0.2em] text-slate-600">{title}</p>
      {children}
    </div>
  );
}
