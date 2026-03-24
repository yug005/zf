CREATE TYPE "ChangeEventType" AS ENUM (
  'DEPLOY',
  'CONFIG',
  'DNS',
  'FEATURE_FLAG',
  'SSL',
  'SECRET',
  'INFRASTRUCTURE',
  'RELEASE',
  'MANUAL'
);

CREATE TYPE "ChangeEventSource" AS ENUM (
  'MANUAL',
  'API',
  'GITHUB',
  'VERCEL',
  'RAILWAY',
  'SYSTEM'
);

CREATE TABLE "change_events" (
  "id" TEXT NOT NULL,
  "type" "ChangeEventType" NOT NULL,
  "source" "ChangeEventSource" NOT NULL DEFAULT 'MANUAL',
  "title" TEXT NOT NULL,
  "summary" TEXT,
  "service_name" TEXT,
  "environment" TEXT,
  "version" TEXT,
  "metadata" JSONB,
  "happened_at" TIMESTAMP(3) NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  "project_id" TEXT NOT NULL,
  "monitor_id" TEXT,

  CONSTRAINT "change_events_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "change_events_project_id_happened_at_idx" ON "change_events"("project_id", "happened_at");
CREATE INDEX "change_events_monitor_id_happened_at_idx" ON "change_events"("monitor_id", "happened_at");
CREATE INDEX "change_events_type_source_idx" ON "change_events"("type", "source");

ALTER TABLE "change_events"
ADD CONSTRAINT "change_events_project_id_fkey"
FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "change_events"
ADD CONSTRAINT "change_events_monitor_id_fkey"
FOREIGN KEY ("monitor_id") REFERENCES "monitors"("id") ON DELETE SET NULL ON UPDATE CASCADE;
