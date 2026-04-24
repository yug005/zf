import { Moon, Sun, Monitor } from 'lucide-react';
import { motion } from 'framer-motion';
import { useTheme } from './ThemeProvider';

export function ModeToggle() {
  const { theme, setTheme } = useTheme();

  const options = [
    { value: 'light' as const, icon: Sun, label: 'Light' },
    { value: 'system' as const, icon: Monitor, label: 'System' },
    { value: 'dark' as const, icon: Moon, label: 'Dark' },
  ];

  return (
    <div
      className="relative flex items-center gap-0.5 rounded-2xl border p-1 transition-colors duration-300
        border-slate-200 bg-slate-100
        dark:border-white/10 dark:bg-white/[0.05]"
      role="radiogroup"
      aria-label="Theme selection"
    >
      {options.map(({ value, icon: Icon, label }) => {
        const isActive = theme === value;
        return (
          <button
            key={value}
            role="radio"
            aria-checked={isActive}
            aria-label={`${label} mode`}
            onClick={() => setTheme(value)}
            className={`relative z-10 flex items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-semibold transition-colors duration-200
              ${isActive
                ? 'text-slate-900 dark:text-white'
                : 'text-slate-400 hover:text-slate-600 dark:text-slate-500 dark:hover:text-slate-300'
              }`}
          >
            {isActive && (
              <motion.div
                layoutId="theme-toggle-pill"
                className="absolute inset-0 rounded-xl shadow-sm transition-colors duration-300
                  bg-white border border-slate-200/80
                  dark:bg-white/10 dark:border-white/10"
                transition={{ type: 'spring', bounce: 0.2, duration: 0.5 }}
              />
            )}
            <Icon className="relative z-10 h-3.5 w-3.5" />
            <span className="relative z-10 hidden sm:inline">{label}</span>
          </button>
        );
      })}
    </div>
  );
}
