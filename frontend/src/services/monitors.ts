import { axiosPrivate } from './api';

export interface CheckDiagnosis {
  code: string;
  summary: string;
  detail: string;
  confidence: number;
  suggestedAction?: string;
  isLikelyOutage: boolean;
}

export interface MonitorImpactMetadata {
  serviceName?: string | null;
  featureName?: string | null;
  customerJourney?: string | null;
  teamOwner?: string | null;
  region?: string | null;
  businessCriticality: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  slaTier: 'STANDARD' | 'PREMIUM' | 'ENTERPRISE';
}

export interface Monitor {
  id: string;
  name: string;
  url: string;
  httpMethod: string;
  type: 'HTTP' | 'TCP' | 'DNS' | 'SSL';
  status: 'UP' | 'DOWN' | 'PAUSED' | 'DEGRADED';
  metadata?: any;
  impactMetadata?: MonitorImpactMetadata;
  intervalSeconds: number;
  timeoutMs: number;
  lastCheckedAt?: string | null;
  avgResponseTimeMs?: number | null;
  latestResponseTimeMs?: number | null;
  uptimePercentage?: number | null;
  latestStatusCode?: number | null;
  lastErrorMessage?: string | null;
  latestDiagnosis?: CheckDiagnosis | null;
  body?: any;
  authConfig?: any;
  validationConfig?: any;
  alertConfig?: any;
  probeRegions?: string[];
  latestResponseSnippet?: string | null;
  latestCheckMetadata?: Record<string, unknown> | null;
}

export interface CreateMonitorPayload {
  name: string;
  url: string;
  httpMethod: string;
  type: 'HTTP' | 'TCP' | 'DNS' | 'SSL';
  serviceName?: string;
  featureName?: string;
  customerJourney?: string;
  teamOwner?: string;
  region?: string;
  businessCriticality?: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  slaTier?: 'STANDARD' | 'PREMIUM' | 'ENTERPRISE';
  intervalSeconds: number;
  timeoutMs: number;
  projectId: string;
  body?: any;
  expectedStatus?: number;
  retries?: number;
  authConfig?: any;
  validationConfig?: any;
  alertConfig?: any;
  probeRegions?: string[];
}

export interface TestMonitorPayload {
  url: string;
  httpMethod?: string;
  headers?: Record<string, string>;
  body?: unknown;
  timeoutMs?: number;
  authConfig?: any;
  validationConfig?: any;
}

export interface TestMonitorResult {
  success: boolean;
  statusCode: number | null;
  responseTimeMs: number;
  errorMessage: string | null;
  metadata: Record<string, unknown> | null;
}

export const fetchMonitors = async (): Promise<Monitor[]> => {
  const { data } = await axiosPrivate.get<Monitor[]>('/monitors');
  return Array.isArray(data) ? data : [];
};

export const createMonitor = async (payload: CreateMonitorPayload): Promise<Monitor> => {
  const { data } = await axiosPrivate.post<Monitor>('/monitors', payload);
  return data;
};

export const deleteMonitor = async (id: string): Promise<void> => {
  await axiosPrivate.delete(`/monitors/${id}`);
};

export const updateMonitor = async ({ id, ...payload }: Partial<CreateMonitorPayload> & { id: string }): Promise<Monitor> => {
   const { data } = await axiosPrivate.patch<Monitor>(`/monitors/${id}`, payload);
   return data;
};

export const toggleMonitorPause = async ({ id, isPaused }: { id: string; isPaused: boolean }): Promise<void> => {
  const endpoint = isPaused ? `/monitors/${id}/resume` : `/monitors/${id}/pause`;
  await axiosPrivate.patch(endpoint);
};

export const testMonitorConfiguration = async (
  payload: TestMonitorPayload,
): Promise<TestMonitorResult> => {
  const { data } = await axiosPrivate.post<TestMonitorResult>('/monitors/test-config', payload);
  return data;
};
