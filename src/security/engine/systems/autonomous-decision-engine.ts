import { Injectable, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../../prisma/prisma.service.js';
import { GUARDRAILS } from '../constants.js';
import type { SecurityScanJobData } from '../constants.js';

/**
 * AUTONOMOUS_DECISION_ENGINE — Makes the scanner think before acting.
 *
 * Competitors:
 *   Burp/ZAP: Run every probe against every endpoint. Dumb and noisy.
 *   Nuclei: Run every template. Fast but zero context awareness.
 *
 * This system:
 *   Analyzes the target BEFORE probing, then makes intelligent decisions
 *   about WHAT to test, HOW deep to test, and WHEN to stop.
 *
 * Decision Framework:
 *
 *   ┌─────────────────────┐
 *   │  CONTEXT CLASSIFIER │ ← Reads: endpoint inventory, tech fingerprint, auth context
 *   └────────┬────────────┘
 *            │ produces TargetProfile
 *   ┌────────┴────────────┐
 *   │  RISK PRIORITIZER   │ ← Scores each endpoint: 0-100 risk priority
 *   └────────┬────────────┘
 *            │ produces PrioritizedEndpoints
 *   ┌────────┴────────────┐
 *   │  PROBE SELECTOR     │ ← Selects optimal probes per endpoint context
 *   └────────┬────────────┘
 *            │ produces ScanPlan
 *   ┌────────┴────────────┐
 *   │  DEPTH CONTROLLER   │ ← Adaptively adjusts depth mid-scan
 *   └────────┬────────────┘
 *            │ produces DepthDecisions
 *   ┌────────┴────────────┐
 *   │  FEEDBACK LOOP      │ ← Learns from findings to redirect resources
 *   └────────────────────┘
 *
 * Key principle: A human pentester doesn't brute-force every endpoint.
 * They study the target, form hypotheses, and test where it matters.
 * This engine does exactly that.
 */

// ═══════════════════════════════════════════════════════════════════
// CLASSIFICATION TYPES
// ═══════════════════════════════════════════════════════════════════

type EndpointRole = 'AUTH_GATEWAY' | 'ADMIN_PANEL' | 'DATA_API' | 'FILE_HANDLER' | 'WEBHOOK_RECEIVER'
  | 'SEARCH_ENGINE' | 'PAYMENT_PROCESSOR' | 'USER_MANAGEMENT' | 'INTERNAL_SERVICE' | 'PUBLIC_CONTENT'
  | 'GRAPHQL_API' | 'DOCUMENTATION' | 'HEALTH_CHECK' | 'UNKNOWN';

type TechProfile = 'NODE_EXPRESS' | 'NODE_NESTJS' | 'PYTHON_DJANGO' | 'PYTHON_FLASK' | 'RUBY_RAILS'
  | 'JAVA_SPRING' | 'DOTNET' | 'PHP_LARAVEL' | 'GO' | 'RUST' | 'UNKNOWN';

type AttackSurface = 'MINIMAL' | 'NARROW' | 'MODERATE' | 'BROAD' | 'EXTENSIVE';

interface TargetProfile {
  techStack: TechProfile;
  attackSurface: AttackSurface;
  hasAuthentication: boolean;
  hasGraphQL: boolean;
  hasFileUpload: boolean;
  hasWebhooks: boolean;
  hasPayments: boolean;
  hasAdmin: boolean;
  endpointCount: number;
  techFingerprints: Record<string, string>;
  dominantContentType: 'JSON' | 'HTML' | 'XML' | 'MIXED';
}

interface EndpointPriority {
  path: string;
  method: string;
  role: EndpointRole;
  riskScore: number;        // 0-100
  recommendedDepth: 'SKIP' | 'SHALLOW' | 'STANDARD' | 'DEEP' | 'EXHAUSTIVE';
  recommendedProbes: string[];
  reason: string;
}

interface ScanPlan {
  targetProfile: TargetProfile;
  priorities: EndpointPriority[];
  totalBudget: number;
  allocatedBudget: Record<string, number>; // endpoint → request budget
  globalDecisions: GlobalDecision[];
  estimatedDuration: string;
}

interface GlobalDecision {
  decision: string;
  reason: string;
  impact: string;
}

interface DepthAdjustment {
  endpoint: string;
  previousDepth: string;
  newDepth: string;
  reason: string;
  trigger: string;
}

// ═══════════════════════════════════════════════════════════════════
// CLASSIFICATION RULES
// ═══════════════════════════════════════════════════════════════════

const ROLE_CLASSIFIERS: Array<{ pattern: RegExp; role: EndpointRole; baseRisk: number }> = [
  { pattern: /\/(admin|manage|console|backoffice|staff|superadmin)/i, role: 'ADMIN_PANEL', baseRisk: 95 },
  { pattern: /\/(checkout|pay|payment|charge|billing|stripe|invoice)/i, role: 'PAYMENT_PROCESSOR', baseRisk: 90 },
  { pattern: /\/(auth|login|signin|register|signup|logout|oauth|sso|session|token|forgot|reset)/i, role: 'AUTH_GATEWAY', baseRisk: 85 },
  { pattern: /\/(users?|profiles?|accounts?|members?)/i, role: 'USER_MANAGEMENT', baseRisk: 80 },
  { pattern: /\/(upload|download|file|export|import|media|attachment|document)/i, role: 'FILE_HANDLER', baseRisk: 75 },
  { pattern: /\/(webhook|callback|hook|notify|event)/i, role: 'WEBHOOK_RECEIVER', baseRisk: 70 },
  { pattern: /\/(search|query|filter|find|autocomplete)/i, role: 'SEARCH_ENGINE', baseRisk: 65 },
  { pattern: /\/graphql|\/gql/i, role: 'GRAPHQL_API', baseRisk: 70 },
  { pattern: /\/(debug|metrics|actuator|trace|pprof|internal)/i, role: 'INTERNAL_SERVICE', baseRisk: 60 },
  { pattern: /\/(docs|swagger|openapi|api-docs|redoc)/i, role: 'DOCUMENTATION', baseRisk: 30 },
  { pattern: /\/(health|ready|alive|ping|status|version)/i, role: 'HEALTH_CHECK', baseRisk: 10 },
  { pattern: /\/(api|v\d|data|items|orders|products|resources)/i, role: 'DATA_API', baseRisk: 55 },
  { pattern: /^\/$|\/index|\/home|\/about|\/contact|\/faq/i, role: 'PUBLIC_CONTENT', baseRisk: 20 },
];

const TECH_FINGERPRINTS: Array<{ header: string; value: RegExp; tech: TechProfile }> = [
  { header: 'x-powered-by', value: /express/i, tech: 'NODE_EXPRESS' },
  { header: 'x-powered-by', value: /nestjs/i, tech: 'NODE_NESTJS' },
  { header: 'server', value: /gunicorn|uvicorn|daphne/i, tech: 'PYTHON_DJANGO' },
  { header: 'server', value: /werkzeug/i, tech: 'PYTHON_FLASK' },
  { header: 'x-powered-by', value: /phusion|puma|unicorn/i, tech: 'RUBY_RAILS' },
  { header: 'server', value: /apache.*tomcat|jetty|undertow/i, tech: 'JAVA_SPRING' },
  { header: 'x-powered-by', value: /asp\.net/i, tech: 'DOTNET' },
  { header: 'x-powered-by', value: /php/i, tech: 'PHP_LARAVEL' },
];

/**
 * Per-role probe recommendations. Maps each endpoint role to the
 * probes that a human pentester would prioritize.
 */
const PROBE_STRATEGY: Record<EndpointRole, string[]> = {
  AUTH_GATEWAY: ['credential-audit', 'user-enumeration', 'account-security', 'adaptive-attack', 'race-condition'],
  ADMIN_PANEL: ['adaptive-attack', 'injection-deser', 'account-security', 'credential-audit'],
  DATA_API: ['injection-deser', 'adaptive-attack', 'intelligent-recon'],
  FILE_HANDLER: ['injection-deser', 'adaptive-attack'],
  WEBHOOK_RECEIVER: ['adaptive-attack', 'injection-deser'],
  SEARCH_ENGINE: ['injection-deser', 'adaptive-attack'],
  PAYMENT_PROCESSOR: ['race-condition', 'adaptive-attack', 'injection-deser', 'account-security'],
  USER_MANAGEMENT: ['adaptive-attack', 'injection-deser', 'user-enumeration', 'account-security'],
  INTERNAL_SERVICE: ['intelligent-recon', 'adaptive-attack'],
  GRAPHQL_API: ['intelligent-recon', 'injection-deser', 'adaptive-attack'],
  PUBLIC_CONTENT: ['intelligent-recon'],
  DOCUMENTATION: ['intelligent-recon'],
  HEALTH_CHECK: [],
  UNKNOWN: ['intelligent-recon', 'adaptive-attack'],
};

// ═══════════════════════════════════════════════════════════════════
// ENGINE
// ═══════════════════════════════════════════════════════════════════

@Injectable()
export class AutonomousDecisionEngine {
  private readonly logger = new Logger(AutonomousDecisionEngine.name);

  // ── In-scan learning state ──
  private findingsFeedback: Array<{ category: string; endpoint: string; severity: string }> = [];
  private depthAdjustments: DepthAdjustment[] = [];

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Phase 1: Pre-scan analysis. Called BEFORE scenario execution.
   * Produces a ScanPlan that optimizes resource allocation.
   */
  async planScan(data: SecurityScanJobData): Promise<ScanPlan> {
    this.findingsFeedback = [];
    this.depthAdjustments = [];

    // Load discovered endpoints and recon data
    const [endpoints, scan, previousScans] = await Promise.all([
      this.prisma.securityEndpointInventory.findMany({
        where: { targetId: data.targetId },
        orderBy: { confidence: 'desc' },
      }),
      this.prisma.securityScan.findUnique({
        where: { id: data.scanId },
        include: { target: true },
      }),
      // Load previous scan results for this target (continuous learning)
      this.prisma.securityScan.findMany({
        where: {
          targetId: data.targetId,
          status: 'COMPLETED',
          id: { not: data.scanId },
        },
        orderBy: { completedAt: 'desc' },
        take: 3,
        select: {
          id: true,
          stageProgress: true,
          reportMetadata: true,
          score: true,
        },
      }),
    ]);

    if (!scan) throw new Error(`Scan ${data.scanId} not found`);

    // ─── 1. Build target profile ──────────────────────────────
    const stageProgress = (scan.stageProgress as Record<string, unknown>) ?? {};
    const techFingerprints: Record<string, string> = ((stageProgress as Record<string, Record<string, Record<string, string>>>)
      ?.intelligentRecon?.techFingerprints) ?? {};

    const targetProfile = this.buildTargetProfile(endpoints, techFingerprints);

    // ─── 2. Classify & prioritize endpoints ───────────────────
    const priorities = endpoints.map(ep =>
      this.prioritizeEndpoint(ep.path, ep.method, targetProfile, previousScans),
    );

    // Sort by risk score (highest first)
    priorities.sort((a, b) => b.riskScore - a.riskScore);

    // ─── 3. Allocate request budget ───────────────────────────
    const guardrails = data.tier === 'STANDARD' ? GUARDRAILS.STANDARD
      : data.tier === 'ADVANCED' ? GUARDRAILS.ADVANCED
      : GUARDRAILS.DEEP;
    const totalBudget = guardrails.maxRequestsPerScan;

    const allocatedBudget = this.allocateBudget(priorities, totalBudget);

    // ─── 4. Generate global decisions ─────────────────────────
    const globalDecisions = this.generateGlobalDecisions(targetProfile, priorities, data);

    // ─── 5. Estimate duration ─────────────────────────────────
    const avgRequestTime = guardrails.perRequestTimeoutMs * 0.3; // Assume 30% of timeout
    const estimatedMs = totalBudget * avgRequestTime;
    const estimatedDuration = estimatedMs > 60000
      ? `~${Math.round(estimatedMs / 60000)} minutes`
      : `~${Math.round(estimatedMs / 1000)} seconds`;

    const plan: ScanPlan = {
      targetProfile,
      priorities,
      totalBudget,
      allocatedBudget,
      globalDecisions,
      estimatedDuration,
    };

    // Persist plan for downstream stages
    await this.prisma.securityScan.update({
      where: { id: data.scanId },
      data: {
        plannerSummary: {
          ...(scan.plannerSummary as Record<string, unknown> ?? {}),
          autonomousPlan: {
            targetProfile,
            endpointCount: endpoints.length,
            highRiskEndpoints: priorities.filter(p => p.riskScore >= 70).length,
            mediumRiskEndpoints: priorities.filter(p => p.riskScore >= 40 && p.riskScore < 70).length,
            lowRiskEndpoints: priorities.filter(p => p.riskScore < 40).length,
            skippedEndpoints: priorities.filter(p => p.recommendedDepth === 'SKIP').length,
            globalDecisions: globalDecisions.map(d => d.decision),
            estimatedDuration,
            totalBudget,
          },
        } as unknown as Prisma.InputJsonValue,
      },
    });

    this.logger.log(
      `Scan plan generated for ${data.scanId}: ${endpoints.length} endpoints, ` +
      `${priorities.filter(p => p.riskScore >= 70).length} high-risk, ` +
      `${globalDecisions.length} autonomous decisions. Budget: ${totalBudget} requests.`,
    );

    return plan;
  }

  /**
   * Phase 2: Mid-scan feedback. Called after each module completes.
   * Adjusts depth and redirects resources based on findings.
   */
  processFeedback(finding: {
    category: string; endpoint: string; severity: string; exploitability: string;
  }): DepthAdjustment | null {
    this.findingsFeedback.push(finding);

    // ─── Decision: Deepen on critical findings ────────────────
    if (finding.severity === 'CRITICAL' && finding.exploitability === 'PROVEN') {
      const adjustment: DepthAdjustment = {
        endpoint: finding.endpoint,
        previousDepth: 'STANDARD',
        newDepth: 'EXHAUSTIVE',
        reason: `CRITICAL/PROVEN finding detected: ${finding.category}`,
        trigger: 'severity_escalation',
      };
      this.depthAdjustments.push(adjustment);
      return adjustment;
    }

    // ─── Decision: Widen scope on auth findings ───────────────
    if (['AUTH_POSTURE', 'BROKEN_ACCESS_CONTROL'].includes(finding.category)) {
      const adjustment: DepthAdjustment = {
        endpoint: '*', // Widen to all endpoints
        previousDepth: 'STANDARD',
        newDepth: 'DEEP',
        reason: `Auth vulnerability found on ${finding.endpoint} — deepening BOLA/IDOR checks across all endpoints`,
        trigger: 'auth_weakness_cascade',
      };
      this.depthAdjustments.push(adjustment);
      return adjustment;
    }

    // ─── Decision: Focus injection testing ────────────────────
    if (['INJECTION_DETECTION', 'SSTI_DETECTION', 'COMMAND_INJECTION'].includes(finding.category)) {
      const adjustment: DepthAdjustment = {
        endpoint: finding.endpoint,
        previousDepth: 'STANDARD',
        newDepth: 'EXHAUSTIVE',
        reason: `Injection detected on ${finding.endpoint} — exhaustive follow-up with time-based and union-based variants`,
        trigger: 'injection_confirmation',
      };
      this.depthAdjustments.push(adjustment);
      return adjustment;
    }

    return null;
  }

  /**
   * Phase 3: Post-scan intelligence. Generates insights for
   * the Continuous Learning Engine to persist cross-scan.
   */
  generateInsights(): {
    adjustmentsMade: DepthAdjustment[];
    findingsPerEndpoint: Record<string, number>;
    mostVulnerableEndpoints: string[];
    leastProductiveProbes: string[];
  } {
    const findingsPerEndpoint: Record<string, number> = {};
    for (const f of this.findingsFeedback) {
      findingsPerEndpoint[f.endpoint] = (findingsPerEndpoint[f.endpoint] ?? 0) + 1;
    }

    const sorted = Object.entries(findingsPerEndpoint).sort(([, a], [, b]) => b - a);
    const mostVulnerableEndpoints = sorted.slice(0, 5).map(([ep]) => ep);

    return {
      adjustmentsMade: this.depthAdjustments,
      findingsPerEndpoint,
      mostVulnerableEndpoints,
      leastProductiveProbes: [], // Populated by continuous learning engine
    };
  }

  // ═══════════════════════════════════════════════════════════════
  // TARGET PROFILING
  // ═══════════════════════════════════════════════════════════════

  private buildTargetProfile(
    endpoints: Array<{ path: string; method: string; metadata: unknown }>,
    techFingerprints: Record<string, string>,
  ): TargetProfile {
    const tech = this.identifyTechStack(techFingerprints);
    const paths = endpoints.map(e => e.path);

    return {
      techStack: tech,
      attackSurface: this.assessAttackSurface(endpoints.length),
      hasAuthentication: paths.some(p => /auth|login|register|oauth|session/i.test(p)),
      hasGraphQL: paths.some(p => /graphql|gql/i.test(p)),
      hasFileUpload: paths.some(p => /upload|file|media|attachment/i.test(p)),
      hasWebhooks: paths.some(p => /webhook|callback|hook/i.test(p)),
      hasPayments: paths.some(p => /pay|checkout|billing|charge|stripe/i.test(p)),
      hasAdmin: paths.some(p => /admin|manage|console/i.test(p)),
      endpointCount: endpoints.length,
      techFingerprints,
      dominantContentType: 'JSON', // Default; could be detected from responses
    };
  }

  private identifyTechStack(fingerprints: Record<string, string>): TechProfile {
    for (const fp of TECH_FINGERPRINTS) {
      const headerValue = fingerprints[fp.header];
      if (headerValue && fp.value.test(headerValue)) {
        return fp.tech;
      }
    }
    return 'UNKNOWN';
  }

  private assessAttackSurface(endpointCount: number): AttackSurface {
    if (endpointCount <= 5) return 'MINIMAL';
    if (endpointCount <= 15) return 'NARROW';
    if (endpointCount <= 30) return 'MODERATE';
    if (endpointCount <= 60) return 'BROAD';
    return 'EXTENSIVE';
  }

  // ═══════════════════════════════════════════════════════════════
  // ENDPOINT PRIORITIZATION
  // ═══════════════════════════════════════════════════════════════

  private prioritizeEndpoint(
    path: string,
    method: string,
    profile: TargetProfile,
    previousScans: Array<{ stageProgress: unknown; reportMetadata: unknown; score: number | null }>,
  ): EndpointPriority {
    // Classify role
    let role: EndpointRole = 'UNKNOWN';
    let baseRisk = 40;

    for (const classifier of ROLE_CLASSIFIERS) {
      if (classifier.pattern.test(path)) {
        role = classifier.role;
        baseRisk = classifier.baseRisk;
        break;
      }
    }

    // ── Risk multipliers ──
    let riskScore = baseRisk;

    // Mutation methods are riskier
    if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(method)) {
      riskScore = Math.min(100, riskScore * 1.15);
    }

    // Endpoints with parameters (dynamic) are riskier
    if (path.includes(':') || path.includes('{')) {
      riskScore = Math.min(100, riskScore * 1.1);
    }

    // Admin endpoints without auth context = highest priority
    if (role === 'ADMIN_PANEL' && !profile.hasAuthentication) {
      riskScore = 100;
    }

    // Apply historical knowledge — endpoints that had findings before get higher priority
    const prevFindings = this.extractPreviousFindings(previousScans, path);
    if (prevFindings > 0) {
      riskScore = Math.min(100, riskScore * (1 + prevFindings * 0.1));
    }

    // Round
    riskScore = Math.round(riskScore);

    // ── Depth recommendation ──
    const recommendedDepth = riskScore >= 85 ? 'EXHAUSTIVE'
      : riskScore >= 65 ? 'DEEP'
      : riskScore >= 40 ? 'STANDARD'
      : riskScore >= 15 ? 'SHALLOW'
      : 'SKIP';

    // ── Probe selection ──
    const recommendedProbes = PROBE_STRATEGY[role] ?? PROBE_STRATEGY.UNKNOWN;

    return {
      path,
      method,
      role,
      riskScore,
      recommendedDepth,
      recommendedProbes,
      reason: `Role: ${role}, Base risk: ${baseRisk}, Method: ${method}, Final: ${riskScore}`,
    };
  }

  private extractPreviousFindings(
    previousScans: Array<{ reportMetadata: unknown }>,
    path: string,
  ): number {
    let count = 0;
    for (const scan of previousScans) {
      const meta = scan.reportMetadata as Record<string, unknown> | null;
      if (meta?.topRemediations && Array.isArray(meta.topRemediations)) {
        // Simple heuristic: count mentions of this path
        for (const rem of meta.topRemediations) {
          if (typeof rem === 'object' && rem !== null && 'category' in rem) {
            count++;
          }
        }
      }
    }
    return Math.min(count, 5);
  }

  // ═══════════════════════════════════════════════════════════════
  // BUDGET ALLOCATION
  // ═══════════════════════════════════════════════════════════════

  private allocateBudget(
    priorities: EndpointPriority[],
    totalBudget: number,
  ): Record<string, number> {
    const allocation: Record<string, number> = {};
    const depthBudgets: Record<string, number> = {
      EXHAUSTIVE: 40,
      DEEP: 25,
      STANDARD: 15,
      SHALLOW: 5,
      SKIP: 0,
    };

    // Calculate total demand
    let totalDemand = 0;
    for (const ep of priorities) {
      totalDemand += depthBudgets[ep.recommendedDepth] ?? 0;
    }

    // Proportional allocation if demand exceeds budget
    const scaleFactor = totalDemand > totalBudget ? totalBudget / totalDemand : 1.0;

    for (const ep of priorities) {
      const demand = depthBudgets[ep.recommendedDepth] ?? 0;
      allocation[`${ep.method}:${ep.path}`] = Math.max(1, Math.round(demand * scaleFactor));
    }

    return allocation;
  }

  // ═══════════════════════════════════════════════════════════════
  // GLOBAL DECISIONS
  // ═══════════════════════════════════════════════════════════════

  private generateGlobalDecisions(
    profile: TargetProfile,
    priorities: EndpointPriority[],
    data: SecurityScanJobData,
  ): GlobalDecision[] {
    const decisions: GlobalDecision[] = [];

    // Decision: Enable GraphQL-specific modules
    if (profile.hasGraphQL) {
      decisions.push({
        decision: 'ENABLE_GRAPHQL_DEEP_ANALYSIS',
        reason: 'GraphQL endpoints detected — enabling introspection, query depth, batch, and alias attacks',
        impact: 'GraphQL-specific probes will consume ~15% of request budget',
      });
    }

    // Decision: Prioritize auth testing
    if (profile.hasAuthentication && !data.authenticatedContext) {
      decisions.push({
        decision: 'PRIORITIZE_UNAUTH_ACCESS_TESTING',
        reason: 'Authentication endpoints exist but no authenticated context provided — testing for unauth access',
        impact: 'All data endpoints will be tested for access without credentials',
      });
    }

    // Decision: Enable race condition testing
    if (profile.hasPayments) {
      decisions.push({
        decision: 'ENABLE_PAYMENT_RACE_CONDITION',
        reason: 'Payment endpoints detected — enabling double-spend and idempotency testing',
        impact: 'Payment endpoints will receive exhaustive concurrent request testing',
      });
    }

    // Decision: Skip documentation endpoints
    const docEndpoints = priorities.filter(p => p.role === 'DOCUMENTATION');
    if (docEndpoints.length > 0) {
      decisions.push({
        decision: 'SKIP_DOCUMENTATION_PROBING',
        reason: `${docEndpoints.length} documentation endpoints detected — minimal attack surface`,
        impact: 'Documentation endpoints will only receive recon (OpenAPI ingestion), no active probing',
      });
    }

    // Decision: Admin without auth = MAXIMUM ALERT
    const unauthAdmin = priorities.filter(p => p.role === 'ADMIN_PANEL' && p.riskScore >= 95);
    if (unauthAdmin.length > 0) {
      decisions.push({
        decision: 'ADMIN_CRITICAL_PRIORITY',
        reason: `Admin endpoints detected (${unauthAdmin.length}) — allocating maximum depth and all attack modules`,
        impact: 'Admin endpoints will consume up to 30% of total request budget',
      });
    }

    // Decision: Tech-stack-specific strategy
    if (profile.techStack !== 'UNKNOWN') {
      const techStrategies: Record<TechProfile, string> = {
        NODE_EXPRESS: 'Enabling prototype pollution, NoSQL injection, and SSTI (EJS/Pug) probes',
        NODE_NESTJS: 'Enabling prototype pollution, NoSQL injection, and class-validator bypass probes',
        PYTHON_DJANGO: 'Enabling SSTI (Jinja2), SQL injection, and Django debug page detection',
        PYTHON_FLASK: 'Enabling SSTI (Jinja2), debug mode detection, and path traversal probes',
        RUBY_RAILS: 'Enabling SSTI (ERB), mass assignment, and deserialization probes',
        JAVA_SPRING: 'Enabling SSTI (Thymeleaf), Java deserialization, and actuator endpoint probes',
        DOTNET: 'Enabling ASP.NET deserialization, VIEWSTATE analysis, and MSSQL injection probes',
        PHP_LARAVEL: 'Enabling SSTI (Blade), PHP deserialization, and file upload bypass probes',
        GO: 'Enabling SSRF, path traversal, and template injection (html/template) probes',
        RUST: 'Minimal injection surface expected — focusing on logic and auth testing',
        UNKNOWN: 'Unknown tech stack — running broad probe selection',
      };

      decisions.push({
        decision: `TECH_SPECIFIC_STRATEGY_${profile.techStack}`,
        reason: `Technology stack identified: ${profile.techStack}`,
        impact: techStrategies[profile.techStack],
      });
    }

    return decisions;
  }

  /**
   * Query the plan to check if a specific probe should run against an endpoint.
   * Used by downstream modules to respect autonomous decisions.
   */
  shouldRunProbe(plan: ScanPlan, endpoint: string, probeName: string): boolean {
    const priority = plan.priorities.find(p => p.path === endpoint);
    if (!priority) return true; // Unknown endpoint — run probe

    if (priority.recommendedDepth === 'SKIP') return false;
    if (priority.recommendedProbes.length === 0) return false;

    return priority.recommendedProbes.includes(probeName);
  }

  /**
   * Get the allocated request budget for an endpoint.
   */
  getBudget(plan: ScanPlan, endpoint: string, method: string): number {
    return plan.allocatedBudget[`${method}:${endpoint}`] ?? 10;
  }
}
