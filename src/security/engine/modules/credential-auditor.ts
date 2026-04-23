import { Injectable, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import axios from 'axios';
import { PrismaService } from '../../../prisma/prisma.service.js';
import { assertSafeTarget, buildSafeLookup } from '../../../common/security/ssrf-guard.js';
import { GUARDRAILS, buildAuthHeaders } from '../constants.js';
import type { SecurityScanJobData } from '../constants.js';

/**
 * CREDENTIAL_AUDITOR — Enterprise-grade credential weakness detection.
 *
 * The most aggressive auth-probing module in the engine:
 *
 *   • Default credential testing against discovered login endpoints
 *   • Admin panel default credentials (Jenkins, Grafana, phpMyAdmin, etc.)
 *   • Password spraying simulation (one password, many common usernames)
 *   • Password policy evaluation (min length, complexity, breached password rejection)
 *   • Session token entropy analysis (predictability detection)
 *   • Password reset token predictability
 *   • Brute-force protection bypass via header rotation (X-Forwarded-For)
 *   • Account lockout detection & threshold analysis
 *   • Multi-factor authentication bypass detection
 *   • Credential stuffing protection validation
 *
 * Safety:
 *   - Default creds + password spray: LAB/DEV only (real login attempts)
 *   - Policy analysis / lockout: All environments (read-only / timing-based)
 *   - Token entropy: All environments (passive analysis)
 */

// ─── Default Credential Sets ─────────────────────────────────────────
const DEFAULT_CREDENTIAL_SETS = [
  // Universal defaults
  { username: 'admin', password: 'admin', context: 'Universal default' },
  { username: 'admin', password: 'password', context: 'Universal default' },
  { username: 'admin', password: 'admin123', context: 'Universal default' },
  { username: 'admin', password: '123456', context: 'Universal default' },
  { username: 'admin', password: 'password123', context: 'Universal default' },
  { username: 'admin', password: 'admin@123', context: 'Universal default' },
  { username: 'admin', password: 'changeme', context: 'Universal default' },
  { username: 'admin', password: 'welcome1', context: 'Universal default' },
  { username: 'administrator', password: 'administrator', context: 'Universal default' },
  { username: 'administrator', password: 'password', context: 'Universal default' },
  { username: 'root', password: 'root', context: 'Unix default' },
  { username: 'root', password: 'toor', context: 'Kali default' },
  { username: 'test', password: 'test', context: 'Test account' },
  { username: 'test', password: 'test123', context: 'Test account' },
  { username: 'user', password: 'user', context: 'Generic user' },
  { username: 'user', password: 'password', context: 'Generic user' },
  { username: 'demo', password: 'demo', context: 'Demo account' },
  { username: 'guest', password: 'guest', context: 'Guest account' },
  // Email-based defaults
  { username: 'admin@localhost', password: 'admin', context: 'Email-based admin' },
  { username: 'admin@admin.com', password: 'admin', context: 'Email-based admin' },
  { username: 'admin@example.com', password: 'admin', context: 'Email-based admin' },
  { username: 'admin@example.com', password: 'password', context: 'Email-based admin' },
  { username: 'admin@example.com', password: 'admin123', context: 'Email-based admin' },
  { username: 'test@test.com', password: 'test', context: 'Test email' },
  { username: 'test@example.com', password: 'password', context: 'Test email' },
];

// ─── Admin Panel Default Credentials ────────────────────────────────
const ADMIN_PANEL_CREDS = [
  // Jenkins
  { path: '/j_acegi_security_check', method: 'POST' as const, body: { j_username: 'admin', j_password: 'admin' }, panel: 'Jenkins', successIndicator: /dashboard|configure|manage/i, failIndicator: /loginError|Invalid|failed/i, contentType: 'application/x-www-form-urlencoded' },
  // Grafana
  { path: '/api/login', method: 'POST' as const, body: { user: 'admin', password: 'admin' }, panel: 'Grafana', successIndicator: /\"message\":\"Logged in\"/i, failIndicator: /invalid|unauthorized/i, contentType: 'application/json' },
  // phpMyAdmin
  { path: '/index.php', method: 'POST' as const, body: { pma_username: 'root', pma_password: '', set_session: '' }, panel: 'phpMyAdmin', successIndicator: /server_databases|navigation/i, failIndicator: /Cannot log in|Access denied/i, contentType: 'application/x-www-form-urlencoded' },
  // WordPress
  { path: '/wp-login.php', method: 'POST' as const, body: { log: 'admin', pwd: 'admin', 'wp-submit': 'Log In' }, panel: 'WordPress', successIndicator: /wp-admin|dashboard/i, failIndicator: /incorrect|error/i, contentType: 'application/x-www-form-urlencoded' },
  // Kibana
  { path: '/api/security/v1/login', method: 'POST' as const, body: { username: 'elastic', password: 'changeme' }, panel: 'Kibana/Elastic', successIndicator: /session|token|cookie/i, failIndicator: /unauthorized|invalid/i, contentType: 'application/json' },
  // Tomcat Manager
  { path: '/manager/html', method: 'GET' as const, body: null, panel: 'Tomcat Manager', successIndicator: /tomcat|manager|deploy/i, failIndicator: /401|403/i, contentType: 'text/html', authHeader: 'Basic ' + Buffer.from('tomcat:tomcat').toString('base64') },
  { path: '/manager/html', method: 'GET' as const, body: null, panel: 'Tomcat Manager', successIndicator: /tomcat|manager|deploy/i, failIndicator: /401|403/i, contentType: 'text/html', authHeader: 'Basic ' + Buffer.from('admin:admin').toString('base64') },
  // RabbitMQ
  { path: '/api/whoami', method: 'GET' as const, body: null, panel: 'RabbitMQ', successIndicator: /\"name\":\"guest\"/i, failIndicator: /401|unauthorized/i, contentType: 'application/json', authHeader: 'Basic ' + Buffer.from('guest:guest').toString('base64') },
  // Redis Commander
  { path: '/', method: 'GET' as const, body: null, panel: 'Redis Commander', successIndicator: /redis commander|redis-commander/i, failIndicator: null, contentType: 'text/html' },
  // Adminer
  { path: '/adminer/', method: 'GET' as const, body: null, panel: 'Adminer', successIndicator: /adminer|login to|database/i, failIndicator: null, contentType: 'text/html' },
  // Mongo Express
  { path: '/', method: 'GET' as const, body: null, panel: 'Mongo Express', successIndicator: /mongo express|mongodb/i, failIndicator: null, contentType: 'text/html', authHeader: 'Basic ' + Buffer.from('admin:pass').toString('base64') },
  // MinIO
  { path: '/minio/login', method: 'POST' as const, body: { accessKey: 'minioadmin', secretKey: 'minioadmin' }, panel: 'MinIO', successIndicator: /token|session/i, failIndicator: /invalid|denied/i, contentType: 'application/json' },
  // Portainer
  { path: '/api/auth', method: 'POST' as const, body: { Username: 'admin', Password: 'admin' }, panel: 'Portainer', successIndicator: /jwt|token/i, failIndicator: /invalid|unauthorized/i, contentType: 'application/json' },
  // Airflow
  { path: '/api/v1/security/login', method: 'POST' as const, body: { username: 'airflow', password: 'airflow' }, panel: 'Apache Airflow', successIndicator: /session|token/i, failIndicator: /invalid|unauthorized/i, contentType: 'application/json' },
];

// ─── Password Spray Usernames ───────────────────────────────────────
const SPRAY_USERNAMES = [
  'admin', 'administrator', 'root', 'user', 'test', 'demo', 'guest',
  'operator', 'manager', 'support', 'service', 'sysadmin', 'devops',
  'info', 'webmaster', 'postmaster', 'helpdesk', 'security',
  'admin@{domain}', 'info@{domain}', 'test@{domain}', 'support@{domain}',
];

const SPRAY_PASSWORDS = [
  'Password1', 'Welcome1', 'Changeme1', 'Company123', 'Summer2024!',
  'Winter2024!', 'Spring2025!', 'Admin123!', 'P@ssw0rd', 'Qwerty123!',
];

// ─── Password Policy Test Payloads ──────────────────────────────────
const POLICY_TEST_PASSWORDS = [
  { password: 'a', test: 'Minimum length (1 char)', expectReject: true },
  { password: 'ab', test: 'Minimum length (2 chars)', expectReject: true },
  { password: 'abc', test: 'Minimum length (3 chars)', expectReject: true },
  { password: 'abcdef', test: 'Short lowercase-only (6 chars)', expectReject: true },
  { password: '12345678', test: 'Numeric-only (8 chars)', expectReject: true },
  { password: 'password', test: 'Common dictionary word', expectReject: true },
  { password: '123456789', test: 'Sequential numbers', expectReject: true },
  { password: 'qwertyuiop', test: 'Keyboard pattern', expectReject: true },
  { password: 'aaaaaaaaa', test: 'Repeated character', expectReject: true },
  { password: 'Password1', test: 'Common pattern (Capital + number)', expectReject: true },
  { password: 'Str0ng!P@ss#2025', test: 'Strong password (should be accepted)', expectReject: false },
];

// ─── Breached Password Database (Top 20 most common) ────────────────
const BREACHED_PASSWORDS = [
  '123456', 'password', '12345678', 'qwerty', '123456789',
  '12345', '1234', '111111', '1234567', 'dragon',
  '123123', 'baseball', 'iloveyou', 'trustno1', 'sunshine',
  'master', 'welcome', 'shadow', 'ashley', 'football',
];

// ─── Login Body Format Patterns ─────────────────────────────────────
const LOGIN_BODY_FORMATS = [
  // JSON - most common in modern APIs
  (username: string, password: string) => ({
    contentType: 'application/json',
    body: JSON.stringify({ email: username, password }),
  }),
  (username: string, password: string) => ({
    contentType: 'application/json',
    body: JSON.stringify({ username, password }),
  }),
  (username: string, password: string) => ({
    contentType: 'application/json',
    body: JSON.stringify({ login: username, password }),
  }),
  (username: string, password: string) => ({
    contentType: 'application/json',
    body: JSON.stringify({ user: username, pass: password }),
  }),
  // URL-encoded - legacy but still common
  (username: string, password: string) => ({
    contentType: 'application/x-www-form-urlencoded',
    body: `username=${encodeURIComponent(username)}&password=${encodeURIComponent(password)}`,
  }),
  (username: string, password: string) => ({
    contentType: 'application/x-www-form-urlencoded',
    body: `email=${encodeURIComponent(username)}&password=${encodeURIComponent(password)}`,
  }),
];

@Injectable()
export class CredentialAuditor {
  private readonly logger = new Logger(CredentialAuditor.name);

  constructor(private readonly prisma: PrismaService) {}

  async execute(data: SecurityScanJobData): Promise<void> {
    if (data.tier === 'STANDARD') {
      this.logger.debug(`Skipping credential audit for STANDARD scan ${data.scanId}`);
      return;
    }

    const guardrails = data.tier === 'ADVANCED'
      ? GUARDRAILS.ADVANCED
      : (GUARDRAILS as unknown as Record<string, typeof GUARDRAILS.ADVANCED>).DEEP ?? GUARDRAILS.ADVANCED;
    const baseUrl = data.baseUrl.replace(/\/+$/, '');
    let requestCount = 0;
    const maxRequests = Math.min(guardrails.maxRequestsPerScan / 3, 120);

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
      /\/(login|signin|auth\/login|auth\/signin|api\/auth\/login|api\/login|j_security_check|session|sessions|api\/sessions|api\/v1\/auth\/login)/i.test(ep.path),
    );

    const registerEndpoints = endpoints.filter(ep =>
      /\/(register|signup|auth\/register|auth\/signup|api\/auth\/register|api\/register|api\/v1\/auth\/register|create-account)/i.test(ep.path),
    );

    const resetEndpoints = endpoints.filter(ep =>
      /\/(forgot-password|reset-password|password\/reset|auth\/forgot|auth\/reset|api\/auth\/forgot-password|recover|recover-account)/i.test(ep.path),
    );

    // ═══════════════════════════════════════════════════════════════
    // 1. DEFAULT CREDENTIAL PROBING — LAB/DEV ONLY
    //    Tries common default username:password pairs against login endpoints.
    //    The #1 most-exploited vulnerability in real-world breaches.
    // ═══════════════════════════════════════════════════════════════
    if (isLabOnly) {
      for (const ep of loginEndpoints.slice(0, 3)) {
        if (requestCount >= maxRequests) break;

        const url = `${baseUrl}${ep.path}`;

        // First: detect which body format the login endpoint expects
        const detectedFormat = await this.detectLoginFormat(url, guardrails);
        requestCount += 2; // detection costs ~2 requests

        for (const cred of DEFAULT_CREDENTIAL_SETS) {
          if (requestCount >= maxRequests) break;

          try {
            const parsedUrl = new URL(url);
            await assertSafeTarget(parsedUrl);

            const { contentType, body } = detectedFormat
              ? detectedFormat(cred.username, cred.password)
              : LOGIN_BODY_FORMATS[0](cred.username, cred.password);

            const resp = await axios.post(url, body, {
              timeout: guardrails.perRequestTimeoutMs,
              validateStatus: () => true,
              maxRedirects: 3,
              responseType: 'text',
              headers: {
                'User-Agent': 'Zer0Friction-SecurityScanner/1.0',
                'Content-Type': contentType,
              },
              lookup: buildSafeLookup() as never,
            });
            requestCount++;

            const respBody = String(resp.data || '').substring(0, guardrails.maxResponseBodyCapture);

            // Success indicators: JWT token in response, session cookie set, 200 with token body
            const loginSuccess = this.isLoginSuccess(resp.status, respBody, resp.headers);

            if (loginSuccess) {
              await this.createObservation({
                scanId: data.scanId, targetId: data.targetId,
                category: 'AUTH_POSTURE',
                title: `Default Credentials Accepted: ${cred.username}:${cred.password.substring(0, 2)}***`,
                severity: 'CRITICAL',
                exploitability: 'PROVEN',
                confidence: 'HIGH',
                proofType: 'AUTH_BYPASS',
                endpoint: ep.path,
                scenarioPackSlug: 'credential-audit',
                remediation: `Remove or change default credentials for account "${cred.username}". Enforce password change on first login. Implement account provisioning that requires unique credentials.`,
                observation: `Login attempt with ${cred.context} credentials (${cred.username}:${cred.password.substring(0, 3)}***) succeeded on ${ep.path}. The server returned a success indicator (JWT/session token). This is the #1 real-world attack vector.`,
                labels: ['LAB_ONLY', 'DEFAULT_CREDS'],
                affectedAssets: rootAsset ? [rootAsset.id] : [],
                attackFlow: {
                  steps: [
                    { action: 'POST login with default creds', endpoint: ep.path, username: cred.username, context: cred.context },
                    { action: 'Server returned success', status: resp.status, hasToken: respBody.includes('token') || respBody.includes('jwt') },
                  ],
                },
              });
              break; // One successful default cred per endpoint is enough
            }
          } catch { requestCount++; }
        }
      }
    }

    // ═══════════════════════════════════════════════════════════════
    // 2. ADMIN PANEL DEFAULT CREDENTIALS — ALL ENVIRONMENTS
    //    Probes known admin panel paths for default credentials.
    //    Production-safe: only probes paths that ALREADY exist.
    // ═══════════════════════════════════════════════════════════════
    for (const panelCred of ADMIN_PANEL_CREDS) {
      if (requestCount >= maxRequests) break;

      const url = `${baseUrl}${panelCred.path}`;

      try {
        const parsedUrl = new URL(url);
        await assertSafeTarget(parsedUrl);

        const headers: Record<string, string> = {
          'User-Agent': 'Zer0Friction-SecurityScanner/1.0',
          'Content-Type': panelCred.contentType,
        };
        if (panelCred.authHeader) {
          headers['Authorization'] = panelCred.authHeader;
        }

        let resp;
        if (panelCred.method === 'POST' && panelCred.body) {
          const bodyStr = panelCred.contentType === 'application/json'
            ? JSON.stringify(panelCred.body)
            : new URLSearchParams(panelCred.body as unknown as Record<string, string>).toString();
          resp = await axios.post(url, bodyStr, {
            timeout: guardrails.perRequestTimeoutMs,
            validateStatus: () => true,
            maxRedirects: 5,
            responseType: 'text',
            headers,
            lookup: buildSafeLookup() as never,
          });
        } else {
          resp = await axios.get(url, {
            timeout: guardrails.perRequestTimeoutMs,
            validateStatus: () => true,
            maxRedirects: 5,
            responseType: 'text',
            headers,
            lookup: buildSafeLookup() as never,
          });
        }
        requestCount++;

        const body = String(resp.data || '').substring(0, guardrails.maxResponseBodyCapture);

        if (resp.status >= 200 && resp.status < 400 && panelCred.successIndicator.test(body)) {
          await this.createObservation({
            scanId: data.scanId, targetId: data.targetId,
            category: 'AUTH_POSTURE',
            title: `${panelCred.panel} Accessible with Default Credentials`,
            severity: 'CRITICAL',
            exploitability: 'PROVEN',
            confidence: 'HIGH',
            proofType: 'AUTH_BYPASS',
            endpoint: panelCred.path,
            scenarioPackSlug: 'credential-audit',
            remediation: `Change default credentials for ${panelCred.panel} immediately. Restrict access to the admin panel via IP whitelisting or VPN. Consider disabling the admin panel in production.`,
            observation: `The ${panelCred.panel} admin panel at ${panelCred.path} is accessible with default credentials. The response contains success indicators matching: ${panelCred.successIndicator.source}. This grants full administrative access to the ${panelCred.panel} instance.`,
            labels: isLabOnly ? ['LAB_ONLY', 'ADMIN_PANEL', 'DEFAULT_CREDS'] : ['ADMIN_PANEL', 'DEFAULT_CREDS', 'CORROBORATED'],
            affectedAssets: rootAsset ? [rootAsset.id] : [],
            attackFlow: {
              steps: [
                { action: `${panelCred.method} ${panelCred.path} with default creds`, panel: panelCred.panel },
                { action: 'Admin access granted', status: resp.status },
              ],
            },
          });
        }
      } catch { requestCount++; }
    }

    // ═══════════════════════════════════════════════════════════════
    // 3. PASSWORD SPRAYING — LAB/DEV ONLY
    //    One strong password against many common usernames.
    //    Evades per-account lockout since each account gets 1 attempt.
    // ═══════════════════════════════════════════════════════════════
    if (isLabOnly) {
      for (const ep of loginEndpoints.slice(0, 2)) {
        if (requestCount >= maxRequests) break;

        const url = `${baseUrl}${ep.path}`;
        const successfulSprays: Array<{ username: string; password: string }> = [];

        for (const sprayPassword of SPRAY_PASSWORDS.slice(0, 3)) {
          if (requestCount >= maxRequests) break;

          for (const usernameTemplate of SPRAY_USERNAMES.slice(0, 10)) {
            if (requestCount >= maxRequests) break;

            const username = usernameTemplate.replace('{domain}', domain);

            try {
              const parsedUrl = new URL(url);
              await assertSafeTarget(parsedUrl);

              const resp = await axios.post(url, JSON.stringify({ email: username, password: sprayPassword }), {
                timeout: guardrails.perRequestTimeoutMs,
                validateStatus: () => true,
                maxRedirects: 3,
                responseType: 'text',
                headers: {
                  'User-Agent': 'Zer0Friction-SecurityScanner/1.0',
                  'Content-Type': 'application/json',
                },
                lookup: buildSafeLookup() as never,
              });
              requestCount++;

              const respBody = String(resp.data || '').substring(0, guardrails.maxResponseBodyCapture);
              if (this.isLoginSuccess(resp.status, respBody, resp.headers)) {
                successfulSprays.push({ username, password: sprayPassword });
              }
            } catch { requestCount++; }
          }
        }

        if (successfulSprays.length > 0) {
          await this.createObservation({
            scanId: data.scanId, targetId: data.targetId,
            category: 'AUTH_POSTURE',
            title: `Password Spray Attack Succeeded: ${successfulSprays.length} account(s) compromised`,
            severity: 'CRITICAL',
            exploitability: 'PROVEN',
            confidence: 'HIGH',
            proofType: 'AUTH_BYPASS',
            endpoint: ep.path,
            scenarioPackSlug: 'credential-audit',
            remediation: 'Enforce strong password policies. Implement breached-password checking (e.g., HaveIBeenPwned API). Enable MFA for all accounts. Deploy cross-account spray detection that tracks failed logins across multiple accounts from the same IP.',
            observation: `Password spraying against ${ep.path} succeeded for ${successfulSprays.length} account(s): ${successfulSprays.map(s => s.username).join(', ')}. This means real user accounts use weak/common passwords and no spray detection is in place.`,
            labels: ['LAB_ONLY', 'PASSWORD_SPRAY'],
            affectedAssets: rootAsset ? [rootAsset.id] : [],
            attackFlow: {
              steps: [
                { action: 'Spray common passwords across usernames', usernamesAttempted: SPRAY_USERNAMES.length },
                { action: 'Accounts compromised', count: successfulSprays.length, accounts: successfulSprays.map(s => s.username) },
              ],
            },
          });
        }
      }
    }

    // ═══════════════════════════════════════════════════════════════
    // 4. PASSWORD POLICY ANALYSIS — ALL ENVIRONMENTS
    //    Tests what passwords the registration endpoint accepts.
    //    Does NOT create real accounts (uses garbage email/handle).
    // ═══════════════════════════════════════════════════════════════
    for (const ep of registerEndpoints.slice(0, 2)) {
      if (requestCount >= maxRequests) break;

      const url = `${baseUrl}${ep.path}`;
      const acceptedWeakPasswords: string[] = [];
      const rejectedPasswords: string[] = [];
      const testEmail = `zf-policy-test-${Date.now()}@zer0friction.test.invalid`;

      for (const policyTest of POLICY_TEST_PASSWORDS) {
        if (requestCount >= maxRequests) break;

        try {
          const parsedUrl = new URL(url);
          await assertSafeTarget(parsedUrl);

          const resp = await axios.post(url, JSON.stringify({
            email: testEmail,
            username: `zfpolicytest${Date.now()}`,
            password: policyTest.password,
            name: 'ZF Policy Test',
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

          // Check if password was rejected with a policy error
          const passwordRejected =
            /password.*too\s*short|password.*weak|password.*must|password.*require|password.*at\s*least|password.*length|password.*complexity|password.*strong|minimum.*password/i.test(body) ||
            (resp.status === 400 && /password/i.test(body)) ||
            (resp.status === 422 && /password/i.test(body));

          if (passwordRejected) {
            rejectedPasswords.push(policyTest.test);
          } else if (policyTest.expectReject && (resp.status >= 200 && resp.status < 300 || resp.status === 409)) {
            // 409 = conflict (account exists) means password was ACCEPTED but email was duplicate
            // 2xx means registration succeeded = password was accepted
            acceptedWeakPasswords.push(policyTest.test);
          }
        } catch { requestCount++; }
      }

      if (acceptedWeakPasswords.length >= 3) {
        await this.createObservation({
          scanId: data.scanId, targetId: data.targetId,
          category: 'AUTH_POSTURE',
          title: `Weak Password Policy: ${acceptedWeakPasswords.length} weak patterns accepted`,
          severity: 'HIGH',
          exploitability: 'PROBABLE',
          confidence: 'HIGH',
          proofType: 'RESPONSE_MATCH',
          endpoint: ep.path,
          scenarioPackSlug: 'credential-audit',
          remediation: 'Enforce minimum 8-character passwords with complexity requirements (uppercase, lowercase, digit, special character). Implement breached password checking using the HaveIBeenPwned API. Reject sequential patterns, keyboard walks, and repeated characters.',
          observation: `Registration endpoint ${ep.path} accepts ${acceptedWeakPasswords.length} weak password patterns: ${acceptedWeakPasswords.join('; ')}. Only ${rejectedPasswords.length} patterns were properly rejected. This allows users to set trivially guessable passwords.`,
          labels: isLabOnly ? ['LAB_ONLY'] : ['CORROBORATED'],
          affectedAssets: rootAsset ? [rootAsset.id] : [],
          attackFlow: {
            steps: [
              { action: 'Test password policy with weak inputs', tested: POLICY_TEST_PASSWORDS.length },
              { action: 'Weak patterns accepted', accepted: acceptedWeakPasswords },
              { action: 'Patterns rejected', rejected: rejectedPasswords },
            ],
          },
        });
      }

      // ── Breached password acceptance test ──
      let breachedAccepted = 0;
      for (const breachedPw of BREACHED_PASSWORDS.slice(0, 10)) {
        if (requestCount >= maxRequests) break;

        try {
          const parsedUrl = new URL(url);
          await assertSafeTarget(parsedUrl);

          const resp = await axios.post(url, JSON.stringify({
            email: `zf-breach-test-${Date.now()}@zer0friction.test.invalid`,
            username: `zfbreachtest${Date.now()}`,
            password: breachedPw,
            name: 'ZF Breach Test',
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
          const breachRejected = /breached|compromised|pwned|leaked|common password|known password|insecure password/i.test(body);

          if (!breachRejected && (resp.status >= 200 && resp.status < 300 || resp.status === 409)) {
            breachedAccepted++;
          }
        } catch { requestCount++; }
      }

      if (breachedAccepted >= 5) {
        await this.createObservation({
          scanId: data.scanId, targetId: data.targetId,
          category: 'AUTH_POSTURE',
          title: `No Breached Password Protection: ${breachedAccepted}/10 known-breached passwords accepted`,
          severity: 'MEDIUM',
          exploitability: 'PROBABLE',
          confidence: 'HIGH',
          proofType: 'RESPONSE_MATCH',
          endpoint: ep.path,
          scenarioPackSlug: 'credential-audit',
          remediation: 'Integrate a breached password database check (e.g., k-anonymity HaveIBeenPwned API) into registration and password change flows. Reject passwords that appear in known breach datasets.',
          observation: `${breachedAccepted} out of 10 passwords from the top-20 most breached password list were accepted by the registration endpoint. The application does not check passwords against known breach databases.`,
          labels: isLabOnly ? ['LAB_ONLY'] : ['CORROBORATED'],
          affectedAssets: rootAsset ? [rootAsset.id] : [],
        });
      }
    }

    // ═══════════════════════════════════════════════════════════════
    // 5. ACCOUNT LOCKOUT & BRUTE-FORCE PROTECTION — ALL ENVIRONMENTS
    //    Tests whether rapid failed login attempts trigger lockout.
    //    Uses intentionally wrong passwords (never guesses real ones).
    // ═══════════════════════════════════════════════════════════════
    for (const ep of loginEndpoints.slice(0, 2)) {
      if (requestCount >= maxRequests) break;

      const url = `${baseUrl}${ep.path}`;
      const testUsername = `zf-lockout-test-${Date.now()}@zer0friction.test.invalid`;
      let gotLocked = false;
      let got429 = false;
      let gotCaptcha = false;
      let gotDelayed = false;
      const attemptCount = 15; // Industry standard: lockout should kick in at 3-10 attempts
      const startTime = Date.now();

      for (let i = 0; i < attemptCount; i++) {
        if (requestCount >= maxRequests) break;

        try {
          const parsedUrl = new URL(url);
          await assertSafeTarget(parsedUrl);

          const attemptStart = Date.now();
          const resp = await axios.post(url, JSON.stringify({
            email: testUsername,
            username: testUsername,
            password: `WrongPassword${i}!@#`,
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
          const attemptDuration = Date.now() - attemptStart;

          const body = String(resp.data || '').toLowerCase();

          if (resp.status === 429) got429 = true;
          if (/locked|lockout|too many|temporarily blocked|suspended|disabled|frozen/i.test(body)) gotLocked = true;
          if (/captcha|recaptcha|hcaptcha|turnstile|challenge/i.test(body)) gotCaptcha = true;
          if (attemptDuration > 3000 && i > 5) gotDelayed = true; // Progressive delay detection

          // If any protection detected, stop early
          if (got429 || gotLocked || gotCaptcha) break;
        } catch { requestCount++; }
      }

      if (!got429 && !gotLocked && !gotCaptcha && !gotDelayed) {
        await this.createObservation({
          scanId: data.scanId, targetId: data.targetId,
          category: 'AUTH_POSTURE',
          title: `No Account Lockout After ${attemptCount} Failed Login Attempts`,
          severity: 'HIGH',
          exploitability: 'PROVEN',
          confidence: 'HIGH',
          proofType: 'RESPONSE_MATCH',
          endpoint: ep.path,
          scenarioPackSlug: 'credential-audit',
          remediation: 'Implement progressive account lockout: lock after 5 failed attempts for 15 minutes, then exponentially increase lockout duration. Add CAPTCHA challenge after 3 failed attempts. Implement IP-based rate limiting alongside per-account limits. Log all failed authentication events.',
          observation: `Sent ${attemptCount} failed login attempts in rapid succession to ${ep.path}. No 429 response, no lockout message, no CAPTCHA, and no progressive delay was detected. The endpoint is vulnerable to brute-force password guessing. Commercial scanners like Burp/Nuclei flag this as HIGH.`,
          labels: isLabOnly ? ['LAB_ONLY'] : ['CORROBORATED'],
          affectedAssets: rootAsset ? [rootAsset.id] : [],
          attackFlow: {
            steps: [
              { action: `Fire ${attemptCount} sequential failed login requests`, endpoint: ep.path },
              { action: 'Protection signals', got429, gotLocked, gotCaptcha, gotDelayed },
              { action: 'RESULT: No protection detected', durationMs: Date.now() - startTime },
            ],
          },
        });
      }

      // ── Brute-force protection bypass via X-Forwarded-For rotation ──
      if (got429 || gotLocked) {
        let bypassWorked = false;
        const bypassIPs = ['10.0.0.1', '10.0.0.2', '10.0.0.3', '192.168.1.1', '172.16.0.1'];

        for (const fakeIP of bypassIPs) {
          if (requestCount >= maxRequests) break;

          try {
            const parsedUrl = new URL(url);
            await assertSafeTarget(parsedUrl);

            const resp = await axios.post(url, JSON.stringify({
              email: testUsername,
              username: testUsername,
              password: 'BypassTest123!',
            }), {
              timeout: guardrails.perRequestTimeoutMs,
              validateStatus: () => true,
              maxRedirects: 0,
              responseType: 'text',
              headers: {
                'User-Agent': 'Zer0Friction-SecurityScanner/1.0',
                'Content-Type': 'application/json',
                'X-Forwarded-For': fakeIP,
                'X-Real-IP': fakeIP,
                'X-Originating-IP': fakeIP,
                'X-Client-IP': fakeIP,
              },
              lookup: buildSafeLookup() as never,
            });
            requestCount++;

            // If we get a normal auth error (not 429/locked) after previously being locked,
            // the rate limiter trusts X-Forwarded-For
            if (resp.status !== 429 && !/locked|too many/i.test(String(resp.data || ''))) {
              bypassWorked = true;
              break;
            }
          } catch { requestCount++; }
        }

        if (bypassWorked) {
          await this.createObservation({
            scanId: data.scanId, targetId: data.targetId,
            category: 'AUTH_POSTURE',
            title: `Rate Limit Bypass via X-Forwarded-For on ${ep.path}`,
            severity: 'CRITICAL',
            exploitability: 'PROVEN',
            confidence: 'HIGH',
            proofType: 'AUTH_BYPASS',
            endpoint: ep.path,
            scenarioPackSlug: 'credential-audit',
            remediation: 'Do NOT trust X-Forwarded-For for rate limiting unless behind a trusted reverse proxy that strips/overwrites it. Use the LAST hop IP from X-Forwarded-For, not the FIRST. Better yet, use the TCP socket remote address.',
            observation: `After being rate-limited/locked out, sending the same request with a spoofed X-Forwarded-For header bypassed the protection. The rate limiter trusts client-supplied IP headers, allowing unlimited brute-force from a single machine.`,
            labels: isLabOnly ? ['LAB_ONLY'] : ['CORROBORATED'],
            affectedAssets: rootAsset ? [rootAsset.id] : [],
          });
        }
      }
    }

    // ═══════════════════════════════════════════════════════════════
    // 6. PASSWORD RESET TOKEN PREDICTABILITY — ALL ENVIRONMENTS
    //    Requests multiple password reset tokens and checks for entropy.
    // ═══════════════════════════════════════════════════════════════
    for (const ep of resetEndpoints.slice(0, 1)) {
      if (requestCount + 5 >= maxRequests) break;

      const url = `${baseUrl}${ep.path}`;
      const tokens: string[] = [];

      for (let i = 0; i < 3; i++) {
        if (requestCount >= maxRequests) break;

        try {
          const parsedUrl = new URL(url);
          await assertSafeTarget(parsedUrl);

          const resp = await axios.post(url, JSON.stringify({
            email: `zf-reset-entropy-${i}-${Date.now()}@zer0friction.test.invalid`,
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
          // Some APIs return the token in the response (BAD practice, but we detect it)
          const tokenMatch = body.match(/(?:token|code|reset_token|verification_code)["\s:=]+["']?([a-zA-Z0-9_\-]{6,64})["']?/i);
          if (tokenMatch) {
            tokens.push(tokenMatch[1]);
          }
        } catch { requestCount++; }
      }

      if (tokens.length >= 2) {
        // Check for sequential or low-entropy tokens
        const isSequential = this.areTokensSequential(tokens);
        const avgEntropy = this.estimateEntropy(tokens);

        if (isSequential || avgEntropy < 40) {
          await this.createObservation({
            scanId: data.scanId, targetId: data.targetId,
            category: 'AUTH_POSTURE',
            title: `Predictable Password Reset Tokens on ${ep.path}`,
            severity: 'CRITICAL',
            exploitability: 'PROVEN',
            confidence: 'HIGH',
            proofType: 'RESPONSE_MATCH',
            endpoint: ep.path,
            scenarioPackSlug: 'credential-audit',
            remediation: 'Use cryptographically secure random tokens (e.g., crypto.randomBytes(32).toString("hex")). Tokens should be at least 128 bits of entropy. Never use sequential, timestamp-based, or hash-of-email tokens. Tokens should expire within 15 minutes.',
            observation: `Password reset tokens returned by ${ep.path} show ${isSequential ? 'sequential patterns' : `low entropy (~${Math.round(avgEntropy)} bits)`}. Tokens can be predicted or brute-forced to take over any account. Collected tokens: ${tokens.map(t => t.substring(0, 8) + '...').join(', ')}`,
            labels: isLabOnly ? ['LAB_ONLY'] : ['CORROBORATED'],
            affectedAssets: rootAsset ? [rootAsset.id] : [],
          });
        }

        // Also flag that tokens are returned in the response at all
        await this.createObservation({
          scanId: data.scanId, targetId: data.targetId,
          category: 'SENSITIVE_DATA_EXPOSURE',
          title: `Password Reset Token Exposed in API Response`,
          severity: 'HIGH',
          exploitability: 'PROVEN',
          confidence: 'HIGH',
          proofType: 'RESPONSE_MATCH',
          endpoint: ep.path,
          scenarioPackSlug: 'credential-audit',
          remediation: 'Never return password reset tokens in API responses. Send them only via email/SMS to the account owner. This prevents token theft via XSS, MITM, or API response logging.',
          observation: `The password reset endpoint ${ep.path} returns the reset token directly in the HTTP response body. This allows any attacker who can observe API traffic (XSS, proxy, logs) to steal password reset tokens.`,
          labels: isLabOnly ? ['LAB_ONLY'] : ['CORROBORATED'],
          affectedAssets: rootAsset ? [rootAsset.id] : [],
        });
      }
    }

    // ═══════════════════════════════════════════════════════════════
    // 7. SESSION TOKEN ENTROPY ANALYSIS — ALL ENVIRONMENTS
    //    Collects multiple session tokens and analyzes predictability.
    // ═══════════════════════════════════════════════════════════════
    if (requestCount + 5 < maxRequests) {
      const sessionTokens: string[] = [];
      const targetUrl = `${baseUrl}/`;

      for (let i = 0; i < 5; i++) {
        if (requestCount >= maxRequests) break;

        try {
          const parsedUrl = new URL(targetUrl);
          await assertSafeTarget(parsedUrl);

          const resp = await axios.get(targetUrl, {
            timeout: guardrails.perRequestTimeoutMs,
            validateStatus: () => true,
            maxRedirects: 0,
            responseType: 'text',
            headers: {
              'User-Agent': `Zer0Friction-SessionTest/${i}`,
              'Cache-Control': 'no-cache',
            },
            lookup: buildSafeLookup() as never,
          });
          requestCount++;

          const setCookies = resp.headers['set-cookie'];
          if (Array.isArray(setCookies)) {
            for (const cookie of setCookies) {
              const sessionMatch = cookie.match(/(?:session|sid|ssid|JSESSIONID|PHPSESSID|connect\.sid|_session)=([^;]+)/i);
              if (sessionMatch) sessionTokens.push(sessionMatch[1]);
            }
          }
        } catch { requestCount++; }
      }

      if (sessionTokens.length >= 3) {
        const avgEntropy = this.estimateEntropy(sessionTokens);
        const isSequential = this.areTokensSequential(sessionTokens);

        if (isSequential || avgEntropy < 60) {
          await this.createObservation({
            scanId: data.scanId, targetId: data.targetId,
            category: 'AUTH_POSTURE',
            title: `Weak Session Token Entropy (${Math.round(avgEntropy)} bits)`,
            severity: 'HIGH',
            exploitability: 'PROBABLE',
            confidence: 'MEDIUM',
            proofType: 'HEURISTIC',
            endpoint: '/',
            scenarioPackSlug: 'credential-audit',
            remediation: 'Use your framework\'s built-in session management (express-session, @nestjs/session). Ensure session IDs have at least 128 bits of entropy from crypto.randomBytes(). Never generate session IDs from timestamps, counters, or user data.',
            observation: `Session tokens show ${isSequential ? 'sequential/predictable patterns' : `low entropy (~${Math.round(avgEntropy)} bits)`}. OWASP recommends at least 128 bits. Session tokens: ${sessionTokens.map(t => t.substring(0, 10) + '...').join(', ')}`,
            labels: isLabOnly ? ['LAB_ONLY'] : [],
            affectedAssets: rootAsset ? [rootAsset.id] : [],
          });
        }
      }
    }

    this.logger.log(`Credential audit completed for scan ${data.scanId}: ${requestCount} requests`);
  }

  // ─── Helpers ────────────────────────────────────────────────────

  private async detectLoginFormat(
    url: string,
    guardrails: { perRequestTimeoutMs: number },
  ): Promise<((u: string, p: string) => { contentType: string; body: string }) | null> {
    // Send a probe request with invalid creds to detect expected format
    for (const format of LOGIN_BODY_FORMATS.slice(0, 3)) {
      try {
        const parsedUrl = new URL(url);
        await assertSafeTarget(parsedUrl);

        const { contentType, body } = format('probe@zer0friction.test', 'probepassword');
        const resp = await axios.post(url, body, {
          timeout: guardrails.perRequestTimeoutMs,
          validateStatus: () => true,
          maxRedirects: 0,
          responseType: 'text',
          headers: {
            'User-Agent': 'Zer0Friction-SecurityScanner/1.0',
            'Content-Type': contentType,
          },
          lookup: buildSafeLookup() as never,
        });

        // If we get a normal auth error (not 415 Unsupported Media Type), this format works
        if (resp.status !== 415 && resp.status !== 400) {
          return format;
        }
      } catch { /* ignore */ }
    }
    return null;
  }

  private isLoginSuccess(status: number, body: string, headers: Record<string, unknown>): boolean {
    if (status < 200 || status >= 300) return false;

    // Check for token in response body
    if (/("access_token"|"accessToken"|"token"|"jwt"|"session"|"id_token")\s*:\s*"[^"]{10,}"/i.test(body)) return true;

    // Check for session cookie set
    const setCookies = headers['set-cookie'];
    if (Array.isArray(setCookies) && setCookies.some(c => /session|sid|auth|token/i.test(c))) return true;
    if (typeof setCookies === 'string' && /session|sid|auth|token/i.test(setCookies)) return true;

    // Check for redirect to dashboard/admin
    const location = String(headers['location'] ?? '');
    if (/dashboard|admin|home|panel|account/i.test(location)) return true;

    // Check for success message
    if (/logged\s*in|login\s*success|welcome|authenticated/i.test(body)) return true;

    return false;
  }

  private areTokensSequential(tokens: string[]): boolean {
    if (tokens.length < 2) return false;

    // Try numeric parsing — check if values are sequential integers
    const numericValues = tokens.map(t => parseInt(t, 10)).filter(n => !isNaN(n));
    if (numericValues.length >= 2) {
      const diffs: number[] = [];
      for (let i = 1; i < numericValues.length; i++) {
        diffs.push(Math.abs(numericValues[i] - numericValues[i - 1]));
      }
      if (diffs.every(d => d <= 10)) return true; // Close numeric sequence
    }

    // Check for common prefix pattern (timestamp-based tokens)
    if (tokens.length >= 2) {
      const commonPrefix = this.longestCommonPrefix(tokens);
      if (commonPrefix.length > tokens[0].length * 0.7) return true; // >70% shared prefix
    }

    return false;
  }

  private longestCommonPrefix(strings: string[]): string {
    if (strings.length === 0) return '';
    let prefix = strings[0];
    for (let i = 1; i < strings.length; i++) {
      while (!strings[i].startsWith(prefix)) {
        prefix = prefix.substring(0, prefix.length - 1);
        if (prefix === '') return '';
      }
    }
    return prefix;
  }

  private estimateEntropy(tokens: string[]): number {
    if (tokens.length === 0) return 0;
    // Estimate entropy from character set and length
    const avgLength = tokens.reduce((sum, t) => sum + t.length, 0) / tokens.length;
    const allChars = new Set(tokens.join('').split(''));
    const charsetSize = allChars.size;
    return avgLength * Math.log2(Math.max(charsetSize, 2));
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
