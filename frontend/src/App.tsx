import { Suspense, lazy, useCallback, useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider, useQuery } from '@tanstack/react-query';
import { ThemeProvider } from './components/ThemeProvider';
import { PageMeta } from './components/PageMeta';
import SystemBootLoader from './components/SystemBootLoader';
import { fetchCurrentUser } from './services/current-user';

const DashboardLayout = lazy(() => import('./layouts/DashboardLayout'));
const AuthLayout = lazy(() => import('./layouts/AuthLayout'));
const LandingPage = lazy(() => import('./pages/LandingPage'));
const Terms = lazy(() => import('./pages/Legal').then((module) => ({ default: module.Terms })));
const Privacy = lazy(() => import('./pages/Legal').then((module) => ({ default: module.Privacy })));
const Login = lazy(() => import('./pages/Login'));
const Register = lazy(() => import('./pages/Register'));
const ForgotPassword = lazy(() => import('./pages/ForgotPassword'));
const ResetPassword = lazy(() => import('./pages/ResetPassword'));
const VerifyEmail = lazy(() => import('./pages/VerifyEmail'));
const AuthSuccess = lazy(() => import('./pages/AuthSuccess'));
const HowToUse = lazy(() => import('./pages/HowToUse'));
const CliPage = lazy(() => import('./pages/CliPage'));
const PricingPage = lazy(() => import('./pages/PricingPage'));
const WebsiteMonitoring = lazy(() => import('./pages/WebsiteMonitoring'));
const ApiMonitoring = lazy(() => import('./pages/ApiMonitoring'));
const StatusPagesFeature = lazy(() => import('./pages/StatusPagesFeature'));
const SslMonitoring = lazy(() => import('./pages/SslMonitoring'));
const ApiMonitoringTools = lazy(() => import('./pages/ApiMonitoringTools'));
const VsUptimeRobot = lazy(() => import('./pages/VsUptimeRobot'));
const VsGrafana = lazy(() => import('./pages/VsGrafana'));
const VsBetterStack = lazy(() => import('./pages/VsBetterStack'));
const VsPingdom = lazy(() => import('./pages/VsPingdom'));
const Dashboard = lazy(() => import('./pages/dashboard'));
const Changes = lazy(() => import('./pages/Changes'));
const Incidents = lazy(() => import('./pages/Incidents'));
const MonitorsList = lazy(() => import('./pages/Monitors'));
const MonitorDetail = lazy(() => import('./pages/MonitorDetail'));
const StatusPages = lazy(() => import('./pages/StatusPages'));
const PublicStatusPage = lazy(() => import('./pages/PublicStatusPage'));
const Billing = lazy(() => import('./pages/Billing'));
const Admin = lazy(() => import('./pages/Admin'));
const ApiKeys = lazy(() => import('./pages/ApiKeys'));
const ExpiredState = lazy(() => import('./pages/ExpiredState'));

const INITIAL_BOOT_STORAGE_KEY = 'zf-initial-boot-complete';
const FIRST_BOOT_DURATION_MS = 2400;

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: 1, refetchOnWindowFocus: false },
  },
});

function RouteFallback() {
  return <SystemBootLoader minDuration={900} />;
}

function RootRoute() {
  const { data: currentUser, isLoading, isFetching } = useQuery({
    queryKey: ['currentUser'],
    queryFn: fetchCurrentUser,
    staleTime: 0,
    gcTime: 0,
    refetchOnMount: 'always',
    retry: false,
  });

  if (isLoading || isFetching) {
    return <RouteFallback />;
  }

  if (currentUser) {
    return <Navigate to="/dashboard" replace />;
  }

  return <LandingPage />;
}

function NotFoundPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-[#050816] px-6 text-slate-100">
      <PageMeta
        title="Page Not Found | Zer0Friction"
        description="The page you requested could not be found on Zer0Friction."
        noIndex
      />
      <div className="w-full max-w-lg rounded-[32px] border border-white/10 bg-white/[0.04] p-10 text-center shadow-[0_24px_90px_rgba(0,0,0,0.45)] backdrop-blur-xl">
        <p className="text-xs font-bold uppercase tracking-[0.3em] text-cyan-300/70">404</p>
        <h1 className="mt-4 text-3xl font-semibold text-white">This page does not exist</h1>
        <p className="mt-3 text-sm text-slate-400">
          Try the dashboard if you are signed in, or head back to the Zer0Friction homepage.
        </p>
        <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
          <a
            href="/"
            className="rounded-2xl bg-gradient-to-r from-cyan-400 to-emerald-400 px-5 py-3 text-sm font-semibold text-slate-950 transition hover:opacity-90"
          >
            Go home
          </a>
          <a
            href="/dashboard"
            className="rounded-2xl border border-white/10 px-5 py-3 text-sm font-semibold text-slate-200 transition hover:bg-white/[0.05]"
          >
            Open dashboard
          </a>
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

    return window.sessionStorage.getItem(INITIAL_BOOT_STORAGE_KEY) === '1';
  });

  const handleInitialBootComplete = useCallback(() => {
    if (typeof window !== 'undefined') {
      window.sessionStorage.setItem(INITIAL_BOOT_STORAGE_KEY, '1');
    }

    setHasCompletedInitialBoot(true);
  }, []);

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
