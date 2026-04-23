import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service.js';
import type { SecurityScanJobData } from '../constants.js';
import { EndpointInventoryStage } from './endpoint-inventory.stage.js';
import { PassiveAnalysisStage } from './passive-analysis.stage.js';
import { ActiveProbesStage } from './active-probes.stage.js';
import { AdvancedAttackStage } from './advanced-attack.stage.js';
import { AuthenticatedScanner } from '../modules/authenticated-scanner.js';
import { ClientSideAnalyzer } from '../modules/client-side-analyzer.js';
import { SecretsDetector } from '../modules/secrets-detector.js';
import { CloudInfraProber } from '../modules/cloud-infra-prober.js';
import { ApiAbuseDetector } from '../modules/api-abuse-detector.js';
import { BusinessLogicTester } from '../modules/business-logic-tester.js';
import { CredentialAuditor } from '../modules/credential-auditor.js';
import { UserEnumerationDetector } from '../modules/user-enumeration-detector.js';
import { AccountSecurityTester } from '../modules/account-security-tester.js';
import { IntelligentRecon } from '../modules/intelligent-recon.js';
import { AdaptiveAttackEngine } from '../modules/adaptive-attack-engine.js';
import { InjectionDeserEngine } from '../modules/injection-deser-engine.js';
import { RaceConditionEngine } from '../modules/race-condition-engine.js';

@Injectable()
export class ScenarioExecutionStage {
  private readonly logger = new Logger(ScenarioExecutionStage.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly endpointInventoryStage: EndpointInventoryStage,
    private readonly passiveAnalysisStage: PassiveAnalysisStage,
    private readonly activeProbesStage: ActiveProbesStage,
    private readonly advancedAttackStage: AdvancedAttackStage,
    private readonly authenticatedScanner: AuthenticatedScanner,
    private readonly clientSideAnalyzer: ClientSideAnalyzer,
    private readonly secretsDetector: SecretsDetector,
    private readonly cloudInfraProber: CloudInfraProber,
    private readonly apiAbuseDetector: ApiAbuseDetector,
    private readonly businessLogicTester: BusinessLogicTester,
    private readonly credentialAuditor: CredentialAuditor,
    private readonly userEnumerationDetector: UserEnumerationDetector,
    private readonly accountSecurityTester: AccountSecurityTester,
    private readonly intelligentRecon: IntelligentRecon,
    private readonly adaptiveAttackEngine: AdaptiveAttackEngine,
    private readonly injectionDeserEngine: InjectionDeserEngine,
    private readonly raceConditionEngine: RaceConditionEngine,
  ) {}

