import { Suspense, lazy, useCallback, useEffect, useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Link } from 'react-router-dom';
import { QueryClient, QueryClientProvider, useQuery } from '@tanstack/react-query';
import { ThemeProvider } from './components/ThemeProvider';
import { PageMeta } from './components/PageMeta';
import SystemBootLoader from './components/SystemBootLoader';
import { AUTH_HINT_STORAGE_KEY, currentUserQueryOptions } from './services/current-user';

const loadDashboardLayout = () => import('./layouts/DashboardLayout');
const loadAuthLayout = () => import('./layouts/AuthLayout');
const loadLandingPage = () => import('./pages/LandingPage');
const loadLegal = () => import('./pages/Legal');
const loadLogin = () => import('./pages/Login');
const loadRegister = () => import('./pages/Register');
const loadForgotPassword = () => import('./pages/ForgotPassword');
const loadResetPassword = () => import('./pages/ResetPassword');
const loadVerifyEmail = () => import('./pages/VerifyEmail');
const loadAuthSuccess = () => import('./pages/AuthSuccess');
const loadHowToUse = () => import('./pages/HowToUse');
const loadCliPage = () => import('./pages/CliPage');
const loadPricingPage = () => import('./pages/PricingPage');
const loadSecurityPricingPage = () => import('./pages/security/SecurityPricingPage');
const loadWebsiteMonitoring = () => import('./pages/WebsiteMonitoring');
const loadApiMonitoring = () => import('./pages/ApiMonitoring');
const loadStatusPagesFeature = () => import('./pages/StatusPagesFeature');
const loadSslMonitoring = () => import('./pages/SslMonitoring');
const loadApiMonitoringTools = () => import('./pages/ApiMonitoringTools');
const loadVsUptimeRobot = () => import('./pages/VsUptimeRobot');
const loadVsGrafana = () => import('./pages/VsGrafana');
const loadVsBetterStack = () => import('./pages/VsBetterStack');
const loadVsPingdom = () => import('./pages/VsPingdom');
const loadDashboard = () => import('./pages/dashboard');
const loadChanges = () => import('./pages/Changes');
const loadIncidents = () => import('./pages/Incidents');
const loadMonitorsList = () => import('./pages/Monitors');
const loadMonitorDetail = () => import('./pages/MonitorDetail');
const loadStatusPages = () => import('./pages/StatusPages');
const loadPublicStatusPage = () => import('./pages/PublicStatusPage');
const loadBilling = () => import('./pages/Billing');
const loadAdmin = () => import('./pages/Admin');
const loadApiKeys = () => import('./pages/ApiKeys');
const loadExpiredState = () => import('./pages/ExpiredState');
const loadSecurityDashboard = () => import('./pages/security/SecurityDashboard');
const loadSecurityOnboarding = () => import('./pages/security/SecurityOnboarding');
const loadScanConfiguration = () => import('./pages/security/ScanConfiguration');
const loadExecutiveReport = () => import('./pages/security/ExecutiveReport');
const loadScanHistory = () => import('./pages/security/ScanHistory');

const DashboardLayout = lazy(loadDashboardLayout);
const AuthLayout = lazy(loadAuthLayout);
const LandingPage = lazy(loadLandingPage);
const Terms = lazy(() => loadLegal().then((module) => ({ default: module.Terms })));
const Privacy = lazy(() => loadLegal().then((module) => ({ default: module.Privacy })));
const Login = lazy(loadLogin);
const Register = lazy(loadRegister);
const ForgotPassword = lazy(loadForgotPassword);
const ResetPassword = lazy(loadResetPassword);
const VerifyEmail = lazy(loadVerifyEmail);
const AuthSuccess = lazy(loadAuthSuccess);
const HowToUse = lazy(loadHowToUse);
const CliPage = lazy(loadCliPage);
const PricingPage = lazy(loadPricingPage);
const SecurityPricingPage = lazy(loadSecurityPricingPage);
const WebsiteMonitoring = lazy(loadWebsiteMonitoring);
const ApiMonitoring = lazy(loadApiMonitoring);
const StatusPagesFeature = lazy(loadStatusPagesFeature);
const SslMonitoring = lazy(loadSslMonitoring);
const ApiMonitoringTools = lazy(loadApiMonitoringTools);
const VsUptimeRobot = lazy(loadVsUptimeRobot);
const VsGrafana = lazy(loadVsGrafana);
const VsBetterStack = lazy(loadVsBetterStack);
const VsPingdom = lazy(loadVsPingdom);
const Dashboard = lazy(loadDashboard);
const Changes = lazy(loadChanges);
const Incidents = lazy(loadIncidents);
const MonitorsList = lazy(loadMonitorsList);
const MonitorDetail = lazy(loadMonitorDetail);
const StatusPages = lazy(loadStatusPages);
const PublicStatusPage = lazy(loadPublicStatusPage);
const Billing = lazy(loadBilling);
const Admin = lazy(loadAdmin);
const ApiKeys = lazy(loadApiKeys);
const ExpiredState = lazy(loadExpiredState);
const SecurityDashboard = lazy(loadSecurityDashboard);
const SecurityOnboarding = lazy(loadSecurityOnboarding);
const ScanConfiguration = lazy(loadScanConfiguration);
const ExecutiveReport = lazy(loadExecutiveReport);
const ScanHistory = lazy(loadScanHistory);

