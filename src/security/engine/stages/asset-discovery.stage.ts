import { Injectable, Logger } from '@nestjs/common';
import dns from 'node:dns';
import axios from 'axios';
import { PrismaService } from '../../../prisma/prisma.service.js';
import { assertSafeTarget, buildSafeLookup } from '../../../common/security/ssrf-guard.js';
import type { SecurityScanJobData } from '../constants.js';

/**
 * ASSET_DISCOVERY — Post-target-prep stage.
 *
 * Automatically maps the full attack surface:
 *   • Passive subdomain enumeration (DNS CNAME/A/MX/TXT)
 *   • Certificate Transparency log cross-reference (crt.sh)
 *   • Cloud asset indicators (S3, CDN, edge endpoints)
 *   • Related service discovery
 *   • Asset graph population (SecurityAsset + SecurityRelationship)
 *
 * All operations are read-only / passive — safe for production.
 */

const SUBDOMAIN_WORDLIST = [
  'www', 'api', 'app', 'staging', 'dev', 'test', 'beta', 'alpha',
  'admin', 'dashboard', 'portal', 'console', 'panel',
  'mail', 'smtp', 'imap', 'pop', 'webmail', 'mx',
  'blog', 'docs', 'wiki', 'help', 'support', 'kb',
  'cdn', 'assets', 'static', 'media', 'images', 'files',
  'status', 'monitor', 'health', 'uptime',
  'shop', 'store', 'checkout', 'pay', 'billing',
  'auth', 'login', 'sso', 'oauth', 'id', 'identity',
  'internal', 'intranet', 'vpn', 'gateway',
  'ci', 'cd', 'build', 'deploy', 'jenkins', 'gitlab',
  'db', 'database', 'redis', 'mongo', 'postgres',
  'graphql', 'gql', 'ws', 'socket', 'realtime',
  'preview', 'sandbox', 'demo', 'canary',
  'ns1', 'ns2', 'dns', 'ns',
];

const MULTI_PART_TLDS = new Set([
  'co.uk', 'co.in', 'co.jp', 'co.kr', 'co.nz', 'co.za', 'co.id',
  'com.au', 'com.br', 'com.cn', 'com.mx', 'com.sg', 'com.tw', 'com.ar',
  'org.uk', 'org.au', 'net.au', 'ac.uk', 'gov.uk', 'gov.in',
  'ne.jp', 'or.jp', 'ac.in', 'edu.au', 'edu.sg',
]);

const CLOUD_CNAME_PATTERNS: Array<{ pattern: RegExp; provider: string; assetKind: string }> = [
  { pattern: /\.s3\.amazonaws\.com$/i, provider: 'AWS S3', assetKind: 'CLOUD_STORAGE' },
  { pattern: /\.s3[.-]/i, provider: 'AWS S3', assetKind: 'CLOUD_STORAGE' },
  { pattern: /\.cloudfront\.net$/i, provider: 'AWS CloudFront', assetKind: 'CDN' },
  { pattern: /\.herokuapp\.com$/i, provider: 'Heroku', assetKind: 'WEB_APP' },
  { pattern: /\.azurewebsites\.net$/i, provider: 'Azure App Service', assetKind: 'WEB_APP' },
  { pattern: /\.blob\.core\.windows\.net$/i, provider: 'Azure Blob', assetKind: 'CLOUD_STORAGE' },
  { pattern: /\.vercel\.app$/i, provider: 'Vercel', assetKind: 'WEB_APP' },
  { pattern: /\.netlify\.app$/i, provider: 'Netlify', assetKind: 'WEB_APP' },
  { pattern: /\.pages\.dev$/i, provider: 'Cloudflare Pages', assetKind: 'WEB_APP' },
  { pattern: /\.workers\.dev$/i, provider: 'Cloudflare Workers', assetKind: 'API' },
  { pattern: /\.storage\.googleapis\.com$/i, provider: 'Google Cloud Storage', assetKind: 'CLOUD_STORAGE' },
  { pattern: /\.run\.app$/i, provider: 'Google Cloud Run', assetKind: 'API' },
  { pattern: /\.appspot\.com$/i, provider: 'Google App Engine', assetKind: 'WEB_APP' },
  { pattern: /\.firebaseapp\.com$/i, provider: 'Firebase', assetKind: 'WEB_APP' },
  { pattern: /\.github\.io$/i, provider: 'GitHub Pages', assetKind: 'WEB_APP' },
  { pattern: /\.gitlab\.io$/i, provider: 'GitLab Pages', assetKind: 'WEB_APP' },
];

