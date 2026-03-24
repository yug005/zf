import { useEffect, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { CheckCircle2, Loader2, Mail, RefreshCcw, ShieldCheck, TriangleAlert } from 'lucide-react';
import { axiosPublic } from '../services/api';

type VerifyState = 'loading' | 'success' | 'error';

export default function VerifyEmail() {
  const [searchParams] = useSearchParams();
  const [state, setState] = useState<VerifyState>('loading');
  const [message, setMessage] = useState('Verifying your secure email link...');
  const [isResending, setIsResending] = useState(false);
  const [resendMessage, setResendMessage] = useState('');
  const hasRequested = useRef(false);

  const email = searchParams.get('email')?.trim() || '';
  const token = searchParams.get('token')?.trim() || '';

  useEffect(() => {
    if (hasRequested.current) return;
    hasRequested.current = true;

    if (!email || !token) {
      setState('error');
      setMessage('Invalid verification request or account already verified.');
      return;
    }

    const run = async () => {
      try {
        const { data } = await axiosPublic.get('/auth/verify-email', {
          params: { email, token },
        });

        setState('success');
        setMessage(
          data?.alreadyVerified
            ? 'This email was already verified. You can sign in now.'
            : 'Your email has been verified. Your trial is ready to use.',
        );
      } catch (err: any) {
        setState('error');
        setMessage(
          err.response?.data?.message ||
            'We could not verify this link. You can request a fresh email below.',
        );
      }
    };

    void run();
  }, [email, token]);

  const handleResend = async () => {
    if (!email) {
      setResendMessage('Open the original verification email again or register with the correct address.');
      return;
    }

    setIsResending(true);
    setResendMessage('');

    try {
      const { data } = await axiosPublic.post('/auth/resend-verification', { email });
      setResendMessage(
        data?.message || 'If the account still needs verification, a fresh link is on the way.',
      );
    } catch (err: any) {
      setResendMessage(
        err.response?.data?.message || 'We could not resend the verification email right now.',
      );
    } finally {
      setIsResending(false);
    }
  };

  const cardTone =
    state === 'success'
      ? 'border-emerald-200 bg-emerald-50'
      : state === 'error'
        ? 'border-rose-200 bg-rose-50'
        : 'border-slate-200 bg-white';

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="text-center">
        <div className="mb-6 flex justify-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-900 shadow-lg shadow-slate-900/20">
            <ShieldCheck className="h-8 w-8 text-white" />
          </div>
        </div>
        <h2 className="text-3xl font-extrabold tracking-tight text-slate-900 dark:text-white">
          Verify your email
        </h2>
        <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
          We are checking your secure verification link now.
        </p>
      </div>

      <div className={`rounded-3xl border p-6 shadow-sm ${cardTone}`}>
        <div className="flex items-start gap-4">
          <div
            className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl ${
              state === 'success'
                ? 'bg-emerald-100 text-emerald-700'
                : state === 'error'
                  ? 'bg-rose-100 text-rose-700'
                  : 'bg-slate-100 text-slate-500'
            }`}
          >
            {state === 'loading' ? (
              <Loader2 className="h-6 w-6 animate-spin" />
            ) : state === 'success' ? (
              <CheckCircle2 className="h-6 w-6" />
            ) : (
              <TriangleAlert className="h-6 w-6" />
            )}
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-lg font-semibold text-slate-900">{message}</p>
            {email ? <p className="mt-2 text-sm text-slate-600">Email: {email}</p> : null}
            {state === 'loading' ? (
              <p className="mt-3 text-sm text-slate-500">
                This normally finishes in a moment. Keep this tab open.
              </p>
            ) : null}
          </div>
        </div>
      </div>

      <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <h3 className="text-base font-semibold text-slate-900">Need another verification email?</h3>
        <p className="mt-2 text-sm leading-6 text-slate-600">
          If this link expired, was already used on another device, or got copied incorrectly, we can send a fresh one.
        </p>
        <button
          type="button"
          onClick={handleResend}
          disabled={isResending}
          className="mt-4 inline-flex items-center rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 shadow-sm transition hover:border-slate-300 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isResending ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <RefreshCcw className="mr-2 h-4 w-4" />
          )}
          Resend verification email
        </button>
        {resendMessage ? (
          <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">
            <div className="flex items-start gap-3">
              <Mail className="mt-0.5 h-4 w-4 shrink-0" />
              <span>{resendMessage}</span>
            </div>
          </div>
        ) : null}
      </div>

      <div className="flex flex-wrap gap-3">
        <Link
          to="/login"
          className="inline-flex items-center rounded-xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white transition hover:bg-slate-800"
        >
          Go to sign in
        </Link>
        <Link
          to="/register"
          className="inline-flex items-center rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-slate-50"
        >
          Back to registration
        </Link>
      </div>
    </div>
  );
}
