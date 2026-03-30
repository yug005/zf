import { Link } from 'react-router-dom';
import { ArrowRight, CheckCircle2, Zap } from 'lucide-react';
import { BrandLogo } from '../components/BrandLogo';
import { PageMeta } from '../components/PageMeta';
import { SeoJsonLd } from '../components/SeoJsonLd';

const plans = [
  {
    name: 'Trial',
    price: 'Free',
    cadence: '14 days',
    highlight: 'Start fast with a real workspace before you pay.',
    features: ['5 monitors', '2 API keys', '300s minimum interval', 'History stays visible after expiry'],
  },
  {
    name: 'Lite',
    price: 'INR 149/mo',
    cadence: 'monthly',
    highlight: 'Simple paid starting point for small teams.',
    features: ['5 monitors', '2 API keys', '300s minimum interval', 'Cheaper entry for lightweight coverage'],
  },
  {
    name: 'Pro',
    price: 'INR 499/mo',
    cadence: 'monthly',
    highlight: 'Best value for serious production monitoring.',
    features: ['50 monitors', '10 API keys', '60s minimum interval', 'Fast production-friendly checks'],
    featured: true,
  },
  {
    name: 'Business',
    price: 'INR 1499/mo',
    cadence: 'monthly',
    highlight: 'Room for larger customer-facing stacks.',
    features: ['200 monitors', '50 API keys', '30s minimum interval', 'Team-ready growth headroom'],
  },
  {
    name: 'Enterprise',
    price: 'Custom',
    cadence: 'contact sales',
    highlight: 'For larger teams that need 10s checks and rollout help.',
    features: ['Custom limits', '10s minimum interval', 'Onboarding support', 'Tailored rollout help'],
  },
];

