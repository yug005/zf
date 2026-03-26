import { resolveApiKey, resolveBaseUrl, type CliConfig } from './config.js';

type RequestOptions = {
  method?: 'GET' | 'POST' | 'PATCH';
  body?: unknown;
  auth?: boolean;
  apiKey?: string;
  baseUrl?: string;
};

export class ZfApiClient {
  constructor(private readonly config: CliConfig) {}

  async getHealth(baseUrl?: string): Promise<unknown> {
    return this.request('/health', { auth: false, baseUrl });
  }

  async getMe(options?: Pick<RequestOptions, 'apiKey' | 'baseUrl'>): Promise<any> {
    return this.request('/users/me', options);
  }

  async listProjects(options?: Pick<RequestOptions, 'apiKey' | 'baseUrl'>): Promise<any[]> {
    return this.request('/projects', options);
  }

  async createProject(
    payload: { name: string; slug: string; description?: string },
    options?: Pick<RequestOptions, 'apiKey' | 'baseUrl'>,
  ): Promise<any> {
    return this.request('/projects', { ...options, method: 'POST', body: payload });
  }

  async listMonitors(
    projectId?: string,
    options?: Pick<RequestOptions, 'apiKey' | 'baseUrl'>,
  ): Promise<any[]> {
    const search = projectId ? `?projectId=${encodeURIComponent(projectId)}` : '';
    return this.request(`/monitors${search}`, options);
  }

  async createMonitor(
    payload: Record<string, unknown>,
    options?: Pick<RequestOptions, 'apiKey' | 'baseUrl'>,
  ): Promise<any> {
    return this.request('/monitors', { ...options, method: 'POST', body: payload });
  }

  async pauseMonitor(id: string, options?: Pick<RequestOptions, 'apiKey' | 'baseUrl'>): Promise<any> {
    return this.request(`/monitors/${id}/pause`, { ...options, method: 'PATCH' });
  }

  async resumeMonitor(id: string, options?: Pick<RequestOptions, 'apiKey' | 'baseUrl'>): Promise<any> {
    return this.request(`/monitors/${id}/resume`, { ...options, method: 'PATCH' });
  }

  async reportDeploy(
    payload: Record<string, unknown>,
    options?: Pick<RequestOptions, 'apiKey' | 'baseUrl'>,
  ): Promise<any> {
    return this.request('/changes/ingest/deploy', { ...options, method: 'POST', body: payload });
  }

  private async request(path: string, options?: RequestOptions): Promise<any> {
    const method = options?.method || 'GET';
    const auth = options?.auth !== false;
    const apiKey = resolveApiKey(this.config, options?.apiKey);
    const baseUrl = normalizeBaseUrl(resolveBaseUrl(this.config, options?.baseUrl));

    if (!baseUrl) {
      throw new Error(
        'Base URL is not configured. Run `zf config set base-url https://your-backend` first.',
      );
    }

    if (auth && !apiKey) {
      throw new Error('API key is not configured. Run `zf auth login --api-key <key>` first.');
    }

    const isHealth = path === '/health';
    const url = `${baseUrl}${isHealth ? '' : '/api/v1'}${path}`;
    const headers = new Headers();
    headers.set('accept', 'application/json');
    if (options?.body !== undefined) {
      headers.set('content-type', 'application/json');
    }
    if (auth && apiKey) {
      headers.set('x-api-key', apiKey);
    }

    const response = await fetch(url, {
      method,
      headers,
      body: options?.body !== undefined ? JSON.stringify(options.body) : undefined,
    });

    const rawBody = await response.text();
    const parsedBody = tryParseJson(rawBody);

    if (!response.ok) {
      const message =
        (parsedBody && typeof parsedBody === 'object' && 'message' in parsedBody
          ? (parsedBody as { message?: unknown }).message
          : undefined) ?? rawBody ?? response.statusText;

      throw new Error(`HTTP ${response.status}: ${formatMessage(message)}`);
    }

    return parsedBody ?? rawBody;
  }
}

function normalizeBaseUrl(baseUrl?: string): string | undefined {
  if (!baseUrl) {
    return undefined;
  }

  return baseUrl.replace(/\/+$/, '');
}

function tryParseJson(value: string): unknown {
  if (!value) {
    return null;
  }

  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

function formatMessage(message: unknown): string {
  if (Array.isArray(message)) {
    return message.map((entry) => String(entry)).join(', ');
  }

  return String(message);
}
