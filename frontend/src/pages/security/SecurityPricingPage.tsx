import { ArrowRight, CheckCircle2, Shield, Zap } from 'lucide-react';
import { Link } from 'react-router-dom';
import { BrandLogo } from '../../components/BrandLogo';
import { PageMeta } from '../../components/PageMeta';
import { SeoJsonLd } from '../../components/SeoJsonLd';

const securityPlans = [
  {
    name: 'Free',
    price: 'Free',
    cadence: 'one-time',
    highlight: 'A single low-friction entry scan for teams validating one API target.',
    features: [
      '1 target',
      '1 Standard scan',
      'Ownership confirmation flow',
      'Executive report and findings summary',
    ],
  },
  {
    name: 'Starter',
    price: 'INR 799/mo',
    cadence: 'monthly',
    highlight: 'Recurring security posture checks for smaller production APIs.',
    features: [
      'Up to 3 targets',
      'Standard scans',
      'Weekly and monthly recurring scans',
      'Trend history and report archive',
    ],
  },
  {
    name: 'Professional',
    price: 'INR 2499/mo',
    cadence: 'monthly',
    highlight: 'Best fit for teams that want deeper checks and higher scan frequency.',
    features: [
      'Up to 10 targets',
      'Advanced scans',
      'Daily, weekly, and monthly recurring scans',
      'Priority scoring and richer drill-down history',
    ],
    featured: true,
  },
  {
    name: 'Enterprise',
    price: 'Custom',
    cadence: 'contact sales',
    highlight: 'For larger security programs that need more targets, governance, and rollout help.',
    features: [
      'Custom target volume',
      'Advanced recurring coverage',
      'Security onboarding support',
      'Custom commercial and compliance workflow',
    ],
  },
];

const securityComparisons = [
  {
    title: 'Separate from monitoring',
    detail:
      'Security is priced as a different product line from uptime monitoring. Buying monitors does not automatically unlock recurring threat scans, and Security plans are not tied to monitor counts.',
  },
  {
    title: 'Priced for executive reports',
    detail:
      'The Security plans reflect report generation, recurring scan history, and verification workflows rather than monitor intervals, on-call depth, or API key volume.',
  },
  {
    title: 'Advanced checks stay gated',
    detail:
      'Advanced scans are reserved for higher Security tiers because they include broader endpoint discovery, deeper probing, and stronger ownership verification requirements.',
  },
  {
    title: 'Good upgrade path',
    detail:
      'Teams can start with one free scan, move into recurring Standard coverage, and only pay for Advanced security workflows when the risk surface justifies it.',
  },
];

