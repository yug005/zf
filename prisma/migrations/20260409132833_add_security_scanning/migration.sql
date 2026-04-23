-- CreateEnum
CREATE TYPE "TargetVerificationState" AS ENUM ('UNVERIFIED', 'OWNERSHIP_CONFIRMED', 'DNS_VERIFIED', 'HTTP_VERIFIED');

-- CreateEnum
CREATE TYPE "VerificationMethod" AS ENUM ('OWNERSHIP_DECLARATION', 'DNS_TXT', 'HTTP_TOKEN');

-- CreateEnum
CREATE TYPE "VerificationState" AS ENUM ('PENDING', 'VERIFIED', 'FAILED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "ScanTier" AS ENUM ('STANDARD', 'ADVANCED');

-- CreateEnum
CREATE TYPE "ScanCadence" AS ENUM ('ONCE', 'DAILY', 'WEEKLY', 'MONTHLY');

-- CreateEnum
CREATE TYPE "ScanStatus" AS ENUM ('QUEUED', 'RUNNING', 'COMPLETED', 'FAILED', 'TIMED_OUT', 'CANCELLED');

-- CreateEnum
CREATE TYPE "ScanStage" AS ENUM ('TARGET_PREP', 'VERIFICATION_CHECK', 'ENDPOINT_INVENTORY', 'PASSIVE_ANALYSIS', 'ACTIVE_PROBES', 'SCORING', 'REPORT_GENERATION', 'DONE');

-- CreateEnum
CREATE TYPE "RiskLevel" AS ENUM ('CRITICAL', 'HIGH', 'MEDIUM', 'LOW', 'INFORMATIONAL', 'SECURE');

-- CreateEnum
CREATE TYPE "FindingCategory" AS ENUM ('AUTH_POSTURE', 'BROKEN_ACCESS_CONTROL', 'MASS_ASSIGNMENT', 'SECURITY_MISCONFIGURATION', 'INJECTION_DETECTION', 'SSRF_POSTURE', 'RESOURCE_ABUSE', 'ENDPOINT_DISCOVERY', 'SENSITIVE_DATA_EXPOSURE', 'TLS_POSTURE', 'CORS_MISCONFIGURATION', 'HEADER_SECURITY', 'DEBUG_EXPOSURE', 'TECH_DISCLOSURE');

-- CreateEnum
CREATE TYPE "FindingSeverity" AS ENUM ('CRITICAL', 'HIGH', 'MEDIUM', 'LOW', 'INFORMATIONAL');

-- CreateEnum
CREATE TYPE "FindingExploitability" AS ENUM ('PROVEN', 'PROBABLE', 'THEORETICAL');

-- CreateEnum
CREATE TYPE "FindingConfidence" AS ENUM ('HIGH', 'MEDIUM', 'LOW');

-- CreateEnum
CREATE TYPE "FindingStatus" AS ENUM ('OPEN', 'RESOLVED', 'FALSE_POSITIVE', 'ACCEPTED_RISK', 'WONT_FIX');

-- CreateEnum
CREATE TYPE "SecurityPlan" AS ENUM ('FREE', 'STARTER', 'PROFESSIONAL', 'ENTERPRISE');

-- CreateEnum
CREATE TYPE "SecuritySubStatus" AS ENUM ('ACTIVE', 'EXPIRED', 'CANCELLED', 'PAST_DUE');

-- CreateTable
CREATE TABLE "security_targets" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "base_url" TEXT NOT NULL,
    "description" TEXT,
    "metadata" JSONB,
    "verification_state" "TargetVerificationState" NOT NULL DEFAULT 'UNVERIFIED',
    "project_id" TEXT,
    "monitor_id" TEXT,
    "free_scan_used" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "security_targets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "security_verifications" (
    "id" TEXT NOT NULL,
    "target_id" TEXT NOT NULL,
    "method" "VerificationMethod" NOT NULL,
    "token" TEXT NOT NULL,
    "challenge_value" TEXT,
    "state" "VerificationState" NOT NULL DEFAULT 'PENDING',
    "verified_scope" TEXT,
    "completed_at" TIMESTAMP(3),
    "expires_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "security_verifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "security_scan_profiles" (
    "id" TEXT NOT NULL,
    "target_id" TEXT NOT NULL,
    "tier" "ScanTier" NOT NULL DEFAULT 'STANDARD',
    "enabled_categories" JSONB,
    "cadence" "ScanCadence",
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "last_scheduled_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "security_scan_profiles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "security_scans" (
    "id" TEXT NOT NULL,
    "target_id" TEXT NOT NULL,
    "profile_id" TEXT,
    "tier" "ScanTier" NOT NULL,
    "status" "ScanStatus" NOT NULL DEFAULT 'QUEUED',
    "current_stage" "ScanStage" NOT NULL DEFAULT 'TARGET_PREP',
    "stage_progress" JSONB,
    "target_snapshot" JSONB,
    "score" DOUBLE PRECISION,
    "risk_level" "RiskLevel",
    "severity_counts" JSONB,
    "summary" TEXT,
    "report_metadata" JSONB,
    "error_message" TEXT,
    "started_at" TIMESTAMP(3),
    "completed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "security_scans_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "security_findings" (
    "id" TEXT NOT NULL,
    "scan_id" TEXT NOT NULL,
    "category" "FindingCategory" NOT NULL,
    "title" TEXT NOT NULL,
    "severity" "FindingSeverity" NOT NULL,
    "exploitability" "FindingExploitability" NOT NULL DEFAULT 'THEORETICAL',
    "confidence" "FindingConfidence" NOT NULL DEFAULT 'MEDIUM',
    "endpoint" TEXT,
    "http_method" TEXT,
    "parameter" TEXT,
    "attack_flow" JSONB,
    "evidence" JSONB,
    "remediation" TEXT,
    "references" JSONB,
    "false_positive" BOOLEAN NOT NULL DEFAULT false,
    "fp_notes" TEXT,
    "status" "FindingStatus" NOT NULL DEFAULT 'OPEN',
    "fingerprint" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "security_findings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "security_endpoint_inventory" (
    "id" TEXT NOT NULL,
    "target_id" TEXT NOT NULL,
    "scan_id" TEXT,
    "path" TEXT NOT NULL,
    "method" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "confidence" "FindingConfidence" NOT NULL DEFAULT 'MEDIUM',
    "first_seen_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "last_seen_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "security_endpoint_inventory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "security_subscription_states" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "plan" "SecurityPlan" NOT NULL DEFAULT 'FREE',
    "status" "SecuritySubStatus" NOT NULL DEFAULT 'ACTIVE',
    "free_scan_quota" INTEGER NOT NULL DEFAULT 1,
    "free_scan_used" INTEGER NOT NULL DEFAULT 0,
    "allowed_cadences" JSONB,
    "max_targets" INTEGER NOT NULL DEFAULT 1,
    "subscription_id" TEXT,
    "current_period_start" TIMESTAMP(3),
    "current_period_end" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "security_subscription_states_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "security_targets_user_id_idx" ON "security_targets"("user_id");

-- CreateIndex
CREATE INDEX "security_targets_project_id_idx" ON "security_targets"("project_id");

-- CreateIndex
CREATE INDEX "security_verifications_target_id_idx" ON "security_verifications"("target_id");

-- CreateIndex
CREATE INDEX "security_verifications_token_idx" ON "security_verifications"("token");

-- CreateIndex
CREATE INDEX "security_scan_profiles_target_id_idx" ON "security_scan_profiles"("target_id");

-- CreateIndex
CREATE INDEX "security_scans_target_id_created_at_idx" ON "security_scans"("target_id", "created_at");

-- CreateIndex
CREATE INDEX "security_scans_status_idx" ON "security_scans"("status");

-- CreateIndex
CREATE INDEX "security_findings_scan_id_severity_idx" ON "security_findings"("scan_id", "severity");

-- CreateIndex
CREATE INDEX "security_findings_scan_id_category_idx" ON "security_findings"("scan_id", "category");

-- CreateIndex
CREATE INDEX "security_findings_fingerprint_idx" ON "security_findings"("fingerprint");

-- CreateIndex
CREATE INDEX "security_endpoint_inventory_target_id_idx" ON "security_endpoint_inventory"("target_id");

-- CreateIndex
CREATE UNIQUE INDEX "security_endpoint_inventory_target_id_path_method_key" ON "security_endpoint_inventory"("target_id", "path", "method");

-- CreateIndex
CREATE UNIQUE INDEX "security_subscription_states_user_id_key" ON "security_subscription_states"("user_id");

-- AddForeignKey
ALTER TABLE "security_targets" ADD CONSTRAINT "security_targets_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "security_targets" ADD CONSTRAINT "security_targets_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "security_verifications" ADD CONSTRAINT "security_verifications_target_id_fkey" FOREIGN KEY ("target_id") REFERENCES "security_targets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "security_scan_profiles" ADD CONSTRAINT "security_scan_profiles_target_id_fkey" FOREIGN KEY ("target_id") REFERENCES "security_targets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "security_scans" ADD CONSTRAINT "security_scans_target_id_fkey" FOREIGN KEY ("target_id") REFERENCES "security_targets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "security_findings" ADD CONSTRAINT "security_findings_scan_id_fkey" FOREIGN KEY ("scan_id") REFERENCES "security_scans"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "security_endpoint_inventory" ADD CONSTRAINT "security_endpoint_inventory_target_id_fkey" FOREIGN KEY ("target_id") REFERENCES "security_targets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "security_subscription_states" ADD CONSTRAINT "security_subscription_states_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
