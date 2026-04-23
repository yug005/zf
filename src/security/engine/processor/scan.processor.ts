import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { PrismaService } from '../../../prisma/prisma.service.js';
import { SECURITY_SCAN_QUEUE, SCAN_STAGE_ORDER } from '../constants.js';
import type { SecurityScanJobData } from '../constants.js';
import { TargetPrepStage } from '../stages/target-prep.stage.js';
import { VerificationCheckStage } from '../stages/verification-check.stage.js';
import { AssetDiscoveryStage } from '../stages/asset-discovery.stage.js';
import { TargetClassificationStage } from '../stages/target-classification.stage.js';
import { ScenarioPlanningStage } from '../stages/scenario-planning.stage.js';
import { ScenarioExecutionStage } from '../stages/scenario-execution.stage.js';
import { ObservationVerificationStage } from '../stages/observation-verification.stage.js';
import { ValidationLoopStage } from '../stages/validation-loop.stage.js';
import { AttackPathAnalysisStage } from '../stages/attack-path-analysis.stage.js';
import { ScoringStage } from '../stages/scoring.stage.js';
import { HistoricalComparisonStage } from '../stages/historical-comparison.stage.js';
import { ReportGenerationStage } from '../stages/report-generation.stage.js';
import { ExploitChainEngine } from '../systems/exploit-chain-engine.js';
import { AutonomousDecisionEngine } from '../systems/autonomous-decision-engine.js';
import { ExploitSimulationEngine } from '../systems/exploit-simulation-engine.js';
import { IntelligentReportingEngine } from '../systems/intelligent-reporting-engine.js';
import { ContinuousLearningEngine } from '../systems/continuous-learning-engine.js';

@Processor(SECURITY_SCAN_QUEUE, { concurrency: 2 })
export class ScanProcessor extends WorkerHost {
  private readonly logger = new Logger(ScanProcessor.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly targetPrepStage: TargetPrepStage,
    private readonly verificationCheckStage: VerificationCheckStage,
    private readonly assetDiscoveryStage: AssetDiscoveryStage,
    private readonly targetClassificationStage: TargetClassificationStage,
    private readonly scenarioPlanningStage: ScenarioPlanningStage,
    private readonly scenarioExecutionStage: ScenarioExecutionStage,
    private readonly observationVerificationStage: ObservationVerificationStage,
    private readonly validationLoopStage: ValidationLoopStage,
    private readonly attackPathAnalysisStage: AttackPathAnalysisStage,
    private readonly scoringStage: ScoringStage,
    private readonly historicalComparisonStage: HistoricalComparisonStage,
    private readonly reportGenerationStage: ReportGenerationStage,
    // ─── Next-Gen Autonomous Systems ──────────────────────────
    private readonly exploitChainEngine: ExploitChainEngine,
    private readonly autonomousDecisionEngine: AutonomousDecisionEngine,
    private readonly exploitSimulationEngine: ExploitSimulationEngine,
    private readonly intelligentReportingEngine: IntelligentReportingEngine,
    private readonly continuousLearningEngine: ContinuousLearningEngine,
  ) {
    super();
  }

  async process(job: Job<SecurityScanJobData>): Promise<void> {
    const { scanId, targetId, tier } = job.data;
    this.logger.log(`Processing scan ${scanId} (tier: ${tier})`);

    try {
      // Mark as RUNNING
      await this.prisma.securityScan.update({
        where: { id: scanId },
        data: { status: 'RUNNING', startedAt: new Date() },
      });

      const stageMap = {
        TARGET_PREP: this.targetPrepStage,
        VERIFICATION_CHECK: this.verificationCheckStage,
        ASSET_DISCOVERY: this.assetDiscoveryStage,
        TARGET_CLASSIFICATION: this.targetClassificationStage,
        SCENARIO_PLANNING: this.scenarioPlanningStage,
        SCENARIO_EXECUTION: this.scenarioExecutionStage,
        OBSERVATION_VERIFICATION: this.observationVerificationStage,
        VALIDATION_LOOP: this.validationLoopStage,
        ATTACK_PATH_ANALYSIS: this.attackPathAnalysisStage,
        SCORING: this.scoringStage,
        HISTORICAL_COMPARISON: this.historicalComparisonStage,
        REPORT_GENERATION: this.reportGenerationStage,
      };

      // Execute stages sequentially
      for (const stageName of SCAN_STAGE_ORDER) {
        if (stageName === 'DONE') break;

        const stage = stageMap[stageName as keyof typeof stageMap];
        if (!stage) continue;

        this.logger.debug(`Scan ${scanId}: entering stage ${stageName}`);

        await this.prisma.securityScan.update({
          where: { id: scanId },
          data: {
            stage: stageName as any,
            stageProgress: {
              currentStage: stageName,
              completedStages: SCAN_STAGE_ORDER.indexOf(stageName),
              totalStages: SCAN_STAGE_ORDER.length - 1, // exclude DONE
            },
          },
        });

        await stage.execute(job.data);

        // ─── Autonomous system hooks ──────────────────────────
        // After SCENARIO_PLANNING: Generate autonomous scan plan
        if (stageName === 'SCENARIO_PLANNING') {
          this.logger.debug(`Scan ${scanId}: running autonomous decision engine`);
          await this.autonomousDecisionEngine.planScan(job.data);
        }

        // After VALIDATION_LOOP: Run exploit chain analysis & simulation
        if (stageName === 'VALIDATION_LOOP') {
          this.logger.debug(`Scan ${scanId}: running exploit chain engine`);
          await this.exploitChainEngine.execute(job.data);
          this.logger.debug(`Scan ${scanId}: running exploit simulation engine`);
          await this.exploitSimulationEngine.execute(job.data);
        }

        // After REPORT_GENERATION: Run intelligent reporting & learning
        if (stageName === 'REPORT_GENERATION') {
          this.logger.debug(`Scan ${scanId}: running intelligent reporting engine`);
          await this.intelligentReportingEngine.generateReport(job.data);
          this.logger.debug(`Scan ${scanId}: running continuous learning engine`);
          await this.continuousLearningEngine.learn(job.data);
        }

        this.logger.debug(`Scan ${scanId}: completed stage ${stageName}`);
      }

      // Mark as COMPLETED
      await this.prisma.securityScan.update({
        where: { id: scanId },
        data: {
          status: 'COMPLETED',
          stage: 'DONE',
          completedAt: new Date(),
          stageProgress: {
            currentStage: 'DONE',
            completedStages: SCAN_STAGE_ORDER.length - 1,
            totalStages: SCAN_STAGE_ORDER.length - 1,
          },
        },
      });

      this.logger.log(`Scan ${scanId} completed successfully`);
    } catch (error) {
      this.logger.error(`Scan ${scanId} failed: ${error}`, (error as Error).stack);

      await this.prisma.securityScan.update({
        where: { id: scanId },
        data: {
          status: 'FAILED',
          errorMessage: error instanceof Error ? error.message : 'Unknown error',
          completedAt: new Date(),
        },
      });
    }
  }
}
