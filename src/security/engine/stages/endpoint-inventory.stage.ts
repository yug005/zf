import { Injectable, Logger } from '@nestjs/common';
import crypto from 'node:crypto';
import axios from 'axios';
import { PrismaService } from '../../../prisma/prisma.service.js';
import { assertSafeTarget, buildSafeLookup } from '../../../common/security/ssrf-guard.js';
import { GUARDRAILS } from '../constants.js';
import type { SecurityScanJobData } from '../constants.js';

/**
 * ENDPOINT_INVENTORY — Stage 3
 * Discovers available endpoints through common route probing,
 * sitemap/robots.txt analysis, and response link extraction.
 */

const COMMON_PATHS = [
  // ─── Root & Health ──────────────────────────────────────────
  '/', '/api', '/api/v1', '/api/v2', '/api/health', '/api/status',
  '/health', '/healthz', '/ready', '/ping', '/version', '/info',

  // ─── Docs & Schema ─────────────────────────────────────────
  '/docs', '/swagger', '/swagger-ui', '/openapi.json', '/swagger.json',
  '/api-docs', '/api/docs', '/api/swagger', '/api/openapi',
  '/graphql', '/graphiql', '/api/graphql',

  // ─── Auth & Identity ───────────────────────────────────────
  '/auth', '/auth/login', '/auth/register', '/auth/signup', '/auth/logout',
  '/auth/refresh', '/auth/forgot-password', '/auth/reset-password',
  '/auth/verify', '/auth/me', '/auth/profile', '/auth/session',
  '/login', '/register', '/signup', '/logout', '/forgot-password',
  '/oauth', '/oauth/authorize', '/oauth/callback', '/oauth/token',
  '/connect', '/.well-known/openid-configuration',

  // ─── Users & Profiles ──────────────────────────────────────
  '/users', '/user', '/me', '/profile', '/account', '/accounts',
  '/api/users', '/api/user', '/api/me', '/api/profile', '/api/account',
  '/api/v1/users', '/api/v1/me', '/api/v1/profile',

  // ─── Common RESTful Resources (SaaS patterns) ──────────────
  '/monitors', '/monitor', '/api/monitors',
  '/projects', '/project', '/api/projects',
  '/teams', '/team', '/api/teams',
  '/organizations', '/organization', '/api/organizations', '/api/orgs',
  '/workspaces', '/workspace', '/api/workspaces',
  '/status-pages', '/status-page', '/api/status-pages',
  '/incidents', '/incident', '/api/incidents',
  '/notifications', '/api/notifications',
  '/alerts', '/alert', '/api/alerts',
  '/settings', '/api/settings', '/api/config',
  '/preferences', '/api/preferences',

  // ─── Billing & Payments ────────────────────────────────────
  '/billing', '/api/billing', '/api/subscription',
  '/plans', '/api/plans', '/pricing',
  '/checkout', '/api/checkout',
  '/webhooks', '/api/webhooks', '/webhook',
  '/stripe', '/api/stripe/webhook',

  // ─── Security & API Keys ──────────────────────────────────
  '/security', '/api/security',
  '/security/targets', '/api/security/targets',
  '/security/scans', '/api/security/scans',
  '/api-keys', '/api/api-keys', '/api/keys', '/api/tokens',

  // ─── Admin & Internal ──────────────────────────────────────
  '/admin', '/admin/users', '/admin/settings',
  '/api/admin', '/api/admin/users', '/api/admin/settings',
  '/internal', '/internal/metrics',

  // ─── Files & Media ─────────────────────────────────────────
  '/upload', '/uploads', '/api/upload', '/api/files',
  '/files', '/media', '/assets', '/images',
  '/api/exports', '/api/import', '/export', '/import',

  // ─── Search & Data ─────────────────────────────────────────
  '/search', '/api/search', '/api/query',
  '/analytics', '/api/analytics', '/api/stats',
  '/dashboard', '/api/dashboard',
  '/reports', '/api/reports',

  // ─── Debug & Diagnostic ────────────────────────────────────
  '/.env', '/.git', '/.git/config', '/.git/HEAD',
  '/debug', '/debug/vars', '/debug/pprof',
  '/actuator', '/actuator/health', '/actuator/env',
  '/metrics', '/prometheus',
  '/server-status', '/server-info',

  // ─── Static & Misc ────────────────────────────────────────
  '/robots.txt', '/sitemap.xml', '/.well-known/security.txt',
  '/favicon.ico', '/manifest.json',

  // ─── Legacy CMS ────────────────────────────────────────────
  '/wp-admin', '/wp-login.php', '/xmlrpc.php',
];

