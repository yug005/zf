import { useEffect, useState, useRef, useMemo } from 'react';
import { motion, useInView } from 'framer-motion';
import { Activity, Bell, CheckCircle, AlertTriangle, Clock, Wifi, WifiOff } from 'lucide-react';

/* Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬ Animated Response Time Graph Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬ */
function ResponseGraph({ inView }: { inView: boolean }) {
  const data = useMemo(
    () => [34, 42, 38, 45, 52, 48, 44, 39, 85, 42, 38, 35, 40, 37, 33, 36, 44, 41, 39, 32],
    []
  );
  const maxVal = Math.max(...data);
  const w = 400;
  const h = 100;
  const step = w / (data.length - 1);

  const pathD = data
    .map((v, i) => {
      const x = i * step;
      const y = h - (v / maxVal) * h * 0.85;
      return `${i === 0 ? 'M' : 'L'} ${x} ${y}`;
    })
    .join(' ');

  const areaD = pathD + ` L ${w} ${h} L 0 ${h} Z`;

  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="w-full h-full" preserveAspectRatio="none">
      <defs>
        <linearGradient id="graph-gradient" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="rgb(45, 212, 191)" stopOpacity="0.3" />
          <stop offset="100%" stopColor="rgb(45, 212, 191)" stopOpacity="0" />
        </linearGradient>
        <linearGradient id="line-gradient" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="rgb(45, 212, 191)" />
          <stop offset="50%" stopColor="rgb(34, 211, 238)" />
          <stop offset="100%" stopColor="rgb(52, 211, 153)" />
        </linearGradient>
      </defs>
      {inView && (
        <>
          <motion.path
            d={areaD}
            fill="url(#graph-gradient)"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.5, duration: 1 }}
          />
          <motion.path
            d={pathD}
            fill="none"
            stroke="url(#line-gradient)"
            strokeWidth="2"
            strokeLinecap="round"
            initial={{ pathLength: 0 }}
            animate={{ pathLength: 1 }}
            transition={{ duration: 2, ease: 'easeOut', delay: 0.3 }}
          />
          {/* Spike indicator */}
          <motion.circle
            cx={8 * step}
            cy={h - (85 / maxVal) * h * 0.85}
            r="4"
            fill="rgb(239, 68, 68)"
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ delay: 1.5, duration: 0.4 }}
          />
          <motion.circle
            cx={8 * step}
            cy={h - (85 / maxVal) * h * 0.85}
            r="4"
            fill="none"
            stroke="rgb(239, 68, 68)"
            strokeWidth="2"
            initial={{ scale: 1, opacity: 0.6 }}
            animate={{ scale: 3, opacity: 0 }}
            transition={{ delay: 1.5, duration: 1.5, repeat: Infinity }}
          />
        </>
      )}
    </svg>
  );
}

/* Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬ Monitor Row Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬ */
function MonitorRow({
  name, endpoint, status, latency, delay,
}: {
  name: string; endpoint: string; status: 'up' | 'down'; latency: string; delay: number;
}) {
  const isUp = status === 'up';
  return (
    <motion.div
      initial={{ opacity: 0, x: -20 }}
      whileInView={{ opacity: 1, x: 0 }}
      viewport={{ once: true }}
      transition={{ delay, duration: 0.6, ease: [0.19, 1, 0.22, 1] }}
      className="flex items-center justify-between p-4 rounded-xl
        bg-white/[0.03] border border-white/[0.06] backdrop-blur-sm
        hover:bg-white/[0.06] transition-colors group"
    >
      <div className="flex items-center gap-3">
        <div className={`w-2 h-2 rounded-full ${isUp ? 'bg-aurora-emerald' : 'bg-red-400 animate-pulse'}`} />
        <div>
          <div className="text-sm font-semibold text-white/90">{name}</div>
          <div className="text-xs font-mono text-white/30 mt-0.5">{endpoint}</div>
        </div>
      </div>
      <div className="flex items-center gap-4">
        <span className="text-xs font-mono text-white/40">{latency}</span>
        <span
          className={`px-2.5 py-1 rounded-lg text-[10px] font-bold tracking-wider uppercase
            ${isUp
              ? 'bg-aurora-emerald/10 text-aurora-emerald border border-aurora-emerald/20'
              : 'bg-red-500/10 text-red-400 border border-red-500/20'
            }`}
        >
          {status}
        </span>
      </div>
    </motion.div>
  );
}

/* Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬ Alert Notification Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬ */
function AlertNotification({ inView }: { inView: boolean }) {
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (inView) {
      const timer = setTimeout(() => setShow(true), 2500);
      return () => clearTimeout(timer);
    }
  }, [inView]);

  if (!show) return null;

  return (
    <motion.div
      initial={{ opacity: 0, x: 60, scale: 0.9 }}
      animate={{ opacity: 1, x: 0, scale: 1 }}
      transition={{ duration: 0.6, ease: [0.19, 1, 0.22, 1] }}
      className="absolute -right-4 top-20 z-20 w-64"
    >
      <div className="p-4 rounded-2xl bg-red-500/10 border border-red-500/20 backdrop-blur-xl shadow-lg">
        <div className="flex items-center gap-2 mb-2">
          <AlertTriangle className="w-4 h-4 text-red-400" />
          <span className="text-xs font-bold text-red-400 uppercase tracking-wider">Alert</span>
        </div>
        <p className="text-xs text-white/70 leading-relaxed">
          <span className="font-semibold text-white/90">Billing Webhook</span> returned HTTP 502 - response time spiked to 2340ms
        </p>
        <div className="mt-2 flex items-center gap-1.5 text-[10px] text-white/30 font-mono">
          <Clock className="w-3 h-3" />
          <span>3 seconds ago</span>
        </div>
      </div>
    </motion.div>
  );
}

/* Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬ Uptime Bar Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬ */
function UptimeBar({ inView }: { inView: boolean }) {
  const days = useMemo(() => {
    return Array.from({ length: 30 }, (_, i) => (i === 22 ? 'down' : i === 23 ? 'degraded' : 'up'));
  }, []);

  return (
    <div className="flex gap-[2px] items-end h-6">
      {days.map((status, i) => (
        <motion.div
          key={i}
          initial={{ scaleY: 0 }}
          animate={inView ? { scaleY: 1 } : {}}
          transition={{ delay: 0.05 * i, duration: 0.3, ease: 'easeOut' }}
          style={{ transformOrigin: 'bottom' }}
          className={`flex-1 rounded-[1px] ${
            status === 'up'
              ? 'h-6 bg-aurora-emerald/50'
              : status === 'degraded'
              ? 'h-4 bg-amber-400/50'
              : 'h-2 bg-red-400/60'
          }`}
        />
      ))}
    </div>
  );
}

/* Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬ Main Live Dashboard Export Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬ */
export default function LiveDashboard() {
  const sectionRef = useRef<HTMLElement>(null);
  const isInView = useInView(sectionRef, { once: true, amount: 0.3 });

  return (
    <section
      ref={sectionRef}
      id="live-dashboard"
      className="relative py-32 px-6 bg-void-950 overflow-hidden"
    >
      {/* Background glow */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[500px]
        bg-aurora-teal/5 blur-[200px] rounded-full pointer-events-none" />

      <div className="max-w-6xl mx-auto relative">
        {/* Section label */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="text-center mb-16"
        >
          <span className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full
            bg-aurora-teal/10 border border-aurora-teal/20 text-aurora-teal
            text-[10px] font-bold tracking-[0.2em] uppercase mb-6">
            <Activity className="w-3 h-3" />
            Live Product Preview
          </span>
          <h2 className="text-3xl md:text-5xl font-black text-white tracking-tight mt-4">
            See it <span className="bg-gradient-to-r from-aurora-teal to-aurora-emerald bg-clip-text text-transparent">working</span>
          </h2>
          <p className="mt-4 text-white/40 text-lg max-w-lg mx-auto">
            This is what your dashboard looks like. No screenshots - a live-style product preview.
          </p>
        </motion.div>

        {/* Dashboard panel */}
        <motion.div
          initial={{ opacity: 0, y: 60, scale: 0.95 }}
          whileInView={{ opacity: 1, y: 0, scale: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 1, ease: [0.19, 1, 0.22, 1] }}
          className="relative"
        >
          {/* Alert notification that slides in */}
          <AlertNotification inView={isInView} />

          {/* Glass panel */}
          <div className="rounded-3xl border border-white/[0.08] bg-white/[0.02]
            backdrop-blur-xl p-2 shadow-glass-lg">
            {/* Window chrome */}
            <div className="flex items-center gap-2 px-5 py-3 border-b border-white/[0.06]">
              <div className="flex gap-1.5">
                <div className="w-3 h-3 rounded-full bg-red-400/60" />
                <div className="w-3 h-3 rounded-full bg-amber-400/60" />
                <div className="w-3 h-3 rounded-full bg-aurora-emerald/60" />
              </div>
              <div className="flex-1 flex justify-center">
                <div className="px-4 py-1 rounded-lg bg-white/[0.04] text-[11px] font-mono text-white/30">
                  app.zer0friction.in/dashboard
                </div>
              </div>
            </div>

            {/* Dashboard content */}
            <div className="p-6 space-y-6">
              {/* Top stats row */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {[
                  { label: 'Total Monitors', value: '24', icon: Wifi, color: 'text-aurora-teal' },
                  { label: 'Uptime (30d)', value: '99.94%', icon: CheckCircle, color: 'text-aurora-emerald' },
                  { label: 'Avg Response', value: '142ms', icon: Clock, color: 'text-aurora-cyan' },
                  { label: 'Active Alerts', value: '1', icon: Bell, color: 'text-red-400' },
                ].map((stat, i) => (
                  <motion.div
                    key={stat.label}
                    initial={{ opacity: 0, y: 20 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ delay: 0.2 + i * 0.1, duration: 0.6 }}
                    className="p-4 rounded-xl bg-white/[0.03] border border-white/[0.06]"
                  >
                    <div className="flex items-center gap-2 mb-2">
                      <stat.icon className={`w-3.5 h-3.5 ${stat.color}`} />
                      <span className="text-[10px] text-white/40 uppercase tracking-wider font-semibold">{stat.label}</span>
                    </div>
                    <div className={`text-2xl font-bold ${stat.color}`}>{stat.value}</div>
                  </motion.div>
                ))}
              </div>

              {/* Response time graph */}
              <div className="p-5 rounded-xl bg-white/[0.03] border border-white/[0.06]">
                <div className="flex items-center justify-between mb-4">
                  <span className="text-xs font-semibold text-white/60 uppercase tracking-wider">Response Time (24h)</span>
                  <span className="text-[10px] font-mono text-white/30">ms</span>
                </div>
                <div className="h-24">
                  <ResponseGraph inView={isInView} />
                </div>
              </div>

              {/* Monitor list */}
              <div className="space-y-2">
                <MonitorRow name="Production Auth API" endpoint="POST /v1/oauth/token" status="up" latency="34ms" delay={0.3} />
                <MonitorRow name="Payment Gateway" endpoint="POST /v1/payments/charge" status="up" latency="89ms" delay={0.4} />
                <MonitorRow name="Billing Webhook" endpoint="POST /webhooks/stripe" status="down" latency="2340ms" delay={0.5} />
                <MonitorRow name="User Service" endpoint="GET /v1/users/me" status="up" latency="22ms" delay={0.6} />
              </div>

              {/* 30-day uptime bar */}
              <div className="p-5 rounded-xl bg-white/[0.03] border border-white/[0.06]">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs font-semibold text-white/60 uppercase tracking-wider">30-Day Uptime</span>
                  <span className="text-xs font-mono text-aurora-emerald">99.94%</span>
                </div>
                <UptimeBar inView={isInView} />
                <div className="flex justify-between mt-2">
                  <span className="text-[10px] text-white/20 font-mono">30 days ago</span>
                  <span className="text-[10px] text-white/20 font-mono">Today</span>
                </div>
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
