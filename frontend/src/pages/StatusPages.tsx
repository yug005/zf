import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Loader2, Plus, Trash2, ExternalLink, Pencil, X } from 'lucide-react';
import { Link } from 'react-router-dom';
import { fetchStatusPages, createStatusPage, deleteStatusPage, updateStatusPage } from '../services/status-pages';
import { fetchMonitors } from '../services/monitors';
import type { StatusPage } from '../services/status-pages';

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
    mutationFn: (payload: any) => editingPage ? updateStatusPage({ id: editingPage.id, ...payload }) : createStatusPage(payload),
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
    <div className="mx-auto max-w-7xl space-y-6 pb-10">
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Status Pages</h1>
          <p className="text-sm text-slate-500">Publicly share the health of your services.</p>
        </div>
        <button
          onClick={() => setModalOpen(true)}
          className="flex items-center gap-2 rounded-xl bg-blue-500 px-4 py-2 font-medium text-white hover:bg-blue-600"
        >
          <Plus className="h-4 w-4" /> Create Page
        </button>
      </div>

      {isLoading ? (
        <div className="flex justify-center p-12"><Loader2 className="animate-spin" /></div>
      ) : statusPages.length === 0 ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-20 text-center shadow-sm">
          <p className="text-slate-500">No status pages created yet.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
          {statusPages.map(page => (
            <div key={page.id} className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-bold text-slate-900">{page.name}</h3>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => {
                      setEditingPage(page);
                      setFormData({ 
                        name: page.name, 
                        slug: page.slug, 
                        monitorIds: page.monitors.map((m: any) => m.monitor.id) 
                      });
                      setModalOpen(true);
                    }}
                    className="text-blue-500 hover:text-blue-700 p-2"
                  >
                    <Pencil className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => {
                      if (window.confirm('Delete this status page?')) {
                        deleteMutation.mutate(page.id);
                      }
                    }}
                    className="text-red-500 hover:text-red-700 p-2"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
              <div className="text-sm text-slate-500 mb-4">
                Monitors: {page.monitors?.length || 0}
              </div>
              <Link 
                to={`/status/${page.slug}`} 
                target="_blank"
                className="inline-flex items-center gap-2 text-sm text-blue-600 font-medium hover:underline"
              >
                View public page <ExternalLink className="h-4 w-4" />
              </Link>
            </div>
          ))}
        </div>
      )}

      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl">
            <div className="flex items-center justify-between mb-4">
               <h2 className="text-xl font-bold">{editingPage ? 'Edit Status Page' : 'New Status Page'}</h2>
               <button onClick={() => { setModalOpen(false); setEditingPage(null); }} className="p-1 hover:bg-slate-100 rounded">
                 <X className="h-5 w-5" />
               </button>
            </div>
            <form onSubmit={e => {
              e.preventDefault();
              createMutation.mutate(formData);
            }} className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">Company / Page Name</label>
                <input
                  required
                  value={formData.name}
                  onChange={e => setFormData({ ...formData, name: e.target.value })}
                  className="w-full rounded-xl border px-3 py-2 text-sm"
                  placeholder="Acme Corp"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">URL Slug</label>
                <input
                  required
                  value={formData.slug}
                  onChange={e => setFormData({ ...formData, slug: e.target.value.toLowerCase() })}
                  className="w-full rounded-xl border px-3 py-2 text-sm"
                  placeholder="acme-corp"
                  pattern="[a-z0-9-]+"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Select Monitors</label>
                <select 
                  multiple 
                  className="w-full rounded-xl border px-3 py-2 text-sm h-32"
                  value={formData.monitorIds}
                  onChange={e => {
                    const values = Array.from(e.target.selectedOptions, option => option.value);
                    setFormData({ ...formData, monitorIds: values });
                  }}
                >
                  {monitors.map(m => (
                    <option key={m.id} value={m.id}>{m.name}</option>
                  ))}
                </select>
                <p className="text-xs text-slate-500 mt-1">Hold Ctrl/Cmd to select multiple</p>
              </div>
              
              {createMutation.isError && (
                 <div className="text-sm text-red-500">Failed to create. Slug might be taken.</div>
              )}

              <div className="flex justify-end gap-3 pt-4">
                <button type="button" onClick={() => { setModalOpen(false); setEditingPage(null); }} className="rounded-xl px-4 py-2 text-sm border hover:bg-slate-50">Cancel</button>
                <button type="submit" disabled={createMutation.isPending} className="rounded-xl bg-blue-500 text-white px-4 py-2 text-sm hover:bg-blue-600">
                  {createMutation.isPending ? (editingPage ? 'Saving...' : 'Creating...') : (editingPage ? 'Save Changes' : 'Create')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
