import { useEffect, useState } from 'react';
import { Outlet, NavLink, useLocation, useNavigate } from 'react-router-dom';
import {
  Activity,
  BadgeIndianRupee,
  CreditCard,
  GitBranch,
  Globe,
  Key,
  LayoutDashboard,
  LogOut,
  Menu,
  Shield,
  ShieldAlert,
  ShieldCheck,
  X,
} from 'lucide-react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { AnimatePresence, motion } from 'framer-motion';
import { NotificationBell } from '../components/NotificationBell';
import { ModeToggle } from '../components/ModeToggle';
import { AUTH_HINT_STORAGE_KEY, currentUserQueryOptions } from '../services/current-user';
import { QuickStartCard } from '../components/QuickStartCard';
import { logoutSession } from '../services/api';
import { PageMeta } from '../components/PageMeta';
import { BrandLogo } from '../components/BrandLogo';
import { useTheme } from '../components/ThemeProvider';

function classNames(...classes: (string | undefined | null | false)[]) {
  return classes.filter(Boolean).join(' ');
}

export default function DashboardLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  const queryClient = useQueryClient();
  const { resolvedTheme } = useTheme();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const {
    data: currentUser,
    isLoading: isUserLoading,
    isFetching: isUserFetching,
    isError: isUserError,
  } = useQuery(currentUserQueryOptions());

  useEffect(() => {
    if (!isUserLoading && !isUserFetching && (isUserError || !currentUser)) {
      if (typeof window !== 'undefined') {
        window.localStorage.removeItem(AUTH_HINT_STORAGE_KEY);
      }
      navigate('/login');
    }
  }, [currentUser, isUserLoading, isUserFetching, isUserError, navigate]);

  useEffect(() => {
    if (currentUser && typeof window !== 'undefined') {
      window.localStorage.setItem(AUTH_HINT_STORAGE_KEY, '1');
    }
  }, [currentUser]);

  useEffect(() => {
    setMobileMenuOpen(false);
  }, [location.pathname]);

  const handleLogout = async () => {
    await logoutSession().catch(() => undefined);
    if (typeof window !== 'undefined') {
      window.localStorage.removeItem(AUTH_HINT_STORAGE_KEY);
    }
    queryClient.clear();
    navigate('/login');
  };

  const menu = [
    { title: 'Dashboard', path: '/dashboard', icon: LayoutDashboard },
    { title: 'Monitors', path: '/monitors', icon: Activity },
    { title: 'Changes', path: '/changes', icon: GitBranch },
    { title: 'Incidents', path: '/incidents', icon: ShieldAlert },
    { title: 'Status Pages', path: '/status-pages', icon: Globe },
    { title: 'Security', path: '/security', icon: Shield },
    { title: 'API Keys', path: '/api-keys', icon: Key },
  ];

  if (currentUser?.isAdmin) {
    menu.splice(4, 0, { title: 'Admin', path: '/admin', icon: ShieldCheck });
    menu.splice(5, 0, { title: 'Billing', path: '/billing', icon: BadgeIndianRupee });
  } else {
    menu.splice(4, 0, { title: 'Billing', path: '/billing', icon: CreditCard });
  }

  const pageTitles: Record<string, string> = {
    '/dashboard': 'Dashboard',
    '/monitors': 'Monitors',
    '/changes': 'Changes',
    '/incidents': 'Incidents',
    '/status-pages': 'Status Pages',
    '/security': 'Security',
    '/security/onboard': 'Add Target',
    '/security/history': 'Scan History',
    '/billing': 'Billing',
    '/admin': 'Admin Console',
    '/api-keys': 'API Keys',
    '/expired': 'Access Expired',
  };

  const activeTitle = location.pathname.startsWith('/monitors/')
    ? 'Monitor Details'
    : location.pathname.startsWith('/security/targets/')
      ? 'Target Configuration'
      : location.pathname.startsWith('/security/scans/')
        ? 'Security Report'
        : pageTitles[location.pathname] || 'Dashboard';

  const isDark = resolvedTheme === 'dark';

  if (!currentUser) {
    if (isUserLoading || isUserFetching) {
      return (
        <div className="relative min-h-screen overflow-hidden font-sans bg-[var(--color-surface-base)] text-[var(--color-text-primary)]">
          <div className="pointer-events-none fixed inset-0">
            <div className="absolute inset-0" style={{
              background: isDark
                ? 'radial-gradient(circle at top, rgba(34,211,238,0.12), transparent 30%), radial-gradient(circle at 80% 18%, rgba(16,185,129,0.12), transparent 26%), linear-gradient(180deg, #050816, #040611)'
                : 'radial-gradient(circle at top, rgba(34,211,238,0.06), transparent 30%), radial-gradient(circle at 80% 18%, rgba(16,185,129,0.06), transparent 26%), linear-gradient(180deg, #f8fafc, #f1f5f9)',
            }} />
            <div className={classNames(
              'absolute left-[-12rem] top-[5rem] h-[28rem] w-[28rem] rounded-full blur-[180px]',
              isDark ? 'bg-cyan-500/12' : 'bg-cyan-500/6',
            )} />
            <div className={classNames(
              'absolute bottom-[-10rem] right-[-8rem] h-[24rem] w-[24rem] rounded-full blur-[160px]',
              isDark ? 'bg-emerald-500/10' : 'bg-emerald-500/5',
            )} />
          </div>

          <div className="relative z-10 flex min-h-screen gap-6 px-3 py-3 sm:px-4 sm:py-4 lg:gap-8 lg:px-5 lg:py-5">
            <aside className="shell-surface hidden w-[19rem] flex-col rounded-[30px] lg:flex">
              <div className="border-b px-6 py-6" style={{ borderColor: 'var(--color-border-secondary)' }}>
                <BrandLogo theme={isDark ? 'dark' : 'light'} />
              </div>
              <div className="px-6 pt-5">
                <div className="rounded-[26px] border p-4" style={{ borderColor: 'var(--color-border-secondary)', background: 'var(--color-surface-glass)' }}>
                  <p className="text-[10px] font-bold uppercase tracking-[0.28em] text-cyan-600 dark:text-cyan-300/70">
                    Production Space
                  </p>
                  <div className="mt-3 h-4 w-32 animate-pulse rounded bg-slate-200 dark:bg-white/10" />
                  <div className="mt-2 h-3 w-20 animate-pulse rounded bg-slate-200 dark:bg-white/10" />
                </div>
              </div>
              <nav className="flex-1 space-y-2 px-4 py-6">
                {Array.from({ length: 6 }).map((_, index) => (
                  <div key={index} className="rounded-[22px] border px-4 py-3.5" style={{ borderColor: 'var(--color-border-secondary)', background: 'var(--color-surface-glass)' }}>
                    <div className="h-4 w-28 animate-pulse rounded bg-slate-200 dark:bg-white/10" />
                  </div>
                ))}
              </nav>
            </aside>

            <main className="flex min-w-0 flex-1 flex-col">
              <header className="shell-surface sticky top-3 z-20 mb-6 flex min-h-[88px] items-center rounded-[30px] px-4 sm:px-5 lg:px-6">
                <div className="min-w-0">
                  <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-cyan-600 dark:text-cyan-300/70">
                    Zer0Friction Command Layer
                  </p>
                  <h1 className="mt-1 truncate text-xl font-semibold sm:text-2xl">{activeTitle}</h1>
                </div>
                <div className="ml-auto flex items-center gap-3">
                  <div className="h-10 w-10 animate-spin rounded-full border-2 border-cyan-300/20 border-t-cyan-500" />
                </div>
              </header>
              <div className="flex-1">
                <Outlet />
              </div>
            </main>
          </div>
        </div>
      );
    }

    return (
      <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[var(--color-surface-base)]">
        <p className="text-sm text-[var(--color-text-tertiary)]">Redirecting to sign in...</p>
      </div>
    );
  }

  return (
    <div className="relative min-h-screen overflow-hidden font-sans bg-[var(--color-surface-base)] text-[var(--color-text-primary)]">
      <PageMeta
        title={`${activeTitle} | Zer0Friction`}
        description="Manage monitors, incidents, deploy changes, alerts, and status pages inside Zer0Friction."
        noIndex
      />

      {/* Ambient background */}
      <div className="pointer-events-none fixed inset-0">
        <div className="absolute inset-0" style={{
          background: isDark
            ? 'radial-gradient(circle at top, rgba(34,211,238,0.12), transparent 30%), radial-gradient(circle at 80% 18%, rgba(16,185,129,0.12), transparent 26%), linear-gradient(180deg, #050816, #040611)'
            : 'radial-gradient(circle at top, rgba(34,211,238,0.04), transparent 30%), radial-gradient(circle at 80% 18%, rgba(16,185,129,0.04), transparent 26%), linear-gradient(180deg, #f8fafc, #f1f5f9)',
        }} />
        <div className={classNames(
          'absolute left-[-12rem] top-[5rem] h-[28rem] w-[28rem] rounded-full blur-[180px]',
          isDark ? 'bg-cyan-500/12' : 'bg-cyan-400/[0.06]',
        )} />
        <div className={classNames(
          'absolute bottom-[-10rem] right-[-8rem] h-[24rem] w-[24rem] rounded-full blur-[160px]',
          isDark ? 'bg-emerald-500/10' : 'bg-emerald-400/[0.05]',
        )} />
      </div>

      {/* Mobile overlay */}
      {mobileMenuOpen ? (
        <button
          type="button"
          aria-label="Close navigation"
          onClick={() => setMobileMenuOpen(false)}
          className={classNames(
            'fixed inset-0 z-30 backdrop-blur-md lg:hidden',
            isDark ? 'bg-slate-950/70' : 'bg-slate-900/30',
          )}
        />
      ) : null}

      <div className="relative z-10 flex min-h-screen gap-6 px-3 py-3 sm:px-4 sm:py-4 lg:gap-8 lg:px-5 lg:py-5">
        {/* Sidebar */}
        <aside
          className={classNames(
            'shell-surface fixed inset-y-3 left-3 z-40 flex w-[19rem] flex-col rounded-[30px] transition-transform duration-300 lg:static lg:translate-x-0',
            mobileMenuOpen ? 'translate-x-0' : '-translate-x-[120%]',
          )}
        >
          <div className="flex items-center justify-between border-b px-6 py-6" style={{ borderColor: 'var(--color-border-secondary)' }}>
            <BrandLogo theme={isDark ? 'dark' : 'light'} />
            <button
              type="button"
              onClick={() => setMobileMenuOpen(false)}
              className="inline-flex h-11 w-11 items-center justify-center rounded-2xl border text-[var(--color-text-tertiary)] transition hover:text-[var(--color-text-primary)] lg:hidden"
              style={{ borderColor: 'var(--color-border-secondary)', background: 'var(--color-surface-glass)' }}
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* User badge */}
          <div className="px-6 pt-5">
            <div className="rounded-[26px] border p-4" style={{ borderColor: 'var(--color-border-secondary)', background: 'var(--color-surface-glass)' }}>
              <p className="text-[10px] font-bold uppercase tracking-[0.28em] text-cyan-600 dark:text-cyan-300/70">
                Production Space
              </p>
              <p className="mt-3 text-sm font-semibold">{currentUser.name || currentUser.email}</p>
              <p className="mt-1 text-xs uppercase tracking-[0.2em] text-[var(--color-text-tertiary)]">
                {currentUser.isAdmin ? 'Root access' : 'Operator seat'}
              </p>
            </div>
          </div>

          {/* Navigation */}
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
                          ? ''
                          : 'text-[var(--color-text-tertiary)] hover:text-[var(--color-text-primary)]',
                      )}
                      style={!isActive ? { background: 'transparent' } : undefined}
                    >
                      {isActive ? (
                        <motion.div
                          layoutId="dashboard-nav"
                          className={classNames(
                            'absolute inset-0 rounded-[22px] border',
                            isDark
                              ? 'border-cyan-400/20 bg-[linear-gradient(135deg,rgba(34,211,238,0.18),rgba(16,185,129,0.1))] shadow-[0_10px_35px_rgba(6,182,212,0.16)]'
                              : 'border-cyan-400/30 bg-[linear-gradient(135deg,rgba(34,211,238,0.1),rgba(16,185,129,0.06))] shadow-[0_4px_16px_rgba(6,182,212,0.08)]',
                          )}
                          transition={{ type: 'spring', bounce: 0.18, duration: 0.6 }}
                        />
                      ) : null}
                      <div
                        className={classNames(
                          'relative z-10 flex h-10 w-10 items-center justify-center rounded-2xl border transition',
                          isActive
                            ? isDark
                              ? 'border-white/10 bg-slate-950/40 text-cyan-200'
                              : 'border-cyan-200/40 bg-white/80 text-cyan-600'
                            : isDark
                              ? 'border-white/6 bg-white/[0.03] text-slate-500 group-hover:text-slate-200'
                              : 'border-slate-200/60 bg-slate-50 text-slate-400 group-hover:text-slate-700',
                        )}
                      >
                        <Icon className="h-4.5 w-4.5" />
                      </div>
                      <div className="relative z-10 min-w-0">
                        <p className={classNames(
                          'truncate text-sm font-semibold',
                          isActive ? '' : '',
                        )}>{item.title}</p>
                        <p className="text-[10px] uppercase tracking-[0.22em] text-[var(--color-text-tertiary)]">
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
                                    : item.path === '/security'
                                      ? 'Threat intel'
                                      : item.path === '/admin'
                                        ? 'Support ops'
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

          {/* Quick start card */}
          <div className="px-5 pb-4">
            <div className="rounded-[26px] border p-3" style={{ borderColor: 'var(--color-border-secondary)', background: 'var(--color-surface-glass)' }}>
              <QuickStartCard type="general" />
            </div>
          </div>

          {/* Logout */}
          <div className="px-5 pb-5">
            <button
              onClick={handleLogout}
              className="flex w-full items-center justify-center gap-3 rounded-[22px] border border-rose-500/20 bg-rose-500/8 px-4 py-3.5 text-sm font-semibold text-rose-500 dark:text-rose-300 transition hover:bg-rose-500/14"
            >
              <LogOut className="h-4 w-4" />
              Sign Out Session
            </button>
          </div>
        </aside>

        {/* Main content */}
        <main className="flex min-w-0 flex-1 flex-col lg:pl-0">
          <header className="shell-surface sticky top-3 z-20 mb-6 flex min-h-[88px] items-center rounded-[30px] px-4 sm:px-5 lg:px-6">
            <button
              type="button"
              onClick={() => setMobileMenuOpen(true)}
              className="inline-flex h-12 w-12 items-center justify-center rounded-2xl border text-[var(--color-text-secondary)] transition hover:text-[var(--color-text-primary)] lg:hidden"
              style={{ borderColor: 'var(--color-border-primary)', background: 'var(--color-surface-glass)' }}
              aria-label="Open navigation"
            >
              <Menu className="h-5 w-5" />
            </button>

            <div className="ml-3 min-w-0 lg:ml-0">
              <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-cyan-600 dark:text-cyan-300/70">
                Zer0Friction Command Layer
              </p>
              <h1 className="mt-1 truncate text-xl font-semibold sm:text-2xl">{activeTitle}</h1>
            </div>

            <div className="ml-auto flex items-center gap-3">
              {/* Theme Toggle */}
              <div className="hidden lg:block">
                <ModeToggle />
              </div>

              {/* Status indicator */}
              <div className="hidden rounded-[22px] border px-4 py-3 lg:flex lg:items-center lg:gap-4"
                style={{ borderColor: 'var(--color-border-primary)', background: 'var(--color-surface-glass)' }}
              >
                <div className="h-2.5 w-2.5 rounded-full bg-emerald-400 shadow-[0_0_12px_rgba(52,211,153,0.7)]" />
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-[var(--color-text-tertiary)]">
                    Monitoring fabric
                  </p>
                  <p className="mt-1 text-sm font-semibold">Live and polling</p>
                </div>
              </div>

              {/* Notifications */}
              <div className="rounded-[22px] border p-1.5"
                style={{ borderColor: 'var(--color-border-primary)', background: 'var(--color-surface-glass)' }}
              >
                <NotificationBell />
              </div>

              {/* User badge */}
              <div className="hidden items-center gap-3 rounded-[22px] border px-3 py-2 lg:flex"
                style={{ borderColor: 'var(--color-border-primary)', background: 'var(--color-surface-glass)' }}
              >
                <div className="text-right">
                  <p className="text-sm font-semibold">{currentUser.name || 'User'}</p>
                  <p className="text-[10px] uppercase tracking-[0.22em] text-[var(--color-text-tertiary)]">
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
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -4 }}
                transition={{ duration: 0.12, ease: 'easeOut' }}
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
