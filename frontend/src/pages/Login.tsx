import { useState } from 'react';
import type { FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Loader2, AlertCircle, Eye, EyeOff, Github, Mail } from 'lucide-react';
import { axiosPublic, getOAuthUrl } from '../services/api';
import { PageMeta } from '../components/PageMeta';
import { BrandLogo } from '../components/BrandLogo';

export default function Login() {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isResending, setIsResending] = useState(false);
  const [error, setError] = useState('');
  const [resendMessage, setResendMessage] = useState('');

  const needsVerification = error.toLowerCase().includes('verify your email');

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');
    setResendMessage('');

    try {
      await axiosPublic.post('/auth/login', { email, password });
      navigate('/dashboard');
    } catch (err: any) {
      setError(err.response?.data?.message || 'Invalid email or password');
    } finally {
      setIsLoading(false);
    }
  };

  const handleResendVerification = async () => {
    if (!email) {
      setError('Enter your email address first so we can resend the verification link.');
      return;
    }

    setIsResending(true);
    setResendMessage('');

    try {
      const { data } = await axiosPublic.post('/auth/resend-verification', { email });
      setResendMessage(
        data.message || 'If your account still needs verification, a fresh link is on the way.',
      );
    } catch (err: any) {
      setError(err.response?.data?.message || 'We could not resend the verification email right now.');
    } finally {
      setIsResending(false);
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <PageMeta
        title="Sign In | Zer0Friction"
        description="Sign in to Zer0Friction to manage your infrastructure monitors and incident workflows."
        noIndex
      />
      <div className="text-center">
        <div className="mb-6 flex justify-center">
          <BrandLogo compact />
        </div>
        <h2 className="text-3xl font-extrabold tracking-tight text-slate-900 dark:text-white">
          Welcome Back
        </h2>
        <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
          Sign in to manage your infrastructure monitors.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <button
          type="button"
          onClick={() => {
            window.location.href = getOAuthUrl('google');
          }}
          className="flex items-center justify-center gap-2.5 rounded-xl border border-slate-200 px-4 py-3 font-medium text-slate-700 transition-all hover:border-slate-300 hover:bg-slate-50 active:scale-[0.98] dark:border-slate-700 dark:text-slate-200 dark:hover:border-slate-600 dark:hover:bg-slate-800"
        >
          <svg className="h-5 w-5" viewBox="0 0 24 24">
            <path
              d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
              fill="#4285F4"
            />
            <path
              d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
              fill="#34A853"
            />
            <path
              d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"
              fill="#FBBC05"
            />
            <path
              d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
              fill="#EA4335"
            />
          </svg>
          Google
        </button>

        <button
          type="button"
          onClick={() => {
            window.location.href = getOAuthUrl('github');
          }}
          className="flex items-center justify-center gap-2.5 rounded-xl border border-slate-200 px-4 py-3 font-medium text-slate-700 transition-all hover:border-slate-300 hover:bg-slate-50 active:scale-[0.98] dark:border-slate-700 dark:text-slate-200 dark:hover:border-slate-600 dark:hover:bg-slate-800"
        >
          <Github className="h-5 w-5 text-slate-900 dark:text-slate-100" />
          GitHub
        </button>
      </div>

      <div className="relative">
        <div className="absolute inset-0 flex items-center">
          <span className="w-full border-t border-slate-200 dark:border-slate-700"></span>
        </div>
        <div className="relative flex justify-center text-xs uppercase">
          <span className="bg-white px-4 font-medium tracking-wider text-slate-500 dark:bg-slate-900 dark:text-slate-400">
            Or continue with
          </span>
        </div>
      </div>

      <form className="space-y-5" onSubmit={handleSubmit}>
        {error ? (
          <div className="rounded-xl border border-red-100 bg-red-50 p-4 text-sm text-red-700 shadow-sm animate-in slide-in-from-top-1">
            <div className="flex items-start gap-3">
              <AlertCircle className="mt-0.5 h-5 w-5 shrink-0" />
              <div className="space-y-3">
                <p>{error}</p>
                {needsVerification ? (
                  <button
                    type="button"
                    onClick={handleResendVerification}
                    disabled={isResending}
                    className="inline-flex items-center rounded-lg bg-white px-3 py-2 text-xs font-semibold text-red-700 ring-1 ring-red-200 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {isResending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Mail className="mr-2 h-4 w-4" />}
                    Resend verification email
                  </button>
                ) : null}
              </div>
            </div>
          </div>
        ) : null}

        {resendMessage ? (
          <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800 shadow-sm">
            {resendMessage}
          </div>
        ) : null}

        <div className="space-y-1">
          <label className="ml-1 block text-sm font-medium text-slate-700 dark:text-slate-200">
            Email address
          </label>
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="auth-input sm:text-sm"
            placeholder="you@company.com"
          />
        </div>

        <div className="space-y-1">
          <div className="ml-1 flex items-center justify-between">
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-200">
              Password
            </label>
            <div className="text-xs">
              <Link
                to="/forgot-password"
                title="Forgot password recovery link"
                className="font-semibold text-primary-600 hover:text-primary-500"
              >
                Forgot password?
              </Link>
            </div>
          </div>
          <div className="relative">
            <input
              type={showPassword ? 'text' : 'password'}
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="auth-input pr-12 sm:text-sm"
              placeholder="********"
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute inset-y-0 right-0 flex items-center pr-3 text-slate-400 transition-colors hover:text-slate-600 dark:text-slate-500 dark:hover:text-slate-300"
            >
              {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
            </button>
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600 dark:border-slate-800 dark:bg-slate-900/60 dark:text-slate-300">
          Sessions are kept on this browser automatically when cookies are allowed.
        </div>

        <button
          type="submit"
          disabled={isLoading || !email || !password}
          className="w-full rounded-xl border border-transparent bg-slate-900 px-4 py-3.5 text-base font-semibold text-white shadow-lg shadow-primary-500/20 transition-all hover:bg-slate-800 active:scale-[0.98] disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-slate-900 focus:ring-offset-2"
        >
          {isLoading ? <Loader2 className="mx-auto h-5 w-5 animate-spin" /> : 'Continue'}
        </button>

        <div className="border-t border-slate-100 pt-4 text-center dark:border-slate-800">
          <p className="text-sm text-slate-600 dark:text-slate-300">
            New to Zer0Friction?{' '}
            <Link to="/register" className="font-semibold text-primary-600 hover:text-primary-500">
              Create an account
            </Link>
          </p>
        </div>
      </form>
    </div>
  );
}
