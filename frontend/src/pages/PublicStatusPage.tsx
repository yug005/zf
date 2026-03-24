import { useQuery } from '@tanstack/react-query';
import { useParams } from 'react-router-dom';
import { CheckCircle2, AlertCircle, Loader2 } from 'lucide-react';
import { fetchPublicStatusPage } from '../services/status-pages';

export default function PublicStatusPage() {
  const { slug } = useParams();

  const { data, isLoading, isError } = useQuery({
    queryKey: ['publicStatus', slug],
    queryFn: () => fetchPublicStatusPage(slug as string),
    refetchInterval: 30000,
  });

  if (isLoading) return <div className="min-h-screen flex items-center justify-center bg-slate-50"><Loader2 className="h-8 w-8 animate-spin text-slate-400" /></div>;
  if (isError || !data) return <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50 "><h1 className="text-2xl font-bold mb-2">Page Not Found</h1><p className="text-slate-500">The status page you are looking for does not exist.</p></div>;

  const isAllUp = data.overallStatus === 'UP';
  const headerBg = isAllUp ? 'bg-emerald-500' : (data.overallStatus === 'DOWN' ? 'bg-red-500' : 'bg-amber-500');

  return (
    <div className="min-h-screen bg-slate-50 pb-20 font-sans">
      <div className={`${headerBg} h-2 w-full`} />
      <div className="max-w-3xl mx-auto pt-16 px-6">
        <div className="mb-12 text-center">
          <h1 className="text-4xl font-extrabold text-slate-900 mb-2">{data.name}</h1>
          <p className="text-lg text-slate-500">Service Status Portal</p>
        </div>

        <div className={`rounded-2xl border p-8 mb-12 flex flex-col sm:flex-row items-center justify-center text-center sm:text-left gap-6 shadow-sm ${isAllUp ? 'bg-emerald-50/50 border-emerald-200 text-emerald-900' : 'bg-red-50/50 border-red-200 text-red-900'}`}>
          {isAllUp ? <CheckCircle2 className="h-12 w-12 text-emerald-500 shrink-0" /> : <AlertCircle className="h-12 w-12 text-red-500 shrink-0" />}
          <div>
            <h2 className="text-2xl font-bold mb-1">{isAllUp ? 'All Systems Operational' : 'Some systems are experiencing issues'}</h2>
            <p className="text-sm opacity-80">Last updated: {new Date(data.updatedAt).toLocaleString()}</p>
          </div>
        </div>

        <div className="bg-white border text-left rounded-2xl shadow-sm overflow-hidden mb-12">
          <div className="px-8 py-5 border-b bg-slate-50/50 flex justify-between items-center text-slate-800 font-semibold tracking-wide">
            System Components
          </div>
          <div className="divide-y divide-slate-100/80">
            {data.monitors.map((m: any, i: number) => {
              const isUp = m.status === 'UP';
              const isDegraded = m.status === 'DEGRADED';
              return (
                <div key={i} className="px-8 py-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 transition-colors hover:bg-slate-50/30">
                  <div className="font-semibold text-slate-800 text-lg">{m.name}</div>
                  <div className={`flex items-center gap-2 text-sm font-bold uppercase tracking-wider rounded-xl px-4 py-2 ${isUp ? 'bg-emerald-100/50 text-emerald-700' : (isDegraded ? 'bg-amber-100/50 text-amber-700' : 'bg-red-100/50 text-red-700')}`}>
                    {isUp ? 'Operational' : (isDegraded ? 'Degraded' : 'Major Outage')}
                  </div>
                </div>
              )
            })}
            {data.monitors.length === 0 && (
              <div className="px-8 py-10 text-center text-slate-500 italic">No components configured.</div>
            )}
          </div>
        </div>

        <div className="bg-white border text-left rounded-2xl shadow-sm overflow-hidden mb-12">
          <div className="px-8 py-5 border-b bg-slate-50/50 flex justify-between items-center text-slate-800 font-semibold tracking-wide">
            Incident Timeline
          </div>
          <div className="p-8">
            {!data.incidents || data.incidents.length === 0 ? (
              <div className="text-center text-slate-500 italic py-4">No recent incidents.</div>
            ) : (
              <div className="relative pl-4 space-y-8 before:absolute before:inset-0 before:ml-[1.4rem] before:-translate-x-px md:before:mx-auto md:before:translate-x-0 before:h-full before:w-0.5 before:bg-slate-200">
                {data.incidents.map((incident: any) => {
                   const isResolved = incident.status === 'RESOLVED';
                   return (
                      <div key={incident.id} className="relative flex items-center justify-between md:justify-normal md:odd:flex-row-reverse group">
                        {/* Timeline Dot */}
                        <div className={`flex items-center justify-center w-5 h-5 rounded-full border-4 border-white shadow shrink-0 md:order-1 md:group-odd:-translate-x-1/2 md:group-even:translate-x-1/2 ${isResolved ? 'bg-emerald-500' : 'bg-amber-500 animate-pulse'}`}></div>
                        
                        {/* Card */}
                        <div className={`w-[calc(100%-3rem)] md:w-[calc(50%-2rem)] p-4 rounded-xl border border-slate-200 bg-white shadow-sm transition hover:shadow-md ${!isResolved ? 'border-amber-200 ring-1 ring-amber-100' : ''}`}>
                          <div className="flex items-center justify-between mb-1">
                            <span className={`text-xs font-bold uppercase ${isResolved ? 'text-emerald-600' : 'text-amber-600'}`}>
                              {incident.status}
                            </span>
                            <span className="text-[10px] text-slate-400 font-mono">
                              {new Date(incident.createdAt).toLocaleString()}
                            </span>
                          </div>
                          
                          <div className="mt-2 text-xs font-semibold text-slate-500 uppercase tracking-widest leading-relaxed">
                            {incident.monitor?.name}
                          </div>
                          
                          <p className="mt-1 text-sm text-slate-800 font-medium leading-relaxed">{incident.message}</p>
                          
                          {incident.resolvedAt && (
                            <p className="mt-3 text-xs text-slate-500">
                              Duration: {Math.max(1, Math.round((new Date(incident.resolvedAt).getTime() - new Date(incident.createdAt).getTime()) / 60000))} mins
                            </p>
                          )}
                        </div>
                      </div>
                   )
                })}
              </div>
            )}
          </div>
        </div>
        
        <div className="mt-16 text-center text-sm font-medium text-slate-400 flex items-center justify-center gap-2">
           Powered by <a href="/" className="text-blue-500 hover:text-blue-600 transition-colors">Zer0Friction</a>
        </div>
      </div>
    </div>
  );
}
