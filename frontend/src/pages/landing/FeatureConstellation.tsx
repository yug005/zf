import { useRef, useState } from 'react';
import { motion, useInView, AnimatePresence } from 'framer-motion';
import {
  ShieldCheck, Bell, Clock, Key, Globe, Activity, Cpu, BarChart3,
} from 'lucide-react';

const FEATURES = [
  {
    icon: ShieldCheck,
    title: 'API Monitoring',
    label: 'Monitor',
    desc: 'Continuous HTTP/HTTPS checks with custom payloads, headers, and advanced TLS validation. Every endpoint, every second.',
    color: 'from-aurora-teal to-aurora-cyan',
  },
  {
    icon: Bell,
    title: 'Instant Alerts',
    label: 'Alert',
    desc: 'Multi-channel notifications via Slack, Email, and Discord. Intelligent debounce eliminates alert fatigue.',
    color: 'from-aurora-violet to-aurora-indigo',
  },
  {
    icon: Clock,
    title: 'Latency Tracking',
    label: 'Track',
    desc: 'Response time degradation monitoring. Catch memory leaks and slow queries before your users do.',
    color: 'from-aurora-emerald to-aurora-teal',
  },
  {
    icon: Key,
    title: 'Secure API Keys',
    label: 'Secure',
    desc: 'Cryptographic multi-tenant keys for CI/CD pipelines. Manage infrastructure programmatically.',
    color: 'from-aurora-cyan to-aurora-teal',
  },
  {
    icon: Globe,
    title: 'Status Pages',
    label: 'Publish',
    desc: 'Public status pages for your users. Show real-time health, uptime history, and incident timeline.',
    color: 'from-aurora-teal to-aurora-emerald',
  },
  {
    icon: Activity,
    title: 'SSL & DNS',
    label: 'Validate',
    desc: 'Track certificate expiry, DNS resolution, and TLS handshake health automatically.',
    color: 'from-aurora-violet to-aurora-teal',
  },
  {
    icon: Cpu,
    title: 'Deploy Tracking',
    label: 'Deploy',
    desc: 'Correlate deployments with performance changes. Know if your last push caused the outage.',
    color: 'from-aurora-indigo to-aurora-violet',
  },
  {
    icon: BarChart3,
    title: 'Analytics',
    label: 'Analyze',
    desc: 'Deep historical analytics, P95 latency tracking, and trend visualization across all endpoints.',
    color: 'from-aurora-emerald to-aurora-cyan',
  },
];

/* ─── Feature Node ───────────────────────────────────── */
function FeatureNode({
  feature, index, isActive, onClick,
}: {
  feature: typeof FEATURES[0];
  index: number;
  isActive: boolean;
  onClick: () => void;
}) {
  const Icon = feature.icon;

  return (
    <motion.button
      onClick={onClick}
      initial={{ opacity: 0, y: 30 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ delay: 0.1 * index, duration: 0.6, ease: [0.19, 1, 0.22, 1] }}
      whileHover={{ scale: 1.05, y: -4 }}
      whileTap={{ scale: 0.98 }}
      className={`group relative p-6 rounded-2xl text-left transition-all duration-300 cursor-pointer
        ${isActive
          ? 'bg-white/[0.08] border-white/[0.15] shadow-glow-teal'
          : 'bg-white/[0.02] border-white/[0.06] hover:bg-white/[0.05] hover:border-white/[0.1]'
        } border backdrop-blur-sm`}
    >
      {/* Gradient border glow when active */}
      {isActive && (
        <motion.div
          layoutId="feature-glow"
          className={`absolute -inset-px rounded-2xl bg-gradient-to-br ${feature.color} opacity-20`}
          transition={{ type: 'spring', stiffness: 400, damping: 30 }}
        />
      )}

      <div className="relative z-10">
        <div className={`inline-flex items-center justify-center w-10 h-10 rounded-xl mb-4
          ${isActive ? `bg-gradient-to-br ${feature.color} shadow-glow-teal` : 'bg-white/[0.06]'}`}
        >
          <Icon className={`w-5 h-5 ${isActive ? 'text-void-950' : 'text-white/60 group-hover:text-white/80'} transition-colors`} />
        </div>
        <h3 className={`text-sm font-bold mb-1 ${isActive ? 'text-white' : 'text-white/70'} transition-colors`}>
          {feature.title}
        </h3>
        <p className="text-[11px] text-white/30 uppercase tracking-wider font-semibold">
          {feature.label}
        </p>
      </div>
    </motion.button>
  );
}

