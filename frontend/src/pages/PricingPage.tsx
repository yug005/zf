import { Link } from 'react-router-dom';
import { ArrowRight, CheckCircle2, Terminal, Zap } from 'lucide-react';
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

const competitorPricing = [
  {
    name: 'Zer0Friction',
    category: 'Focused uptime platform',
    entryPrice: 'INR 149/mo',
    pricingModel: 'Flat tiered pricing',
    snapshot: 'Trial free, Lite INR 149, Pro INR 499, Business INR 1499, Enterprise custom.',
    bestFor: 'Teams that want a low-friction entry point with dashboard, API, CLI, and status workflows together.',
    standout: true,
  },
  {
    name: 'UptimeRobot',
    category: 'Simple uptime monitoring',
    entryPrice: '$8/mo annual',
    pricingModel: 'Tiered SaaS pricing',
    snapshot: 'Free plan, Solo starts at $8/mo annually, Team $34/mo annually, Enterprise starts at $64/mo annually.',
    bestFor: 'Teams that want straightforward uptime checks and basic collaboration.',
  },
  {
    name: 'StatusCake',
    category: 'Uptime + page speed',
    entryPrice: '$20.41/mo',
    pricingModel: 'Tiered SaaS pricing',
    snapshot: 'Free plan, Superior starts at $20.41/mo, Business starts at $66.66/mo, Enterprise custom.',
    bestFor: 'Teams that want uptime plus page speed checks and more mature reporting.',
  },
  {
    name: 'Better Stack',
    category: 'Monitoring + incident stack',
    entryPrice: '$34/mo',
    pricingModel: 'Modular platform pricing',
    snapshot: 'Free personal tier, Responder starts at $34/mo monthly or $29/mo annually, then add-ons and extra modules stack up.',
    bestFor: 'Teams that want uptime monitoring bundled with incident, on-call, and status products.',
  },
  {
    name: 'Checkly',
    category: 'Developer-first synthetics',
    entryPrice: '$24/mo',
    pricingModel: 'Platform pricing plus usage',
    snapshot: 'Hobby free, Starter $24/mo annually, Team $64/mo annually, Enterprise custom.',
    bestFor: 'Teams that want synthetic monitoring, Playwright checks, and monitoring-as-code workflows.',
  },
  {
    name: 'Grafana Cloud',
    category: 'Broad observability platform',
    entryPrice: '$19/mo platform fee',
    pricingModel: 'Platform fee plus usage-based',
    snapshot: 'Free tier available, Pro starts at $19/mo, then synthetics are usage-based at $5 per 10k API tests.',
    bestFor: 'Teams already buying into a larger observability stack and usage-based pricing.',
  },
  {
    name: 'Datadog',
    category: 'Enterprise observability',
    entryPrice: '$5 per 10k API tests',
    pricingModel: 'Pure usage-based pricing',
    snapshot: 'Synthetic API tests are $5 per 10k runs annually, $6 month-to-month, and browser tests are $12 per 1k annually.',
    bestFor: 'Large teams comfortable with usage billing and broader platform spend.',
  },
  {
    name: 'New Relic',
    category: 'Usage-based observability',
    entryPrice: '$10/user + usage',
    pricingModel: 'User or compute pricing plus synthetic overage',
    snapshot: 'Free includes 500 synthetic checks, full platform users start at $10/user, and extra synthetic checks are billed at $0.005 each.',
    bestFor: 'Teams already using New Relic across the stack and comfortable with ingest-based cost models.',
  },
  {
    name: 'Dynatrace',
    category: 'Enterprise observability',
    entryPrice: '$0.001/request',
    pricingModel: 'Usage-based synthetic pricing',
    snapshot: 'HTTP monitors are listed at $0.001 per synthetic request on the public rate card.',
    bestFor: 'Enterprises buying into Dynatrace for full-stack monitoring and automation.',
  },
  {
    name: 'Postman',
    category: 'API development platform',
    entryPrice: '$9/user + monitoring add-on',
    pricingModel: 'Per-user plus usage-based monitoring',
    snapshot: 'Solo starts at $9/user monthly billed annually, and monitoring is listed at $20 per 50,000 requests per team per month on paid plans.',
    bestFor: 'API teams that already live in Postman and want scheduled API test execution.',
  },
  {
    name: 'Pingdom',
    category: 'Website monitoring',
    entryPrice: 'Calculator / quote-led',
    pricingModel: 'Configurable package pricing',
    snapshot: 'Public pricing is calculator-driven and not as transparent in a simple flat table as some competitors.',
    bestFor: 'Teams focused on website and transaction monitoring that are comfortable working through a calculator or sales flow.',
  },
  {
    name: 'Prometheus',
    category: 'Open-source monitoring',
    entryPrice: '$0 software cost',
    pricingModel: 'Self-hosted infrastructure cost',
    snapshot: 'Open source and self-hosted, so you pay for infrastructure, storage, and the team time to run it.',
    bestFor: 'Teams that want to build and operate their own monitoring stack.',
  },
  {
    name: 'Elastic',
    category: 'Search + observability platform',
    entryPrice: 'Resource-based / custom',
    pricingModel: 'Elastic Cloud resource pricing',
    snapshot: 'Public pricing is resource-based rather than a simple monitor-plan table, and managed synthetics add extra charges.',
    bestFor: 'Teams already committed to Elastic for logs, search, and observability workloads.',
  },
  {
    name: 'Atatus',
    category: 'APM + observability',
    entryPrice: 'Custom pricing',
    pricingModel: 'Request-volume based',
    snapshot: 'Atatus publicly describes custom pricing based on request volume and monitoring needs instead of a simple entry plan.',
    bestFor: 'Teams prioritizing APM and request-volume-based observability pricing.',
  },
];

