import { useState } from 'react';
import type { FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { ShieldAlert, Loader2, ArrowLeft, Mail } from 'lucide-react';
import { axiosPublic } from '../services/api';

export default function ForgotPassword() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    
    try {
      await axiosPublic.post('/auth/forgot-password', { email });
      setSuccess(true);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to send reset email. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex text-slate-900 bg-slate-50 relative isolate overflow-hidden">
      {/* Background aesthetics */}
      <div className="absolute inset-x-0 top-[-10rem] -z-10 transform-gpu overflow-hidden blur-3xl sm:top-[-20rem]">
        <div className="relative left-1/2 -z-10 aspect-[1155/678] w-[36.125rem] max-w-none -translate-x-1/2 rotate-[30deg] bg-gradient-to-tr from-primary-200 to-primary-600 opacity-20 sm:left-[calc(50%-40rem)] sm:w-[72.1875rem]" />
      </div>

      <div className="flex-1 flex flex-col justify-center py-12 px-4 sm:px-6 lg:flex-none lg:px-20 xl:px-24 object-cover z-10 w-full lg:w-1/2">
        <div className="mx-auto w-full max-w-sm lg:w-[380px]">
          <div>
            <div className="flex items-center gap-2">
              <div className="w-10 h-10 rounded-xl bg-primary-600 flex items-center justify-center -rotate-3 hover:rotate-0 transition-transform">
                <ShieldAlert className="w-6 h-6 text-white" />
              </div>
              <span className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-slate-900 to-slate-700">
                Zer0Friction
              </span>
            </div>
            <h2 className="mt-8 text-3xl font-extrabold tracking-tight text-slate-900">
              Reset your password
            </h2>
            <p className="mt-2 text-sm text-slate-600">
              Enter your email address to receive a secure password reset link.
            </p>
          </div>

          <div className="mt-8">
            {success ? (
              <div className="rounded-xl bg-green-50 p-4 border border-green-200">
                <div className="flex items-start">
                  <div className="flex-shrink-0">
                    <Mail className="h-5 w-5 text-green-500" />
                  </div>
                  <div className="ml-3">
                    <p className="text-sm font-medium text-green-800">
                      Check your email inbox
                    </p>
                    <p className="text-sm text-green-700 mt-1">
                      If an account exists for {email}, we have sent a 15-minute recovery link to it. 
                    </p>
                  </div>
                </div>
                <div className="mt-6 border-t border-green-200 pt-4">
                  <Link
                    to="/login"
                    className="flex items-center text-sm font-medium text-green-700 hover:text-green-800"
                  >
                    <ArrowLeft className="w-4 h-4 mr-2" /> Return to Login
                  </Link>
                </div>
              </div>
            ) : (
              <form className="space-y-6" onSubmit={handleSubmit}>
                {error && (
                  <div className="rounded-xl bg-red-50 p-4 border border-red-200">
                    <p className="text-sm text-red-800 font-medium">{error}</p>
                  </div>
                )}

                <div>
                  <label htmlFor="email" className="block text-sm font-medium text-slate-700">
                    Email address
                  </label>
                  <div className="mt-1">
                    <input
                      id="email"
                      name="email"
                      type="email"
                      autoComplete="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="auth-input sm:text-sm"
                      placeholder="you@company.com"
                    />
                  </div>
                </div>

                <div>
                  <button
                    type="submit"
                    disabled={loading}
                    className="flex w-full justify-center rounded-xl border border-transparent bg-primary-600 py-3 px-4 text-sm font-semibold text-white shadow-sm shadow-primary-500/30 hover:bg-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Send reset instructions'}
                  </button>
                </div>
                
                <div className="text-center pt-2">
                   <Link to="/login" className="inline-flex items-center text-sm font-medium text-primary-600 hover:text-primary-500 transition-colors">
                      <ArrowLeft className="w-4 h-4 mr-1" /> Back to log in
                   </Link>
                </div>
              </form>
            )}
          </div>
        </div>
      </div>
      
      {/* Aesthetic right side block */}
      <div className="hidden lg:block relative w-1/2 bg-slate-900 border-l border-white/10 before:absolute before:inset-0 before:bg-[url('https://images.unsplash.com/photo-1550751827-4bd374c3f58b?ixlib=rb-4.0.3&auto=format&fit=crop&w=2070&q=80')] before:bg-cover before:bg-center before:opacity-20 before:mix-blend-overlay">
         <div className="absolute inset-x-0 bottom-0 z-10 p-12 lg:p-16">
           <blockquote className="space-y-4">
             <p className="text-2xl font-medium text-white/90 leading-relaxed shadow-sm">
               "Security shouldn't mean being locked out of your own infrastructure. We made recovery seamless and fundamentally secure."
             </p>
             <footer className="text-sm font-semibold text-white/70 tracking-wide uppercase">
               The Zer0Friction Team
             </footer>
           </blockquote>
         </div>
         <div className="absolute inset-0 bg-gradient-to-t from-slate-900/90 via-slate-900/40 to-transparent" />
      </div>
    </div>
  );
}
