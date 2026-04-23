import { useState } from 'react';
import { motion } from 'framer-motion';
import { Globe, FileText, Star, ArrowRight, Shield, ChevronDown } from 'lucide-react';
import { securityCard } from '../tokens';

interface VerificationMethodSelectorProps {
  baseUrl: string;
  onSelect: (method: 'DNS_TXT' | 'HTTP_TOKEN') => void;
  onSkipToOwnership: () => void;
}

const methods = [
  {
    id: 'DNS_TXT' as const,
    title: 'DNS Verification',
    subtitle: 'Recommended for production',
    description: 'Add a TXT record to your domain\'s DNS configuration. This provides the strongest proof of domain ownership.',
    icon: Globe,
    badge: 'Recommended',
    badgeColor: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/20',
    features: ['Strongest verification method', 'Unlocks Advanced scans', 'One-time setup'],
    glowColor: 'from-emerald-400/20 via-cyan-400/10 to-transparent',
    borderActive: 'border-emerald-400/40',
  },
  {
    id: 'HTTP_TOKEN' as const,
    title: 'HTTP File Verification',
    subtitle: 'Fastest for developers',
    description: 'Place a verification file at a specific URL on your domain. Ideal when you have quick access to your web server.',
    icon: FileText,
    badge: null,
    badgeColor: '',
    features: ['Quick to set up', 'Unlocks Advanced scans', 'Works with any web server'],
    glowColor: 'from-cyan-400/15 via-blue-400/8 to-transparent',
    borderActive: 'border-cyan-400/40',
  },
] as const;

export function VerificationMethodSelector({
  baseUrl,
  onSelect,
  onSkipToOwnership,
}: VerificationMethodSelectorProps) {
  const [selected, setSelected] = useState<'DNS_TXT' | 'HTTP_TOKEN' | null>(null);
  const [ownershipExpanded, setOwnershipExpanded] = useState(false);
  const hostname = (() => { try { return new URL(baseUrl).hostname; } catch { return baseUrl; } })();

  return (
    <div className="space-y-5">
      {/* Domain Info */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex items-center justify-center gap-3 rounded-2xl border border-white/6 bg-white/[0.02] px-5 py-3"
      >
        <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-cyan-400/10 border border-cyan-400/20">
          <Shield className="h-4 w-4 text-cyan-400" />
        </div>
        <div className="text-center">
          <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-500">Verifying domain</p>
          <p className="text-sm font-semibold text-cyan-300 font-mono">{hostname}</p>
        </div>
      </motion.div>

      {/* Method Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {methods.map((method, index) => {
          const Icon = method.icon;
          const isSelected = selected === method.id;

          return (
            <motion.button
              key={method.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 + index * 0.08 }}
              whileHover={{ y: -4, transition: { duration: 0.2 } }}
              onClick={() => setSelected(method.id)}
              className={`${securityCard} group relative overflow-hidden p-5 text-left transition-all duration-300 ${
                isSelected
                  ? `${method.borderActive} shadow-[0_12px_40px_rgba(0,0,0,0.3)]`
                  : 'hover:border-white/14 hover:shadow-[0_8px_30px_rgba(0,0,0,0.2)]'
              }`}
            >
              {/* Background glow on selection */}
              {isSelected && (
                <motion.div
                  layoutId="method-glow"
                  className={`absolute inset-0 bg-gradient-to-br ${method.glowColor} opacity-60`}
                  transition={{ type: 'spring', bounce: 0.2, duration: 0.6 }}
                />
              )}

              <div className="relative">
                {/* Badge */}
                {method.badge && (
                  <span className={`mb-3 inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.15em] ${method.badgeColor}`}>
                    <Star className="h-2.5 w-2.5" />
                    {method.badge}
                  </span>
                )}

                {/* Icon */}
                <div className={`mb-3 flex h-12 w-12 items-center justify-center rounded-2xl border transition ${
                  isSelected
                    ? `border-white/15 bg-white/10 text-white`
                    : 'border-white/6 bg-white/[0.04] text-slate-400 group-hover:text-slate-200'
                }`}>
                  <Icon className="h-6 w-6" />
                </div>

                {/* Text */}
                <h3 className="text-sm font-semibold text-white">{method.title}</h3>
                <p className="mt-0.5 text-[10px] font-bold uppercase tracking-[0.15em] text-slate-500">{method.subtitle}</p>
                <p className="mt-2 text-xs text-slate-400 leading-relaxed">{method.description}</p>

                {/* Features */}
                <ul className="mt-3 space-y-1.5">
                  {method.features.map((f) => (
                    <li key={f} className="flex items-center gap-1.5 text-[11px] text-slate-400">
                      <span className={`h-1 w-1 rounded-full ${isSelected ? 'bg-emerald-400' : 'bg-slate-600'}`} />
                      {f}
                    </li>
                  ))}
                </ul>

                {/* Selected indicator */}
                {isSelected && (
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ type: 'spring', bounce: 0.5 }}
                    className="absolute right-0 top-0 flex h-6 w-6 items-center justify-center rounded-full bg-emerald-400"
                  >
                    <svg className="h-3.5 w-3.5 text-slate-950" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                  </motion.div>
                )}
              </div>
            </motion.button>
          );
        })}
      </div>

      {/* Continue Button */}
      <motion.button
        initial={{ opacity: 0 }}
        animate={{ opacity: selected ? 1 : 0.4 }}
        disabled={!selected}
        onClick={() => selected && onSelect(selected)}
        className="flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-cyan-400 to-emerald-400 py-3.5 text-sm font-semibold text-slate-950 transition hover:opacity-90 disabled:cursor-not-allowed shadow-[0_8px_30px_rgba(34,211,238,0.2)]"
      >
        Continue with {selected === 'DNS_TXT' ? 'DNS' : selected === 'HTTP_TOKEN' ? 'HTTP File' : '...'} Verification
        <ArrowRight className="h-4 w-4" />
      </motion.button>

      {/* Quick ownership confirmation option */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.4 }}
      >
        <button
          onClick={() => setOwnershipExpanded(!ownershipExpanded)}
          className="flex w-full items-center justify-between rounded-xl border border-white/6 bg-white/[0.02] px-4 py-3 text-left transition hover:bg-white/[0.04]"
        >
          <span className="text-xs text-slate-500">
            Just need a quick Standard scan?{' '}
            <span className="text-slate-400 font-medium">Skip full verification</span>
          </span>
          <motion.div animate={{ rotate: ownershipExpanded ? 180 : 0 }} transition={{ duration: 0.2 }}>
            <ChevronDown className="h-3.5 w-3.5 text-slate-600" />
          </motion.div>
        </button>

        {ownershipExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <div className="px-4 py-3 space-y-2">
              <p className="text-[11px] text-slate-400 leading-relaxed">
                Ownership declaration allows you to run Standard scans without DNS or HTTP verification. 
                Advanced scans require full domain verification.
              </p>
              <button
                onClick={onSkipToOwnership}
                className="text-xs font-semibold text-cyan-400 hover:text-cyan-300 transition"
              >
                Confirm ownership & run Standard scan →
              </button>
            </div>
          </motion.div>
        )}
      </motion.div>
    </div>
  );
}
