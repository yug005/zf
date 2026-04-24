import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Menu, X } from 'lucide-react';
import { BrandLogo } from '../../components/BrandLogo';
import { ModeToggle } from '../../components/ModeToggle';

const NAV_LINKS = [
  { label: 'Features', href: '#features' },
  { label: 'Pricing', href: '#pricing' },
  { label: 'How it Works', href: '#how-it-works' },
  { label: 'FAQ', href: '#faq' },
];

export default function Navbar() {
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 50);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const handleClick = (e: React.MouseEvent<HTMLAnchorElement>, href: string) => {
    if (href.startsWith('#')) {
      e.preventDefault();
      document.querySelector(href)?.scrollIntoView({ behavior: 'smooth' });
      setMobileOpen(false);
    }
  };

  return (
    <>
      <motion.nav
        initial={{ y: -20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.6, ease: [0.19, 1, 0.22, 1] }}
        className={`fixed top-0 inset-x-0 z-50 transition-all duration-500 ${
          scrolled
            ? 'bg-white/80 dark:bg-void-950/80 backdrop-blur-xl border-b border-slate-200/60 dark:border-white/[0.06]'
            : 'bg-transparent'
        }`}
      >
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <Link to="/"><BrandLogo /></Link>

          <div className="hidden md:flex items-center gap-8 text-sm font-medium">
            {NAV_LINKS.map((l) => (
              <a key={l.label} href={l.href} onClick={(e) => handleClick(e, l.href)}
                className="text-slate-500 dark:text-white/40 hover:text-slate-900 dark:hover:text-white transition-colors relative group">
                {l.label}
                <span className="absolute -bottom-1 left-0 w-0 h-px bg-aurora-teal group-hover:w-full transition-all duration-300" />
              </a>
            ))}
          </div>

          <div className="hidden md:flex items-center gap-4 text-sm font-medium">
            <ModeToggle />
            <Link to="/login" className="text-slate-500 dark:text-white/40 hover:text-slate-900 dark:hover:text-white transition-colors">Sign In</Link>
            <Link to="/register" className="px-4 py-2 rounded-xl bg-slate-100 dark:bg-white/[0.06] border border-slate-200 dark:border-white/[0.1] text-slate-700 dark:text-white/80 hover:bg-slate-200 dark:hover:bg-white/[0.1] hover:text-slate-900 dark:hover:text-white transition-all">
              Get Started
            </Link>
          </div>

          <button onClick={() => setMobileOpen(!mobileOpen)} className="md:hidden p-2 text-slate-500 dark:text-white/60 hover:text-slate-900 dark:hover:text-white">
            {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </motion.nav>

      <AnimatePresence>
        {mobileOpen && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-40 bg-white/95 dark:bg-void-950/95 backdrop-blur-xl md:hidden flex flex-col items-center justify-center gap-8">
            {NAV_LINKS.map((l, i) => (
              <motion.a key={l.label} href={l.href} onClick={(e) => handleClick(e, l.href)}
                initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 * i }}
                className="text-2xl font-bold text-slate-500 dark:text-white/60 hover:text-slate-900 dark:hover:text-white transition-colors">{l.label}</motion.a>
            ))}
            <div className="mt-2">
              <ModeToggle />
            </div>
            <div className="flex gap-4 mt-4">
              <Link to="/login" onClick={() => setMobileOpen(false)} className="px-6 py-3 rounded-xl text-slate-500 dark:text-white/60 border border-slate-200 dark:border-white/10">Sign In</Link>
              <Link to="/register" onClick={() => setMobileOpen(false)} className="px-6 py-3 rounded-xl bg-gradient-to-r from-aurora-teal to-aurora-emerald text-void-950 font-bold">Get Started</Link>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
