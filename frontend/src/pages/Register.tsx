import { useState } from 'react';
import type { FormEvent } from 'react';
import { Link } from 'react-router-dom';
import {
  Activity,
  Loader2,
  AlertCircle,
  Mail,
  ArrowRight,
  Eye,
  EyeOff,
  Github,
  RefreshCcw,
} from 'lucide-react';
import { axiosPublic, getOAuthUrl } from '../services/api';
import { PageMeta } from '../components/PageMeta';

export default function Register() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isResending, setIsResending] = useState(false);
  const [error, setError] = useState('');
  const [resendMessage, setResendMessage] = useState('');
  const [isSuccess, setIsSuccess] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (password.length < 8) {
      setError('Password must be at least 8 characters long.');
      return;
    }

    setIsLoading(true);
    setError('');
    setResendMessage('');

    try {
      await axiosPublic.post('/auth/register', { name, email, password });
      setIsSuccess(true);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Registration failed. User may already exist.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleResendVerification = async () => {
    if (!email) {
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

  if (isSuccess) {
    return (
      <div className="space-y-6 text-center animate-in fade-in zoom-in duration-300">
        <PageMeta
          title="Verify Your Email | Zer0Friction"
          description="Verify your email address to activate your Zer0Friction account."
          noIndex
        />
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-green-100 shadow-inner">
          <Mail className="h-8 w-8 text-green-600" />
        </div>
        <h2 className="text-3xl font-extrabold tracking-tight text-gray-900 dark:text-white">
          Check your email
        </h2>
        <p className="text-lg leading-relaxed text-gray-600 dark:text-slate-300">
          We sent a secure activation link to{' '}
          <span className="font-semibold text-gray-900 dark:text-white">{email}</span>.
          Verify your email to start your 14-day trial and unlock monitoring.
        </p>
        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5 text-left shadow-sm dark:border-slate-700 dark:bg-slate-800/60">
          <p className="text-sm font-semibold text-slate-900 dark:text-white">What to do next</p>
          <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-300">
            Open the verification email, click the secure link, and then sign in. If it does not
            show up in a minute, check spam or request a fresh link below.
          </p>
          <button
            type="button"
            onClick={handleResendVerification}
            disabled={isResending}
            className="mt-4 inline-flex items-center rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 shadow-sm transition hover:border-slate-300 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
          >
            {isResending ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <RefreshCcw className="mr-2 h-4 w-4" />
            )}
            Resend verification email
          </button>
          {resendMessage ? (
            <p className="mt-3 text-sm text-emerald-700 dark:text-emerald-300">{resendMessage}</p>
          ) : null}
        </div>
        <div className="pt-2">
          <Link
            to="/login"
            className="inline-flex items-center rounded-xl border border-transparent bg-gray-900 px-6 py-3 text-base font-medium text-white shadow-sm transition-all hover:bg-gray-800 group"
          >
            Go to Sign In
            <ArrowRight className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-1" />
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageMeta
        title="Create Account | Zer0Friction"
        description="Create your Zer0Friction account and start a trial for uptime monitoring, status pages, and incident tracking."
        noIndex
      />
      <div className="text-center">
        <Activity className="mx-auto h-12 w-12 animate-pulse text-primary-600" />
        <h2 className="mt-4 text-3xl font-extrabold tracking-tight text-gray-900 dark:text-white">
          Start monitoring today
        </h2>
        <p className="mt-2 text-sm text-gray-600 dark:text-slate-300">
          Join Zer0Friction and make every outage easier to catch early.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <button
          type="button"
          onClick={() => {
            window.location.href = getOAuthUrl('google');
          }}
          className="flex items-center justify-center gap-2.5 rounded-xl border border-gray-200 px-4 py-3 font-medium text-gray-700 transition-all hover:border-gray-300 hover:bg-gray-50 active:scale-[0.98] dark:border-slate-700 dark:text-slate-200 dark:hover:border-slate-600 dark:hover:bg-slate-800"
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
          className="flex items-center justify-center gap-2.5 rounded-xl border border-gray-200 px-4 py-3 font-medium text-gray-700 transition-all hover:border-gray-300 hover:bg-gray-50 active:scale-[0.98] dark:border-slate-700 dark:text-slate-200 dark:hover:border-slate-600 dark:hover:bg-slate-800"
        >
          <Github className="h-5 w-5 text-slate-900 dark:text-slate-100" />
          GitHub
        </button>
      </div>

      <div className="relative">
        <div className="absolute inset-0 flex items-center">
          <span className="w-full border-t border-gray-200 dark:border-slate-700"></span>
        </div>
        <div className="relative flex justify-center text-xs uppercase">
          <span className="bg-white px-4 font-medium tracking-wider text-gray-500 dark:bg-slate-900 dark:text-slate-400">
            Or continue with
          </span>
        </div>
      </div>

      <form className="space-y-5" onSubmit={handleSubmit}>
        {error ? (
          <div className="flex items-center gap-2 rounded-xl border border-red-100 bg-red-50 p-3 text-sm text-red-700 animate-in slide-in-from-top-2 duration-200">
            <AlertCircle className="h-5 w-5 shrink-0" />
            <span>{error}</span>
          </div>
        ) : null}

        <div className="space-y-1">
          <label className="ml-1 block text-sm font-medium text-gray-700 dark:text-slate-200">
            Full Name
          </label>
          <input
            type="text"
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="auth-input sm:text-sm"
            placeholder="Your name"
          />
        </div>

        <div className="space-y-1">
          <label className="ml-1 block text-sm font-medium text-gray-700 dark:text-slate-200">
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
          <label className="ml-1 block text-sm font-medium text-gray-700 dark:text-slate-200">
            Password
          </label>
          <div className="relative">
            <input
              type={showPassword ? 'text' : 'password'}
              required
              minLength={8}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="auth-input pr-12 sm:text-sm"
              placeholder="********"
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute inset-y-0 right-0 flex items-center pr-3 text-gray-400 transition-colors hover:text-gray-600 dark:text-slate-500 dark:hover:text-slate-300"
            >
              {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
            </button>
          </div>
          <p className="ml-1 text-[11px] text-gray-500 dark:text-slate-400">
            Minimum 8 characters with at least one letter and one number.
          </p>
        </div>

        <button
          type="submit"
          disabled={isLoading || !name || !email || !password || password.length < 8}
          className="w-full rounded-xl border border-transparent bg-primary-600 px-4 py-3.5 text-base font-semibold text-white shadow-lg shadow-primary-500/30 transition-all hover:bg-primary-500 active:scale-[0.98] disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-primary-600 focus:ring-offset-2"
        >
          {isLoading ? <Loader2 className="mx-auto h-5 w-5 animate-spin" /> : 'Create Account'}
        </button>

        <div className="pt-2 text-center">
          <p className="text-sm text-gray-600 dark:text-slate-300">
            Already have an account?{' '}
            <Link to="/login" className="font-semibold text-primary-600 hover:text-primary-500">
              Sign in here
            </Link>
          </p>
        </div>
      </form>
    </div>
  );
}
