-- CreateEnum
CREATE TYPE "IncidentStatus" AS ENUM ('INVESTIGATING', 'IDENTIFIED', 'RESOLVED');

-- AlterEnum
ALTER TYPE "MonitorType" ADD VALUE 'SSL';

-- AlterTable
ALTER TABLE "users"
  ADD COLUMN "github_id" TEXT,
  ADD COLUMN "google_id" TEXT,
  ADD COLUMN "is_verified" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "reset_token_expires" TIMESTAMP(3),
  ADD COLUMN "reset_token_hash" TEXT,
  ADD COLUMN "verification_token_hash" TEXT;

-- CreateTable
CREATE TABLE "subscription_reminders" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "remind_at" TIMESTAMP(3) NOT NULL,
    "days_before" INTEGER NOT NULL,
    "sent_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "channel" TEXT NOT NULL DEFAULT 'EMAIL',

    CONSTRAINT "subscription_reminders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "in_app_notifications" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "read" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "in_app_notifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "status_pages" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "status_pages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "status_page_monitors" (
    "status_page_id" TEXT NOT NULL,
    "monitor_id" TEXT NOT NULL,

    CONSTRAINT "status_page_monitors_pkey" PRIMARY KEY ("status_page_id","monitor_id")
);

-- CreateTable
CREATE TABLE "incidents" (
    "id" TEXT NOT NULL,
    "monitor_id" TEXT NOT NULL,
    "status" "IncidentStatus" NOT NULL DEFAULT 'INVESTIGATING',
    "message" TEXT NOT NULL,
    "resolved_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "incidents_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "subscription_reminders_user_id_remind_at_idx" ON "subscription_reminders"("user_id", "remind_at");

-- CreateIndex
CREATE INDEX "in_app_notifications_user_id_read_idx" ON "in_app_notifications"("user_id", "read");

-- CreateIndex
CREATE UNIQUE INDEX "status_pages_slug_key" ON "status_pages"("slug");

-- CreateIndex
CREATE INDEX "status_pages_user_id_idx" ON "status_pages"("user_id");

-- CreateIndex
CREATE INDEX "incidents_monitor_id_idx" ON "incidents"("monitor_id");

-- CreateIndex
CREATE INDEX "incidents_status_idx" ON "incidents"("status");

-- CreateIndex
CREATE UNIQUE INDEX "users_google_id_key" ON "users"("google_id");

-- CreateIndex
CREATE UNIQUE INDEX "users_github_id_key" ON "users"("github_id");

-- AddForeignKey
ALTER TABLE "subscription_reminders" ADD CONSTRAINT "subscription_reminders_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "in_app_notifications" ADD CONSTRAINT "in_app_notifications_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "status_pages" ADD CONSTRAINT "status_pages_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "status_page_monitors" ADD CONSTRAINT "status_page_monitors_status_page_id_fkey" FOREIGN KEY ("status_page_id") REFERENCES "status_pages"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "status_page_monitors" ADD CONSTRAINT "status_page_monitors_monitor_id_fkey" FOREIGN KEY ("monitor_id") REFERENCES "monitors"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "incidents" ADD CONSTRAINT "incidents_monitor_id_fkey" FOREIGN KEY ("monitor_id") REFERENCES "monitors"("id") ON DELETE CASCADE ON UPDATE CASCADE;