export default function PricingPage() {
  const schema = {
    '@context': 'https://schema.org',
    '@type': 'SoftwareApplication',
    name: 'Zer0Friction',
    applicationCategory: 'BusinessApplication',
    operatingSystem: 'Web',
    url: 'https://www.zer0friction.in/pricing',
    description:
      'Pricing for Zer0Friction website monitoring, API monitoring, incidents, deploy tracking, and status pages.',
    offers: plans.map((plan) => ({
      '@type': 'Offer',
      name: plan.name,
      price: plan.price === 'Custom' || plan.price === 'Free' ? '0' : plan.price.replace(/[^\d]/g, ''),
      priceCurrency: 'INR',
    })),
  };

  return (
    <div className="min-h-screen bg-white text-slate-900">
      <PageMeta
        title="Pricing | Zer0Friction"
        description="Transparent Zer0Friction pricing for website monitoring, API monitoring, status pages, incidents, and deploy-aware workflows."
        canonicalPath="/pricing"
      />
      <SeoJsonLd id="pricing-page" data={schema} />

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
          <p className="text-xs font-black uppercase tracking-[0.3em] text-emerald-600">Pricing</p>
          <h1 className="mt-5 max-w-4xl text-5xl font-black tracking-tight text-slate-950">
            Transparent pricing for teams that want fast monitoring without enterprise sprawl.
          </h1>
          <p className="mt-6 max-w-3xl text-lg leading-8 text-slate-600">
            Zer0Friction is priced to stay simple: a free trial, a cheap entry point, and plans that
            scale with monitors, API keys, and faster check intervals. The goal is a tighter, cheaper,
            faster-to-understand reliability product for growing teams.
          </p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <Link
              to="/register"
              className="inline-flex items-center justify-center gap-2 rounded-2xl bg-slate-900 px-6 py-4 text-sm font-semibold text-white hover:bg-slate-800"
            >
              Start 14-Day Trial
              <ArrowRight className="h-4 w-4" />
            </Link>
            <Link
              to="/vs-uptimerobot"
              className="inline-flex items-center justify-center rounded-2xl border border-slate-200 px-6 py-4 text-sm font-semibold text-slate-700 hover:bg-white"
            >
              Compare Alternatives
            </Link>
          </div>
        </div>
      </section>

      <section className="px-6 py-16">
        <div className="mx-auto grid max-w-7xl gap-6 md:grid-cols-2 xl:grid-cols-5">
          {plans.map((plan) => (
            <article
              key={plan.name}
              className={`rounded-[2rem] border p-8 shadow-sm ${
                plan.featured ? 'border-slate-900 ring-2 ring-slate-900' : 'border-slate-200'
              }`}
            >
              {plan.featured ? (
                <div className="mb-5 inline-flex items-center gap-2 rounded-full bg-slate-900 px-3 py-1 text-xs font-bold uppercase tracking-wider text-white">
                  <Zap className="h-3.5 w-3.5" />
                  Best Value
                </div>
              ) : null}
              <h2 className="text-2xl font-black tracking-tight text-slate-950">{plan.name}</h2>
              <div className="mt-5">
                <div className="text-4xl font-extrabold tracking-tight text-slate-950">{plan.price}</div>
                <div className="mt-1 text-sm font-medium text-slate-500">{plan.cadence}</div>
              </div>
              <p className="mt-5 text-sm leading-7 text-slate-600">{plan.highlight}</p>
              <ul className="mt-6 space-y-3">
                {plan.features.map((feature) => (
                  <li key={feature} className="flex items-start gap-3 text-sm text-slate-700">
                    <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600" />
                    <span>{feature}</span>
                  </li>
                ))}
              </ul>
              <Link
                to="/register"
                className={`mt-8 inline-flex w-full items-center justify-center rounded-2xl px-5 py-3 text-sm font-semibold ${
                  plan.featured ? 'bg-slate-900 text-white' : 'border border-slate-200 text-slate-900'
                }`}
              >
                Get Started
              </Link>
            </article>
          ))}
        </div>
      </section>

      <section className="border-y border-slate-200 bg-slate-50 px-6 py-16">
        <div className="mx-auto max-w-6xl">
          <h2 className="text-3xl font-black tracking-tight text-slate-950">Why the pricing is designed this way</h2>
          <div className="mt-8 grid gap-4 md:grid-cols-2">
            {[
              'Cheaper entry pricing matters when small teams need uptime monitoring without enterprise overhead.',
              'Fast onboarding matters more than sprawling dashboards for many product teams.',
              'Monitoring, incidents, changes, and status pages belong in one workflow for faster action.',
              'Clear monitor and API key limits are easier to understand than platform-style usage complexity.',
            ].map((item) => (
              <div key={item} className="rounded-2xl border border-slate-200 bg-white p-5 text-sm leading-7 text-slate-700">
                {item}
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="bg-slate-950 px-6 py-16 text-white">
        <div className="mx-auto max-w-6xl rounded-[2rem] border border-white/10 bg-white/5 p-10">
          <h2 className="text-3xl font-black tracking-tight">Compare pricing against bigger competitors</h2>
          <p className="mt-4 max-w-2xl text-sm leading-7 text-slate-300">
            If you are evaluating broader or more established monitoring tools, compare Zer0Friction
            against UptimeRobot, Grafana, Better Stack, and Pingdom to see where a more focused and
            lower-friction workflow wins.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link to="/vs-uptimerobot" className="rounded-2xl border border-white/15 px-5 py-3 text-sm font-semibold text-white">
              vs UptimeRobot
            </Link>
            <Link to="/vs-grafana" className="rounded-2xl border border-white/15 px-5 py-3 text-sm font-semibold text-white">
              vs Grafana
            </Link>
            <Link to="/vs-better-stack" className="rounded-2xl border border-white/15 px-5 py-3 text-sm font-semibold text-white">
              vs Better Stack
            </Link>
            <Link to="/vs-pingdom" className="rounded-2xl border border-white/15 px-5 py-3 text-sm font-semibold text-white">
              vs Pingdom
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