const ADVANCED_PATHS = [
  // ─── Deep RESTful patterns (nested resources) ──────────────
  '/api/v1/users', '/api/v1/admin', '/api/v1/config', '/api/v1/settings',
  '/api/v1/search', '/api/v1/upload', '/api/v1/files', '/api/v1/export',
  '/api/v1/monitors', '/api/v1/projects', '/api/v1/teams',
  '/api/v1/incidents', '/api/v1/alerts', '/api/v1/notifications',
  '/api/v1/billing', '/api/v1/plans', '/api/v1/subscriptions',
  '/api/v1/security', '/api/v1/security/targets', '/api/v1/security/scans',
  '/api/v2/users', '/api/v2/admin',

  // ─── ID-based resource probes (trigger BOLA checks) ────────
  '/api/users/1', '/api/users/me', '/users/1',
  '/api/monitors/1', '/api/projects/1', '/api/teams/1',
  '/api/v1/users/1', '/api/v1/monitors/1',

  // ─── Webhooks, Events, Callbacks ───────────────────────────
  '/api/v1/webhooks', '/api/v1/callbacks', '/api/v1/events',
  '/api/v1/tokens', '/api/v1/keys', '/api/v1/secrets',
  '/api/webhooks/test', '/webhooks/stripe', '/webhooks/github',

  // ─── Admin & Management ────────────────────────────────────
  '/internal', '/internal/metrics', '/internal/debug',
  '/console', '/dashboard', '/manager',
  '/api/admin/stats', '/api/admin/logs', '/api/admin/audit',

  // ─── Backup & Data Export ──────────────────────────────────
  '/backup', '/backups', '/dump', '/export',
  '/api/backup', '/api/dump', '/api/export/csv',
  '/data', '/api/data', '/api/v1/data',

  // ─── Staging & Test ────────────────────────────────────────
  '/test', '/testing', '/staging',
  '/api/test', '/api/debug', '/api/sandbox',

  // ─── Auth Internals ────────────────────────────────────────
  '/auth/google', '/auth/github', '/auth/google/callback', '/auth/github/callback',
  '/auth/verify-email', '/auth/confirm', '/auth/two-factor',
  '/auth/sessions', '/auth/devices',
  '/api/auth/login', '/api/auth/register', '/api/auth/refresh',

  // ─── Traces & Debug ────────────────────────────────────────
  '/trace', '/traces', '/_debug',
  '/phpmyadmin', '/adminer', '/phpinfo.php',
  '/_next/data', '/__nextauth',

  // ─── Common NestJS / Express internals ─────────────────────
  '/api/v1/health', '/api/v1/status', '/api/v1/info',
  '/api/v1/auth', '/api/v1/auth/login', '/api/v1/auth/register',

  // ─── Beast-Mode: Auth Flow Endpoints ──────────────────────
  '/auth/change-password', '/auth/update-password', '/api/auth/change-password',
  '/api/auth/forgot-password', '/api/auth/reset-password', '/api/auth/verify-reset-token',
  '/auth/otp', '/auth/mfa', '/auth/two-factor', '/auth/totp', '/auth/verify-otp',
  '/api/auth/otp', '/api/auth/mfa', '/api/auth/two-factor', '/api/auth/verify-otp',
  '/api/v1/auth/forgot-password', '/api/v1/auth/reset-password',
  '/api/v1/auth/change-password', '/api/v1/auth/mfa', '/api/v1/auth/otp',
  '/auth/logout', '/api/auth/logout', '/api/v1/auth/logout',
  '/api/sessions', '/sessions', '/session/destroy',

  // ─── Beast-Mode: Admin Panel Endpoints ────────────────────
  '/j_acegi_security_check', '/manager/html', '/api/login',
  '/minio/login', '/api/auth', '/api/v1/security/login',
  '/api/whoami',

  // ─── Beast-Mode: Password & Account ───────────────────────
  '/password/change', '/password/reset', '/password/forgot',
  '/account/delete', '/account/deactivate', '/api/account/delete',
  '/api/v1/me', '/api/v1/profile', '/api/v1/account',
  '/api/v1/user/me', '/api/v1/users/me',
];

