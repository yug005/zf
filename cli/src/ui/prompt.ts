import { createInterface } from 'node:readline/promises';
import { stdin as input, stdout as output } from 'node:process';

type PromptTextOptions = {
  label: string;
  defaultValue?: string;
  required?: boolean;
};

const RESET = '\u001b[0m';
const DIM = '\u001b[2m';
const CYAN = '\u001b[36m';
const MAGENTA = '\u001b[35m';
const WHITE = '\u001b[37m';

export async function promptText(options: PromptTextOptions): Promise<string> {
  ensureInteractive();
  const rl = createInterface({ input, output });
  try {
    const suffix = options.defaultValue ? ` ${tint(`[default: ${options.defaultValue}]`, DIM + CYAN)}` : '';
    while (true) {
      const value = (await rl.question(`${tint('>', MAGENTA)} ${tint(options.label, WHITE)}${suffix}: `)).trim();
      if (value) {
        return value;
      }
      if (options.defaultValue) {
        return options.defaultValue;
      }
      if (!options.required) {
        return '';
      }
    }
  } finally {
    rl.close();
  }
}

export async function promptConfirm(label: string, defaultValue = true): Promise<boolean> {
  ensureInteractive();
  const rl = createInterface({ input, output });
  try {
    const suffix = defaultValue ? tint('[Y/n]', DIM + CYAN) : tint('[y/N]', DIM + CYAN);
    const answer = (await rl.question(`${tint('>', MAGENTA)} ${tint(label, WHITE)} ${suffix}: `)).trim().toLowerCase();
    if (!answer) {
      return defaultValue;
    }
    return answer === 'y' || answer === 'yes';
  } finally {
    rl.close();
  }
}

export function ensureInteractive(): void {
  if (!input.isTTY || !output.isTTY) {
    throw new Error('Interactive setup requires a TTY. Pass explicit flags instead.');
  }
}

function tint(value: string, code: string): string {
  if (!output.isTTY || process.env.NO_COLOR !== undefined) {
    return value;
  }
  return `${code}${value}${RESET}`;
}