function extractRootDomain(hostname: string): string {
  const parts = hostname.split('.');
  if (parts.length <= 2) return hostname;
  const lastTwo = parts.slice(-2).join('.');
  if (MULTI_PART_TLDS.has(lastTwo)) {
    return parts.length > 3 ? parts.slice(-3).join('.') : hostname;
  }
  return parts.slice(-2).join('.');
}

@Injectable()
export class AssetDiscoveryStage {
  private readonly logger = new Logger(AssetDiscoveryStage.name);

  constructor(private readonly prisma: PrismaService) {}

  async execute(data: SecurityScanJobData): Promise<void> {
    const baseUrl = data.baseUrl.replace(/\/+$/, '');
    const hostname = new URL(baseUrl).hostname;
    const rootDomain = extractRootDomain(hostname);

    const target = await this.prisma.securityTarget.findUnique({
      where: { id: data.targetId },
      include: { assets: true },
    });
    if (!target) throw new Error(`Target ${data.targetId} not found.`);

    const rootAsset = target.assets[0] ?? null;
    const discoveredAssets: Array<{
      kind: string;
      name: string;
      hostname: string;
      address: string;
      provider?: string;
      dnsRecords?: any;
      source: string;
    }> = [];

    // ─── 1. DNS-based subdomain enumeration ─────────────────────
    for (const sub of SUBDOMAIN_WORDLIST) {
      const fqdn = `${sub}.${rootDomain}`;
      if (fqdn === hostname) continue; // Skip self

      try {
        // Check A records
        const addresses = await dns.promises.resolve4(fqdn).catch(() => []);
        if (addresses.length === 0) continue;

        // Check CNAME records
        const cnames = await dns.promises.resolveCname(fqdn).catch(() => []);
        const cloudMatch = cnames.length > 0
          ? CLOUD_CNAME_PATTERNS.find(p => cnames.some(c => p.pattern.test(c)))
          : null;

        discoveredAssets.push({
          kind: cloudMatch?.assetKind || 'WEB_APP',
          name: fqdn,
          hostname: fqdn,
          address: addresses[0],
          provider: cloudMatch?.provider,
          dnsRecords: { a: addresses, cname: cnames },
          source: 'dns_subdomain_enum',
        });
      } catch {
        // DNS resolution failed — subdomain doesn't exist
      }
    }

    // ─── 2. DNS record analysis for root domain ─────────────────
    try {
      const [mxRecords, txtRecords, nsRecords] = await Promise.all([
        dns.promises.resolveMx(rootDomain).catch(() => []),
        dns.promises.resolveTxt(rootDomain).catch(() => []),
        dns.promises.resolveNs(rootDomain).catch(() => []),
      ]);

      // Store DNS topology metadata on scan
      await this.prisma.securityScan.update({
        where: { id: data.scanId },
        data: {
          assetScope: {
            ...(target.metadata as Record<string, unknown> ?? {}),
            dnsTopology: {
              rootDomain,
              mxRecords: mxRecords.map(r => ({ exchange: r.exchange, priority: r.priority })),
              txtRecords: txtRecords.map(r => r.join('')),
              nsRecords,
              discoveredSubdomains: discoveredAssets.length,
            },
          },
        },
      });

      // Check for SPF/DMARC presence
      const txtFlat = txtRecords.map(r => r.join(''));
      const hasSPF = txtFlat.some(t => t.startsWith('v=spf1'));
      const hasDMARC = txtFlat.some(t => t.startsWith('v=DMARC1'));

      if (!hasSPF || !hasDMARC) {
        await this.createAssetObservation(data, rootAsset?.id, {
          title: `Missing ${!hasSPF ? 'SPF' : ''}${!hasSPF && !hasDMARC ? ' and ' : ''}${!hasDMARC ? 'DMARC' : ''} DNS Records`,
          category: 'SECURITY_MISCONFIGURATION',
          severity: 'LOW',
          observation: `The root domain ${rootDomain} is missing ${!hasSPF ? 'SPF' : ''}${!hasSPF && !hasDMARC ? ' and ' : ''}${!hasDMARC ? 'DMARC' : ''} DNS records, which could allow email spoofing.`,
          remediation: 'Add SPF (v=spf1) and DMARC (v=DMARC1) TXT records to your DNS configuration to prevent email spoofing.',
        });
      }
    } catch (error) {
      this.logger.warn(`DNS record analysis failed for ${rootDomain}: ${error}`);
    }

    // ─── 3. Certificate Transparency lookup (crt.sh) ────────────
    try {
      const ctResponse = await axios.get(
        `https://crt.sh/?q=%.${rootDomain}&output=json`,
        { timeout: 10000, validateStatus: () => true, responseType: 'text' },
      );

      if (ctResponse.status === 200) {
        const ctData = JSON.parse(String(ctResponse.data || '[]'));
        const ctDomains = new Set<string>();

        for (const entry of ctData.slice(0, 100)) {
          const nameValue = String(entry.name_value || '');
          for (const name of nameValue.split('\n')) {
            const clean = name.trim().replace(/^\*\./, '');
            if (clean.endsWith(rootDomain) && clean !== rootDomain && !clean.includes('*')) {
              ctDomains.add(clean);
            }
          }
        }

        // Add CT-discovered domains that we didn't already find via DNS
        const alreadyFound = new Set(discoveredAssets.map(a => a.hostname));
        for (const ctDomain of ctDomains) {
          if (alreadyFound.has(ctDomain)) continue;

          try {
            const addresses = await dns.promises.resolve4(ctDomain).catch(() => []);
            if (addresses.length > 0) {
              discoveredAssets.push({
                kind: 'WEB_APP',
                name: ctDomain,
                hostname: ctDomain,
                address: addresses[0],
                source: 'certificate_transparency',
              });
            }
          } catch {
            // CT domain doesn't resolve — skip
          }
        }
      }
    } catch {
      this.logger.debug(`Certificate Transparency lookup skipped for ${rootDomain}`);
    }

    // ─── 4. Persist discovered assets ───────────────────────────
    for (const asset of discoveredAssets) {
      try {
        const existing = await this.prisma.securityAsset.findFirst({
          where: { targetId: data.targetId, hostname: asset.hostname },
        });

        if (existing) {
          // Update metadata
          await this.prisma.securityAsset.update({
            where: { id: existing.id },
            data: {
              metadata: {
                ...(existing.metadata as Record<string, unknown> ?? {}),
                lastSeen: new Date().toISOString(),
                dnsRecords: asset.dnsRecords as any,
                provider: asset.provider,
                discoverySource: asset.source,
              },
            },
          });
        } else {
          const newAsset = await this.prisma.securityAsset.create({
            data: {
              targetId: data.targetId,
              parentAssetId: rootAsset?.id,
              kind: asset.kind as never,
              name: asset.name,
              hostname: asset.hostname,
              address: asset.address,
              environment: target.environment as never,
              criticality: 'MEDIUM',
              reachability: 'EXTERNAL',
              tags: ['discovered', asset.source, asset.provider?.toLowerCase() || 'unknown'].filter(Boolean),
              metadata: {
                dnsRecords: asset.dnsRecords as any,
                provider: asset.provider,
                discoverySource: asset.source,
                discoveredAt: new Date().toISOString(),
              },
            },
          });

          // Create relationship edge
          if (rootAsset) {
            await this.prisma.securityRelationship.create({
              data: {
                targetId: data.targetId,
                fromAssetId: rootAsset.id,
                toAssetId: newAsset.id,
                kind: 'HOSTS',
                confidence: asset.source === 'dns_subdomain_enum' ? 'HIGH' : 'MEDIUM',
                metadata: {
                  discoverySource: asset.source,
                  provider: asset.provider,
                },
              },
            });
          }
        }
      } catch (error) {
        this.logger.debug(`Failed to persist asset ${asset.hostname}: ${error}`);
      }
    }

    // ─── 5. Check for potential cloud storage exposure ───────────
    const cloudAssets = discoveredAssets.filter(a => a.kind === 'CLOUD_STORAGE');
    for (const cloudAsset of cloudAssets.slice(0, 5)) {
      try {
        const checkUrl = `https://${cloudAsset.hostname}`;
        const parsedUrl = new URL(checkUrl);
        await assertSafeTarget(parsedUrl);

        const response = await axios.get(checkUrl, {
          timeout: 8000,
          validateStatus: () => true,
          maxRedirects: 3,
          responseType: 'text',
          headers: { 'User-Agent': 'Zer0Friction-SecurityScanner/1.0' },
          lookup: buildSafeLookup() as never,
        });

        const body = String(response.data || '').substring(0, 5000);

        // Check for public listing
        if (
          response.status === 200 &&
          (body.includes('<ListBucketResult') || body.includes('<ListAllMyBuckets') || body.includes('<EnumerationResults'))
        ) {
          await this.createAssetObservation(data, rootAsset?.id, {
            title: `Public Cloud Storage: ${cloudAsset.hostname}`,
            category: 'SENSITIVE_DATA_EXPOSURE',
            severity: 'CRITICAL',
            observation: `The cloud storage endpoint ${cloudAsset.hostname} (${cloudAsset.provider}) returns a public directory listing. This typically means the storage bucket is publicly accessible.`,
            remediation: `Restrict public access to the ${cloudAsset.provider} bucket. Apply least-privilege IAM policies and enable server-side encryption.`,
          });
        }
      } catch {
        // Cloud asset check failed — skip
      }
    }

    this.logger.log(
      `Asset discovery completed for scan ${data.scanId}: ${discoveredAssets.length} assets discovered ` +
      `(${cloudAssets.length} cloud, ${discoveredAssets.filter(a => a.source === 'certificate_transparency').length} via CT)`,
    );
  }

