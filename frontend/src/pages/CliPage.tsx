import { Link } from 'react-router-dom';
import {
  ArrowRight,
  CheckCircle2,
  MonitorPlay,
  Package,
  Terminal,
  Workflow,
  Wrench,
} from 'lucide-react';
import { PageMeta } from '../components/PageMeta';
import { SeoJsonLd } from '../components/SeoJsonLd';
import { BrandLogo } from '../components/BrandLogo';

const cliHighlights = [
  {
    title: 'Install from npm',
    description:
      'Install the Zer0Friction CLI globally and start creating projects and monitors in a few commands.',
    icon: Package,
  },
  {
    title: 'Bootstrap fast',
    description:
      'Use guided setup and interactive commands instead of hand-building monitor payloads every time.',
    icon: MonitorPlay,
  },
  {
    title: 'Use in CI and scripts',
    description:
      'Combine the CLI with API keys and automation workflows to keep monitoring repeatable for your team.',
    icon: Workflow,
  },
  {
    title: 'Debug your setup',
    description:
      'Run health checks and diagnostics so new teammates can verify configuration without guessing.',
    icon: Wrench,
  },
];

const cliCommands = [
  'npm install -g zer0friction-cli',
  'zf help',
  'zf doctor',
  'zf init',
  'zf monitors create --interactive',
  'zf monitors list',
];

