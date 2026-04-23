import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { SECURITY_SCAN_QUEUE } from './constants.js';
import { ScanProducer } from './producer/scan.producer.js';
import { ScanProcessor } from './processor/scan.processor.js';
import { ScenarioPackRegistry } from './scenario-pack.registry.js';
import { TargetPrepStage } from './stages/target-prep.stage.js';
import { VerificationCheckStage } from './stages/verification-check.stage.js';
import { AssetDiscoveryStage } from './stages/asset-discovery.stage.js';
import { TargetClassificationStage } from './stages/target-classification.stage.js';
import { ScenarioPlanningStage } from './stages/scenario-planning.stage.js';
import { ScenarioExecutionStage } from './stages/scenario-execution.stage.js';
import { ObservationVerificationStage } from './stages/observation-verification.stage.js';
import { ValidationLoopStage } from './stages/validation-loop.stage.js';
import { AttackPathAnalysisStage } from './stages/attack-path-analysis.stage.js';
import { EndpointInventoryStage } from './stages/endpoint-inventory.stage.js';
import { PassiveAnalysisStage } from './stages/passive-analysis.stage.js';
import { ActiveProbesStage } from './stages/active-probes.stage.js';
import { AdvancedAttackStage } from './stages/advanced-attack.stage.js';
import { ScoringStage } from './stages/scoring.stage.js';
import { HistoricalComparisonStage } from './stages/historical-comparison.stage.js';
import { ReportGenerationStage } from './stages/report-generation.stage.js';
import { ComplianceService } from './normalization/compliance.service.js';
// ─── Enterprise Probe Modules ─────────────────────────────────────
import { AuthenticatedScanner } from './modules/authenticated-scanner.js';
import { ClientSideAnalyzer } from './modules/client-side-analyzer.js';
import { SecretsDetector } from './modules/secrets-detector.js';
import { CloudInfraProber } from './modules/cloud-infra-prober.js';
import { ApiAbuseDetector } from './modules/api-abuse-detector.js';
import { BusinessLogicTester } from './modules/business-logic-tester.js';
import { CredentialAuditor } from './modules/credential-auditor.js';
import { UserEnumerationDetector } from './modules/user-enumeration-detector.js';
import { AccountSecurityTester } from './modules/account-security-tester.js';
import { BreachExposureAuditor } from './modules/breach-exposure-auditor.js';
// ─── Advanced Attack Framework Modules ────────────────────────────
import { IntelligentRecon } from './modules/intelligent-recon.js';
import { AdaptiveAttackEngine } from './modules/adaptive-attack-engine.js';
import { InjectionDeserEngine } from './modules/injection-deser-engine.js';
import { RaceConditionEngine } from './modules/race-condition-engine.js';
// ─── Next-Gen Autonomous Systems ──────────────────────────────────
import { ExploitChainEngine } from './systems/exploit-chain-engine.js';
import { AutonomousDecisionEngine } from './systems/autonomous-decision-engine.js';
import { ExploitSimulationEngine } from './systems/exploit-simulation-engine.js';
import { IntelligentReportingEngine } from './systems/intelligent-reporting-engine.js';
import { ContinuousLearningEngine } from './systems/continuous-learning-engine.js';

/**
 * SecurityEngineModule — the security scan execution pipeline.
 *
 * Architecture mirrors the monitor engine:
 *   Producer → Redis Queue → Processor → Stages → DB
 *
 *   [ScanProducer]           Adds jobs to BullMQ queue
 *        ↓
 *   [Redis: security-scan-queue]
 *        ↓
 *   [ScanProcessor]          Orchestrates stages sequentially
 *        ↓
 *   [Stages: Prep → Verify → AssetDiscovery → Classify → Plan →
 *            Execute → Observe → Validate → AttackPaths →
 *            Score → HistoricalDelta → Report]
 */
@Module({
  imports: [
    BullModule.registerQueueAsync({
      name: SECURITY_SCAN_QUEUE,
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        defaultJobOptions: {
          removeOnComplete: { age: 86400, count: 200 },
          removeOnFail: { age: 604800, count: 500 },
        },
      }),
    }),
  ],
  providers: [
    ScanProducer,
    ScanProcessor,
    ScenarioPackRegistry,
    // ─── Pipeline Stages ───────────────────────────────────────
    TargetPrepStage,
    VerificationCheckStage,
    AssetDiscoveryStage,
    TargetClassificationStage,
    ScenarioPlanningStage,
    ScenarioExecutionStage,
    ObservationVerificationStage,
    ValidationLoopStage,
    AttackPathAnalysisStage,
    EndpointInventoryStage,
    PassiveAnalysisStage,
    ActiveProbesStage,
    AdvancedAttackStage,
    ScoringStage,
    HistoricalComparisonStage,
    ReportGenerationStage,
    // ─── Enterprise Probe Modules ─────────────────────────────
    AuthenticatedScanner,
    ClientSideAnalyzer,
    SecretsDetector,
    CloudInfraProber,
    ApiAbuseDetector,
    BusinessLogicTester,
    CredentialAuditor,
    UserEnumerationDetector,
    AccountSecurityTester,
    BreachExposureAuditor,
    // ─── Advanced Attack Framework ────────────────────────────
    IntelligentRecon,
    AdaptiveAttackEngine,
    InjectionDeserEngine,
    RaceConditionEngine,
    // ─── Next-Gen Autonomous Systems ──────────────────────────
    ExploitChainEngine,
    AutonomousDecisionEngine,
    ExploitSimulationEngine,
    IntelligentReportingEngine,
    ContinuousLearningEngine,
    // ─── Normalization Services ────────────────────────────────
    ComplianceService,
  ],
  exports: [ScanProducer, ComplianceService],
})
export class SecurityEngineModule {}
