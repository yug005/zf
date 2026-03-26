import {
  getConfigPath,
  loadConfig,
  resolveBaseUrl,
  resolveProjectId,
  saveConfig,
  type CliConfig,
} from './config.js';
import { detectGitSnapshot } from './git.js';
import {
  formatDate,
  formatLatency,
  formatPercentage,
  formatStatus,
  printBanner,
  printError,
  printJson,
  printKeyValue,
  printMuted,
  printSection,
  printSuccess,
  printTable,
  printWarning,
} from './format.js';
import { ZfApiClient } from './http.js';
import { ensureInteractive, promptConfirm, promptText } from './prompt.js';

type ParsedArgs = {
  positionals: string[];
  options: Record<string, string | boolean>;
};

type ConfigActionKey = 'base-url' | 'api-key' | 'project-id';

async function main(): Promise<void> {
  const parsed = parseArgs(process.argv.slice(2));
  const [group = 'help', action, ...rest] = parsed.positionals;
  const config = await loadConfig();
  const client = new ZfApiClient(config);

  switch (group) {
    case 'help':
    case '--help':
    case '-h':
      printHelp();
      return;
    case 'init':
      await handleInit(client, config, parsed.options);
      return;
    case 'status':
      await handleStatus(client, config, parsed.options);
      return;
    case 'config':
      await handleConfig(config, action, rest, parsed.options);
      return;
    case 'auth':
      await handleAuth(client, config, action, parsed.options);
      return;
    case 'projects':
      await handleProjects(client, config, action, parsed.options);
      return;
    case 'api-keys':
      await handleApiKeys(client, action, parsed.options);
      return;
    case 'monitors':
      await handleMonitors(client, config, action, parsed.options);
      return;
    case 'deploy':
      await handleDeploy(client, config, action, parsed.options);
      return;
    default:
      throw new Error(`Unknown command group: ${group}. Run \`zf help\` for usage.`);
  }
}

async function handleInit(
  client: ZfApiClient,
  config: CliConfig,
  options: ParsedArgs['options'],
): Promise<void> {
  printBanner('Guided setup', 'Connect the CLI to your Zer0Friction workspace in a couple of prompts.');

  const interactive = !getBooleanOption(options, 'non-interactive');
  if (interactive) {
    ensureInteractive();
  }

  const baseUrl =
    getStringOption(options, 'base-url') ||
    (interactive
      ? await promptText({
          label: 'Backend URL',
          defaultValue: resolveBaseUrl(config) || 'https://zf-yqpy.onrender.com',
          required: true,
        })
      : resolveBaseUrl(config));
  assertValue(baseUrl, 'base URL');

  const apiKey =
    getStringOption(options, 'api-key') ||
    (interactive
      ? await promptText({
          label: 'API key',
          defaultValue: config.apiKey,
          required: true,
        })
      : config.apiKey);
  assertValue(apiKey, 'API key');

  const me = await client.getMe({ baseUrl, apiKey });
  printSuccess(`Authenticated as ${me.email}`);

  const projects = await client.listProjects({ baseUrl, apiKey });
  let selectedProject = projects.find((project) => project.id === resolveProjectId(config));

  if (!selectedProject && projects.length === 1) {
    selectedProject = projects[0];
  }

  if (!selectedProject && interactive && projects.length > 0) {
    printSection('Projects');
    printTable(
      projects.map((project, index) => ({
        '#': index + 1,
        id: project.id,
        name: project.name,
        slug: project.slug,
      })),
    );
    const selection = await promptText({
      label: 'Choose default project number (leave blank to skip)',
      required: false,
    });
    if (selection) {
      const chosenIndex = Number(selection) - 1;
      if (Number.isNaN(chosenIndex) || !projects[chosenIndex]) {
        throw new Error('Invalid project selection.');
      }
      selectedProject = projects[chosenIndex];
    }
  }

  const nextConfig: CliConfig = {
    ...config,
    baseUrl,
    apiKey,
    projectId: selectedProject?.id,
    projectName: selectedProject?.name,
  };
  await saveConfig(nextConfig);

  printSection('Saved');
  printKeyValue([
    { key: 'config', value: getConfigPath() },
    { key: 'base-url', value: baseUrl },
    { key: 'api-key', value: maskApiKey(apiKey) },
    { key: 'project', value: selectedProject ? `${selectedProject.name} (${selectedProject.id})` : '-' },
  ]);
  printMuted('You can now run `zf status`, `zf monitors list`, or `zf deploy report` without repeating flags.');
}

