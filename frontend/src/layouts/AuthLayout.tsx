import { Outlet } from 'react-router-dom';
import { PageMeta } from '../components/PageMeta';

export default function AuthLayout() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-[#080c14] px-4 py-12 sm:px-6 lg:px-8 relative overflow-hidden">
      {/* Ambient background blobs matching dashboard */}
      <div className="pointer-events-none fixed inset-0 z-0">
        <div className="absolute -left-[10%] -top-[10%] h-[40%] w-[40%] rounded-full bg-emerald-900/20 blur-[120px]" />
        <div className="absolute bottom-[20%] right-[10%] h-[30%] w-[30%] rounded-full bg-blue-900/20 blur-[120px]" />
      </div>

      <div className="w-full max-w-[420px] relative z-10">
        <div className="rounded-2xl border border-white/[0.08] bg-white/[0.02] backdrop-blur-xl shadow-2xl shadow-black/50 p-8 sm:p-10">
          <Outlet />
        </div>
      </div>
    </div>
  );
}
