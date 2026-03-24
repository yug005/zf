ALTER TABLE "change_events"
ADD COLUMN "external_id" TEXT;

CREATE UNIQUE INDEX "change_events_project_id_source_external_id_key"
ON "change_events"("project_id", "source", "external_id");