const INITIAL_BOOT_STORAGE_KEY = 'zf-initial-boot-complete-v2';
const FIRST_BOOT_DURATION_MS = 2400;

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      staleTime: 30_000,
      gcTime: 600_000,
      refetchOnWindowFocus: false,
      refetchOnMount: false,
    },
  },
});

function preloadCommonRoutes() {
  void loadDashboardLayout();
  void loadAuthLayout();
  void loadDashboard();
  void loadMonitorsList();
  void loadChanges();
  void loadIncidents();
  void loadStatusPages();
  void loadBilling();
  void loadApiKeys();
  void loadSecurityDashboard();
  void loadSecurityOnboarding();
  void loadScanConfiguration();
  void loadScanHistory();
}

function RouteFallback() {
  return (
    <div className="flex min-h-screen items-center justify-center px-6" style={{ background: 'var(--color-surface-base)', color: 'var(--color-text-secondary)' }}>
      <div className="text-center">
        <div className="mx-auto h-9 w-9 animate-spin rounded-full border-2 border-cyan-300/20 border-t-cyan-500" />
        <p className="mt-4 text-sm">Loading workspace...</p>
      </div>
    </div>
  );
}

function RootRoute() {
  const { data: currentUser, isLoading, isFetching } = useQuery(
    currentUserQueryOptions(),
  );
  const hasSessionHint =
    typeof window !== 'undefined' &&
    window.localStorage.getItem(AUTH_HINT_STORAGE_KEY) === '1';

  if (currentUser && typeof window !== 'undefined') {
    window.localStorage.setItem(AUTH_HINT_STORAGE_KEY, '1');
  }

  if ((isLoading || isFetching) && hasSessionHint) {
    return <Navigate to="/dashboard" replace />;
  }

  if (isLoading || isFetching) {
    return (
      <div className="flex min-h-screen items-center justify-center px-6" style={{ background: 'var(--color-surface-base)', color: 'var(--color-text-secondary)' }}>
        <div className="text-center">
          <div className="mx-auto h-8 w-8 animate-spin rounded-full border-2 border-cyan-300/20 border-t-cyan-500" />
          <p className="mt-4 text-sm">Checking session...</p>
        </div>
      </div>
    );
  }

  if (currentUser) {
    return <Navigate to="/dashboard" replace />;
  }

  return <LandingPage />;
}

function NotFoundPage() {
  return (
    <div className="flex min-h-screen items-center justify-center px-6" style={{ background: 'var(--color-surface-base)', color: 'var(--color-text-primary)' }}>
      <PageMeta
        title="Page Not Found | Zer0Friction"
        description="The page you requested could not be found on Zer0Friction."
        noIndex
      />
      <div className="w-full max-w-lg rounded-[32px] border p-10 text-center backdrop-blur-xl"
        style={{ borderColor: 'var(--color-border-primary)', background: 'var(--color-surface-glass)', boxShadow: 'var(--shadow-shell)' }}
      >
        <p className="text-xs font-bold uppercase tracking-[0.3em] text-cyan-600 dark:text-cyan-300/70">404</p>
        <h1 className="mt-4 text-3xl font-semibold">This page does not exist</h1>
        <p className="mt-3 text-sm text-[var(--color-text-tertiary)]">
          Try the dashboard if you are signed in, or head back to the Zer0Friction homepage.
        </p>
        <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
          <Link
            to="/"
            className="rounded-2xl bg-gradient-to-r from-cyan-400 to-emerald-400 px-5 py-3 text-sm font-semibold text-slate-950 transition hover:opacity-90"
          >
            Go home
          </Link>
          <Link
            to="/dashboard"
            className="rounded-2xl border px-5 py-3 text-sm font-semibold transition"
            style={{ borderColor: 'var(--color-border-primary)' }}
          >
            Open dashboard
          </Link>
        </div>
      </div>
    </div>
  );
}

