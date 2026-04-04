import { useEffect, useRef, useState } from 'react';
import { motion, useInView } from 'framer-motion';
import { Zap } from 'lucide-react';

/* ─── Animated Counter ───────────────────────────────── */
function AnimatedCounter({
  target, suffix = '', inView,
}: { target: number; suffix?: string; inView: boolean }) {
  const [count, setCount] = useState(0);

  useEffect(() => {
    if (!inView) return;
    const duration = 2000;
    const start = performance.now();

    function step(timestamp: number) {
      const elapsed = timestamp - start;
      const progress = Math.min(elapsed / duration, 1);
      // Ease out cubic
      const eased = 1 - Math.pow(1 - progress, 3);
      setCount(Math.round(target * eased));
      if (progress < 1) {
        requestAnimationFrame(step);
      }
    }

    requestAnimationFrame(step);
  }, [inView, target]);

  return (
    <span className="tabular-nums">
      {count}{suffix}
    </span>
  );
}

/* ─── Radar Pulse Rings ──────────────────────────────── */
function RadarPulse({ inView }: { inView: boolean }) {
  if (!inView) return null;

  return (
    <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
      {[0, 0.6, 1.2].map((delay, i) => (
        <motion.div
          key={i}
          className="absolute w-48 h-48 rounded-full border border-aurora-teal/20"
          initial={{ scale: 0.3, opacity: 0.6 }}
          animate={{ scale: 3, opacity: 0 }}
          transition={{
            duration: 3,
            delay,
            repeat: Infinity,
            ease: 'easeOut',
          }}
        />
      ))}
    </div>
  );
}

/* ─── Main Speed Section ─────────────────────────────── */
export default function SpeedSection() {
  const ref = useRef<HTMLElement>(null);
  const isInView = useInView(ref, { once: true, amount: 0.5 });

  return (
    <section
      ref={ref}
      id="speed-section"
      className="relative py-32 md:py-48 px-6 bg-void-950 overflow-hidden"
    >
      {/* Background gradient */}
      <div className="absolute inset-0">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2
          w-[600px] h-[600px] bg-aurora-teal/5 blur-[200px] rounded-full" />
      </div>

      <div className="max-w-4xl mx-auto relative text-center">
        <RadarPulse inView={isInView} />

        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          whileInView={{ opacity: 1, scale: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.8, ease: [0.19, 1, 0.22, 1] }}
          className="relative z-10"
        >
          <div className="inline-flex items-center gap-2 px-3 py-1.5 mb-8 rounded-full
            bg-aurora-teal/10 border border-aurora-teal/20 text-aurora-teal
            text-[10px] font-bold tracking-[0.2em] uppercase">
            <Zap className="w-3 h-3" />
            Detection Speed
          </div>

          {/* Big number */}
          <div className="text-8xl md:text-[10rem] font-black text-white leading-none tracking-tighter
            animate-counter-glow mb-4">
            <AnimatedCounter target={142} suffix="ms" inView={isInView} />
          </div>

          <p className="text-xl md:text-2xl text-white/40 font-medium max-w-lg mx-auto">
            Average time from API failure to alert delivery.
            <br />
            <span className="text-white/60">Not 142 minutes. Milliseconds.</span>
          </p>

          {/* Stats row */}
          <div className="mt-16 grid grid-cols-3 gap-8 max-w-2xl mx-auto">
            {[
              { label: 'Time to Detect', value: 42, suffix: 'ms' },
              { label: 'Time to Alert', value: 100, suffix: 'ms' },
              { label: 'False Positive Rate', value: 0, suffix: '%' },
            ].map((stat, i) => (
              <motion.div
                key={stat.label}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: 0.8 + i * 0.15, duration: 0.6 }}
                className="text-center"
              >
                <div className="text-3xl md:text-4xl font-bold text-aurora-teal mb-2">
                  <AnimatedCounter target={stat.value} suffix={stat.suffix} inView={isInView} />
                </div>
                <div className="text-xs text-white/30 uppercase tracking-wider font-semibold">
                  {stat.label}
                </div>
              </motion.div>
            ))}
          </div>
        </motion.div>
      </div>
    </section>
  );
}
