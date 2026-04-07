-- Add new enum values and types
ALTER TYPE "AlertChannel" ADD VALUE IF NOT EXISTS 'WHATSAPP';

CREATE TYPE "StatusPageMode" AS ENUM ('SIMPLE', 'ADVANCED');
CREATE TYPE "AlertDeliveryStatus" AS ENUM ('PENDING', 'SENT', 'FAILED', 'SUPPRESSED');
CREATE TYPE "MonitorSecretKind" AS ENUM ('TOKEN', 'API_KEY', 'BASIC_USERNAME', 'BASIC_PASSWORD', 'GENERIC');

-- Monitor config extensions
ALTER TABLE "monitors"
  ADD COLUMN "auth_config" JSONB,
  ADD COLUMN "validation_config" JSONB,
  ADD COLUMN "alert_config" JSONB,
  ADD COLUMN "probe_regions" JSONB;

-- Check result metadata
ALTER TABLE "check_results"
  ADD COLUMN "metadata" JSONB;

-- Status page display mode
ALTER TABLE "status_pages"
  ADD COLUMN "mode" "StatusPageMode" NOT NULL DEFAULT 'SIMPLE';

-- Reusable encrypted monitor secrets
CREATE TABLE "monitor_secrets" (
  "id" TEXT NOT NULL,
  "user_id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "kind" "MonitorSecretKind" NOT NULL,
  "encrypted_value" TEXT NOT NULL,
  "iv" TEXT NOT NULL,
  "auth_tag" TEXT NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "monitor_secrets_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "monitor_secrets_user_id_idx" ON "monitor_secrets"("user_id");

ALTER TABLE "monitor_secrets"
  ADD CONSTRAINT "monitor_secrets_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "users"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "monitor_secret_links" (
  "monitor_id" TEXT NOT NULL,
  "secret_id" TEXT NOT NULL,
  "role" TEXT NOT NULL,
  CONSTRAINT "monitor_secret_links_pkey" PRIMARY KEY ("monitor_id", "secret_id", "role")
);

CREATE INDEX "monitor_secret_links_secret_id_idx" ON "monitor_secret_links"("secret_id");

ALTER TABLE "monitor_secret_links"
  ADD CONSTRAINT "monitor_secret_links_monitor_id_fkey"
  FOREIGN KEY ("monitor_id") REFERENCES "monitors"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "monitor_secret_links"
  ADD CONSTRAINT "monitor_secret_links_secret_id_fkey"
  FOREIGN KEY ("secret_id") REFERENCES "monitor_secrets"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

-- Per-channel alert delivery tracking
CREATE TABLE "alert_deliveries" (
  "id" TEXT NOT NULL,
  "alert_id" TEXT NOT NULL,
  "channel" "AlertChannel" NOT NULL,
  "recipient" TEXT,
  "status" "AlertDeliveryStatus" NOT NULL DEFAULT 'PENDING',
  "delivery_attempts" INTEGER NOT NULL DEFAULT 0,
  "last_attempt_at" TIMESTAMP(3),
  "delivered_at" TIMESTAMP(3),
  "error_message" TEXT,
  "metadata" JSONB,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "alert_deliveries_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "alert_deliveries_alert_id_idx" ON "alert_deliveries"("alert_id");
CREATE INDEX "alert_deliveries_status_idx" ON "alert_deliveries"("status");

ALTER TABLE "alert_deliveries"
  ADD CONSTRAINT "alert_deliveries_alert_id_fkey"
  FOREIGN KEY ("alert_id") REFERENCES "alerts"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
