import { useRef } from 'react';
import { motion, useInView } from 'framer-motion';
import { Zap, Bell, Activity, ArrowRight } from 'lucide-react';

/* Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬ Flow Stage Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬ */
function FlowStage({
  icon: Icon, title, subtitle, glowColor, delay,
}: {
  icon: typeof Zap; title: string; subtitle: string;
  glowColor: string; delay: number;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 40, scale: 0.9 }}
      whileInView={{ opacity: 1, y: 0, scale: 1 }}
      viewport={{ once: true }}
      transition={{ delay, duration: 0.7, ease: [0.19, 1, 0.22, 1] }}
      className="relative group"
    >
      <div className={`absolute -inset-4 ${glowColor} blur-[60px] rounded-full opacity-0
        group-hover:opacity-100 transition-opacity duration-700 pointer-events-none`} />

      <div className="relative p-8 rounded-3xl bg-white/[0.03] border border-white/[0.08]
        backdrop-blur-sm hover:bg-white/[0.06] hover:border-white/[0.12]
        transition-all duration-500 text-center">
        <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl
          bg-gradient-to-br from-aurora-teal to-aurora-emerald mb-6
          shadow-glow-teal group-hover:shadow-[0_0_40px_rgba(45,212,191,0.3)]
          transition-shadow duration-500">
          <Icon className="w-7 h-7 text-void-950" />
        </div>
        <h3 className="text-xl font-bold text-white mb-2">{title}</h3>
        <p className="text-sm text-white/40 leading-relaxed">{subtitle}</p>
      </div>
    </motion.div>
  );
}

/* Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬ Connection Line Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬ */
function ConnectionLine({ delay }: { delay: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, scaleX: 0 }}
      whileInView={{ opacity: 1, scaleX: 1 }}
      viewport={{ once: true }}
      transition={{ delay, duration: 0.6, ease: 'easeOut' }}
      style={{ transformOrigin: 'left' }}
      className="hidden md:flex items-center justify-center"
    >
      <div className="w-full h-[1px] bg-gradient-to-r from-aurora-teal/40 to-aurora-emerald/20 relative">
        {/* Animated pulse along the line */}
        <motion.div
          className="absolute top-1/2 -translate-y-1/2 w-8 h-[2px]
            bg-gradient-to-r from-transparent via-aurora-teal to-transparent rounded-full"
          animate={{ x: ['-100%', '500%'] }}
          transition={{ duration: 3, repeat: Infinity, ease: 'linear', delay: delay + 0.5 }}
        />
      </div>
    </motion.div>
  );
}

/* Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬ Main Architecture Section Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬ */
export default function ArchitectureFlow() {
  const ref = useRef<HTMLElement>(null);
  useInView(ref, { once: true, amount: 0.3 });

  const stages = [
    {
      icon: Zap,
      title: '1. Drop your URL',
      subtitle: 'Just paste your endpoint. No SDKs, no config files, no deployment steps.',
      glowColor: 'bg-aurora-teal/10',
    },
    {
      icon: Activity,
      title: '2. We monitor everything',
      subtitle: 'HTTP status, latency, SSL, DNS, response body - every dimension of health.',
      glowColor: 'bg-aurora-cyan/10',
    },
    {
      icon: Bell,
      title: '3. You get instant alerts',
      subtitle: 'Slack, Email, Discord - the second something breaks, your team knows.',
      glowColor: 'bg-aurora-emerald/10',
    },
  ];

  return (
    <section
      ref={ref}
      id="how-it-works"
      className="relative py-32 px-6 bg-void-950 overflow-hidden"
    >
      {/* Background */}
      <div className="absolute top-0 right-0 w-[500px] h-[500px]
        bg-aurora-emerald/3 blur-[200px] rounded-full pointer-events-none" />

      <div className="max-w-5xl mx-auto relative">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="text-center mb-20"
        >
          <span className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full
            bg-aurora-emerald/10 border border-aurora-emerald/20 text-aurora-emerald
            text-[10px] font-bold tracking-[0.2em] uppercase mb-6">
            How It Works
          </span>
          <h2 className="text-3xl md:text-5xl font-black text-white tracking-tight mt-4">
            Three steps.{' '}
            <span className="bg-gradient-to-r from-aurora-teal to-aurora-emerald bg-clip-text text-transparent">
              120 seconds.
            </span>
          </h2>
          <p className="mt-4 text-white/40 text-lg max-w-md mx-auto">
            From zero to fully monitored infrastructure.
          </p>
        </motion.div>

        {/* Flow */}
        <div className="grid md:grid-cols-[1fr_auto_1fr_auto_1fr] gap-4 md:gap-2 items-center">
          <FlowStage {...stages[0]} delay={0.2} />
          <ConnectionLine delay={0.5} />
          <FlowStage {...stages[1]} delay={0.4} />
          <ConnectionLine delay={0.7} />
          <FlowStage {...stages[2]} delay={0.6} />
        </div>

        {/* CTA */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ delay: 1, duration: 0.6 }}
          className="mt-16 text-center"
        >
          <a
            href="/how-to-use"
            className="group inline-flex items-center gap-2 px-6 py-3 rounded-xl
              bg-white/[0.04] border border-white/[0.08] text-sm font-semibold text-white/60
              hover:bg-white/[0.08] hover:text-white hover:border-white/[0.15]
              transition-all duration-300"
          >
            Read the full guide
            <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
          </a>
        </motion.div>
      </div>
    </section>
  );
}
