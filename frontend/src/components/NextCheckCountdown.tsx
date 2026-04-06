import { Clock3 } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';

function formatRemaining(ms: number) {
  const totalSeconds = Math.max(Math.ceil(ms / 1000), 0);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;

  if (minutes <= 0) {
    return `${seconds}s`;
  }

  return `${minutes}m ${seconds}s`;
}

export function NextCheckCountdown({
  intervalSeconds,
  lastCheckedAt,
  status,
  className = '',
}: {
  intervalSeconds: number;
  lastCheckedAt?: string | null;
  status?: 'UP' | 'DOWN' | 'PAUSED' | 'DEGRADED';
  className?: string;
}) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  const label = useMemo(() => {
    if (status === 'PAUSED') {
      return 'Checks paused';
    }

    if (!lastCheckedAt) {
      return 'First check due now';
    }

    const nextCheckAt = new Date(lastCheckedAt).getTime() + intervalSeconds * 1000;
    const remaining = nextCheckAt - now;

    if (remaining <= 0) {
      return 'Triggering next check now';
    }

    return `Next check in ${formatRemaining(remaining)}`;
  }, [intervalSeconds, lastCheckedAt, now, status]);

  return (
    <div className={`inline-flex items-center gap-2 text-xs text-slate-500 ${className}`}>
      <Clock3 className="h-3.5 w-3.5 text-cyan-300/70" />
      <span>{label}</span>
    </div>
  );
}
