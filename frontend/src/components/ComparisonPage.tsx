import { Link } from 'react-router-dom';
import {
  ArrowRight,
  CheckCircle2,
  Gauge,
  Layers3,
  Radar,
  Sparkles,
} from 'lucide-react';
import { PageMeta } from './PageMeta';
import { SeoJsonLd } from './SeoJsonLd';
import { BrandLogo } from './BrandLogo';

type ComparisonPageProps = {
  title: string;
  description: string;
  canonicalPath: string;
  competitor: string;
  heroTitle: string;
  heroDescription: string;
  rows: Array<{
    category: string;
    zer0friction: string;
    competitor: string;
  }>;
  summary: string[];
  whyChooseZer0Friction?: string[];
};

const FLOATING_COMPARE_LINKS = [
  { label: 'vs UptimeRobot', to: '/vs-uptimerobot' },
  { label: 'vs Grafana', to: '/vs-grafana' },
  { label: 'vs Better Stack', to: '/vs-better-stack' },
  { label: 'vs Pingdom', to: '/vs-pingdom' },
];

export function ComparisonPage({
  title,
  description,
  canonicalPath,
  competitor,
  heroTitle,
  heroDescription,
  rows,
  summary,
  whyChooseZer0Friction = [
    'Faster to understand and adopt than broader monitoring platforms.',
    'Clear INR pricing and simpler plan boundaries for growing teams.',
    'Built around uptime, incidents, changes, and status pages instead of platform sprawl.',
    'A better fit when your team wants a focused reliability workflow instead of an all-purpose observability stack.',
  ],
}: ComparisonPageProps) {
  const schema = {
    '@context': 'https://schema.org',
    '@type': 'TechArticle',
    headline: title,
    description,
    author: {
      '@type': 'Organization',
      name: 'Zer0Friction',
    },
    publisher: {
      '@type': 'Organization',
      name: 'Zer0Friction',
    },
    url: `https://www.zer0friction.in${canonicalPath}`,
  };

  const highlightCards = [
    {
      label: 'Faster evaluation',
      value: 'Clearer path',
      detail: 'Less setup overhead, faster buyer understanding, and a narrower workflow.',
      icon: Gauge,
    },
    {
      label: 'Focused stack',
      value: 'One surface',
      detail: 'Monitoring, incidents, changes, and status communication in a tighter product loop.',
      icon: Layers3,
    },
    {
      label: 'Operational clarity',
      value: 'Less noise',
      detail: 'Designed for teams that want signal quickly instead of a sprawling interface.',
      icon: Radar,
    },
  ];

  return (
    <div className="min-h-screen bg-[#f5f7fb] text-slate-900">
      <PageMeta title={title} description={description} canonicalPath={canonicalPath} />
      <SeoJsonLd id={canonicalPath.replace(/\W+/g, '-')} data={schema} />

      <nav className="sticky top-0 z-40 border-b border-slate-200/70 bg-white/75 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
          <Link to="/">
            <BrandLogo />
          </Link>
          <div className="hidden items-center gap-3 lg:flex">
            {FLOATING_COMPARE_LINKS.map((item) => (
              <Link
                key={item.to}
                to={item.to}
                className={`rounded-full px-4 py-2 text-sm font-semibold transition ${
                  canonicalPath === item.to
                    ? 'bg-slate-900 text-white shadow-lg shadow-slate-900/20'
                    : 'text-slate-500 hover:bg-white hover:text-slate-900'
                }`}
              >
                {item.label}
              </Link>
            ))}
          </div>
          <div className="flex items-center gap-3">
            <Link to="/login" className="text-sm font-medium text-slate-600 hover:text-slate-900">
              Sign In
            </Link>
            <Link
              to="/register"
              className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white shadow-lg shadow-slate-900/20 transition hover:-translate-y-0.5 hover:bg-slate-800"
            >
              Start Free Trial
            </Link>
          </div>
        </div>
      </nav>

      <section className="relative overflow-hidden border-b border-slate-200/70 px-6 pb-20 pt-20">
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute left-[-8%] top-10 h-72 w-72 rounded-full bg-cyan-200/40 blur-3xl" />
          <div className="absolute right-[-6%] top-16 h-80 w-80 rounded-full bg-emerald-200/35 blur-3xl" />
          <div className="absolute bottom-0 left-1/2 h-64 w-[32rem] -translate-x-1/2 rounded-full bg-violet-200/30 blur-3xl" />
        </div>

        <div className="relative mx-auto max-w-7xl">
          <div className="grid items-end gap-10 lg:grid-cols-[1.1fr_0.9fr]">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full border border-white/70 bg-white/80 px-4 py-2 text-[11px] font-black uppercase tracking-[0.3em] text-sky-700 shadow-sm">
                <Sparkles className="h-4 w-4" />
                Comparison Guide
              </div>
              <h1 className="mt-6 max-w-4xl text-5xl font-black tracking-[-0.04em] text-slate-950 md:text-7xl">
                {heroTitle}
              </h1>
              <p className="mt-6 max-w-3xl text-lg leading-8 text-slate-600 md:text-xl">
                {heroDescription}
              </p>

              <div className="mt-8 flex flex-wrap gap-3">
                <span className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm">
                  Cleaner buyer experience
                </span>
                <span className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm">
                  Faster onboarding path
                </span>
                <span className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm">
                  Transparent pricing
                </span>
              </div>

              <div className="mt-10 flex flex-col gap-3 sm:flex-row">
                <Link
                  to="/register"
                  className="inline-flex items-center justify-center gap-2 rounded-2xl bg-slate-950 px-6 py-4 text-sm font-semibold text-white shadow-xl shadow-slate-900/20 transition hover:-translate-y-0.5 hover:bg-slate-800"
                >
                  Try Zer0Friction
                  <ArrowRight className="h-4 w-4" />
                </Link>
                <Link
                  to="/pricing"
                  className="inline-flex items-center justify-center rounded-2xl border border-slate-200 bg-white px-6 py-4 text-sm font-semibold text-slate-700 shadow-sm transition hover:-translate-y-0.5 hover:border-slate-300 hover:bg-slate-50"
                >
                  See pricing
                </Link>
              </div>
            </div>

            <div className="grid gap-4">
              {highlightCards.map((card) => (
                <div
                  key={card.label}
                  className="group rounded-[2rem] border border-white/70 bg-white/80 p-6 shadow-[0_24px_80px_rgba(15,23,42,0.08)] backdrop-blur transition duration-300 hover:-translate-y-1 hover:shadow-[0_28px_90px_rgba(15,23,42,0.12)]"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="text-xs font-black uppercase tracking-[0.25em] text-slate-400">
                        {card.label}
                      </p>
                      <p className="mt-3 text-2xl font-black tracking-tight text-slate-950">
                        {card.value}
                      </p>
                    </div>
                    <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-950 text-white shadow-lg shadow-slate-900/20 transition group-hover:scale-105">
                      <card.icon className="h-5 w-5" />
                    </div>
                  </div>
                  <p className="mt-4 text-sm leading-7 text-slate-600">{card.detail}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="px-6 py-20">
        <div className="mx-auto max-w-7xl">
          <div className="mb-8 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.3em] text-slate-400">Head-to-head</p>
              <h2 className="mt-3 text-3xl font-black tracking-tight text-slate-950 md:text-4xl">
                Where Zer0Friction feels tighter than {competitor}
              </h2>
            </div>
            <p className="max-w-xl text-sm leading-7 text-slate-500">
              This comparison is built to help a buyer decide faster. It highlights workflow fit,
              product feel, and the tradeoff between breadth and focus.
            </p>
          </div>

          <div className="overflow-hidden rounded-[2rem] border border-slate-200/80 bg-white shadow-[0_24px_80px_rgba(15,23,42,0.08)]">
            <div className="grid grid-cols-1 border-b border-slate-200 bg-slate-950 text-white md:grid-cols-[1.1fr_1fr_1fr]">
              <div className="px-6 py-5 text-sm font-bold uppercase tracking-[0.2em] text-white/60">
                Category
              </div>
              <div className="px-6 py-5 text-sm font-bold">Zer0Friction</div>
              <div className="px-6 py-5 text-sm font-bold text-white/70">{competitor}</div>
            </div>
            {rows.map((row, index) => (
              <div
                key={row.category}
                className={`grid grid-cols-1 gap-0 md:grid-cols-[1.1fr_1fr_1fr] ${
                  index % 2 === 0 ? 'bg-white' : 'bg-slate-50/70'
                }`}
              >
                <div className="border-b border-slate-200 px-6 py-6 md:border-b-0 md:border-r">
                  <p className="text-sm font-black uppercase tracking-[0.18em] text-slate-400">
                    {row.category}
                  </p>
                </div>
                <div className="border-b border-slate-200 px-6 py-6 md:border-b-0 md:border-r">
                  <div className="inline-flex rounded-full bg-emerald-50 px-3 py-1 text-xs font-bold uppercase tracking-[0.2em] text-emerald-700">
                    Zer0Friction
                  </div>
                  <p className="mt-4 text-sm leading-7 text-slate-700">{row.zer0friction}</p>
                </div>
                <div className="px-6 py-6">
                  <div className="inline-flex rounded-full bg-slate-100 px-3 py-1 text-xs font-bold uppercase tracking-[0.2em] text-slate-500">
                    {competitor}
                  </div>
                  <p className="mt-4 text-sm leading-7 text-slate-600">{row.competitor}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="px-6 pb-20">
        <div className="mx-auto grid max-w-7xl gap-6 lg:grid-cols-[0.95fr_1.05fr]">
          <div className="rounded-[2rem] border border-slate-200 bg-slate-950 p-8 text-white shadow-[0_24px_80px_rgba(15,23,42,0.18)]">
            <p className="text-xs font-black uppercase tracking-[0.3em] text-cyan-300">Decision snapshot</p>
            <h2 className="mt-4 text-3xl font-black tracking-tight">When Zer0Friction usually wins</h2>
            <div className="mt-8 space-y-4">
              {summary.map((item) => (
                <div key={item} className="flex items-start gap-3 rounded-2xl border border-white/10 bg-white/5 p-4">
                  <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-300" />
                  <p className="text-sm leading-7 text-slate-200">{item}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-[2rem] border border-slate-200 bg-white p-8 shadow-[0_24px_80px_rgba(15,23,42,0.08)]">
            <p className="text-xs font-black uppercase tracking-[0.3em] text-slate-400">Why buyers shortlist us</p>
            <h2 className="mt-4 text-3xl font-black tracking-tight text-slate-950">
              Built for speed, clarity, and less operator fatigue
            </h2>
            <div className="mt-8 grid gap-4 md:grid-cols-2">
              {whyChooseZer0Friction.map((item) => (
                <div
                  key={item}
                  className="rounded-[1.5rem] border border-slate-200 bg-slate-50 p-5 transition hover:-translate-y-0.5 hover:bg-white"
                >
                  <CheckCircle2 className="h-5 w-5 text-emerald-600" />
                  <p className="mt-4 text-sm leading-7 text-slate-700">{item}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="border-t border-slate-200/70 bg-[radial-gradient(circle_at_top,_rgba(14,165,233,0.18),_transparent_32%),linear-gradient(135deg,#020617,#0f172a_55%,#111827)] px-6 py-20 text-white">
        <div className="mx-auto max-w-7xl">
          <div className="rounded-[2.5rem] border border-white/10 bg-white/5 p-10 shadow-[0_24px_80px_rgba(2,6,23,0.35)] backdrop-blur">
            <div className="grid gap-8 lg:grid-cols-[1fr_auto] lg:items-end">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.3em] text-cyan-300">Next step</p>
                <h2 className="mt-4 text-4xl font-black tracking-tight">
                  Want a cleaner monitoring workflow than {competitor}?
                </h2>
                <p className="mt-5 max-w-2xl text-sm leading-7 text-slate-300">
                  Zer0Friction is designed for teams that want uptime monitoring, incident context,
                  deploy-aware change tracking, and public status pages without dragging in a much
                  broader platform than they need.
                </p>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <Link
                  to="/register"
                  className="inline-flex items-center justify-center rounded-2xl bg-white px-6 py-4 text-sm font-semibold text-slate-950 transition hover:-translate-y-0.5"
                >
                  Create Account
                </Link>
                <Link
                  to="/api-monitoring-tools"
                  className="inline-flex items-center justify-center rounded-2xl border border-white/15 px-6 py-4 text-sm font-semibold text-white transition hover:bg-white/10"
                >
                  Explore tool directory
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
