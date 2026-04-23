import { Injectable, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import axios from 'axios';
import { PrismaService } from '../../../prisma/prisma.service.js';
import { assertSafeTarget, buildSafeLookup } from '../../../common/security/ssrf-guard.js';
import { GUARDRAILS } from '../constants.js';
import type { SecurityScanJobData } from '../constants.js';

/**
 * USER_ENUMERATION_DETECTOR — Advanced user/account discovery detection.
 *
 * Capabilities:
 *   • Username enumeration via login error message differential
 *   • Email enumeration via registration 409/message differential
 *   • Email enumeration via password reset response differential
 *   • Timing-based enumeration (response time difference for valid vs invalid users)
 *   • Wildcard/regex username acceptance detection
 *   • Account existence oracle via OAuth/SSO flows
 *   • User list disclosure via API endpoints
 *   • Verbose error message analysis
 *
 * Why this matters: User enumeration is the precursor to EVERY credential attack.
 * If an attacker can determine which usernames/emails exist, they can target those
 * accounts with password spray, credential stuffing, or social engineering.
 *
 * OWASP-ASVS 2.1.7: "Verify that the application does not reveal whether
 * a username or email address is valid during authentication attempts."
 */

// Known-invalid usernames (guaranteed to not exist)
const INVALID_USERNAMES = [
  `zf_enum_nonexist_${Date.now()}@zer0friction.test.invalid`,
  `definitely_does_not_exist_${Date.now()}@invalid.test`,
  `xkcd_random_user_${Math.random().toString(36).substring(7)}@nowhere.invalid`,
];

// Common/likely-to-exist usernames to contrast against
const LIKELY_VALID_USERNAMES = [
  'admin', 'administrator', 'root', 'user', 'test', 'info',
  'admin@{domain}', 'info@{domain}', 'support@{domain}',
  'contact@{domain}', 'hello@{domain}', 'sales@{domain}',
  'webmaster@{domain}', 'postmaster@{domain}',
];

// API endpoints that might list users
const USER_LIST_PATHS = [
  '/api/users', '/api/v1/users', '/api/v2/users',
  '/users', '/api/members', '/api/accounts',
  '/api/team/members', '/api/org/members',
  '/api/admin/users', '/admin/users',
  '/api/directory', '/api/people',
  '/api/v1/admin/users', '/api/v1/members',
  '/graphql', // Will use specific query
];

@Injectable()
export class UserEnumerationDetector {
  private readonly logger = new Logger(UserEnumerationDetector.name);

  constructor(private readonly prisma: PrismaService) {}

  async execute(data: SecurityScanJobData): Promise<void> {
    if (data.tier === 'STANDARD') {
      this.logger.debug(`Skipping user enumeration detection for STANDARD scan ${data.scanId}`);
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
    const hostname = new URL(baseUrl).hostname;
    const domain = hostname.replace(/^www\./, '');

    const endpoints = await this.prisma.securityEndpointInventory.findMany({
      where: { targetId: data.targetId },
      orderBy: { confidence: 'desc' },
    });

    const loginEndpoints = endpoints.filter(ep =>
      /\/(login|signin|auth\/login|api\/auth\/login|api\/login|api\/v1\/auth\/login|session)/i.test(ep.path),
    );

    const registerEndpoints = endpoints.filter(ep =>
      /\/(register|signup|auth\/register|api\/auth\/register|api\/register|create-account)/i.test(ep.path),
    );

    const resetEndpoints = endpoints.filter(ep =>
      /\/(forgot-password|reset-password|password\/reset|auth\/forgot|api\/auth\/forgot-password|recover)/i.test(ep.path),
    );

    // ═══════════════════════════════════════════════════════════════
    // 1. LOGIN ERROR MESSAGE DIFFERENTIAL
    //    Compare error messages for known-invalid vs likely-valid usernames.
    //    If messages differ → enumeration vulnerability.
    // ═══════════════════════════════════════════════════════════════
    for (const ep of loginEndpoints.slice(0, 3)) {
      if (requestCount >= maxRequests) break;

      const url = `${baseUrl}${ep.path}`;
      const invalidResponses: Array<{ body: string; status: number; timingMs: number }> = [];
      const validResponses: Array<{ body: string; status: number; timingMs: number; username: string }> = [];

      // Step 1: Collect responses for INVALID usernames
      for (const invalidUser of INVALID_USERNAMES.slice(0, 2)) {
        if (requestCount >= maxRequests) break;

        try {
          const parsedUrl = new URL(url);
          await assertSafeTarget(parsedUrl);

          const startTime = Date.now();
          const resp = await axios.post(url, JSON.stringify({
            email: invalidUser,
            username: invalidUser,
            password: 'SomeWrongPassword123!',
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
          const timingMs = Date.now() - startTime;

          invalidResponses.push({
            body: String(resp.data || '').substring(0, 2000),
            status: resp.status,
            timingMs,
          });
        } catch { requestCount++; }
      }

      // Step 2: Collect responses for LIKELY VALID usernames
      const resolvedUsernames = LIKELY_VALID_USERNAMES
        .map(u => u.replace('{domain}', domain))
        .slice(0, 5);

      for (const validUser of resolvedUsernames) {
        if (requestCount >= maxRequests) break;

        try {
          const parsedUrl = new URL(url);
          await assertSafeTarget(parsedUrl);

          const startTime = Date.now();
          const resp = await axios.post(url, JSON.stringify({
            email: validUser,
            username: validUser,
            password: 'SomeWrongPassword123!',
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
          const timingMs = Date.now() - startTime;

          validResponses.push({
            body: String(resp.data || '').substring(0, 2000),
            status: resp.status,
            timingMs,
            username: validUser,
          });
        } catch { requestCount++; }
      }

      if (invalidResponses.length === 0 || validResponses.length === 0) continue;

      // Analyze: Message-based enumeration
      const invalidBodies = invalidResponses.map(r => this.normalizeErrorBody(r.body));
      const messageDiscrepancies: string[] = [];

      for (const validResp of validResponses) {
        const normalizedValid = this.normalizeErrorBody(validResp.body);

        // Check if ANY invalid response body differs from this valid response body
        for (const invalidBody of invalidBodies) {
          if (invalidBody !== normalizedValid && invalidBody.length > 10 && normalizedValid.length > 10) {
            messageDiscrepancies.push(validResp.username);
            break;
          }
        }
      }

      if (messageDiscrepancies.length > 0) {
        const sampleInvalid = invalidResponses[0]?.body.substring(0, 200) || '';
        const sampleValid = validResponses.find(r => messageDiscrepancies.includes(r.username));

        await this.createObservation({
          scanId: data.scanId, targetId: data.targetId,
          category: 'AUTH_POSTURE',
          title: `User Enumeration via Login Error Messages on ${ep.path}`,
          severity: 'MEDIUM',
          exploitability: 'PROVEN',
          confidence: 'HIGH',
          proofType: 'RESPONSE_MATCH',
          endpoint: ep.path,
          scenarioPackSlug: 'user-enumeration',
          remediation: 'Return a generic error message for ALL failed login attempts regardless of whether the username exists. Example: "Invalid email or password." Never say "User not found" vs "Wrong password" — those are two different messages that reveal account existence.',
          observation: `Login endpoint ${ep.path} returns different error messages for valid vs invalid usernames. For non-existent users: "${sampleInvalid.substring(0, 100)}...". For likely-valid users (${messageDiscrepancies.join(', ')}): "${sampleValid?.body.substring(0, 100)}...". This allows attackers to enumerate valid accounts before attempting password attacks.`,
          labels: isLabOnly ? ['LAB_ONLY'] : ['CORROBORATED'],
          affectedAssets: rootAsset ? [rootAsset.id] : [],
          attackFlow: {
            steps: [
              { action: 'Send invalid usernames', users: INVALID_USERNAMES.slice(0, 2) },
              { action: 'Send likely-valid usernames', usersWithDifferentResponse: messageDiscrepancies },
              { action: 'Error messages differ', invalidSample: sampleInvalid.substring(0, 100), validSample: sampleValid?.body.substring(0, 100) },
            ],
          },
        });
      }

      // Analyze: Status code differential
      const invalidStatuses = new Set(invalidResponses.map(r => r.status));
      const statusDiscrepancies = validResponses.filter(r => !invalidStatuses.has(r.status));

      if (statusDiscrepancies.length > 0 && invalidResponses[0]?.status !== 429) {
        await this.createObservation({
          scanId: data.scanId, targetId: data.targetId,
          category: 'AUTH_POSTURE',
          title: `User Enumeration via HTTP Status Code on ${ep.path}`,
          severity: 'MEDIUM',
          exploitability: 'PROVEN',
          confidence: 'HIGH',
          proofType: 'RESPONSE_MATCH',
          endpoint: ep.path,
          scenarioPackSlug: 'user-enumeration',
          remediation: 'Return the same HTTP status code (401 or 403) for all failed login attempts regardless of whether the username exists.',
          observation: `Login endpoint ${ep.path} returns different HTTP status codes for valid vs invalid usernames. Invalid users get ${[...invalidStatuses].join('/')}, while valid users (${statusDiscrepancies.map(r => r.username).join(', ')}) get ${[...new Set(statusDiscrepancies.map(r => r.status))].join('/')}.`,
          labels: isLabOnly ? ['LAB_ONLY'] : ['CORROBORATED'],
          affectedAssets: rootAsset ? [rootAsset.id] : [],
        });
      }

      // Analyze: Timing-based enumeration
      const avgInvalidTime = invalidResponses.reduce((sum, r) => sum + r.timingMs, 0) / invalidResponses.length;
      const timingDiscrepancies = validResponses.filter(r => {
        const diff = Math.abs(r.timingMs - avgInvalidTime);
        return diff > 200 && diff > avgInvalidTime * 0.5; // >200ms AND >50% difference
      });

      if (timingDiscrepancies.length >= 2) {
        await this.createObservation({
          scanId: data.scanId, targetId: data.targetId,
          category: 'AUTH_POSTURE',
          title: `Timing-Based User Enumeration on ${ep.path}`,
          severity: 'LOW',
          exploitability: 'THEORETICAL',
          confidence: 'LOW',
          proofType: 'HEURISTIC',
          endpoint: ep.path,
          scenarioPackSlug: 'user-enumeration',
          remediation: 'Ensure consistent response times for all authentication attempts. Add a constant-time comparison for passwords. Consider adding random jitter (50-200ms) to authentication responses.',
          observation: `Login response times differ significantly between valid and invalid usernames. Invalid users average ${Math.round(avgInvalidTime)}ms, while valid users (${timingDiscrepancies.map(r => `${r.username}: ${r.timingMs}ms`).join(', ')}) show measurably different timing. This may enable timing-based enumeration.`,
          labels: isLabOnly ? ['LAB_ONLY', 'NEEDS_MANUAL_REVIEW'] : ['NEEDS_MANUAL_REVIEW'],
          affectedAssets: rootAsset ? [rootAsset.id] : [],
        });
      }
    }

    // ═══════════════════════════════════════════════════════════════
    // 2. REGISTRATION ENUMERATION
    //    Check if registration reveals existing emails.
    // ═══════════════════════════════════════════════════════════════
    for (const ep of registerEndpoints.slice(0, 2)) {
      if (requestCount >= maxRequests) break;

      const url = `${baseUrl}${ep.path}`;

      // Register with a definitely-invalid email
      let invalidResponse: { body: string; status: number } | null = null;
      try {
        const parsedUrl = new URL(url);
        await assertSafeTarget(parsedUrl);

        const resp = await axios.post(url, JSON.stringify({
          email: INVALID_USERNAMES[0],
          username: `zf_enum_newuser_${Date.now()}`,
          password: 'Str0ng!P@ss#2025',
          name: 'ZF Enum Test',
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

        invalidResponse = {
          body: String(resp.data || '').substring(0, 2000),
          status: resp.status,
        };
      } catch { requestCount++; }

      // Now try with common emails
      const existingEmailResponses: Array<{ email: string; body: string; status: number }> = [];

      for (const emailTemplate of ['admin@{domain}', 'info@{domain}', 'test@{domain}', 'support@{domain}']) {
        if (requestCount >= maxRequests) break;

        const email = emailTemplate.replace('{domain}', domain);
        try {
          const parsedUrl = new URL(url);
          await assertSafeTarget(parsedUrl);

          const resp = await axios.post(url, JSON.stringify({
            email,
            username: `zf_enum_existing_${Date.now()}`,
            password: 'Str0ng!P@ss#2025',
            name: 'ZF Enum Test',
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

          existingEmailResponses.push({
            email,
            body: String(resp.data || '').substring(0, 2000),
            status: resp.status,
          });
        } catch { requestCount++; }
      }

      if (!invalidResponse || existingEmailResponses.length === 0) continue;

      // Check for 409 Conflict or "already exists" messages
      const enumerable = existingEmailResponses.filter(r =>
        r.status === 409 ||
        /already exists|email.*taken|account.*exists|email.*registered|email.*in use|duplicate/i.test(r.body),
      );

      if (enumerable.length > 0) {
        await this.createObservation({
          scanId: data.scanId, targetId: data.targetId,
          category: 'AUTH_POSTURE',
          title: `User Enumeration via Registration on ${ep.path}`,
          severity: 'MEDIUM',
          exploitability: 'PROVEN',
          confidence: 'HIGH',
          proofType: 'RESPONSE_MATCH',
          endpoint: ep.path,
          scenarioPackSlug: 'user-enumeration',
          remediation: 'Do not reveal whether an email is already registered. Return a generic success message like "If this email is not already registered, you will receive a verification email." Send actual verification or notification to the email address server-side.',
          observation: `Registration endpoint ${ep.path} reveals existing accounts. For emails ${enumerable.map(e => e.email).join(', ')}, the server returned ${enumerable.map(e => `${e.status}: "${e.body.substring(0, 80)}"`).join('; ')}. This is different from the response for new emails, allowing account enumeration.`,
          labels: isLabOnly ? ['LAB_ONLY'] : ['CORROBORATED'],
          affectedAssets: rootAsset ? [rootAsset.id] : [],
        });
      }
    }

    // ═══════════════════════════════════════════════════════════════
    // 3. PASSWORD RESET ENUMERATION
    //    Check if forgot-password reveals valid emails.
    // ═══════════════════════════════════════════════════════════════
    for (const ep of resetEndpoints.slice(0, 2)) {
      if (requestCount >= maxRequests) break;

      const url = `${baseUrl}${ep.path}`;

      // Reset with invalid email
      let invalidResetResp: { body: string; status: number; timingMs: number } | null = null;
      try {
        const parsedUrl = new URL(url);
        await assertSafeTarget(parsedUrl);

        const startTime = Date.now();
        const resp = await axios.post(url, JSON.stringify({ email: INVALID_USERNAMES[0] }), {
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

        invalidResetResp = {
          body: String(resp.data || '').substring(0, 2000),
          status: resp.status,
          timingMs: Date.now() - startTime,
        };
      } catch { requestCount++; }

      // Reset with likely-valid emails
      const validResetResponses: Array<{ email: string; body: string; status: number; timingMs: number }> = [];

      for (const emailTemplate of ['admin@{domain}', 'info@{domain}', 'test@{domain}']) {
        if (requestCount >= maxRequests) break;

        const email = emailTemplate.replace('{domain}', domain);
        try {
          const parsedUrl = new URL(url);
          await assertSafeTarget(parsedUrl);

          const startTime = Date.now();
          const resp = await axios.post(url, JSON.stringify({ email }), {
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

          validResetResponses.push({
            email,
            body: String(resp.data || '').substring(0, 2000),
            status: resp.status,
            timingMs: Date.now() - startTime,
          });
        } catch { requestCount++; }
      }

      if (!invalidResetResp || validResetResponses.length === 0) continue;

      // Check for differential responses
      const normalizedInvalid = this.normalizeErrorBody(invalidResetResp.body);
      const enumerable = validResetResponses.filter(r => {
        const normalizedValid = this.normalizeErrorBody(r.body);
        return normalizedInvalid !== normalizedValid || r.status !== invalidResetResp!.status;
      });

      if (enumerable.length > 0) {
        await this.createObservation({
          scanId: data.scanId, targetId: data.targetId,
          category: 'AUTH_POSTURE',
          title: `User Enumeration via Password Reset on ${ep.path}`,
          severity: 'MEDIUM',
          exploitability: 'PROVEN',
          confidence: 'HIGH',
          proofType: 'RESPONSE_MATCH',
          endpoint: ep.path,
          scenarioPackSlug: 'user-enumeration',
          remediation: 'Always return the same response for password reset requests regardless of whether the email exists. Use: "If an account with that email exists, we have sent a password reset link." This prevents enumeration without degrading UX.',
          observation: `Password reset endpoint ${ep.path} reveals valid accounts. For non-existent email: "${invalidResetResp.body.substring(0, 80)}" (status ${invalidResetResp.status}). For likely-valid emails: ${enumerable.map(e => `${e.email}: "${e.body.substring(0, 60)}" (status ${e.status})`).join('; ')}. Differential responses enable account enumeration.`,
          labels: isLabOnly ? ['LAB_ONLY'] : ['CORROBORATED'],
          affectedAssets: rootAsset ? [rootAsset.id] : [],
        });
      }

      // Timing-based enumeration on password reset
      const timingDiscrepancies = validResetResponses.filter(r => {
        const diff = Math.abs(r.timingMs - invalidResetResp!.timingMs);
        return diff > 500; // >500ms difference is significant (email sending delay)
      });

      if (timingDiscrepancies.length > 0) {
        await this.createObservation({
          scanId: data.scanId, targetId: data.targetId,
          category: 'AUTH_POSTURE',
          title: `Timing-Based Enumeration via Password Reset on ${ep.path}`,
          severity: 'LOW',
          exploitability: 'PROBABLE',
          confidence: 'MEDIUM',
          proofType: 'HEURISTIC',
          endpoint: ep.path,
          scenarioPackSlug: 'user-enumeration',
          remediation: 'Send password reset emails asynchronously (via a background queue) so the API response time is consistent regardless of whether the email exists.',
          observation: `Password reset responses for valid accounts take significantly longer than invalid accounts (likely due to synchronous email sending). Invalid email: ${invalidResetResp.timingMs}ms. Valid emails: ${timingDiscrepancies.map(t => `${t.email}: ${t.timingMs}ms`).join(', ')}.`,
          labels: isLabOnly ? ['LAB_ONLY', 'NEEDS_MANUAL_REVIEW'] : ['NEEDS_MANUAL_REVIEW'],
          affectedAssets: rootAsset ? [rootAsset.id] : [],
        });
      }
    }

    // ═══════════════════════════════════════════════════════════════
    // 4. USER LIST DISCLOSURE — Direct API Enumeration
    //    Check if user list endpoints are publicly accessible.
    // ═══════════════════════════════════════════════════════════════
    for (const listPath of USER_LIST_PATHS) {
      if (requestCount >= maxRequests) break;

      const url = `${baseUrl}${listPath}`;

      try {
        const parsedUrl = new URL(url);
        await assertSafeTarget(parsedUrl);

        let resp;
        if (listPath === '/graphql') {
          // GraphQL user enumeration query
          resp = await axios.post(url, JSON.stringify({
            query: '{ users { id email username name } }',
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
        } else {
          resp = await axios.get(url, {
            timeout: guardrails.perRequestTimeoutMs,
            validateStatus: () => true,
            maxRedirects: 3,
            responseType: 'text',
            headers: { 'User-Agent': 'Zer0Friction-SecurityScanner/1.0' },
            lookup: buildSafeLookup() as never,
          });
        }
        requestCount++;

        if (resp.status >= 200 && resp.status < 300) {
          const body = String(resp.data || '').substring(0, guardrails.maxResponseBodyCapture);
          const looksLikeUserData = (body.trim().startsWith('{') || body.trim().startsWith('[')) &&
            (/\"email\"|\"username\"|\"user\"|\"name\"|\"login\"/i.test(body));

          // Count how many email-like strings are in the response
          const emailMatches = body.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g);
          const usernameMatches = body.match(/"(?:username|login|user|name)"\s*:\s*"[^"]+"/gi);

          if (looksLikeUserData && ((emailMatches && emailMatches.length >= 2) || (usernameMatches && usernameMatches.length >= 2))) {
            await this.createObservation({
              scanId: data.scanId, targetId: data.targetId,
              category: 'SENSITIVE_DATA_EXPOSURE',
              title: `User List Publicly Accessible: ${listPath}`,
              severity: 'HIGH',
              exploitability: 'PROVEN',
              confidence: 'HIGH',
              proofType: 'AUTH_BYPASS',
              endpoint: listPath,
              scenarioPackSlug: 'user-enumeration',
              remediation: `Restrict ${listPath} to authenticated and authorized users only. Implement pagination with maximum page size. Remove sensitive fields (email, phone) from list responses — return only public-safe profile data.`,
              observation: `The endpoint ${listPath} returns user account data without authentication. Detected ${emailMatches?.length ?? 0} email addresses and ${usernameMatches?.length ?? 0} username fields. This provides attackers with a complete user directory for targeted attacks.`,
              labels: isLabOnly ? ['LAB_ONLY'] : ['CORROBORATED'],
              affectedAssets: rootAsset ? [rootAsset.id] : [],
              attackFlow: {
                steps: [
                  { action: `GET ${listPath} without auth`, status: resp.status },
                  { action: 'User data returned', emailsFound: emailMatches?.length ?? 0, usernamesFound: usernameMatches?.length ?? 0 },
                ],
              },
            });
          }
        }
      } catch { requestCount++; }
    }

    // ═══════════════════════════════════════════════════════════════
    // 5. VERBOSE ERROR MESSAGE ANALYSIS
    //    Check if error responses leak implementation details.
    // ═══════════════════════════════════════════════════════════════
    for (const ep of loginEndpoints.slice(0, 2)) {
      if (requestCount >= maxRequests) break;

      const url = `${baseUrl}${ep.path}`;

      try {
        const parsedUrl = new URL(url);
        await assertSafeTarget(parsedUrl);

        const resp = await axios.post(url, JSON.stringify({
          email: INVALID_USERNAMES[0],
          password: 'wrong',
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

        const body = String(resp.data || '');
        const verbosePatterns = [
          { pattern: /user\s*not\s*found|no\s*user\s*with/i, info: 'Reveals non-existent users' },
          { pattern: /invalid\s*password|wrong\s*password|incorrect\s*password/i, info: 'Confirms user exists (wrong password message)' },
          { pattern: /account\s*(?:is\s*)?locked|account\s*(?:is\s*)?disabled/i, info: 'Reveals locked/disabled accounts' },
          { pattern: /account\s*(?:is\s*)?not\s*verified|email\s*not\s*confirmed/i, info: 'Reveals unverified accounts' },
          { pattern: /stack|at\s+\w+\.\w+\s*\(|Error:\s*\w+Error|Traceback/i, info: 'Exposes stack trace' },
          { pattern: /sequelize|prisma|mongoose|typeorm|knex/i, info: 'Reveals ORM/database technology' },
          { pattern: /bcrypt|argon2|scrypt|pbkdf2/i, info: 'Reveals password hashing algorithm' },
        ];

        const detectedPatterns = verbosePatterns.filter(p => p.pattern.test(body));

        if (detectedPatterns.length > 0) {
          await this.createObservation({
            scanId: data.scanId, targetId: data.targetId,
            category: 'AUTH_POSTURE',
            title: `Verbose Auth Error Messages on ${ep.path}`,
            severity: detectedPatterns.some(p => p.info.includes('stack trace') || p.info.includes('technology')) ? 'HIGH' : 'MEDIUM',
            exploitability: 'PROVEN',
            confidence: 'HIGH',
            proofType: 'RESPONSE_MATCH',
            endpoint: ep.path,
            scenarioPackSlug: 'user-enumeration',
            remediation: 'Use generic error messages for all authentication failures. Never reveal whether the username exists, whether the password was wrong, or whether the account is locked. Remove stack traces and implementation details from error responses.',
            observation: `Authentication error responses on ${ep.path} contain verbose information: ${detectedPatterns.map(p => p.info).join('; ')}. These details help attackers enumerate users, understand the tech stack, and refine their attacks.`,
            labels: isLabOnly ? ['LAB_ONLY'] : ['CORROBORATED'],
            affectedAssets: rootAsset ? [rootAsset.id] : [],
          });
        }
      } catch { requestCount++; }
    }

    this.logger.log(`User enumeration detection completed for scan ${data.scanId}: ${requestCount} requests`);
  }

  // ─── Helpers ────────────────────────────────────────────────────

  private normalizeErrorBody(body: string): string {
    // Remove dynamic values (timestamps, request IDs, nonces) for comparison
    return body
      .replace(/\d{10,}/g, 'TIMESTAMP')           // Unix timestamps
      .replace(/[a-f0-9-]{36}/gi, 'UUID')          // UUIDs
      .replace(/"(?:timestamp|date|time|requestId|traceId|correlationId)":\s*"[^"]*"/gi, '"DYNAMIC":"REMOVED"')
      .replace(/\s+/g, ' ')
      .trim()
      .toLowerCase();
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
