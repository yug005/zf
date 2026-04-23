import { motion } from 'framer-motion';
import { severityColors } from '../tokens';

interface SeverityBadgeProps {
  severity: string;
  size?: 'sm' | 'md' | 'lg';
  showDot?: boolean;
}

const sizeClasses = {
  sm: 'px-2 py-0.5 text-[10px]',
  md: 'px-2.5 py-1 text-xs',
  lg: 'px-3 py-1.5 text-sm',
};

export function SeverityBadge({ severity, size = 'md', showDot = true }: SeverityBadgeProps) {
  const colors = severityColors[severity] || severityColors.INFORMATIONAL;

  return (
    <motion.span
      initial={{ scale: 0.8, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      className={`inline-flex items-center gap-1.5 rounded-full font-bold uppercase tracking-[0.15em] ${colors.bg} ${colors.text} ${colors.border} border ${sizeClasses[size]}`}
    >
      {showDot && (
        <span className={`h-1.5 w-1.5 rounded-full ${colors.dot}`} />
      )}
      {severity}
    </motion.span>
  );
}
