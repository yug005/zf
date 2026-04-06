import { useMemo, useState } from 'react';
import type { FormEvent } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Key, Trash2, Copy, AlertTriangle, Plus, Loader2, X, CheckCircle2 } from 'lucide-react';
import { axiosPrivate } from '../services/api';
import { QuickStartCard } from '../components/QuickStartCard';
import { UpgradePrompt } from '../components/UpgradePrompt';
import { Link } from 'react-router-dom';

// --- Types ---
interface ApiKeyMeta {
  id: string;
  name: string;
  prefix: string;
  createdAt: string;
  revokedAt: string | null;
}

interface NewApiKeyResponse {
  id: string;
  name: string;
  prefix: string;
  key: string;
  createdAt: string;
}

interface SubscriptionDetails {
  plan: 'TRIAL' | 'LITE' | 'PRO' | 'BUSINESS' | 'ENTERPRISE';
  status: 'TRIALING' | 'ACTIVE' | 'EXPIRED' | 'CANCELLED';
  daysRemainingInTrial: number;
  usage: {
    monitorsUsed: number;
    monitorsLimit: number;
    apiKeysUsed: number;
    apiKeysLimit: number;
    minimumIntervalSeconds: number;
  };
  hasActiveSubscription: boolean;
}

function ensureArray<T>(value: unknown): T[] {
  return Array.isArray(value) ? (value as T[]) : [];
}

// --- Modals ---

