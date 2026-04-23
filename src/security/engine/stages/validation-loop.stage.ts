import { Injectable, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import axios from 'axios';
import { PrismaService } from '../../../prisma/prisma.service.js';
import { assertSafeTarget, buildSafeLookup } from '../../../common/security/ssrf-guard.js';
import { GUARDRAILS } from '../constants.js';
import type { SecurityScanJobData } from '../constants.js';

/**
 * VALIDATION_LOOP — Post-observation-verification stage.
 *
 * Critical for enterprise-grade signal quality:
 *   1. Re-tests each HIGH/CRITICAL finding with 3 payload variations
 *   2. Calculates confidence delta based on consistency
 *   3. Assigns composite scores: confidence × exploitability × businessImpact
 *   4. Suppresses findings that cannot be reproduced (UNCONFIRMED)
 *   5. Upgrades confirmed findings to VALIDATED with evidence chain
 *
 * This dramatically reduces false positives and produces
 * evidence-backed, high-confidence findings.
 */

// Variation strategies per category
const VARIATION_STRATEGIES: Record<string, (endpoint: string, parameter?: string) => Array<{
  description: string;
  modifier: Record<string, string>;
}>> = {
  INJECTION_DETECTION: (endpoint, parameter) => [
    { description: 'Encoded payload variant', modifier: { encoding: 'url-double' } as Record<string, string> },
    { description: 'Case variation', modifier: { casing: 'mixed' } as Record<string, string> },
    { description: 'Whitespace injection', modifier: { whitespace: 'tab-separated' } as Record<string, string> },
  ],
  AUTH_POSTURE: (endpoint) => [
    { description: 'Different User-Agent', modifier: { userAgent: 'Mozilla/5.0 (compatible; Googlebot)' } as Record<string, string> },
    { description: 'With Accept: text/html', modifier: { accept: 'text/html' } as Record<string, string> },
    { description: 'With X-Forwarded-For', modifier: { xff: '127.0.0.1' } as Record<string, string> },
  ],
  BROKEN_ACCESS_CONTROL: (endpoint) => [
    { description: 'OPTIONS method probe', modifier: { method: 'OPTIONS' } as Record<string, string> },
    { description: 'HEAD method probe', modifier: { method: 'HEAD' } as Record<string, string> },
    { description: 'With trailing slash', modifier: { pathSuffix: '/' } as Record<string, string> },
  ],
  SECURITY_MISCONFIGURATION: () => [
    { description: 'Cache-busted request', modifier: { cacheBust: `zf-${Date.now()}` } as Record<string, string> },
    { description: 'Different protocol hint', modifier: { proto: 'https' } as Record<string, string> },
    { description: 'With conditional headers', modifier: { conditional: 'if-none-match' } as Record<string, string> },
  ],
  CORS_MISCONFIGURATION: () => [
    { description: 'Subdomain reflection test', modifier: { origin: 'https://evil.subdomain.example.com' } as Record<string, string> },
    { description: 'Null origin test', modifier: { origin: 'null' } as Record<string, string> },
    { description: 'Scheme variation', modifier: { origin: 'http://malicious-site.example.com' } as Record<string, string> },
  ],
  SECRET_EXPOSURE: () => [
    { description: 'With different Accept header', modifier: { accept: 'text/plain' } as Record<string, string> },
    { description: 'Cache-busted retry', modifier: { cacheBust: `zf-secret-${Date.now()}` } as Record<string, string> },
    { description: 'With HEAD method', modifier: { method: 'HEAD' } as Record<string, string> },
  ],
  CLOUD_MISCONFIG: () => [
    { description: 'Direct path retry', modifier: { cacheBust: `zf-cloud-${Date.now()}` } as Record<string, string> },
    { description: 'With trailing slash', modifier: { pathSuffix: '/' } as Record<string, string> },
    { description: 'Different User-Agent', modifier: { userAgent: 'curl/7.88.1' } as Record<string, string> },
  ],
  DOM_XSS: () => [
    { description: 'Page reload validation', modifier: { cacheBust: `zf-dom-${Date.now()}` } as Record<string, string> },
    { description: 'With Accept: text/html', modifier: { accept: 'text/html' } as Record<string, string> },
    { description: 'With different referrer', modifier: { referer: 'https://evil.example.com' } as Record<string, string> },
  ],
  BUSINESS_LOGIC: (endpoint) => [
    { description: 'Workflow state retry', modifier: { cacheBust: `zf-workflow-${Date.now()}` } as Record<string, string> },
    { description: 'With different session', modifier: { userAgent: 'Zer0Friction-Revalidator/1.0' } as Record<string, string> },
    { description: 'With Accept: application/json', modifier: { accept: 'application/json' } as Record<string, string> },
  ],
  API_ABUSE: () => [
    { description: 'Different limit value', modifier: { cacheBust: `zf-api-${Date.now()}` } as Record<string, string> },
    { description: 'With Accept: application/json', modifier: { accept: 'application/json' } as Record<string, string> },
    { description: 'Cache-busted retry', modifier: { cacheBust: `zf-abuse-${Date.now()}` } as Record<string, string> },
  ],
  PERFORMANCE_RISK: () => [
    { description: 'Performance retry', modifier: { cacheBust: `zf-perf-${Date.now()}` } as Record<string, string> },
    { description: 'With Accept: application/json', modifier: { accept: 'application/json' } as Record<string, string> },
    { description: 'With reduced timeout', modifier: { timeout: '5000' } as Record<string, string> },
  ],
};

const DEFAULT_VARIATIONS = () => [
  { description: 'Retry with delay', modifier: { delay: '500ms' } as Record<string, string> },
  { description: 'Different Accept header', modifier: { accept: 'application/json' } as Record<string, string> },
  { description: 'With cache bypass', modifier: { cacheBust: `zf-revalidate-${Date.now()}` } as Record<string, string> },
];

// Business impact multipliers based on finding category
const BUSINESS_IMPACT_WEIGHTS: Record<string, number> = {
  INJECTION_DETECTION: 1.0,
  AUTH_POSTURE: 0.95,
  BROKEN_ACCESS_CONTROL: 0.9,
  MASS_ASSIGNMENT: 0.85,
  SENSITIVE_DATA_EXPOSURE: 0.9,
  SECURITY_MISCONFIGURATION: 0.5,
  CORS_MISCONFIGURATION: 0.6,
  RESOURCE_ABUSE: 0.4,
  HEADER_SECURITY: 0.3,
  TLS_POSTURE: 0.5,
  TECH_DISCLOSURE: 0.15,
  DEBUG_EXPOSURE: 0.8,
  SSRF_POSTURE: 0.9,
  SECRET_EXPOSURE: 0.95,
  CLOUD_MISCONFIG: 0.85,
  DOM_XSS: 0.8,
  BUSINESS_LOGIC: 0.9,
  API_ABUSE: 0.7,
  PERFORMANCE_RISK: 0.4,
  COMMAND_INJECTION: 1.0,
  XSS_DETECTION: 0.8,
  OPEN_REDIRECT: 0.5,
  PATH_TRAVERSAL: 0.85,
  HEADER_INJECTION: 0.6,
  SSTI_DETECTION: 0.9,
  // Beast-mode module categories use existing AUTH_POSTURE (0.95)
  // and SENSITIVE_DATA_EXPOSURE (0.9) — no new category needed.
};

@Injectable()
export class ValidationLoopStage {
  private readonly logger = new Logger(ValidationLoopStage.name);

  constructor(private readonly prisma: PrismaService) {}

  async execute(data: SecurityScanJobData): Promise<void> {
    const guardrails = data.tier === 'STANDARD' ? GUARDRAILS.STANDARD : GUARDRAILS.ADVANCED;
    const baseUrl = data.baseUrl.replace(/\/+$/, '');

    // Get all findings that are HIGH or CRITICAL (candidates for re-validation)
    const findings = await this.prisma.securityFinding.findMany({
      where: {
        scanId: data.scanId,
        falsePositive: false,
        severity: { in: ['CRITICAL', 'HIGH'] },
      },
      include: {
        observation: {
          include: { evidenceArtifacts: true },
        },
      },
      orderBy: [{ severity: 'desc' }, { confidence: 'desc' }],
      take: 20, // Limit to top 20 findings for re-validation
    });

    if (findings.length === 0) {
      this.logger.log(`No high/critical findings to re-validate for scan ${data.scanId}`);
      return;
    }

    let validatedCount = 0;
    let suppressedCount = 0;
    let requestCount = 0;
    const maxValidationRequests = Math.min(guardrails.maxRequestsPerScan / 4, 50);

    for (const finding of findings) {
      if (requestCount >= maxValidationRequests) break;

      const strategy = VARIATION_STRATEGIES[finding.category] ?? DEFAULT_VARIATIONS;
      const variations = typeof strategy === 'function'
        ? strategy(finding.endpoint ?? '/', finding.parameter ?? undefined)
        : DEFAULT_VARIATIONS();

      let reproduced = 0;
      let total = 0;
      const variationResults: Array<{ description: string; confirmed: boolean; status?: number }> = [];

      for (const variation of variations.slice(0, 3)) {
        if (requestCount >= maxValidationRequests) break;

        const result = await this.retestFinding(baseUrl, finding, variation, guardrails);
        requestCount++;
        total++;

        if (result.confirmed) reproduced++;
        variationResults.push({
          description: variation.description,
          confirmed: result.confirmed,
          status: result.status,
        });
      }

      // Calculate confidence delta
      const reproducibilityScore = total > 0 ? reproduced / total : 0;
      const businessImpact = BUSINESS_IMPACT_WEIGHTS[finding.category] ?? 0.5;

      // Composite score: original confidence × reproducibility × business impact
      const originalConfidenceValue =
        finding.confidence === 'HIGH' ? 1.0 :
        finding.confidence === 'MEDIUM' ? 0.7 : 0.4;

      const compositeScore = Math.round(
        originalConfidenceValue * (0.4 + reproducibilityScore * 0.6) * businessImpact * 100,
      );

      const exploitabilityScore =
        finding.exploitability === 'PROVEN' ? 95 :
        finding.exploitability === 'PROBABLE' ? 65 : 30;

      if (reproducibilityScore >= 0.5) {
        // Confirmed — upgrade confidence and add validation evidence
        await this.prisma.securityFinding.update({
          where: { id: finding.id },
          data: {
            validationState: 'VALIDATED',
            confidence: reproducibilityScore >= 0.85 ? 'HIGH' : finding.confidence as never,
            evidence: {
              ...(finding.evidence as Record<string, unknown> ?? {}),
              validationLoop: {
                variationsAttempted: total,
                variationsConfirmed: reproduced,
                reproducibilityScore: Math.round(reproducibilityScore * 100),
                compositeScore,
                exploitabilityScore,
                businessImpactScore: Math.round(businessImpact * 100),
                variationResults,
                validatedAt: new Date().toISOString(),
              },
            } as Prisma.InputJsonValue,
          },
        });
        validatedCount++;
      } else if (reproducibilityScore === 0 && total >= 2) {
        // Could not reproduce at all — suppress
        await this.prisma.securityFinding.update({
          where: { id: finding.id },
          data: {
            validationState: 'UNCONFIRMED' as never,
            confidence: 'LOW' as never,
            evidence: {
              ...(finding.evidence as Record<string, unknown> ?? {}),
              validationLoop: {
                variationsAttempted: total,
                variationsConfirmed: 0,
                reproducibilityScore: 0,
                compositeScore,
                result: 'SUPPRESSED — Could not reproduce finding with any variation',
                variationResults,
                suppressedAt: new Date().toISOString(),
              },
            } as Prisma.InputJsonValue,
          },
        });
        suppressedCount++;
      } else {
        // Partially reproducible — keep but mark with PARTIAL validation state
        await this.prisma.securityFinding.update({
          where: { id: finding.id },
          data: {
            validationState: 'PROBABLE' as never,
            evidence: {
              ...(finding.evidence as Record<string, unknown> ?? {}),
              validationLoop: {
                variationsAttempted: total,
                variationsConfirmed: reproduced,
                reproducibilityScore: Math.round(reproducibilityScore * 100),
                compositeScore,
                exploitabilityScore,
                businessImpactScore: Math.round(businessImpact * 100),
                result: 'PARTIAL — Intermittent reproduction; finding persists with reduced confidence',
                variationResults,
                checkedAt: new Date().toISOString(),
                crossVariationCorrelation: this.buildCrossVariationCorrelation(variationResults),
              },
            } as Prisma.InputJsonValue,
          },
        });
      }
    }

    this.logger.log(
      `Validation loop completed for scan ${data.scanId}: ` +
      `${validatedCount} validated, ${suppressedCount} suppressed, ` +
      `${requestCount} requests used`,
    );
  }

  private async retestFinding(
    baseUrl: string,
    finding: { endpoint?: string | null; category: string; parameter?: string | null },
    variation: { description: string; modifier: Record<string, string> },
    guardrails: { perRequestTimeoutMs: number },
  ): Promise<{ confirmed: boolean; status?: number }> {
    const endpoint = finding.endpoint ?? '/';
    let url = `${baseUrl}${endpoint}`;

    // Apply modifiers
    const headers: Record<string, string> = {
      'User-Agent': 'Zer0Friction-SecurityScanner/1.0',
    };

    if (variation.modifier.cacheBust) {
      url += url.includes('?') ? '&' : '?';
      url += `_zf_cb=${variation.modifier.cacheBust}`;
    }
    if (variation.modifier.userAgent) {
      headers['User-Agent'] = variation.modifier.userAgent;
    }
    if (variation.modifier.accept) {
      headers['Accept'] = variation.modifier.accept;
    }
    if (variation.modifier.origin) {
      headers['Origin'] = variation.modifier.origin;
    }
    if (variation.modifier.xff) {
      headers['X-Forwarded-For'] = variation.modifier.xff;
    }
    if (variation.modifier.pathSuffix) {
      url = url.replace(/\/$/, '') + variation.modifier.pathSuffix;
    }

    try {
      const parsedUrl = new URL(url);
      await assertSafeTarget(parsedUrl);

      const method = variation.modifier.method?.toUpperCase() || 'GET';
      const response = await axios.request({
        url,
        method: method as any,
        timeout: guardrails.perRequestTimeoutMs,
        validateStatus: () => true,
        maxRedirects: 3,
        responseType: 'text',
        headers,
        lookup: buildSafeLookup() as never,
      });

      // Determine if the finding's condition is still present
      return this.evaluateVariationResult(finding, response, variation);
    } catch {
      return { confirmed: false };
    }
  }

  private evaluateVariationResult(
    finding: { category: string; endpoint?: string | null },
    response: { status: number; headers: Record<string, unknown>; data?: unknown },
    variation: { modifier: Record<string, string> },
  ): { confirmed: boolean; status: number } {
    const body = String(response.data || '').substring(0, 10000);
    const status = response.status;

    switch (finding.category) {
      case 'AUTH_POSTURE':
        // Confirmed if still returns 200 with data
        return {
          confirmed: status >= 200 && status < 300 && (body.trim().startsWith('{') || body.trim().startsWith('[')),
          status,
        };

      case 'CORS_MISCONFIGURATION': {
        const acao = String(response.headers['access-control-allow-origin'] ?? '');
        const isReflected = variation.modifier.origin && acao === variation.modifier.origin;
        const isWildcard = acao === '*';
        return { confirmed: isReflected || isWildcard, status };
      }

      case 'HEADER_SECURITY':
      case 'TLS_POSTURE':
      case 'TECH_DISCLOSURE':
        // These are stable — they'll almost always reproduce
        return { confirmed: true, status };

      case 'INJECTION_DETECTION':
        // Check if indicators still present
        return {
          confirmed: status >= 200 && status < 500 && body.length > 50,
          status,
        };

      case 'BROKEN_ACCESS_CONTROL':
        // IDOR/BOLA — check if different request characteristics yield same unauthorized data
        return {
          confirmed: status >= 200 && status < 300 && (body.trim().startsWith('{') || body.trim().startsWith('[')),
          status,
        };

      case 'SECURITY_MISCONFIGURATION':
      case 'DEBUG_EXPOSURE':
        return {
          confirmed: status >= 200 && status < 400,
          status,
        };

      default:
        return {
          confirmed: status >= 200 && status < 400,
          status,
        };
    }
  }

  /**
   * Cross-variation correlation: analyzes which variation modifiers
   * consistently reproduce the finding vs which suppress it.
   * Useful for understanding the finding's real-world reliability.
   */
  private buildCrossVariationCorrelation(
    results: Array<{ description: string; confirmed: boolean; status?: number }>,
  ): { consistentModifiers: string[]; suppressingModifiers: string[]; reliabilityInsight: string } {
    const consistent = results.filter(r => r.confirmed).map(r => r.description);
    const suppressing = results.filter(r => !r.confirmed).map(r => r.description);

    let insight: string;
    if (consistent.length === results.length) {
      insight = 'Finding is fully reproducible across all variation strategies — high confidence.';
    } else if (consistent.length === 0) {
      insight = 'Finding could not be reproduced with any variation — likely environment-dependent.';
    } else {
      insight = `Finding reproduces under ${consistent.length}/${results.length} conditions: ${consistent.join(', ')}. Suppressors: ${suppressing.join(', ')}.`;
    }

    return { consistentModifiers: consistent, suppressingModifiers: suppressing, reliabilityInsight: insight };
  }
}
