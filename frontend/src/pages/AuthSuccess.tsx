import { useEffect } from 'react';
import { Loader2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export default function AuthSuccess() {
  const navigate = useNavigate();

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      navigate('/dashboard', { replace: true });
    }, 400);

    return () => window.clearTimeout(timeout);
  }, [navigate]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50">
      <div className="text-center animate-in fade-in duration-700">
        <Loader2 className="w-12 h-12 animate-spin text-primary-600 mx-auto" />
        <h1 className="mt-6 text-2xl font-bold text-slate-900">Finalizing your secure session...</h1>
        <p className="mt-2 text-slate-500">Preparing your trial workspace and dashboard.</p>
      </div>
    </div>
  );
}
