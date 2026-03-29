import { Navigate, Outlet } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { fetchCurrentUser } from '../services/current-user';
import { PageMeta } from '../components/PageMeta';

export default function AuthLayout() {
  const { data: currentUser, isLoading } = useQuery({
    queryKey: ['currentUser'],
    queryFn: fetchCurrentUser,
    staleTime: 60_000,
    retry: false,
  });

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50 dark:bg-slate-950">
        <PageMeta title="Loading Session | Zer0Friction" noIndex />
        <div className="h-12 w-12 animate-pulse rounded-2xl bg-slate-900 dark:bg-slate-200" />
      </div>
    );
  }

  if (currentUser) {
    return <Navigate to="/dashboard" replace />;
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-slate-950 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <PageMeta
        title="Sign In | Zer0Friction"
        description="Sign in to Zer0Friction to manage monitors, incidents, status pages, and deploy-aware uptime workflows."
        noIndex
      />
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900 dark:text-white">
          Sign in to your account
        </h2>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-white dark:bg-slate-900 py-8 px-4 shadow sm:rounded-lg sm:px-10 border border-slate-200 dark:border-slate-800">
          <Outlet />
        </div>
      </div>
    </div>
  );
}
