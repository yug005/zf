import { Link } from 'react-router-dom';
import { ShieldAlert, Zap, TrendingUp } from 'lucide-react';

type UpgradeReason = 'monitor_limit' | 'feature_gated' | 'trial_expiring' | 'expired' | 'interval_too_fast';

interface UpgradePromptProps {
  reason: UpgradeReason;
  currentPlan?: string;
  monitorLimit?: number;
  requestedInterval?: number;
  daysRemaining?: number;
  className?: string;
}

const reasonConfig: Record<UpgradeReason, {
  title: string;
  description: string;
  ctaLabel: string;
  ctaHref: string;
  tone: 'amber' | 'red' | 'blue';
  icon: React.ElementType;
}> = {
  monitor_limit: {
    title: 'Monitor limit reached',
    description: "You've used all your monitors on the current plan. Upgrade to add more endpoints.",
    ctaLabel: 'Upgrade plan',
    ctaHref: '/billing',
    tone: 'amber',
    icon: ShieldAlert,
  },
  feature_gated: {
    title: 'Feature not available on your plan',
    description: 'Unlock this feature and more by upgrading your current plan.',
    ctaLabel: 'View plans',
    ctaHref: '/billing',
    tone: 'amber',
    icon: TrendingUp,
  },
  trial_expiring: {
    title: 'Trial ending soon',
    description: 'Your trial ends soon. Upgrade now to keep your monitors running without interruption.',
    ctaLabel: 'Upgrade now',
    ctaHref: '/billing',
    tone: 'blue',
    icon: Zap,
  },
  expired: {
    title: 'Trial has ended',
    description: 'Your monitoring is paused. Upgrade to resume active checks and keep your history.',
    ctaLabel: 'Resume monitoring',
    ctaHref: '/billing',
    tone: 'red',
    icon: ShieldAlert,
  },
  interval_too_fast: {
    title: 'Interval not supported on this plan',
    description: 'Upgrade to enable faster check intervals (30s or 10s).',
    ctaLabel: 'Upgrade plan',
    ctaHref: '/billing',
    tone: 'amber',
    icon: TrendingUp,
  },
};

const toneClasses = {
  amber: {
    border: 'border-amber-200',
    bg: 'bg-amber-50',
    text: 'text-amber-900',
    icon: 'text-amber-600',
    button: 'bg-amber-600 hover:bg-amber-700 text-white',
  },
  red: {
    border: 'border-red-200',
    bg: 'bg-red-50',
    text: 'text-red-900',
    icon: 'text-red-600',
    button: 'bg-red-600 hover:bg-red-700 text-white',
  },
  blue: {
    border: 'border-blue-200',
    bg: 'bg-blue-50',
    text: 'text-blue-900',
    icon: 'text-blue-600',
    button: 'bg-blue-600 hover:bg-blue-700 text-white',
  },
};

export function UpgradePrompt({ reason, className = '' }: UpgradePromptProps) {
  const config = reasonConfig[reason];
  const tones = toneClasses[config.tone];
  const Icon = config.icon;

  return (
    <div
      className={`flex flex-col gap-4 rounded-2xl border ${tones.border} ${tones.bg} p-5 ${className}`}
    >
      <div className="flex items-start gap-3">
        <div className={`mt-0.5 rounded-full p-2 ${tones.border} bg-white ${tones.icon}`}>
          <Icon className="h-4 w-4" />
        </div>
        <div className="flex-1">
          <p className={`text-sm font-semibold ${tones.text}`}>{config.title}</p>
          <p className={`mt-1 text-sm ${tones.text} opacity-80`}>{config.description}</p>
        </div>
      </div>
      <div className="flex items-center gap-3">
        <Link
          to={config.ctaHref}
          className={`inline-flex items-center gap-1.5 rounded-xl px-4 py-2 text-sm font-medium transition-colors ${tones.button}`}
        >
          <Zap className="h-3.5 w-3.5" />
          {config.ctaLabel}
        </Link>
        <Link
          to="/billing"
          className={`text-sm font-medium ${tones.text} underline underline-offset-2 opacity-70`}
        >
          Compare plans
        </Link>
      </div>
    </div>
  );
}

/**
 * Compact banner version for inline use (e.g. inside a table row or card).
 */
export function UpgradePromptInline({ reason }: { reason: UpgradeReason }) {
  const config = reasonConfig[reason];
  const tones = toneClasses[config.tone];

  return (
    <Link
      to={config.ctaHref}
      className={`inline-flex items-center gap-1.5 rounded-full border ${tones.border} ${tones.bg} px-3 py-1 text-xs font-medium ${tones.text} transition-colors hover:${tones.button}`}
    >
      <Zap className="h-3 w-3" />
      {config.title}
    </Link>
  );
}