async function handleStatus(
  client: ZfApiClient,
  config: CliConfig,
  options: ParsedArgs['options'],
): Promise<void> {
  const baseUrl = resolveBaseUrl(config, getStringOption(options, 'base-url'));
  const health = await client.getHealth(baseUrl);
  if (hasJsonFlag(options)) {
    printJson(health);
    return;
  }

  printBanner('System status', 'Live health from your configured backend.');
  printKeyValue([
    { key: 'backend', value: baseUrl || '(not configured)' },
    { key: 'config', value: getConfigPath() },
    { key: 'default project', value: config.projectName || config.projectId || '-' },
  ]);
  printSection('Health payload');
  printJson(health);
}

async function handleConfig(
  config: CliConfig,
  action: string | undefined,
  rest: string[],
  options: ParsedArgs['options'],
): Promise<void> {
  switch (action) {
    case 'show':
    case undefined:
      if (hasJsonFlag(options)) {
        printJson({ path: getConfigPath(), config });
        return;
      }
      printBanner('CLI config', 'Stored locally and overridable via env vars.');
      printKeyValue([
        { key: 'path', value: getConfigPath() },
        { key: 'base-url', value: config.baseUrl || '-' },
        { key: 'api-key', value: config.apiKey ? maskApiKey(config.apiKey) : '-' },
        { key: 'project-id', value: config.projectId || '-' },
        { key: 'project-name', value: config.projectName || '-' },
      ]);
      return;
    case 'get': {
      const key = rest[0] as ConfigActionKey | undefined;
      assertSupportedConfigKey(key);
      const value = readConfigValue(config, key);
      console.log(key === 'api-key' && value ? maskApiKey(value) : value || '');
      return;
    }
    case 'set': {
      const key = rest[0] as ConfigActionKey | undefined;
      const value = rest[1];
      assertSupportedConfigKey(key);
      assertValue(value, 'config value');
      const nextConfig = writeConfigValue(config, key, value);
      await saveConfig(nextConfig);
      printSuccess(`Saved ${key} to ${getConfigPath()}`);
      return;
    }
    case 'clear': {
      const key = rest[0] as ConfigActionKey | undefined;
      assertSupportedConfigKey(key);
      const nextConfig = clearConfigValue(config, key);
      await saveConfig(nextConfig);
      printSuccess(`Cleared ${key} in ${getConfigPath()}`);
      return;
    }
    default:
      throw new Error('Usage: zf config [show|get|set|clear] ...');
  }
}

async function handleAuth(
  client: ZfApiClient,
  config: CliConfig,
  action: string | undefined,
  options: ParsedArgs['options'],
): Promise<void> {
  switch (action) {
    case 'login': {
      const apiKey = getStringOption(options, 'api-key') || config.apiKey;
      const baseUrl = resolveBaseUrl(config, getStringOption(options, 'base-url'));
      assertValue(baseUrl, 'base URL (pass --base-url or configure it first)');
      assertValue(apiKey, 'API key');
      const me = await client.getMe({ baseUrl, apiKey });
      await saveConfig({
        ...config,
        apiKey,
        baseUrl,
      });
      printSuccess(`Authenticated as ${me.email}`);
      printMuted(`Saved credentials to ${getConfigPath()}`);
      return;
    }
    case 'whoami': {
      const me = await client.getMe();
      if (hasJsonFlag(options)) {
        printJson(me);
        return;
      }
      printBanner('Authenticated user');
      printTable([
        {
          id: me.id,
          email: me.email,
          name: me.name || '-',
          plan: me.subscriptionPlan || '-',
          status: me.subscriptionStatus || '-',
          verified: me.isVerified ? 'yes' : 'no',
        },
      ]);
      return;
    }
    default:
      throw new Error('Usage: zf auth <login|whoami> [options]');
  }
}

