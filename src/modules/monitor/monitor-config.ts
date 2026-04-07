export type AuthType = 'NONE' | 'BEARER' | 'API_KEY' | 'BASIC' | 'MULTI_STEP';
export type JsonPathOperator = 'EXISTS' | 'EQUALS' | 'CONTAINS';

export type AuthRequestTemplate = {
  url: string;
  method?: string;
  headers?: Record<string, string>;
  body?: unknown;
};

export type MultiStepAuthConfig = {
  login: AuthRequestTemplate;
  tokenJsonPath: string;
  targetHeader?: string;
  tokenPrefix?: string;
};

export type AuthConfig = {
  type: AuthType;
  secretId?: string;
  secretValue?: string;
  usernameSecretId?: string;
  username?: string;
  passwordSecretId?: string;
  password?: string;
  headerName?: string;
  multiStep?: MultiStepAuthConfig;
};

export type KeywordValidationConfig = {
  required?: string[];
  forbidden?: string[];
  stripHtml?: boolean;
  matchExact?: boolean;
};

export type JsonPathRule = {
  path: string;
  operator: JsonPathOperator;
  expectedValue?: unknown;
};

export type ValidationConfig = {
  expectedStatus?: number;
  latencyThresholdMs?: number;
  keyword?: KeywordValidationConfig;
  jsonPaths?: JsonPathRule[];
};

export type AlertRecipients = {
  emails?: string[];
  slackWebhookUrls?: string[];
  telegramChatIds?: string[];
  whatsappNumbers?: string[];
};

export type AlertConfig = {
  channels?: string[];
  failureThreshold?: number;
  retryIntervalSeconds?: number;
  recipients?: AlertRecipients;
};

export type PublicStatusConfig = {
  enabled?: boolean;
  mode?: 'SIMPLE' | 'ADVANCED';
};

export function normalizeAuthConfig(input?: Partial<AuthConfig> | null): AuthConfig | null {
  if (!input?.type) {
    return null;
  }

  return {
    type: input.type,
    secretId: input.secretId,
    secretValue: input.secretValue,
    usernameSecretId: input.usernameSecretId,
    username: input.username,
    passwordSecretId: input.passwordSecretId,
    password: input.password,
    headerName: input.headerName,
    multiStep: input.multiStep
      ? {
          login: {
            url: input.multiStep.login.url,
            method: input.multiStep.login.method ?? 'POST',
            headers: input.multiStep.login.headers ?? {},
            body: input.multiStep.login.body,
          },
          tokenJsonPath: input.multiStep.tokenJsonPath,
          targetHeader: input.multiStep.targetHeader ?? 'Authorization',
          tokenPrefix: input.multiStep.tokenPrefix ?? 'Bearer ',
        }
      : undefined,
  };
}

export function normalizeValidationConfig(
  input?: Partial<ValidationConfig> | null,
): ValidationConfig | null {
  if (!input) {
    return null;
  }

  return {
    expectedStatus: input.expectedStatus,
    latencyThresholdMs: input.latencyThresholdMs,
    keyword: input.keyword
      ? {
          required: input.keyword.required ?? [],
          forbidden: input.keyword.forbidden ?? [],
          stripHtml: Boolean(input.keyword.stripHtml),
          matchExact: Boolean(input.keyword.matchExact),
        }
      : undefined,
    jsonPaths: input.jsonPaths?.filter((rule) => rule?.path && rule?.operator) ?? [],
  };
}

export function normalizeAlertConfig(input?: Partial<AlertConfig> | null): AlertConfig | null {
  if (!input) {
    return null;
  }

  return {
    channels: input.channels?.length ? [...new Set(input.channels)] : undefined,
    failureThreshold: input.failureThreshold,
    retryIntervalSeconds: input.retryIntervalSeconds,
    recipients: input.recipients
      ? {
          emails: input.recipients.emails ?? [],
          slackWebhookUrls: input.recipients.slackWebhookUrls ?? [],
          telegramChatIds: input.recipients.telegramChatIds ?? [],
          whatsappNumbers: input.recipients.whatsappNumbers ?? [],
        }
      : undefined,
  };
}

export function extractJsonPathValue(payload: unknown, path: string): unknown {
  if (!path) {
    return undefined;
  }

  const normalized = path.replace(/^\$\./, '').replace(/^\$/, '');
  if (!normalized) {
    return payload;
  }

  return normalized.split('.').reduce<unknown>((current, segment) => {
    if (current === null || current === undefined) {
      return undefined;
    }

    const arrayMatch = /^([^[\]]+)\[(\d+)\]$/.exec(segment);
    if (arrayMatch) {
      const [, key, indexText] = arrayMatch;
      const next = (current as Record<string, unknown>)[key];
      return Array.isArray(next) ? next[Number(indexText)] : undefined;
    }

    return (current as Record<string, unknown>)[segment];
  }, payload);
}

export function recursivelyInterpolate(
  value: unknown,
  variables: Record<string, string>,
): unknown {
  if (typeof value === 'string') {
    return value.replace(/\{\{\s*([^}]+)\s*\}\}/g, (_, token: string) => variables[token.trim()] ?? '');
  }

  if (Array.isArray(value)) {
    return value.map((entry) => recursivelyInterpolate(entry, variables));
  }

  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([key, entry]) => [
        key,
        recursivelyInterpolate(entry, variables),
      ]),
    );
  }

  return value;
}

export function maskSensitiveText(input: string, maxLength = 500): string {
  const truncated = input.length > maxLength ? `${input.slice(0, maxLength)}…` : input;

  return truncated
    .replace(/(authorization["']?\s*[:=]\s*["']?bearer\s+)[a-z0-9._\-]+/gi, '$1***')
    .replace(/(x-api-key["']?\s*[:=]\s*["']?)[^"',\s]+/gi, '$1***')
    .replace(/(api[_-]?key["']?\s*[:=]\s*["']?)[^"',\s]+/gi, '$1***')
    .replace(/(token["']?\s*[:=]\s*["']?)[^"',\s]+/gi, '$1***')
    .replace(/(password["']?\s*[:=]\s*["']?)[^"',\s]+/gi, '$1***')
    .replace(/(cookie["']?\s*[:=]\s*["']?)[^"',\s]+/gi, '$1***');
}