// Endpoints that should also be probed with POST (write-only routes)
const POST_PROBE_PATHS = [
  '/auth/login', '/auth/register', '/auth/signup', '/auth/refresh',
  '/auth/forgot-password', '/auth/reset-password',
  '/login', '/register', '/signup',
  '/api/auth/login', '/api/auth/register', '/api/auth/refresh',
  '/api/v1/auth/login', '/api/v1/auth/register',
  '/graphql', '/api/graphql',
];

@Injectable()
export class EndpointInventoryStage {
  private readonly logger = new Logger(EndpointInventoryStage.name);

  constructor(private readonly prisma: PrismaService) {}

  async execute(data: SecurityScanJobData): Promise<void> {
    const guardrails = data.tier === 'ADVANCED' ? GUARDRAILS.ADVANCED : GUARDRAILS.STANDARD;
    const pathList = data.tier === 'ADVANCED'
      ? [...COMMON_PATHS, ...ADVANCED_PATHS]
      : COMMON_PATHS;

    const baseUrl = data.baseUrl.replace(/\/+$/, '');
    const discovered: Array<{ path: string; method: string; status: number; source: string }> = [];
    let requestCount = 0;
    const rootFingerprint = await this.captureRootFingerprint(baseUrl, guardrails.perRequestTimeoutMs);

    // ─── EXTRACT FROM OpenAPI SCHEMA (IF PROVIDED) ────────────────
    const target = await this.prisma.securityTarget.findUnique({
      where: { id: data.targetId },
      select: { metadata: true }
    });

    const schemaUrl = (target?.metadata as Record<string, any>)?.openApiUrl as string | undefined;

    if (schemaUrl) {
      this.logger.log(`Found OpenAPI schema URL: ${schemaUrl} for scan ${data.scanId}. Extracting precise endpoints...`);
      try {
        const schemaRes = await axios.get(schemaUrl, { timeout: 10000, validateStatus: () => true });
        if (schemaRes.status === 200 && schemaRes.data && typeof schemaRes.data.paths === 'object') {
          for (const [path, methods] of Object.entries(schemaRes.data.paths)) {
            for (const method of Object.keys(methods as object)) {
              if (['get', 'post', 'put', 'patch', 'delete'].includes(method.toLowerCase())) {
                discovered.push({
                  path,
                  method: method.toUpperCase(),
                  status: 200,
                  source: 'openapi_schema',
                });
              }
            }
          }
          this.logger.log(`Successfully mapped ${discovered.length} precise endpoints from OpenAPI schema.`);
        }
      } catch (e) {
        this.logger.warn(`Failed to parse OpenAPI schema at ${schemaUrl}: ${e}`);
      }
    }

    // ─── GET probes (Fallback / Brute Force) ───────────────────
    if (discovered.length === 0) {
      this.logger.log(`No schema provided. Falling back to active endpoint discovery (Brute force)...`);
      for (const path of pathList) {
        if (requestCount >= guardrails.maxRequestsPerScan / 3) break;

        const url = `${baseUrl}${path}`;
        try {
          const parsedUrl = new URL(url);
          await assertSafeTarget(parsedUrl);

          const response = await axios.get(url, {
            timeout: guardrails.perRequestTimeoutMs,
            validateStatus: () => true,
            maxRedirects: 3,
            maxContentLength: guardrails.maxResponseSize,
            responseType: 'text',
            headers: { 'User-Agent': 'Zer0Friction-SecurityScanner/1.0' },
            lookup: buildSafeLookup() as never,
          });

          requestCount++;

          if (this.isFallbackLikeResponse(path, response, rootFingerprint)) {
            continue;
          }

          if (
            response.status < 400 ||
            response.status === 400 || // Bad Request (missing params)
            response.status === 401 || // Unauthorized
            response.status === 403 || // Forbidden
            response.status === 405 || // Method Not Allowed
            response.status === 415 || // Unsupported Media Type
            response.status === 422    // Unprocessable Entity
          ) {
            discovered.push({
              path,
              method: 'GET',
              status: response.status,
              source: 'common_path_probe',
            });
          }
        } catch {
          requestCount++;
        }
      }

      // ─── POST probes for write-only endpoints ─────────────────
      if (data.tier === 'ADVANCED') {
        for (const path of POST_PROBE_PATHS) {
          if (requestCount >= guardrails.maxRequestsPerScan / 3) break;

          const url = `${baseUrl}${path}`;
          try {
            const parsedUrl = new URL(url);
            await assertSafeTarget(parsedUrl);

            const response = await axios.post(url, {}, {
              timeout: guardrails.perRequestTimeoutMs,
              validateStatus: () => true,
              maxRedirects: 0,
              responseType: 'text',
              headers: {
                'User-Agent': 'Zer0Friction-SecurityScanner/1.0',
                'Content-Type': 'application/json',
              },
              lookup: buildSafeLookup() as never,
            });
            requestCount++;

            if (response.status !== 404) {
              discovered.push({
                path,
                method: 'POST',
                status: response.status,
                source: 'post_probe',
              });
            }
          } catch {
            requestCount++;
          }
        }
      }
    }

    // Upsert discovered endpoints
    for (const ep of discovered) {
      await this.prisma.securityEndpointInventory.upsert({
        where: {
          targetId_path_method: {
            targetId: data.targetId,
            path: ep.path,
            method: ep.method,
          },
        },
        create: {
          targetId: data.targetId,
          scanId: data.scanId,
          path: ep.path,
          method: ep.method,
          source: ep.source,
          confidence: ep.status < 400 ? 'HIGH' : 'MEDIUM',
          metadata: { statusCode: ep.status },
        },
        update: {
          lastSeenAt: new Date(),
          scanId: data.scanId,
          metadata: { statusCode: ep.status },
        },
      });
    }

    this.logger.log(`Endpoint inventory: discovered ${discovered.length} endpoints for scan ${data.scanId} (${requestCount} requests used)`);
  }

