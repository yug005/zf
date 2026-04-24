import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion, useMotionValue, useSpring, useTransform } from 'framer-motion';
import { ArrowRight } from 'lucide-react';

/* â”€â”€â”€ Animated Grid Background â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */
function GridBackground() {
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      {/* Base noise texture */}
      <div
        className="absolute inset-0 opacity-[0.03]"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)' opacity='0.5'/%3E%3C/svg%3E")`,
        }}
      />

      {/* Gradient mesh  */}
      <div className="absolute top-[-20%] left-[-10%] w-[60%] h-[70%] rounded-full bg-aurora-teal/10 blur-[150px]" />
      <div className="absolute top-[10%] right-[-10%] w-[50%] h-[60%] rounded-full bg-aurora-violet/8 blur-[150px]" />
      <div className="absolute bottom-[-20%] left-[20%] w-[50%] h-[50%] rounded-full bg-aurora-emerald/6 blur-[120px]" />

      {/* Grid lines */}
      <svg className="absolute inset-0 w-full h-full opacity-[0.04]" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <pattern id="hero-grid" width="60" height="60" patternUnits="userSpaceOnUse">
            <path d="M 60 0 L 0 0 0 60" fill="none" stroke="white" strokeWidth="0.5" />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#hero-grid)" />
      </svg>

      {/* Floating orbs */}
      <motion.div
        className="absolute w-3 h-3 rounded-full bg-aurora-teal/40 blur-[1px]"
        style={{ top: '20%', left: '15%' }}
        animate={{ y: [0, -30, 0], x: [0, 15, 0], opacity: [0.3, 0.7, 0.3] }}
        transition={{ duration: 7, repeat: Infinity, ease: 'easeInOut' }}
      />
      <motion.div
        className="absolute w-2 h-2 rounded-full bg-aurora-violet/50 blur-[1px]"
        style={{ top: '60%', right: '20%' }}
        animate={{ y: [0, -25, 0], x: [0, -10, 0], opacity: [0.2, 0.6, 0.2] }}
        transition={{ duration: 9, repeat: Infinity, ease: 'easeInOut', delay: 2 }}
      />
      <motion.div
        className="absolute w-2 h-2 rounded-full bg-aurora-emerald/40 blur-[1px]"
        style={{ top: '40%', left: '70%' }}
        animate={{ y: [0, -20, 0], x: [0, 12, 0], opacity: [0.3, 0.5, 0.3] }}
        transition={{ duration: 6, repeat: Infinity, ease: 'easeInOut', delay: 1 }}
      />
    </div>
  );
}

/* â”€â”€â”€ Floating Status Badge â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */
function StatusBadge() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20, scale: 0.9 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ delay: 1.2, duration: 0.8, ease: [0.19, 1, 0.22, 1] }}
      className="inline-flex items-center gap-2.5 px-4 py-2 rounded-full
        bg-white/[0.04] border border-white/[0.08] backdrop-blur-md
        shadow-[0_0_30px_rgba(45,212,191,0.06)]"
    >
      <span className="relative flex h-2.5 w-2.5">
        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-aurora-emerald opacity-60" />
        <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-aurora-emerald" />
      </span>
      <span className="text-xs font-semibold text-white/70 tracking-wider uppercase">
        All Systems Operational
      </span>
    </motion.div>
  );
}

