type BrandLogoProps = {
  compact?: boolean;
  className?: string;
  theme?: 'light' | 'dark';
};

function joinClassNames(...values: Array<string | undefined>) {
  return values.filter(Boolean).join(' ');
}

export function BrandLogo({
  compact = false,
  className,
  theme = 'light',
}: BrandLogoProps) {
  const wordmarkClass = theme === 'dark' ? 'text-white' : 'text-slate-950';

  return (
    <div className={joinClassNames('inline-flex items-center gap-3', className)}>
      <span className="inline-flex h-10 w-10 items-center justify-center rounded-2xl bg-slate-950 shadow-[0_10px_30px_rgba(15,23,42,0.18)]">
        <svg
          viewBox="0 0 40 40"
          className="h-7 w-7"
          aria-hidden="true"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path
            d="M28 9L16.5 21H24L12 31"
            stroke="url(#zer0friction-logo-gradient)"
            strokeWidth="4"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <circle cx="28.5" cy="9.5" r="2.5" fill="#22c55e" />
          <defs>
            <linearGradient
              id="zer0friction-logo-gradient"
              x1="12"
              y1="9"
              x2="28"
              y2="31"
              gradientUnits="userSpaceOnUse"
            >
              <stop stopColor="#38bdf8" />
              <stop offset="1" stopColor="#22c55e" />
            </linearGradient>
          </defs>
        </svg>
      </span>
      {compact ? null : (
        <span className={joinClassNames('text-xl font-black tracking-tight', wordmarkClass)}>
          Zer0Friction
        </span>
      )}
    </div>
  );
}