  private async createAssetObservation(
    data: SecurityScanJobData,
    rootAssetId: string | undefined,
    input: { title: string; category: string; severity: string; observation: string; remediation: string },
  ) {
    const evidence = await this.prisma.securityEvidenceArtifact.create({
      data: {
        targetId: data.targetId,
        scanId: data.scanId,
        kind: 'DNS_RECORD' as never,
        name: `${input.title} evidence`,
        summary: { category: input.category },
      },
    });

    const observation = await this.prisma.securityObservation.create({
      data: {
        scanId: data.scanId,
        targetId: data.targetId,
        category: input.category as never,
        title: input.title,
        severity: input.severity as never,
        exploitability: input.severity === 'CRITICAL' ? 'PROVEN' : 'PROBABLE',
        confidence: 'HIGH',
        proofType: 'POLICY_MISMATCH' as never,
        scenarioPackSlug: 'surface-validation',
        endpoint: '/',
        httpMethod: 'GET',
        evidenceSummary: { observation: input.observation },
        affectedAssets: rootAssetId ? [rootAssetId] : [],
        labels: [],
        remediation: input.remediation,
      },
    });

    await this.prisma.securityEvidenceArtifact.update({
      where: { id: evidence.id },
      data: { observationId: observation.id },
    });
  }
}
