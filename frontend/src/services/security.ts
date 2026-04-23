import { axiosPrivate } from './api';

// ─── Types ─────────────────────────────────────────────────────────

export interface SecurityTarget {
  id: string;
  name: string;
  baseUrl: string;
  targetKind?: string;
  environment?: string;
  criticality?: string;
  description?: string;
  verificationState: string;
  projectId?: string;
  monitorId?: string;
  freeScanUsed: boolean;
  createdAt: string;
  updatedAt: string;
  verifications?: SecurityVerification[];
  scans?: SecurityScan[];
  assets?: SecurityAsset[];
  collectors?: SecurityCollector[];
  _count?: { scans: number; endpoints: number };
}

export interface SecurityVerification {
  id: string;
  method: string;
  token: string;
  challengeValue?: string;
  state: string;
  verifiedScope?: string;
  completedAt?: string;
  expiresAt?: string;
  message?: string;
  expectedRecord?: string;
  hostname?: string;
  challengeUrl?: string;
  instructions?: {
    type: 'DNS_TXT' | 'HTTP_TOKEN';
    summary: string;
    note: string;
    record?: {
      type: 'TXT';
      name: string;
      value: string;
    };
    fileContent?: string;
    url?: string;
  } | null;
}

export interface SecurityScan {
  id: string;
  tier: string;
  executionMode?: string;
  status: string;
  stage: string;
  stageProgress?: { currentStage: string; completedStages: number; totalStages: number };
  score?: number;
  riskLevel?: string;
  severityCounts?: { critical: number; high: number; medium: number; low: number; informational: number };
  summary?: string;
  startedAt?: string;
  completedAt?: string;
  createdAt: string;
  errorMessage?: string;
  targetSnapshot?: any;
  reportMetadata?: any;
}

export interface SecurityFinding {
  id: string;
  category: string;
  title: string;
  severity: string;
  exploitability: string;
  confidence: string;
  endpoint?: string;
  httpMethod?: string;
  parameter?: string;
  attackFlow?: any;
  evidence?: any;
  validationState?: string;
  affectedAssets?: string[];
  attckTechniques?: string[];
  labels?: string[];
  scenarioPackSlug?: string;
  businessAsset?: string;
  remediation?: string;
  references?: string[];
  falsePositive: boolean;
  fpNotes?: string;
  status: string;
  fingerprint?: string;
  createdAt: string;
}

export interface SecurityAsset {
  id: string;
  kind: string;
  name: string;
  hostname?: string;
  address?: string;
  environment?: string;
  criticality?: string;
  reachability?: string;
  metadata?: any;
}

export interface SecurityCollector {
  id: string;
  name: string;
  status: string;
  environment?: string;
  capabilities?: any;
  allowlist?: any;
  policy?: any;
  lastHeartbeatAt?: string;
}

export interface SecurityAttackPath {
  id: string;
  title: string;
  summary?: string;
  score: number;
  techniqueChain?: string[];
  prerequisiteNodes?: any[];
  pathNodes?: any[];
  metadata?: any;
}

export interface SecurityEvidenceArtifact {
  id: string;
  kind: string;
  name: string;
  contentType?: string;
  summary?: any;
  rawPayload?: any;
  createdAt: string;
}

export interface SecurityControlVerdict {
  id: string;
  control: string;
  status: string;
  expected?: any;
  observed?: any;
  detectionSource?: string;
}

export interface SecurityEntitlement {
  plan: string;
  status: string;
  freeScanQuota: number;
  freeScanUsed: number;
  freeScanRemaining: number;
  maxTargets: number;
  currentTargets: number;
  capabilities: {
    standardScan: boolean;
    standardRecurring: boolean;
    advancedScan: boolean;
    allowedCadences: string[];
  };
}

export interface ComplianceControl {
  framework: string;
  controlId: string;
  controlTitle: string;
  description: string;
}

export interface ComplianceMapping {
  category: string;
  controls: ComplianceControl[];
}

export interface ComplianceScore {
  framework: string;
  totalControls: number;
  passedControls: number;
  failedControls: number;
  partialControls: number;
  score: number;
  controlDetails: Array<{
    controlId: string;
    controlTitle: string;
    status: 'PASS' | 'FAIL' | 'PARTIAL' | 'NOT_TESTED';
    relatedFindings: number;
    severity: string;
  }>;
}

export interface RemediationItem {
  findingId: string;
  title: string;
  category: string;
  severity: string;
  exploitability: string;
  endpoint: string | null;
  remediation: string;
  priorityScore: number;
  isValidated: boolean;
  isFixFirst: boolean;
}

export interface AssetTopology {
  nodes: Array<{
    id: string;
    kind: string;
    name: string;
    hostname?: string;
    criticality?: string;
    reachability?: string;
    environment?: string;
    riskLevel: string;
    findingCount: number;
  }>;
  edges: Array<{
    id: string;
    from: string;
    to: string;
    kind: string;
    confidence?: string;
  }>;
}

export interface HistoricalComparison {
  isFirstScan: boolean;
  previousScanId?: string;
  previousScanDate?: string;
  scoreDelta?: number;
  severityDelta?: { critical: number; high: number; medium: number; low: number };
  newFindings?: Array<{ id: string; title: string; severity: string; category: string }>;
  resolvedFindings?: Array<{ id: string; title: string; severity: string; category: string }>;
  escalatedFindings?: Array<{ id: string; title: string; from: string; to: string }>;
  deescalatedFindings?: Array<{ id: string; title: string; from: string; to: string }>;
  persistentFindings?: number;
  regressions?: Array<{ id: string; title: string; severity: string; category: string }>;
  summary?: string;
}

