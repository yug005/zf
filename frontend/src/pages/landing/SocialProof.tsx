import { useRef } from 'react';
import { motion, useInView } from 'framer-motion';
import { Github } from 'lucide-react';

/* ─── Social Proof / Founder Section ─────────────────── */
export default function SocialProof() {
  const ref = useRef<HTMLElement>(null);
  const isInView = useInView(ref, { once: true, amount: 0.4 });

  const trustBadges = [
    '14-day free trial',
    'No credit card',
    '99.94% SLA',
    'SOC-2 ready',
    'GDPR friendly',
  ];

  return (
    <section
      ref={ref}
      id="social-proof"
      className="relative py-32 px-6 bg-void-950 overflow-hidden"
    >
      {/* Noise texture */}
      <div
        className="absolute inset-0 opacity-[0.02]"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)' opacity='0.5'/%3E%3C/svg%3E")`,
        }}
      />

      {/* Background glow */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2
        w-[500px] h-[300px] bg-aurora-violet/4 blur-[150px] rounded-full pointer-events-none" />

      <div className="max-w-4xl mx-auto relative">
        {/* Floating trust badges */}
        <div className="flex flex-wrap justify-center gap-3 mb-16">
          {trustBadges.map((badge, i) => (
            <motion.span
              key={badge}
              initial={{ opacity: 0, y: 20 }}
              animate={isInView ? { opacity: 1, y: 0 } : {}}
              transition={{ delay: 0.1 * i, duration: 0.5 }}
              className="px-4 py-2 rounded-full bg-white/[0.03] border border-white/[0.08]
                text-[11px] font-semibold text-white/40 uppercase tracking-wider backdrop-blur-sm"
            >
              {badge}
            </motion.span>
          ))}
        </div>

        {/* Quote */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.8, ease: [0.19, 1, 0.22, 1] }}
          className="relative p-10 md:p-16 rounded-3xl bg-white/[0.02] border border-white/[0.06]
            backdrop-blur-xl"
        >
          {/* Decorative quote */}
          <div className="absolute top-8 left-8 text-white/[0.04] pointer-events-none">
            <svg className="w-20 h-20" fill="currentColor" viewBox="0 0 32 32">
              <path d="M10 8c-3.3 0-6 2.7-6 6v10h10V14H6c0-1.1.9-2 2-2h2V8zm14 0c-3.3 0-6 2.7-6 6v10h10V14h-8c0-1.1.9-2 2-2h2V8z" />
            </svg>
          </div>

          <div className="relative z-10">
            <blockquote className="text-2xl md:text-3xl lg:text-4xl font-bold text-white/90 leading-snug tracking-tight mb-10">
              "I built Zer0Friction because I was tired of discovering API failures through
              <span className="bg-gradient-to-r from-aurora-teal to-aurora-emerald bg-clip-text text-transparent"> angry user complaints</span>
              {' '}instead of real-time alerts."
            </blockquote>

            <div className="flex items-center justify-between pt-8 border-t border-white/[0.06]">
              <div>
                <div className="text-lg font-bold text-white">Yug Arora</div>
                <div className="text-sm text-white/40 font-medium">Founder & Backend Engineer</div>
              </div>
              <a
                href="https://github.com/yug005"
                target="_blank"
                rel="noreferrer"
                className="p-3 rounded-xl bg-white/[0.04] border border-white/[0.08]
                  text-white/40 hover:text-white hover:bg-white/[0.08] hover:border-white/[0.12]
                  transition-all duration-300"
                title="View Yug's GitHub"
              >
                <Github className="w-5 h-5" />
              </a>
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