async function handleProjects(
  client: ZfApiClient,
  config: CliConfig,
  action: string | undefined,
  options: ParsedArgs['options'],
): Promise<void> {
  switch (action) {
    case 'list': {
      const projects = await client.listProjects();
      if (hasJsonFlag(options)) {
        printJson(projects);
        return;
      }
      printBanner('Projects', 'Your current Zer0Friction project catalog.');
      printTable(
        projects.map((project) => ({
          default: config.projectId === project.id ? '*' : '',
          id: project.id,
          name: project.name,
          slug: project.slug,
          description: project.description || '-',
          createdAt: formatDate(project.createdAt),
        })),
      );
      return;
    }
    case 'create': {
      const payload = {
        name: getRequiredOption(options, 'name'),
        slug: getRequiredOption(options, 'slug'),
        description: getStringOption(options, 'description'),
      };
      const project = await client.createProject(payload);
      if (hasJsonFlag(options)) {
        printJson(project);
        return;
      }
      printSuccess(`Created project ${project.name}`);
      printKeyValue([
        { key: 'id', value: project.id },
        { key: 'slug', value: project.slug },
      ]);
      return;
    }
    case 'use': {
      const projects = await client.listProjects();
      const id = getStringOption(options, 'id');
      const slug = getStringOption(options, 'slug');
      const project = projects.find((entry) => entry.id === id || entry.slug === slug);
      if (!project) {
        throw new Error('Project not found. Pass --id or --slug from `zf projects list`.');
      }
      await saveConfig({
        ...config,
        projectId: project.id,
        projectName: project.name,
      });
      printSuccess(`Default project set to ${project.name}`);
      return;
    }
    case 'current': {
      printBanner('Default project');
      printKeyValue([
        { key: 'project-id', value: config.projectId || '-' },
        { key: 'project-name', value: config.projectName || '-' },
      ]);
      return;
    }
    default:
      throw new Error('Usage: zf projects <list|create|use|current> [options]');
  }
}

async function handleApiKeys(
  client: ZfApiClient,
  action: string | undefined,
  options: ParsedArgs['options'],
): Promise<void> {
  switch (action) {
    case 'list': {
      const keys = await client.listApiKeys();
      if (hasJsonFlag(options)) {
        printJson(keys);
        return;
      }
      printBanner('API keys', 'Keys are only shown once at creation time, so keep new ones safe.');
      printTable(
        keys.map((key) => ({
          id: key.id,
          name: key.name,
          prefix: key.prefix,
          createdAt: formatDate(key.createdAt),
        })),
      );
      return;
    }
    case 'create': {
      const name = getStringOption(options, 'name') || 'CLI key';
      const key = await client.createApiKey({ name });
      if (hasJsonFlag(options)) {
        printJson(key);
        return;
      }
      printSuccess(`Created API key ${key.name}`);
      printWarning('Copy the full key now. It will not be shown again.');
      printKeyValue([
        { key: 'id', value: key.id },
        { key: 'prefix', value: key.prefix },
        { key: 'key', value: key.key },
      ]);
      return;
    }
    case 'revoke': {
      const id = getRequiredOption(options, 'id');
      await client.revokeApiKey(id);
      printSuccess(`Revoked API key ${id}`);
      return;
    }
    default:
      throw new Error('Usage: zf api-keys <list|create|revoke> [options]');
  }
}