  private async captureRootFingerprint(baseUrl: string, timeoutMs: number) {
    try {
      const parsedUrl = new URL(baseUrl);
      await assertSafeTarget(parsedUrl);

      const response = await axios.get(baseUrl, {
        timeout: timeoutMs,
        validateStatus: () => true,
        maxRedirects: 5,
        maxContentLength: GUARDRAILS.ADVANCED.maxResponseSize,
        responseType: 'text',
        headers: { 'User-Agent': 'Zer0Friction-SecurityScanner/1.0' },
        lookup: buildSafeLookup() as never,
      });

      const body = String(response.data || '');
      return {
        contentType: String(response.headers['content-type'] ?? '').toLowerCase(),
        etag: String(response.headers.etag ?? ''),
        hash: this.hashBody(body),
        hasSpaRoot: /<div[^>]+id=["']root["']/i.test(body),
      };
    } catch {
      return null;
    }
  }

  private isFallbackLikeResponse(
    path: string,
    response: { status: number; headers: Record<string, unknown>; data?: unknown },
    rootFingerprint: { contentType: string; etag: string; hash: string; hasSpaRoot: boolean } | null,
  ) {
    if (!rootFingerprint || path === '/') {
      return false;
    }

    const contentType = String(response.headers['content-type'] ?? '').toLowerCase();
    if (!contentType.includes('text/html')) {
      return false;
    }

    const body = String(response.data || '');
    const bodyHash = this.hashBody(body);
    const contentDisposition = String(response.headers['content-disposition'] ?? '').toLowerCase();
    const hasSpaRoot = /<div[^>]+id=["']root["']/i.test(body);
    const sameBody = bodyHash === rootFingerprint.hash;
    const sameEtag = rootFingerprint.etag && String(response.headers.etag ?? '') === rootFingerprint.etag;
    const servesIndexHtml = contentDisposition.includes('index.html');

    return sameBody || (sameEtag && hasSpaRoot && rootFingerprint.hasSpaRoot) || (servesIndexHtml && hasSpaRoot && rootFingerprint.hasSpaRoot);
  }

  private hashBody(body: string) {
    return crypto.createHash('sha256').update(body.replace(/\s+/g, ' ').trim()).digest('hex');
  }
}
