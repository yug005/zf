CREATE TABLE IF NOT EXISTS "webhook_event_logs" (
  "id" TEXT NOT NULL,
  "provider" TEXT NOT NULL,
  "event_type" TEXT NOT NULL,
  "external_id" TEXT,
  "payload" JSONB NOT NULL,
  "signature_valid" BOOLEAN NOT NULL DEFAULT false,
  "processed" BOOLEAN NOT NULL DEFAULT false,
  "processed_at" TIMESTAMP(3),
  "error_message" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "webhook_event_logs_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "webhook_event_logs_provider_event_type_idx"
ON "webhook_event_logs"("provider", "event_type");

CREATE INDEX IF NOT EXISTS "webhook_event_logs_external_id_idx"
ON "webhook_event_logs"("external_id");
