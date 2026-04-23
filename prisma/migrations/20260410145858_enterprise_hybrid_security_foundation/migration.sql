-- CreateEnum
CREATE TYPE "TargetKind" AS ENUM ('WEB_APP', 'API', 'DOMAIN', 'CLOUD_ACCOUNT', 'IDENTITY_TENANT', 'HOST', 'COLLECTOR');

-- CreateEnum
CREATE TYPE "TargetEnvironment" AS ENUM ('LAB', 'DEVELOPMENT', 'STAGING', 'PRODUCTION');

-- CreateEnum
CREATE TYPE "AssetKind" AS ENUM ('WEB_APP', 'API', 'DOMAIN', 'CLOUD_ACCOUNT', 'IDENTITY_TENANT', 'HOST', 'COLLECTOR', 'ENDPOINT_GROUP', 'CROWN_JEWEL');

-- CreateEnum
CREATE TYPE "AssetReachability" AS ENUM ('EXTERNAL', 'INTERNAL', 'HYBRID');

-- CreateEnum
CREATE TYPE "AssetCriticality" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL');

-- CreateEnum
CREATE TYPE "AssetRelationshipKind" AS ENUM ('HOSTS', 'DEPENDS_ON', 'EXPOSES', 'TRUSTS', 'CAN_ASSUME_ROLE', 'CAN_REACH');

-- CreateEnum
CREATE TYPE "ScanExecutionMode" AS ENUM ('STANDARD', 'ADVANCED', 'EMULATION', 'CONTINUOUS_VALIDATION');

-- CreateEnum
CREATE TYPE "FindingValidationState" AS ENUM ('VALIDATED', 'PROBABLE', 'THEORETICAL', 'LAB_ONLY');

-- CreateEnum
CREATE TYPE "ObservationStatus" AS ENUM ('PENDING', 'VERIFIED', 'SUPPRESSED');

-- CreateEnum
CREATE TYPE "ObservationProofType" AS ENUM ('HEURISTIC', 'RESPONSE_MATCH', 'AUTH_BYPASS', 'POLICY_MISMATCH', 'ATTACK_PATH', 'CONTROL_GAP');

-- CreateEnum
CREATE TYPE "CollectorStatus" AS ENUM ('PENDING', 'ACTIVE', 'DEGRADED', 'OFFLINE', 'REVOKED');

-- CreateEnum
CREATE TYPE "EvidenceArtifactKind" AS ENUM ('HTTP_TRANSCRIPT', 'RESPONSE_HEADERS', 'DNS_ANSWER', 'SCREENSHOT', 'CLOUD_FINDING', 'DETECTOR_VERDICT', 'REQUEST_REPLAY', 'ATTACK_PATH');

-- CreateEnum
CREATE TYPE "ScenarioPackFamily" AS ENUM ('SURFACE_VALIDATION', 'API_EXPOSURE', 'IDENTITY_AND_SECRETS', 'CLOUD_AND_PERIMETER', 'DETECTION_VALIDATION');

-- CreateEnum
CREATE TYPE "ScenarioSafetyLevel" AS ENUM ('SAFE', 'GUARDED', 'COLLECTOR_ONLY');

-- CreateEnum
CREATE TYPE "ScenarioStepType" AS ENUM ('HTTP_REQUEST', 'DNS_QUERY', 'HEADER_MUTATION', 'AUTH_WORKFLOW', 'CLOUD_READ', 'IDENTITY_ENUM', 'COLLECTOR_ACTION', 'DETECTION_ASSERTION');

-- CreateEnum
CREATE TYPE "ControlVerdictStatus" AS ENUM ('PASSED', 'FAILED', 'DEGRADED', 'NOT_OBSERVED');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "ScanStage" ADD VALUE 'TARGET_CLASSIFICATION';
ALTER TYPE "ScanStage" ADD VALUE 'SCENARIO_PLANNING';
ALTER TYPE "ScanStage" ADD VALUE 'SCENARIO_EXECUTION';
ALTER TYPE "ScanStage" ADD VALUE 'OBSERVATION_VERIFICATION';
ALTER TYPE "ScanStage" ADD VALUE 'ATTACK_PATH_ANALYSIS';

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "ScanTier" ADD VALUE 'EMULATION';
ALTER TYPE "ScanTier" ADD VALUE 'CONTINUOUS_VALIDATION';

-- AlterTable
ALTER TABLE "security_endpoint_inventory" ADD COLUMN     "asset_id" TEXT;