async function handleMonitors(
  client: ZfApiClient,
  config: CliConfig,
  action: string | undefined,
  options: ParsedArgs['options'],
): Promise<void> {
  switch (action) {
    case 'list': {
      const projectId = requireProjectId(config, options);
      const monitors = await client.listMonitors(projectId);
      if (hasJsonFlag(options)) {
        printJson(monitors);
        return;
      }
      printBanner('Monitors', config.projectName ? `Project: ${config.projectName}` : undefined);
      printTable(
        monitors.map((monitor) => ({
          id: monitor.id,
          name: monitor.name,
          status: formatStatus(monitor.status),
          type: monitor.type,
          interval: `${monitor.intervalSeconds}s`,
          latency: formatLatency(monitor.avgResponseTimeMs),
          uptime: formatPercentage(monitor.uptimePercentage),
          url: monitor.url,
        })),
      );
      return;
    }
    case 'create': {
      const projectId =
        getStringOption(options, 'project-id') ||
        resolveProjectId(config) ||
        (getBooleanOption(options, 'interactive')
          ? await promptText({ label: 'Project ID', required: true })
          : undefined);
      assertValue(projectId, 'project ID');

      const payload: Record<string, unknown> = {
        projectId,
        name: getRequiredOption(options, 'name'),
        url: getRequiredOption(options, 'url'),
        type: getStringOption(options, 'type') || 'HTTP',
        httpMethod: getStringOption(options, 'method') || 'GET',
      };

      assignOptionalNumber(payload, options, 'interval', 'intervalSeconds');
      assignOptionalNumber(payload, options, 'timeout', 'timeoutMs');
      assignOptionalNumber(payload, options, 'expected-status', 'expectedStatus');
      assignOptionalNumber(payload, options, 'retries', 'retries');
      assignOptionalString(payload, options, 'service', 'serviceName');
      assignOptionalString(payload, options, 'feature', 'featureName');
      assignOptionalString(payload, options, 'journey', 'customerJourney');
      assignOptionalString(payload, options, 'owner', 'teamOwner');
      assignOptionalString(payload, options, 'region', 'region');
      assignOptionalString(payload, options, 'business-criticality', 'businessCriticality');
      assignOptionalString(payload, options, 'sla-tier', 'slaTier');

      const headers = parseJsonOption<Record<string, string>>(options, 'headers');
      const body = parseJsonOption<unknown>(options, 'body');
      if (headers) {
        payload.headers = headers;
      }
      if (body !== undefined) {
        payload.body = body;
      }

      const monitor = await client.createMonitor(payload);
      if (hasJsonFlag(options)) {
        printJson(monitor);
        return;
      }
      printSuccess(`Created monitor ${monitor.name}`);
      printKeyValue([
        { key: 'id', value: monitor.id },
        { key: 'url', value: monitor.url },
        { key: 'status', value: monitor.status },
      ]);
      return;
    }
    case 'get': {
      const id = getRequiredOption(options, 'id');
      const monitor = await client.getMonitor(id);
      if (hasJsonFlag(options)) {
        printJson(monitor);
        return;
      }
      printBanner(`Monitor ${monitor.name}`);
      printKeyValue([
        { key: 'id', value: monitor.id },
        { key: 'status', value: monitor.status },
        { key: 'type', value: monitor.type },
        { key: 'method', value: monitor.httpMethod || '-' },
        { key: 'url', value: monitor.url },
        { key: 'interval', value: monitor.intervalSeconds ? `${monitor.intervalSeconds}s` : '-' },
        { key: 'timeout', value: monitor.timeoutMs ? `${monitor.timeoutMs}ms` : '-' },
        { key: 'avg latency', value: monitor.avgResponseTimeMs ? `${monitor.avgResponseTimeMs}ms` : '-' },
        { key: 'uptime', value: monitor.uptimePercentage ?? '-' },
        { key: 'last checked', value: formatDate(monitor.lastCheckedAt) },
        { key: 'last error', value: monitor.lastErrorMessage || '-' },
      ]);
      return;
    }
    case 'checks': {
      const id = getRequiredOption(options, 'id');
      const limit = getNumberOption(options, 'limit') || 10;
      const checks = await client.listChecks(id, { limit });
      if (hasJsonFlag(options)) {
        printJson(checks);
        return;
      }
      printBanner('Monitor checks', `Recent checks for ${id}`);
      printTable(
        checks.map((check) => ({
          status: formatStatus(check.status),
          latency: formatLatency(check.responseTimeMs),
          code: check.statusCode ?? '-',
          region: check.region || '-',
          checkedAt: formatDate(check.createdAt || check.checkedAt),
          error: check.errorMessage || '-',
        })),
      );
      return;
    }
    case 'update': {
      const id = getRequiredOption(options, 'id');
      const payload: Record<string, unknown> = {};
      assignOptionalString(payload, options, 'name', 'name');
      assignOptionalString(payload, options, 'url', 'url');
      assignOptionalString(payload, options, 'type', 'type');
      assignOptionalString(payload, options, 'method', 'httpMethod');
      assignOptionalString(payload, options, 'service', 'serviceName');
      assignOptionalString(payload, options, 'feature', 'featureName');
      assignOptionalString(payload, options, 'journey', 'customerJourney');
      assignOptionalString(payload, options, 'owner', 'teamOwner');
      assignOptionalString(payload, options, 'region', 'region');
      assignOptionalString(payload, options, 'business-criticality', 'businessCriticality');
      assignOptionalString(payload, options, 'sla-tier', 'slaTier');
      assignOptionalNumber(payload, options, 'interval', 'intervalSeconds');
      assignOptionalNumber(payload, options, 'timeout', 'timeoutMs');
      assignOptionalNumber(payload, options, 'expected-status', 'expectedStatus');
      assignOptionalNumber(payload, options, 'retries', 'retries');
      const headers = parseJsonOption<Record<string, string>>(options, 'headers');
      const body = parseJsonOption<unknown>(options, 'body');
      if (headers) {
        payload.headers = headers;
      }
      if (body !== undefined) {
        payload.body = body;
      }
      if (Object.keys(payload).length === 0) {
        throw new Error('Nothing to update. Pass one or more update flags.');
      }
      const monitor = await client.updateMonitor(id, payload);
      if (hasJsonFlag(options)) {
        printJson(monitor);
        return;
      }
      printSuccess(`Updated monitor ${monitor.name}`);
      return;
    }
    case 'pause': {
      const id = getRequiredOption(options, 'id');
      await client.pauseMonitor(id);
      printSuccess(`Paused monitor ${id}`);
      return;
    }
    case 'resume': {
      const id = getRequiredOption(options, 'id');
      await client.resumeMonitor(id);
      printSuccess(`Resumed monitor ${id}`);
      return;
    }
    case 'delete': {
      const id = getRequiredOption(options, 'id');
      const force = getBooleanOption(options, 'force');
      if (!force) {
        const confirmed = await promptConfirm(`Delete monitor ${id}?`, false);
        if (!confirmed) {
          printMuted('Cancelled.');
          return;
        }
      }
      await client.deleteMonitor(id);
      printSuccess(`Deleted monitor ${id}`);
      return;
    }
    default:
      throw new Error('Usage: zf monitors <list|create|get|checks|update|pause|resume|delete> [options]');
  }
}