export interface SecurityReport {
  scan: SecurityScan;
  target: SecurityTarget;
  findings: SecurityFinding[];
  endpointInventory: any[];
  assets: SecurityAsset[];
  assetTopology?: AssetTopology;
  attackPaths: SecurityAttackPath[];
  evidenceArtifacts: SecurityEvidenceArtifact[];
  controlVerdicts: SecurityControlVerdict[];
  reportMetadata: any;
  trendHistory: SecurityScan[];
  complianceMappings?: ComplianceMapping[];
  complianceScores?: ComplianceScore[];
  remediationQueue?: RemediationItem[];
  historicalComparison?: HistoricalComparison;
}

// ─── API Functions ─────────────────────────────────────────────────

export const securityApi = {
  // Targets
  createTarget: (data: { name: string; baseUrl: string; description?: string; projectId?: string; targetKind?: string; environment?: string; criticality?: string; metadata?: Record<string, unknown> }) =>
    axiosPrivate.post<SecurityTarget>('/security/targets', data).then(r => r.data),

  listTargets: () =>
    axiosPrivate.get<SecurityTarget[]>('/security/targets').then(r => r.data),

  getTarget: (id: string) =>
    axiosPrivate.get<SecurityTarget>(`/security/targets/${id}`).then(r => r.data),

  getAssets: (id: string) =>
    axiosPrivate.get<SecurityAsset[]>(`/security/targets/${id}/assets`).then(r => r.data),

  getCollectors: (id: string) =>
    axiosPrivate.get<SecurityCollector[]>(`/security/targets/${id}/collectors`).then(r => r.data),

  createCollector: (id: string, data: { name: string; environment?: string; capabilities?: Record<string, unknown>; allowlist?: Record<string, unknown>; policy?: Record<string, unknown> }) =>
    axiosPrivate.post<SecurityCollector>(`/security/targets/${id}/collectors`, data).then(r => r.data),

  getScenarioPacks: (id: string) =>
    axiosPrivate.get<any[]>(`/security/targets/${id}/scenario-packs`).then(r => r.data),

  updateTarget: (id: string, data: Partial<{ name: string; description: string }>) =>
    axiosPrivate.patch<SecurityTarget>(`/security/targets/${id}`, data).then(r => r.data),

  deleteTarget: (id: string) =>
    axiosPrivate.delete(`/security/targets/${id}`).then(r => r.data),

  // Verification
  createVerification: (targetId: string, data: { method: string }) =>
    axiosPrivate.post<SecurityVerification>(`/security/targets/${targetId}/verify`, data).then(r => r.data),

  checkVerification: (targetId: string, verificationId?: string) =>
    axiosPrivate.post<SecurityVerification>(`/security/targets/${targetId}/verify/check`, { verificationId }).then(r => r.data),

  // Scans
  initiateScan: (targetId: string, data: { tier: string; cadence?: string; enabledCategories?: string[]; executionMode?: string; assetScope?: Record<string, unknown>; authenticatedContext?: Record<string, unknown> }) =>
    axiosPrivate.post<SecurityScan>(`/security/targets/${targetId}/scans`, data).then(r => r.data),

  listScans: (targetId: string) =>
    axiosPrivate.get<SecurityScan[]>(`/security/targets/${targetId}/scans`).then(r => r.data),

  getScan: (scanId: string) =>
    axiosPrivate.get<SecurityScan>(`/security/scans/${scanId}`).then(r => r.data),

  replayScan: (scanId: string) =>
    axiosPrivate.post<SecurityScan>(`/security/scans/${scanId}/replay`).then(r => r.data),

  // Reports
  getReport: (scanId: string) =>
    axiosPrivate.get<SecurityReport>(`/security/scans/${scanId}/report`).then(r => r.data),

  getAttackPaths: (scanId: string) =>
    axiosPrivate.get<SecurityAttackPath[]>(`/security/scans/${scanId}/attack-paths`).then(r => r.data),

  getEvidence: (scanId: string) =>
    axiosPrivate.get<SecurityEvidenceArtifact[]>(`/security/scans/${scanId}/evidence`).then(r => r.data),

  getFindings: (scanId: string, filters?: { severity?: string; category?: string; status?: string }) =>
    axiosPrivate.get<SecurityFinding[]>(`/security/scans/${scanId}/findings`, { params: filters }).then(r => r.data),

  updateFinding: (findingId: string, data: { status?: string; falsePositive?: boolean; fpNotes?: string }) =>
    axiosPrivate.patch<SecurityFinding>(`/security/findings/${findingId}`, data).then(r => r.data),

  // Cadence
  setCadence: (targetId: string, data: { cadence: string; tier: string }) =>
    axiosPrivate.post(`/security/targets/${targetId}/cadence`, data).then(r => r.data),

  removeCadence: (targetId: string) =>
    axiosPrivate.delete(`/security/targets/${targetId}/cadence`).then(r => r.data),

  // Entitlement
  getEntitlement: () =>
    axiosPrivate.get<SecurityEntitlement>('/security/entitlement').then(r => r.data),

  // Linking
  linkTarget: (targetId: string, data: { projectId?: string; monitorId?: string }) =>
    axiosPrivate.post(`/security/targets/${targetId}/link`, data).then(r => r.data),

  unlinkTarget: (targetId: string) =>
    axiosPrivate.delete(`/security/targets/${targetId}/link`).then(r => r.data),
};