  async execute(data: SecurityScanJobData): Promise<void> {
    const scan = await this.prisma.securityScan.findUnique({
      where: { id: data.scanId },
      include: { target: true },
    });

    if (!scan) {
      throw new Error(`Scan ${data.scanId} not found.`);
    }

    const summary = (scan.plannerSummary as Record<string, any> | null) ?? {};
    const selectedPacks = Array.isArray(summary.selectedPacks) ? summary.selectedPacks : [];
    const selectedFamilies = new Set(selectedPacks.map((pack: any) => pack.family));

    if (selectedFamilies.has('API_EXPOSURE') || selectedFamilies.has('CLOUD_AND_PERIMETER')) {
      await this.endpointInventoryStage.execute(data);
    }

    if (selectedFamilies.has('SURFACE_VALIDATION')) {
      await this.passiveAnalysisStage.execute(data);
    }

    if (
      selectedFamilies.has('API_EXPOSURE') ||
      selectedFamilies.has('IDENTITY_AND_SECRETS') ||
      selectedFamilies.has('CLOUD_AND_PERIMETER')
    ) {
      await this.activeProbesStage.execute(data);
    }

    // Advanced attacks — only triggered when specific advanced attack packs are selected
    const advancedAttackSlugs = [
      'bola-idor', 'broken-authentication', 'mass-assignment', 'rate-limit-abuse',
      'privilege-escalation', 'injection-suite', 'graphql-abuse', 'subdomain-takeover',
      'oauth-oidc-abuse', 'cache-poisoning',
    ];
    const selectedSlugs = new Set(selectedPacks.map((pack: any) => pack.slug));
    const hasAdvancedAttacks = advancedAttackSlugs.some(slug => selectedSlugs.has(slug));

    if (hasAdvancedAttacks) {
      await this.advancedAttackStage.execute(data, selectedSlugs);
    }

    // ═══════════════════════════════════════════════════════════
    // Enterprise Modules — wired to their scenario pack slugs
    // ═══════════════════════════════════════════════════════════

    // Authenticated scanning — runs when auth context is provided
    if (data.authenticatedContext || selectedSlugs.has('authenticated-scan')) {
      await this.authenticatedScanner.execute(data);
    }

    // Client-side analysis — DOM XSS, CSP, JS secrets, SRI
    if (selectedSlugs.has('client-side-analysis') || selectedFamilies.has('SURFACE_VALIDATION')) {
      await this.clientSideAnalyzer.execute(data);
    }

    // Secrets & credential exposure detection
    if (
      selectedSlugs.has('secrets-detection') ||
      selectedFamilies.has('IDENTITY_AND_SECRETS') ||
      selectedFamilies.has('CLOUD_AND_PERIMETER')
    ) {
      await this.secretsDetector.execute(data);
    }

    // Cloud & infrastructure exposure analysis
    if (selectedSlugs.has('cloud-infrastructure') || selectedFamilies.has('CLOUD_AND_PERIMETER')) {
      await this.cloudInfraProber.execute(data);
    }

    // API abuse detection — BOPLA, pagination, filter injection
    if (selectedSlugs.has('api-abuse') || selectedFamilies.has('API_EXPOSURE')) {
      await this.apiAbuseDetector.execute(data);
    }

    // Business logic testing — workflow bypass, replay, race conditions
    if (selectedSlugs.has('business-logic')) {
      await this.businessLogicTester.execute(data);
    }

    // ═══════════════════════════════════════════════════════════
    // Beast-Mode Modules — Credential & Account Security
    // ═══════════════════════════════════════════════════════════

    // Credential auditing — default creds, password spray, policy analysis, lockout testing
    if (
      selectedSlugs.has('credential-audit') ||
      selectedFamilies.has('IDENTITY_AND_SECRETS') ||
      selectedSlugs.has('broken-authentication')
    ) {
      await this.credentialAuditor.execute(data);
    }

    // User enumeration detection — login/register/reset response differential
    if (
      selectedSlugs.has('user-enumeration') ||
      selectedFamilies.has('IDENTITY_AND_SECRETS') ||
      selectedSlugs.has('broken-authentication')
    ) {
      await this.userEnumerationDetector.execute(data);
    }

    // Account security testing — session fixation, logout, MFA bypass, CSRF, email takeover
    if (
      selectedSlugs.has('account-security') ||
      selectedSlugs.has('authenticated-scan') ||
      selectedFamilies.has('IDENTITY_AND_SECRETS')
    ) {
      await this.accountSecurityTester.execute(data);
    }

    // ═════════════════════════════════════════════════════════
    // Advanced Attack Framework
    // ═════════════════════════════════════════════════════════

    // Intelligent recon — runs EARLY to feed endpoints to downstream modules
    if (
      selectedSlugs.has('intelligent-recon') ||
      selectedFamilies.has('SURFACE_VALIDATION') ||
      selectedFamilies.has('API_EXPOSURE')
    ) {
      await this.intelligentRecon.execute(data);
    }

    // Adaptive attack engine — context-aware, stateful attack orchestration
    if (
      selectedSlugs.has('adaptive-attack') ||
      selectedFamilies.has('API_EXPOSURE') ||
      selectedFamilies.has('IDENTITY_AND_SECRETS')
    ) {
      await this.adaptiveAttackEngine.execute(data);
    }

    // Injection & deserialization engine — SQLi, NoSQL, proto pollution, SSTI, SSRF
    if (
      selectedSlugs.has('injection-deser') ||
      selectedSlugs.has('injection-suite') ||
      selectedFamilies.has('API_EXPOSURE')
    ) {
      await this.injectionDeserEngine.execute(data);
    }

    // Race condition engine — concurrency, double-spend, token reuse, rate-limit bypass
    if (
      selectedSlugs.has('race-condition') ||
      selectedSlugs.has('business-logic') ||
      selectedFamilies.has('API_EXPOSURE')
    ) {
      await this.raceConditionEngine.execute(data);
    }

    if (selectedFamilies.has('DETECTION_VALIDATION')) {
      await this.prisma.securityControlVerdict.create({
        data: {
          targetId: data.targetId,
          scanId: data.scanId,
          control: 'collector.detection_validation',
          status: scan.target.environment === 'LAB' ? 'DEGRADED' : 'NOT_OBSERVED',
          expected: {
            mode: 'collector-backed',
            packs: selectedPacks.filter((pack: any) => pack.family === 'DETECTION_VALIDATION'),
          },
          observed: {
            reason: 'Collector execution scaffolding is active; scenario replay requires registered collector heartbeat.',
          },
          detectionSource: 'planner',
        },
      });
    }

    this.logger.log(`Scenario execution completed for scan ${data.scanId}`);
  }
}
