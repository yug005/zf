import { useMemo, useState } from 'react';
import type { FormEvent } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Clock3, GitBranch, Loader2, Plus, Sparkles } from 'lucide-react';
import { axiosPrivate } from '../services/api';

type ChangeEventType =
  | 'DEPLOY'
  | 'CONFIG'
  | 'DNS'
  | 'FEATURE_FLAG'
  | 'SSL'
  | 'SECRET'
  | 'INFRASTRUCTURE'
  | 'RELEASE'
  | 'MANUAL';

type ChangeEventSource = 'MANUAL' | 'API' | 'GITHUB' | 'VERCEL' | 'RAILWAY' | 'SYSTEM';

interface Project {
  id: string;
  name: string;
  slug: string;
}

interface MonitorOption {
  id: string;
  name: string;
  projectId: string;
}

interface ChangeEvent {
  id: string;
  type: ChangeEventType;
  source: ChangeEventSource;
  externalId?: string | null;
  deduped?: boolean;
  title: string;
  summary?: string | null;
  serviceName?: string | null;
  environment?: string | null;
  version?: string | null;
  happenedAt: string;
  watchUntil?: string | null;
  isWatchActive?: boolean;
  watchMinutesRemaining?: number;
  project: {
    id: string;
    name: string;
  };
  monitor?: {
    id: string;
    name: string;
  } | null;
}

function ensureArray<T>(value: unknown): T[] {
  return Array.isArray(value) ? (value as T[]) : [];
}

const typeTone: Record<ChangeEventType, string> = {
  DEPLOY: 'bg-sky-500/12 text-sky-200 border-sky-400/30',
  CONFIG: 'bg-amber-500/12 text-amber-200 border-amber-400/30',
  DNS: 'bg-violet-500/12 text-violet-200 border-violet-400/30',
  FEATURE_FLAG: 'bg-emerald-500/12 text-emerald-200 border-emerald-400/30',
  SSL: 'bg-blue-500/12 text-blue-200 border-blue-400/30',
  SECRET: 'bg-rose-500/12 text-rose-200 border-rose-400/30',
  INFRASTRUCTURE: 'bg-orange-500/12 text-orange-200 border-orange-400/30',
  RELEASE: 'bg-indigo-500/12 text-indigo-200 border-indigo-400/30',
  MANUAL: 'bg-slate-500/10 text-slate-200 border-slate-400/20',
};

const formatDateTimeInput = (value = new Date()) => {
  const local = new Date(value.getTime() - value.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 16);
};

