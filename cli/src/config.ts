import { homedir } from 'node:os';
import { dirname, join } from 'node:path';
import { mkdir, readFile, writeFile } from 'node:fs/promises';

export type CliConfig = {
  baseUrl?: string;
  apiKey?: string;
};

const CONFIG_DIR = join(homedir(), '.zer0friction');
const CONFIG_PATH = join(CONFIG_DIR, 'config.json');

export async function loadConfig(): Promise<CliConfig> {
  try {
    const raw = await readFile(CONFIG_PATH, 'utf8');
    const parsed = JSON.parse(raw) as CliConfig;
    return {
      baseUrl: parsed.baseUrl?.trim(),
      apiKey: parsed.apiKey?.trim(),
    };
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code;
    if (code === 'ENOENT') {
      return {};
    }
    throw error;
  }
}

export async function saveConfig(config: CliConfig): Promise<void> {
  await mkdir(dirname(CONFIG_PATH), { recursive: true });
  await writeFile(CONFIG_PATH, `${JSON.stringify(config, null, 2)}\n`, 'utf8');
}

export function getConfigPath(): string {
  return CONFIG_PATH;
}

export function resolveBaseUrl(config: CliConfig, explicit?: string): string | undefined {
  return explicit?.trim() || process.env.ZF_BASE_URL?.trim() || config.baseUrl?.trim();
}

export function resolveApiKey(config: CliConfig, explicit?: string): string | undefined {
  return explicit?.trim() || process.env.ZF_API_KEY?.trim() || config.apiKey?.trim();
}