const CreateApiKeyModal = ({
  isOpen,
  onClose,
  onSuccessRawKey,
  onOpenBilling,
}: {
  isOpen: boolean;
  onClose: () => void;
  onSuccessRawKey: (data: NewApiKeyResponse) => void;
  onOpenBilling: () => void;
}) => {
  const [name, setName] = useState('');

  const mutation = useMutation({
    mutationFn: async (payload: { name: string }) => {
      const { data } = await axiosPrivate.post<NewApiKeyResponse>('/api-keys', payload);
      return data;
    },
    onSuccess: (data) => {
      setName('');
      onSuccessRawKey(data); // Yield exactly once to the parent displaying the raw output layout
    },
  });

  if (!isOpen) return null;

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (name.trim()) mutation.mutate({ name });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/65 p-4 backdrop-blur-sm">
      <div className="w-full max-w-md overflow-hidden rounded-3xl border border-white/10 bg-[#08111f] shadow-[0_30px_100px_rgba(2,8,23,0.6)]">
        <div className="flex items-center justify-between border-b border-white/10 px-6 py-4">
          <h3 className="text-lg font-semibold text-white">Create new API key</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-200">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {mutation.isError && (
            <div className="space-y-3 rounded-2xl border border-rose-400/20 bg-rose-500/10 p-3 text-sm text-rose-200">
              <div className="flex items-start">
              <AlertTriangle className="w-5 h-5 mr-2 shrink-0" />
                <span>{mutation.error instanceof Error ? mutation.error.message : 'Failed to generate API Key. Please try again.'}</span>
              </div>
              <button
                type="button"
                onClick={onOpenBilling}
                className="font-semibold underline underline-offset-2"
              >
                Review plans and upgrade
              </button>
            </div>
          )}

          <div>
            <label className="mb-1 block text-sm font-medium text-slate-300">Key Name</label>
            <input
              required
              type="text"
              placeholder="e.g. CI/CD Deployment Script"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full rounded-2xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500 shadow-sm"
              maxLength={64}
            />
            <p className="mt-2 text-xs text-slate-500">
              This name is strictly for your organizational convenience.
            </p>
          </div>

          <div className="mt-6 flex justify-end gap-3 border-t border-white/10 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="rounded-2xl border border-white/10 bg-transparent px-4 py-2 text-sm font-medium text-slate-300 hover:bg-white/5 focus:outline-none"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={mutation.isPending || !name.trim()}
              className="inline-flex justify-center rounded-2xl border border-emerald-400/30 bg-emerald-400/15 px-4 py-2 text-sm font-medium text-emerald-100 hover:bg-emerald-400/20 focus:outline-none disabled:opacity-50"
            >
              {mutation.isPending ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Generate Key'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

const RawKeyRevealModal = ({
  apiKey,
  onClose,
}: {
  apiKey: NewApiKeyResponse | null;
  onClose: () => void;
}) => {
  const [copied, setCopied] = useState(false);

  if (!apiKey) return null;

  const handleCopy = () => {
    navigator.clipboard.writeText(apiKey.key);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-4 backdrop-blur-sm">
      <div className="w-full max-w-xl overflow-hidden rounded-3xl border border-white/10 bg-[#08111f] shadow-[0_30px_100px_rgba(2,8,23,0.6)] animate-in fade-in zoom-in-95 duration-200">
        <div className="border-b border-white/10 px-6 py-5">
          <h3 className="flex items-center gap-2 text-xl font-bold text-white">
            <CheckCircle2 className="w-6 h-6 text-green-500" />
            API Key Generated
          </h3>
        </div>

        <div className="p-6 space-y-6">
          <div className="flex gap-3 rounded-2xl border border-amber-400/20 bg-amber-500/10 p-4 text-sm text-amber-100">
            <AlertTriangle className="w-5 h-5 text-yellow-600 shrink-0" />
            <p>
              <strong>Store this key securely.</strong> For security reasons, you will absolutely not be able to see it again after closing this dialog. If you lose it, you must revoke it and generate a new one.
            </p>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-slate-300">Your secure API key</label>
            <div className="mt-1 flex rounded-md shadow-sm">
              <div className="relative flex flex-grow items-stretch focus-within:z-10">
                <input
                  type="text"
                  readOnly
                  value={apiKey.key}
                  className="block w-full rounded-none rounded-l-2xl border border-white/10 bg-white/5 px-4 py-3 font-mono text-slate-200 sm:text-sm"
                />
              </div>
              <button
                type="button"
                onClick={handleCopy}
                className="relative -ml-px inline-flex w-28 items-center justify-center space-x-2 rounded-r-2xl border border-white/10 bg-white/5 px-4 py-2 text-sm font-medium text-slate-200 transition-colors hover:bg-white/10"
              >
                {copied ? (
                  <span className="text-green-600 font-semibold inline-flex items-center"><CheckCircle2 className="w-4 h-4 mr-1.5"/> Copied</span>
                ) : (
                    <span className="inline-flex items-center"><Copy className="mr-1.5 h-4 w-4 text-slate-400"/> Copy</span>
                )}
              </button>
            </div>
          </div>
        </div>

        <div className="flex justify-end border-t border-white/10 bg-white/[0.03] px-6 py-4">
          <button
            onClick={onClose}
            className="rounded-2xl border border-white/10 bg-white/5 px-6 py-2 text-sm font-medium text-white transition-colors hover:bg-white/10 focus:outline-none"
          >
            I have saved it securely
          </button>
        </div>
      </div>
    </div>
  );
};

// --- Main Page Component ---
export default function ApiKeys() {
  const queryClient = useQueryClient();
  const [isCreateOpen, setCreateOpen] = useState(false);
  const [revealedKey, setRevealedKey] = useState<NewApiKeyResponse | null>(null);

  const { data: apiKeys = [], isLoading } = useQuery({
    queryKey: ['apiKeys'],
    queryFn: async () => {
      const { data } = await axiosPrivate.get<ApiKeyMeta[]>('/api-keys');
      return ensureArray<ApiKeyMeta>(data);
    },
  });

  const { data: subDetails = null } = useQuery({
    queryKey: ['billingSubscription'],
    queryFn: async () => {
      const { data } = await axiosPrivate.get<SubscriptionDetails>('/billing/subscription');
      return data && typeof data === 'object' ? data : null;
    },
  });

  const revokeMutation = useMutation({
    mutationFn: async (id: string) => {
      await axiosPrivate.delete(`/api-keys/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['apiKeys'] });
    },
  });

  const handleRevealClose = () => {
    setRevealedKey(null);
    queryClient.invalidateQueries({ queryKey: ['apiKeys'] });
  };

  const apiKeyUsageLabel = useMemo(() => {
    if (!subDetails) return null;
    return `${subDetails.usage.apiKeysUsed} / ${subDetails.usage.apiKeysLimit > 100000 ? 'Unlimited' : subDetails.usage.apiKeysLimit}`;
  }, [subDetails]);

  return (
    <div className="mx-auto max-w-7xl space-y-6 pb-10 text-slate-100">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">API Keys</h1>
          <p className="mt-1 text-sm text-slate-400">
            Securely authenticate external deployment pipelines and scripts to the Zer0Friction API.
          </p>
          {subDetails ? (
            <p className="mt-2 text-xs font-medium text-slate-400">
              Plan usage: <span className="text-slate-100">{apiKeyUsageLabel}</span> active keys on {subDetails.plan}.
            </p>
          ) : null}
        </div>
        <div className="flex items-center gap-3">
          <Link
            to="/billing"
            className="text-sm font-medium text-slate-300 underline underline-offset-2 hover:text-white"
          >
            Upgrade plan
          </Link>
          <button
            onClick={() => setCreateOpen(true)}
            disabled={Boolean(subDetails && subDetails.usage.apiKeysUsed >= subDetails.usage.apiKeysLimit)}
            className="inline-flex items-center justify-center rounded-2xl border border-emerald-400/30 bg-emerald-400/15 px-4 py-2 text-sm font-medium text-emerald-100 shadow-sm transition-colors hover:bg-emerald-400/20 disabled:opacity-50"
          >
            <Plus className="w-4 h-4 mr-2" />
            Create API Key
          </button>
        </div>
      </div>

      {subDetails?.status === 'TRIALING' ? (
        <div className="rounded-2xl border border-sky-400/20 bg-sky-500/10 px-5 py-4 text-sm text-sky-100">
          Trial active: {subDetails.daysRemainingInTrial} day{subDetails.daysRemainingInTrial === 1 ? '' : 's'} left before monitoring pauses. Your API key workflows can stay configured while you evaluate the product.
        </div>
      ) : null}

      {subDetails && subDetails.usage.apiKeysUsed >= subDetails.usage.apiKeysLimit ? (
        <UpgradePrompt reason="monitor_limit" />
      ) : null}

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
        <div className="lg:col-span-3">
          <div className="overflow-hidden rounded-3xl border border-white/10 bg-[#08111f]/90 shadow-[0_24px_80px_rgba(2,8,23,0.38)] backdrop-blur-xl">
            {isLoading ? (
              <div className="flex justify-center p-12"><Loader2 className="h-6 w-6 animate-spin text-slate-400" /></div>
            ) : apiKeys.length === 0 ? (
              <div className="p-16 text-center flex flex-col items-center">
                <Key className="mb-4 h-12 w-12 text-slate-500" />
                <h3 className="text-lg font-medium text-white">No active keys</h3>
                <p className="mx-auto mt-1 max-w-sm text-sm text-slate-400">
                  Generate an API key to securely push configuration changes programmatically.
                </p>
              </div>
            ) : (
              <table className="min-w-full divide-y divide-white/10 text-sm">
                <thead className="bg-white/[0.03]">
                  <tr>
                    <th className="px-6 py-4 text-left font-medium uppercase tracking-wider text-slate-400">Key Name</th>
                    <th className="px-6 py-4 text-left font-medium uppercase tracking-wider text-slate-400">Prefix Handle</th>
                    <th className="px-6 py-4 text-left font-medium uppercase tracking-wider text-slate-400">Created</th>
                    <th className="px-6 py-4 text-right font-medium uppercase tracking-wider text-slate-400">Status</th>
                    <th className="px-6 py-4"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/6 bg-transparent">
                  {apiKeys.map((k) => {
                    const isRevoked = !!k.revokedAt;
                    return (
                      <tr key={k.id} className={isRevoked ? 'bg-white/[0.02] opacity-60' : 'transition-colors hover:bg-white/[0.03]'}>
                        <td className="px-6 py-4 font-medium text-white">
                          {k.name}
                        </td>
                        <td className="px-6 py-4 font-mono text-slate-400">
                          {k.prefix}............
                        </td>
                        <td className="px-6 py-4 text-slate-400">
                          {new Date(k.createdAt).toLocaleDateString()}
                        </td>
                        <td className="px-6 py-4 text-right">
                          {isRevoked ? (
                            <span className="inline-flex items-center rounded-full border border-rose-400/20 bg-rose-500/10 px-2 py-0.5 text-xs font-medium text-rose-200">
                              REVOKED
                            </span>
                          ) : (
                            <span className="inline-flex items-center rounded-full border border-emerald-400/20 bg-emerald-500/10 px-2 py-0.5 text-xs font-medium text-emerald-200">
                              ACTIVE
                            </span>
                          )}
                        </td>
                        <td className="px-6 py-4 text-right">
                          {!isRevoked && (
                            <button
                              onClick={() => {
                                if (window.confirm(`Are you absolutely sure you want to revoke "${k.name}"?`)) {
                                  revokeMutation.mutate(k.id);
                                }
                              }}
                              disabled={revokeMutation.isPending}
                              className="flex w-full items-center justify-end text-slate-500 transition-colors hover:text-rose-300"
                              title="Revoke Secure Key"
                            >
                              <Trash2 className="w-4 h-4 ml-auto" />
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        </div>

        <div className="lg:col-span-1">
          <QuickStartCard type="api" />
        </div>
      </div>

      <CreateApiKeyModal
        isOpen={isCreateOpen}
        onClose={() => setCreateOpen(false)}
        onSuccessRawKey={(data) => {
          setCreateOpen(false);
          setRevealedKey(data);
        }}
        onOpenBilling={() => {
          setCreateOpen(false);
          window.location.href = '/billing';
        }}
      />

      <RawKeyRevealModal
        apiKey={revealedKey}
        onClose={handleRevealClose}
      />
    </div>
  );
}
