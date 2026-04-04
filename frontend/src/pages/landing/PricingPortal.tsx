import { useState, useRef } from 'react';
import { Link } from 'react-router-dom';
import { motion, useInView } from 'framer-motion';
import { CheckCircle, ArrowRight, Sparkles } from 'lucide-react';
import { EnterpriseContactForm } from '../../components/EnterpriseContactForm';

const PLANS = [
  {
    name: 'Trial',
    price: '0',
    period: '14 days',
    monitors: '5 monitors',
    apiKeys: '2 API keys',
    interval: '300s interval',
    popular: false,
    cta: 'Start Free Trial',
  },
  {
    name: 'Lite',
    price: '149',
    period: '/month',
    monitors: '5 monitors',
    apiKeys: '2 API keys',
    interval: '300s interval',
    popular: false,
    cta: 'Choose Lite',
  },
  {
    name: 'Pro',
    price: '499',
    period: '/month',
    monitors: '50 monitors',
    apiKeys: '10 API keys',
    interval: '60s interval',
    popular: true,
    cta: 'Choose Pro',
  },
  {
    name: 'Business',
    price: '1499',
    period: '/month',
    monitors: '200 monitors',
    apiKeys: '50 API keys',
    interval: '30s interval',
    popular: false,
    cta: 'Choose Business',
  },
];

/* ─── Pricing Card ───────────────────────────────────── */
function PricingCard({
  plan, index,
}: {
  plan: typeof PLANS[0]; index: number;
}) {
  const [isHovered, setIsHovered] = useState(false);

  return (
    <motion.div
      initial={{ opacity: 0, y: 40 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ delay: 0.1 * index, duration: 0.7, ease: [0.19, 1, 0.22, 1] }}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      className="relative group"
    >
      {/* Popular glow ring */}
      {plan.popular && (
        <div className="absolute -inset-px rounded-3xl bg-gradient-to-b from-aurora-teal/40 via-aurora-cyan/20 to-aurora-emerald/40 opacity-60" />
      )}

      <div
        className={`relative h-full p-8 rounded-3xl backdrop-blur-sm transition-all duration-500
          ${plan.popular
            ? 'bg-white/[0.06] border-transparent'
            : `bg-white/[0.02] border border-white/[0.06]
               ${isHovered ? 'bg-white/[0.05] border-white/[0.12] -translate-y-1' : ''}`
          }`}
      >
        {plan.popular && (
          <div className="absolute -top-3 right-6 px-3 py-1 rounded-full
            bg-gradient-to-r from-aurora-teal to-aurora-emerald
            text-void-950 text-[10px] font-bold uppercase tracking-wider
            flex items-center gap-1 shadow-glow-teal">
            <Sparkles className="w-3 h-3" />
            Most Popular
          </div>
        )}

        <div className="mb-6">
          <h3 className="text-xl font-bold text-white">{plan.name}</h3>
          <div className="mt-4 flex items-baseline gap-1">
            <span className="text-xs text-white/30 font-semibold uppercase tracking-wider">INR</span>
            <span className="text-4xl font-black text-white tracking-tight">{plan.price}</span>
            <span className="text-white/30 font-medium">{plan.period}</span>
          </div>
        </div>

        <ul className="space-y-3 mb-8">
          {[plan.monitors, plan.apiKeys, plan.interval].map((item, i) => (
            <li key={i} className="flex items-center gap-3 text-sm text-white/60">
              <CheckCircle className={`w-4 h-4 shrink-0 ${plan.popular ? 'text-aurora-teal' : 'text-white/30'}`} />
              {item}
            </li>
          ))}
        </ul>

        <Link
          to="/register"
          className={`flex items-center justify-center gap-2 w-full py-3.5 rounded-xl
            text-sm font-bold transition-all duration-300
            ${plan.popular
              ? 'bg-gradient-to-r from-aurora-teal to-aurora-emerald text-void-950 hover:shadow-glow-teal'
              : 'bg-white/[0.06] text-white/70 border border-white/[0.1] hover:bg-white/[0.1] hover:text-white'
            }`}
        >
          {plan.cta}
          <ArrowRight className="w-4 h-4" />
        </Link>
      </div>
    </motion.div>
  );
}

/* ─── Main Pricing Section ───────────────────────────── */
export default function PricingPortal() {
  const ref = useRef<HTMLElement>(null);
  useInView(ref, { once: true, amount: 0.2 });

  return (
    <section
      ref={ref}
      id="pricing"
      className="relative py-32 px-6 bg-void-950 overflow-hidden"
    >
      {/* Background */}
      <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-[800px] h-[400px]
        bg-aurora-teal/4 blur-[200px] rounded-full pointer-events-none" />

      <div className="max-w-6xl mx-auto relative">
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
            Pricing
          </span>
          <h2 className="text-3xl md:text-5xl font-black text-white tracking-tight mt-4">
            Fair pricing that{' '}
            <span className="bg-gradient-to-r from-aurora-teal to-aurora-emerald bg-clip-text text-transparent">
              scales with you
            </span>
          </h2>
          <p className="mt-4 text-white/40 text-lg max-w-md mx-auto">
            Simple INR pricing. No hidden fees. Cancel anytime.
          </p>
        </motion.div>

        <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-4">
          {PLANS.map((plan, i) => (
            <PricingCard key={plan.name} plan={plan} index={i} />
          ))}
        </div>

        {/* Enterprise */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ delay: 0.5, duration: 0.6 }}
          className="mt-8"
        >
          <EnterpriseContactForm />
        </motion.div>

        {/* Link to full pricing */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ delay: 0.7, duration: 0.6 }}
          className="mt-10 text-center"
        >
          <Link
            to="/pricing"
            className="group inline-flex items-center gap-2 px-6 py-3 rounded-xl
              bg-white/[0.04] border border-white/[0.08] text-sm font-semibold text-white/60
              hover:bg-white/[0.08] hover:text-white hover:border-white/[0.15]
              transition-all duration-300"
          >
            View full pricing details
            <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
          </Link>
        </motion.div>
      </div>
    </section>
  );
}
