import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Zap, ArrowRight } from 'lucide-react';

export default function FinalCta() {
  return (
    <section id="final-cta" className="relative py-32 md:py-48 px-6 bg-void-950 overflow-hidden">
      {/* Converging gradient lines */}
      <div className="absolute inset-0">
        <div className="absolute top-0 left-0 w-full h-full">
          {/* Aurora gradients converging */}
          <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-[600px] h-[400px]
            bg-aurora-teal/8 blur-[200px] rounded-full" />
          <div className="absolute bottom-[20%] left-[30%] w-[300px] h-[300px]
            bg-aurora-violet/5 blur-[150px] rounded-full" />
          <div className="absolute bottom-[10%] right-[30%] w-[250px] h-[250px]
            bg-aurora-emerald/5 blur-[120px] rounded-full" />
        </div>

        {/* Floating particles rising upward */}
        {[...Array(8)].map((_, i) => (
          <motion.div
            key={i}
            className="absolute w-1 h-1 rounded-full bg-aurora-teal/30"
            style={{
              left: `${15 + i * 10}%`,
              bottom: '10%',
            }}
            animate={{
              y: [0, -200 - i * 30],
              opacity: [0, 0.6, 0],
              scale: [0.5, 1, 0.3],
            }}
            transition={{
              duration: 4 + i * 0.5,
              repeat: Infinity,
              delay: i * 0.7,
              ease: 'easeOut',
            }}
          />
        ))}
      </div>

      <div className="max-w-4xl mx-auto relative text-center">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.8, ease: [0.19, 1, 0.22, 1] }}
        >
          <h2 className="text-4xl md:text-6xl lg:text-7xl font-black text-white tracking-tight leading-[1.1] mb-6">
            Your infrastructure
            <br />
            <span className="bg-gradient-to-r from-aurora-teal via-aurora-cyan to-aurora-emerald bg-clip-text text-transparent">
              deserves a guardian.
            </span>
          </h2>

          <p className="text-lg md:text-xl text-white/40 max-w-xl mx-auto mb-10 leading-relaxed">
            Stop discovering outages from angry users. Start knowing the moment something breaks.
          </p>

          {/* CTA with expanding ring */}
          <div className="relative inline-block">
            {/* Ring pulse */}
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <motion.div
                className="w-full h-full rounded-2xl border border-aurora-teal/20"
                animate={{ scale: [1, 1.15], opacity: [0.3, 0] }}
                transition={{ duration: 2, repeat: Infinity, ease: 'easeOut' }}
              />
            </div>

            <Link
              to="/register"
              id="final-cta-button"
              className="group relative inline-flex items-center gap-3 px-10 py-5 rounded-2xl
                text-lg font-bold text-void-950 overflow-hidden transition-all duration-300
                hover:-translate-y-1 hover:shadow-glow-teal"
            >
              <div className="absolute inset-0 bg-gradient-to-r from-aurora-teal via-aurora-cyan to-aurora-emerald rounded-2xl" />
              <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent
                -translate-x-full group-hover:translate-x-full transition-transform duration-700 ease-in-out" />
              <Zap className="relative w-5 h-5 fill-void-950" />
              <span className="relative">Start Your Free Trial</span>
              <ArrowRight className="relative w-5 h-5 group-hover:translate-x-1 transition-transform" />
            </Link>
          </div>

          <p className="mt-8 text-xs text-white/20 uppercase tracking-wider font-semibold">
            14-day trial • No credit card required • Cancel anytime
          </p>
        </motion.div>
      </div>
    </section>
  );
}