-- AlterTable
ALTER TABLE "security_findings" ADD COLUMN     "affected_assets" JSONB,
ADD COLUMN     "attck_techniques" JSONB,
ADD COLUMN     "business_asset" TEXT,
ADD COLUMN     "labels" JSONB,
ADD COLUMN     "observation_id" TEXT,
ADD COLUMN     "primary_evidence_id" TEXT,
ADD COLUMN     "scenario_pack_slug" TEXT,
ADD COLUMN     "validation_state" "FindingValidationState" NOT NULL DEFAULT 'THEORETICAL';

-- AlterTable
ALTER TABLE "security_scan_profiles" ADD COLUMN     "asset_scope" JSONB,
ADD COLUMN     "authenticated_context" JSONB,
ADD COLUMN     "execution_mode" "ScanExecutionMode" NOT NULL DEFAULT 'STANDARD';

-- AlterTable
ALTER TABLE "security_scans" ADD COLUMN     "asset_scope" JSONB,
ADD COLUMN     "authenticated_context" JSONB,
ADD COLUMN     "execution_mode" "ScanExecutionMode" NOT NULL DEFAULT 'STANDARD',
ADD COLUMN     "planner_summary" JSONB;

-- AlterTable
ALTER TABLE "security_targets" ADD COLUMN     "criticality" "AssetCriticality" NOT NULL DEFAULT 'MEDIUM',
ADD COLUMN     "environment" "TargetEnvironment" NOT NULL DEFAULT 'PRODUCTION',
ADD COLUMN     "target_kind" "TargetKind" NOT NULL DEFAULT 'API';