export default function PricingPage() {
  const pricingComparisons = [
    {
      title: 'Cheaper starting point',
      detail:
        'Zer0Friction starts with a low-friction INR entry plan so smaller teams can pay for uptime coverage earlier instead of waiting for bigger observability budgets.',
    },
    {
      title: 'Faster buying decision',
      detail:
        'Monitor limits, API keys, and interval tiers are easy to understand without decoding a larger platform pricing model.',
    },
    {
      title: 'CLI + dashboard + API',
      detail:
        'The pricing covers more than a web dashboard. Teams can use the npm CLI, API keys, user manual, and the app together in one workflow.',
    },
    {
      title: 'Focused reliability surface',
      detail:
        'Zer0Friction is priced like a tighter uptime and incident product instead of a sprawling observability suite.',
    },
  ];

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
            <Link
              to="/cli"
              className="inline-flex items-center justify-center gap-2 rounded-2xl border border-slate-200 px-6 py-4 text-sm font-semibold text-slate-700 hover:bg-white"
            >
              Explore CLI
              <Terminal className="h-4 w-4" />
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

      <section className="border-y border-slate-200 bg-white px-6 py-16">
        <div className="mx-auto max-w-7xl">
          <div className="max-w-3xl">
            <p className="text-xs font-black uppercase tracking-[0.3em] text-slate-400">Pricing comparison</p>
            <h2 className="mt-4 text-4xl font-black tracking-tight text-slate-950">
              Public pricing snapshot across the monitoring tools teams compare most often
            </h2>
            <p className="mt-5 text-sm leading-7 text-slate-600">
              Snapshot updated March 30, 2026 from public pricing pages. Some vendors use usage-based
              billing, calculators, or custom quotes, so this section focuses on the clearest public
              entry point and pricing model each tool presents.
            </p>
          </div>

          <div className="mt-10 overflow-hidden rounded-[2rem] border border-slate-200 bg-white shadow-sm">
            <div className="hidden grid-cols-[1.05fr_0.9fr_0.95fr_1.1fr_1.2fr] border-b border-slate-200 bg-slate-950 text-sm font-bold text-white lg:grid">
              <div className="px-6 py-5">Tool</div>
              <div className="px-6 py-5">Public entry</div>
              <div className="px-6 py-5">Pricing model</div>
              <div className="px-6 py-5">Snapshot</div>
              <div className="px-6 py-5">Best fit</div>
            </div>

            {competitorPricing.map((item, index) => (
              <div
                key={item.name}
                className={`grid gap-4 border-b border-slate-200 px-6 py-6 lg:grid-cols-[1.05fr_0.9fr_0.95fr_1.1fr_1.2fr] ${
                  index % 2 === 0 ? 'bg-white' : 'bg-slate-50/60'
                } ${item.standout ? 'ring-2 ring-emerald-500/40 ring-inset' : ''}`}
              >
                <div>
                  <div className="inline-flex rounded-full bg-slate-100 px-3 py-1 text-[11px] font-black uppercase tracking-[0.2em] text-slate-500">
                    {item.category}
                  </div>
                  <h3 className="mt-3 text-xl font-black tracking-tight text-slate-950">{item.name}</h3>
                </div>
                <div>
                  <p className="text-xs font-bold uppercase tracking-[0.2em] text-slate-400 lg:hidden">Public entry</p>
                  <p className="text-sm font-semibold text-slate-900">{item.entryPrice}</p>
                </div>
                <div>
                  <p className="text-xs font-bold uppercase tracking-[0.2em] text-slate-400 lg:hidden">Pricing model</p>
                  <p className="text-sm leading-7 text-slate-700">{item.pricingModel}</p>
                </div>
                <div>
                  <p className="text-xs font-bold uppercase tracking-[0.2em] text-slate-400 lg:hidden">Snapshot</p>
                  <p className="text-sm leading-7 text-slate-700">{item.snapshot}</p>
                </div>
                <div>
                  <p className="text-xs font-bold uppercase tracking-[0.2em] text-slate-400 lg:hidden">Best fit</p>
                  <p className="text-sm leading-7 text-slate-700">{item.bestFor}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="border-y border-slate-200 bg-slate-50 px-6 py-16">
        <div className="mx-auto max-w-6xl">
          <h2 className="text-3xl font-black tracking-tight text-slate-950">Why the pricing is designed this way</h2>
          <div className="mt-8 grid gap-4 md:grid-cols-2">
            {pricingComparisons.map((item) => (
              <div key={item.title} className="rounded-2xl border border-slate-200 bg-white p-5">
                <h3 className="text-base font-bold text-slate-950">{item.title}</h3>
                <p className="mt-3 text-sm leading-7 text-slate-700">
                  {item.detail}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="px-6 py-16">
        <div className="mx-auto grid max-w-6xl gap-6 lg:grid-cols-[1fr_1fr]">
          <div className="rounded-[2rem] border border-slate-200 bg-white p-8 shadow-sm">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-900 text-white shadow-lg shadow-slate-900/20">
              <Terminal className="h-5 w-5" />
            </div>
            <h2 className="mt-6 text-3xl font-black tracking-tight text-slate-950">
              Your plan includes more than the dashboard
            </h2>
            <p className="mt-4 text-sm leading-7 text-slate-600">
              Zer0Friction pricing also supports teams that prefer terminal and automation workflows.
              Install the CLI from npm, use API keys in scripts, and keep the user manual close for teammate onboarding.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link to="/cli" className="rounded-2xl bg-slate-900 px-5 py-3 text-sm font-semibold text-white">
                View CLI
              </Link>
              <Link to="/how-to-use" className="rounded-2xl border border-slate-200 px-5 py-3 text-sm font-semibold text-slate-900">
                Open user manual
              </Link>
            </div>
          </div>

          <div className="rounded-[2rem] border border-slate-200 bg-slate-50 p-8 shadow-sm">
            <p className="text-xs font-black uppercase tracking-[0.3em] text-slate-400">Pricing comparisons</p>
            <h2 className="mt-4 text-3xl font-black tracking-tight text-slate-950">
              Compare pricing and workflow fit directly
            </h2>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link to="/vs-uptimerobot" className="rounded-2xl border border-slate-200 bg-white px-5 py-3 text-sm font-semibold text-slate-900">
                vs UptimeRobot
              </Link>
              <Link to="/vs-grafana" className="rounded-2xl border border-slate-200 bg-white px-5 py-3 text-sm font-semibold text-slate-900">
                vs Grafana
              </Link>
              <Link to="/vs-better-stack" className="rounded-2xl border border-slate-200 bg-white px-5 py-3 text-sm font-semibold text-slate-900">
                vs Better Stack
              </Link>
              <Link to="/vs-pingdom" className="rounded-2xl border border-slate-200 bg-white px-5 py-3 text-sm font-semibold text-slate-900">
                vs Pingdom
              </Link>
            </div>
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
