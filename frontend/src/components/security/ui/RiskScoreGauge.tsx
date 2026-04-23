import { motion } from 'framer-motion';
import { riskLevelColors } from '../tokens';

interface RiskScoreGaugeProps {
  score: number;
  riskLevel: string;
  size?: 'sm' | 'md' | 'lg';
}

const sizeConfig = {
  sm: { dim: 100, stroke: 6, fontSize: 'text-xl', labelSize: 'text-[8px]' },
  md: { dim: 160, stroke: 8, fontSize: 'text-3xl', labelSize: 'text-[10px]' },
  lg: { dim: 220, stroke: 10, fontSize: 'text-5xl', labelSize: 'text-xs' },
};

export function RiskScoreGauge({ score, riskLevel, size = 'md' }: RiskScoreGaugeProps) {
  const config = sizeConfig[size];
  const radius = (config.dim - config.stroke * 2) / 2;
  const circumference = 2 * Math.PI * radius;
  const progress = Math.min(score, 100) / 100;
  const dashOffset = circumference * (1 - progress);
  const colors = riskLevelColors[riskLevel] || riskLevelColors.SECURE;

  return (
    <div className="relative inline-flex items-center justify-center" style={{ width: config.dim, height: config.dim }}>
      {/* Background glow */}
      <div className={`absolute inset-0 rounded-full ${colors.bgGlow} blur-2xl opacity-40`} />

      <svg
        width={config.dim}
        height={config.dim}
        className="rotate-[-90deg]"
      >
        {/* Track */}
        <circle
          cx={config.dim / 2}
          cy={config.dim / 2}
          r={radius}
          fill="none"
          stroke="rgba(255,255,255,0.06)"
          strokeWidth={config.stroke}
        />
        {/* Progress Arc */}
        <motion.circle
          cx={config.dim / 2}
          cy={config.dim / 2}
          r={radius}
          fill="none"
          stroke="url(#gaugeGradient)"
          strokeWidth={config.stroke}
          strokeLinecap="round"
          strokeDasharray={circumference}
          initial={{ strokeDashoffset: circumference }}
          animate={{ strokeDashoffset: dashOffset }}
          transition={{ duration: 1.5, ease: [0.22, 1, 0.36, 1], delay: 0.2 }}
        />
        <defs>
          <linearGradient id="gaugeGradient" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" className={`[stop-color:theme(colors.${colors.gradient.replace('from-', '').split(' ')[0]})]`} stopColor={getGradientColor(riskLevel, 'start')} />
            <stop offset="100%" className={`[stop-color:theme(colors.${colors.gradient.replace('to-', '').split(' ')[0]})]`} stopColor={getGradientColor(riskLevel, 'end')} />
          </linearGradient>
        </defs>
      </svg>

      {/* Center label */}
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <motion.span
          initial={{ opacity: 0, scale: 0.5 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.6, delay: 0.8 }}
          className={`${config.fontSize} font-black ${colors.text} tabular-nums`}
        >
          {Math.round(score)}
        </motion.span>
        <motion.span
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.5, delay: 1.2 }}
          className={`${config.labelSize} font-bold uppercase tracking-[0.2em] text-slate-500`}
        >
          {riskLevel}
        </motion.span>
      </div>
    </div>
  );
}

function getGradientColor(riskLevel: string, position: 'start' | 'end'): string {
  const colors: Record<string, { start: string; end: string }> = {
    CRITICAL:      { start: '#f43f5e', end: '#dc2626' },
    HIGH:          { start: '#f97316', end: '#d97706' },
    MEDIUM:        { start: '#f59e0b', end: '#eab308' },
    LOW:           { start: '#38bdf8', end: '#3b82f6' },
    INFORMATIONAL: { start: '#94a3b8', end: '#64748b' },
    SECURE:        { start: '#34d399', end: '#14b8a6' },
  };
  const c = colors[riskLevel] || colors.SECURE;
  return position === 'start' ? c.start : c.end;
}