/* â”€â”€â”€ Floating Dashboard Card â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */
function FloatingCard({
  title, method, status, color, delay, className,
}: {
  title: string; method: string; status: string;
  color: 'teal' | 'red'; delay: number; className?: string;
}) {
  const bg = color === 'teal'
    ? 'bg-aurora-teal/10 border-aurora-teal/20'
    : 'bg-red-500/10 border-red-500/20';
  const badge = color === 'teal'
    ? 'bg-aurora-teal/20 text-aurora-teal'
    : 'bg-red-500/20 text-red-400 animate-pulse';

  return (
    <motion.div
      initial={{ opacity: 0, y: 30, rotateX: 15 }}
      animate={{ opacity: 1, y: 0, rotateX: 0 }}
      transition={{ delay, duration: 1, ease: [0.19, 1, 0.22, 1] }}
      className={`absolute ${className}`}
    >
      <motion.div
        animate={{ y: [0, -8, 0] }}
        transition={{ duration: 5 + delay, repeat: Infinity, ease: 'easeInOut' }}
        className={`flex items-center gap-3 px-4 py-3 rounded-xl border ${bg}
          backdrop-blur-xl shadow-glass`}
      >
        <div>
          <div className="text-[11px] font-semibold text-white/80">{title}</div>
          <div className="text-[10px] font-mono text-white/40 mt-0.5">{method}</div>
        </div>
        <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold tracking-wider ${badge}`}>
          {status}
        </span>
      </motion.div>
    </motion.div>
  );
}

/* â”€â”€â”€ Headline Word Animation â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */
function AnimatedHeadline() {
  const line1Words = ['Stop', 'guessing.'];
  const line2Words = ['Start', 'knowing.'];

  return (
    <h1 className="text-5xl sm:text-6xl md:text-7xl lg:text-8xl font-black tracking-tight leading-[1.05]">
      <span className="block">
        {line1Words.map((word, i) => (
          <motion.span
            key={`l1-${i}`}
            initial={{ opacity: 0, y: 40, filter: 'blur(10px)' }}
            animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
            transition={{
              delay: 0.3 + i * 0.15,
              duration: 0.8,
              ease: [0.19, 1, 0.22, 1],
            }}
            className="inline-block mr-[0.3em] text-white"
          >
            {word}
          </motion.span>
        ))}
      </span>
      <span className="block mt-1">
        {line2Words.map((word, i) => (
          <motion.span
            key={`l2-${i}`}
            initial={{ opacity: 0, y: 40, filter: 'blur(10px)' }}
            animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
            transition={{
              delay: 0.6 + i * 0.15,
              duration: 0.8,
              ease: [0.19, 1, 0.22, 1],
            }}
            className={`inline-block mr-[0.3em] ${
              i === 1
                ? 'bg-gradient-to-r from-aurora-teal via-aurora-cyan to-aurora-emerald bg-clip-text text-transparent'
                : 'text-white/40'
            }`}
          >
            {word}
          </motion.span>
        ))}
      </span>
    </h1>
  );
}

/* â”€â”€â”€ Main Hero Export â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */
export default function HeroSection() {
  const containerRef = useRef<HTMLDivElement>(null);
  const mouseX = useMotionValue(0);
  const mouseY = useMotionValue(0);

  const smoothX = useSpring(mouseX, { stiffness: 50, damping: 20 });
  const smoothY = useSpring(mouseY, { stiffness: 50, damping: 20 });

  const bgX = useTransform(smoothX, [-0.5, 0.5], [-15, 15]);
  const bgY = useTransform(smoothY, [-0.5, 0.5], [-15, 15]);
  const fgX = useTransform(smoothX, [-0.5, 0.5], [20, -20]);
  const fgY = useTransform(smoothY, [-0.5, 0.5], [20, -20]);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      mouseX.set((e.clientX - rect.left) / rect.width - 0.5);
      mouseY.set((e.clientY - rect.top) / rect.height - 0.5);
    };
    window.addEventListener('mousemove', handleMouseMove);
    return () => window.removeEventListener('mousemove', handleMouseMove);
  }, [mouseX, mouseY]);

  return (
    <section
      ref={containerRef}
      id="hero-section"
      className="relative min-h-screen flex items-center justify-center overflow-hidden"
    >
      {/* Parallax background layer */}
      <motion.div style={{ x: bgX, y: bgY }} className="absolute inset-0">
        <GridBackground />
      </motion.div>

      {/* Foreground floating cards (parallax opposite) */}
      <motion.div style={{ x: fgX, y: fgY }} className="absolute inset-0 hidden lg:block">
        <FloatingCard
          title="Auth API"
          method="POST /v1/auth"
          status="UP"
          color="teal"
          delay={1.5}
          className="top-[22%] left-[8%]"
        />
        <FloatingCard
          title="Webhook Stripe"
          method="POST /webhooks"
          status="DOWN"
          color="red"
          delay={1.8}
          className="top-[35%] right-[6%]"
        />
        <FloatingCard
          title="Health API"
          method="GET /health"
          status="UP"
          color="teal"
          delay={2.1}
          className="bottom-[25%] left-[12%]"
        />
      </motion.div>

      {/* Content */}
      <div className="relative z-10 max-w-5xl mx-auto px-6 text-center pt-32 pb-20">
        <StatusBadge />

        <div className="mt-10">
          <AnimatedHeadline />
        </div>

        <motion.p
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.9, duration: 0.8, ease: [0.19, 1, 0.22, 1] }}
          className="mt-8 text-lg md:text-xl text-white/50 max-w-2xl mx-auto leading-relaxed font-medium"
        >
          Real-time uptime monitoring, millisecond alerts, and incident visibility
          for the teams that ship fast and can't afford to break.
        </motion.p>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 1.1, duration: 0.8, ease: [0.19, 1, 0.22, 1] }}
          className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4"
        >
          <Link
            to="/register"
            id="hero-cta-primary"
            className="group relative inline-flex items-center gap-2.5 px-8 py-4 rounded-2xl
              text-base font-bold text-void-950 overflow-hidden transition-all duration-300
              hover:-translate-y-0.5 hover:shadow-glow-teal"
          >
            {/* Button gradient bg */}
            <div className="absolute inset-0 bg-gradient-to-r from-aurora-teal via-aurora-cyan to-aurora-emerald rounded-2xl" />
            {/* Shimmer overlay */}
            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent
              -translate-x-full group-hover:translate-x-full transition-transform duration-700 ease-in-out" />
            <span className="relative">Start Monitoring Free</span>
            <ArrowRight className="relative w-4 h-4 group-hover:translate-x-1 transition-transform" />
          </Link>

          <button
            onClick={() => document.getElementById('live-dashboard')?.scrollIntoView({ behavior: 'smooth' })}
            id="hero-cta-secondary"
            className="group inline-flex items-center gap-2.5 px-8 py-4 rounded-2xl
              text-base font-semibold text-white/70 border border-white/10
              bg-white/[0.03] backdrop-blur-sm
              hover:bg-white/[0.06] hover:border-white/20 hover:text-white
              transition-all duration-300"
          >
            <span className="w-2 h-2 rounded-full bg-aurora-teal/60 group-hover:bg-aurora-teal transition-colors" />
            See it in action
          </button>
        </motion.div>

        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1.5, duration: 1 }}
          className="mt-8 text-xs font-medium text-white/30 tracking-wider uppercase"
        >
          No credit card | 14-day trial | Setup in 120 seconds
        </motion.p>
      </div>

      {/* Bottom gradient fade */}
      <div className="absolute bottom-0 inset-x-0 h-32 bg-gradient-to-t from-[var(--color-surface-base)] to-transparent pointer-events-none" />
    </section>
  );
}
