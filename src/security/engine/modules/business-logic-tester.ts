import { Injectable, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import axios from 'axios';
import { PrismaService } from '../../../prisma/prisma.service.js';
import { assertSafeTarget, buildSafeLookup } from '../../../common/security/ssrf-guard.js';
import { GUARDRAILS, buildAuthHeaders } from '../constants.js';
import type { SecurityScanJobData } from '../constants.js';

/**
 * BUSINESS_LOGIC_TESTER — Workflow-based vulnerability detection.
 *
 * Capabilities:
 *   • Multi-step request sequence tracking
 *   • Workflow bypass detection (skipping steps)
 *   • Replay attack detection (duplicate request handling)
 *   • Race condition safe simulation (concurrent identical requests)
 *   • State desynchronization detection
 *   • Step-skipping in transactional flows
 */

// Common multi-step flows to test
const WORKFLOW_SEQUENCES = [
  {
    name: 'Checkout Bypass',
    steps: [
      { path: '/api/cart', method: 'GET', label: 'View cart' },
      { path: '/api/checkout', method: 'POST', label: 'Initiate checkout' },
      { path: '/api/checkout/confirm', method: 'POST', label: 'Confirm payment' },
      { path: '/api/orders', method: 'GET', label: 'View order created' },
    ],
    skipStep: 2, // Try to skip payment confirmation
    category: 'Payment bypass',
  },
  {
    name: 'Registration Verification Bypass',
    steps: [
      { path: '/api/auth/register', method: 'POST', label: 'Register account' },
      { path: '/api/auth/verify-email', method: 'POST', label: 'Verify email' },
      { path: '/api/auth/login', method: 'POST', label: 'Login' },
      { path: '/api/me', method: 'GET', label: 'Access user data' },
    ],
    skipStep: 1, // Try to skip email verification
    category: 'Email verification bypass',
  },
  {
    name: 'Password Reset Flow Bypass',
    steps: [
      { path: '/api/auth/forgot-password', method: 'POST', label: 'Request reset' },
      { path: '/api/auth/verify-reset-token', method: 'POST', label: 'Verify token' },
      { path: '/api/auth/reset-password', method: 'POST', label: 'Set new password' },
    ],
    skipStep: 1, // Try to skip token verification
    category: 'Password reset bypass',
  },
];

// Replay attack test targets
const REPLAY_SENSITIVE_PATHS = [
  '/api/checkout', '/api/payment', '/api/transfer', '/api/send',
  '/api/auth/verify', '/api/auth/confirm', '/api/auth/otp',
  '/api/voucher/redeem', '/api/coupon/apply', '/api/promo/apply',
  '/api/vote', '/api/like', '/api/upvote',
];

@Injectable()
export class BusinessLogicTester {
  private readonly logger = new Logger(BusinessLogicTester.name);

  constructor(private readonly prisma: PrismaService) {}

  async execute(data: SecurityScanJobData): Promise<void> {
    // Business logic testing requires at least ADVANCED tier
    if (data.tier === 'STANDARD') {
      this.logger.debug(`Skipping business logic tests for STANDARD scan ${data.scanId}`);
      return;
    }

    const guardrails = GUARDRAILS.ADVANCED;
    const baseUrl = data.baseUrl.replace(/\/+$/, '');
    let requestCount = 0;
    const maxRequests = Math.min(guardrails.maxRequestsPerScan / 5, 40);

    const scan = await this.prisma.securityScan.findUnique({
      where: { id: data.scanId },
      include: { target: { include: { assets: true } } },
    });
    if (!scan) return;

    const rootAsset = scan.target.assets[0] ?? null;
    const isLabOnly = scan.target.environment === 'LAB' || scan.target.environment === 'DEVELOPMENT';
    const authHeaders = buildAuthHeaders(data.authenticatedContext);

    const endpoints = await this.prisma.securityEndpointInventory.findMany({
      where: { targetId: data.targetId },
      orderBy: { confidence: 'desc' },
    });
    const knownPaths = new Set(endpoints.map(ep => ep.path));

    // ═══════════════════════════════════════════════════════════
    // 1. Workflow Bypass Detection (Step Skipping)
    // ═══════════════════════════════════════════════════════════
    for (const workflow of WORKFLOW_SEQUENCES) {
      if (requestCount >= maxRequests) break;

      // Check if the target has these endpoints
      const hasWorkflow = workflow.steps.filter(s => knownPaths.has(s.path)).length >= 2;
      if (!hasWorkflow) continue;

      const finalStep = workflow.steps[workflow.steps.length - 1];
      const skippedStep = workflow.steps[workflow.skipStep];

      // Try to access the final step directly (skipping intermediate steps)
      try {
        const url = `${baseUrl}${finalStep.path}`;
        const parsedUrl = new URL(url);
        await assertSafeTarget(parsedUrl);

        const method = finalStep.method.toLowerCase() as 'get' | 'post';
        const resp = await axios[method](url, method === 'post' ? {} : undefined, {
          timeout: guardrails.perRequestTimeoutMs,
          validateStatus: () => true,
          maxRedirects: 0,
          responseType: 'text',
          headers: { 'User-Agent': 'Zer0Friction-SecurityScanner/1.0', ...authHeaders },
          lookup: buildSafeLookup() as never,
        } as any);
        requestCount++;

        // If the final step works without the intermediate steps → potential bypass
        if (resp.status >= 200 && resp.status < 300) {
          const body = String(resp.data || '');
          const looksLikeData = body.trim().startsWith('{') || body.trim().startsWith('[');

          if (looksLikeData && body.length > 20) {
            await this.createObservation({
              scanId: data.scanId, targetId: data.targetId,
              category: 'BUSINESS_LOGIC',
              title: `${workflow.name}: ${skippedStep.label} can be skipped`,
              severity: 'HIGH',
              exploitability: 'PROBABLE',
              confidence: 'MEDIUM',
              proofType: 'RESPONSE_MATCH',
              endpoint: finalStep.path,
              scenarioPackSlug: 'business-logic',
              remediation: `Enforce server-side workflow state validation. ${finalStep.path} should verify that "${skippedStep.label}" (${skippedStep.path}) was completed before allowing access. Use stateful tokens or session-based flow tracking.`,
              observation: `Accessing ${finalStep.path} directly without completing "${skippedStep.label}" (${skippedStep.path}) returned a ${resp.status} success response with data. This suggests the ${workflow.category} flow can be bypassed.`,
              labels: isLabOnly ? ['LAB_ONLY', 'NEEDS_MANUAL_REVIEW'] : ['NEEDS_MANUAL_REVIEW'],
              affectedAssets: rootAsset ? [rootAsset.id] : [],
              evidenceKind: 'STATE_TRANSITION',
            });
          }
        }
      } catch { requestCount++; }
    }

    // ═══════════════════════════════════════════════════════════
    // 2. Replay Attack Detection
    // ═══════════════════════════════════════════════════════════
    const replayTargets = endpoints.filter(ep =>
      REPLAY_SENSITIVE_PATHS.some(rp => ep.path.toLowerCase().includes(rp.split('/api/')[1] || '')),
    ).slice(0, 5);

    for (const ep of replayTargets) {
      if (requestCount >= maxRequests) break;

      const url = `${baseUrl}${ep.path}`;
      const results: Array<{ status: number; body: string }> = [];

      // Send the same POST request twice
      for (let i = 0; i < 2; i++) {
        if (requestCount >= maxRequests) break;

        try {
          const parsedUrl = new URL(url);
          await assertSafeTarget(parsedUrl);

          const resp = await axios.post(url, {
            test: true,
            idempotencyCheck: `zf-replay-${data.scanId}`,
          }, {
            timeout: guardrails.perRequestTimeoutMs,
            validateStatus: () => true,
            maxRedirects: 0,
            responseType: 'text',
            headers: {
              'User-Agent': 'Zer0Friction-SecurityScanner/1.0',
              'Content-Type': 'application/json',
              ...authHeaders,
            },
            lookup: buildSafeLookup() as never,
          });
          requestCount++;

          results.push({
            status: resp.status,
            body: String(resp.data || '').substring(0, 500),
          });
        } catch { requestCount++; }
      }

      // If both requests succeed with 2xx → no replay protection
      if (results.length === 2 && results.every(r => r.status >= 200 && r.status < 300)) {
        await this.createObservation({
          scanId: data.scanId, targetId: data.targetId,
          category: 'BUSINESS_LOGIC',
          title: `No Replay Protection on ${ep.path}`,
          severity: 'MEDIUM',
          exploitability: 'PROBABLE',
          confidence: 'MEDIUM',
          proofType: 'RESPONSE_MATCH',
          endpoint: ep.path,
          scenarioPackSlug: 'business-logic',
          remediation: 'Implement idempotency keys for sensitive operations. Use one-time tokens for payment/transfer endpoints. Return HTTP 409 Conflict for duplicate requests.',
          observation: `Sending identical POST requests to ${ep.path} twice both returned success (${results[0].status}, ${results[1].status}). The endpoint may be vulnerable to replay attacks.`,
          labels: isLabOnly ? ['LAB_ONLY', 'NEEDS_MANUAL_REVIEW'] : ['NEEDS_MANUAL_REVIEW'],
          affectedAssets: rootAsset ? [rootAsset.id] : [],
          evidenceKind: 'SEQUENCE_TRACE',
        });
      }
    }

    // ═══════════════════════════════════════════════════════════
    // 3. Race Condition Safe Simulation
    // ═══════════════════════════════════════════════════════════
    const raceTargets = endpoints.filter(ep =>
      /\/(redeem|apply|claim|transfer|withdraw|activate)/i.test(ep.path),
    ).slice(0, 3);

    for (const ep of raceTargets) {
      if (requestCount + 3 >= maxRequests) break;

      const url = `${baseUrl}${ep.path}`;
      try {
        const parsedUrl = new URL(url);
        await assertSafeTarget(parsedUrl);

        // Send 3 concurrent identical requests
        const raceResults = await Promise.allSettled(
          Array.from({ length: 3 }, () =>
            axios.post(url, { raceConditionTest: true }, {
              timeout: guardrails.perRequestTimeoutMs,
              validateStatus: () => true,
              maxRedirects: 0,
              responseType: 'text',
              headers: {
                'User-Agent': 'Zer0Friction-SecurityScanner/1.0',
                'Content-Type': 'application/json',
                ...authHeaders,
              },
              lookup: buildSafeLookup() as never,
            }),
          ),
        );
        requestCount += 3;

        const successes = raceResults.filter(
          r => r.status === 'fulfilled' && r.value.status >= 200 && r.value.status < 300,
        ).length;

        if (successes >= 2) {
          await this.createObservation({
            scanId: data.scanId, targetId: data.targetId,
            category: 'BUSINESS_LOGIC',
            title: `Potential Race Condition on ${ep.path}`,
            severity: 'MEDIUM',
            exploitability: 'THEORETICAL',
            confidence: 'LOW',
            proofType: 'HEURISTIC',
            endpoint: ep.path,
            scenarioPackSlug: 'business-logic',
            remediation: 'Implement database-level locking or optimistic concurrency control. Use distributed locks for critical operations like balance transfers or coupon redemption.',
            observation: `Sending 3 concurrent POST requests to ${ep.path} resulted in ${successes} successes. If this is a value-sensitive operation (balance, coupon, etc.), race conditions may allow double-spending. Manual verification required.`,
            labels: isLabOnly ? ['LAB_ONLY', 'NEEDS_MANUAL_REVIEW'] : ['NEEDS_MANUAL_REVIEW'],
            affectedAssets: rootAsset ? [rootAsset.id] : [],
            evidenceKind: 'SEQUENCE_TRACE',
          });
        }
      } catch { requestCount += 3; }
    }

    this.logger.log(`Business logic testing completed for scan ${data.scanId}: ${requestCount} requests`);
  }

  private async createObservation(input: {
    scanId: string; targetId: string; category: string; title: string;
    severity: string; exploitability: string; confidence: string;
    proofType: string; endpoint: string; scenarioPackSlug: string;
    remediation: string; observation: string; labels: string[];
    affectedAssets: string[]; evidenceKind?: string;
  }) {
    const evidence = await this.prisma.securityEvidenceArtifact.create({
      data: {
        targetId: input.targetId, scanId: input.scanId,
        kind: (input.evidenceKind ?? 'HTTP_TRANSCRIPT') as never,
        name: `${input.title} evidence`,
        summary: { endpoint: input.endpoint, proofType: input.proofType },
      },
    });

    const obs = await this.prisma.securityObservation.create({
      data: {
        scanId: input.scanId, targetId: input.targetId,
        category: input.category as never, title: input.title,
        severity: input.severity as never,
        exploitability: input.exploitability as never,
        confidence: input.confidence as never,
        proofType: input.proofType as never,
        scenarioPackSlug: input.scenarioPackSlug,
        endpoint: input.endpoint, httpMethod: 'POST',
        evidenceSummary: { observation: input.observation } as Prisma.InputJsonValue,
        affectedAssets: input.affectedAssets, labels: input.labels,
        remediation: input.remediation,
      },
    });

    await this.prisma.securityEvidenceArtifact.update({
      where: { id: evidence.id },
      data: { observationId: obs.id },
    });
  }
}
