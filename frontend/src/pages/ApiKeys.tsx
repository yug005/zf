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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-900/50 backdrop-blur-sm">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md overflow-hidden">
        <div className="flex justify-between items-center px-6 py-4 border-b border-gray-100">
          <h3 className="text-lg font-semibold text-gray-900">Create new API key</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {mutation.isError && (
            <div className="space-y-3 rounded-md border border-red-100 bg-red-50 p-3 text-sm text-red-700">
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
            <label className="block text-sm font-medium text-gray-700 mb-1">Key Name</label>
            <input
              required
              type="text"
              placeholder="e.g. CI/CD Deployment Script"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-primary-500 focus:border-primary-500 sm:text-sm"
              maxLength={64}
            />
            <p className="mt-2 text-xs text-gray-500">
              This name is strictly for your organizational convenience.
            </p>
          </div>

          <div className="mt-6 flex justify-end gap-3 pt-4 border-t border-gray-100">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={mutation.isPending || !name.trim()}
              className="inline-flex justify-center px-4 py-2 text-sm font-medium text-white bg-green-500 border border-transparent rounded-md hover:bg-green-600 focus:outline-none disabled:opacity-50"
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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-900/60 backdrop-blur-sm">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        <div className="px-6 py-5 border-b border-gray-100">
          <h3 className="text-xl font-bold text-gray-900 flex items-center gap-2">
            <CheckCircle2 className="w-6 h-6 text-green-500" />
            API Key Generated
          </h3>
        </div>

        <div className="p-6 space-y-6">
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 flex gap-3 text-yellow-800 text-sm">
            <AlertTriangle className="w-5 h-5 text-yellow-600 shrink-0" />
            <p>
              <strong>Store this key securely.</strong> For security reasons, you will absolutely not be able to see it again after closing this dialog. If you lose it, you must revoke it and generate a new one.
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Your secure API key</label>
            <div className="mt-1 flex rounded-md shadow-sm">
              <div className="relative flex flex-grow items-stretch focus-within:z-10">
                <input
                  type="text"
                  readOnly
                  value={apiKey.key}
                  className="block w-full rounded-none rounded-l-md border-gray-300 bg-gray-50 focus:border-green-500 focus:ring-green-500 sm:text-sm font-mono text-gray-600 px-4 py-3"
                />
              </div>
              <button
                type="button"
                onClick={handleCopy}
                className="relative -ml-px inline-flex items-center space-x-2 rounded-r-md border border-gray-300 bg-gray-50 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 focus:border-green-500 focus:outline-none focus:ring-1 focus:ring-green-500 transition-colors w-28 justify-center"
              >
                {copied ? (
                  <span className="text-green-600 font-semibold inline-flex items-center"><CheckCircle2 className="w-4 h-4 mr-1.5"/> Copied</span>
                ) : (
                  <span className="inline-flex items-center"><Copy className="w-4 h-4 mr-1.5 text-gray-400"/> Copy</span>
                )}
              </button>
            </div>
          </div>
        </div>

        <div className="px-6 py-4 border-t border-gray-100 bg-gray-50 flex justify-end">
          <button
            onClick={onClose}
            className="px-6 py-2 bg-gray-900 text-white text-sm font-medium rounded-md hover:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-900 transition-colors"
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
      return data;
    },
  });

  const { data: subDetails = null } = useQuery({
    queryKey: ['billingSubscription'],
    queryFn: async () => {
      const { data } = await axiosPrivate.get<SubscriptionDetails>('/billing/subscription');
      return data;
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
    <div className="space-y-6 max-w-7xl mx-auto pb-10">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">API Keys</h1>
          <p className="text-sm text-gray-500 mt-1">
            Securely authenticate external deployment pipelines and scripts to the Zer0Friction API.
          </p>
          {subDetails ? (
            <p className="mt-2 text-xs font-medium text-gray-600">
              Plan usage: <span className="text-gray-900">{apiKeyUsageLabel}</span> active keys on {subDetails.plan}.
            </p>
          ) : null}
        </div>
        <div className="flex items-center gap-3">
          <Link
            to="/billing"
            className="text-sm font-medium text-gray-600 underline underline-offset-2 hover:text-gray-900"
          >
            Upgrade plan
          </Link>
          <button
            onClick={() => setCreateOpen(true)}
            disabled={Boolean(subDetails && subDetails.usage.apiKeysUsed >= subDetails.usage.apiKeysLimit)}
            className="inline-flex items-center justify-center px-4 py-2 text-sm font-medium text-white bg-gray-900 border border-transparent rounded-md shadow-sm hover:bg-gray-800 transition-colors disabled:opacity-50"
          >
            <Plus className="w-4 h-4 mr-2" />
            Create API Key
          </button>
        </div>
      </div>

      {subDetails?.status === 'TRIALING' ? (
        <div className="rounded-xl border border-blue-200 bg-blue-50 px-5 py-4 text-sm text-blue-900">
          Trial active: {subDetails.daysRemainingInTrial} day{subDetails.daysRemainingInTrial === 1 ? '' : 's'} left before monitoring pauses. Your API key workflows can stay configured while you evaluate the product.
        </div>
      ) : null}

      {subDetails && subDetails.usage.apiKeysUsed >= subDetails.usage.apiKeysLimit ? (
        <UpgradePrompt reason="monitor_limit" />
      ) : null}

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
        <div className="lg:col-span-3">
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
            {isLoading ? (
              <div className="p-12 flex justify-center"><Loader2 className="w-6 h-6 animate-spin text-gray-400" /></div>
            ) : apiKeys.length === 0 ? (
              <div className="p-16 text-center flex flex-col items-center">
                <Key className="w-12 h-12 text-gray-300 mb-4" />
                <h3 className="text-lg font-medium text-gray-900">No active keys</h3>
                <p className="mt-1 text-sm text-gray-500 max-w-sm mx-auto">
                  Generate an API key to securely push configuration changes programmatically.
                </p>
              </div>
            ) : (
              <table className="min-w-full divide-y divide-gray-200 text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-4 text-left font-medium text-gray-500 uppercase tracking-wider">Key Name</th>
                    <th className="px-6 py-4 text-left font-medium text-gray-500 uppercase tracking-wider">Prefix Handle</th>
                    <th className="px-6 py-4 text-left font-medium text-gray-500 uppercase tracking-wider">Created</th>
                    <th className="px-6 py-4 text-right font-medium text-gray-500 uppercase tracking-wider">Status</th>
                    <th className="px-6 py-4"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 bg-white">
                  {apiKeys.map((k) => {
                    const isRevoked = !!k.revokedAt;
                    return (
                      <tr key={k.id} className={isRevoked ? 'bg-gray-50 opacity-60' : 'hover:bg-gray-50/50 transition-colors'}>
                        <td className="px-6 py-4 font-medium text-gray-900">
                          {k.name}
                        </td>
                        <td className="px-6 py-4 font-mono text-gray-500 bg-gray-50/50 rounded">
                          {k.prefix}............
                        </td>
                        <td className="px-6 py-4 text-gray-500">
                          {new Date(k.createdAt).toLocaleDateString()}
                        </td>
                        <td className="px-6 py-4 text-right">
                          {isRevoked ? (
                            <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-red-100 text-red-800">
                              REVOKED
                            </span>
                          ) : (
                            <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800">
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
                              className="text-gray-400 hover:text-red-600 transition-colors flex items-center justify-end w-full"
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
