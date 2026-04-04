import { useEffect, useState } from 'react';
import { Outlet, NavLink, useLocation, useNavigate } from 'react-router-dom';
import {
  Activity,
  CreditCard,
  GitBranch,
  Globe,
  Key,
  LayoutDashboard,
  LogOut,
  Menu,
  ShieldAlert,
  X,
} from 'lucide-react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { AnimatePresence, motion } from 'framer-motion';
import { NotificationBell } from '../components/NotificationBell';
import { fetchCurrentUser } from '../services/current-user';
import { QuickStartCard } from '../components/QuickStartCard';
import { logoutSession } from '../services/api';
import { PageMeta } from '../components/PageMeta';
import { BrandLogo } from '../components/BrandLogo';

function classNames(...classes: (string | undefined | null | false)[]) {
  return classes.filter(Boolean).join(' ');
}

const shellSurface =
  'border border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.06),rgba(255,255,255,0.02))] backdrop-blur-2xl shadow-[0_24px_90px_rgba(0,0,0,0.38)]';

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

  if (!currentUser?.isAdmin) {
    menu.splice(4, 0, { title: 'Billing', path: '/billing', icon: CreditCard });
  }

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
      <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[#040611] text-white">
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute left-[8%] top-[10%] h-72 w-72 rounded-full bg-cyan-500/12 blur-[120px]" />
          <div className="absolute bottom-[8%] right-[10%] h-80 w-80 rounded-full bg-emerald-500/10 blur-[140px]" />
        </div>

        <div className="relative text-center">
          <motion.div
            className="mx-auto flex h-20 w-20 items-center justify-center rounded-[28px] border border-cyan-400/20 bg-white/[0.04] shadow-[0_0_60px_rgba(34,211,238,0.14)]"
            animate={{ scale: [1, 1.06, 1], rotate: [0, 2, 0] }}
            transition={{ duration: 2.4, repeat: Infinity, ease: 'easeInOut' }}
          >
            <BrandLogo theme="dark" compact />
          </motion.div>
          <p className="mt-8 text-[11px] font-bold uppercase tracking-[0.34em] text-cyan-300/70">
            Syncing workspace
          </p>
          <p className="mt-3 text-sm text-slate-400">
            Validating your session and loading the control layer.
          </p>
        </div>
      </div>
    );
  }

  if (!currentUser) {
    return null;
  }

  return (
    <div className="relative min-h-screen overflow-hidden bg-[#040611] font-sans text-slate-100">
      <PageMeta
        title={`${activeTitle} | Zer0Friction`}
        description="Manage monitors, incidents, deploy changes, alerts, and status pages inside Zer0Friction."
        noIndex
      />

      <div className="pointer-events-none fixed inset-0">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(34,211,238,0.12),transparent_30%),radial-gradient(circle_at_80%_18%,rgba(16,185,129,0.12),transparent_26%),linear-gradient(180deg,#050816_0%,#040611_100%)]" />
        <div className="absolute left-[-12rem] top-[5rem] h-[28rem] w-[28rem] rounded-full bg-cyan-500/12 blur-[180px]" />
        <div className="absolute bottom-[-10rem] right-[-8rem] h-[24rem] w-[24rem] rounded-full bg-emerald-500/10 blur-[160px]" />
      </div>

      {mobileMenuOpen ? (
        <button
          type="button"
          aria-label="Close navigation"
          onClick={() => setMobileMenuOpen(false)}
          className="fixed inset-0 z-30 bg-slate-950/70 backdrop-blur-md lg:hidden"
        />
      ) : null}

      <div className="relative z-10 flex min-h-screen gap-6 px-3 py-3 sm:px-4 sm:py-4 lg:gap-8 lg:px-5 lg:py-5">
        <aside
          className={classNames(
            shellSurface,
            'fixed inset-y-3 left-3 z-40 flex w-[19rem] flex-col rounded-[30px] transition-transform duration-300 lg:static lg:translate-x-0',
            mobileMenuOpen ? 'translate-x-0' : '-translate-x-[120%]',
          )}
        >
          <div className="flex items-center justify-between border-b border-white/6 px-6 py-6">
            <BrandLogo theme="dark" />
            <button
              type="button"
              onClick={() => setMobileMenuOpen(false)}
              className="inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-white/6 bg-white/[0.03] text-slate-400 transition hover:bg-white/[0.06] hover:text-white lg:hidden"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          <div className="px-6 pt-5">
            <div className="rounded-[26px] border border-white/8 bg-white/[0.03] p-4">
              <p className="text-[10px] font-bold uppercase tracking-[0.28em] text-cyan-300/70">
                Production Space
              </p>
              <p className="mt-3 text-sm font-semibold text-white">{currentUser.name || currentUser.email}</p>
              <p className="mt-1 text-xs uppercase tracking-[0.2em] text-slate-500">
                {currentUser.isAdmin ? 'Root access' : 'Operator seat'}
              </p>
            </div>
          </div>

          <nav className="flex-1 space-y-2 overflow-y-auto px-4 py-6">
            {menu.map((item) => {
              const Icon = item.icon;
              return (
                <NavLink key={item.title} to={item.path} className="block">
                  {({ isActive }) => (
                    <div
                      className={classNames(
                        'group relative flex items-center gap-3 rounded-[22px] px-4 py-3.5 transition-all duration-300',
                        isActive
                          ? 'text-white'
                          : 'text-slate-400 hover:bg-white/[0.03] hover:text-slate-100',
                      )}
                    >
                      {isActive ? (
                        <motion.div
                          layoutId="dashboard-nav"
                          className="absolute inset-0 rounded-[22px] border border-cyan-400/20 bg-[linear-gradient(135deg,rgba(34,211,238,0.18),rgba(16,185,129,0.1))] shadow-[0_10px_35px_rgba(6,182,212,0.16)]"
                          transition={{ type: 'spring', bounce: 0.18, duration: 0.6 }}
                        />
                      ) : null}
                      <div
                        className={classNames(
                          'relative z-10 flex h-10 w-10 items-center justify-center rounded-2xl border transition',
                          isActive
                            ? 'border-white/10 bg-slate-950/40 text-cyan-200'
                            : 'border-white/6 bg-white/[0.03] text-slate-500 group-hover:text-slate-200',
                        )}
                      >
                        <Icon className="h-4.5 w-4.5" />
                      </div>
                      <div className="relative z-10 min-w-0">
                        <p className="truncate text-sm font-semibold">{item.title}</p>
                        <p className="text-[10px] uppercase tracking-[0.22em] text-slate-500">
                          {item.path === '/dashboard'
                            ? 'Overview'
                            : item.path === '/monitors'
                              ? 'Fleet'
                              : item.path === '/changes'
                                ? 'Deploy watch'
                                : item.path === '/incidents'
                                  ? 'Response'
                                  : item.path === '/status-pages'
                                    ? 'Public comms'
                                    : item.path === '/billing'
                                      ? 'Plan'
                                      : 'Access'}
                        </p>
                      </div>
                    </div>
                  )}
                </NavLink>
              );
            })}
          </nav>

          <div className="px-5 pb-4">
            <div className="rounded-[26px] border border-white/8 bg-[linear-gradient(180deg,rgba(255,255,255,0.04),rgba(255,255,255,0.02))] p-3">
              <QuickStartCard type="general" />
            </div>
          </div>

          <div className="px-5 pb-5">
            <button
              onClick={handleLogout}
              className="flex w-full items-center justify-center gap-3 rounded-[22px] border border-rose-500/20 bg-rose-500/8 px-4 py-3.5 text-sm font-semibold text-rose-300 transition hover:bg-rose-500/14 hover:text-white"
            >
              <LogOut className="h-4 w-4" />
              Sign Out Session
            </button>
          </div>
        </aside>

        <main className="flex min-w-0 flex-1 flex-col lg:pl-0">
          <header
            className={classNames(
              shellSurface,
              'sticky top-3 z-20 mb-6 flex min-h-[88px] items-center rounded-[30px] px-4 sm:px-5 lg:px-6',
            )}
          >
            <button
              type="button"
              onClick={() => setMobileMenuOpen(true)}
              className="inline-flex h-12 w-12 items-center justify-center rounded-2xl border border-white/8 bg-white/[0.04] text-slate-300 transition hover:bg-white/[0.07] hover:text-white lg:hidden"
              aria-label="Open navigation"
            >
              <Menu className="h-5 w-5" />
            </button>

            <div className="ml-3 min-w-0 lg:ml-0">
              <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-cyan-300/70">
                Zer0Friction Command Layer
              </p>
              <h1 className="mt-1 truncate text-xl font-semibold text-white sm:text-2xl">{activeTitle}</h1>
            </div>

            <div className="ml-auto flex items-center gap-3">
              <div className="hidden rounded-[22px] border border-white/8 bg-white/[0.03] px-4 py-3 lg:flex lg:items-center lg:gap-4">
                <div className="h-2.5 w-2.5 rounded-full bg-emerald-400 shadow-[0_0_12px_rgba(52,211,153,0.7)]" />
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-slate-500">
                    Monitoring fabric
                  </p>
                  <p className="mt-1 text-sm font-semibold text-slate-100">Live and polling</p>
                </div>
              </div>

              <div className="rounded-[22px] border border-white/8 bg-white/[0.03] p-1.5">
                <NotificationBell />
              </div>

              <div className="hidden items-center gap-3 rounded-[22px] border border-white/8 bg-white/[0.03] px-3 py-2 lg:flex">
                <div className="text-right">
                  <p className="text-sm font-semibold text-white">{currentUser.name || 'User'}</p>
                  <p className="text-[10px] uppercase tracking-[0.22em] text-slate-500">
                    {currentUser.isAdmin ? 'Admin operator' : 'Workspace member'}
                  </p>
                </div>
                <div className="flex h-11 w-11 items-center justify-center rounded-[16px] bg-gradient-to-br from-cyan-400 to-emerald-400 text-sm font-black text-slate-950 shadow-[0_12px_30px_rgba(34,211,238,0.28)]">
                  {(currentUser.name || currentUser.email || 'A')[0].toUpperCase()}
                </div>
              </div>
            </div>
          </header>

          <div className="flex-1">
            <AnimatePresence mode="wait">
              <motion.div
                key={location.pathname}
                initial={{ opacity: 0, y: 18, scale: 0.985 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -10, scale: 0.985 }}
                transition={{ duration: 0.28, ease: 'easeOut' }}
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