async function handleDeploy(
  client: ZfApiClient,
  config: CliConfig,
  action: string | undefined,
  options: ParsedArgs['options'],
): Promise<void> {
  if (action !== 'report') {
    throw new Error('Usage: zf deploy report [options]');
  }

  const git = detectGitSnapshot();
  const payload: Record<string, unknown> = {
    provider: getStringOption(options, 'provider') || inferProvider(git.repository) || 'API',
    type: getStringOption(options, 'type') || 'DEPLOY',
  };

  assignOptionalString(payload, options, 'project-id', 'projectId');
  assignOptionalString(payload, options, 'project-slug', 'projectSlug');
  assignOptionalString(payload, options, 'monitor-id', 'monitorId');
  assignOptionalString(payload, options, 'title', 'title');
  assignOptionalString(payload, options, 'summary', 'summary');
  assignOptionalString(payload, options, 'service', 'serviceName');
  assignOptionalString(payload, options, 'environment', 'environment');
  assignOptionalString(payload, options, 'version', 'version');
  assignOptionalString(payload, options, 'external-id', 'externalId');
  assignOptionalString(payload, options, 'repository', 'repository');
  assignOptionalString(payload, options, 'branch', 'branch');
  assignOptionalString(payload, options, 'commit-sha', 'commitSha');
  assignOptionalString(payload, options, 'deployment-id', 'deploymentId');
  assignOptionalString(payload, options, 'deployment-url', 'deploymentUrl');
  assignOptionalString(payload, options, 'happened-at', 'happenedAt');
  assignOptionalNumber(payload, options, 'watch-window', 'watchWindowMinutes');

  if (!payload.projectId && !payload.projectSlug && resolveProjectId(config)) {
    payload.projectId = resolveProjectId(config);
  }
  if (!payload.repository && git.repository) {
    payload.repository = git.repository;
  }
  if (!payload.branch && git.branch) {
    payload.branch = git.branch;
  }
  if (!payload.commitSha && git.commitSha) {
    payload.commitSha = git.commitSha;
  }
  if (!payload.title && git.branch) {
    payload.title = `Deploy ${git.branch}`;
  }

  const metadata = parseJsonOption<Record<string, unknown>>(options, 'metadata');
  if (metadata) {
    payload.metadata = metadata;
  }

  if (!payload.projectId && !payload.projectSlug) {
    throw new Error('Deploy reporting requires either --project-id, --project-slug, or a configured default project.');
  }

  const result = await client.reportDeploy(payload);
  if (hasJsonFlag(options)) {
    printJson(result);
    return;
  }

  printSuccess('Deploy event reported successfully.');
  printKeyValue([
    { key: 'project', value: String(payload.projectSlug || payload.projectId || '-') },
    { key: 'provider', value: String(payload.provider) },
    { key: 'branch', value: String(payload.branch || '-') },
    { key: 'commit', value: String(payload.commitSha || '-') },
  ]);
}

