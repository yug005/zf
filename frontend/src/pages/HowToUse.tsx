import {
  Activity,
  ArrowRight,
  BarChart3,
  BellRing,
  CheckCircle2,
  Globe,
  Key,
  Server,
  Settings,
  Smartphone,
  Terminal,
  Zap,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { PageMeta } from '../components/PageMeta';
import { SeoJsonLd } from '../components/SeoJsonLd';

const monitoringFeatures = [
  {
    title: 'Multi-Protocol Support',
    description:
      'Set up HTTP and HTTPS checks with custom headers, body payloads, and expected status matching.',
    icon: Server,
    iconClass: 'text-blue-600',
  },
  {
    title: 'Intelligent Intervals',
    description:
      'Schedule checks from 10 seconds to 24 hours and keep timing consistent with queue-backed execution.',
    icon: BarChart3,
    iconClass: 'text-green-600',
  },
  {
    title: 'Smart Thresholds',
    description:
      'Avoid false alarms by alerting only after consecutive failures instead of a single timeout.',
    icon: BellRing,
    iconClass: 'text-red-600',
  },
  {
    title: 'Global Visibility',
    description:
      'Track service behavior with logs and response data to catch reliability drift before users report it.',
    icon: Globe,
    iconClass: 'text-violet-600',
  },
];

const apiFeatures = [
  {
    title: 'Stateless API Auth',
    description:
      'Use API keys in server-side scripts and CI jobs to manage monitors safely without browser sessions.',
    icon: Terminal,
  },
  {
    title: 'Webhook Automation',
    description:
      'Receive alert payloads and trigger auto-remediation flows such as rollback or incident ticket creation.',
    icon: Smartphone,
  },
  {
    title: 'Key Management',
    description:
      'Rotate keys and scope access for teammates and automation workers from the dashboard.',
    icon: Key,
  },
];

const cliFeatures = [
  'Install globally from npm with `npm install -g zer0friction-cli`.',
  'Use `zf init` for guided setup and first-time onboarding.',
  'Run `zf doctor` to verify configuration and environment quickly.',
  'Create and list monitors from the terminal for repeatable workflows.',
];

export default function HowToUse() {
  const articleSchema = {
    '@context': 'https://schema.org',
    '@type': 'TechArticle',
    headline: 'Zer0Friction User Manual',
    description:
      'Learn how to set up uptime monitors, response-time alerts, API automation, and incident-friendly workflows in Zer0Friction.',
    author: {
      '@type': 'Organization',
      name: 'Zer0Friction',
    },
    publisher: {
      '@type': 'Organization',
      name: 'Zer0Friction',
    },
    url: 'https://www.zer0friction.in/how-to-use',
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <PageMeta
        title="How To Use Zer0Friction | Website and API Monitoring Guide"
        description="Learn how to set up API monitoring, uptime alerts, response-time checks, and automation workflows in Zer0Friction."
        canonicalPath="/how-to-use"
      />
      <SeoJsonLd id="how-to-use" data={articleSchema} />
      <section className="relative overflow-hidden border-b border-slate-200 bg-white px-4 pb-16 pt-14 sm:px-6 lg:px-8 lg:pb-20">
        <div className="pointer-events-none absolute inset-0 opacity-10">
          <Zap className="absolute -left-20 -top-24 h-80 w-80 rotate-12 text-emerald-500" />
          <Activity className="absolute -bottom-28 -right-20 h-96 w-96 -rotate-12 text-emerald-600" />
        </div>
        <div className="relative mx-auto max-w-6xl text-center">
          <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-emerald-600 shadow-lg shadow-emerald-600/30">
            <Zap className="h-8 w-8 text-white" />
          </div>
          <h1 className="text-4xl font-black tracking-tight sm:text-5xl lg:text-6xl">
            Zer0Friction User Manual
          </h1>
          <p className="mx-auto mt-5 max-w-3xl text-base leading-relaxed text-slate-600 sm:text-lg">
            Learn how to set up monitors, understand response-time insights, and automate alert flows so customers always see reliable systems.
          </p>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <a
              href="#monitoring"
              className="rounded-xl bg-slate-900 px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-800"
            >
              Start With Monitoring
            </a>
            <a
              href="#api"
              className="rounded-xl border border-slate-300 bg-white px-5 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-100"
            >
              API + Automation
            </a>
            <a
              href="#cli"
              className="rounded-xl border border-slate-300 bg-white px-5 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-100"
            >
              CLI Workflow
            </a>
          </div>
        </div>
      </section>

      <section id="monitoring" className="px-4 py-14 sm:px-6 lg:px-8 lg:py-20">
        <div className="mx-auto grid max-w-6xl grid-cols-1 gap-8 lg:grid-cols-[1.1fr_1fr]">
          <div>
            <p className="inline-flex rounded-full bg-blue-100 px-3 py-1 text-xs font-bold uppercase tracking-wider text-blue-700">
              Monitoring Core
            </p>
            <h2 className="mt-4 text-3xl font-black tracking-tight sm:text-4xl">
              Set monitors that give clear uptime and latency signals
            </h2>
            <p className="mt-4 text-slate-600">
              Every monitor stores checks, response codes, response times, and alert history. The dashboard uses this to show availability and incident context instead of a raw status list.
            </p>

            <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2">
              {monitoringFeatures.map((feature) => {
                const Icon = feature.icon;
                return (
                  <article
                    key={feature.title}
                    className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
                  >
                    <Icon className={`h-6 w-6 ${feature.iconClass}`} />
                    <h3 className="mt-3 text-lg font-semibold">{feature.title}</h3>
                    <p className="mt-2 text-sm leading-relaxed text-slate-600">
                      {feature.description}
                    </p>
                  </article>
                );
              })}
            </div>
          </div>

          <div className="rounded-3xl border border-slate-800 bg-slate-900 p-4 shadow-2xl">
            <div className="rounded-2xl border border-slate-700 bg-slate-800 p-6">
              <div className="mb-5 flex items-center justify-between border-b border-slate-700 pb-4">
                <h3 className="text-lg font-bold text-white">Monitor Configuration</h3>
                <Settings className="h-5 w-5 text-slate-400" />
              </div>
              <div className="space-y-3 text-sm">
                <div className="flex items-center justify-between text-slate-300">
                  <span>Expected status code</span>
                  <span className="rounded bg-slate-700 px-2 py-1 text-xs font-semibold text-white">
                    200
                  </span>
                </div>
                <div className="flex items-center justify-between text-slate-300">
                  <span>Interval</span>
                  <span className="rounded bg-slate-700 px-2 py-1 text-xs font-semibold text-white">
                    60s
                  </span>
                </div>
                <div className="flex items-center justify-between text-slate-300">
                  <span>Timeout limit</span>
                  <span className="rounded bg-slate-700 px-2 py-1 text-xs font-semibold text-white">
                    5000ms
                  </span>
                </div>
                <div className="flex items-center justify-between text-slate-300">
                  <span>Failure threshold</span>
                  <span className="rounded bg-slate-700 px-2 py-1 text-xs font-semibold text-white">
                    3 checks
                  </span>
                </div>
                <div className="mt-4 rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3 text-emerald-200">
                  Alerts trigger only when consecutive failures cross threshold. This helps reduce false positives.
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section id="api" className="border-y border-slate-200 bg-white px-4 py-14 sm:px-6 lg:px-8 lg:py-20">
        <div className="mx-auto grid max-w-6xl grid-cols-1 gap-8 lg:grid-cols-[1fr_1.1fr]">
          <div className="rounded-3xl border border-slate-800 bg-slate-900 p-4 shadow-2xl">
            <div className="overflow-hidden rounded-2xl border border-slate-700 bg-slate-950">
              <div className="flex items-center gap-2 border-b border-slate-800 px-4 py-3">
                <div className="h-2.5 w-2.5 rounded-full bg-red-400" />
                <div className="h-2.5 w-2.5 rounded-full bg-yellow-400" />
                <div className="h-2.5 w-2.5 rounded-full bg-green-400" />
                <span className="ml-3 text-[10px] uppercase tracking-widest text-slate-400">
                  API Example
                </span>
              </div>
              <pre className="overflow-x-auto p-4 text-xs leading-relaxed text-slate-200 sm:text-sm">
{`# 1. Create an API key in the dashboard
# 2. Read your project ID
curl $BACKEND_URL/api/v1/projects \\
  -H "x-api-key: zf_your_generated_key"

# 3. Create a monitor with the returned projectId
curl -X POST $BACKEND_URL/api/v1/monitors \\
  -H "Content-Type: application/json" \\
  -H "x-api-key: zf_your_generated_key" \\
  -d '{
    "name": "CI Verify",
    "url": "https://staging.app.com/health",
    "projectId": "your-project-id",
    "httpMethod": "GET",
    "intervalSeconds": 60,
    "timeoutMs": 5000
  }'`}
              </pre>
            </div>
          </div>

          <div>
            <p className="inline-flex rounded-full bg-violet-100 px-3 py-1 text-xs font-bold uppercase tracking-wider text-violet-700">
              SDK + REST
            </p>
            <h2 className="mt-4 text-3xl font-black tracking-tight sm:text-4xl">
              Scale and automate through API workflows
            </h2>
            <p className="mt-4 text-slate-600">
              Use API keys for CI/CD provisioning, incident automation, and integration with internal tooling. This keeps monitoring repeatable for teams as they grow.
            </p>

            <div className="mt-6 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900">
              Replace `$BACKEND_URL` with your deployed API origin. The required path prefix is `/api/v1`, and monitor creation also requires a valid `projectId`.
            </div>

            <div className="mt-6 rounded-2xl border border-amber-200 bg-amber-50 p-5">
              <h3 className="text-sm font-bold uppercase tracking-wider text-amber-900">
                Required Before POST /monitors
              </h3>
              <p className="mt-3 text-sm leading-relaxed text-amber-900">
                You cannot create a monitor with only `name` and `url`. First call `GET /api/v1/projects`, copy one valid `projectId`, and send that `projectId` in the monitor creation body.
              </p>
            </div>

            <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2">
              {apiFeatures.map((feature) => {
                const Icon = feature.icon;
                return (
                  <article
                    key={feature.title}
                    className="rounded-2xl border border-slate-200 bg-slate-50 p-5"
                  >
                    <Icon className="h-5 w-5 text-emerald-600" />
                    <h3 className="mt-3 text-base font-semibold">{feature.title}</h3>
                    <p className="mt-2 text-sm text-slate-600">{feature.description}</p>
                  </article>
                );
              })}
            </div>

            <div className="mt-6 rounded-2xl border border-slate-200 bg-slate-50 p-5">
              <h3 className="text-sm font-bold uppercase tracking-wider text-slate-700">
                Correct API flow
              </h3>
              <ol className="mt-3 space-y-2 text-sm text-slate-600">
                <li>1. Generate an API key in the dashboard.</li>
                <li>2. Call `GET /api/v1/projects` with `x-api-key` to fetch your project ID.</li>
                <li>3. Call `POST /api/v1/monitors` with `name`, `url`, `projectId`, and your desired interval settings.</li>
              </ol>
            </div>

            <div className="mt-6 rounded-2xl border border-slate-200 bg-white p-5">
              <h3 className="text-sm font-bold uppercase tracking-wider text-slate-700">
                Required JSON Body
              </h3>
              <pre className="mt-3 overflow-x-auto rounded-xl bg-slate-900 p-4 text-xs leading-relaxed text-slate-100 sm:text-sm">{`{
  "name": "CI Verify",
  "url": "https://staging.app.com/health",
  "projectId": "your-project-id",
  "httpMethod": "GET",
  "intervalSeconds": 60,
  "timeoutMs": 5000
}`}</pre>
            </div>
          </div>
        </div>
      </section>

      <section id="cli" className="px-4 py-14 sm:px-6 lg:px-8 lg:py-20">
        <div className="mx-auto grid max-w-6xl grid-cols-1 gap-8 lg:grid-cols-[1.05fr_0.95fr]">
          <div>
            <p className="inline-flex rounded-full bg-cyan-100 px-3 py-1 text-xs font-bold uppercase tracking-wider text-cyan-700">
              CLI Workflow
            </p>
            <h2 className="mt-4 text-3xl font-black tracking-tight sm:text-4xl">
              Work from the terminal when the dashboard is not enough
            </h2>
            <p className="mt-4 text-slate-600">
              Zer0Friction also ships with a public npm CLI, so your team is not limited to the browser.
              Use it for faster setup, repeatable onboarding, and script-friendly monitor creation.
            </p>

            <div className="mt-8 space-y-4">
              {cliFeatures.map((feature) => (
                <div key={feature} className="flex items-start gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                  <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600" />
                  <p className="text-sm leading-7 text-slate-700">{feature}</p>
                </div>
              ))}
            </div>

            <div className="mt-8 flex flex-wrap gap-3">
              <Link
                to="/cli"
                className="inline-flex items-center justify-center rounded-xl bg-slate-900 px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-800"
              >
                Open CLI page
              </Link>
              <a
                href="https://www.npmjs.com/package/zer0friction-cli"
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center justify-center rounded-xl border border-slate-300 bg-white px-5 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-100"
              >
                View on npm
              </a>
            </div>
          </div>

          <div className="rounded-3xl border border-slate-800 bg-slate-900 p-4 shadow-2xl">
            <div className="overflow-hidden rounded-2xl border border-slate-700 bg-slate-950">
              <div className="flex items-center gap-2 border-b border-slate-800 px-4 py-3">
                <div className="h-2.5 w-2.5 rounded-full bg-red-400" />
                <div className="h-2.5 w-2.5 rounded-full bg-yellow-400" />
                <div className="h-2.5 w-2.5 rounded-full bg-green-400" />
                <span className="ml-3 text-[10px] uppercase tracking-widest text-slate-400">
                  Zer0Friction CLI
                </span>
              </div>
              <pre className="overflow-x-auto p-4 text-xs leading-relaxed text-slate-200 sm:text-sm">{`npm install -g zer0friction-cli

zf doctor
zf init
zf monitors create --interactive
zf monitors list`}</pre>
            </div>
          </div>
        </div>
      </section>

      <section className="bg-slate-900 px-4 py-14 text-center sm:px-6 lg:px-8 lg:py-16">
        <CheckCircle2 className="mx-auto h-14 w-14 text-emerald-500" />
        <h2 className="mt-4 text-3xl font-black tracking-tight text-white sm:text-4xl">
          Ready to operate with confidence
        </h2>
        <p className="mx-auto mt-3 max-w-2xl text-sm text-slate-300 sm:text-base">
          Continue to your workspace and create monitors with meaningful intervals, thresholds, and alert routing.
        </p>
        <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
          <Link
            to="/dashboard"
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-white px-6 py-3 text-sm font-semibold text-slate-900 transition hover:bg-slate-100"
          >
            Open Dashboard
            <ArrowRight className="h-4 w-4" />
          </Link>
          <Link
            to="/monitors"
            className="inline-flex items-center justify-center rounded-xl border border-slate-700 px-6 py-3 text-sm font-semibold text-slate-300 transition hover:bg-slate-800"
          >
            Create Monitor
          </Link>
        </div>
      </section>
    </div>
  );
}
