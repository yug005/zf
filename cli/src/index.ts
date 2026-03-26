import { loadConfig, saveConfig, getConfigPath, resolveApiKey, resolveBaseUrl } from './config.js';
import { printJson, printTable, formatDate } from './format.js';
import { ZfApiClient } from './http.js';

type ParsedArgs = {
  positionals: string[];
  options: Record<string, string | boolean>;
};

async function main(): Promise<void> {
  const parsed = parseArgs(process.argv.slice(2));
  const [group = 'help', action, ...rest] = parsed.positionals;
  const config = await loadConfig();
  const client = new ZfApiClient(config);

  switch (group) {
    case 'help':
    case '--help':
    case '-h':
      return printHelp();
    case 'status':
      return handleStatus(client, config, parsed.options);
    case 'config':
      return handleConfig(config, action, rest, parsed.options);
    case 'auth':
      return handleAuth(client, config, action, parsed.options);
    case 'projects':
      return handleProjects(client, action, parsed.options);
    case 'monitors':
      return handleMonitors(client, action, parsed.options);
    case 'deploy':
      return handleDeploy(client, action, parsed.options);
    default:
      throw new Error(`Unknown command group: ${group}. Run \`zf help\` for usage.`);
  }
}

async function handleStatus(
  client: ZfApiClient,
  config: Awaited<ReturnType<typeof loadConfig>>,
  options: ParsedArgs['options'],
): Promise<void> {
  const baseUrl = getStringOption(options, 'base-url') || resolveBaseUrl(config);
  const health = await client.getHealth(baseUrl);
  if (hasJsonFlag(options)) {
    return printJson(health);
  }
  console.log(`Backend: ${baseUrl || '(not configured)'}`);
  console.log('Health:');
  printJson(health);
}

async function handleConfig(
  config: Awaited<ReturnType<typeof loadConfig>>,
  action: string | undefined,
  rest: string[],
  options: ParsedArgs['options'],
): Promise<void> {
  switch (action) {
    case 'show':
    case undefined:
      if (hasJsonFlag(options)) {
        return printJson({ path: getConfigPath(), config });
      }
      console.log(`Config path: ${getConfigPath()}`);
      printTable([
        { key: 'base-url', value: config.baseUrl || '-' },
        { key: 'api-key', value: config.apiKey ? maskApiKey(config.apiKey) : '-' },
      ]);
      return;
    case 'get': {
      const key = rest[0];
      assertValue(key, 'config key');
      const value = key === 'api-key' ? config.apiKey : key === 'base-url' ? config.baseUrl : undefined;
      if (value === undefined) {
        throw new Error(`Unknown config key: ${key}`);
      }
      console.log(key === 'api-key' ? maskApiKey(value) : value);
      return;
    }
    case 'set': {
      const key = rest[0];
      const value = rest[1];
      assertValue(key, 'config key');
      assertValue(value, 'config value');
      if (key !== 'api-key' && key !== 'base-url') {
        throw new Error('Supported config keys are `base-url` and `api-key`.');
      }
      const nextConfig = { ...config, [key === 'base-url' ? 'baseUrl' : 'apiKey']: value };
      await saveConfig(nextConfig);
      console.log(`Saved ${key} to ${getConfigPath()}`);
      return;
    }
    case 'clear': {
      const key = rest[0];
      assertValue(key, 'config key');
      if (key !== 'api-key' && key !== 'base-url') {
        throw new Error('Supported config keys are `base-url` and `api-key`.');
      }
      const nextConfig = {
        ...config,
        [key === 'base-url' ? 'baseUrl' : 'apiKey']: undefined,
      };
      await saveConfig(nextConfig);
      console.log(`Cleared ${key} in ${getConfigPath()}`);
      return;
    }
    default:
      throw new Error('Usage: zf config [show|get|set|clear] ...');
  }
}

