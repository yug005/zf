import { Injectable, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import axios from 'axios';
import { PrismaService } from '../../../prisma/prisma.service.js';
import { assertSafeTarget, buildSafeLookup } from '../../../common/security/ssrf-guard.js';
import { GUARDRAILS, buildAuthHeaders } from '../constants.js';
import type { SecurityScanJobData, AuthenticatedContext } from '../constants.js';

/**
 * AUTHENTICATED_SCANNER — Orchestrates auth-context-aware probing.
 *
 * Capabilities:
 *   • Injects session cookies / JWT / API keys into every probe request
 *   • Role-based differential scanning (admin vs user vs guest)
 *   • Token refresh on 401 responses
 *   • Detects auth-boundary differences across roles
 *   • Identifies endpoints that expose different data per role
 */

@Injectable()
export class AuthenticatedScanner {
  private readonly logger = new Logger(AuthenticatedScanner.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Execute authenticated endpoint comparison scan.
   * Compares responses between unauthenticated, user, and admin roles
   * to detect access control differences.
   */
  async execute(data: SecurityScanJobData): Promise<void> {
    const authCtx = data.authenticatedContext;
    if (!authCtx) {
      this.logger.debug(`No auth context for scan ${data.scanId} — skipping authenticated scanner`);
      return;
    }

    const guardrails = data.tier === 'STANDARD' ? GUARDRAILS.STANDARD : GUARDRAILS.ADVANCED;
    const baseUrl = data.baseUrl.replace(/\/+$/, '');
    let requestCount = 0;
    const maxRequests = Math.min(guardrails.maxRequestsPerScan / 5, 60);

    const endpoints = await this.prisma.securityEndpointInventory.findMany({
      where: { targetId: data.targetId },
      orderBy: { confidence: 'desc' },
      take: 20,
    });

    const scan = await this.prisma.securityScan.findUnique({
      where: { id: data.scanId },
      include: { target: { include: { assets: true } } },
    });
    if (!scan) return;

    const rootAsset = scan.target.assets[0] ?? null;
    const isLabOnly = scan.target.environment === 'LAB' || scan.target.environment === 'DEVELOPMENT';

    // ─── 1. Auth vs No-Auth differential scan ─────────────────
    for (const ep of endpoints) {
      if (requestCount >= maxRequests) break;

      const url = `${baseUrl}${ep.path}`;

      try {
        const parsedUrl = new URL(url);
        await assertSafeTarget(parsedUrl);

        // Request WITHOUT auth
        const noAuthResp = await axios.get(url, {
          timeout: guardrails.perRequestTimeoutMs,
          validateStatus: () => true,
          maxRedirects: 3,
          responseType: 'text',
          headers: { 'User-Agent': 'Zer0Friction-SecurityScanner/1.0' },
          lookup: buildSafeLookup() as never,
        });
        requestCount++;

        // Request WITH auth
        const authHeaders = buildAuthHeaders(authCtx);
        const authResp = await axios.get(url, {
          timeout: guardrails.perRequestTimeoutMs,
          validateStatus: () => true,
          maxRedirects: 3,
          responseType: 'text',
          headers: {
            'User-Agent': 'Zer0Friction-SecurityScanner/1.0',
            ...authHeaders,
          },
          lookup: buildSafeLookup() as never,
        });
        requestCount++;

        // Handle token refresh if 401
        if (authResp.status === 401 && authCtx.refreshEnabled && authCtx.refreshEndpoint) {
          const refreshed = await this.attemptTokenRefresh(baseUrl, authCtx, guardrails);
          if (refreshed) {
            requestCount++;
            // Update the context with refreshed token
            authCtx.bearerToken = refreshed;
          }
        }

        const noAuthBody = String(noAuthResp.data || '').substring(0, guardrails.maxResponseBodyCapture);
        const authBody = String(authResp.data || '').substring(0, guardrails.maxResponseBodyCapture);

        // Detect: endpoint returns data WITH auth that wasn't available WITHOUT auth
        const noAuthIsBlocked = noAuthResp.status === 401 || noAuthResp.status === 403;
        const authIsData = authResp.status >= 200 && authResp.status < 300;
        const authLooksLikeData = authBody.trim().startsWith('{') || authBody.trim().startsWith('[');

        // Track auth-protected endpoints for later analysis
        if (noAuthIsBlocked && authIsData && authLooksLikeData) {
          await this.prisma.securityEndpointInventory.updateMany({
            where: { targetId: data.targetId, path: ep.path },
            data: {
              metadata: {
                ...(ep.metadata as Record<string, unknown> ?? {}),
                requiresAuth: true,
                authStatusWithout: noAuthResp.status,
                authStatusWith: authResp.status,
                dataExposedWhenAuthenticated: true,
              },
            },
          });
        }

        // Detect: endpoint returns SAME data without auth (should be auth-required)
        if (
          !noAuthIsBlocked && authIsData && authLooksLikeData &&
          noAuthResp.status >= 200 && noAuthResp.status < 300 &&
          noAuthBody.trim() === authBody.trim() &&
          /\/(api|user|admin|account|profile|settings|private)/i.test(ep.path)
        ) {
          await this.createObservation({
            scanId: data.scanId,
            targetId: data.targetId,
            category: 'AUTH_POSTURE',
            title: `Auth-sensitive endpoint returns same data without auth: ${ep.path}`,
            severity: 'HIGH',
            exploitability: 'PROVEN',
            confidence: 'HIGH',
            proofType: 'AUTH_BYPASS',
            endpoint: ep.path,
            scenarioPackSlug: 'authenticated-scan',
            remediation: 'Enforce authentication middleware on this endpoint. Verify that guards are applied to all routes returning user-specific data.',
            observation: `The endpoint ${ep.path} returns identical data whether authenticated or not. Since the path suggests it should be auth-protected, this likely indicates missing auth middleware.`,
            labels: isLabOnly ? ['LAB_ONLY', 'AUTH_DIFFERENTIAL'] : ['AUTH_DIFFERENTIAL', 'CORROBORATED'],
            affectedAssets: rootAsset ? [rootAsset.id] : [],
          });
        }
      } catch {
        requestCount++;
      }
    }

    // ─── 2. Role-based differential scanning ──────────────────
    if (authCtx.roles && authCtx.roles.length >= 2 && requestCount < maxRequests) {
      const sensitiveEndpoints = endpoints.filter(ep =>
        /\/(admin|manage|internal|config|settings|users|roles|permissions|billing)/i.test(ep.path),
      ).slice(0, 10);

      for (const ep of sensitiveEndpoints) {
        if (requestCount >= maxRequests) break;

        const url = `${baseUrl}${ep.path}`;
        const roleResults: Array<{ role: string; status: number; bodyLength: number; hasData: boolean }> = [];

        for (const role of authCtx.roles) {
          if (requestCount >= maxRequests) break;

          try {
            const parsedUrl = new URL(url);
            await assertSafeTarget(parsedUrl);

            const roleHeaders: Record<string, string> = {
              'User-Agent': 'Zer0Friction-SecurityScanner/1.0',
            };
            if (role.bearerToken) roleHeaders['Authorization'] = `Bearer ${role.bearerToken}`;
            if (role.cookies) roleHeaders['Cookie'] = role.cookies.map(c => `${c.name}=${c.value}`).join('; ');
            if (role.customHeaders) Object.assign(roleHeaders, role.customHeaders);

            const resp = await axios.get(url, {
              timeout: guardrails.perRequestTimeoutMs,
              validateStatus: () => true,
              maxRedirects: 3,
              responseType: 'text',
              headers: roleHeaders,
              lookup: buildSafeLookup() as never,
            });
            requestCount++;

            const body = String(resp.data || '');
            roleResults.push({
              role: role.name,
              status: resp.status,
              bodyLength: body.length,
              hasData: (body.trim().startsWith('{') || body.trim().startsWith('[')) && resp.status >= 200 && resp.status < 300,
            });
          } catch {
            requestCount++;
          }
        }

        // Detect: lower-privilege role can access admin-like endpoints
        const adminResult = roleResults.find(r => r.role.toLowerCase().includes('admin'));
        const userResults = roleResults.filter(r => !r.role.toLowerCase().includes('admin'));

        for (const userResult of userResults) {
          if (
            adminResult?.hasData && userResult.hasData &&
            /\/(admin|manage|internal)/i.test(ep.path)
          ) {
            await this.createObservation({
              scanId: data.scanId,
              targetId: data.targetId,
              category: 'BROKEN_ACCESS_CONTROL',
              title: `Role "${userResult.role}" has access to admin endpoint: ${ep.path}`,
              severity: 'CRITICAL',
              exploitability: 'PROVEN',
              confidence: 'HIGH',
              proofType: 'AUTH_BYPASS',
              endpoint: ep.path,
              scenarioPackSlug: 'authenticated-scan',
              remediation: `Restrict ${ep.path} to admin-only roles. Implement RBAC middleware that checks the user's role before granting access.`,
              observation: `Both the "${adminResult.role}" role (status ${adminResult.status}) and the "${userResult.role}" role (status ${userResult.status}) can access ${ep.path} and receive data. This indicates broken function-level authorization.`,
              labels: isLabOnly ? ['LAB_ONLY', 'ROLE_DIFFERENTIAL'] : ['ROLE_DIFFERENTIAL', 'CORROBORATED'],
              affectedAssets: rootAsset ? [rootAsset.id] : [],
            });
          }
        }
      }
    }

    this.logger.log(`Authenticated scanner completed for scan ${data.scanId}: ${requestCount} requests`);
  }

  private async attemptTokenRefresh(
    baseUrl: string,
    ctx: AuthenticatedContext,
    guardrails: { perRequestTimeoutMs: number },
  ): Promise<string | null> {
    if (!ctx.refreshEndpoint) return null;

    try {
      const url = ctx.refreshEndpoint.startsWith('http')
        ? ctx.refreshEndpoint
        : `${baseUrl}${ctx.refreshEndpoint}`;

      const resp = await axios.post(url, ctx.refreshBody ?? {}, {
        timeout: guardrails.perRequestTimeoutMs,
        validateStatus: () => true,
        responseType: 'json',
        headers: {
          'User-Agent': 'Zer0Friction-SecurityScanner/1.0',
          ...buildAuthHeaders(ctx),
        },
        lookup: buildSafeLookup() as never,
      });

      if (resp.status >= 200 && resp.status < 300 && resp.data) {
        const token = resp.data.accessToken || resp.data.access_token || resp.data.token;
        if (typeof token === 'string') {
          this.logger.debug('Token refresh succeeded');
          return token;
        }
      }
    } catch {
      this.logger.debug('Token refresh failed');
    }

    return null;
  }

  private async createObservation(input: {
    scanId: string; targetId: string; category: string; title: string;
    severity: string; exploitability: string; confidence: string;
    proofType: string; endpoint: string; scenarioPackSlug: string;
    remediation: string; observation: string; labels: string[];
    affectedAssets: string[];
  }) {
    const evidence = await this.prisma.securityEvidenceArtifact.create({
      data: {
        targetId: input.targetId, scanId: input.scanId,
        kind: 'HTTP_TRANSCRIPT', name: `${input.title} evidence`,
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
        endpoint: input.endpoint, httpMethod: 'GET',
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
