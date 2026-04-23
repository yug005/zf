import { Injectable, Logger } from '@nestjs/common';
import axios from 'axios';
import { PrismaService } from '../../../prisma/prisma.service.js';
import { assertSafeTarget, buildSafeLookup } from '../../../common/security/ssrf-guard.js';
import { GUARDRAILS } from '../constants.js';
import type { SecurityScanJobData } from '../constants.js';

const SECURITY_HEADERS = [
  { header: 'strict-transport-security', required: true, severity: 'MEDIUM' as const, title: 'Missing HSTS Header' },
  { header: 'x-content-type-options', required: true, severity: 'LOW' as const, title: 'Missing X-Content-Type-Options' },
  { header: 'x-frame-options', required: true, severity: 'LOW' as const, title: 'Missing X-Frame-Options' },
  { header: 'content-security-policy', required: true, severity: 'MEDIUM' as const, title: 'Missing Content-Security-Policy' },
  { header: 'x-xss-protection', required: false, severity: 'INFORMATIONAL' as const, title: 'Missing X-XSS-Protection (Legacy)' },
  { header: 'referrer-policy', required: true, severity: 'LOW' as const, title: 'Missing Referrer-Policy' },
  { header: 'permissions-policy', required: false, severity: 'LOW' as const, title: 'Missing Permissions-Policy' },
];

const TECH_DISCLOSURE_HEADERS = [
  'x-powered-by', 'server', 'x-aspnet-version', 'x-aspnetmvc-version',
  'x-generator', 'x-drupal-cache', 'x-runtime', 'x-debug',
];

@Injectable()
export class PassiveAnalysisStage {
  private readonly logger = new Logger(PassiveAnalysisStage.name);

  constructor(private readonly prisma: PrismaService) {}

