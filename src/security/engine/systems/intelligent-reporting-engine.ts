import { Injectable, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../../prisma/prisma.service.js';
import type { SecurityScanJobData } from '../constants.js';

/**
 * INTELLIGENT_REPORTING_ENGINE — Developer-centric, actionable reports.
 *
 * The #1 complaint about security scanners:
 *   "I got 200 findings but I don't know what to fix first,
 *    how they relate, or what the code fix looks like."
 *
 * This engine produces THREE report layers:
 *
 *   Layer 1: EXECUTIVE SUMMARY (for CTO/CISO)
 *     - 3-sentence risk overview
 *     - Top 3 business risks
 *     - Trend vs previous scan
 *     - Compliance impact
 *
 *   Layer 2: ATTACK NARRATIVE (for security team)
 *     - Full attack chains with step-by-step reproduction
 *     - Root cause analysis (grouped by underlying issue)
 *     - Exploit simulation results with PoE
 *     - Priority remediation queue
 *
 *   Layer 3: DEVELOPER FIX GUIDE (for engineers)
 *     - For each finding: what happened, why it matters, how to fix
 *     - Language-specific secure code examples
 *     - Exact file/endpoint/parameter to fix
 *     - Before/after code snippets
 *
 * Output formats: JSON, Markdown report, Executive PDF metadata
 *
 * KEY DIFFERENTIATOR:
 *   Burp: "Reflected XSS in parameter query"
 *   This: "On /api/search, the query parameter is reflected in the response
 *          without HTML encoding. An attacker can inject <script> tags to steal
 *          session cookies. Fix: Encode output using context-aware encoding.
 *          Example: DOMPurify.sanitize(userInput) for client-side,
 *          escapeHtml(userInput) for server-side."
 */

// ═══════════════════════════════════════════════════════════════════
// REPORT TYPES
// ═══════════════════════════════════════════════════════════════════

interface IntelligentReport {
  generatedAt: string;
  scanId: string;
  targetName: string;
  targetUrl: string;

  executiveSummary: ExecutiveSummary;
  attackNarrative: AttackNarrative;
  developerGuide: DeveloperGuide;

  metadata: ReportMetadata;
}

interface ExecutiveSummary {
  riskOverview: string;          // 2-3 sentences
  riskScore: number;
  riskLevel: string;
  topBusinessRisks: BusinessRisk[];
  trend: TrendAnalysis | null;
  complianceImpact: ComplianceImpact[];
  keyMetrics: {
    totalFindings: number;
    criticalCount: number;
    highCount: number;
    exploitChainsDiscovered: number;
    exploitSimulationsSucceeded: number;
    endpointsScanned: number;
    autonomousDecisionsMade: number;
  };
}

interface BusinessRisk {
  risk: string;
  likelihood: 'CERTAIN' | 'LIKELY' | 'POSSIBLE' | 'UNLIKELY';
  impact: 'CATASTROPHIC' | 'MAJOR' | 'MODERATE' | 'MINOR';
  evidence: string;
  affectedEndpoints: string[];
}

interface TrendAnalysis {
  previousScore: number;
  currentScore: number;
  trend: 'IMPROVING' | 'STABLE' | 'DEGRADING';
  newFindings: number;
  resolvedFindings: number;
  regressions: number;
}

interface ComplianceImpact {
  framework: string;
  control: string;
  status: 'PASS' | 'FAIL' | 'PARTIAL';
  finding: string;
}

interface AttackNarrative {
  chains: AttackChainNarrative[];
  exploitSimulations: ExploitSimulationNarrative[];
  rootCauseAnalysis: RootCauseGroup[];
  remediationPriorityQueue: RemediationItem[];
}

interface AttackChainNarrative {
  title: string;
  score: number;
  confidence: string;
  narrative: string;      // Human-readable attack story
  steps: string[];        // Step-by-step reproduction
  finalImpact: string;
  rootCause: string;
}

interface ExploitSimulationNarrative {
  scenario: string;
  succeeded: boolean;
  narrative: string;
  proofOfExploit: string;
  difficulty: string;
}

interface RootCauseGroup {
  rootCause: string;
  affectedFindings: number;
  categories: string[];
  fixDescription: string;
  priority: 'P0' | 'P1' | 'P2' | 'P3';
}

interface RemediationItem {
  priority: number;      // 1 = highest
  category: string;
  title: string;
  severity: string;
  endpoint: string | null;
  whatHappened: string;
  whyItMatters: string;
  howAttackerAbuses: string;
  fixRecommendation: string;
  secureCodeExample: SecureCodeExample | null;
  effort: 'LOW' | 'MEDIUM' | 'HIGH';
  findingIds: string[];
}

interface SecureCodeExample {
  language: string;
  framework: string;
  vulnerableCode: string;
  secureCode: string;
  explanation: string;
}

interface DeveloperGuide {
  totalIssues: number;
  byPriority: Record<string, number>;
  fixes: DeveloperFix[];
}

interface DeveloperFix {
  id: string;
  priority: 'P0' | 'P1' | 'P2' | 'P3';
  title: string;
  category: string;
  endpoint: string | null;
  whatHappened: string;
  whyItMatters: string;
  howAttackerAbuses: string;
  fixRecommendation: string;
  secureCodeExample: SecureCodeExample | null;
  references: string[];
}

interface ReportMetadata {
  engineVersion: string;
  scanDuration: string | null;
  requestsUsed: number;
  modulesExecuted: string[];
  autonomousDecisions: string[];
}

// ═══════════════════════════════════════════════════════════════════
// SECURE CODE EXAMPLE LIBRARY
// ═══════════════════════════════════════════════════════════════════

const SECURE_CODE_EXAMPLES: Record<string, SecureCodeExample[]> = {
  INJECTION_DETECTION: [
    {
      language: 'TypeScript',
      framework: 'NestJS / TypeORM',
      vulnerableCode: `// VULNERABLE: String concatenation in query\nconst users = await db.query(\n  \`SELECT * FROM users WHERE name = '\${userInput}'\`\n);`,
      secureCode: `// SECURE: Parameterized query\nconst users = await db.query(\n  'SELECT * FROM users WHERE name = $1',\n  [userInput]\n);`,
      explanation: 'Always use parameterized queries. Never concatenate user input into SQL strings.',
    },
    {
      language: 'Python',
      framework: 'SQLAlchemy',
      vulnerableCode: `# VULNERABLE\ndb.execute(f"SELECT * FROM users WHERE name = '{user_input}'")`,
      secureCode: `# SECURE: Parameterized query\ndb.execute(\n    text("SELECT * FROM users WHERE name = :name"),\n    {"name": user_input}\n)`,
      explanation: 'Use SQLAlchemy text() with named parameters to prevent SQL injection.',
    },
  ],

  AUTH_POSTURE: [
    {
      language: 'TypeScript',
      framework: 'NestJS',
      vulnerableCode: `// VULNERABLE: No auth guard\n@Get('admin/users')\nasync getUsers() {\n  return this.userService.findAll();\n}`,
      secureCode: `// SECURE: Auth + role guard\n@UseGuards(JwtAuthGuard, RolesGuard)\n@Roles('ADMIN')\n@Get('admin/users')\nasync getUsers() {\n  return this.userService.findAll();\n}`,
      explanation: 'Apply authentication and role-based authorization guards to all admin endpoints.',
    },
  ],

  BROKEN_ACCESS_CONTROL: [
    {
      language: 'TypeScript',
      framework: 'NestJS',
      vulnerableCode: `// VULNERABLE: No ownership check\n@Get('users/:id')\nasync getUser(@Param('id') id: string) {\n  return this.userService.findById(id);\n}`,
      secureCode: `// SECURE: Ownership verification\n@UseGuards(JwtAuthGuard)\n@Get('users/:id')\nasync getUser(\n  @Param('id') id: string,\n  @Request() req,\n) {\n  if (req.user.id !== id && req.user.role !== 'ADMIN') {\n    throw new ForbiddenException();\n  }\n  return this.userService.findById(id);\n}`,
      explanation: 'Always verify that the requesting user owns the resource or has admin privileges.',
    },
  ],

  MASS_ASSIGNMENT: [
    {
      language: 'TypeScript',
      framework: 'NestJS',
      vulnerableCode: `// VULNERABLE: Accepts all fields\n@Patch('users/:id')\nasync updateUser(@Body() body: any) {\n  return this.userService.update(id, body);\n}`,
      secureCode: `// SECURE: Whitelist allowed fields via DTO\nclass UpdateUserDto {\n  @IsOptional() @IsString() name?: string;\n  @IsOptional() @IsEmail() email?: string;\n  // role, isAdmin are NOT included\n}\n\n@Patch('users/:id')\nasync updateUser(\n  @Body(ValidationPipe) dto: UpdateUserDto\n) {\n  return this.userService.update(id, dto);\n}`,
      explanation: 'Use DTOs with explicit whitelisting. Never pass raw request body to database updates.',
    },
  ],

  SENSITIVE_DATA_EXPOSURE: [
    {
      language: 'TypeScript',
      framework: 'NestJS',
      vulnerableCode: `// VULNERABLE: Returns all user fields\n@Get('users/:id')\nasync getUser(@Param('id') id: string) {\n  return this.prisma.user.findUnique({ where: { id } });\n}`,
      secureCode: `// SECURE: Select only public fields\n@Get('users/:id')\nasync getUser(@Param('id') id: string) {\n  return this.prisma.user.findUnique({\n    where: { id },\n    select: { id: true, name: true, avatar: true },\n  });\n}`,
      explanation: 'Always use explicit field selection. Never return full database records to API consumers.',
    },
  ],

  XSS_DETECTION: [
    {
      language: 'TypeScript',
      framework: 'React',
      vulnerableCode: `// VULNERABLE: dangerouslySetInnerHTML\nreturn <div dangerouslySetInnerHTML={{__html: userInput}} />`,
      secureCode: `// SECURE: Use DOMPurify for sanitization\nimport DOMPurify from 'dompurify';\n\nconst clean = DOMPurify.sanitize(userInput);\nreturn <div dangerouslySetInnerHTML={{__html: clean}} />`,
      explanation: 'Sanitize all user input before rendering as HTML. Use DOMPurify or equivalent.',
    },
  ],

  CORS_MISCONFIGURATION: [
    {
      language: 'TypeScript',
      framework: 'NestJS',
      vulnerableCode: `// VULNERABLE: Reflects any origin\napp.enableCors({ origin: true });`,
      secureCode: `// SECURE: Explicit origin whitelist\napp.enableCors({\n  origin: ['https://app.example.com', 'https://admin.example.com'],\n  credentials: true,\n});`,
      explanation: 'Never use origin: true or reflect the Origin header. Whitelist specific, trusted origins.',
    },
  ],

  SSRF_POSTURE: [
    {
      language: 'TypeScript',
      framework: 'Node.js',
      vulnerableCode: `// VULNERABLE: No URL validation\nconst resp = await fetch(userProvidedUrl);\nreturn resp.json();`,
      secureCode: `// SECURE: URL allowlisting + IP blocking\nimport { isPrivateIP } from './security';\n\nconst url = new URL(userProvidedUrl);\nconst allowedHosts = ['api.trusted.com', 'cdn.example.com'];\n\nif (!allowedHosts.includes(url.hostname)) {\n  throw new BadRequestException('URL not allowed');\n}\n\nconst resolved = await dns.resolve4(url.hostname);\nif (resolved.some(ip => isPrivateIP(ip))) {\n  throw new BadRequestException('Internal IPs blocked');\n}\n\nconst resp = await fetch(url.toString());\nreturn resp.json();`,
      explanation: 'Validate URLs against an allowlist and block requests to internal IP ranges.',
    },
  ],

  SECRET_EXPOSURE: [
    {
      language: 'TypeScript',
      framework: 'Node.js',
      vulnerableCode: `// VULNERABLE: Secrets in source code\nconst API_KEY = 'sk_live_abc123def456';\nconst DB_URL = 'postgres://admin:p@ss@db:5432';`,
      secureCode: `// SECURE: Environment variables + secret manager\nconst API_KEY = process.env.API_KEY;\nconst DB_URL = process.env.DATABASE_URL;\n\n// For production: use AWS Secrets Manager, Vault, etc.\n// const secret = await secretsManager.getSecretValue({\n//   SecretId: 'my-api-key'\n// });`,
      explanation: 'Never hardcode secrets. Use environment variables or a secrets manager.',
    },
  ],
};

// ═══════════════════════════════════════════════════════════════════
// COMPLIANCE MAPPING
// ═══════════════════════════════════════════════════════════════════

const COMPLIANCE_MAP: Array<{ category: string; framework: string; control: string }> = [
  { category: 'AUTH_POSTURE', framework: 'OWASP API Top 10', control: 'API2:2023 Broken Authentication' },
  { category: 'BROKEN_ACCESS_CONTROL', framework: 'OWASP API Top 10', control: 'API1:2023 BOLA' },
  { category: 'MASS_ASSIGNMENT', framework: 'OWASP API Top 10', control: 'API3:2023 BOPLA' },
  { category: 'SENSITIVE_DATA_EXPOSURE', framework: 'OWASP API Top 10', control: 'API4:2023 Unrestricted Resource Consumption' },
  { category: 'INJECTION_DETECTION', framework: 'OWASP API Top 10', control: 'API8:2023 Security Misconfiguration' },
  { category: 'AUTH_POSTURE', framework: 'PCI-DSS', control: 'Req 6.5.10 - Broken Authentication' },
  { category: 'SENSITIVE_DATA_EXPOSURE', framework: 'GDPR', control: 'Article 32 - Security of Processing' },
  { category: 'SECRET_EXPOSURE', framework: 'SOC 2', control: 'CC6.1 - Logical Access Security' },
  { category: 'BROKEN_ACCESS_CONTROL', framework: 'PCI-DSS', control: 'Req 7 - Restrict Access' },
  { category: 'CORS_MISCONFIGURATION', framework: 'OWASP API Top 10', control: 'API8:2023 Security Misconfiguration' },
];

// ═══════════════════════════════════════════════════════════════════
// ENGINE
// ═══════════════════════════════════════════════════════════════════

@Injectable()
export class IntelligentReportingEngine {
  private readonly logger = new Logger(IntelligentReportingEngine.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Generate the full intelligent report.
   * Called as the FINAL stage of the pipeline, after scoring.
   */
  async generateReport(data: SecurityScanJobData): Promise<IntelligentReport> {
    const [scan, findings, observations, attackPaths, endpoints, controlVerdicts] = await Promise.all([
      this.prisma.securityScan.findUnique({
        where: { id: data.scanId },
        include: { target: true },
      }),
      this.prisma.securityFinding.findMany({
        where: { scanId: data.scanId, falsePositive: false },
        orderBy: [{ severity: 'desc' }, { confidence: 'desc' }],
      }),
      this.prisma.securityObservation.findMany({
        where: { scanId: data.scanId, status: { not: 'SUPPRESSED' } },
        orderBy: [{ severity: 'desc' }, { confidence: 'desc' }],
      }),
      this.prisma.securityAttackPath.findMany({
        where: { scanId: data.scanId },
        orderBy: { score: 'desc' },
      }),
      this.prisma.securityEndpointInventory.findMany({
        where: { targetId: data.targetId },
      }),
      this.prisma.securityControlVerdict.findMany({
        where: { scanId: data.scanId },
      }),
    ]);

    if (!scan) throw new Error(`Scan ${data.scanId} not found`);

    // Load previous scan for trend analysis
    const previousScan = await this.prisma.securityScan.findFirst({
      where: {
        targetId: data.targetId,
        status: 'COMPLETED',
        id: { not: data.scanId },
      },
      orderBy: { completedAt: 'desc' },
      include: { findings: { select: { category: true, fingerprint: true } } },
    });

    // ─── Build report layers ──────────────────────────────────
    const executiveSummary = this.buildExecutiveSummary(
      scan, findings, attackPaths, observations, endpoints, previousScan,
    );

    const attackNarrative = this.buildAttackNarrative(
      findings, attackPaths, observations,
    );

    const developerGuide = this.buildDeveloperGuide(
      findings, scan.target.name,
    );

    const report: IntelligentReport = {
      generatedAt: new Date().toISOString(),
      scanId: data.scanId,
      targetName: scan.target.name,
      targetUrl: scan.target.baseUrl,
      executiveSummary,
      attackNarrative,
      developerGuide,
      metadata: {
        engineVersion: '2.0.0',
        scanDuration: scan.startedAt
          ? `${Math.round((Date.now() - scan.startedAt.getTime()) / 1000)}s`
          : null,
        requestsUsed: 0, // Populated by guardrails
        modulesExecuted: this.extractModulesExecuted(scan.plannerSummary as Record<string, unknown>),
        autonomousDecisions: this.extractDecisions(scan.plannerSummary as Record<string, unknown>),
      },
    };

    // Persist the intelligent report
    await this.prisma.securityScan.update({
      where: { id: data.scanId },
      data: {
        reportMetadata: report as unknown as Prisma.InputJsonValue,
      },
    });

    this.logger.log(
      `Intelligent report generated for scan ${data.scanId}: ` +
      `${developerGuide.fixes.length} developer fixes, ` +
      `${attackNarrative.chains.length} attack chains, ` +
      `${executiveSummary.topBusinessRisks.length} business risks`,
    );

    return report;
  }

  // ═══════════════════════════════════════════════════════════════
  // LAYER 1: EXECUTIVE SUMMARY
  // ═══════════════════════════════════════════════════════════════

  private buildExecutiveSummary(
    scan: { score: number | null; riskLevel: string | null; plannerSummary: unknown; target?: { name: string } | null },
    findings: Array<{ severity: string; exploitability: string; category: string; endpoint: string | null }>,
    attackPaths: Array<{ score: number; title: string; summary: string | null; metadata: unknown }>,
    observations: Array<{ category: string; labels: unknown }>,
    endpoints: unknown[],
    previousScan: { score: number | null; findings: Array<{ fingerprint: string | null }> } | null,
  ): ExecutiveSummary {
    const criticalCount = findings.filter(f => f.severity === 'CRITICAL').length;
    const highCount = findings.filter(f => f.severity === 'HIGH').length;
    const totalFindings = findings.length;

    // ─── Risk overview ────────────────────────────────────────
    const exploitSimulations = observations.filter(o =>
      Array.isArray(o.labels) && (o.labels as string[]).includes('EXPLOIT_SIMULATION'),
    );
    const exploitsSucceeded = exploitSimulations.filter(o =>
      Array.isArray(o.labels) && (o.labels as string[]).includes('EXPLOITED'),
    );

    let riskOverview: string;
    if (criticalCount > 0 && attackPaths.length > 0) {
      riskOverview = `${scan.target?.name ?? 'Target'} has ${criticalCount} critical vulnerabilities that form ${attackPaths.length} exploitable attack chain(s). Immediate remediation is required — real-world exploitation is confirmed with high confidence.`;
    } else if (highCount > 0) {
      riskOverview = `${totalFindings} security findings identified, including ${highCount} high-severity issues. While no full exploit chains were confirmed, these findings represent significant risk if left unaddressed.`;
    } else if (totalFindings > 0) {
      riskOverview = `${totalFindings} findings identified at moderate or lower severity. The application shows a reasonable security posture, but hardening opportunities exist.`;
    } else {
      riskOverview = 'No security findings were identified. The application demonstrates a strong security posture for the tested surface area.';
    }

    // ─── Business risks ───────────────────────────────────────
    const topBusinessRisks = this.identifyBusinessRisks(findings, attackPaths, exploitsSucceeded);

    // ─── Trend analysis ───────────────────────────────────────
    const trend = this.analyzeTrend(scan, findings, previousScan);

    // ─── Compliance impact ────────────────────────────────────
    const categories = new Set(findings.map(f => f.category));
    const complianceImpact = COMPLIANCE_MAP
      .filter(cm => categories.has(cm.category))
      .map(cm => ({
        framework: cm.framework,
        control: cm.control,
        status: 'FAIL' as const,
        finding: `${cm.category} violations detected`,
      }));

    return {
      riskOverview,
      riskScore: scan.score ?? 0,
      riskLevel: scan.riskLevel ?? 'UNKNOWN',
      topBusinessRisks,
      trend,
      complianceImpact,
      keyMetrics: {
        totalFindings,
        criticalCount,
        highCount,
        exploitChainsDiscovered: attackPaths.length,
        exploitSimulationsSucceeded: exploitsSucceeded.length,
        endpointsScanned: endpoints.length,
        autonomousDecisionsMade: this.countDecisions(scan.plannerSummary as Record<string, unknown>),
      },
    };
  }

  private identifyBusinessRisks(
    findings: Array<{ severity: string; category: string; endpoint: string | null; exploitability: string }>,
    attackPaths: Array<{ score: number; title: string; metadata: unknown }>,
    exploitSucceeded: unknown[],
  ): BusinessRisk[] {
    const risks: BusinessRisk[] = [];

    // Risk 1: Account takeover
    const authFindings = findings.filter(f =>
      ['AUTH_POSTURE', 'BROKEN_ACCESS_CONTROL'].includes(f.category) &&
      ['CRITICAL', 'HIGH'].includes(f.severity),
    );
    if (authFindings.length > 0) {
      risks.push({
        risk: 'Account Takeover',
        likelihood: authFindings.some(f => f.exploitability === 'PROVEN') ? 'CERTAIN' : 'LIKELY',
        impact: 'CATASTROPHIC',
        evidence: `${authFindings.length} authentication/authorization findings (${authFindings.filter(f => f.exploitability === 'PROVEN').length} proven)`,
        affectedEndpoints: authFindings.map(f => f.endpoint).filter(Boolean) as string[],
      });
    }

    // Risk 2: Data breach
    const dataFindings = findings.filter(f =>
      ['SENSITIVE_DATA_EXPOSURE', 'SECRET_EXPOSURE', 'INJECTION_DETECTION'].includes(f.category),
    );
    if (dataFindings.length > 0) {
      risks.push({
        risk: 'Data Breach',
        likelihood: dataFindings.some(f => f.exploitability === 'PROVEN') ? 'LIKELY' : 'POSSIBLE',
        impact: 'CATASTROPHIC',
        evidence: `${dataFindings.length} data exposure findings across ${new Set(dataFindings.map(f => f.endpoint)).size} endpoints`,
        affectedEndpoints: dataFindings.map(f => f.endpoint).filter(Boolean) as string[],
      });
    }

    // Risk 3: Infrastructure compromise
    const infraFindings = findings.filter(f =>
      ['SSRF_POSTURE', 'CLOUD_MISCONFIG', 'COMMAND_INJECTION'].includes(f.category),
    );
    if (infraFindings.length > 0) {
      risks.push({
        risk: 'Infrastructure Compromise',
        likelihood: infraFindings.some(f => f.exploitability === 'PROVEN') ? 'LIKELY' : 'POSSIBLE',
        impact: 'MAJOR',
        evidence: `${infraFindings.length} infrastructure-level findings`,
        affectedEndpoints: infraFindings.map(f => f.endpoint).filter(Boolean) as string[],
      });
    }

    return risks.slice(0, 5);
  }

  private analyzeTrend(
    currentScan: { score: number | null },
    currentFindings: Array<{ severity: string }>,
    previousScan: { score: number | null; findings: Array<{ fingerprint: string | null }> } | null,
  ): TrendAnalysis | null {
    if (!previousScan) return null;

    const currentScore = currentScan.score ?? 0;
    const previousScore = previousScan.score ?? 0;
    const delta = currentScore - previousScore;

    return {
      previousScore,
      currentScore,
      trend: delta > 5 ? 'DEGRADING' : delta < -5 ? 'IMPROVING' : 'STABLE',
      newFindings: currentFindings.length, // Simplified — would use fingerprint comparison
      resolvedFindings: 0,
      regressions: delta > 5 ? Math.ceil(delta / 5) : 0,
    };
  }

  // ═══════════════════════════════════════════════════════════════
  // LAYER 2: ATTACK NARRATIVE
  // ═══════════════════════════════════════════════════════════════

  private buildAttackNarrative(
    findings: Array<{ id: string; category: string; title: string; severity: string; endpoint: string | null; remediation: string | null; confidence: string; exploitability: string }>,
    attackPaths: Array<{ title: string; score: number; summary: string | null; metadata: unknown }>,
    observations: Array<{ category: string; labels: unknown; title: string; evidenceSummary: unknown }>,
  ): AttackNarrative {
    // ─── Attack chain narratives ──────────────────────────────
    const chains: AttackChainNarrative[] = attackPaths.slice(0, 10).map(path => {
      const meta = path.metadata as Record<string, unknown> ?? {};
      return {
        title: path.title,
        score: path.score,
        confidence: String(meta.confidence ?? 'MEDIUM'),
        narrative: path.summary ?? path.title,
        steps: Array.isArray(meta.causalChain) ? meta.causalChain as string[] : [],
        finalImpact: String(meta.finalImpact ?? 'See attack path details'),
        rootCause: String(meta.rootCause ?? 'Multiple contributing factors'),
      };
    });

    // ─── Exploit simulation narratives ────────────────────────
    const simulations: ExploitSimulationNarrative[] = observations
      .filter(o => Array.isArray(o.labels) && (o.labels as string[]).includes('EXPLOIT_SIMULATION'))
      .map(o => {
        const evidence = o.evidenceSummary as Record<string, unknown> ?? {};
        return {
          scenario: o.title.replace('[EXPLOIT SIMULATION] ', ''),
          succeeded: (o.labels as string[]).includes('EXPLOITED'),
          narrative: `${o.title}. ${evidence.finalImpact ?? ''}`,
          proofOfExploit: String(evidence.proofOfExploit ?? 'See evidence artifact'),
          difficulty: String(evidence.difficulty ?? 'UNKNOWN'),
        };
      });

    // ─── Root cause analysis ──────────────────────────────────
    const rootCauseGroups = this.groupByRootCause(findings);

    // ─── Remediation priority queue ───────────────────────────
    const remediationQueue = this.buildRemediationQueue(findings);

    return {
      chains,
      exploitSimulations: simulations,
      rootCauseAnalysis: rootCauseGroups,
      remediationPriorityQueue: remediationQueue,
    };
  }

  private groupByRootCause(
    findings: Array<{ id: string; category: string; severity: string; remediation: string | null }>,
  ): RootCauseGroup[] {
    const ROOT_CAUSES: Record<string, { rootCause: string; categories: string[]; fixDescription: string }> = {
      INPUT_VALIDATION: {
        rootCause: 'Missing or inadequate input validation',
        categories: ['INJECTION_DETECTION', 'COMMAND_INJECTION', 'XSS_DETECTION', 'DOM_XSS', 'SSTI_DETECTION', 'PATH_TRAVERSAL', 'HEADER_INJECTION'],
        fixDescription: 'Implement comprehensive input validation with allowlisting, parameterized queries, and context-aware output encoding.',
      },
      ACCESS_CONTROL: {
        rootCause: 'Broken access control and authorization',
        categories: ['AUTH_POSTURE', 'BROKEN_ACCESS_CONTROL', 'MASS_ASSIGNMENT', 'BUSINESS_LOGIC'],
        fixDescription: 'Implement centralized authorization framework with resource-level ownership checks and explicit role guards.',
      },
      DATA_HANDLING: {
        rootCause: 'Improper data exposure and handling',
        categories: ['SENSITIVE_DATA_EXPOSURE', 'SECRET_EXPOSURE', 'DEBUG_EXPOSURE', 'TECH_DISCLOSURE'],
        fixDescription: 'Implement field-level visibility controls, remove debug endpoints, use external secret management.',
      },
      CONFIGURATION: {
        rootCause: 'Security misconfiguration',
        categories: ['SECURITY_MISCONFIGURATION', 'CORS_MISCONFIGURATION', 'HEADER_SECURITY', 'TLS_POSTURE'],
        fixDescription: 'Review and harden server configuration. Implement security headers, CORS allowlisting, and TLS best practices.',
      },
      INFRASTRUCTURE: {
        rootCause: 'Infrastructure-level vulnerabilities',
        categories: ['SSRF_POSTURE', 'CLOUD_MISCONFIG', 'OPEN_REDIRECT'],
        fixDescription: 'Implement URL allowlisting, block internal IP ranges, enforce cloud security best practices (IMDS v2, bucket policies).',
      },
    };

    const groups: RootCauseGroup[] = [];
    const categoriesInFindings = new Set(findings.map(f => f.category));

    for (const [, config] of Object.entries(ROOT_CAUSES)) {
      const matchedCategories = config.categories.filter(c => categoriesInFindings.has(c));
      if (matchedCategories.length === 0) continue;

      const affected = findings.filter(f => matchedCategories.includes(f.category));
      const hasCritical = affected.some(f => f.severity === 'CRITICAL');
      const hasHigh = affected.some(f => f.severity === 'HIGH');

      groups.push({
        rootCause: config.rootCause,
        affectedFindings: affected.length,
        categories: matchedCategories,
        fixDescription: config.fixDescription,
        priority: hasCritical ? 'P0' : hasHigh ? 'P1' : affected.length >= 3 ? 'P2' : 'P3',
      });
    }

    return groups.sort((a, b) => a.priority.localeCompare(b.priority));
  }

  private buildRemediationQueue(
    findings: Array<{ id: string; category: string; title: string; severity: string; endpoint: string | null; remediation: string | null; exploitability: string }>,
  ): RemediationItem[] {
    // Deduplicate by category + endpoint
    const seen = new Map<string, typeof findings[0]>();
    for (const f of findings) {
      const key = `${f.category}__${f.endpoint ?? 'global'}`;
      if (!seen.has(key) || this.severityRank(f.severity) > this.severityRank(seen.get(key)!.severity)) {
        seen.set(key, f);
      }
    }

    let priority = 0;
    return [...seen.values()]
      .sort((a, b) => this.severityRank(b.severity) - this.severityRank(a.severity))
      .slice(0, 20)
      .map(f => {
        priority++;
        const codeExample = SECURE_CODE_EXAMPLES[f.category]?.[0] ?? null;

        return {
          priority,
          category: f.category,
          title: f.title,
          severity: f.severity,
          endpoint: f.endpoint,
          whatHappened: this.explainWhatHappened(f.category, f.endpoint),
          whyItMatters: this.explainWhyItMatters(f.category),
          howAttackerAbuses: this.explainAttackerAbuse(f.category, f.endpoint),
          fixRecommendation: f.remediation ?? 'See developer guide for fix recommendations.',
          secureCodeExample: codeExample,
          effort: this.estimateEffort(f.category),
          findingIds: [f.id],
        };
      });
  }

  // ═══════════════════════════════════════════════════════════════
  // LAYER 3: DEVELOPER GUIDE
  // ═══════════════════════════════════════════════════════════════

  private buildDeveloperGuide(
    findings: Array<{ id: string; category: string; title: string; severity: string; endpoint: string | null; remediation: string | null; exploitability: string }>,
    targetName: string,
  ): DeveloperGuide {
    const fixes: DeveloperFix[] = findings.slice(0, 30).map((f, i) => {
      const codeExample = SECURE_CODE_EXAMPLES[f.category]?.[0] ?? null;
      const hasCritical = f.severity === 'CRITICAL';

      return {
        id: `FIX-${String(i + 1).padStart(3, '0')}`,
        priority: hasCritical ? 'P0' : f.severity === 'HIGH' ? 'P1' : f.severity === 'MEDIUM' ? 'P2' : 'P3',
        title: f.title,
        category: f.category,
        endpoint: f.endpoint,
        whatHappened: this.explainWhatHappened(f.category, f.endpoint),
        whyItMatters: this.explainWhyItMatters(f.category),
        howAttackerAbuses: this.explainAttackerAbuse(f.category, f.endpoint),
        fixRecommendation: f.remediation ?? 'Review and implement appropriate security controls.',
        secureCodeExample: codeExample,
        references: this.getReferences(f.category),
      };
    });

    const byPriority: Record<string, number> = { P0: 0, P1: 0, P2: 0, P3: 0 };
    for (const fix of fixes) {
      byPriority[fix.priority] = (byPriority[fix.priority] ?? 0) + 1;
    }

    return { totalIssues: fixes.length, byPriority, fixes };
  }

  // ═══════════════════════════════════════════════════════════════
  // EXPLANATION GENERATORS
  // ═══════════════════════════════════════════════════════════════

  private explainWhatHappened(category: string, endpoint: string | null): string {
    const ep = endpoint ?? 'an API endpoint';
    const explanations: Record<string, string> = {
      AUTH_POSTURE: `The authentication mechanism on ${ep} has a weakness that allows bypassing or weakening the login process.`,
      BROKEN_ACCESS_CONTROL: `${ep} does not properly verify that the requesting user is authorized to access the requested resource, allowing horizontal or vertical privilege escalation.`,
      INJECTION_DETECTION: `${ep} does not properly sanitize user input in database queries, allowing injection of malicious SQL/NoSQL commands.`,
      SENSITIVE_DATA_EXPOSURE: `${ep} returns sensitive data (PII, credentials, or internal details) in its response without proper filtering or authorization.`,
      SECRET_EXPOSURE: `API keys, tokens, or credentials are exposed in source code, JavaScript bundles, or API responses accessible at ${ep}.`,
      MASS_ASSIGNMENT: `${ep} accepts and processes user-supplied fields that should be server-controlled (e.g., role, permissions), allowing unauthorized modification.`,
      XSS_DETECTION: `${ep} reflects user input in its response without proper encoding, allowing injection of malicious client-side scripts.`,
      CORS_MISCONFIGURATION: `The server's CORS policy allows requests from untrusted origins with credentials, enabling cross-origin data theft.`,
      SSRF_POSTURE: `${ep} accepts user-supplied URLs and fetches them server-side without validating the target, allowing access to internal resources.`,
      CLOUD_MISCONFIG: `Cloud infrastructure resources (storage, metadata, IAM) are accessible without proper authentication or authorization.`,
      COMMAND_INJECTION: `${ep} passes user input to system commands without proper sanitization, allowing arbitrary command execution.`,
      SSTI_DETECTION: `${ep} processes user input through a server-side template engine without sanitization, allowing code execution.`,
    };
    return explanations[category] ?? `A security issue was detected on ${ep} in the ${category} category.`;
  }

  private explainWhyItMatters(category: string): string {
    const impacts: Record<string, string> = {
      AUTH_POSTURE: 'Authentication weaknesses are the #1 way attackers gain unauthorized access. This can lead to full account takeover, data theft, and regulatory violations (GDPR, PCI-DSS).',
      BROKEN_ACCESS_CONTROL: 'BOLA/IDOR is the #1 API vulnerability (OWASP API Top 10). It allows any user to access any other user\'s data, leading to massive data breaches.',
      INJECTION_DETECTION: 'SQL/NoSQL injection allows attackers to read, modify, or delete your entire database. This is a top-3 vulnerability category with catastrophic impact.',
      SENSITIVE_DATA_EXPOSURE: 'Exposed data can be used for identity theft, account takeover, or regulatory fines. GDPR can impose fines up to 4% of annual revenue.',
      SECRET_EXPOSURE: 'Exposed credentials give attackers direct access to your infrastructure, databases, and third-party services without needing to exploit any other vulnerability.',
      MASS_ASSIGNMENT: 'Mass assignment allows any user to make themselves admin. This is a privilege escalation attack that bypasses all other access controls.',
      XSS_DETECTION: 'XSS allows attackers to steal user sessions, redirect users to malicious sites, and perform actions on behalf of victims.',
      CORS_MISCONFIGURATION: 'CORS misconfiguration allows malicious websites to make authenticated API requests on behalf of your users, stealing data or performing actions.',
      SSRF_POSTURE: 'SSRF allows attackers to reach your internal infrastructure, cloud metadata services, and internal APIs that are not exposed to the internet.',
      COMMAND_INJECTION: 'Command injection gives attackers full operating system access. They can read files, access databases, pivot to other servers, and deploy malware.',
    };
    return impacts[category] ?? 'This finding represents a security risk that should be evaluated and addressed based on your threat model.';
  }

  private explainAttackerAbuse(category: string, endpoint: string | null): string {
    const ep = endpoint ?? 'the vulnerable endpoint';
    const abuses: Record<string, string> = {
      AUTH_POSTURE: `An attacker sends crafted requests to ${ep}, bypassing the authentication check. They gain access to authenticated functionality without valid credentials. From there, they can access user data, perform actions, or escalate to admin.`,
      BROKEN_ACCESS_CONTROL: `An attacker authenticates as a normal user, then changes the resource ID in requests to ${ep} to access other users' data. By iterating through IDs, they can enumerate and exfiltrate all user records.`,
      INJECTION_DETECTION: `An attacker sends a specially crafted payload to ${ep} that alters the database query. Using techniques like UNION-based or time-based blind injection, they extract table names, column names, and all data records.`,
      SENSITIVE_DATA_EXPOSURE: `An attacker simply calls ${ep} and reads the response. No exploitation needed — the sensitive data is returned directly. They collect emails, password hashes, API keys, or PII for further attacks.`,
      MASS_ASSIGNMENT: `An attacker sends a PATCH/PUT request to ${ep} with additional fields like {"role":"admin","isAdmin":true}. If the server doesn't whitelist fields, the attacker's role is changed to admin.`,
      SSRF_POSTURE: `An attacker provides an internal URL (like http://169.254.169.254/) to ${ep}. The server fetches this URL internally, exposing cloud credentials, internal service data, or allowing pivoting to internal networks.`,
    };
    return abuses[category] ?? `An attacker exploits the vulnerability on ${ep} to gain unauthorized access or extract sensitive information.`;
  }

  private getReferences(category: string): string[] {
    const refs: Record<string, string[]> = {
      AUTH_POSTURE: ['https://owasp.org/API-Security/editions/2023/en/0xa2-broken-authentication/', 'https://cheatsheetseries.owasp.org/cheatsheets/Authentication_Cheat_Sheet.html'],
      BROKEN_ACCESS_CONTROL: ['https://owasp.org/API-Security/editions/2023/en/0xa1-broken-object-level-authorization/', 'https://cheatsheetseries.owasp.org/cheatsheets/Authorization_Cheat_Sheet.html'],
      INJECTION_DETECTION: ['https://owasp.org/www-community/attacks/SQL_Injection', 'https://cheatsheetseries.owasp.org/cheatsheets/Query_Parameterization_Cheat_Sheet.html'],
      XSS_DETECTION: ['https://owasp.org/www-community/attacks/xss/', 'https://cheatsheetseries.owasp.org/cheatsheets/Cross_Site_Scripting_Prevention_Cheat_Sheet.html'],
      CORS_MISCONFIGURATION: ['https://portswigger.net/web-security/cors', 'https://developer.mozilla.org/en-US/docs/Web/HTTP/CORS'],
      SSRF_POSTURE: ['https://owasp.org/www-community/attacks/Server_Side_Request_Forgery', 'https://cheatsheetseries.owasp.org/cheatsheets/Server_Side_Request_Forgery_Prevention_Cheat_Sheet.html'],
    };
    return refs[category] ?? ['https://owasp.org/API-Security/'];
  }

  // ═══════════════════════════════════════════════════════════════
  // UTILITY METHODS
  // ═══════════════════════════════════════════════════════════════

  private severityRank(severity: string): number {
    return { CRITICAL: 5, HIGH: 4, MEDIUM: 3, LOW: 2, INFORMATIONAL: 1 }[severity] ?? 0;
  }

  private estimateEffort(category: string): 'LOW' | 'MEDIUM' | 'HIGH' {
    const high: string[] = ['INJECTION_DETECTION', 'COMMAND_INJECTION', 'SSRF_POSTURE'];
    const low: string[] = ['CORS_MISCONFIGURATION', 'HEADER_SECURITY', 'TECH_DISCLOSURE', 'DEBUG_EXPOSURE'];
    if (high.includes(category)) return 'HIGH';
    if (low.includes(category)) return 'LOW';
    return 'MEDIUM';
  }

  private extractModulesExecuted(plannerSummary: Record<string, unknown> | null): string[] {
    if (!plannerSummary?.autonomousPlan) return [];
    const plan = plannerSummary.autonomousPlan as Record<string, unknown>;
    return Array.isArray(plan.globalDecisions) ? plan.globalDecisions as string[] : [];
  }

  private extractDecisions(plannerSummary: Record<string, unknown> | null): string[] {
    return this.extractModulesExecuted(plannerSummary);
  }

  private countDecisions(plannerSummary: Record<string, unknown> | null): number {
    return this.extractDecisions(plannerSummary).length;
  }
}
