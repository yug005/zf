import { Link } from 'react-router-dom';
import {
  ArrowRight,
  CheckCircle2,
  Orbit,
  Radar,
  Sparkles,
  Workflow,
} from 'lucide-react';
import { PageMeta } from './PageMeta';
import { SeoJsonLd } from './SeoJsonLd';
import { BrandLogo } from './BrandLogo';

type MarketingFeaturePageProps = {
  title: string;
  description: string;
  canonicalPath: string;
  eyebrow: string;
  heroTitle: string;
  heroDescription: string;
  keyword: string;
  benefits: string[];
  sections: Array<{
    title: string;
    description: string;
  }>;
};

const FEATURE_JUMP_LINKS = [
  { label: 'Website Monitoring', to: '/website-monitoring' },
  { label: 'API Monitoring', to: '/api-monitoring' },
  { label: 'SSL Monitoring', to: '/ssl-monitoring' },
  { label: 'Status Pages', to: '/status-pages-feature' },
];

export function MarketingFeaturePage({
  title,
  description,
  canonicalPath,
  eyebrow,
  heroTitle,
  heroDescription,
  keyword,
  benefits,
  sections,
}: MarketingFeaturePageProps) {
  const schema = {
    '@context': 'https://schema.org',
    '@type': 'TechArticle',
    headline: title,
    description,
    keywords: [keyword, 'uptime monitoring', 'status pages', 'incident alerts'],
    author: {
      '@type': 'Organization',
      name: 'Zer0Friction',
    },
    publisher: {
      '@type': 'Organization',
      name: 'Zer0Friction',
      url: 'https://www.zer0friction.in/',
    },
    url: `https://www.zer0friction.in${canonicalPath}`,
  };

  const heroPanels = [
    {
      title: 'Signal over noise',
      detail: 'A more focused reliability surface for teams who want to move faster.',
      icon: Radar,
    },
    {
      title: 'Better operator flow',
      detail: 'Monitoring, incidents, and change context connect without feeling bolted together.',
      icon: Workflow,
    },
    {
      title: 'Cleaner rollout path',
      detail: 'Less setup friction for growing teams that want useful alerts quickly.',
      icon: Orbit,
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
            {FEATURE_JUMP_LINKS.map((item) => (
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
          <div className="absolute left-[-5%] top-10 h-72 w-72 rounded-full bg-emerald-200/35 blur-3xl" />
          <div className="absolute right-[-6%] top-14 h-80 w-80 rounded-full bg-sky-200/35 blur-3xl" />
          <div className="absolute bottom-0 left-1/2 h-64 w-[30rem] -translate-x-1/2 rounded-full bg-violet-200/25 blur-3xl" />
        </div>

        <div className="relative mx-auto max-w-7xl">
          <div className="grid gap-10 lg:grid-cols-[1.05fr_0.95fr] lg:items-end">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full border border-white/70 bg-white/80 px-4 py-2 text-[11px] font-black uppercase tracking-[0.3em] text-emerald-700 shadow-sm">
                <Sparkles className="h-4 w-4" />
                {eyebrow}
              </div>
              <h1 className="mt-6 max-w-4xl text-5xl font-black tracking-[-0.04em] text-slate-950 md:text-7xl">
                {heroTitle}
              </h1>
              <p className="mt-6 max-w-3xl text-lg leading-8 text-slate-600 md:text-xl">
                {heroDescription}
              </p>

              <div className="mt-8 flex flex-wrap gap-3">
                <span className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm">
                  Real product workflows
                </span>
                <span className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm">
                  Faster buyer understanding
                </span>
                <span className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm">
                  Cleaner monitoring surface
                </span>
              </div>

              <div className="mt-10 flex flex-col gap-3 sm:flex-row">
                <Link
                  to="/register"
                  className="inline-flex items-center justify-center gap-2 rounded-2xl bg-slate-950 px-6 py-4 text-sm font-semibold text-white shadow-xl shadow-slate-900/20 transition hover:-translate-y-0.5 hover:bg-slate-800"
                >
                  Start Monitoring
                  <ArrowRight className="h-4 w-4" />
                </Link>
                <Link
                  to="/pricing"
                  className="inline-flex items-center justify-center rounded-2xl border border-slate-200 bg-white px-6 py-4 text-sm font-semibold text-slate-700 shadow-sm transition hover:-translate-y-0.5 hover:border-slate-300 hover:bg-slate-50"
                >
                  Explore pricing
                </Link>
              </div>
            </div>

            <div className="grid gap-4">
              {heroPanels.map((panel) => (
                <div
                  key={panel.title}
                  className="group rounded-[2rem] border border-white/70 bg-white/80 p-6 shadow-[0_24px_80px_rgba(15,23,42,0.08)] backdrop-blur transition duration-300 hover:-translate-y-1 hover:shadow-[0_28px_90px_rgba(15,23,42,0.12)]"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <h2 className="text-2xl font-black tracking-tight text-slate-950">{panel.title}</h2>
                      <p className="mt-3 text-sm leading-7 text-slate-600">{panel.detail}</p>
                    </div>
                    <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-950 text-white shadow-lg shadow-slate-900/20 transition group-hover:scale-105">
                      <panel.icon className="h-5 w-5" />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="px-6 py-20">
        <div className="mx-auto grid max-w-7xl gap-8 lg:grid-cols-[0.92fr_1.08fr]">
          <div className="rounded-[2rem] border border-slate-200 bg-white p-8 shadow-[0_24px_80px_rgba(15,23,42,0.08)]">
            <p className="text-xs font-black uppercase tracking-[0.3em] text-slate-400">Why teams choose Zer0Friction</p>
            <h2 className="mt-4 text-3xl font-black tracking-tight text-slate-950">
              Built for fast adoption without sacrificing reliability context
            </h2>
            <div className="mt-8 space-y-4">
              {benefits.map((benefit) => (
                <div
                  key={benefit}
                  className="flex items-start gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-4 transition hover:-translate-y-0.5 hover:bg-white"
                >
                  <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600" />
                  <p className="text-sm leading-7 text-slate-700">{benefit}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="grid gap-5">
            {sections.map((section) => (
              <article
                key={section.title}
                className="rounded-[2rem] border border-slate-200 bg-white p-8 shadow-[0_24px_80px_rgba(15,23,42,0.08)] transition duration-300 hover:-translate-y-1 hover:shadow-[0_28px_90px_rgba(15,23,42,0.12)]"
              >
                <h3 className="text-2xl font-black tracking-tight text-slate-950">{section.title}</h3>
                <p className="mt-4 text-sm leading-7 text-slate-600">{section.description}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="border-t border-slate-200/70 bg-[radial-gradient(circle_at_top,_rgba(16,185,129,0.18),_transparent_28%),linear-gradient(135deg,#020617,#0f172a_55%,#111827)] px-6 py-20 text-white">
        <div className="mx-auto max-w-7xl">
          <div className="rounded-[2.5rem] border border-white/10 bg-white/5 p-10 shadow-[0_24px_80px_rgba(2,6,23,0.35)] backdrop-blur">
            <div className="grid gap-8 lg:grid-cols-[1fr_auto] lg:items-end">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.3em] text-emerald-300">Launch faster</p>
                <h2 className="mt-4 text-4xl font-black tracking-tight">
                  Need a cleaner alternative to noisy monitoring tools?
                </h2>
                <p className="mt-5 max-w-2xl text-sm leading-7 text-slate-300">
                  Zer0Friction is built for teams that want website monitoring, API monitoring,
                  status pages, deploy-aware incidents, and a faster dashboard experience without
                  the sprawl.
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
                  to="/"
                  className="inline-flex items-center justify-center rounded-2xl border border-white/15 px-6 py-4 text-sm font-semibold text-white transition hover:bg-white/10"
                >
                  Back to Homepage
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
