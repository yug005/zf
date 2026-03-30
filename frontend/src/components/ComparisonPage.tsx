import { Link } from 'react-router-dom';
import { ArrowRight, CheckCircle2 } from 'lucide-react';
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

  return (
    <div className="min-h-screen bg-white text-slate-900">
      <PageMeta title={title} description={description} canonicalPath={canonicalPath} />
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
          <p className="text-xs font-black uppercase tracking-[0.3em] text-sky-600">Comparison</p>
          <h1 className="mt-5 max-w-4xl text-5xl font-black tracking-tight text-slate-950">
            {heroTitle}
          </h1>
          <p className="mt-6 max-w-3xl text-lg leading-8 text-slate-600">{heroDescription}</p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <Link
              to="/register"
              className="inline-flex items-center justify-center gap-2 rounded-2xl bg-slate-900 px-6 py-4 text-sm font-semibold text-white hover:bg-slate-800"
            >
              Try Zer0Friction
              <ArrowRight className="h-4 w-4" />
            </Link>
            <Link
              to="/website-monitoring"
              className="inline-flex items-center justify-center rounded-2xl border border-slate-200 px-6 py-4 text-sm font-semibold text-slate-700 hover:bg-white"
            >
              Explore Monitoring Pages
            </Link>
          </div>
        </div>
      </section>

      <section className="px-6 py-16">
        <div className="mx-auto max-w-6xl overflow-hidden rounded-[2rem] border border-slate-200">
          <div className="grid grid-cols-[1.2fr_1fr_1fr] bg-slate-950 px-6 py-5 text-sm font-bold text-white">
            <div>Category</div>
            <div>Zer0Friction</div>
            <div>{competitor}</div>
          </div>
          {rows.map((row) => (
            <div
              key={row.category}
              className="grid grid-cols-[1.2fr_1fr_1fr] gap-4 border-t border-slate-200 px-6 py-5 text-sm leading-7"
            >
              <div className="font-semibold text-slate-950">{row.category}</div>
              <div className="text-slate-700">{row.zer0friction}</div>
              <div className="text-slate-600">{row.competitor}</div>
            </div>
          ))}
        </div>
      </section>

      <section className="px-6 pb-16">
        <div className="mx-auto grid max-w-6xl gap-4 md:grid-cols-2">
          {summary.map((item) => (
            <div key={item} className="flex items-start gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-5">
              <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600" />
              <p className="text-sm leading-7 text-slate-700">{item}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="border-t border-slate-200 bg-slate-50 px-6 py-16">
        <div className="mx-auto max-w-6xl">
          <h2 className="text-3xl font-black tracking-tight text-slate-950">
            Why teams shortlist Zer0Friction
          </h2>
          <div className="mt-8 grid gap-4 md:grid-cols-2">
            {whyChooseZer0Friction.map((item) => (
              <div
                key={item}
                className="flex items-start gap-3 rounded-2xl border border-slate-200 bg-white p-5"
              >
                <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600" />
                <p className="text-sm leading-7 text-slate-700">{item}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="border-t border-slate-200 bg-slate-950 px-6 py-16 text-white">
        <div className="mx-auto max-w-6xl rounded-[2rem] border border-white/10 bg-white/5 p-10">
          <h2 className="text-3xl font-black tracking-tight">Want a cleaner monitoring workflow?</h2>
          <p className="mt-4 max-w-2xl text-sm leading-7 text-slate-300">
            Zer0Friction is built for teams that want uptime monitoring, incident context, deploy-aware
            change tracking, and public status pages without the sprawl of a broader tool stack.
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