function printHelp(): void {
  printBanner('Command reference', 'A fast CLI for the monitor workflows you repeat most.');
  console.log(`Usage:
  zf init
  zf status
  zf config show|get|set|clear
  zf auth login --base-url <url> --api-key <key>
  zf auth whoami
  zf projects list|create|use|current
  zf api-keys list|create|revoke
  zf monitors list|get|checks|create|update|pause|resume|delete
  zf deploy report

Examples:
  zf init
  zf projects use --slug production
  zf monitors list
  zf monitors checks --id <monitor-id> --limit 20
  zf api-keys create --name "GitHub Actions"
  zf deploy report --environment production --service api

Global config:
  Stored at ~/.zer0friction/config.json
  Env overrides: ZF_BASE_URL, ZF_API_KEY, ZF_PROJECT_ID
`);
}

function parseArgs(argv: string[]): ParsedArgs {
  const positionals: string[] = [];
  const options: Record<string, string | boolean> = {};

  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (!token.startsWith('--')) {
      positionals.push(token);
      continue;
    }

    const withoutPrefix = token.slice(2);
    const [rawKey, inlineValue] = withoutPrefix.split('=', 2);
    if (inlineValue !== undefined) {
      options[rawKey] = inlineValue;
      continue;
    }

    const next = argv[index + 1];
    if (!next || next.startsWith('--')) {
      options[rawKey] = true;
      continue;
    }

    options[rawKey] = next;
    index += 1;
  }

  return { positionals, options };
}