async function handleAuth(
  client: ZfApiClient,
  config: Awaited<ReturnType<typeof loadConfig>>,
  action: string | undefined,
  options: ParsedArgs['options'],
): Promise<void> {
  switch (action) {
    case 'login': {
      const apiKey = getRequiredOption(options, 'api-key');
      const baseUrl = getStringOption(options, 'base-url') || resolveBaseUrl(config);
      assertValue(baseUrl, 'base URL (pass --base-url or configure it first)');
      const me = await client.getMe({ baseUrl, apiKey });
      await saveConfig({
        ...config,
        apiKey,
        baseUrl,
      });
      console.log(`Authenticated as ${me.email}`);
      console.log(`Saved credentials to ${getConfigPath()}`);
      return;
    }
    case 'whoami': {
      const me = await client.getMe();
      if (hasJsonFlag(options)) {
        return printJson(me);
      }
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
  action: string | undefined,
  options: ParsedArgs['options'],
): Promise<void> {
  switch (action) {
    case 'list': {
      const projects = await client.listProjects();
      if (hasJsonFlag(options)) {
        return printJson(projects);
      }
      printTable(
        projects.map((project) => ({
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
        return printJson(project);
      }
      console.log(`Created project ${project.name} (${project.id})`);
      console.log(`Slug: ${project.slug}`);
      return;
    }
    default:
      throw new Error('Usage: zf projects <list|create> [options]');
  }
}

async function handleMonitors(
  client: ZfApiClient,
  action: string | undefined,
  options: ParsedArgs['options'],
): Promise<void> {
  switch (action) {
    case 'list': {
      const monitors = await client.listMonitors(getStringOption(options, 'project-id'));
      if (hasJsonFlag(options)) {
        return printJson(monitors);
      }
      printTable(
        monitors.map((monitor) => ({
          id: monitor.id,
          name: monitor.name,
          status: monitor.status,
          type: monitor.type,
          interval: `${monitor.intervalSeconds}s`,
          url: monitor.url,
        })),
      );
      return;
    }
    case 'create': {
      const payload: Record<string, unknown> = {
        projectId: getRequiredOption(options, 'project-id'),
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
        return printJson(monitor);
      }
      console.log(`Created monitor ${monitor.name} (${monitor.id})`);
      console.log(`URL: ${monitor.url}`);
      return;
    }
    case 'pause': {
      const id = getRequiredOption(options, 'id');
      await client.pauseMonitor(id);
      console.log(`Paused monitor ${id}`);
      return;
    }
    case 'resume': {
      const id = getRequiredOption(options, 'id');
      await client.resumeMonitor(id);
      console.log(`Resumed monitor ${id}`);
      return;
    }
    default:
      throw new Error('Usage: zf monitors <list|create|pause|resume> [options]');
  }
}

async function handleDeploy(
  client: ZfApiClient,
  action: string | undefined,
  options: ParsedArgs['options'],
): Promise<void> {
  if (action !== 'report') {
    throw new Error('Usage: zf deploy report [options]');
  }

  const payload: Record<string, unknown> = {
    provider: getStringOption(options, 'provider') || 'API',
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

  const metadata = parseJsonOption<Record<string, unknown>>(options, 'metadata');
  if (metadata) {
    payload.metadata = metadata;
  }

  if (!payload.projectId && !payload.projectSlug) {
    throw new Error('Deploy reporting requires either --project-id or --project-slug.');
  }

  const result = await client.reportDeploy(payload);
  if (hasJsonFlag(options)) {
    return printJson(result);
  }
  console.log('Deploy event reported successfully.');
  printJson(result);
}

function printHelp(): void {
  console.log(`Zer0Friction CLI

Usage:
  zf status
  zf config show
  zf config set base-url <url>
  zf config set api-key <key>
  zf auth login --base-url <url> --api-key <key>
  zf auth whoami
  zf projects list [--json]
  zf projects create --name <name> --slug <slug> [--description <text>]
  zf monitors list [--project-id <id>] [--json]
  zf monitors create --project-id <id> --name <name> --url <url> [--type HTTP]
  zf monitors pause --id <monitor-id>
  zf monitors resume --id <monitor-id>
  zf deploy report --project-id <id> [--service <name>] [--environment production]

Global config:
  Stored at ~/.zer0friction/config.json
  Env overrides: ZF_BASE_URL, ZF_API_KEY
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

function maskApiKey(value: string): string {
  if (value.length <= 8) {
    return '********';
  }

  return `${value.slice(0, 6)}...${value.slice(-4)}`;
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`Error: ${message}`);
  process.exitCode = 1;
});
