import { Link } from 'react-router-dom';
import { ArrowRight, ExternalLink } from 'lucide-react';
import { BrandLogo } from '../components/BrandLogo';
import { PageMeta } from '../components/PageMeta';
import { SeoJsonLd } from '../components/SeoJsonLd';

const categories = [
  {
    title: 'Top Tier (Enterprise / Popular in India)',
    tools: ['Datadog', 'New Relic', 'Dynatrace'],
  },
  {
    title: 'Developer / API-Focused Tools',
    tools: ['Postman Monitors', 'Checkly', 'RapidAPI'],
  },
  {
    title: 'Uptime / Simple Monitoring',
    tools: ['UptimeRobot', 'Pingdom', 'StatusCake'],
  },
  {
    title: 'DevOps / Open Source',
    tools: ['Prometheus', 'Grafana', 'Elastic'],
  },
  {
    title: 'Indian Players',
    tools: ['Atatus', 'Avekshaa Technologies'],
  },
];

const comparisonLinks = [
  { label: 'Zer0Friction vs UptimeRobot', to: '/vs-uptimerobot' },
  { label: 'Zer0Friction vs Grafana', to: '/vs-grafana' },
  { label: 'Zer0Friction vs Better Stack', to: '/vs-better-stack' },
  { label: 'Zer0Friction vs Pingdom', to: '/vs-pingdom' },
];

export default function ApiMonitoringTools() {
  const schema = {
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    name: 'API Monitoring Tools',
    description:
      'A clean overview of API monitoring tools including Datadog, New Relic, Dynatrace, Postman Monitors, Checkly, UptimeRobot, Pingdom, Grafana, and more.',
    url: 'https://www.zer0friction.in/api-monitoring-tools',
  };

  return (
    <div className="min-h-screen bg-white text-slate-900">
      <PageMeta
        title="API Monitoring Tools | Zer0Friction"
        description="Explore popular API monitoring tools including Datadog, New Relic, Dynatrace, Checkly, UptimeRobot, Pingdom, Grafana, Prometheus, Atatus, and more."
        canonicalPath="/api-monitoring-tools"
      />
      <SeoJsonLd id="api-monitoring-tools" data={schema} />

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
          <p className="text-xs font-black uppercase tracking-[0.3em] text-sky-600">Directory</p>
          <h1 className="mt-5 max-w-4xl text-5xl font-black tracking-tight text-slate-950">
            API monitoring tools worth knowing before you pick your stack
          </h1>
          <p className="mt-6 max-w-3xl text-lg leading-8 text-slate-600">
            This page groups popular API monitoring tools by market shape so buyers can compare
            enterprise platforms, developer-focused tools, uptime-first products, open-source stacks,
            and Indian players in one place.
          </p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <Link
              to="/api-monitoring"
              className="inline-flex items-center justify-center gap-2 rounded-2xl bg-slate-900 px-6 py-4 text-sm font-semibold text-white hover:bg-slate-800"
            >
              Explore API Monitoring
              <ArrowRight className="h-4 w-4" />
            </Link>
            <Link
              to="/register"
              className="inline-flex items-center justify-center rounded-2xl border border-slate-200 px-6 py-4 text-sm font-semibold text-slate-700 hover:bg-white"
            >
              Try Zer0Friction
            </Link>
          </div>
        </div>
      </section>

      <section className="px-6 py-16">
        <div className="mx-auto grid max-w-6xl gap-6 md:grid-cols-2">
          {categories.map((category) => (
            <article key={category.title} className="rounded-[2rem] border border-slate-200 bg-white p-8 shadow-sm">
              <h2 className="text-xl font-black tracking-tight text-slate-950">{category.title}</h2>
              <ul className="mt-6 space-y-3">
                {category.tools.map((tool) => (
                  <li
                    key={tool}
                    className="rounded-2xl border border-slate-100 bg-slate-50 px-4 py-3 text-sm font-medium text-slate-700"
                  >
                    {tool}
                  </li>
                ))}
              </ul>
            </article>
          ))}
        </div>
      </section>

      <section className="border-y border-slate-200 bg-slate-50 px-6 py-16">
        <div className="mx-auto max-w-6xl">
          <h2 className="text-3xl font-black tracking-tight text-slate-950">Direct comparison pages</h2>
          <p className="mt-4 max-w-3xl text-sm leading-7 text-slate-600">
            We are building head-to-head comparisons for the most searched competitor terms first.
          </p>
          <div className="mt-8 grid gap-4 md:grid-cols-2">
            {comparisonLinks.map((item) => (
              <Link
                key={item.to}
                to={item.to}
                className="group flex items-center justify-between rounded-2xl border border-slate-200 bg-white px-5 py-4 text-sm font-semibold text-slate-900"
              >
                <span>{item.label}</span>
                <ExternalLink className="h-4 w-4 text-slate-400 transition group-hover:text-slate-700" />
              </Link>
            ))}
          </div>
        </div>
      </section>

      <section className="bg-slate-950 px-6 py-16 text-white">
        <div className="mx-auto max-w-6xl rounded-[2rem] border border-white/10 bg-white/5 p-10">
          <h2 className="text-3xl font-black tracking-tight">What Zer0Friction is optimizing for</h2>
          <p className="mt-4 max-w-2xl text-sm leading-7 text-slate-300">
            Zer0Friction is not trying to be every possible observability product at once. It is
            optimized for teams that want uptime monitoring, API monitoring, incidents, status pages,
            and deploy-aware clarity in a tighter workflow.
          </p>
        </div>
      </section>
    </div>
  );
}
