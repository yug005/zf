/**
 * Queue and Job constants for the monitoring engine.
 */

export const MONITOR_CHECK_QUEUE = 'monitor-check-queue';
export const ALERT_DELIVERY_QUEUE = 'alert-delivery-queue';

export interface KeywordConfig {
  required?: string[];
  forbidden?: string[];
  stripHtml?: boolean;
  matchExact?: boolean;
}

export interface JsonPathValidationRule {
  path: string;
  operator: 'EXISTS' | 'EQUALS' | 'CONTAINS';
  expectedValue?: unknown;
}

export interface ValidationConfigPayload {
  expectedStatus?: number;
  latencyThresholdMs?: number;
  keyword?: KeywordConfig;
  jsonPaths?: JsonPathValidationRule[];
}

export interface AuthRequestTemplatePayload {
  url: string;
  method?: string;
  headers?: Record<string, string>;
  body?: unknown;
}

export interface MultiStepAuthPayload {
  login: AuthRequestTemplatePayload;
  tokenJsonPath: string;
  targetHeader?: string;
  tokenPrefix?: string;
}

export interface AuthConfigPayload {
  type: 'NONE' | 'BEARER' | 'API_KEY' | 'BASIC' | 'MULTI_STEP';
  headerName?: string;
  secretValue?: string;
  username?: string;
  password?: string;
  multiStep?: MultiStepAuthPayload;
}

export interface AlertConfigPayload {
  channels?: string[];
  retryIntervalSeconds?: number;
  recipients?: {
    emails?: string[];
    slackWebhookUrls?: string[];
    telegramChatIds?: string[];
    whatsappNumbers?: string[];
  };
}

/**
 * Payload shape for each monitor check job.
 */
export interface MonitorCheckJobData {
  monitorId: string;
  type: string;
  url: string;
  method: string;
  headers?: Record<string, string>;
  body?: unknown;
  keywordConfig?: KeywordConfig;
  validationConfig?: ValidationConfigPayload;
  authConfig?: AuthConfigPayload;
  timeoutMs: number;
  expectedStatus?: number;
  retries: number;
  alertConfig?: AlertConfigPayload;
  region?: string;
}

/**
 * Result shape returned by the HTTP executor.
 */
export interface CheckExecutionResult {
  success: boolean;
  statusCode?: number;
  responseTimeMs: number;
  errorMessage?: string;
  metadata?: Record<string, any>;
}

/**
 * Payload shape for alert delivery jobs.
 */
export interface AlertDeliveryJobData {
  alertId: string;
  deliveryId?: string;
  monitorId: string;
  monitorName: string;
  monitorUrl: string;
  type: 'TRIGGERED' | 'RESOLVED';
  channel?: string;
  message: string;
  timestamp: string;
  metadata?: Record<string, any>;
}