function AppRouter() {
  return (
    <BrowserRouter>
      <Suspense fallback={<RouteFallback />}>
        <Routes>
          <Route path="/" element={<RootRoute />} />
          <Route path="/status/:slug" element={<PublicStatusPage />} />
          <Route path="/terms" element={<Terms />} />
          <Route path="/privacy" element={<Privacy />} />
          <Route path="/how-to-use" element={<HowToUse />} />
          <Route path="/cli" element={<CliPage />} />
          <Route path="/pricing" element={<PricingPage />} />
          <Route path="/security/pricing" element={<SecurityPricingPage />} />
          <Route path="/website-monitoring" element={<WebsiteMonitoring />} />
          <Route path="/api-monitoring" element={<ApiMonitoring />} />
          <Route path="/status-pages-feature" element={<StatusPagesFeature />} />
          <Route path="/ssl-monitoring" element={<SslMonitoring />} />
          <Route path="/api-monitoring-tools" element={<ApiMonitoringTools />} />
          <Route path="/vs-uptimerobot" element={<VsUptimeRobot />} />
          <Route path="/vs-grafana" element={<VsGrafana />} />
          <Route path="/vs-better-stack" element={<VsBetterStack />} />
          <Route path="/vs-pingdom" element={<VsPingdom />} />

          <Route element={<AuthLayout />}>
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />
            <Route path="/forgot-password" element={<ForgotPassword />} />
            <Route path="/reset-password" element={<ResetPassword />} />
            <Route path="/verify-email" element={<VerifyEmail />} />
            <Route path="/auth-success" element={<AuthSuccess />} />
          </Route>

          <Route element={<DashboardLayout />}>
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/changes" element={<Changes />} />
            <Route path="/incidents" element={<Incidents />} />
            <Route path="/monitors" element={<MonitorsList />} />
            <Route path="/monitors/:id" element={<MonitorDetail />} />
            <Route path="/status-pages" element={<StatusPages />} />
            <Route path="/billing" element={<Billing />} />
            <Route path="/admin" element={<Admin />} />
            <Route path="/api-keys" element={<ApiKeys />} />
            <Route path="/expired" element={<ExpiredState />} />
            <Route path="/security" element={<SecurityDashboard />} />
            <Route path="/security/onboard" element={<SecurityOnboarding />} />
            <Route path="/security/targets/:targetId/configure" element={<ScanConfiguration />} />
            <Route path="/security/scans/:scanId/report" element={<ExecutiveReport />} />
            <Route path="/security/history" element={<ScanHistory />} />
          </Route>

          <Route path="*" element={<NotFoundPage />} />
        </Routes>
      </Suspense>
    </BrowserRouter>
  );
}

export default function App() {
  const [hasCompletedInitialBoot, setHasCompletedInitialBoot] = useState(() => {
    if (typeof window === 'undefined') {
      return true;
    }

    return window.localStorage.getItem(INITIAL_BOOT_STORAGE_KEY) === '1';
  });

  const handleInitialBootComplete = useCallback(() => {
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(INITIAL_BOOT_STORAGE_KEY, '1');
    }

    setHasCompletedInitialBoot(true);
  }, []);

  useEffect(() => {
    if (!hasCompletedInitialBoot || typeof window === 'undefined') {
      return;
    }

    const preload = () => preloadCommonRoutes();
    const idleCallback = window.requestIdleCallback;

    if (typeof idleCallback === 'function') {
      const handle = idleCallback(preload, { timeout: 1500 });
      return () => window.cancelIdleCallback?.(handle);
    }

    const timeout = window.setTimeout(preload, 800);
    return () => window.clearTimeout(timeout);
  }, [hasCompletedInitialBoot]);

  return (
    <ThemeProvider defaultTheme="system" storageKey="vite-ui-theme">
      <QueryClientProvider client={queryClient}>
        {hasCompletedInitialBoot ? (
          <AppRouter />
        ) : (
          <SystemBootLoader
            minDuration={FIRST_BOOT_DURATION_MS}
            onComplete={handleInitialBootComplete}
          />
        )}
      </QueryClientProvider>
    </ThemeProvider>
  );
}