export default function CliPage() {
  const schema = {
    '@context': 'https://schema.org',
    '@type': 'TechArticle',
    headline: 'Zer0Friction CLI',
    description:
      'Install the Zer0Friction CLI from npm to create monitors, bootstrap projects, and operate uptime workflows faster.',
    author: {
      '@type': 'Organization',
      name: 'Zer0Friction',
    },
    publisher: {
      '@type': 'Organization',
      name: 'Zer0Friction',
    },
    url: 'https://www.zer0friction.in/cli',
  };

  return (
    <div className="min-h-screen bg-[#f5f7fb] text-slate-900">
      <PageMeta
        title="Zer0Friction CLI | npm-based Monitoring Workflow"
        description="Install the Zer0Friction CLI from npm to create monitors, bootstrap projects, and manage uptime workflows faster."
        canonicalPath="/cli"
      />
      <SeoJsonLd id="cli-page" data={schema} />

      <nav className="sticky top-0 z-40 border-b border-slate-200/70 bg-white/80 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
          <Link to="/">
            <BrandLogo />
          </Link>
          <div className="flex items-center gap-3">
            <Link to="/how-to-use" className="text-sm font-medium text-slate-600 hover:text-slate-900">
              User Manual
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
          <div className="absolute left-[-5%] top-10 h-72 w-72 rounded-full bg-cyan-200/35 blur-3xl" />
          <div className="absolute right-[-6%] top-16 h-80 w-80 rounded-full bg-emerald-200/30 blur-3xl" />
          <div className="absolute bottom-0 left-1/2 h-64 w-[30rem] -translate-x-1/2 rounded-full bg-violet-200/25 blur-3xl" />
        </div>

        <div className="relative mx-auto grid max-w-7xl gap-10 lg:grid-cols-[1.05fr_0.95fr] lg:items-end">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-white/70 bg-white/80 px-4 py-2 text-[11px] font-black uppercase tracking-[0.3em] text-cyan-700 shadow-sm">
              <Terminal className="h-4 w-4" />
              Zer0Friction CLI
            </div>
            <h1 className="mt-6 max-w-4xl text-5xl font-black tracking-[-0.04em] text-slate-950 md:text-7xl">
              Faster monitor setup for teams that like working from the terminal
            </h1>
            <p className="mt-6 max-w-3xl text-lg leading-8 text-slate-600 md:text-xl">
              Use the Zer0Friction CLI to bootstrap projects, create monitors interactively, run setup
              diagnostics, and fit uptime monitoring into real engineering workflows.
            </p>

            <div className="mt-10 flex flex-col gap-3 sm:flex-row">
              <a
                href="https://www.npmjs.com/package/zer0friction-cli"
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center justify-center gap-2 rounded-2xl bg-slate-950 px-6 py-4 text-sm font-semibold text-white shadow-xl shadow-slate-900/20 transition hover:-translate-y-0.5 hover:bg-slate-800"
              >
                View npm package
                <ArrowRight className="h-4 w-4" />
              </a>
              <Link
                to="/how-to-use"
                className="inline-flex items-center justify-center rounded-2xl border border-slate-200 bg-white px-6 py-4 text-sm font-semibold text-slate-700 shadow-sm transition hover:-translate-y-0.5 hover:border-slate-300 hover:bg-slate-50"
              >
                Open user manual
              </Link>
            </div>
          </div>

          <div className="rounded-[2rem] border border-slate-200 bg-slate-950 p-4 shadow-[0_24px_80px_rgba(15,23,42,0.18)]">
            <div className="overflow-hidden rounded-[1.5rem] border border-slate-800 bg-slate-900">
              <div className="flex items-center gap-2 border-b border-slate-800 px-4 py-3">
                <div className="h-2.5 w-2.5 rounded-full bg-red-400" />
                <div className="h-2.5 w-2.5 rounded-full bg-yellow-400" />
                <div className="h-2.5 w-2.5 rounded-full bg-green-400" />
                <span className="ml-3 text-[10px] uppercase tracking-[0.3em] text-slate-400">
                  terminal
                </span>
              </div>
              <pre className="overflow-x-auto p-6 text-sm leading-8 text-slate-200">{`npm install -g zer0friction-cli

zf doctor
zf init
zf monitors create --interactive
zf monitors list`}</pre>
            </div>
          </div>
        </div>
      </section>

      <section className="px-6 py-20">
        <div className="mx-auto grid max-w-7xl gap-6 md:grid-cols-2 xl:grid-cols-4">
          {cliHighlights.map((item) => (
            <article
              key={item.title}
              className="rounded-[2rem] border border-slate-200 bg-white p-7 shadow-[0_24px_80px_rgba(15,23,42,0.08)] transition duration-300 hover:-translate-y-1 hover:shadow-[0_28px_90px_rgba(15,23,42,0.12)]"
            >
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-950 text-white shadow-lg shadow-slate-900/20">
                <item.icon className="h-5 w-5" />
              </div>
              <h2 className="mt-6 text-2xl font-black tracking-tight text-slate-950">{item.title}</h2>
              <p className="mt-3 text-sm leading-7 text-slate-600">{item.description}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="border-y border-slate-200/70 bg-white px-6 py-20">
        <div className="mx-auto grid max-w-7xl gap-10 lg:grid-cols-[0.95fr_1.05fr]">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.3em] text-slate-400">Command flow</p>
            <h2 className="mt-4 text-4xl font-black tracking-tight text-slate-950">
              A practical CLI path for first-time setup
            </h2>
            <p className="mt-5 max-w-xl text-sm leading-7 text-slate-600">
              The CLI works best when paired with the dashboard and API. Use it to get started faster,
              then keep workflows consistent across local dev, CI, and teammate onboarding.
            </p>
          </div>

          <div className="rounded-[2rem] border border-slate-200 bg-slate-50 p-8">
            <div className="space-y-4">
              {cliCommands.map((command, index) => (
                <div key={command} className="flex items-start gap-4 rounded-2xl border border-slate-200 bg-white p-4">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-slate-950 text-xs font-black text-white">
                    {index + 1}
                  </div>
                  <div>
                    <code className="text-sm font-semibold text-slate-900">{command}</code>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="bg-slate-950 px-6 py-20 text-white">
        <div className="mx-auto max-w-7xl rounded-[2.5rem] border border-white/10 bg-white/5 p-10">
          <h2 className="text-4xl font-black tracking-tight">CLI, dashboard, API, and manual in one workflow</h2>
          <p className="mt-5 max-w-3xl text-sm leading-7 text-slate-300">
            Zer0Friction is not just a dashboard. Teams can install the CLI from npm, follow the user
            manual, provision monitors through the API, and still use the web UI for incidents, history,
            and status communication.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link to="/how-to-use" className="rounded-2xl bg-white px-5 py-3 text-sm font-semibold text-slate-950">
              Read user manual
            </Link>
            <Link to="/pricing" className="rounded-2xl border border-white/15 px-5 py-3 text-sm font-semibold text-white">
              See pricing
            </Link>
            <a
              href="https://www.npmjs.com/package/zer0friction-cli"
              target="_blank"
              rel="noreferrer"
              className="rounded-2xl border border-white/15 px-5 py-3 text-sm font-semibold text-white"
            >
              Open npm package
            </a>
          </div>
        </div>
      </section>
    </div>
  );
}
