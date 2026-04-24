import { Navigate, Outlet } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { PageMeta } from '../components/PageMeta';
import { fetchCurrentUser } from '../services/current-user';
import { useTheme } from '../components/ThemeProvider';

export default function AuthLayout() {
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === 'dark';

  const { data: currentUser, isLoading, isFetching } = useQuery({
    queryKey: ['currentUser'],
    queryFn: fetchCurrentUser,
    staleTime: 0,
    gcTime: 0,
    refetchOnMount: 'always',
    retry: false,
  });

  if (isLoading || isFetching) {
    return (
      <div className="flex min-h-screen items-center justify-center px-4 py-12 text-sm text-[var(--color-text-tertiary)]"
        style={{ background: 'var(--color-surface-base)' }}
      >
        Checking your session...
      </div>
    );
  }

  if (currentUser) {
    return <Navigate to="/dashboard" replace />;
  }

  return (
    <div className="flex min-h-screen items-center justify-center px-4 py-12 sm:px-6 lg:px-8 relative overflow-hidden"
      style={{ background: 'var(--color-surface-base)' }}
    >
      {/* Ambient background blobs */}
      <div className="pointer-events-none fixed inset-0 z-0">
        <div className={`absolute -left-[10%] -top-[10%] h-[40%] w-[40%] rounded-full blur-[120px] ${
          isDark ? 'bg-emerald-900/20' : 'bg-emerald-400/10'
        }`} />
        <div className={`absolute bottom-[20%] right-[10%] h-[30%] w-[30%] rounded-full blur-[120px] ${
          isDark ? 'bg-blue-900/20' : 'bg-blue-400/10'
        }`} />
      </div>

      <div className="w-full max-w-[420px] relative z-10">
        <div className="rounded-2xl border backdrop-blur-xl shadow-2xl p-8 sm:p-10"
          style={{
            borderColor: 'var(--color-border-primary)',
            background: isDark ? 'rgba(255,255,255,0.02)' : 'rgba(255,255,255,0.85)',
            boxShadow: isDark ? '0 25px 50px -12px rgba(0,0,0,0.5)' : '0 25px 50px -12px rgba(0,0,0,0.08)',
          }}
        >
          <Outlet />
        </div>
      </div>
    </div>
  );
}
