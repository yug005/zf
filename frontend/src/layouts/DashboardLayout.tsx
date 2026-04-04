import { useEffect, useState } from 'react';
import { Outlet, NavLink, useLocation, useNavigate } from 'react-router-dom';
import { LayoutDashboard, Activity, CreditCard, Key, LogOut, Globe, ShieldAlert, GitBranch, Menu, X } from 'lucide-react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import { ModeToggle } from '../components/ModeToggle';
import { NotificationBell } from '../components/NotificationBell';
import { fetchCurrentUser } from '../services/current-user';
import { QuickStartCard } from '../components/QuickStartCard';
import { logoutSession } from '../services/api';
import { PageMeta } from '../components/PageMeta';
import { BrandLogo } from '../components/BrandLogo';

// Lightweight alternative to clsx/tailwind-merge for simple templates
function classNames(...classes: (string | undefined | null | false)[]) {
  return classes.filter(Boolean).join(' ');
}

export default function DashboardLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  const queryClient = useQueryClient();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const { data: currentUser, isLoading: isUserLoading, isError: isUserError } = useQuery({
    queryKey: ['currentUser'],
    queryFn: fetchCurrentUser,
    staleTime: 60_000,
    retry: false,
  });

  useEffect(() => {
    if (!isUserLoading && (isUserError || !currentUser)) {
      navigate('/login');
    }
  }, [currentUser, isUserLoading, isUserError, navigate]);

  useEffect(() => {
    setMobileMenuOpen(false);
  }, [location.pathname]);

  const handleLogout = async () => {
    await logoutSession().catch(() => undefined);
    queryClient.clear();
    navigate('/login');
  };

  const menu = [
    { title: 'Dashboard', path: '/dashboard', icon: LayoutDashboard },
    { title: 'Monitors', path: '/monitors', icon: Activity },
    { title: 'Changes', path: '/changes', icon: GitBranch },
    { title: 'Incidents', path: '/incidents', icon: ShieldAlert },
    { title: 'Status Pages', path: '/status-pages', icon: Globe },
    { title: 'API Keys', path: '/api-keys', icon: Key },
  ];

  const pageTitles: Record<string, string> = {
    '/dashboard': 'Dashboard',
    '/monitors': 'Monitors',
    '/changes': 'Changes',
    '/incidents': 'Incidents',
    '/status-pages': 'Status Pages',
    '/billing': 'Billing',
    '/api-keys': 'API Keys',
    '/expired': 'Access Expired',
  };

  const activeTitle = location.pathname.startsWith('/monitors/')
    ? 'Monitor Details'
    : pageTitles[location.pathname] || 'Dashboard';

  if (isUserLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#080c14] overflow-hidden">
        {/* Subtle ambient background */}
        <div className="pointer-events-none fixed inset-0">
          <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 h-[600px] w-[600px] rounded-full bg-emerald-900/10 blur-[120px]" />
        </div>

        <div className="relative text-center z-10">
          {/* Radar ring system */}
          <div className="relative mx-auto h-28 w-28">
            {/* Outer ring – pulses */}
            <motion.div
              className="absolute inset-0 rounded-full border border-emerald-500/20"
              animate={{ scale: [1, 1.3, 1], opacity: [0.3, 0, 0.3] }}
              transition={{ duration: 2.5, repeat: Infinity, ease: 'easeInOut' }}
            />
            {/* Middle ring – steady */}
            <div className="absolute inset-2 rounded-full border border-white/[0.06]" />
            {/* Inner ring – glows */}
            <motion.div
              className="absolute inset-5 rounded-full border border-emerald-500/30"
              animate={{ opacity: [0.3, 0.7, 0.3] }}
              transition={{ duration: 1.8, repeat: Infinity, ease: 'easeInOut' }}
            />
            {/* Center icon – lightning bolt */}
            <div className="absolute inset-0 flex items-center justify-center">
              <motion.div
                initial={{ opacity: 0, scale: 0.5 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.6, ease: 'easeOut' }}
                className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-500/20 to-teal-500/10 border border-emerald-500/30 shadow-[0_0_30px_rgba(16,185,129,0.15)]"
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" className="text-emerald-400">
                  <motion.path
                    d="M13 2L4 14h7l-2 8 9-12h-7l2-8z"
                    stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"
                    initial={{ pathLength: 0 }} animate={{ pathLength: 1 }}
                    transition={{ duration: 1.2, ease: 'easeInOut' }}
                  />
                </svg>
              </motion.div>
            </div>
            {/* Scanning arc */}
            <motion.div
              className="absolute inset-0"
              animate={{ rotate: 360 }}
              transition={{ duration: 3, repeat: Infinity, ease: 'linear' }}
            >
              <div className="absolute top-1/2 left-1/2 h-px w-1/2 origin-left"
                style={{ background: 'linear-gradient(90deg, rgba(16,185,129,0.4), transparent)' }} />
            </motion.div>
          </div>

          {/* Text */}
          <motion.p
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
            className="mt-8 text-[10px] font-bold uppercase tracking-[0.25em] text-emerald-400/60"
          >
            Verifying session
          </motion.p>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.7 }}
            className="mt-2 flex items-center justify-center gap-1"
          >
            {[0, 1, 2].map((i) => (
              <motion.div
                key={i}
                className="h-1 w-1 rounded-full bg-emerald-400/40"
                animate={{ opacity: [0.2, 1, 0.2] }}
                transition={{ duration: 1.2, repeat: Infinity, delay: i * 0.2 }}
              />
            ))}
          </motion.div>
        </div>
      </div>
    );
  }

  if (!currentUser) return null;

  if (!currentUser.isAdmin) {
    menu.splice(3, 0, { title: 'Billing', path: '/billing', icon: CreditCard });
  }

  return (
    <div className="relative min-h-screen bg-slate-50 transition-colors duration-200 dark:bg-[#080c14] overflow-hidden text-slate-900 dark:text-slate-100 font-sans">
      <PageMeta
        title={`${activeTitle} | Zer0Friction`}
        description="Manage monitors, incidents, deploy changes, alerts, and status pages inside Zer0Friction."
        noIndex
      />
      <div className="pointer-events-none fixed inset-0 z-0 overflow-hidden">
        <div className="absolute -left-[10%] -top-[10%] h-[40%] w-[40%] rounded-full bg-emerald-400/10 blur-[120px] dark:bg-emerald-900/20" />
        <div className="absolute bottom-[20%] right-[10%] h-[30%] w-[30%] rounded-full bg-blue-400/10 blur-[120px] dark:bg-blue-900/20" />
      </div>

      <div className="relative z-10 flex min-h-screen">
      {mobileMenuOpen ? (
        <button
          type="button"
          aria-label="Close navigation"
          onClick={() => setMobileMenuOpen(false)}
          className="fixed inset-0 z-30 bg-slate-950/40 backdrop-blur-[8px] lg:hidden"
        />
      ) : null}

      <aside
        className={classNames(
          'fixed inset-y-0 left-0 z-40 flex w-72 flex-col bg-white/70 dark:bg-slate-900/50 backdrop-blur-2xl transition-transform duration-300 lg:translate-x-0 lg:m-4 lg:h-[calc(100vh-2rem)] lg:rounded-[2rem] border border-white/40 dark:border-white/5 shadow-[0_8px_30px_rgb(0,0,0,0.06)] dark:shadow-none',
          mobileMenuOpen ? 'translate-x-0' : '-translate-x-full',
        )}
      >
        <div className="h-20 flex items-center px-8">
          <div className="flex items-center justify-between w-full">
            <div className="flex items-center gap-3">
              <BrandLogo theme="dark" />
            </div>
            <button
              type="button"
              onClick={() => setMobileMenuOpen(false)}
              className="inline-flex h-10 w-10 items-center justify-center rounded-2xl text-slate-500 transition hover:bg-slate-200/50 dark:hover:bg-slate-800 lg:hidden"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>
        
        <nav className="flex-1 px-4 py-6 space-y-2 overflow-y-auto">
          {menu.map((item) => {
            const Icon = item.icon;
            return (
              <NavLink
                key={item.title}
                to={item.path}
                onClick={() => setMobileMenuOpen(false)}
                className="block outline-none"
              >
                {({ isActive }) => (
                  <div className={classNames(
                    'relative flex items-center px-4 py-3 text-[13px] font-bold tracking-wide uppercase rounded-2xl transition-all duration-300 group',
                    isActive ? 'text-emerald-800 dark:text-emerald-300' : 'text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100'
                  )}>
                    {isActive && (
                      <motion.div
                        layoutId="sidebar-active"
                        className="absolute inset-0 rounded-2xl bg-emerald-500/10 dark:bg-emerald-400/10 border border-emerald-500/20 dark:border-emerald-500/20"
                        transition={{ type: "spring", bounce: 0.2, duration: 0.6 }}
                      />
                    )}
                    <Icon className={classNames("mr-3 h-[18px] w-[18px] flex-shrink-0 relative z-10 transition-transform duration-300 group-hover:scale-110 group-active:scale-95", isActive ? "opacity-100" : "opacity-70")} />
                    <span className="relative z-10">{item.title}</span>
                  </div>
                )}
              </NavLink>
            );
          })}
        </nav>

        <div className="mb-6 hidden px-6 lg:block">
           <QuickStartCard type="general" />
        </div>
        
        <div className="p-4 mx-4 mb-4 mt-auto rounded-2xl bg-slate-100/50 dark:bg-slate-800/40 backdrop-blur-sm border border-slate-200/50 dark:border-slate-700/50">
          <button 
            onClick={handleLogout}
            className="flex items-center justify-center w-full px-4 py-3 text-sm font-semibold text-rose-600 dark:text-rose-400 rounded-xl hover:bg-rose-50 dark:hover:bg-rose-500/10 transition-colors duration-300 group outline-none"
          >
            <LogOut className="mr-3 h-[18px] w-[18px] transition-transform duration-300 group-hover:-translate-x-1" />
            Sign Out Session
          </button>
        </div>
      </aside>

      <main className="flex-1 flex flex-col min-w-0 transition-all duration-300 lg:pl-[20rem] z-10">
        <header className="sticky top-0 z-30 h-24 px-4 sm:px-6 lg:px-8 flex items-center bg-transparent backdrop-blur-sm">
           <div className="flex h-[3.75rem] w-full items-center gap-4 rounded-3xl bg-white/70 dark:bg-[#0c121e]/70 backdrop-blur-2xl px-4 lg:px-6 shadow-[0_4px_16px_rgb(0,0,0,0.03)] dark:shadow-[0_4px_16px_rgba(0,0,0,0.4)] border border-white/40 dark:border-slate-800/60 transition-all duration-300">
             <button
               type="button"
               onClick={() => setMobileMenuOpen(true)}
               className="inline-flex h-10 w-10 items-center justify-center rounded-2xl text-slate-500 transition hover:bg-slate-200/50 dark:hover:bg-slate-800 lg:hidden"
               aria-label="Open navigation"
             >
               <Menu className="h-5 w-5" />
             </button>
             <div className="min-w-0 flex items-center gap-3">
               <div className="h-2 w-2 rounded-full bg-emerald-500 shadow-[0_0_12px_rgb(16,185,129)] animate-pulse" />
               <h2 className="truncate text-[11px] font-bold uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">
                 Production Space
               </h2>
             </div>
             
             <div className="ml-auto flex items-center gap-3">
               <NotificationBell />
               <ModeToggle />
               <div className="hidden border-l border-slate-300/50 dark:border-slate-700/50 pl-5 lg:flex items-center gap-3 ml-2">
                 <div className="flex flex-col items-end">
                   <span className="text-sm font-bold text-slate-800 dark:text-slate-200 leading-none">{currentUser?.name || 'Administrator'}</span>
                   <span className="text-[9px] font-bold uppercase tracking-widest text-slate-400 dark:text-slate-500 mt-1.5">{currentUser?.isAdmin ? 'Root access' : 'Developer'}</span>
                 </div>
                 <div className="h-10 w-10 ml-2 rounded-[14px] bg-gradient-to-tr from-blue-500 to-emerald-400 flex items-center justify-center text-white font-bold text-sm shadow-md ring-2 ring-white/50 dark:ring-slate-800">
                   {(currentUser?.name || currentUser?.email || 'A')[0].toUpperCase()}
                 </div>
               </div>
             </div>
           </div>
        </header>
        
        <div className="px-4 sm:px-6 lg:px-8 pb-8 flex-1">
          <AnimatePresence mode="wait">
            <motion.div
              key={location.pathname}
              initial={{ opacity: 0, scale: 0.98, filter: 'blur(4px)', y: 15 }}
              animate={{ opacity: 1, scale: 1, filter: 'blur(0px)', y: 0 }}
              exit={{ opacity: 0, scale: 0.98, filter: 'blur(4px)', y: -10 }}
              transition={{ type: "spring", stiffness: 200, damping: 20 }}
              className="h-full"
            >
              <Outlet />
            </motion.div>
          </AnimatePresence>
        </div>
      </main>
      </div>
    </div>
  );
}
