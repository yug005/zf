import { Suspense, lazy } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ThemeProvider } from './components/ThemeProvider';

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
const Dashboard = lazy(() => import('./pages/Dashboard'));
const Changes = lazy(() => import('./pages/Changes'));
const Incidents = lazy(() => import('./pages/Incidents'));
const MonitorsList = lazy(() => import('./pages/Monitors'));
const MonitorDetail = lazy(() => import('./pages/MonitorDetail'));
const StatusPages = lazy(() => import('./pages/StatusPages'));
const PublicStatusPage = lazy(() => import('./pages/PublicStatusPage'));
const Billing = lazy(() => import('./pages/Billing'));
const ApiKeys = lazy(() => import('./pages/ApiKeys'));
const ExpiredState = lazy(() => import('./pages/ExpiredState'));

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: 1, refetchOnWindowFocus: false },
  },
});

function RouteFallback() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-6">
      <div className="w-full max-w-md rounded-3xl border border-slate-200 bg-white p-8 text-center shadow-sm">
        <div className="mx-auto h-12 w-12 animate-pulse rounded-2xl bg-slate-900" />
        <h2 className="mt-4 text-lg font-semibold text-slate-900">Loading workspace</h2>
        <p className="mt-2 text-sm text-slate-500">
          Pulling the next dashboard view into place.
        </p>
      </div>
    </div>
  );
}

export default function App() {
  return (
    <ThemeProvider defaultTheme="system" storageKey="vite-ui-theme">
      <QueryClientProvider client={queryClient}>
        <BrowserRouter>
          <Suspense fallback={<RouteFallback />}>
            <Routes>
              <Route path="/" element={<LandingPage />} />
              <Route path="/status/:slug" element={<PublicStatusPage />} />
              <Route path="/terms" element={<Terms />} />
              <Route path="/privacy" element={<Privacy />} />
              <Route path="/how-to-use" element={<HowToUse />} />

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
                <Route path="/api-keys" element={<ApiKeys />} />
                <Route path="/expired" element={<ExpiredState />} />
              </Route>

              <Route path="*" element={<Navigate to="/dashboard" replace />} />
            </Routes>
          </Suspense>
        </BrowserRouter>
      </QueryClientProvider>
    </ThemeProvider>
  );
}
