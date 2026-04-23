import { Injectable, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import axios from 'axios';
import { PrismaService } from '../../../prisma/prisma.service.js';
import { assertSafeTarget, buildSafeLookup } from '../../../common/security/ssrf-guard.js';
import { GUARDRAILS, buildAuthHeaders } from '../constants.js';
import type { SecurityScanJobData } from '../constants.js';

/**
 * SECRETS_DETECTOR — Deep secret & credential exposure scanning.
 *
 * Extends existing sensitive data patterns in ActiveProbesStage with:
 *   • API keys in JS bundles (AWS, GCP, Stripe, SendGrid, etc.)
 *   • Tokens in API responses (verbose error messages, debug endpoints)
 *   • Exposed .env / backup / config files
 *   • Public config leaks (firebase, sentry DSN, etc.)
 *   • Evidence-rich artifacts with severity based on exposure context
 */

const SECRET_PATTERNS = [
  // ─── Cloud Provider Keys ─────────────────────────────────
  { pattern: /AKIA[0-9A-Z]{16}/g, name: 'AWS Access Key', severity: 'CRITICAL' as const, provider: 'AWS' },
  { pattern: /AIza[0-9A-Za-z_\-]{35}/g, name: 'Google API Key', severity: 'HIGH' as const, provider: 'GCP' },
  { pattern: /(?:sk|pk)_(?:live|test)_[0-9a-zA-Z]{24,}/g, name: 'Stripe API Key', severity: 'CRITICAL' as const, provider: 'Stripe' },
  { pattern: /SG\.[a-zA-Z0-9_\-]{22}\.[a-zA-Z0-9_\-]{43}/g, name: 'SendGrid API Key', severity: 'HIGH' as const, provider: 'SendGrid' },
  { pattern: /xox[bporas]-[0-9a-zA-Z\-]{10,}/g, name: 'Slack Token', severity: 'HIGH' as const, provider: 'Slack' },
  { pattern: /ghp_[a-zA-Z0-9]{36}/g, name: 'GitHub PAT', severity: 'CRITICAL' as const, provider: 'GitHub' },
  { pattern: /glpat-[a-zA-Z0-9_\-]{20,}/g, name: 'GitLab PAT', severity: 'CRITICAL' as const, provider: 'GitLab' },
  { pattern: /sk-[a-zA-Z0-9]{20}T3BlbkFJ[a-zA-Z0-9]{20}/g, name: 'OpenAI API Key', severity: 'CRITICAL' as const, provider: 'OpenAI' },

  // ─── Authentication Tokens ───────────────────────────────
  { pattern: /eyJ[a-zA-Z0-9_-]+\.eyJ[a-zA-Z0-9_-]+\.[a-zA-Z0-9_-]+/g, name: 'JWT Token', severity: 'HIGH' as const, provider: 'JWT' },
  { pattern: /-----BEGIN (?:RSA |EC |DSA )?PRIVATE KEY-----/g, name: 'Private Key', severity: 'CRITICAL' as const, provider: 'PKI' },
  { pattern: /-----BEGIN CERTIFICATE-----/g, name: 'Certificate (potentially private)', severity: 'MEDIUM' as const, provider: 'PKI' },

  // ─── Database & Infrastructure ───────────────────────────
  { pattern: /(?:mongodb|postgres|mysql|redis|amqp):\/\/[^\s<>"']+/gi, name: 'Database Connection String', severity: 'CRITICAL' as const, provider: 'Database' },
  { pattern: /(?:MONGO_URI|DATABASE_URL|REDIS_URL|DB_PASSWORD)\s*=\s*[^\s]+/g, name: 'Database Credential in Config', severity: 'CRITICAL' as const, provider: 'Database' },

  // ─── SaaS Config Leaks ───────────────────────────────────
  { pattern: /https:\/\/[a-z0-9]+\.sentry\.io\/[0-9]+/g, name: 'Sentry DSN', severity: 'MEDIUM' as const, provider: 'Sentry' },
  { pattern: /(?:NEXT_PUBLIC_|REACT_APP_|VITE_)(?:API_KEY|SECRET|TOKEN|PASSWORD)[^\s=]*\s*=\s*[^\s]+/g, name: 'Frontend Environment Variable', severity: 'MEDIUM' as const, provider: 'Framework' },
];

const BACKUP_FILE_PATHS = [
  '/.env', '/.env.production', '/.env.local', '/.env.backup',
  '/config.json', '/config.yaml', '/config.yml',
  '/database.yml', '/secrets.json', '/credentials.json',
  '/wp-config.php.bak', '/web.config.bak',
  '/.git/config', '/.git/HEAD',
  '/.svn/entries', '/.hg/hgrc',
  '/backup.sql', '/dump.sql', '/db.sql',
  '/.DS_Store', '/Thumbs.db',
  '/server.key', '/server.pem',
  '/.npmrc', '/.yarnrc', '/composer.lock',
];

@Injectable()
export class SecretsDetector {
  private readonly logger = new Logger(SecretsDetector.name);

  constructor(private readonly prisma: PrismaService) {}

  async execute(data: SecurityScanJobData): Promise<void> {
    const guardrails = data.tier === 'STANDARD' ? GUARDRAILS.STANDARD : GUARDRAILS.ADVANCED;
    const baseUrl = data.baseUrl.replace(/\/+$/, '');
    let requestCount = 0;
    const maxRequests = Math.min(guardrails.maxRequestsPerScan / 4, 60);

    const scan = await this.prisma.securityScan.findUnique({
      where: { id: data.scanId },
      include: { target: { include: { assets: true } } },
    });
    if (!scan) return;

    const rootAsset = scan.target.assets[0] ?? null;
    const isLabOnly = scan.target.environment === 'LAB' || scan.target.environment === 'DEVELOPMENT';
    const authHeaders = buildAuthHeaders(data.authenticatedContext);

    // ─── 1. Probe backup/config files ─────────────────────────
    for (const filePath of BACKUP_FILE_PATHS) {
      if (requestCount >= maxRequests) break;

      const url = `${baseUrl}${filePath}`;
      try {
        const parsedUrl = new URL(url);
        await assertSafeTarget(parsedUrl);

        const resp = await axios.get(url, {
          timeout: guardrails.perRequestTimeoutMs,
          validateStatus: () => true,
          maxRedirects: 0,
          responseType: 'text',
          headers: { 'User-Agent': 'Zer0Friction-SecurityScanner/1.0', ...authHeaders },
          lookup: buildSafeLookup() as never,
        });
        requestCount++;

        if (resp.status >= 200 && resp.status < 300) {
          const body = String(resp.data || '').substring(0, guardrails.maxResponseBodyCapture);
          const contentType = String(resp.headers['content-type'] ?? '').toLowerCase();

          // Ignore HTML responses (likely SPA fallback or custom 404)
          if (contentType.includes('text/html') && /<html|<div[^>]+id=['"]root/i.test(body)) {
            continue;
          }

          // Check if response contains actual secret-like content
          const hasSecretContent = this.containsSecrets(body);

          if (hasSecretContent) {
            const detectedSecrets = this.identifySecrets(body);

            await this.createObservation({
              scanId: data.scanId, targetId: data.targetId,
              category: 'SECRET_EXPOSURE',
              title: `Sensitive file exposed: ${filePath}`,
              severity: detectedSecrets.some(s => s.severity === 'CRITICAL') ? 'CRITICAL' : 'HIGH',
              exploitability: 'PROVEN',
              confidence: 'HIGH',
              proofType: 'RESPONSE_MATCH',
              endpoint: filePath,
              scenarioPackSlug: 'secrets-detection',
              remediation: `Block access to ${filePath} via server configuration. Add to .gitignore and remove from deployed assets. Rotate any exposed credentials immediately.`,
              observation: `The file ${filePath} is publicly accessible and contains ${detectedSecrets.length} secret pattern(s): ${detectedSecrets.map(s => s.name).join(', ')}`,
              labels: isLabOnly ? ['LAB_ONLY'] : ['CORROBORATED'],
              affectedAssets: rootAsset ? [rootAsset.id] : [],
              evidenceKind: 'HTTP_TRANSCRIPT',
            });
          }
        }
      } catch {
        requestCount++;
      }
    }

    // ─── 2. Scan known endpoint responses for leaked secrets ──
    const endpoints = await this.prisma.securityEndpointInventory.findMany({
      where: { targetId: data.targetId },
      orderBy: { confidence: 'desc' },
      take: 15,
    });

    for (const ep of endpoints) {
      if (requestCount >= maxRequests) break;

      const url = `${baseUrl}${ep.path}`;
      try {
        const parsedUrl = new URL(url);
        await assertSafeTarget(parsedUrl);

        const resp = await axios.get(url, {
          timeout: guardrails.perRequestTimeoutMs,
          validateStatus: () => true,
          maxRedirects: 3,
          responseType: 'text',
          headers: { 'User-Agent': 'Zer0Friction-SecurityScanner/1.0', ...authHeaders },
          lookup: buildSafeLookup() as never,
        });
        requestCount++;

        if (resp.status >= 200 && resp.status < 300) {
          const body = String(resp.data || '').substring(0, guardrails.maxResponseBodyCapture);
          const detectedSecrets = this.identifySecrets(body);

          if (detectedSecrets.length > 0) {
            for (const secret of detectedSecrets.slice(0, 3)) {
              await this.createObservation({
                scanId: data.scanId, targetId: data.targetId,
                category: 'SECRET_EXPOSURE',
                title: `${secret.name} leaked in API response: ${ep.path}`,
                severity: secret.severity,
                exploitability: 'PROVEN',
                confidence: 'HIGH',
                proofType: 'RESPONSE_MATCH',
                endpoint: ep.path,
                scenarioPackSlug: 'secrets-detection',
                remediation: `Remove ${secret.name} from API responses. Use environment variables for secrets. If exposed, rotate the ${secret.provider} credential immediately.`,
                observation: `API endpoint ${ep.path} returns a response containing ${secret.name} (${secret.provider}). The credential has been redacted in this report.`,
                labels: isLabOnly ? ['LAB_ONLY'] : ['CORROBORATED'],
                affectedAssets: rootAsset ? [rootAsset.id] : [],
              });
            }
          }
        }
      } catch {
        requestCount++;
      }
    }

    this.logger.log(`Secrets detection completed for scan ${data.scanId}: ${requestCount} requests`);
  }

  private containsSecrets(body: string): boolean {
    return SECRET_PATTERNS.some(p => {
      p.pattern.lastIndex = 0;
      return p.pattern.test(body);
    });
  }

  private identifySecrets(body: string): Array<{ name: string; severity: string; provider: string }> {
    const found: Array<{ name: string; severity: string; provider: string }> = [];
    const seen = new Set<string>();

    for (const check of SECRET_PATTERNS) {
      check.pattern.lastIndex = 0;
      if (check.pattern.test(body) && !seen.has(check.name)) {
        seen.add(check.name);
        found.push({ name: check.name, severity: check.severity, provider: check.provider });
      }
    }

    return found;
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
