import { Link } from 'react-router-dom';
import { ArrowRight, CheckCircle2 } from 'lucide-react';
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

  return (
    <div className="min-h-screen bg-white text-slate-900">
      <PageMeta
        title={title}
        description={description}
        canonicalPath={canonicalPath}
      />
      <SeoJsonLd id={canonicalPath.replace(/\W+/g, '-')} data={schema} />

      <nav className="border-b border-slate-200 bg-white/90 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <Link to="/">
            <BrandLogo />
          </Link>
          <div className="flex items-center gap-3">
            <Link to="/login" className="text-sm font-medium text-slate-600 hover:text-slate-900">
              Sign In
            </Link>
            <Link
              to="/register"
              className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800"
            >
              Start Free Trial
            </Link>
          </div>
        </div>
      </nav>

      <section className="border-b border-slate-200 bg-slate-50 px-6 py-20">
        <div className="mx-auto max-w-6xl">
          <p className="text-xs font-black uppercase tracking-[0.3em] text-emerald-600">{eyebrow}</p>
          <h1 className="mt-5 max-w-4xl text-5xl font-black tracking-tight text-slate-950">
            {heroTitle}
          </h1>
          <p className="mt-6 max-w-3xl text-lg leading-8 text-slate-600">
            {heroDescription}
          </p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <Link
              to="/register"
              className="inline-flex items-center justify-center gap-2 rounded-2xl bg-slate-900 px-6 py-4 text-sm font-semibold text-white hover:bg-slate-800"
            >
              Start Monitoring
              <ArrowRight className="h-4 w-4" />
            </Link>
            <Link
              to="/how-to-use"
              className="inline-flex items-center justify-center rounded-2xl border border-slate-200 px-6 py-4 text-sm font-semibold text-slate-700 hover:bg-white"
            >
              Read Setup Guide
            </Link>
          </div>
        </div>
      </section>

      <section className="px-6 py-16">
        <div className="mx-auto grid max-w-6xl gap-12 lg:grid-cols-[1fr_1.1fr]">
          <div>
            <h2 className="text-3xl font-black tracking-tight">Why teams choose Zer0Friction</h2>
            <div className="mt-8 space-y-4">
              {benefits.map((benefit) => (
                <div key={benefit} className="flex items-start gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600" />
                  <p className="text-sm leading-6 text-slate-700">{benefit}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="grid gap-4">
            {sections.map((section) => (
              <article key={section.title} className="rounded-3xl border border-slate-200 bg-white p-7 shadow-sm">
                <h3 className="text-xl font-bold text-slate-950">{section.title}</h3>
                <p className="mt-3 text-sm leading-7 text-slate-600">{section.description}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="border-t border-slate-200 bg-slate-950 px-6 py-16 text-white">
        <div className="mx-auto max-w-6xl rounded-[2rem] border border-white/10 bg-white/5 p-10">
          <h2 className="text-3xl font-black tracking-tight">Need a cleaner alternative to noisy monitoring tools?</h2>
          <p className="mt-4 max-w-2xl text-sm leading-7 text-slate-300">
            Zer0Friction is built for teams that want website monitoring, API monitoring, status pages,
            deploy-aware incidents, and a faster dashboard experience without the sprawl.
          </p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <Link
              to="/register"
              className="inline-flex items-center justify-center rounded-2xl bg-white px-6 py-3 text-sm font-semibold text-slate-950"
            >
              Create Account
            </Link>
            <Link
              to="/"
              className="inline-flex items-center justify-center rounded-2xl border border-white/15 px-6 py-3 text-sm font-semibold text-white"
            >
              Back to Homepage
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