export default function SecurityPricingPage() {
  const schema = {
    '@context': 'https://schema.org',
    '@type': 'SoftwareApplication',
    name: 'Zer0Friction Security',
    applicationCategory: 'SecurityApplication',
    operatingSystem: 'Web',
    url: 'https://www.zer0friction.in/security/pricing',
    description:
      'Pricing for Zer0Friction Security threat reports, API target verification, and recurring vulnerability scans.',
    offers: securityPlans.map((plan) => ({
      '@type': 'Offer',
      name: `Security ${plan.name}`,
      price: plan.price === 'Custom' || plan.price === 'Free' ? '0' : plan.price.replace(/[^\d]/g, ''),
      priceCurrency: 'INR',
    })),
  };

  return (
    <div className="min-h-screen bg-[#07111f] text-slate-100">
      <PageMeta
        title="Security Pricing | Zer0Friction"
        description="Separate pricing for Zer0Friction Security scans, target verification, and recurring threat reports."
        canonicalPath="/security/pricing"
      />
      <SeoJsonLd id="security-pricing-page" data={schema} />

      <nav className="border-b border-white/10 bg-[#07111f]/90 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <Link to="/">
            <BrandLogo theme="dark" />
          </Link>
          <div className="flex items-center gap-3">
            <Link to="/pricing" className="text-sm font-medium text-slate-400 hover:text-white">
              Monitoring Pricing
            </Link>
            <Link
              to="/security/onboard"
              className="rounded-xl bg-gradient-to-r from-cyan-400 to-emerald-400 px-4 py-2 text-sm font-semibold text-slate-950 hover:opacity-90"
            >
              Start Security Scan
            </Link>
          </div>
        </div>
      </nav>

      <section className="border-b border-white/10 bg-[radial-gradient(circle_at_top_left,rgba(34,211,238,0.14),transparent_30%),linear-gradient(180deg,#07111f_0%,#09182b_100%)] px-6 py-20">
        <div className="mx-auto max-w-6xl">
          <div className="inline-flex items-center gap-2 rounded-full border border-cyan-400/20 bg-cyan-400/10 px-4 py-2 text-xs font-bold uppercase tracking-[0.24em] text-cyan-200">
            <Shield className="h-3.5 w-3.5" />
            Security Pricing
          </div>
          <h1 className="mt-6 max-w-4xl text-5xl font-black tracking-tight text-white">
            Threat-report pricing that is separate from uptime monitoring.
          </h1>
          <p className="mt-6 max-w-3xl text-lg leading-8 text-slate-300">
            Zer0Friction Security is priced for target verification, authorized API scanning, executive
            reports, and recurring security posture checks. It is intentionally separate from monitor,
            interval, and incident pricing.
          </p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <Link
              to="/security/onboard"
              className="inline-flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-cyan-400 to-emerald-400 px-6 py-4 text-sm font-semibold text-slate-950 hover:opacity-90"
            >
              Run Free Security Scan
              <ArrowRight className="h-4 w-4" />
            </Link>
            <Link
              to="/pricing"
              className="inline-flex items-center justify-center rounded-2xl border border-white/10 px-6 py-4 text-sm font-semibold text-slate-200 hover:bg-white/[0.04]"
            >
              View Monitoring Pricing
            </Link>
          </div>
        </div>
      </section>

      <section className="px-6 py-16">
        <div className="mx-auto grid max-w-7xl gap-6 md:grid-cols-2 xl:grid-cols-4">
          {securityPlans.map((plan) => (
            <article
              key={plan.name}
              className={`rounded-[2rem] border p-8 shadow-[0_20px_70px_rgba(0,0,0,0.25)] ${
                plan.featured
                  ? 'border-cyan-300/40 bg-[linear-gradient(180deg,rgba(34,211,238,0.12),rgba(255,255,255,0.04))] ring-2 ring-cyan-300/30'
                  : 'border-white/10 bg-white/[0.03]'
              }`}
            >
              {plan.featured ? (
                <div className="mb-5 inline-flex items-center gap-2 rounded-full bg-cyan-300/15 px-3 py-1 text-xs font-bold uppercase tracking-wider text-cyan-100">
                  <Zap className="h-3.5 w-3.5" />
                  Security Best Value
                </div>
              ) : null}
              <h2 className="text-2xl font-black tracking-tight text-white">{plan.name}</h2>
              <div className="mt-5">
                <div className="text-4xl font-extrabold tracking-tight text-white">{plan.price}</div>
                <div className="mt-1 text-sm font-medium text-slate-400">{plan.cadence}</div>
              </div>
              <p className="mt-5 text-sm leading-7 text-slate-300">{plan.highlight}</p>
              <ul className="mt-6 space-y-3">
                {plan.features.map((feature) => (
                  <li key={feature} className="flex items-start gap-3 text-sm text-slate-200">
                    <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-400" />
                    <span>{feature}</span>
                  </li>
                ))}
              </ul>
              <Link
                to={plan.name === 'Enterprise' ? '/billing' : '/security/onboard'}
                className={`mt-8 inline-flex w-full items-center justify-center rounded-2xl px-5 py-3 text-sm font-semibold ${
                  plan.featured
                    ? 'bg-gradient-to-r from-cyan-400 to-emerald-400 text-slate-950'
                    : 'border border-white/10 text-white hover:bg-white/[0.04]'
                }`}
              >
                {plan.name === 'Enterprise' ? 'Talk to Us' : 'Choose Security Plan'}
              </Link>
            </article>
          ))}
        </div>
      </section>

      <section className="border-y border-white/10 bg-white/[0.02] px-6 py-16">
        <div className="mx-auto max-w-6xl">
          <div className="max-w-3xl">
            <p className="text-xs font-black uppercase tracking-[0.3em] text-cyan-300/70">Why separate pricing</p>
            <h2 className="mt-4 text-4xl font-black tracking-tight text-white">
              Security and monitoring solve different problems, so they should not share one plan table.
            </h2>
          </div>
          <div className="mt-8 grid gap-4 md:grid-cols-2">
            {securityComparisons.map((item) => (
              <div key={item.title} className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
                <h3 className="text-base font-bold text-white">{item.title}</h3>
                <p className="mt-3 text-sm leading-7 text-slate-300">{item.detail}</p>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
