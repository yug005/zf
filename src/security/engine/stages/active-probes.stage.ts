import { Injectable, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import axios from 'axios';
import { PrismaService } from '../../../prisma/prisma.service.js';
import { assertSafeTarget, buildSafeLookup } from '../../../common/security/ssrf-guard.js';
import { GUARDRAILS } from '../constants.js';
import type { SecurityScanJobData } from '../constants.js';

const INJECTION_PAYLOADS = [
  { payload: "' OR '1'='1", indicator: /sql syntax|mysql|postgres|sqlite|oracle|ORA-\d|pg_query|SQLSTATE|syntax error at|unterminated quoted string|quoted string not properly terminated/i, name: 'SQL Injection', proofType: 'RESPONSE_MATCH' as const },
  { payload: '<script>zf0</script>', indicator: /<script>zf0<\/script>/i, name: 'Reflected XSS', proofType: 'RESPONSE_MATCH' as const },
  { payload: '{{7*7}}', indicator: /49/, name: 'Template Injection', proofType: 'HEURISTIC' as const },
  { payload: '../../../etc/passwd', indicator: /root:.*:0:0/i, name: 'Path Traversal', proofType: 'RESPONSE_MATCH' as const },
  { payload: '${jndi:ldap://127.0.0.1/test}', indicator: /javax|jndi|ldap/i, name: 'Log4Shell Pattern', proofType: 'HEURISTIC' as const },
];

@Injectable()
export class ActiveProbesStage {
  private readonly logger = new Logger(ActiveProbesStage.name);

  constructor(private readonly prisma: PrismaService) {}

  async execute(data: SecurityScanJobData): Promise<void> {
    const guardrails = data.tier === 'STANDARD' ? GUARDRAILS.STANDARD : GUARDRAILS.ADVANCED;
    const baseUrl = data.baseUrl.replace(/\/+$/, '');

    const scan = await this.prisma.securityScan.findUnique({
      where: { id: data.scanId },
      include: { target: { include: { assets: true } } },
    });
    if (!scan) {
      throw new Error(`Scan ${data.scanId} not found.`);
    }

    const classification = (((scan.plannerSummary as Record<string, any> | null) ?? {}).classification ?? {}) as Record<string, any>;
    const isLabOnly = Boolean(classification.isLocal || scan.target.environment === 'LAB' || scan.target.environment === 'DEVELOPMENT');
    const rootAsset = scan.target.assets[0] ?? null;

    const endpoints = await this.prisma.securityEndpointInventory.findMany({
      where: { targetId: data.targetId, scanId: data.scanId },
      orderBy: { confidence: 'desc' },
      take: data.tier === 'ADVANCED' || data.tier === 'EMULATION' || data.tier === 'CONTINUOUS_VALIDATION' ? 30 : 15,
    });

    let requestCount = 0;
    const maxRequests = guardrails.maxRequestsPerScan / 2;

    for (const ep of endpoints) {
      if (requestCount >= maxRequests) break;

      const url = `${baseUrl}${ep.path}`;

      for (const test of INJECTION_PAYLOADS) {
        if (requestCount >= maxRequests) break;

        try {
          const parsedUrl = new URL(`${url}?q=${encodeURIComponent(test.payload)}`);
          await assertSafeTarget(parsedUrl);

          const response = await axios.get(parsedUrl.toString(), {
            timeout: guardrails.perRequestTimeoutMs,
            validateStatus: () => true,
            maxRedirects: 3,
            maxContentLength: guardrails.maxResponseSize,
            responseType: 'text',
            headers: { 'User-Agent': 'Zer0Friction-SecurityScanner/1.0' },
            lookup: buildSafeLookup() as never,
          });
          requestCount++;

          const body = String(response.data || '').substring(0, guardrails.maxResponseBodyCapture);
          if (!test.indicator.test(body)) {
            continue;
          }

          const evidence = await this.prisma.securityEvidenceArtifact.create({
            data: {
              targetId: data.targetId,
              scanId: data.scanId,
              kind: 'REQUEST_REPLAY',
              name: `${test.name} replay for ${ep.path}`,
              summary: {
                payload: test.payload,
                statusCode: response.status,
                endpoint: ep.path,
              },
              rawPayload: {
                responseSnippet: body.substring(0, 500),
              },
            },
          });

          await this.createObservation({
            scanId: data.scanId,
            targetId: data.targetId,
            evidenceId: evidence.id,
            category: 'INJECTION_DETECTION',
            title: `Possible ${test.name} Detected`,
            severity: test.name.includes('SQL') || test.name.includes('Path') ? 'CRITICAL' : 'HIGH',
            exploitability: test.proofType === 'RESPONSE_MATCH' ? 'PROBABLE' : 'THEORETICAL',
            confidence: test.proofType === 'RESPONSE_MATCH' ? 'HIGH' : 'MEDIUM',
            proofType: test.proofType,
            endpoint: ep.path,
            parameter: 'q',
            scenarioPackSlug: test.name === 'Log4Shell Pattern' ? 'cloud-and-perimeter' : 'api-exposure',
            remediation: 'Sanitize and parameterize all user inputs. Use prepared statements for database queries.',
            observation: `Response contains patterns indicative of ${test.name}.`,
            labels: isLabOnly ? ['LAB_ONLY'] : [],
            affectedAssets: rootAsset ? [rootAsset.id] : [],
            attackFlow: {
              steps: [
                { action: 'Send injection payload in query parameter', payload: test.payload },
                { action: 'Analyze response for indicators', indicator: test.indicator.source },
              ],
            },
          });
        } catch {
          requestCount++;
        }
      }

      if (requestCount >= maxRequests) {
        break;
      }

      try {
        const parsedUrl = new URL(url);
        await assertSafeTarget(parsedUrl);

        const noAuthResponse = await axios.get(url, {
          timeout: guardrails.perRequestTimeoutMs,
          validateStatus: () => true,
          maxRedirects: 3,
          responseType: 'text',
          headers: { 'User-Agent': 'Zer0Friction-SecurityScanner/1.0' },
          lookup: buildSafeLookup() as never,
        });
        requestCount++;

        const body = String(noAuthResponse.data || '');
        const contentType = String(noAuthResponse.headers['content-type'] ?? '').toLowerCase();
        const looksLikeData = body.trim().startsWith('{') || body.trim().startsWith('[');
        const isDataEndpoint = /\/(api|users|admin|config|settings|data|export|graphql|swagger|openapi)/i.test(ep.path);

        if (noAuthResponse.status >= 200 && noAuthResponse.status < 300 && isDataEndpoint && looksLikeData) {
          const evidence = await this.prisma.securityEvidenceArtifact.create({
            data: {
              targetId: data.targetId,
              scanId: data.scanId,
              kind: 'HTTP_TRANSCRIPT',
              name: `Anonymous access replay for ${ep.path}`,
              summary: {
                endpoint: ep.path,
                statusCode: noAuthResponse.status,
                contentType: noAuthResponse.headers['content-type'] ?? null,
              },
              rawPayload: {
                responseSnippet: body.substring(0, 300),
              },
            },
          });

          await this.createObservation({
            scanId: data.scanId,
            targetId: data.targetId,
            evidenceId: evidence.id,
            category: 'AUTH_POSTURE',
            title: 'Data Endpoint Accessible Without Authentication',
            severity: 'HIGH',
            exploitability: 'PROVEN',
            confidence: 'HIGH',
            proofType: 'AUTH_BYPASS',
            endpoint: ep.path,
            scenarioPackSlug: 'api-exposure',
            remediation: 'Add authentication to all data endpoints. Use middleware guards to enforce auth.',
            observation: 'The endpoint responds with data (JSON) without requiring authentication.',
            labels: isLabOnly ? ['LAB_ONLY', 'API_DATA_BEARING'] : ['API_DATA_BEARING', 'CORROBORATED'],
            affectedAssets: rootAsset ? [rootAsset.id] : [],
          });
        }

        const debugEvidence = this.detectDebugExposure(ep.path, noAuthResponse.status, contentType, body);
        if (debugEvidence) {
          const evidence = await this.prisma.securityEvidenceArtifact.create({
            data: {
              targetId: data.targetId,
              scanId: data.scanId,
              kind: 'HTTP_TRANSCRIPT',
              name: `Debug exposure probe for ${ep.path}`,
              summary: {
                endpoint: ep.path,
                statusCode: noAuthResponse.status,
                contentType: contentType || null,
              },
              rawPayload: {
                responseSnippet: body.substring(0, 300),
              },
            },
          });

          await this.createObservation({
            scanId: data.scanId,
            targetId: data.targetId,
            evidenceId: evidence.id,
            category: 'DEBUG_EXPOSURE',
            title: `Debug/Diagnostic Endpoint Exposed: ${ep.path}`,
            severity: 'HIGH',
            exploitability: 'PROVEN',
            confidence: 'HIGH',
            proofType: 'RESPONSE_MATCH',
            endpoint: ep.path,
            scenarioPackSlug: 'cloud-and-perimeter',
            remediation: 'Disable or restrict access to debug/diagnostic endpoints in production.',
            observation: debugEvidence.observation,
            labels: isLabOnly ? ['LAB_ONLY'] : ['CORROBORATED'],
            affectedAssets: rootAsset ? [rootAsset.id] : [],
            extraEvidence: debugEvidence.extraEvidence,
          });
        }

        const sensitivePatterns = [
          { pattern: /password[\s"':=]+[^\s"',]{3,}/i, name: 'Password' },
          { pattern: /api[_-]?key[\s"':=]+[a-zA-Z0-9_\-]{16,}/i, name: 'API Key' },
          { pattern: /secret[\s"':=]+[^\s"',]{8,}/i, name: 'Secret Value' },
          { pattern: /eyJ[a-zA-Z0-9_-]+\.[a-zA-Z0-9_-]+\.[a-zA-Z0-9_-]+/i, name: 'JWT Token' },
          { pattern: /-----BEGIN (?:RSA |EC )?PRIVATE KEY-----/i, name: 'Private Key' },
        ];

        for (const check of sensitivePatterns) {
          if (!check.pattern.test(body)) {
            continue;
          }

          const evidence = await this.prisma.securityEvidenceArtifact.create({
            data: {
              targetId: data.targetId,
              scanId: data.scanId,
              kind: 'HTTP_TRANSCRIPT',
              name: `${check.name} exposure evidence for ${ep.path}`,
              summary: {
                endpoint: ep.path,
                patternMatched: check.name,
                statusCode: noAuthResponse.status,
              },
            },
          });

          await this.createObservation({
            scanId: data.scanId,
            targetId: data.targetId,
            evidenceId: evidence.id,
            category: 'SENSITIVE_DATA_EXPOSURE',
            title: `${check.name} Possibly Exposed in Response`,
            severity: check.name === 'Private Key' ? 'CRITICAL' : 'HIGH',
            exploitability: 'PROVEN',
            confidence: 'HIGH',
            proofType: 'RESPONSE_MATCH',
            endpoint: ep.path,
            scenarioPackSlug: 'identity-and-secrets',
            remediation: `Remove ${check.name.toLowerCase()} values from API responses. Use environment variables and server-side storage.`,
            observation: `Response body contains patterns matching ${check.name}. The actual value has been redacted.`,
            labels: isLabOnly ? ['LAB_ONLY'] : ['CORROBORATED'],
            affectedAssets: rootAsset ? [rootAsset.id] : [],
          });
          break;
        }
      } catch {
        requestCount++;
      }
    }

    this.logger.log(`Active probes completed for scan ${data.scanId} with ${requestCount} requests`);
  }

  private async createObservation(input: {
    scanId: string;
    targetId: string;
    evidenceId: string;
    category: string;
    title: string;
    severity: string;
    exploitability: 'PROVEN' | 'PROBABLE' | 'THEORETICAL';
    confidence: 'HIGH' | 'MEDIUM' | 'LOW';
    proofType: 'HEURISTIC' | 'RESPONSE_MATCH' | 'AUTH_BYPASS';
    endpoint: string;
    parameter?: string;
    scenarioPackSlug: string;
    remediation: string;
    observation: string;
    labels: string[];
    affectedAssets: string[];
    attackFlow?: Record<string, unknown>;
    extraEvidence?: Record<string, unknown>;
  }) {
    const observation = await this.prisma.securityObservation.create({
      data: {
        scanId: input.scanId,
        targetId: input.targetId,
        category: input.category as never,
        title: input.title,
        severity: input.severity as never,
        exploitability: input.exploitability as never,
        confidence: input.confidence as never,
        proofType: input.proofType as never,
        scenarioPackSlug: input.scenarioPackSlug,
        endpoint: input.endpoint,
        httpMethod: 'GET',
        parameter: input.parameter,
        evidenceSummary: {
          observation: input.observation,
          proofType: input.proofType,
          attackFlow: input.attackFlow,
          ...(input.extraEvidence ?? {}),
        } as Prisma.InputJsonValue,
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

  private detectDebugExposure(path: string, statusCode: number, contentType: string, body: string) {
    if (statusCode < 200 || statusCode >= 400) {
      return null;
    }

    const trimmedBody = body.trim();
    const isHtml = contentType.includes('text/html');
    const looksLikeSpaFallback = isHtml && /<div[^>]+id=["']root["']/i.test(body);
    if (looksLikeSpaFallback) {
      return null;
    }

    if (/\/\.env$/i.test(path) && !isHtml && /(?:^|\n)[A-Z0-9_]{2,}\s*=\s*.+/m.test(trimmedBody)) {
      return {
        observation: `The endpoint ${path} appears to expose environment-style key/value content.`,
        extraEvidence: { detector: 'env_file_pattern' },
      };
    }

    if (/\/\.git(\/|$)/i.test(path) && !isHtml && /(repositoryformatversion|^\[core\]|^ref:\s+refs\/)/mi.test(trimmedBody)) {
      return {
        observation: `The endpoint ${path} appears to expose Git repository metadata.`,
        extraEvidence: { detector: 'git_metadata_pattern' },
      };
    }

    if (/server-status/i.test(path) && /(apache server status|server uptime|requests currently being processed)/i.test(trimmedBody)) {
      return {
        observation: `The endpoint ${path} appears to expose web server status information.`,
        extraEvidence: { detector: 'server_status_pattern' },
      };
    }

    if (/phpinfo\.php/i.test(path) && /(php version|php credits|configuration command)/i.test(trimmedBody)) {
      return {
        observation: `The endpoint ${path} appears to expose PHP diagnostic information.`,
        extraEvidence: { detector: 'phpinfo_pattern' },
      };
    }

    if (/\/actuator(\/|$)/i.test(path) && (contentType.includes('json') || trimmedBody.startsWith('{')) && /"_links"|\"status\"|\"components\"/i.test(trimmedBody)) {
      return {
        observation: `The endpoint ${path} appears to expose Spring actuator or health metadata.`,
        extraEvidence: { detector: 'actuator_pattern' },
      };
    }

    if (/\/(trace|traces|debug|debug\/vars|debug\/pprof|_debug)/i.test(path) && (contentType.includes('json') || contentType.includes('text/plain') || /goroutine|heap profile|trace|debug/i.test(trimmedBody))) {
      return {
        observation: `The endpoint ${path} appears to expose diagnostic or tracing content.`,
        extraEvidence: { detector: 'debug_surface_pattern' },
      };
    }

    return null;
  }
}
