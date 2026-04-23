import { Injectable, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import axios from 'axios';
import { PrismaService } from '../../../prisma/prisma.service.js';
import { assertSafeTarget, buildSafeLookup } from '../../../common/security/ssrf-guard.js';
import { GUARDRAILS, buildAuthHeaders } from '../constants.js';
import type { SecurityScanJobData } from '../constants.js';

/**
 * CLIENT_SIDE_ANALYZER — Browser-level security analysis.
 *
 * Capabilities:
 *   • DOM-based XSS pattern detection in HTML responses
 *   • JavaScript endpoint extraction
 *   • CSP strength evaluation and bypass detection
 *   • Third-party script source analysis
 *   • Sensitive data in inline scripts
 *   • localStorage/sessionStorage pattern detection
 */

// DOM XSS sinks — patterns in HTML/JS that indicate dangerous code
const DOM_XSS_SINKS = [
  { pattern: /document\.write\s*\(/gi, sink: 'document.write', severity: 'HIGH' as const },
  { pattern: /\.innerHTML\s*=/gi, sink: 'innerHTML assignment', severity: 'HIGH' as const },
  { pattern: /\.outerHTML\s*=/gi, sink: 'outerHTML assignment', severity: 'HIGH' as const },
  { pattern: /eval\s*\(/gi, sink: 'eval()', severity: 'CRITICAL' as const },
  { pattern: /setTimeout\s*\(\s*['"`]/gi, sink: 'setTimeout with string', severity: 'HIGH' as const },
  { pattern: /setInterval\s*\(\s*['"`]/gi, sink: 'setInterval with string', severity: 'HIGH' as const },
  { pattern: /\.insertAdjacentHTML\s*\(/gi, sink: 'insertAdjacentHTML', severity: 'MEDIUM' as const },
  { pattern: /new\s+Function\s*\(/gi, sink: 'new Function()', severity: 'CRITICAL' as const },
  { pattern: /document\.location\s*=/gi, sink: 'document.location assignment', severity: 'MEDIUM' as const },
  { pattern: /window\.location\.href\s*=/gi, sink: 'window.location.href assignment', severity: 'MEDIUM' as const },
];

// DOM XSS sources — user-controlled inputs flowing into sinks
const DOM_XSS_SOURCES = [
  /location\.hash/gi,
  /location\.search/gi,
  /location\.href/gi,
  /document\.URL/gi,
  /document\.referrer/gi,
  /document\.cookie/gi,
  /window\.name/gi,
  /postMessage/gi,
];

// CSP bypass patterns
const CSP_WEAKNESSES = [
  { pattern: /unsafe-inline/i, weakness: 'unsafe-inline allows inline script execution', severity: 'HIGH' as const },
  { pattern: /unsafe-eval/i, weakness: 'unsafe-eval allows eval() and similar dynamic code', severity: 'HIGH' as const },
  { pattern: /\*/i, weakness: 'Wildcard source allows loading from any domain', severity: 'MEDIUM' as const },
  { pattern: /data:/i, weakness: 'data: URI scheme allows inline content injection', severity: 'MEDIUM' as const },
  { pattern: /blob:/i, weakness: 'blob: URI allows arbitrary content execution', severity: 'MEDIUM' as const },
];

// Sensitive data patterns in JS/HTML
const SENSITIVE_JS_PATTERNS = [
  { pattern: /localStorage\.setItem\s*\(\s*['"](?:token|auth|jwt|session|password|secret|api[_-]?key)/gi, name: 'Sensitive data in localStorage', severity: 'HIGH' as const },
  { pattern: /sessionStorage\.setItem\s*\(\s*['"](?:token|auth|jwt|session|password|secret|api[_-]?key)/gi, name: 'Sensitive data in sessionStorage', severity: 'MEDIUM' as const },
  { pattern: /(?:api[_-]?key|apikey|secret[_-]?key|access[_-]?token)\s*[:=]\s*['"][a-zA-Z0-9_\-]{16,}['"]/gi, name: 'Hardcoded credential in script', severity: 'HIGH' as const },
  { pattern: /(?:password|passwd|pwd)\s*[:=]\s*['"][^'"]{4,}['"]/gi, name: 'Hardcoded password in script', severity: 'CRITICAL' as const },
  { pattern: /firebase[_-]?(?:config|api[_-]?key|project[_-]?id)\s*[:=]\s*['"][^'"]+['"]/gi, name: 'Firebase config exposed', severity: 'MEDIUM' as const },
];

// Known risky third-party script sources
const RISKY_SCRIPT_DOMAINS = [
  { pattern: /cdn\.jsdelivr\.net/i, risk: 'PUBLIC_CDN', note: 'Public CDN — ensure SRI hashes are present' },
  { pattern: /unpkg\.com/i, risk: 'PUBLIC_CDN', note: 'Public CDN — vulnerable to package hijacking without SRI' },
  { pattern: /cdnjs\.cloudflare\.com/i, risk: 'PUBLIC_CDN', note: 'Public CDN — verify package integrity' },
  { pattern: /pastebin\.com|pastie\.org/i, risk: 'UNTRUSTED', note: 'Loading scripts from paste services is extremely dangerous' },
  { pattern: /raw\.githubusercontent\.com/i, risk: 'MUTABLE', note: 'Raw GitHub content can change — use pinned commits' },
];

@Injectable()
export class ClientSideAnalyzer {
  private readonly logger = new Logger(ClientSideAnalyzer.name);

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
    const authHeaders = buildAuthHeaders(data.authenticatedContext);

    // ─── Fetch HTML pages to analyze ──────────────────────────
    const pagePaths = ['/', '/login', '/dashboard', '/app', '/admin'];
    const jsUrls: string[] = [];

    for (const path of pagePaths) {
      if (requestCount >= maxRequests) break;

      const url = `${baseUrl}${path}`;
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
          const body = String(resp.data || '').substring(0, guardrails.maxResponseBodyCapture * 3);
          const contentType = String(resp.headers['content-type'] ?? '').toLowerCase();
          const csp = String(resp.headers['content-security-policy'] ?? '');

          if (contentType.includes('text/html')) {
            // 1. DOM XSS analysis
            await this.analyzeDomXss(data, body, path, rootAsset, isLabOnly);

            // 2. CSP analysis
            if (csp) {
              await this.analyzeCsp(data, csp, path, rootAsset, isLabOnly);
            }

            // 3. Extract JS file URLs
            const scriptMatches = body.matchAll(/<script[^>]+src=["']([^"']+)["']/gi);
            for (const match of scriptMatches) {
              const src = match[1];
              if (src.startsWith('http') || src.startsWith('//')) {
                jsUrls.push(src.startsWith('//') ? `https:${src}` : src);
              } else if (src.startsWith('/')) {
                jsUrls.push(`${baseUrl}${src}`);
              }
            }

            // 4. Inline script analysis for sensitive data
            const inlineScripts = body.match(/<script[^>]*>[\s\S]*?<\/script>/gi) ?? [];
            for (const script of inlineScripts.slice(0, 10)) {
              await this.analyzeInlineScript(data, script, path, rootAsset, isLabOnly);
            }

            // 5. Third-party script analysis
            await this.analyzeThirdPartyScripts(data, body, path, rootAsset, isLabOnly);

            // 6. Storage security pattern detection in inline JS
            await this.analyzeStorageUsage(data, body, path, rootAsset, isLabOnly);
          }
        }
      } catch {
        requestCount++;
      }
    }

    // ─── Fetch and analyze external JS files ──────────────────
    const uniqueJsUrls = [...new Set(jsUrls)].slice(0, 10);
    for (const jsUrl of uniqueJsUrls) {
      if (requestCount >= maxRequests) break;

      try {
        const parsedUrl = new URL(jsUrl);
        // Only analyze same-origin JS files to avoid scanning third parties
        if (parsedUrl.hostname !== new URL(baseUrl).hostname) continue;

        await assertSafeTarget(parsedUrl);

        const resp = await axios.get(jsUrl, {
          timeout: guardrails.perRequestTimeoutMs,
          validateStatus: () => true,
          maxRedirects: 3,
          responseType: 'text',
          headers: { 'User-Agent': 'Zer0Friction-SecurityScanner/1.0' },
          lookup: buildSafeLookup() as never,
        });
        requestCount++;

        if (resp.status >= 200 && resp.status < 300) {
          const jsBody = String(resp.data || '').substring(0, guardrails.maxResponseBodyCapture * 2);

          // Extract API endpoints from JS
          const apiEndpoints = this.extractEndpointsFromJs(jsBody);
          for (const apiEp of apiEndpoints.slice(0, 20)) {
            await this.prisma.securityEndpointInventory.upsert({
              where: { targetId_path_method: { targetId: data.targetId, path: apiEp, method: 'GET' } },
              update: { lastSeenAt: new Date(), source: 'JS_ANALYSIS' },
              create: {
                targetId: data.targetId,
                path: apiEp,
                method: 'GET',
                source: 'JS_ANALYSIS',
                confidence: 'LOW' as never,
                metadata: { discoveredIn: jsUrl },
              },
            });
          }

          // Scan JS for secrets
          await this.analyzeJsForSecrets(data, jsBody, jsUrl, rootAsset, isLabOnly);
        }
      } catch {
        requestCount++;
      }
    }

    this.logger.log(`Client-side analysis completed for scan ${data.scanId}: ${requestCount} requests`);
  }

  private async analyzeDomXss(
    data: SecurityScanJobData, body: string, path: string,
    rootAsset: { id: string } | null, isLabOnly: boolean,
  ) {
    const foundSinks: string[] = [];
    const foundSources: string[] = [];

    for (const sink of DOM_XSS_SINKS) {
      if (sink.pattern.test(body)) {
        foundSinks.push(sink.sink);
      }
      sink.pattern.lastIndex = 0; // Reset regex state
    }

    for (const source of DOM_XSS_SOURCES) {
      if (source.test(body)) {
        foundSources.push(source.source.replace(/\\/g, ''));
      }
      source.lastIndex = 0;
    }

    // Only flag if BOTH a source and a sink are present (potential flow)
    if (foundSinks.length > 0 && foundSources.length > 0) {
      await this.createObservation({
        scanId: data.scanId, targetId: data.targetId,
        category: 'DOM_XSS',
        title: `Potential DOM-based XSS on ${path}`,
        severity: 'HIGH',
        exploitability: 'PROBABLE',
        confidence: 'MEDIUM',
        proofType: 'HEURISTIC',
        endpoint: path,
        scenarioPackSlug: 'client-side-analysis',
        remediation: `Review identified sinks (${foundSinks.join(', ')}) and ensure user-controlled sources (${foundSources.join(', ')}) are properly sanitized before being used.`,
        observation: `Found ${foundSinks.length} DOM XSS sink(s) and ${foundSources.length} source(s) on ${path}. Sinks: ${foundSinks.join(', ')}. Sources: ${foundSources.join(', ')}. A viable injection path may exist.`,
        labels: isLabOnly ? ['LAB_ONLY', 'NEEDS_MANUAL_REVIEW'] : ['NEEDS_MANUAL_REVIEW'],
        affectedAssets: rootAsset ? [rootAsset.id] : [],
        evidenceKind: 'JS_ANALYSIS',
      });
    }
  }

  private async analyzeCsp(
    data: SecurityScanJobData, csp: string, path: string,
    rootAsset: { id: string } | null, isLabOnly: boolean,
  ) {
    const weaknesses: string[] = [];

    for (const check of CSP_WEAKNESSES) {
      if (check.pattern.test(csp)) {
        weaknesses.push(check.weakness);
      }
    }

    if (weaknesses.length > 0) {
      await this.createObservation({
        scanId: data.scanId, targetId: data.targetId,
        category: 'HEADER_SECURITY',
        title: `CSP Weaknesses Detected on ${path} (${weaknesses.length} issues)`,
        severity: weaknesses.some(w => w.includes('unsafe-eval') || w.includes('unsafe-inline')) ? 'HIGH' : 'MEDIUM',
        exploitability: 'PROBABLE',
        confidence: 'HIGH',
        proofType: 'POLICY_MISMATCH',
        endpoint: path,
        scenarioPackSlug: 'client-side-analysis',
        remediation: `Tighten CSP directives: ${weaknesses.map(w => `• ${w}`).join('. ')}`,
        observation: `Content-Security-Policy contains ${weaknesses.length} weakness(es): ${weaknesses.join('; ')}. Current CSP: ${csp.substring(0, 300)}`,
        labels: isLabOnly ? ['LAB_ONLY'] : ['CORROBORATED'],
        affectedAssets: rootAsset ? [rootAsset.id] : [],
      });
    }
  }

  private async analyzeInlineScript(
    data: SecurityScanJobData, script: string, path: string,
    rootAsset: { id: string } | null, isLabOnly: boolean,
  ) {
    for (const check of SENSITIVE_JS_PATTERNS) {
      if (check.pattern.test(script)) {
        await this.createObservation({
          scanId: data.scanId, targetId: data.targetId,
          category: 'SECRET_EXPOSURE',
          title: `${check.name} on ${path}`,
          severity: check.severity,
          exploitability: 'PROVEN',
          confidence: 'HIGH',
          proofType: 'RESPONSE_MATCH',
          endpoint: path,
          scenarioPackSlug: 'client-side-analysis',
          remediation: `Remove ${check.name.toLowerCase()} from inline scripts. Use environment variables and server-side injection.`,
          observation: `Inline script on ${path} contains ${check.name}. This is visible to all page visitors.`,
          labels: isLabOnly ? ['LAB_ONLY'] : ['CORROBORATED'],
          affectedAssets: rootAsset ? [rootAsset.id] : [],
          evidenceKind: 'STORAGE_LEAK',
        });
        check.pattern.lastIndex = 0;
        break; // One finding per script block
      }
      check.pattern.lastIndex = 0;
    }
  }

  private async analyzeThirdPartyScripts(
    data: SecurityScanJobData, body: string, path: string,
    rootAsset: { id: string } | null, isLabOnly: boolean,
  ) {
    const scriptSrcs = [...body.matchAll(/<script[^>]+src=["']([^"']+)["'][^>]*>/gi)];
    const externalScripts = scriptSrcs
      .map(m => m[1])
      .filter(src => src.startsWith('http') || src.startsWith('//'));

    for (const src of externalScripts) {
      const fullSrc = src.startsWith('//') ? `https:${src}` : src;

      // Check SRI presence
      const scriptTag = scriptSrcs.find(m => m[1] === src)?.[0] ?? '';
      const hasSri = /integrity\s*=\s*["']/i.test(scriptTag);

      for (const risk of RISKY_SCRIPT_DOMAINS) {
        if (risk.pattern.test(fullSrc) && !hasSri) {
          await this.createObservation({
            scanId: data.scanId, targetId: data.targetId,
            category: 'SECURITY_MISCONFIGURATION',
            title: `Third-party script without SRI: ${new URL(fullSrc).hostname}`,
            severity: risk.risk === 'UNTRUSTED' ? 'HIGH' : 'MEDIUM',
            exploitability: 'THEORETICAL',
            confidence: 'HIGH',
            proofType: 'POLICY_MISMATCH',
            endpoint: path,
            scenarioPackSlug: 'client-side-analysis',
            remediation: `Add Subresource Integrity (SRI) hash to the script tag for ${fullSrc}. ${risk.note}`,
            observation: `External script loaded from ${fullSrc} without SRI integrity verification. ${risk.note}`,
            labels: isLabOnly ? ['LAB_ONLY'] : [],
            affectedAssets: rootAsset ? [rootAsset.id] : [],
          });
          break;
        }
      }
    }
  }

  private async analyzeStorageUsage(
    data: SecurityScanJobData, body: string, path: string,
    rootAsset: { id: string } | null, isLabOnly: boolean,
  ) {
    for (const check of SENSITIVE_JS_PATTERNS.slice(0, 2)) { // localStorage and sessionStorage patterns
      if (check.pattern.test(body)) {
        await this.createObservation({
          scanId: data.scanId, targetId: data.targetId,
          category: 'SECRET_EXPOSURE',
          title: `${check.name}: ${path}`,
          severity: check.severity,
          exploitability: 'PROBABLE',
          confidence: 'MEDIUM',
          proofType: 'RESPONSE_MATCH',
          endpoint: path,
          scenarioPackSlug: 'client-side-analysis',
          remediation: `Avoid storing sensitive tokens in ${check.name.includes('localStorage') ? 'localStorage' : 'sessionStorage'}. Use HttpOnly cookies for session management.`,
          observation: `Page ${path} stores sensitive authentication data in browser storage, making it accessible to XSS attacks.`,
          labels: isLabOnly ? ['LAB_ONLY'] : ['NEEDS_MANUAL_REVIEW'],
          affectedAssets: rootAsset ? [rootAsset.id] : [],
          evidenceKind: 'STORAGE_LEAK',
        });
        check.pattern.lastIndex = 0;
      }
      check.pattern.lastIndex = 0;
    }
  }

  private async analyzeJsForSecrets(
    data: SecurityScanJobData, jsBody: string, jsUrl: string,
    rootAsset: { id: string } | null, isLabOnly: boolean,
  ) {
    for (const check of SENSITIVE_JS_PATTERNS) {
      if (check.pattern.test(jsBody)) {
        const jsPath = new URL(jsUrl).pathname;
        await this.createObservation({
          scanId: data.scanId, targetId: data.targetId,
          category: 'SECRET_EXPOSURE',
          title: `${check.name} in JS file: ${jsPath}`,
          severity: check.severity,
          exploitability: 'PROVEN',
          confidence: 'HIGH',
          proofType: 'RESPONSE_MATCH',
          endpoint: jsPath,
          scenarioPackSlug: 'client-side-analysis',
          remediation: `Remove ${check.name.toLowerCase()} from JavaScript bundle. Use server-side environment variables.`,
          observation: `JavaScript file at ${jsUrl} contains ${check.name}. This is publicly accessible.`,
          labels: isLabOnly ? ['LAB_ONLY'] : ['CORROBORATED'],
          affectedAssets: rootAsset ? [rootAsset.id] : [],
          evidenceKind: 'JS_ANALYSIS',
        });
        check.pattern.lastIndex = 0;
        break;
      }
      check.pattern.lastIndex = 0;
    }
  }

  private extractEndpointsFromJs(jsBody: string): string[] {
    const endpoints: Set<string> = new Set();

    // Match fetch/axios/XMLHttpRequest URL patterns
    const urlPatterns = [
      /(?:fetch|axios\.(?:get|post|put|patch|delete))\s*\(\s*['"`]([/][a-zA-Z0-9/_\-{}:.]+)['"`]/gi,
      /(?:url|endpoint|path|href)\s*[:=]\s*['"`]([/]api[/][a-zA-Z0-9/_\-{}:.]+)['"`]/gi,
      /['"`](\/api\/[a-zA-Z0-9/_\-]+)['"`]/gi,
    ];

    for (const pattern of urlPatterns) {
      let match: RegExpExecArray | null;
      while ((match = pattern.exec(jsBody)) !== null) {
        const path = match[1];
        // Normalize: remove template variables
        const cleaned = path.replace(/\{[^}]+\}/g, ':id').replace(/\$\{[^}]+\}/g, ':id');
        if (cleaned.length > 1 && cleaned.length < 200) {
          endpoints.add(cleaned);
        }
      }
    }

    return [...endpoints];
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
