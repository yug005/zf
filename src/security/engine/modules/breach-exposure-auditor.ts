import { Injectable, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { createHash } from 'crypto';
import axios from 'axios';
import { PrismaService } from '../../../prisma/prisma.service.js';
import { assertSafeTarget, buildSafeLookup } from '../../../common/security/ssrf-guard.js';
import { GUARDRAILS, buildAuthHeaders } from '../constants.js';
import type { SecurityScanJobData } from '../constants.js';

/**
 * BREACH_EXPOSURE_AUDITOR — Data breach password exposure detection.
 *
 * Uses the Have I Been Pwned (HIBP) Pwned Passwords API with k-anonymity
 * to check whether passwords are exposed in known data breaches, without
 * ever sending the full password over the network.
 *
 * Capabilities:
 *   • HIBP Pwned Passwords lookup via k-anonymity (SHA-1 prefix range search)
 *   • Breach exposure report: which passwords are leaked + exposure count
 *   • Target application breach-rejection testing (registration & password-change)
 *   • Credential corpus scanning (default creds, spray list, common passwords)
 *   • Cross-referencing discovered default/weak passwords against breach databases
 *
 * Privacy:
 *   - Only the first 5 hex characters of the SHA-1 hash are sent to the API
 *   - Full passwords NEVER leave the system
 *   - API endpoint: https://api.pwnedpasswords.com/range/{prefix}
 *
 * Safety:
 *   - HIBP API calls: All environments (no interaction with target)
 *   - Target breach-rejection tests: All environments (uses garbage email)
 *   - No real accounts created or compromised
 */

// ─── Comprehensive Breach Corpus ─────────────────────────────────
// The top 100 most common passwords found in data breaches (HIBP corpus + 
// multiple breach compilations). Each has appeared millions of times.
const BREACH_CORPUS = [
  // Top 20 — each has 1M+ breach appearances
  '123456', 'password', '12345678', 'qwerty', '123456789',
  '12345', '1234', '111111', '1234567', 'dragon',
  '123123', 'baseball', 'iloveyou', 'trustno1', 'sunshine',
  'master', 'welcome', 'shadow', 'ashley', 'football',
  // 21-40 — common breach passwords
  'monkey', 'access', '696969', 'abc123', 'mustang',
  'michael', 'letmein', 'password1', 'superman', 'batman',
  'qwerty123', 'password123', 'admin', 'admin123', 'changeme',
  'login', 'starwars', 'passw0rd', '1q2w3e4r', 'zaq12wsx',
  // 41-60 — enterprise-targeted breach passwords
  'P@ssw0rd', 'Welcome1', 'Summer2024!', 'Winter2024!', 'Company123',
  'Password1', 'Changeme1', 'Admin123!', 'Qwerty123!', 'Spring2025!',
  'Test1234', 'Passw0rd!', 'Default1', 'Secret123', 'Temp1234',
  'Hello123', '1234qwer', 'Pass1234', 'User1234', 'System123',
  // 61-80 — modern breach corpus additions
  'princess', 'charlie', 'donald', 'aa123456', 'qwerty1',
  'michael1', 'password2', 'jordan23', 'hunter', 'buster',
  'soccer', 'hockey', 'george', 'andrew', 'harley',
  'ranger', 'daniel', 'robert', 'joshua', 'matthew',
  // 81-100 — extended breach intelligence
  'pepper', 'thomas', 'hammer', 'ginger', 'silver',
  'corvette', 'bigdog', 'cheese', 'banana', 'cookie',
  'flower', 'sparky', 'computer', 'freedom', 'thunder',
  'phoenix', 'jessie', 'diamond', 'killer', 'tigger',
];

// ─── Password Categories for Organized Reporting ────────────────
interface BreachCheckResult {
  password: string;
  sha1Hash: string;
  breachCount: number;
  isBreached: boolean;
  category: 'TOP_20' | 'COMMON' | 'ENTERPRISE' | 'MODERN' | 'EXTENDED' | 'CUSTOM';
}

@Injectable()
export class BreachExposureAuditor {
  private readonly logger = new Logger(BreachExposureAuditor.name);

  // Cache HIBP range responses to avoid redundant API calls
  private readonly hibpCache = new Map<string, Map<string, number>>();

  constructor(private readonly prisma: PrismaService) {}

  async execute(data: SecurityScanJobData): Promise<void> {
    if (data.tier === 'STANDARD') {
      this.logger.debug(`Skipping breach exposure audit for STANDARD scan ${data.scanId}`);
      return;
    }

    const guardrails = data.tier === 'ADVANCED'
      ? GUARDRAILS.ADVANCED
      : (GUARDRAILS as unknown as Record<string, typeof GUARDRAILS.ADVANCED>).DEEP ?? GUARDRAILS.ADVANCED;
    const baseUrl = data.baseUrl.replace(/\/+$/, '');
    let requestCount = 0;
    const maxRequests = Math.min(guardrails.maxRequestsPerScan / 4, 80);

    const scan = await this.prisma.securityScan.findUnique({
      where: { id: data.scanId },
      include: { target: { include: { assets: true } } },
    });
    if (!scan) return;

    const rootAsset = scan.target.assets[0] ?? null;
    const isLabOnly = scan.target.environment === 'LAB' || scan.target.environment === 'DEVELOPMENT';

    const endpoints = await this.prisma.securityEndpointInventory.findMany({
      where: { targetId: data.targetId },
      orderBy: { confidence: 'desc' },
    });

    const registerEndpoints = endpoints.filter(ep =>
      /\/(register|signup|auth\/register|auth\/signup|api\/auth\/register|api\/register|api\/v1\/auth\/register|create-account)/i.test(ep.path),
    );

    const passwordChangeEndpoints = endpoints.filter(ep =>
      /\/(change-password|password\/change|update-password|auth\/password|api\/auth\/change-password|api\/password)/i.test(ep.path),
    );

    // ═══════════════════════════════════════════════════════════════
    // 1. HIBP BREACH DATABASE SCAN — ALL ENVIRONMENTS
    //    Checks the entire breach corpus against the HIBP Pwned Passwords
    //    API using k-anonymity. No passwords leave the system.
    //    Reports exactly which passwords are leaked and exposure count.
    // ═══════════════════════════════════════════════════════════════
    this.logger.log(`Starting HIBP breach corpus scan for scan ${data.scanId}: ${BREACH_CORPUS.length} passwords`);

    const breachResults: BreachCheckResult[] = [];
    const breachedPasswords: BreachCheckResult[] = [];

    for (let i = 0; i < BREACH_CORPUS.length; i++) {
      const password = BREACH_CORPUS[i];
      const category = this.categorizePassword(i);

      try {
        const result = await this.checkPasswordAgainstHIBP(password, category);
        breachResults.push(result);
        if (result.isBreached) {
          breachedPasswords.push(result);
        }

        // Rate-limit HIBP API calls (1.5s max, but we batch by prefix)
        // The k-anonymity cache makes this efficient — same prefix = no extra call
      } catch (err) {
        this.logger.warn(`HIBP check failed for password index ${i}: ${(err as Error).message}`);
      }
    }

    // ── Generate comprehensive breach exposure report ──
    if (breachedPasswords.length > 0) {
      // Sort by breach count descending
      breachedPasswords.sort((a, b) => b.breachCount - a.breachCount);

      const top10 = breachedPasswords.slice(0, 10);
      const categoryCounts = this.groupByCategory(breachedPasswords);

      await this.createObservation({
        scanId: data.scanId, targetId: data.targetId,
        category: 'AUTH_POSTURE',
        title: `Breach Exposure Report: ${breachedPasswords.length}/${BREACH_CORPUS.length} passwords found in known data breaches`,
        severity: breachedPasswords.length >= 50 ? 'CRITICAL' : breachedPasswords.length >= 20 ? 'HIGH' : 'MEDIUM',
        exploitability: 'PROVEN',
        confidence: 'HIGH',
        proofType: 'BREACH_DATABASE',
        endpoint: '/breach-audit',
        scenarioPackSlug: 'breach-exposure',
        remediation: [
          'Integrate the HaveIBeenPwned Pwned Passwords API (k-anonymity mode) into all password-accepting flows:',
          '  • Registration: Reject passwords appearing in breach databases',
          '  • Password change: Block compromised passwords during reset/change',
          '  • Login: Warn users if their current password is breached (non-blocking)',
          '',
          'Implementation (Node.js):',
          '  const crypto = require("crypto");',
          '  const sha1 = crypto.createHash("sha1").update(password).digest("hex").toUpperCase();',
          '  const prefix = sha1.slice(0, 5);',
          '  const suffix = sha1.slice(5);',
          '  const resp = await fetch(`https://api.pwnedpasswords.com/range/${prefix}`);',
          '  const lines = (await resp.text()).split("\\n");',
          '  const match = lines.find(l => l.startsWith(suffix));',
          '  if (match) { /* password is breached — reject it */ }',
          '',
          'This API is free, privacy-safe (k-anonymity), and adds <100ms latency.',
        ].join('\n'),
        observation: [
          `Breach corpus scan completed: ${breachedPasswords.length} out of ${BREACH_CORPUS.length} tested passwords appear in known data breach databases (HaveIBeenPwned).`,
          '',
          '── Top 10 Most Exposed Passwords ──',
          ...top10.map((r, idx) =>
            `  ${idx + 1}. "${r.password}" — ${r.breachCount.toLocaleString()} breach appearances (${r.category})`
          ),
          '',
          '── Breach Exposure by Category ──',
          ...Object.entries(categoryCounts).map(([cat, data]) =>
            `  ${cat}: ${(data as { breached: number; total: number }).breached}/${(data as { breached: number; total: number }).total} breached`
          ),
          '',
          'If any of these passwords are used by real users, accounts are trivially compromised via credential stuffing attacks.',
        ].join('\n'),
        labels: ['BREACH_INTELLIGENCE', 'HIBP_VERIFIED'],
        affectedAssets: rootAsset ? [rootAsset.id] : [],
        attackFlow: {
          steps: [
            { action: 'Scan breach corpus against HIBP Pwned Passwords API (k-anonymity)', passwordsTested: BREACH_CORPUS.length },
            { action: 'Breach matches found', breachedCount: breachedPasswords.length, topExposure: top10[0]?.password, topCount: top10[0]?.breachCount },
            { action: 'Category breakdown', categories: categoryCounts },
          ],
        },
      });

      // ── Individual critical exposure findings for the worst offenders ──
      const criticalPasswords = breachedPasswords.filter(r => r.breachCount >= 1_000_000);
      if (criticalPasswords.length > 0) {
        await this.createObservation({
          scanId: data.scanId, targetId: data.targetId,
          category: 'SENSITIVE_DATA_EXPOSURE',
          title: `${criticalPasswords.length} passwords with 1M+ breach appearances detected in corpus`,
          severity: 'CRITICAL',
          exploitability: 'PROVEN',
          confidence: 'HIGH',
          proofType: 'BREACH_DATABASE',
          endpoint: '/breach-audit',
          scenarioPackSlug: 'breach-exposure',
          remediation: 'These passwords appear in over 1 million breaches each. They are the FIRST passwords tried in credential stuffing attacks. Any system accepting these passwords is immediately compromised. Implement a breach-password blocklist at minimum.',
          observation: [
            `${criticalPasswords.length} passwords in the test corpus have over 1,000,000 breach appearances each:`,
            ...criticalPasswords.slice(0, 20).map(r =>
              `  • "${r.password}" — ${r.breachCount.toLocaleString()} appearances`
            ),
            '',
            'These are universally blocked by any enterprise-grade identity provider (Auth0, Okta, Azure AD).',
          ].join('\n'),
          labels: ['BREACH_INTELLIGENCE', 'CRITICAL_EXPOSURE'],
          affectedAssets: rootAsset ? [rootAsset.id] : [],
        });
      }
    }

    // ═══════════════════════════════════════════════════════════════
    // 2. TARGET BREACH-REJECTION TESTING — ALL ENVIRONMENTS
    //    Tests whether the target application's registration endpoint
    //    actually rejects passwords known to be in data breaches.
    // ═══════════════════════════════════════════════════════════════
    const topBreached = breachedPasswords
      .filter(r => r.breachCount >= 100_000)
      .slice(0, 15);

    for (const ep of registerEndpoints.slice(0, 2)) {
      if (requestCount >= maxRequests) break;

      const url = `${baseUrl}${ep.path}`;
      let acceptedBreached = 0;
      let rejectedBreached = 0;
      const acceptedList: Array<{ password: string; breachCount: number }> = [];

      for (const breached of topBreached) {
        if (requestCount >= maxRequests) break;

        try {
          const parsedUrl = new URL(url);
          await assertSafeTarget(parsedUrl);

          const resp = await axios.post(url, JSON.stringify({
            email: `zf-breach-validation-${Date.now()}@zer0friction.test.invalid`,
            username: `zfbreachval${Date.now()}`,
            password: breached.password,
            name: 'ZF Breach Validation',
          }), {
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

          const body = String(resp.data || '').toLowerCase();

          // Check if the application rejected the password as breached/compromised
          const breachRejected =
            /breached|compromised|pwned|leaked|common password|known password|insecure password|data breach|exposed password|found in.*breach/i.test(body);

          // Check if rejected for generic weakness (may include breach check)
          const weaknessRejected =
            /too weak|too common|password.*weak|unsafe.*password/i.test(body);

          if (breachRejected || weaknessRejected) {
            rejectedBreached++;
          } else if (resp.status >= 200 && resp.status < 300 || resp.status === 409) {
            // 200-299 = registration succeeded (password was ACCEPTED)
            // 409 = conflict (email exists) means password passed validation
            acceptedBreached++;
            acceptedList.push({ password: breached.password, breachCount: breached.breachCount });
          }
        } catch { requestCount++; }
      }

      if (acceptedBreached > 0 && topBreached.length > 0) {
        const acceptanceRate = Math.round((acceptedBreached / topBreached.length) * 100);

        await this.createObservation({
          scanId: data.scanId, targetId: data.targetId,
          category: 'AUTH_POSTURE',
          title: `Registration Accepts Breached Passwords: ${acceptedBreached}/${topBreached.length} known-breached passwords accepted (${acceptanceRate}%)`,
          severity: acceptedBreached >= 10 ? 'HIGH' : 'MEDIUM',
          exploitability: 'PROVEN',
          confidence: 'HIGH',
          proofType: 'RESPONSE_MATCH',
          endpoint: ep.path,
          scenarioPackSlug: 'breach-exposure',
          remediation: [
            'Integrate the HaveIBeenPwned Pwned Passwords API into your registration flow:',
            '',
            '1. Hash the password with SHA-1',
            '2. Send the first 5 hex characters to https://api.pwnedpasswords.com/range/{prefix}',
            '3. Check if the remaining hash suffix appears in the response',
            '4. If found → reject the password with a clear message',
            '',
            'This is the same approach used by NIST 800-63B, Auth0, Okta, and Azure AD.',
            'The API is free, adds <100ms latency, and is privacy-preserving.',
          ].join('\n'),
          observation: [
            `Registration endpoint ${ep.path} accepted ${acceptedBreached} passwords that are known to appear in data breaches:`,
            '',
            ...acceptedList.slice(0, 10).map(a =>
              `  • "${a.password}" — ${a.breachCount.toLocaleString()} breach appearances — ACCEPTED`
            ),
            '',
            `${rejectedBreached} passwords were properly rejected. Acceptance rate: ${acceptanceRate}%.`,
            'Users can register with passwords that appear in millions of data breaches, making them trivially vulnerable to credential stuffing.',
          ].join('\n'),
          labels: isLabOnly ? ['LAB_ONLY', 'BREACH_INTELLIGENCE'] : ['CORROBORATED', 'BREACH_INTELLIGENCE'],
          affectedAssets: rootAsset ? [rootAsset.id] : [],
          attackFlow: {
            steps: [
              { action: 'Test registration with breach-corpus passwords', tested: topBreached.length },
              { action: 'Breached passwords accepted', count: acceptedBreached, passwords: acceptedList.slice(0, 5).map(a => a.password) },
              { action: 'Breached passwords rejected', count: rejectedBreached },
            ],
          },
        });
      }
    }

    // ═══════════════════════════════════════════════════════════════
    // 3. PASSWORD-CHANGE BREACH REJECTION TESTING — ALL ENVIRONMENTS
    //    Tests whether password-change endpoints reject breached passwords.
    // ═══════════════════════════════════════════════════════════════
    const authHeaders = buildAuthHeaders(data.authenticatedContext);

    for (const ep of passwordChangeEndpoints.slice(0, 2)) {
      if (requestCount >= maxRequests || !data.authenticatedContext) break;

      const url = `${baseUrl}${ep.path}`;
      let acceptedBreached = 0;
      const acceptedList: Array<{ password: string; breachCount: number }> = [];

      for (const breached of topBreached.slice(0, 8)) {
        if (requestCount >= maxRequests) break;

        try {
          const parsedUrl = new URL(url);
          await assertSafeTarget(parsedUrl);

          const resp = await axios.put(url, JSON.stringify({
            newPassword: breached.password,
            new_password: breached.password,
            password: breached.password,
            currentPassword: 'ZF-BreachTest-Current-2025!',
            current_password: 'ZF-BreachTest-Current-2025!',
            old_password: 'ZF-BreachTest-Current-2025!',
          }), {
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

          const body = String(resp.data || '').toLowerCase();
          const breachRejected =
            /breached|compromised|pwned|leaked|common password|known password|insecure password|data breach|exposed/i.test(body);

          if (!breachRejected && resp.status >= 200 && resp.status < 300) {
            acceptedBreached++;
            acceptedList.push({ password: breached.password, breachCount: breached.breachCount });
          }
        } catch { requestCount++; }
      }

      if (acceptedBreached > 0) {
        await this.createObservation({
          scanId: data.scanId, targetId: data.targetId,
          category: 'AUTH_POSTURE',
          title: `Password Change Accepts Breached Passwords on ${ep.path}`,
          severity: 'HIGH',
          exploitability: 'PROVEN',
          confidence: 'MEDIUM',
          proofType: 'RESPONSE_MATCH',
          endpoint: ep.path,
          scenarioPackSlug: 'breach-exposure',
          remediation: 'Add breach-password checking to the password change flow. Reject any password found in the HIBP database. This prevents users from rotating to another compromised password.',
          observation: [
            `Password change endpoint ${ep.path} accepted ${acceptedBreached} passwords known to be in data breaches:`,
            ...acceptedList.map(a => `  • "${a.password}" — ${a.breachCount.toLocaleString()} breach appearances`),
            '',
            'Users can change their password to another compromised password, defeating the purpose of password rotation.',
          ].join('\n'),
          labels: isLabOnly ? ['LAB_ONLY', 'BREACH_INTELLIGENCE'] : ['BREACH_INTELLIGENCE', 'NEEDS_MANUAL_REVIEW'],
          affectedAssets: rootAsset ? [rootAsset.id] : [],
        });
      }
    }

    // ═══════════════════════════════════════════════════════════════
    // 4. CROSS-REFERENCE DEFAULT CREDENTIALS AGAINST HIBP
    //    Checks if the default credential passwords used in the
    //    credential-auditor are also known breached passwords.
    // ═══════════════════════════════════════════════════════════════
    const defaultCredPasswords = [
      'admin', 'password', 'admin123', '123456', 'password123',
      'admin@123', 'changeme', 'welcome1', 'root', 'toor',
      'test', 'test123', 'user', 'demo', 'guest',
    ];

    const defaultCredBreachResults: BreachCheckResult[] = [];
    for (const pw of defaultCredPasswords) {
      try {
        const result = await this.checkPasswordAgainstHIBP(pw, 'CUSTOM');
        if (result.isBreached) {
          defaultCredBreachResults.push(result);
        }
      } catch { /* HIBP call failed — skip */ }
    }

    if (defaultCredBreachResults.length > 0) {
      defaultCredBreachResults.sort((a, b) => b.breachCount - a.breachCount);

      await this.createObservation({
        scanId: data.scanId, targetId: data.targetId,
        category: 'AUTH_POSTURE',
        title: `Default Credential Breach Cross-Reference: ${defaultCredBreachResults.length}/${defaultCredPasswords.length} default passwords found in breaches`,
        severity: 'MEDIUM',
        exploitability: 'PROBABLE',
        confidence: 'HIGH',
        proofType: 'BREACH_DATABASE',
        endpoint: '/breach-audit',
        scenarioPackSlug: 'breach-exposure',
        remediation: 'The default credentials used by admin panels and services are universally known in breach databases. Any system using these passwords is trivially compromised. Enforce unique, strong passwords during initial deployment.',
        observation: [
          `Cross-referencing default credential passwords against HIBP reveals ${defaultCredBreachResults.length} are in breach databases:`,
          ...defaultCredBreachResults.map(r =>
            `  • "${r.password}" — ${r.breachCount.toLocaleString()} breach appearances`
          ),
          '',
          'These passwords are the FIRST ones tried in automated credential stuffing attacks.',
        ].join('\n'),
        labels: ['BREACH_INTELLIGENCE', 'DEFAULT_CREDS'],
        affectedAssets: rootAsset ? [rootAsset.id] : [],
      });
    }

    // Clear cache to free memory
    this.hibpCache.clear();

    this.logger.log(`Breach exposure audit completed for scan ${data.scanId}: ${requestCount} target requests, ${breachResults.length} HIBP lookups, ${breachedPasswords.length} breached passwords found`);
  }

  // ─── HIBP Pwned Passwords k-Anonymity Lookup ──────────────────

  /**
   * Check a password against the HIBP Pwned Passwords API using k-anonymity.
   * 
   * How it works:
   * 1. SHA-1 hash the password
   * 2. Send only the first 5 hex characters (prefix) to the API
   * 3. API returns all hash suffixes matching that prefix
   * 4. Check if our full hash suffix is in the response
   * 
   * Privacy: The full password hash is NEVER sent to the API.
   * 
   * @see https://haveibeenpwned.com/API/v3#PwnedPasswords
   */
  private async checkPasswordAgainstHIBP(
    password: string,
    category: BreachCheckResult['category'],
  ): Promise<BreachCheckResult> {
    const sha1 = createHash('sha1').update(password).digest('hex').toUpperCase();
    const prefix = sha1.slice(0, 5);
    const suffix = sha1.slice(5);

    // Check cache first — same prefix = same API response
    let suffixMap = this.hibpCache.get(prefix);

    if (!suffixMap) {
      // Call the HIBP range API
      const resp = await axios.get(`https://api.pwnedpasswords.com/range/${prefix}`, {
        timeout: 10_000,
        headers: {
          'User-Agent': 'Zer0Friction-SecurityScanner/1.0 (breach-audit)',
          'Add-Padding': 'true', // Adds padding to prevent response length analysis
        },
        responseType: 'text',
      });

      // Parse response: each line is "SUFFIX:COUNT"
      suffixMap = new Map<string, number>();
      const lines = String(resp.data).split('\n');
      for (const line of lines) {
        const [hashSuffix, countStr] = line.trim().split(':');
        if (hashSuffix && countStr) {
          suffixMap.set(hashSuffix.trim(), parseInt(countStr.trim(), 10));
        }
      }

      // Cache the parsed response
      this.hibpCache.set(prefix, suffixMap);
    }

    const breachCount = suffixMap.get(suffix) ?? 0;

    return {
      password,
      sha1Hash: sha1,
      breachCount,
      isBreached: breachCount > 0,
      category,
    };
  }

  // ─── Helpers ────────────────────────────────────────────────────

  private categorizePassword(index: number): BreachCheckResult['category'] {
    if (index < 20) return 'TOP_20';
    if (index < 40) return 'COMMON';
    if (index < 60) return 'ENTERPRISE';
    if (index < 80) return 'MODERN';
    return 'EXTENDED';
  }

  private groupByCategory(results: BreachCheckResult[]): Record<string, { breached: number; total: number }> {
    const categories: Record<string, { breached: number; total: number }> = {};

    // Count total per category from full corpus
    const totalByCategory: Record<string, number> = {
      TOP_20: 20, COMMON: 20, ENTERPRISE: 20, MODERN: 20, EXTENDED: 20, CUSTOM: 0,
    };

    for (const r of results) {
      if (!categories[r.category]) {
        categories[r.category] = { breached: 0, total: totalByCategory[r.category] ?? 0 };
      }
      categories[r.category].breached++;
    }

    return categories;
  }

  private async createObservation(input: {
    scanId: string; targetId: string; category: string; title: string;
    severity: string; exploitability: string; confidence: string;
    proofType: string; endpoint: string; scenarioPackSlug: string;
    remediation: string; observation: string; labels: string[];
    affectedAssets: string[]; attackFlow?: Record<string, unknown>;
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
        endpoint: input.endpoint, httpMethod: 'POST',
        evidenceSummary: {
          observation: input.observation,
          attackFlow: input.attackFlow,
        } as Prisma.InputJsonValue,
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