/* ─── Feature Detail Panel ───────────────────────────── */
function FeatureDetail({ feature }: { feature: typeof FEATURES[0] }) {
  const Icon = feature.icon;

  return (
    <motion.div
      key={feature.title}
      initial={{ opacity: 0, y: 20, filter: 'blur(8px)' }}
      animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
      exit={{ opacity: 0, y: -10, filter: 'blur(8px)' }}
      transition={{ duration: 0.4, ease: [0.19, 1, 0.22, 1] }}
      className="p-8 md:p-10 rounded-3xl bg-white/[0.03] border border-white/[0.08] backdrop-blur-xl"
    >
      <div className={`inline-flex items-center justify-center w-14 h-14 rounded-2xl
        bg-gradient-to-br ${feature.color} shadow-glow-teal mb-6`}>
        <Icon className="w-7 h-7 text-void-950" />
      </div>

      <h3 className="text-2xl md:text-3xl font-bold text-white mb-3">{feature.title}</h3>
      <p className="text-white/50 text-lg leading-relaxed max-w-lg">{feature.desc}</p>

      {/* Visual flourish — connection lines */}
      <div className="mt-8 flex items-center gap-3">
        <div className={`h-[2px] w-12 bg-gradient-to-r ${feature.color} rounded-full`} />
        <div className={`h-[2px] w-6 bg-gradient-to-r ${feature.color} rounded-full opacity-50`} />
        <div className={`h-[2px] w-3 bg-gradient-to-r ${feature.color} rounded-full opacity-25`} />
      </div>
    </motion.div>
  );
}

/* ─── Main Feature Constellation ─────────────────────── */
export default function FeatureConstellation() {
  const [activeIndex, setActiveIndex] = useState(0);
  const ref = useRef<HTMLElement>(null);
  useInView(ref, { once: true, amount: 0.2 });

  return (
    <section
      ref={ref}
      id="features"
      className="relative py-32 px-6 bg-void-950 overflow-hidden"
    >
      {/* Background */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px]
        bg-aurora-violet/3 blur-[200px] rounded-full pointer-events-none" />

      <div className="max-w-6xl mx-auto relative">
        {/* Section header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="text-center mb-20"
        >
          <span className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full
            bg-aurora-violet/10 border border-aurora-violet/20 text-aurora-violet
            text-[10px] font-bold tracking-[0.2em] uppercase mb-6">
            The Arsenal
          </span>
          <h2 className="text-3xl md:text-5xl font-black text-white tracking-tight mt-4">
            Everything you need.
            <br />
            <span className="text-white/30">Nothing you don't.</span>
          </h2>
        </motion.div>

        {/* Feature grid + detail */}
        <div className="grid lg:grid-cols-[1fr_1.2fr] gap-8 items-start">
          {/* Grid of feature nodes */}
          <div className="grid grid-cols-2 gap-3">
            {FEATURES.map((feature, i) => (
              <FeatureNode
                key={feature.title}
                feature={feature}
                index={i}
                isActive={i === activeIndex}
                onClick={() => setActiveIndex(i)}
              />
            ))}
          </div>

          {/* Detail panel */}
          <div className="lg:sticky lg:top-32">
            <AnimatePresence mode="wait">
              <FeatureDetail feature={FEATURES[activeIndex]} />
            </AnimatePresence>
          </div>
        </div>
      </div>
    </section>
  );
}
