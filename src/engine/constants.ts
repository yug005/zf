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
  timeoutMs: number;
  expectedStatus?: number;
  retries: number;
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
  monitorId: string;
  monitorName: string;
  monitorUrl: string;
  type: 'TRIGGERED' | 'RESOLVED';
  message: string;
  timestamp: string;
  metadata?: Record<string, any>;
}