export default function Changes() {
  const queryClient = useQueryClient();
  const [typeFilter, setTypeFilter] = useState<'ALL' | ChangeEventType>('ALL');
  const [sourceFilter, setSourceFilter] = useState<'ALL' | ChangeEventSource>('ALL');
  const [formState, setFormState] = useState({
    projectId: '',
    monitorId: '',
    type: 'DEPLOY' as ChangeEventType,
    source: 'MANUAL' as ChangeEventSource,
    title: '',
    summary: '',
    serviceName: '',
    environment: 'production',
    version: '',
    watchWindowMinutes: 30,
    happenedAt: formatDateTimeInput(),
  });

  const { data: projects = [] } = useQuery({
    queryKey: ['projects'],
    queryFn: async () => {
      const { data } = await axiosPrivate.get<Project[]>('/projects');
      return ensureArray<Project>(data);
    },
  });

  const { data: monitors = [] } = useQuery({
    queryKey: ['monitors'],
    queryFn: async () => {
      const { data } = await axiosPrivate.get<MonitorOption[]>('/monitors');
      return ensureArray<MonitorOption>(data);
    },
  });

  const { data: changes = [], isLoading } = useQuery({
    queryKey: ['changes'],
    queryFn: async () => {
      const { data } = await axiosPrivate.get<ChangeEvent[]>('/changes?limit=50');
      return ensureArray<ChangeEvent>(data);
    },
    refetchInterval: 15_000,
  });

  const filteredChanges = useMemo(
    () =>
      changes.filter(
        (change) =>
          (typeFilter === 'ALL' || change.type === typeFilter) &&
          (sourceFilter === 'ALL' || change.source === sourceFilter),
      ),
    [changes, sourceFilter, typeFilter],
  );

  const filteredMonitors = useMemo(
    () => monitors.filter((monitor) => !formState.projectId || monitor.projectId === formState.projectId),
    [formState.projectId, monitors],
  );

  const selectedProject = useMemo(
    () => projects.find((project) => project.id === formState.projectId) || projects[0] || null,
    [formState.projectId, projects],
  );

  const ingestExamples = useMemo(() => {
    const projectSlug = selectedProject?.slug || 'your-project-slug';
    const serviceName = formState.serviceName || 'Marketing Website';
    const environment = formState.environment || 'production';

    return {
      generic: `curl -X POST "$BACKEND_URL/api/v1/changes/ingest/deploy" \\
  -H "Content-Type: application/json" \\
  -H "x-api-key: <YOUR_API_KEY>" \\
  -d '{
    "provider": "API",
    "projectSlug": "${projectSlug}",
    "type": "DEPLOY",
    "serviceName": "${serviceName}",
    "environment": "${environment}",
    "version": "v1.0.1",
    "externalId": "deploy-123",
    "title": "Production deploy",
    "happenedAt": "${new Date().toISOString()}"
  }'`,
      github: `{
  "provider": "GITHUB",
  "projectSlug": "${projectSlug}",
  "type": "DEPLOY",
  "repository": "owner/repo",
  "branch": "main",
  "commitSha": "$GITHUB_SHA",
  "version": "$GITHUB_SHA",
  "externalId": "$GITHUB_RUN_ID",
  "serviceName": "${serviceName}",
  "environment": "${environment}"
}`,
      vercel: `{
  "provider": "VERCEL",
  "projectSlug": "${projectSlug}",
  "repository": "owner/repo",
  "branch": "$VERCEL_GIT_COMMIT_REF",
  "commitSha": "$VERCEL_GIT_COMMIT_SHA",
  "version": "$VERCEL_GIT_COMMIT_SHA",
  "externalId": "$VERCEL_DEPLOYMENT_ID",
  "deploymentUrl": "$VERCEL_URL",
  "serviceName": "${serviceName}",
  "environment": "${environment}"
}`,
      railway: `{
  "provider": "RAILWAY",
  "projectSlug": "${projectSlug}",
  "repository": "owner/repo",
  "branch": "$RAILWAY_GIT_BRANCH",
  "commitSha": "$RAILWAY_GIT_COMMIT_SHA",
  "version": "$RAILWAY_GIT_COMMIT_SHA",
  "externalId": "$RAILWAY_DEPLOYMENT_ID",
  "serviceName": "${serviceName}",
  "environment": "${environment}"
}`,
    };
  }, [formState.environment, formState.serviceName, selectedProject]);

  const createMutation = useMutation({
    mutationFn: async () => {
      const payload = {
        ...formState,
        monitorId: formState.monitorId || undefined,
        summary: formState.summary || undefined,
        serviceName: formState.serviceName || undefined,
        environment: formState.environment || undefined,
        version: formState.version || undefined,
        watchWindowMinutes: formState.watchWindowMinutes || undefined,
      };

      await axiosPrivate.post('/changes', payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['changes'] });
      setFormState((current) => ({
        ...current,
        monitorId: '',
        title: '',
        summary: '',
        serviceName: '',
        version: '',
        watchWindowMinutes: 30,
        happenedAt: formatDateTimeInput(),
      }));
    },
  });

  const submit = (event: FormEvent) => {
    event.preventDefault();
    createMutation.mutate();
  };

  return (
    <div className="mx-auto max-w-6xl space-y-6 pb-10 text-slate-100">
      <div>
        <h1 className="text-2xl font-bold text-white">Changes</h1>
        <p className="text-sm text-slate-400">
          Record deploys, config updates, and other risky changes so incidents can be correlated against real change history.
        </p>
      </div>

      <div className="rounded-3xl border border-slate-200 bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 p-6 text-white shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="max-w-3xl">
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.22em] text-emerald-200">
              <Sparkles className="h-4 w-4" />
              Automation Ready
            </div>
            <p className="mt-3 text-sm leading-6 text-slate-200">
              External systems can now call `POST /api/v1/changes/ingest/deploy` using an `x-api-key`. Use either
              `projectId` or `projectSlug`, include an `externalId`, and retried deploy events will be deduped instead
              of polluting your change timeline.
            </p>
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/10 px-4 py-3 text-sm text-slate-100 backdrop-blur">
            <p className="font-semibold">Recommended fields</p>
            <p className="mt-2 text-slate-300">
              `projectSlug`, `provider`, `serviceName`, `environment`, `version`, `externalId`
            </p>
          </div>
        </div>
        <div className="mt-4 grid gap-3 lg:grid-cols-3">
          <div className="rounded-2xl border border-white/10 bg-white/10 p-4">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-200">Step 1</p>
            <p className="mt-2 text-sm text-slate-100">Create an API key inside Zer0Friction.</p>
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/10 p-4">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-200">Step 2</p>
            <p className="mt-2 text-sm text-slate-100">Add backend URL, API key, and project slug to your deployment secrets.</p>
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/10 p-4">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-200">Step 3</p>
            <p className="mt-2 text-sm text-slate-100">Send deploy metadata after each release so incidents correlate automatically.</p>
          </div>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-3xl border border-white/10 bg-[#08111f]/90 p-6 shadow-[0_24px_80px_rgba(2,8,23,0.38)] backdrop-blur-xl">
          <h2 className="text-lg font-semibold text-white">Generic CI/CD example</h2>
          <p className="mt-2 text-sm text-slate-400">
            Use this from GitHub Actions, Jenkins, GitLab CI, or any deployment script with an API key.
          </p>
          <pre className="mt-4 overflow-x-auto rounded-2xl bg-slate-950 p-4 text-xs leading-6 text-emerald-100">
            {ingestExamples.generic}
          </pre>
        </div>

        <div className="rounded-3xl border border-white/10 bg-[#08111f]/90 p-6 shadow-[0_24px_80px_rgba(2,8,23,0.38)] backdrop-blur-xl">
          <h2 className="text-lg font-semibold text-white">Provider payload examples</h2>
          <p className="mt-2 text-sm text-slate-400">
            Map your deployment metadata into one normalized payload shape. Use the same endpoint for each provider.
          </p>

          <div className="mt-4 space-y-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">GitHub</p>
              <pre className="mt-2 overflow-x-auto rounded-2xl bg-slate-950 p-4 text-xs leading-6 text-sky-100">
                {ingestExamples.github}
              </pre>
            </div>

            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Vercel</p>
              <pre className="mt-2 overflow-x-auto rounded-2xl bg-slate-950 p-4 text-xs leading-6 text-violet-100">
                {ingestExamples.vercel}
              </pre>
            </div>

            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Railway</p>
              <pre className="mt-2 overflow-x-auto rounded-2xl bg-slate-950 p-4 text-xs leading-6 text-emerald-100">
                {ingestExamples.railway}
              </pre>
            </div>
          </div>
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.1fr_1.4fr]">
        <form onSubmit={submit} className="rounded-3xl border border-white/10 bg-[#08111f]/90 p-6 shadow-[0_24px_80px_rgba(2,8,23,0.38)] backdrop-blur-xl">
          <div className="flex items-center gap-3">
            <div className="rounded-2xl bg-white/5 p-3 text-slate-200">
              <Plus className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-white">Record a change event</h2>
              <p className="text-sm text-slate-400">This becomes part of the incident timeline and likely-trigger engine.</p>
            </div>
          </div>

          <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-2">
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-300">Project</label>
              <select
                required
                value={formState.projectId}
                onChange={(event) => setFormState((current) => ({ ...current, projectId: event.target.value, monitorId: '' }))}
                className="w-full rounded-2xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-slate-100"
              >
                <option value="">Select project</option>
                {projects.map((project) => (
                  <option key={project.id} value={project.id}>{project.name}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-slate-300">Monitor</label>
              <select
                value={formState.monitorId}
                onChange={(event) => setFormState((current) => ({ ...current, monitorId: event.target.value }))}
                className="w-full rounded-2xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-slate-100"
              >
                <option value="">Project-wide change</option>
                {filteredMonitors.map((monitor) => (
                  <option key={monitor.id} value={monitor.id}>{monitor.name}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-slate-300">Change Type</label>
              <select
                value={formState.type}
                onChange={(event) => setFormState((current) => ({ ...current, type: event.target.value as ChangeEventType }))}
                className="w-full rounded-2xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-slate-100"
              >
                {['DEPLOY', 'CONFIG', 'DNS', 'FEATURE_FLAG', 'SSL', 'SECRET', 'INFRASTRUCTURE', 'RELEASE', 'MANUAL'].map((type) => (
                  <option key={type} value={type}>{type}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-slate-300">Source</label>
              <select
                value={formState.source}
                onChange={(event) => setFormState((current) => ({ ...current, source: event.target.value as ChangeEventSource }))}
                className="w-full rounded-2xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-slate-100"
              >
                {['MANUAL', 'API', 'GITHUB', 'VERCEL', 'RAILWAY', 'SYSTEM'].map((source) => (
                  <option key={source} value={source}>{source}</option>
                ))}
              </select>
            </div>

            <div className="md:col-span-2">
              <label className="mb-1 block text-sm font-medium text-slate-300">Title</label>
              <input
                required
                value={formState.title}
                onChange={(event) => setFormState((current) => ({ ...current, title: event.target.value }))}
                className="w-full rounded-2xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500"
                placeholder="Deployed checkout-api v2.4.1"
              />
            </div>

            <div className="md:col-span-2">
              <label className="mb-1 block text-sm font-medium text-slate-300">Summary</label>
              <textarea
                rows={3}
                value={formState.summary}
                onChange={(event) => setFormState((current) => ({ ...current, summary: event.target.value }))}
                className="w-full rounded-2xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500"
                placeholder="Rolled out payment timeout changes and new retry configuration."
              />
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-slate-300">Service Name</label>
              <input
                value={formState.serviceName}
                onChange={(event) => setFormState((current) => ({ ...current, serviceName: event.target.value }))}
                className="w-full rounded-2xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500"
                placeholder="Checkout API"
              />
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-slate-300">Version</label>
              <input
                value={formState.version}
                onChange={(event) => setFormState((current) => ({ ...current, version: event.target.value }))}
                className="w-full rounded-2xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500"
                placeholder="v2.4.1"
              />
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-slate-300">Environment</label>
              <input
                value={formState.environment}
                onChange={(event) => setFormState((current) => ({ ...current, environment: event.target.value }))}
                className="w-full rounded-2xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500"
                placeholder="production"
              />
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-slate-300">Happened At</label>
              <input
                required
                type="datetime-local"
                value={formState.happenedAt}
                onChange={(event) => setFormState((current) => ({ ...current, happenedAt: event.target.value }))}
                className="w-full rounded-2xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-slate-100"
              />
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-slate-300">Watch Window (min)</label>
              <input
                type="number"
                min={1}
                max={240}
                value={formState.watchWindowMinutes}
                onChange={(event) => setFormState((current) => ({ ...current, watchWindowMinutes: Number(event.target.value) }))}
                className="w-full rounded-2xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-slate-100"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={createMutation.isPending}
            className="mt-6 inline-flex items-center rounded-2xl border border-emerald-400/30 bg-emerald-400/15 px-4 py-2 text-sm font-medium text-emerald-100 hover:bg-emerald-400/20 disabled:opacity-50"
          >
            {createMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <GitBranch className="mr-2 h-4 w-4" />}
            Save change event
          </button>
        </form>

        <div className="rounded-3xl border border-white/10 bg-[#08111f]/90 shadow-[0_24px_80px_rgba(2,8,23,0.38)] backdrop-blur-xl">
          <div className="border-b border-white/10 px-6 py-5">
            <h2 className="text-lg font-semibold text-white">Recent change timeline</h2>
            <p className="mt-1 text-sm text-slate-400">
              These events are what Phase C uses to explain likely triggers when an incident begins.
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              <select
                value={typeFilter}
                onChange={(event) => setTypeFilter(event.target.value as 'ALL' | ChangeEventType)}
                className="rounded-full border border-white/10 bg-white/5 px-3 py-2 text-xs font-medium text-slate-300"
              >
                <option value="ALL">All types</option>
                {['DEPLOY', 'CONFIG', 'DNS', 'FEATURE_FLAG', 'SSL', 'SECRET', 'INFRASTRUCTURE', 'RELEASE', 'MANUAL'].map((type) => (
                  <option key={type} value={type}>{type}</option>
                ))}
              </select>

              <select
                value={sourceFilter}
                onChange={(event) => setSourceFilter(event.target.value as 'ALL' | ChangeEventSource)}
                className="rounded-full border border-white/10 bg-white/5 px-3 py-2 text-xs font-medium text-slate-300"
              >
                <option value="ALL">All sources</option>
                {['MANUAL', 'API', 'GITHUB', 'VERCEL', 'RAILWAY', 'SYSTEM'].map((source) => (
                  <option key={source} value={source}>{source}</option>
                ))}
              </select>
            </div>
          </div>

          {isLoading ? (
            <div className="flex min-h-[320px] items-center justify-center">
              <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
            </div>
          ) : filteredChanges.length === 0 ? (
            <div className="px-6 py-12 text-center text-sm text-slate-400">
              No changes match the current filter.
            </div>
          ) : (
            <div className="divide-y divide-white/6">
              {filteredChanges.map((change) => (
                <div key={change.id} className="px-6 py-5">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className={`rounded-full border px-2.5 py-1 text-xs font-semibold ${typeTone[change.type]}`}>
                          {change.type}
                        </span>
                        <span className="rounded-full border border-white/10 bg-white/[0.03] px-2.5 py-1 text-xs font-semibold text-slate-300">
                          {change.source}
                        </span>
                        {change.deduped ? (
                          <span className="rounded-full border border-amber-400/30 bg-amber-500/12 px-2.5 py-1 text-xs font-semibold text-amber-200">
                            Duplicate skipped
                          </span>
                        ) : null}
                      </div>
                      <p className="mt-3 font-semibold text-white">{change.title}</p>
                      <p className="mt-2 text-sm text-slate-300">{change.summary || 'No extra summary provided.'}</p>
                    </div>

                    <div className="rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-2 text-xs font-medium text-slate-400">
                        <Clock3 className="h-3.5 w-3.5" />
                        Happened
                      </div>
                      <p className="mt-1 text-sm font-semibold text-white">
                        {new Date(change.happenedAt).toLocaleString()}
                      </p>
                    </div>
                  </div>

                  <div className="mt-4 flex flex-wrap gap-2 text-xs text-slate-300">
                    <span className="rounded-full border border-white/10 bg-white/[0.03] px-3 py-1">
                      Project: {change.project.name}
                    </span>
                    <span className="rounded-full border border-white/10 bg-white/[0.03] px-3 py-1">
                      Monitor: {change.monitor?.name || 'Project-wide'}
                    </span>
                    <span className="rounded-full border border-white/10 bg-white/[0.03] px-3 py-1">
                      Service: {change.serviceName || 'Unspecified'}
                    </span>
                    <span className="rounded-full border border-white/10 bg-white/[0.03] px-3 py-1">
                      Env: {change.environment || 'Unspecified'}
                    </span>
                    {change.version ? (
                      <span className="rounded-full border border-white/10 bg-white/[0.03] px-3 py-1">
                        Version: {change.version}
                      </span>
                    ) : null}
                    {change.watchUntil ? (
                      <span className={`rounded-full border px-3 py-1 ${
                        change.isWatchActive
                          ? 'border-emerald-400/30 bg-emerald-500/12 text-emerald-200'
                          : 'border-white/10 bg-white/[0.03] text-slate-300'
                      }`}>
                        {change.isWatchActive
                          ? `Watch active • ${change.watchMinutesRemaining} min left`
                          : `Watch ended • ${new Date(change.watchUntil).toLocaleString()}`}
                      </span>
                    ) : null}
                    {change.externalId ? (
                      <span className="rounded-full border border-white/10 bg-white/[0.03] px-3 py-1">
                        External ID: {change.externalId}
                      </span>
                    ) : null}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

    </div>
  );
}
