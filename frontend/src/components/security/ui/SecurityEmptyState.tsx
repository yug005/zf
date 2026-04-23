import { motion } from 'framer-motion';
import { ShieldCheck, Shield, Scan, Search } from 'lucide-react';

interface SecurityEmptyStateProps {
  type: 'all-secure' | 'no-scans' | 'no-targets' | 'scan-in-progress';
  title?: string;
  message?: string;
  action?: React.ReactNode;
}

const config = {
  'all-secure': {
    icon: ShieldCheck,
    defaultTitle: 'All Secure',
    defaultMessage: 'No security findings were identified. Your API displays a strong security posture.',
    color: 'text-emerald-400',
    glowColor: 'bg-emerald-500/20',
    borderColor: 'border-emerald-500/20',
  },
  'no-scans': {
    icon: Scan,
    defaultTitle: 'No Scans Yet',
    defaultMessage: 'Run your first security scan to assess your API\'s security posture.',
    color: 'text-cyan-400',
    glowColor: 'bg-cyan-500/20',
    borderColor: 'border-cyan-500/20',
  },
  'no-targets': {
    icon: Search,
    defaultTitle: 'No Targets Added',
    defaultMessage: 'Add an API target to begin scanning for security vulnerabilities.',
    color: 'text-cyan-400',
    glowColor: 'bg-cyan-500/20',
    borderColor: 'border-cyan-500/20',
  },
  'scan-in-progress': {
    icon: Shield,
    defaultTitle: 'Scan In Progress',
    defaultMessage: 'Your security scan is running. Results will appear here when complete.',
    color: 'text-cyan-400',
    glowColor: 'bg-cyan-500/20',
    borderColor: 'border-cyan-500/20',
  },
};

export function SecurityEmptyState({ type, title, message, action }: SecurityEmptyStateProps) {
  const c = config[type];
  const Icon = c.icon;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className={`relative flex flex-col items-center justify-center rounded-[28px] border ${c.borderColor} bg-white/[0.02] p-12 text-center backdrop-blur-sm`}
    >
      {/* Background glow */}
      <div className={`absolute inset-0 rounded-[28px] ${c.glowColor} opacity-10 blur-3xl`} />

      {/* Animated icon */}
      <motion.div
        initial={{ scale: 0.5, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ delay: 0.2, type: 'spring', bounce: 0.4 }}
        className="relative mb-6"
      >
        <div className={`absolute inset-0 rounded-full ${c.glowColor} blur-xl`} />
        <div className={`relative flex h-20 w-20 items-center justify-center rounded-full border ${c.borderColor} bg-white/[0.04]`}>
          {type === 'all-secure' ? (
            <motion.div
              animate={{ scale: [1, 1.05, 1] }}
              transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
            >
              <Icon className={`h-9 w-9 ${c.color}`} />
            </motion.div>
          ) : type === 'scan-in-progress' ? (
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ duration: 8, repeat: Infinity, ease: 'linear' }}
            >
              <Icon className={`h-9 w-9 ${c.color}`} />
            </motion.div>
          ) : (
            <Icon className={`h-9 w-9 ${c.color}`} />
          )}
        </div>
      </motion.div>

      <motion.h3
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.4 }}
        className="text-lg font-semibold text-white"
      >
        {title || c.defaultTitle}
      </motion.h3>

      <motion.p
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.5 }}
        className="mt-2 max-w-sm text-sm text-slate-400"
      >
        {message || c.defaultMessage}
      </motion.p>

      {action && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.7 }}
          className="mt-6"
        >
          {action}
        </motion.div>
      )}
    </motion.div>
  );
}
