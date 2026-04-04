import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ExternalLink, Loader2, Pencil, Plus, Trash2, X } from 'lucide-react';
import { Link } from 'react-router-dom';
import { createStatusPage, deleteStatusPage, fetchStatusPages, updateStatusPage } from '../services/status-pages';
import { fetchMonitors } from '../services/monitors';
import type { StatusPage } from '../services/status-pages';

const shellCard =
  'rounded-3xl border border-white/10 bg-[#08111f]/90 shadow-[0_24px_80px_rgba(2,8,23,0.38)] backdrop-blur-xl';

export default function StatusPages() {
  const queryClient = useQueryClient();
  const [isModalOpen, setModalOpen] = useState(false);
  const [editingPage, setEditingPage] = useState<StatusPage | null>(null);
  const [formData, setFormData] = useState({ name: '', slug: '', monitorIds: [] as string[] });

  const { data: statusPages = [], isLoading } = useQuery({
    queryKey: ['statusPages'],
    queryFn: fetchStatusPages,
  });

  const { data: monitors = [] } = useQuery({
    queryKey: ['monitors'],
    queryFn: fetchMonitors,
  });

  const createMutation = useMutation({
    mutationFn: (payload: { name: string; slug: string; monitorIds: string[] }) =>
      editingPage ? updateStatusPage({ id: editingPage.id, ...payload }) : createStatusPage(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['statusPages'] });
      setModalOpen(false);
      setEditingPage(null);
      setFormData({ name: '', slug: '', monitorIds: [] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: deleteStatusPage,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['statusPages'] }),
  });

  return (
    <div className="mx-auto max-w-7xl space-y-6 pb-10 text-slate-100">
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Status Pages</h1>
          <p className="text-sm text-slate-400">Publicly share the health of your services.</p>
        </div>
        <button
          onClick={() => setModalOpen(true)}
          className="flex items-center gap-2 rounded-2xl border border-emerald-400/30 bg-emerald-400/15 px-4 py-2 font-medium text-emerald-100 transition hover:bg-emerald-400/20"
        >
          <Plus className="h-4 w-4" /> Create Page
        </button>
      </div>

      {isLoading ? (
        <div className={`${shellCard} flex justify-center p-12`}>
          <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
        </div>
      ) : statusPages.length === 0 ? (
        <div className={`${shellCard} p-20 text-center`}>
          <p className="text-slate-400">No status pages created yet.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
          {statusPages.map((page) => (
            <div key={page.id} className={`${shellCard} p-6`}>
              <div className="mb-4 flex items-center justify-between">
                <h3 className="font-bold text-white">{page.name}</h3>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => {
                      setEditingPage(page);
                      setFormData({
                        name: page.name,
                        slug: page.slug,
                        monitorIds: page.monitors.map((m: { monitor: { id: string } }) => m.monitor.id),
                      });
                      setModalOpen(true);
                    }}
                    className="rounded-xl p-2 text-slate-400 transition hover:bg-white/5 hover:text-sky-200"
                  >
                    <Pencil className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => {
                      if (window.confirm('Delete this status page?')) {
                        deleteMutation.mutate(page.id);
                      }
                    }}
                    className="rounded-xl p-2 text-slate-400 transition hover:bg-white/5 hover:text-rose-200"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
              <div className="mb-4 text-sm text-slate-400">Monitors: {page.monitors?.length || 0}</div>
              <Link
                to={`/status/${page.slug}`}
                target="_blank"
                className="inline-flex items-center gap-2 text-sm font-medium text-emerald-200 hover:text-emerald-100"
              >
                View public page <ExternalLink className="h-4 w-4" />
              </Link>
            </div>
          ))}
        </div>
      )}

      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/65 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-3xl border border-white/10 bg-[#08111f] p-6 text-slate-100 shadow-[0_30px_100px_rgba(2,8,23,0.6)]">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-xl font-bold">{editingPage ? 'Edit Status Page' : 'New Status Page'}</h2>
              <button
                onClick={() => {
                  setModalOpen(false);
                  setEditingPage(null);
                }}
                className="rounded-xl p-1 text-slate-400 hover:bg-white/5"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                createMutation.mutate(formData);
              }}
              className="space-y-4"
            >
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-300">Company / Page Name</label>
                <input
                  required
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full rounded-2xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500"
                  placeholder="Acme Corp"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-300">URL Slug</label>
                <input
                  required
                  value={formData.slug}
                  onChange={(e) => setFormData({ ...formData, slug: e.target.value.toLowerCase() })}
                  className="w-full rounded-2xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500"
                  placeholder="acme-corp"
                  pattern="[a-z0-9-]+"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-300">Select Monitors</label>
                <select
                  multiple
                  className="h-32 w-full rounded-2xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-slate-100"
                  value={formData.monitorIds}
                  onChange={(e) => {
                    const values = Array.from(e.target.selectedOptions, (option) => option.value);
                    setFormData({ ...formData, monitorIds: values });
                  }}
                >
                  {monitors.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.name}
                    </option>
                  ))}
                </select>
                <p className="mt-1 text-xs text-slate-500">Hold Ctrl/Cmd to select multiple</p>
              </div>

              {createMutation.isError ? (
                <div className="text-sm text-rose-300">Failed to create. Slug might be taken.</div>
              ) : null}

              <div className="flex justify-end gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => {
                    setModalOpen(false);
                    setEditingPage(null);
                  }}
                  className="rounded-2xl border border-white/10 px-4 py-2 text-sm text-slate-300 hover:bg-white/5"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={createMutation.isPending}
                  className="rounded-2xl border border-emerald-400/30 bg-emerald-400/15 px-4 py-2 text-sm text-emerald-100 hover:bg-emerald-400/20"
                >
                  {createMutation.isPending
                    ? editingPage
                      ? 'Saving...'
                      : 'Creating...'
                    : editingPage
                      ? 'Save Changes'
                      : 'Create'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
