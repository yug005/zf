import { useState } from 'react';
import type { FormEvent } from 'react';
import { Link } from 'react-router-dom';
import {
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
import { BrandLogo } from '../components/BrandLogo';

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
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-emerald-500/10 border border-emerald-500/20 shadow-[0_0_30px_rgba(16,185,129,0.15)]">
          <Mail className="h-8 w-8 text-emerald-400" />
        </div>
        <h2 className="text-2xl font-extrabold tracking-tight mb-2">
          Inbox incoming
        </h2>
        <p className="text-sm leading-relaxed text-[var(--color-text-secondary)]">
          Secure activation link sent to{' '}
          <span className="font-semibold">{email}</span>.
          Verify your email to initialize your workspace.
        </p>
        <div className="rounded-2xl border p-5 text-left shadow-sm" style={{ borderColor: 'var(--color-border-primary)', background: 'var(--color-surface-glass)' }}>
          <p className="text-[10px] font-bold uppercase tracking-wider text-[var(--color-text-tertiary)]">What to do next</p>
          <p className="mt-2 text-sm leading-6 text-[var(--color-text-secondary)]">
            Open the email, click the secure link, and sign in. If it does not
            show up in a minute, check spam or request a fresh link.
          </p>
          <button
            type="button"
            onClick={handleResendVerification}
            disabled={isResending}
            className="mt-4 inline-flex items-center rounded-xl border px-4 py-2.5 text-xs font-bold uppercase tracking-wider transition-colors disabled:cursor-not-allowed disabled:opacity-60"
            style={{ borderColor: 'var(--color-border-primary)', background: 'var(--color-surface-glass)', color: 'var(--color-text-secondary)' }}
          >
            {isResending ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin text-emerald-400" />
            ) : (
              <RefreshCcw className="mr-2 h-4 w-4" />
            )}
            Resend Link
          </button>
          {resendMessage ? (
            <p className="mt-3 text-[11px] text-emerald-400">{resendMessage}</p>
          ) : null}
        </div>
        <div className="pt-2">
          <Link
            to="/login"
            className="inline-flex items-center rounded-xl px-6 py-3 text-xs font-bold uppercase tracking-wider shadow-sm transition-all active:scale-[0.98] group"
            style={{ background: 'var(--color-surface-glass)', color: 'var(--color-text-primary)' }}
          >
            Return to Sign In
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
        <div className="flex justify-center">
          <BrandLogo compact />
        </div>
        <h2 className="mt-6 text-2xl font-extrabold tracking-tight mb-2">
          Initialize workspace
        </h2>
        <p className="mt-2 text-xs font-medium uppercase tracking-widest text-[var(--color-text-tertiary)]">
          Join the observability platform
        </p>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <button
          type="button"
          onClick={() => {
            window.location.href = getOAuthUrl('google');
          }}
          className="flex items-center justify-center gap-2.5 rounded-xl border px-4 py-2.5 text-xs font-bold uppercase tracking-wider transition-all active:scale-[0.98] border-slate-200 bg-slate-50 text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:border-white/[0.08] dark:bg-white/[0.02] dark:text-slate-300 dark:hover:bg-white/[0.06] dark:hover:text-white"
        >
          <svg className="h-4 w-4" viewBox="0 0 24 24">
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
          className="flex items-center justify-center gap-2.5 rounded-xl border px-4 py-2.5 text-xs font-bold uppercase tracking-wider transition-all active:scale-[0.98] border-slate-200 bg-slate-50 text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:border-white/[0.08] dark:bg-white/[0.02] dark:text-slate-300 dark:hover:bg-white/[0.06] dark:hover:text-white"
        >
          <Github className="h-4 w-4 text-slate-600 dark:text-slate-300" />
          GitHub
        </button>
      </div>

      <div className="relative">
        <div className="absolute inset-0 flex items-center">
          <span className="w-full border-t" style={{ borderColor: 'var(--color-border-primary)' }}></span>
        </div>
        <div className="relative flex justify-center text-[10px] uppercase font-bold tracking-widest">
          <span className="px-4 text-[var(--color-text-tertiary)]" style={{ background: 'var(--color-surface-elevated)' }}>
            Or continue with email
          </span>
        </div>
      </div>

      <form className="space-y-4" onSubmit={handleSubmit}>
        {error ? (
          <div className="flex items-center gap-2 rounded-xl border border-rose-500/20 bg-rose-500/10 p-3 text-sm text-rose-500 dark:text-rose-400 animate-in slide-in-from-top-2 duration-200">
            <AlertCircle className="h-5 w-5 shrink-0" />
            <span>{error}</span>
          </div>
        ) : null}

        <div className="space-y-1.5">
          <label className="ml-1 block text-[10px] font-bold uppercase tracking-wider text-[var(--color-text-tertiary)]">
            Full Name
          </label>
          <input
            type="text"
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full rounded-xl border px-4 py-3 text-sm transition-colors focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 focus:outline-none border-slate-200 bg-white text-slate-900 placeholder-slate-400 dark:border-white/[0.1] dark:bg-[#080c14]/50 dark:text-white dark:placeholder-slate-600"
            placeholder="Your name"
          />
        </div>

        <div className="space-y-1.5">
          <label className="ml-1 block text-[10px] font-bold uppercase tracking-wider text-[var(--color-text-tertiary)]">
            Email Address
          </label>
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full rounded-xl border px-4 py-3 text-sm transition-colors focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 focus:outline-none border-slate-200 bg-white text-slate-900 placeholder-slate-400 dark:border-white/[0.1] dark:bg-[#080c14]/50 dark:text-white dark:placeholder-slate-600"
            placeholder="you@company.com"
          />
        </div>

        <div className="space-y-1.5">
          <label className="ml-1 block text-[10px] font-bold uppercase tracking-wider text-[var(--color-text-tertiary)]">
            Password
          </label>
          <div className="relative">
            <input
              type={showPassword ? 'text' : 'password'}
              required
              minLength={8}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-xl border border-white/[0.1] bg-[#080c14]/50 px-4 py-3 pr-12 text-sm text-white placeholder-slate-600 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 focus:outline-none transition-colors"
              placeholder="********"
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute inset-y-0 right-0 flex items-center pr-4 text-[var(--color-text-tertiary)] hover:text-[var(--color-text-secondary)] transition-colors"
            >
              {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
          <p className="ml-1 mt-1.5 text-[10px] text-[var(--color-text-tertiary)]">
            Minimum 8 characters with at least one letter and one number.
          </p>
        </div>

        <button
          type="submit"
          disabled={isLoading || !name || !email || !password || password.length < 8}
          className="mt-6 w-full rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 px-4 py-3.5 text-[11px] font-bold uppercase tracking-widest text-white shadow-[0_0_20px_rgba(16,185,129,0.3)] transition-all hover:bg-gradient-to-r hover:from-emerald-400 hover:to-teal-400 active:scale-[0.98] disabled:opacity-50"
        >
          {isLoading ? <Loader2 className="mx-auto h-4 w-4 animate-spin" /> : 'Create Workspace'}
        </button>

        <div className="pt-4 text-center">
          <p className="text-[11px] font-medium text-[var(--color-text-tertiary)]">
            Already have an account?{' '}
            <Link to="/login" className="font-bold text-emerald-400 hover:text-emerald-300 transition-colors">
              Sign in here
            </Link>
          </p>
        </div>
      </form>
    </div>
  );
}
