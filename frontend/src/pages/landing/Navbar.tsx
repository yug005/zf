import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Menu, X } from 'lucide-react';
import { BrandLogo } from '../../components/BrandLogo';

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
            ? 'bg-void-950/80 backdrop-blur-xl border-b border-white/[0.06]'
            : 'bg-transparent'
        }`}
      >
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <Link to="/"><BrandLogo theme="dark" /></Link>

          <div className="hidden md:flex items-center gap-8 text-sm font-medium">
            {NAV_LINKS.map((l) => (
              <a key={l.label} href={l.href} onClick={(e) => handleClick(e, l.href)}
                className="text-white/40 hover:text-white transition-colors relative group">
                {l.label}
                <span className="absolute -bottom-1 left-0 w-0 h-px bg-aurora-teal group-hover:w-full transition-all duration-300" />
              </a>
            ))}
          </div>

          <div className="hidden md:flex items-center gap-4 text-sm font-medium">
            <Link to="/login" className="text-white/40 hover:text-white transition-colors">Sign In</Link>
            <Link to="/register" className="px-4 py-2 rounded-xl bg-white/[0.06] border border-white/[0.1] text-white/80 hover:bg-white/[0.1] hover:text-white transition-all">
              Get Started
            </Link>
          </div>

          <button onClick={() => setMobileOpen(!mobileOpen)} className="md:hidden p-2 text-white/60 hover:text-white">
            {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </motion.nav>

      <AnimatePresence>
        {mobileOpen && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-40 bg-void-950/95 backdrop-blur-xl md:hidden flex flex-col items-center justify-center gap-8">
            {NAV_LINKS.map((l, i) => (
              <motion.a key={l.label} href={l.href} onClick={(e) => handleClick(e, l.href)}
                initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 * i }}
                className="text-2xl font-bold text-white/60 hover:text-white transition-colors">{l.label}</motion.a>
            ))}
            <div className="flex gap-4 mt-4">
              <Link to="/login" onClick={() => setMobileOpen(false)} className="px-6 py-3 rounded-xl text-white/60 border border-white/10">Sign In</Link>
              <Link to="/register" onClick={() => setMobileOpen(false)} className="px-6 py-3 rounded-xl bg-gradient-to-r from-aurora-teal to-aurora-emerald text-void-950 font-bold">Get Started</Link>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
