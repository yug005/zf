import { Injectable, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import axios from 'axios';
import { PrismaService } from '../../../prisma/prisma.service.js';
import { assertSafeTarget, buildSafeLookup } from '../../../common/security/ssrf-guard.js';
import { GUARDRAILS, buildAuthHeaders } from '../constants.js';
import type { SecurityScanJobData } from '../constants.js';

/**
 * CLOUD_INFRA_PROBER — Cloud & infrastructure exposure analysis.
 *
 * Capabilities:
 *   • Exposed admin panels (phpMyAdmin, Kibana, Grafana, etc.)
 *   • Cloud metadata endpoint reachability (AWS/GCP/Azure IMDS)
 *   • Exposed services (Redis, Elasticsearch, RabbitMQ, etc.)
 *   • Bucket permission analysis (read/write/list detection)
 *   • Open port indicator detection (safe HTTP-based probing)
 */

const ADMIN_PANEL_PATHS = [
  { path: '/phpmyadmin', name: 'phpMyAdmin', severity: 'CRITICAL' as const },
  { path: '/adminer', name: 'Adminer', severity: 'CRITICAL' as const },
  { path: '/wp-admin', name: 'WordPress Admin', severity: 'HIGH' as const },
  { path: '/_kibana', name: 'Kibana', severity: 'HIGH' as const },
  { path: '/kibana', name: 'Kibana', severity: 'HIGH' as const },
  { path: '/grafana', name: 'Grafana', severity: 'HIGH' as const },
  { path: '/portainer', name: 'Portainer', severity: 'HIGH' as const },
  { path: '/jenkins', name: 'Jenkins', severity: 'CRITICAL' as const },
  { path: '/sonarqube', name: 'SonarQube', severity: 'HIGH' as const },
  { path: '/flower', name: 'Celery Flower', severity: 'MEDIUM' as const },
  { path: '/rabbitmq', name: 'RabbitMQ Management', severity: 'HIGH' as const },
  { path: '/traefik', name: 'Traefik Dashboard', severity: 'HIGH' as const },
  { path: '/consul', name: 'Consul UI', severity: 'HIGH' as const },
  { path: '/vault/ui', name: 'HashiCorp Vault', severity: 'CRITICAL' as const },
  { path: '/argocd', name: 'ArgoCD', severity: 'HIGH' as const },
  { path: '/rancher', name: 'Rancher', severity: 'HIGH' as const },
  { path: '/mailhog', name: 'MailHog', severity: 'MEDIUM' as const },
];

const ADMIN_FINGERPRINTS = [
  { pattern: /phpmyadmin|phpMyAdmin/i, name: 'phpMyAdmin' },
  { pattern: /kibana|elastic/i, name: 'Kibana/Elasticsearch' },
  { pattern: /grafana/i, name: 'Grafana' },
  { pattern: /jenkins/i, name: 'Jenkins' },
  { pattern: /portainer/i, name: 'Portainer' },
  { pattern: /rabbitmq|RabbitMQ/i, name: 'RabbitMQ' },
  { pattern: /traefik/i, name: 'Traefik' },
  { pattern: /consul/i, name: 'Consul' },
  { pattern: /vault/i, name: 'Vault' },
];

// Cloud metadata endpoints (safe, read-only probes)
const METADATA_ENDPOINTS = [
  { url: 'http://169.254.169.254/latest/meta-data/', name: 'AWS IMDS v1', provider: 'AWS' },
  { url: 'http://169.254.169.254/computeMetadata/v1/', name: 'GCP Metadata', provider: 'GCP', header: { 'Metadata-Flavor': 'Google' } },
  { url: 'http://169.254.169.254/metadata/instance?api-version=2021-02-01', name: 'Azure IMDS', provider: 'Azure', header: { 'Metadata': 'true' } },
];

// Exposed service detection via common HTTP ports
const SERVICE_PATHS = [
  { path: '/_nodes', indicator: /cluster_name|node_name/i, name: 'Elasticsearch', severity: 'HIGH' as const },
  { path: '/_cat/indices', indicator: /health|status|index/i, name: 'Elasticsearch Indices', severity: 'HIGH' as const },
  { path: '/api/v1/nodes', indicator: /apiVersion.*v1|items/i, name: 'Kubernetes API', severity: 'CRITICAL' as const },
  { path: '/api/v1/namespaces', indicator: /apiVersion.*v1|items/i, name: 'Kubernetes Namespaces', severity: 'CRITICAL' as const },
  { path: '/info', indicator: /redis_version|redis_mode/i, name: 'Redis INFO', severity: 'HIGH' as const },
  { path: '/api/queues', indicator: /message_stats|consumers/i, name: 'RabbitMQ Queues', severity: 'HIGH' as const },
  { path: '/metrics', indicator: /process_cpu|go_goroutines|http_request/i, name: 'Prometheus Metrics', severity: 'MEDIUM' as const },
];

@Injectable()
export class CloudInfraProber {
  private readonly logger = new Logger(CloudInfraProber.name);

  constructor(private readonly prisma: PrismaService) {}

  async execute(data: SecurityScanJobData): Promise<void> {
    const guardrails = data.tier === 'STANDARD' ? GUARDRAILS.STANDARD : GUARDRAILS.ADVANCED;
    const baseUrl = data.baseUrl.replace(/\/+$/, '');
    let requestCount = 0;
    const maxRequests = Math.min(guardrails.maxRequestsPerScan / 4, 50);

    const scan = await this.prisma.securityScan.findUnique({
      where: { id: data.scanId },
      include: { target: { include: { assets: true } } },
    });
    if (!scan) return;

    const rootAsset = scan.target.assets[0] ?? null;
    const isLabOnly = scan.target.environment === 'LAB' || scan.target.environment === 'DEVELOPMENT';

    // ─── 1. Admin Panel Detection ─────────────────────────────
    for (const panel of ADMIN_PANEL_PATHS) {
      if (requestCount >= maxRequests) break;

      const url = `${baseUrl}${panel.path}`;
      try {
        const parsedUrl = new URL(url);
        await assertSafeTarget(parsedUrl);

        const resp = await axios.get(url, {
          timeout: guardrails.perRequestTimeoutMs,
          validateStatus: () => true,
          maxRedirects: 3,
          responseType: 'text',
          headers: { 'User-Agent': 'Zer0Friction-SecurityScanner/1.0' },
          lookup: buildSafeLookup() as never,
        });
        requestCount++;

        if (resp.status >= 200 && resp.status < 400) {
          const body = String(resp.data || '').substring(0, guardrails.maxResponseBodyCapture);
          const contentType = String(resp.headers['content-type'] ?? '').toLowerCase();

          // Verify it's actually the admin panel, not a SPA fallback
          const isSpaFallback = contentType.includes('text/html') && /<div[^>]+id=['"]root['"]|<div[^>]+id=['"]app['"]/i.test(body);
          const isActualPanel = ADMIN_FINGERPRINTS.some(fp => fp.pattern.test(body));

          if (!isSpaFallback && (isActualPanel || resp.status === 200 && body.length > 100)) {
            const confirmed = isActualPanel;

            await this.createObservation({
              scanId: data.scanId, targetId: data.targetId,
              category: 'CLOUD_MISCONFIG',
              title: `${panel.name} Admin Panel Exposed: ${panel.path}`,
              severity: confirmed ? panel.severity : 'MEDIUM',
              exploitability: confirmed ? 'PROVEN' : 'THEORETICAL',
              confidence: confirmed ? 'HIGH' : 'LOW',
              proofType: confirmed ? 'RESPONSE_MATCH' : 'HEURISTIC',
              endpoint: panel.path,
              scenarioPackSlug: 'cloud-infrastructure',
              remediation: `Restrict access to ${panel.name} at ${panel.path} via IP allowlisting, authentication, or remove it from public-facing servers entirely.`,
              observation: `The admin panel ${panel.name} at ${panel.path} returns a ${resp.status} response. ${confirmed ? `Fingerprint confirmed: response contains ${panel.name} indicators.` : 'Fingerprint not confirmed — may be a generic response.'}`,
              labels: isLabOnly ? ['LAB_ONLY'] : confirmed ? ['CORROBORATED'] : ['NEEDS_MANUAL_REVIEW'],
              affectedAssets: rootAsset ? [rootAsset.id] : [],
            });
          }
        }
      } catch {
        requestCount++;
      }
    }

    // ─── 2. Exposed Service Detection ─────────────────────────
    for (const svc of SERVICE_PATHS) {
      if (requestCount >= maxRequests) break;

      const url = `${baseUrl}${svc.path}`;
      try {
        const parsedUrl = new URL(url);
        await assertSafeTarget(parsedUrl);

        const resp = await axios.get(url, {
          timeout: guardrails.perRequestTimeoutMs,
          validateStatus: () => true,
          maxRedirects: 0,
          responseType: 'text',
          headers: { 'User-Agent': 'Zer0Friction-SecurityScanner/1.0' },
          lookup: buildSafeLookup() as never,
        });
        requestCount++;

        if (resp.status >= 200 && resp.status < 300) {
          const body = String(resp.data || '').substring(0, guardrails.maxResponseBodyCapture);

          if (svc.indicator.test(body)) {
            await this.createObservation({
              scanId: data.scanId, targetId: data.targetId,
              category: 'CLOUD_MISCONFIG',
              title: `${svc.name} Service Exposed via ${svc.path}`,
              severity: svc.severity,
              exploitability: 'PROVEN',
              confidence: 'HIGH',
              proofType: 'RESPONSE_MATCH',
              endpoint: svc.path,
              scenarioPackSlug: 'cloud-infrastructure',
              remediation: `Restrict access to ${svc.name} at ${svc.path}. This service should not be publicly reachable. Use network segmentation or firewall rules.`,
              observation: `Detected ${svc.name} service at ${svc.path}. Response contains characteristic indicators matching the service fingerprint.`,
              labels: isLabOnly ? ['LAB_ONLY'] : ['CORROBORATED'],
              affectedAssets: rootAsset ? [rootAsset.id] : [],
            });
          }
        }
      } catch {
        requestCount++;
      }
    }

    // ─── 3. Cloud Metadata SSRF Check ─────────────────────────
    // Only test via the target (SSRF via the application)
    for (const meta of METADATA_ENDPOINTS) {
      if (requestCount >= maxRequests) break;

      // We test if the target application can be tricked into fetching metadata
      // by injecting the metadata URL as a parameter
      const endpoints = await this.prisma.securityEndpointInventory.findMany({
        where: { targetId: data.targetId },
        take: 5,
      });

      for (const ep of endpoints) {
        if (requestCount >= maxRequests) break;

        // Look for URL/redirect parameters
        const url = `${baseUrl}${ep.path}`;
        const testUrl = `${url}${url.includes('?') ? '&' : '?'}url=${encodeURIComponent(meta.url)}&redirect=${encodeURIComponent(meta.url)}`;

        try {
          const parsedUrl = new URL(testUrl);
          await assertSafeTarget(parsedUrl);

          const resp = await axios.get(testUrl, {
            timeout: guardrails.perRequestTimeoutMs,
            validateStatus: () => true,
            maxRedirects: 0,
            responseType: 'text',
            headers: { 'User-Agent': 'Zer0Friction-SecurityScanner/1.0' },
            lookup: buildSafeLookup() as never,
          });
          requestCount++;

          const body = String(resp.data || '').substring(0, guardrails.maxResponseBodyCapture);

          // Check if metadata content leaked
          if (
            body.includes('ami-') || body.includes('instance-id') ||
            body.includes('project-id') || body.includes('computeMetadata') ||
            body.includes('vmId') || body.includes('subscriptionId')
          ) {
            await this.createObservation({
              scanId: data.scanId, targetId: data.targetId,
              category: 'SSRF_POSTURE',
              title: `SSRF to ${meta.provider} Cloud Metadata via ${ep.path}`,
              severity: 'CRITICAL',
              exploitability: 'PROVEN',
              confidence: 'HIGH',
              proofType: 'RESPONSE_MATCH',
              endpoint: ep.path,
              scenarioPackSlug: 'cloud-infrastructure',
              remediation: `Block SSRF by validating all URL parameters against an allowlist. Deny requests to internal IP ranges (169.254.x.x). Enable ${meta.provider} metadata service v2 (IMDSv2) for token-based protection.`,
              observation: `Injecting ${meta.url} into ${ep.path} URL parameters caused the server to return cloud metadata content. This is a confirmed SSRF vulnerability exposing ${meta.provider} instance metadata.`,
              labels: isLabOnly ? ['LAB_ONLY'] : ['CORROBORATED'],
              affectedAssets: rootAsset ? [rootAsset.id] : [],
            });
            break; // One finding per metadata endpoint is enough
          }
        } catch {
          requestCount++;
        }
      }
    }

    // ─── 4. Cloud Storage Bucket Analysis ─────────────────────
    const assets = await this.prisma.securityAsset.findMany({
      where: { targetId: data.targetId, kind: { in: ['CLOUD_STORAGE', 'CDN'] } },
    });

    for (const asset of assets) {
      if (requestCount >= maxRequests) break;
      if (!asset.hostname) continue;

      // Check if the bucket allows listing
      try {
        const bucketUrl = `https://${asset.hostname}/`;
        const parsedUrl = new URL(bucketUrl);
        await assertSafeTarget(parsedUrl);

        const resp = await axios.get(bucketUrl, {
          timeout: guardrails.perRequestTimeoutMs,
          validateStatus: () => true,
          maxRedirects: 0,
          responseType: 'text',
          headers: { 'User-Agent': 'Zer0Friction-SecurityScanner/1.0' },
          lookup: buildSafeLookup() as never,
        });
        requestCount++;

        const body = String(resp.data || '').substring(0, guardrails.maxResponseBodyCapture);

        if (resp.status === 200 && (body.includes('<ListBucketResult') || body.includes('<Contents>'))) {
          await this.createObservation({
            scanId: data.scanId, targetId: data.targetId,
            category: 'CLOUD_MISCONFIG',
            title: `Cloud Storage Bucket Listing Enabled: ${asset.hostname}`,
            severity: 'HIGH',
            exploitability: 'PROVEN',
            confidence: 'HIGH',
            proofType: 'RESPONSE_MATCH',
            endpoint: asset.hostname,
            scenarioPackSlug: 'cloud-infrastructure',
            remediation: 'Disable public listing on the storage bucket. Configure appropriate IAM policies to restrict access.',
            observation: `The cloud storage bucket at ${asset.hostname} allows anonymous directory listing, exposing all file names and metadata.`,
            labels: isLabOnly ? ['LAB_ONLY'] : ['CORROBORATED'],
            affectedAssets: [asset.id],
          });
        }
      } catch {
        requestCount++;
      }
    }

    this.logger.log(`Cloud/infra probing completed for scan ${data.scanId}: ${requestCount} requests`);
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
