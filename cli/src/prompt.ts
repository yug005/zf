import { createInterface } from 'node:readline/promises';
import { stdin as input, stdout as output } from 'node:process';

type PromptTextOptions = {
  label: string;
  defaultValue?: string;
  required?: boolean;
};

export async function promptText(options: PromptTextOptions): Promise<string> {
  ensureInteractive();
  const rl = createInterface({ input, output });
  try {
    const suffix = options.defaultValue ? ` [${options.defaultValue}]` : '';
    while (true) {
      const value = (await rl.question(`${options.label}${suffix}: `)).trim();
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
    const suffix = defaultValue ? ' [Y/n]' : ' [y/N]';
    const answer = (await rl.question(`${label}${suffix}: `)).trim().toLowerCase();
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