  async execute(data: SecurityScanJobData): Promise<void> {
    const guardrails = data.tier === 'STANDARD' ? GUARDRAILS.STANDARD : GUARDRAILS.ADVANCED;
    const baseUrl = data.baseUrl.replace(/\/+$/, '');

    try {
      const parsedUrl = new URL(baseUrl);
      await assertSafeTarget(parsedUrl);

      const scan = await this.prisma.securityScan.findUnique({
        where: { id: data.scanId },
        include: { target: { include: { assets: { orderBy: { createdAt: 'asc' } } } } },
      });
      if (!scan) {
        throw new Error(`Scan ${data.scanId} not found.`);
      }

      const classification = (((scan.plannerSummary as Record<string, any> | null) ?? {}).classification ?? {}) as Record<string, any>;
      const isDevFrontend = Boolean(classification.isDevFrontend);
      const isLabOnly = Boolean(classification.isLocal || scan.target.environment === 'LAB' || scan.target.environment === 'DEVELOPMENT');
      const targetSurface = String(classification.targetSurface ?? '');
      const rootAsset = scan.target.assets[0] ?? null;

      const response = await axios.get(baseUrl, {
        timeout: guardrails.perRequestTimeoutMs,
        validateStatus: () => true,
        maxRedirects: 5,
        responseType: 'text',
        headers: { 'User-Agent': 'Zer0Friction-SecurityScanner/1.0' },
        lookup: buildSafeLookup() as never,
      });

      const headers = response.headers;
      const contentType = String(headers['content-type'] ?? '').toLowerCase();
      const bodySnippet = String(response.data || '').substring(0, guardrails.maxResponseBodyCapture);
      const isHtmlDocument = contentType.includes('text/html');
      const looksLikeJson = /^(\{|\[)/.test(bodySnippet.trim());
      const pathSuggestsApi = /\/(api|graphql|openapi|swagger)(\/|$|\.)/i.test(parsedUrl.pathname);
      const isApiLikeResponse = !isHtmlDocument && (contentType.includes('json') || looksLikeJson || pathSuggestsApi || targetSurface === 'api');
      const baseEvidencePayload = {
        targetId: data.targetId,
        scanId: data.scanId,
        kind: 'HTTP_TRANSCRIPT' as const,
        contentType: contentType || 'text/plain',
        summary: {
          url: baseUrl,
          statusCode: response.status,
          headers: this.redactHeaders(headers),
        },
        rawPayload: {
          responseSnippet: bodySnippet,
        },
      };

      if (!isDevFrontend) {
        for (const check of SECURITY_HEADERS) {
          const value = headers[check.header];
          if (!value && check.required) {
            const evidence = await this.prisma.securityEvidenceArtifact.create({
              data: {
                ...baseEvidencePayload,
                name: `${check.title} evidence`,
              },
            });
            await this.createObservation({
              scanId: data.scanId,
              targetId: data.targetId,
              evidenceId: evidence.id,
              category: 'HEADER_SECURITY',
              title: check.title,
              severity: check.severity,
              endpoint: '/',
              scenarioPackSlug: 'surface-validation',
              proofType: isLabOnly ? 'HEURISTIC' : 'POLICY_MISMATCH',
              remediation: `Add the ${check.header} header to your server responses.`,
              observation: `The ${check.header} header is missing from the response.`,
              labels: isLabOnly ? ['LAB_ONLY'] : [],
              affectedAssets: rootAsset ? [rootAsset.id] : [],
            });
          }
        }
      }

      for (const headerName of TECH_DISCLOSURE_HEADERS) {
        const value = headers[headerName];
        if (value) {
          const evidence = await this.prisma.securityEvidenceArtifact.create({
            data: {
              ...baseEvidencePayload,
              name: `Technology disclosure evidence for ${headerName}`,
            },
          });
          await this.createObservation({
            scanId: data.scanId,
            targetId: data.targetId,
            evidenceId: evidence.id,
            category: 'TECH_DISCLOSURE',
            title: `Technology Disclosed via ${headerName} Header`,
            severity: 'LOW',
            endpoint: '/',
            scenarioPackSlug: 'surface-validation',
            proofType: 'RESPONSE_MATCH',
            remediation: `Remove or suppress the ${headerName} header in your server configuration.`,
            observation: `The server discloses technology information through the ${headerName} header.`,
            labels: isLabOnly ? ['LAB_ONLY'] : [],
            affectedAssets: rootAsset ? [rootAsset.id] : [],
            extraEvidence: {
              header: headerName,
              value: String(value).substring(0, 200),
            },
          });
        }
      }

      try {
        const corsResponse = await axios.get(baseUrl, {
          timeout: guardrails.perRequestTimeoutMs,
          validateStatus: () => true,
          headers: {
            Origin: 'https://malicious-site.example.com',
            'User-Agent': 'Zer0Friction-SecurityScanner/1.0',
          },
          lookup: buildSafeLookup() as never,
        });

        const acao = corsResponse.headers['access-control-allow-origin'];
        const acac = corsResponse.headers['access-control-allow-credentials'];
        const allowsWildcard = acao === '*';
        const reflectsArbitraryOrigin = acao === 'https://malicious-site.example.com';
        const shouldReportCors = !isDevFrontend && isApiLikeResponse;

        if (shouldReportCors && (allowsWildcard || reflectsArbitraryOrigin)) {
          const corsEvidence = await this.prisma.securityEvidenceArtifact.create({
            data: {
              targetId: data.targetId,
              scanId: data.scanId,
              kind: 'RESPONSE_HEADERS',
              name: 'CORS replay',
              summary: {
                requestOrigin: 'https://malicious-site.example.com',
                responseACAO: acao,
                responseACAC: acac || 'not set',
              },
            },
          });

          await this.createObservation({
            scanId: data.scanId,
            targetId: data.targetId,
            evidenceId: corsEvidence.id,
            category: 'CORS_MISCONFIGURATION',
            title: reflectsArbitraryOrigin ? 'CORS Reflects Arbitrary Origin' : 'Wildcard CORS Origin Allowed',
            severity: acac === 'true' ? 'HIGH' : 'MEDIUM',
            endpoint: '/',
            scenarioPackSlug: 'surface-validation',
            proofType: reflectsArbitraryOrigin ? 'RESPONSE_MATCH' : 'POLICY_MISMATCH',
            remediation: reflectsArbitraryOrigin
              ? 'Validate the Origin header against a whitelist of trusted origins.'
              : 'Configure CORS to explicitly allow only trusted origins. Never use wildcard with credentials.',
            observation: reflectsArbitraryOrigin
              ? 'The server reflects an arbitrary Origin header in Access-Control-Allow-Origin.'
              : 'Wildcard CORS origin allows any site to read API responses.',
            labels: isLabOnly ? ['LAB_ONLY', 'API_DATA_BEARING'] : ['API_DATA_BEARING'],
            affectedAssets: rootAsset ? [rootAsset.id] : [],
            extraEvidence: {
              requestOrigin: 'https://malicious-site.example.com',
              responseACAO: acao,
              responseACAC: acac || 'not set',
            },
          });
        }
      } catch {
        // Skip CORS validation if the target does not respond cleanly.
      }

      if (parsedUrl.protocol === 'http:') {
        const evidence = await this.prisma.securityEvidenceArtifact.create({
          data: {
            ...baseEvidencePayload,
            name: 'HTTP transport posture evidence',
          },
        });
        await this.createObservation({
          scanId: data.scanId,
          targetId: data.targetId,
          evidenceId: evidence.id,
          category: 'TLS_POSTURE',
          title: 'Target Served Over HTTP (No TLS)',
          severity: 'HIGH',
          endpoint: '/',
          scenarioPackSlug: 'surface-validation',
          proofType: 'POLICY_MISMATCH',
          remediation: 'Serve all API endpoints over HTTPS with valid TLS certificates.',
          observation: 'The target URL uses HTTP instead of HTTPS, meaning traffic is unencrypted.',
          labels: isLabOnly ? ['LAB_ONLY'] : [],
          affectedAssets: rootAsset ? [rootAsset.id] : [],
          extraEvidence: { url: baseUrl },
        });
      }

      this.logger.log(`Passive analysis recorded observations for scan ${data.scanId}`);
    } catch (error) {
      this.logger.warn(`Passive analysis failed for scan ${data.scanId}: ${error}`);
    }
  }

  private async createObservation(input: {
    scanId: string;
    targetId: string;
    evidenceId: string;
    category: string;
    title: string;
    severity: string;
    endpoint: string;
    scenarioPackSlug: string;
    proofType: 'HEURISTIC' | 'RESPONSE_MATCH' | 'POLICY_MISMATCH';
    remediation: string;
    observation: string;
    labels: string[];
    affectedAssets: string[];
    extraEvidence?: Record<string, unknown>;
  }) {
    const observation = await this.prisma.securityObservation.create({
      data: {
        scanId: input.scanId,
        targetId: input.targetId,
        category: input.category as never,
        title: input.title,
        severity: input.severity as never,
        exploitability: input.proofType === 'HEURISTIC' ? 'THEORETICAL' : 'PROBABLE',
        confidence: input.proofType === 'HEURISTIC' ? 'MEDIUM' : 'HIGH',
        proofType: input.proofType as never,
        scenarioPackSlug: input.scenarioPackSlug,
        endpoint: input.endpoint,
        httpMethod: 'GET',
        evidenceSummary: {
          observation: input.observation,
          proofType: input.proofType,
          ...input.extraEvidence,
        },
        affectedAssets: input.affectedAssets,
        labels: input.labels,
        remediation: input.remediation,
      },
    });

    await this.prisma.securityEvidenceArtifact.update({
      where: { id: input.evidenceId },
      data: { observationId: observation.id },
    });
  }

  private redactHeaders(headers: Record<string, unknown>): Record<string, string> {
    const safe: Record<string, string> = {};
    const sensitivePatterns = /auth|token|cookie|session|key|secret|credential/i;

    for (const [key, value] of Object.entries(headers)) {
      if (sensitivePatterns.test(key)) {
        safe[key] = '[REDACTED]';
      } else {
        safe[key] = String(value).substring(0, 500);
      }
    }
    return safe;
  }
}