function hasJsonFlag(options: ParsedArgs['options']): boolean {
  return Boolean(options.json);
}

function getRequiredOption(options: ParsedArgs['options'], key: string): string {
  const value = getStringOption(options, key);
  assertValue(value, `--${key}`);
  return value;
}

function getStringOption(options: ParsedArgs['options'], key: string): string | undefined {
  const value = options[key];
  return typeof value === 'string' ? value : undefined;
}

function getBooleanOption(options: ParsedArgs['options'], key: string): boolean {
  return Boolean(options[key]);
}

function getNumberOption(options: ParsedArgs['options'], key: string): number | undefined {
  const value = getStringOption(options, key);
  if (!value) {
    return undefined;
  }
  const parsed = Number(value);
  if (Number.isNaN(parsed)) {
    throw new Error(`--${key} must be a number.`);
  }
  return parsed;
}

function parseJsonOption<T>(options: ParsedArgs['options'], key: string): T | undefined {
  const value = getStringOption(options, key);
  if (!value) {
    return undefined;
  }

  try {
    return JSON.parse(value) as T;
  } catch {
    throw new Error(`--${key} must be valid JSON.`);
  }
}

function assignOptionalString(
  target: Record<string, unknown>,
  options: ParsedArgs['options'],
  optionKey: string,
  payloadKey: string,
): void {
  const value = getStringOption(options, optionKey);
  if (value) {
    target[payloadKey] = value;
  }
}

function assignOptionalNumber(
  target: Record<string, unknown>,
  options: ParsedArgs['options'],
  optionKey: string,
  payloadKey: string,
): void {
  const value = getStringOption(options, optionKey);
  if (!value) {
    return;
  }

  const parsed = Number(value);
  if (Number.isNaN(parsed)) {
    throw new Error(`--${optionKey} must be a number.`);
  }
  target[payloadKey] = parsed;
}

function assertValue(value: string | undefined, label: string): asserts value is string {
  if (!value) {
    throw new Error(`Missing ${label}.`);
  }
}

function assertSupportedConfigKey(key: ConfigActionKey | undefined): asserts key is ConfigActionKey {
  if (!key || !['base-url', 'api-key', 'project-id'].includes(key)) {
    throw new Error('Supported config keys are `base-url`, `api-key`, and `project-id`.');
  }
}

function readConfigValue(config: CliConfig, key: ConfigActionKey): string | undefined {
  if (key === 'base-url') {
    return config.baseUrl;
  }
  if (key === 'api-key') {
    return config.apiKey;
  }
  return config.projectId;
}

function writeConfigValue(config: CliConfig, key: ConfigActionKey, value: string): CliConfig {
  if (key === 'base-url') {
    return { ...config, baseUrl: value };
  }
  if (key === 'api-key') {
    return { ...config, apiKey: value };
  }
  return { ...config, projectId: value };
}

function clearConfigValue(config: CliConfig, key: ConfigActionKey): CliConfig {
  if (key === 'base-url') {
    return { ...config, baseUrl: undefined };
  }
  if (key === 'api-key') {
    return { ...config, apiKey: undefined };
  }
  return { ...config, projectId: undefined, projectName: undefined };
}

function requireProjectId(config: CliConfig, options: ParsedArgs['options']): string {
  const projectId = resolveProjectId(config, getStringOption(options, 'project-id'));
  assertValue(projectId, 'project ID (pass --project-id or set a default with `zf projects use`)');
  return projectId;
}

function inferProvider(repository?: string): string | undefined {
  if (!repository) {
    return undefined;
  }
  if (repository.includes('github.com')) {
    return 'GITHUB';
  }
  return undefined;
}

function maskApiKey(value: string): string {
  if (value.length <= 8) {
    return '********';
  }

  return `${value.slice(0, 6)}...${value.slice(-4)}`;
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  printError(message);
  process.exitCode = 1;
});
