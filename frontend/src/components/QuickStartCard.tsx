import { ArrowRight, Zap } from 'lucide-react';
import { Link } from 'react-router-dom';

interface QuickStartCardProps {
  type: 'general' | 'monitoring' | 'api';
}

export function QuickStartCard({ type }: QuickStartCardProps) {
  const content = {
    general: {
      title: 'Start Monitoring within 2 min',
      steps: [
        'Connect your first Project',
        'Add an HTTP Endpoint',
        'Set up Email Alerts'
      ]
    },
    monitoring: {
      title: 'Setup Tracking within 2 min',
      steps: [
        'Enter your App URL',
        'Choose Check Interval',
        'Enable Real-time Alerts'
      ]
    },
    api: {
      title: 'Enable API Access within 2 min',
      steps: [
        'Generate and name your Key',
        'Copy the Secret safely',
        'Start making SDK calls'
      ]
    }
  };

  const current = content[type];

  return (
    <div className="bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-2xl p-5 shadow-sm hover:shadow-md transition-shadow group relative overflow-hidden">
      <div className="absolute top-0 right-0 -mr-4 -mt-4 w-16 h-16 bg-primary-500/5 rounded-full" />
      
      <div className="flex items-center gap-2 mb-4">
        <div className="p-1.5 bg-primary-100 dark:bg-primary-900/30 rounded-lg">
          <Zap className="w-4 h-4 text-primary-600 dark:text-primary-400 animate-pulse" />
        </div>
        <h3 className="text-[11px] font-black text-slate-900 dark:text-slate-100 uppercase tracking-widest">{current.title}</h3>
      </div>
      
      <ul className="space-y-3 mb-6">
        {current.steps.map((step, i) => (
          <li key={i} className="flex items-center gap-3 text-xs text-slate-600 dark:text-slate-400 font-medium tracking-tight">
            <span className="flex-shrink-0 w-5 h-5 rounded-full bg-slate-100 dark:bg-slate-700/50 text-slate-600 dark:text-slate-300 flex items-center justify-center font-bold text-[10px] border border-slate-200/50 dark:border-slate-600/50">{i+1}</span>
            {step}
          </li>
        ))}
      </ul>
      
      <Link 
        to={`/how-to-use${type === 'monitoring' ? '#monitoring' : type === 'api' ? '#api' : ''}`}
        className="flex items-center justify-between text-[11px] font-extrabold text-primary-600 dark:text-primary-400 hover:text-primary-700 dark:hover:text-primary-300 transition-all uppercase tracking-widest pt-4 border-t border-slate-100 dark:border-gray-700/50"
      >
        View Detailed Guide <ArrowRight className="w-4 h-4 group-hover:translate-x-1.5 transition-transform" />
      </Link>
    </div>
  );
}