-- CreateTable
CREATE TABLE "security_collectors" (
    "id" TEXT NOT NULL,
    "target_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "status" "CollectorStatus" NOT NULL DEFAULT 'PENDING',
    "environment" "TargetEnvironment" NOT NULL DEFAULT 'PRODUCTION',
    "capabilities" JSONB,
    "allowlist" JSONB,
    "policy" JSONB,
    "registration_token" TEXT,
    "last_heartbeat_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "security_collectors_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "security_assets" (
    "id" TEXT NOT NULL,
    "target_id" TEXT NOT NULL,
    "collector_id" TEXT,
    "parent_asset_id" TEXT,
    "kind" "AssetKind" NOT NULL,
    "name" TEXT NOT NULL,
    "hostname" TEXT,
    "address" TEXT,
    "external_id" TEXT,
    "environment" "TargetEnvironment" NOT NULL DEFAULT 'PRODUCTION',
    "criticality" "AssetCriticality" NOT NULL DEFAULT 'MEDIUM',
    "reachability" "AssetReachability" NOT NULL DEFAULT 'EXTERNAL',
    "tags" JSONB,
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "security_assets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "security_relationships" (
    "id" TEXT NOT NULL,
    "target_id" TEXT NOT NULL,
    "from_asset_id" TEXT NOT NULL,
    "to_asset_id" TEXT NOT NULL,
    "kind" "AssetRelationshipKind" NOT NULL,
    "confidence" "FindingConfidence" NOT NULL DEFAULT 'MEDIUM',
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "security_relationships_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "security_scenario_packs" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "family" "ScenarioPackFamily" NOT NULL,
    "version" TEXT NOT NULL,
    "execution_mode" "ScanExecutionMode" NOT NULL DEFAULT 'STANDARD',
    "safety_level" "ScenarioSafetyLevel" NOT NULL DEFAULT 'SAFE',
    "description" TEXT,
    "supported_asset_kinds" JSONB,
    "attck_techniques" JSONB,
    "prerequisites" JSONB,
    "pack_metadata" JSONB,
    "is_system" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "security_scenario_packs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "security_scenario_steps" (
    "id" TEXT NOT NULL,
    "scenario_pack_id" TEXT NOT NULL,
    "order_index" INTEGER NOT NULL,
    "step_type" "ScenarioStepType" NOT NULL,
    "title" TEXT NOT NULL,
    "config" JSONB,
    "verification_rule" JSONB,
    "requires_collector" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "security_scenario_steps_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "security_observations" (
    "id" TEXT NOT NULL,
    "scan_id" TEXT NOT NULL,
    "target_id" TEXT NOT NULL,
    "category" "FindingCategory" NOT NULL,
    "title" TEXT NOT NULL,
    "severity" "FindingSeverity" NOT NULL,
    "exploitability" "FindingExploitability" NOT NULL DEFAULT 'THEORETICAL',
    "confidence" "FindingConfidence" NOT NULL DEFAULT 'MEDIUM',
    "status" "ObservationStatus" NOT NULL DEFAULT 'PENDING',
    "proof_type" "ObservationProofType" NOT NULL DEFAULT 'HEURISTIC',
    "scenario_pack_slug" TEXT,
    "endpoint" TEXT,
    "http_method" TEXT,
    "parameter" TEXT,
    "evidence_summary" JSONB,
    "affected_assets" JSONB,
    "attck_techniques" JSONB,
    "labels" JSONB,
    "remediation" TEXT,
    "references" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "security_observations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "security_evidence_artifacts" (
    "id" TEXT NOT NULL,
    "target_id" TEXT NOT NULL,
    "scan_id" TEXT,
    "observation_id" TEXT,
    "finding_id" TEXT,
    "collector_id" TEXT,
    "attack_path_id" TEXT,
    "kind" "EvidenceArtifactKind" NOT NULL,
    "name" TEXT NOT NULL,
    "content_type" TEXT,
    "storage_key" TEXT,
    "summary" JSONB,
    "raw_payload" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "security_evidence_artifacts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "security_control_verdicts" (
    "id" TEXT NOT NULL,
    "target_id" TEXT NOT NULL,
    "scan_id" TEXT NOT NULL,
    "collector_id" TEXT,
    "evidence_artifact_id" TEXT,
    "control" TEXT NOT NULL,
    "status" "ControlVerdictStatus" NOT NULL,
    "expected" JSONB,
    "observed" JSONB,
    "detection_source" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "security_control_verdicts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "security_attack_paths" (
    "id" TEXT NOT NULL,
    "target_id" TEXT NOT NULL,
    "scan_id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "summary" TEXT,
    "entry_asset_id" TEXT,
    "crown_jewel_asset_id" TEXT,
    "score" DOUBLE PRECISION NOT NULL,
    "technique_chain" JSONB,
    "prerequisite_nodes" JSONB,
    "path_nodes" JSONB,
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "security_attack_paths_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "security_collectors_target_id_idx" ON "security_collectors"("target_id");

-- CreateIndex
CREATE INDEX "security_collectors_status_idx" ON "security_collectors"("status");

-- CreateIndex
CREATE INDEX "security_assets_target_id_idx" ON "security_assets"("target_id");

-- CreateIndex
CREATE INDEX "security_assets_collector_id_idx" ON "security_assets"("collector_id");

-- CreateIndex
CREATE INDEX "security_assets_kind_environment_idx" ON "security_assets"("kind", "environment");

-- CreateIndex
CREATE INDEX "security_relationships_target_id_idx" ON "security_relationships"("target_id");

-- CreateIndex
CREATE INDEX "security_relationships_from_asset_id_to_asset_id_idx" ON "security_relationships"("from_asset_id", "to_asset_id");

-- CreateIndex
CREATE UNIQUE INDEX "security_scenario_packs_slug_key" ON "security_scenario_packs"("slug");

-- CreateIndex
CREATE INDEX "security_scenario_packs_family_execution_mode_idx" ON "security_scenario_packs"("family", "execution_mode");

-- CreateIndex
CREATE INDEX "security_scenario_steps_scenario_pack_id_order_index_idx" ON "security_scenario_steps"("scenario_pack_id", "order_index");

-- CreateIndex
CREATE INDEX "security_observations_scan_id_status_idx" ON "security_observations"("scan_id", "status");

-- CreateIndex
CREATE INDEX "security_observations_target_id_category_idx" ON "security_observations"("target_id", "category");

-- CreateIndex
CREATE INDEX "security_evidence_artifacts_target_id_kind_idx" ON "security_evidence_artifacts"("target_id", "kind");

-- CreateIndex
CREATE INDEX "security_evidence_artifacts_scan_id_idx" ON "security_evidence_artifacts"("scan_id");

-- CreateIndex
CREATE INDEX "security_evidence_artifacts_observation_id_idx" ON "security_evidence_artifacts"("observation_id");

-- CreateIndex
CREATE INDEX "security_control_verdicts_target_id_scan_id_idx" ON "security_control_verdicts"("target_id", "scan_id");

-- CreateIndex
CREATE INDEX "security_control_verdicts_status_idx" ON "security_control_verdicts"("status");

-- CreateIndex
CREATE INDEX "security_attack_paths_target_id_scan_id_idx" ON "security_attack_paths"("target_id", "scan_id");

-- CreateIndex
CREATE INDEX "security_attack_paths_score_idx" ON "security_attack_paths"("score");

-- AddForeignKey
ALTER TABLE "security_findings" ADD CONSTRAINT "security_findings_observation_id_fkey" FOREIGN KEY ("observation_id") REFERENCES "security_observations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "security_findings" ADD CONSTRAINT "security_findings_primary_evidence_id_fkey" FOREIGN KEY ("primary_evidence_id") REFERENCES "security_evidence_artifacts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "security_endpoint_inventory" ADD CONSTRAINT "security_endpoint_inventory_asset_id_fkey" FOREIGN KEY ("asset_id") REFERENCES "security_assets"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "security_collectors" ADD CONSTRAINT "security_collectors_target_id_fkey" FOREIGN KEY ("target_id") REFERENCES "security_targets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "security_assets" ADD CONSTRAINT "security_assets_target_id_fkey" FOREIGN KEY ("target_id") REFERENCES "security_targets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "security_assets" ADD CONSTRAINT "security_assets_collector_id_fkey" FOREIGN KEY ("collector_id") REFERENCES "security_collectors"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "security_assets" ADD CONSTRAINT "security_assets_parent_asset_id_fkey" FOREIGN KEY ("parent_asset_id") REFERENCES "security_assets"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "security_relationships" ADD CONSTRAINT "security_relationships_target_id_fkey" FOREIGN KEY ("target_id") REFERENCES "security_targets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "security_relationships" ADD CONSTRAINT "security_relationships_from_asset_id_fkey" FOREIGN KEY ("from_asset_id") REFERENCES "security_assets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "security_relationships" ADD CONSTRAINT "security_relationships_to_asset_id_fkey" FOREIGN KEY ("to_asset_id") REFERENCES "security_assets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "security_scenario_steps" ADD CONSTRAINT "security_scenario_steps_scenario_pack_id_fkey" FOREIGN KEY ("scenario_pack_id") REFERENCES "security_scenario_packs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "security_observations" ADD CONSTRAINT "security_observations_scan_id_fkey" FOREIGN KEY ("scan_id") REFERENCES "security_scans"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "security_observations" ADD CONSTRAINT "security_observations_target_id_fkey" FOREIGN KEY ("target_id") REFERENCES "security_targets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "security_evidence_artifacts" ADD CONSTRAINT "security_evidence_artifacts_target_id_fkey" FOREIGN KEY ("target_id") REFERENCES "security_targets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "security_evidence_artifacts" ADD CONSTRAINT "security_evidence_artifacts_scan_id_fkey" FOREIGN KEY ("scan_id") REFERENCES "security_scans"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "security_evidence_artifacts" ADD CONSTRAINT "security_evidence_artifacts_observation_id_fkey" FOREIGN KEY ("observation_id") REFERENCES "security_observations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "security_evidence_artifacts" ADD CONSTRAINT "security_evidence_artifacts_finding_id_fkey" FOREIGN KEY ("finding_id") REFERENCES "security_findings"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "security_evidence_artifacts" ADD CONSTRAINT "security_evidence_artifacts_collector_id_fkey" FOREIGN KEY ("collector_id") REFERENCES "security_collectors"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "security_evidence_artifacts" ADD CONSTRAINT "security_evidence_artifacts_attack_path_id_fkey" FOREIGN KEY ("attack_path_id") REFERENCES "security_attack_paths"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "security_control_verdicts" ADD CONSTRAINT "security_control_verdicts_target_id_fkey" FOREIGN KEY ("target_id") REFERENCES "security_targets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "security_control_verdicts" ADD CONSTRAINT "security_control_verdicts_scan_id_fkey" FOREIGN KEY ("scan_id") REFERENCES "security_scans"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "security_control_verdicts" ADD CONSTRAINT "security_control_verdicts_collector_id_fkey" FOREIGN KEY ("collector_id") REFERENCES "security_collectors"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "security_control_verdicts" ADD CONSTRAINT "security_control_verdicts_evidence_artifact_id_fkey" FOREIGN KEY ("evidence_artifact_id") REFERENCES "security_evidence_artifacts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "security_attack_paths" ADD CONSTRAINT "security_attack_paths_target_id_fkey" FOREIGN KEY ("target_id") REFERENCES "security_targets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "security_attack_paths" ADD CONSTRAINT "security_attack_paths_scan_id_fkey" FOREIGN KEY ("scan_id") REFERENCES "security_scans"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "security_attack_paths" ADD CONSTRAINT "security_attack_paths_entry_asset_id_fkey" FOREIGN KEY ("entry_asset_id") REFERENCES "security_assets"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "security_attack_paths" ADD CONSTRAINT "security_attack_paths_crown_jewel_asset_id_fkey" FOREIGN KEY ("crown_jewel_asset_id") REFERENCES "security_assets"("id") ON DELETE SET NULL ON UPDATE CASCADE;
