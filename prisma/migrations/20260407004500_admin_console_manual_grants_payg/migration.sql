-- CreateEnum
CREATE TYPE "GrantLifecycleStatus" AS ENUM ('PENDING', 'SCHEDULED', 'ACTIVE', 'EXPIRED', 'REVOKED', 'SUPERSEDED');

-- CreateEnum
CREATE TYPE "GrantActivationMode" AS ENUM ('OVERRIDE_NOW', 'ACTIVATE_AFTER_CURRENT_ACCESS');

-- CreateEnum
CREATE TYPE "EnterpriseAccessMode" AS ENUM ('STANDARD', 'PAYG');

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "archived_at" TIMESTAMP(3),
ADD COLUMN     "archived_email" TEXT,
ADD COLUMN     "archived_reason" TEXT;

-- CreateTable
CREATE TABLE "admin_grants" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "user_id" TEXT,
    "plan" "SubscriptionPlan" NOT NULL,
    "enterprise_access_mode" "EnterpriseAccessMode",
    "lifecycle_status" "GrantLifecycleStatus" NOT NULL DEFAULT 'PENDING',
    "activation_mode" "GrantActivationMode" NOT NULL,
    "start_at" TIMESTAMP(3) NOT NULL,
    "end_at" TIMESTAMP(3),
    "activated_at" TIMESTAMP(3),
    "revoked_at" TIMESTAMP(3),
    "superseded_at" TIMESTAMP(3),
    "actor_user_id" TEXT,
    "actor_email" TEXT NOT NULL,
    "note" TEXT,
    "reason" TEXT,
    "last_notification_type" TEXT,
    "last_notification_sent_at" TIMESTAMP(3),
    "reminder_7_sent_at" TIMESTAMP(3),
    "reminder_1_sent_at" TIMESTAMP(3),
    "expiry_notification_sent_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "admin_grants_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "enterprise_payg_monthly_records" (
    "id" TEXT NOT NULL,
    "user_id" TEXT,
    "email" TEXT NOT NULL,
    "month_start" TIMESTAMP(3) NOT NULL,
    "month_end" TIMESTAMP(3) NOT NULL,
    "ten_second_count" INTEGER NOT NULL DEFAULT 0,
    "thirty_second_count" INTEGER NOT NULL DEFAULT 0,
    "sixty_plus_count" INTEGER NOT NULL DEFAULT 0,
    "estimated_amount_inr" INTEGER NOT NULL,
    "finalized_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "enterprise_payg_monthly_records_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "admin_audit_logs" (
    "id" TEXT NOT NULL,
    "actor_user_id" TEXT,
    "actor_email" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "target_user_id" TEXT,
    "target_email" TEXT,
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "admin_audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "admin_grants_email_idx" ON "admin_grants"("email");

-- CreateIndex
CREATE INDEX "admin_grants_user_id_idx" ON "admin_grants"("user_id");

-- CreateIndex
CREATE INDEX "admin_grants_lifecycle_status_start_at_idx" ON "admin_grants"("lifecycle_status", "start_at");

-- CreateIndex
CREATE INDEX "enterprise_payg_monthly_records_user_id_month_start_idx" ON "enterprise_payg_monthly_records"("user_id", "month_start");

-- CreateIndex
CREATE UNIQUE INDEX "enterprise_payg_monthly_records_email_month_start_key" ON "enterprise_payg_monthly_records"("email", "month_start");

-- CreateIndex
CREATE INDEX "admin_audit_logs_action_created_at_idx" ON "admin_audit_logs"("action", "created_at");

-- CreateIndex
CREATE INDEX "admin_audit_logs_target_user_id_created_at_idx" ON "admin_audit_logs"("target_user_id", "created_at");

-- CreateIndex
CREATE INDEX "admin_audit_logs_target_email_created_at_idx" ON "admin_audit_logs"("target_email", "created_at");

-- AddForeignKey
ALTER TABLE "admin_grants" ADD CONSTRAINT "admin_grants_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "admin_grants" ADD CONSTRAINT "admin_grants_actor_user_id_fkey" FOREIGN KEY ("actor_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "enterprise_payg_monthly_records" ADD CONSTRAINT "enterprise_payg_monthly_records_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "admin_audit_logs" ADD CONSTRAINT "admin_audit_logs_actor_user_id_fkey" FOREIGN KEY ("actor_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
