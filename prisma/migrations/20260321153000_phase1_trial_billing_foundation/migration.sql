ALTER TYPE "SubscriptionPlan" RENAME TO "SubscriptionPlan_old";
CREATE TYPE "SubscriptionPlan" AS ENUM ('TRIAL', 'LITE', 'PRO', 'BUSINESS', 'ENTERPRISE');

ALTER TYPE "SubscriptionStatus" RENAME TO "SubscriptionStatus_old";
CREATE TYPE "SubscriptionStatus" AS ENUM ('TRIALING', 'ACTIVE', 'EXPIRED', 'CANCELLED');

ALTER TABLE "users"
  ADD COLUMN "session_version" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "trial_start_at" TIMESTAMP(3),
  ADD COLUMN "trial_end_at" TIMESTAMP(3),
  ADD COLUMN "subscription_plan" "SubscriptionPlan" NOT NULL DEFAULT 'TRIAL',
  ADD COLUMN "monitor_limit" INTEGER NOT NULL DEFAULT 5,
  ADD COLUMN "new_subscription_status" "SubscriptionStatus" NOT NULL DEFAULT 'TRIALING';

UPDATE "users"
SET
  "trial_start_at" = COALESCE("created_at", NOW()),
  "trial_end_at" = COALESCE("created_at", NOW()) + INTERVAL '14 days',
  "subscription_plan" = CASE
    WHEN "plan" = 'PRO'::"SubscriptionPlan_old" THEN 'PRO'::"SubscriptionPlan"
    WHEN "plan" = 'BUSINESS'::"SubscriptionPlan_old" THEN 'BUSINESS'::"SubscriptionPlan"
    ELSE 'TRIAL'::"SubscriptionPlan"
  END,
  "monitor_limit" = CASE
    WHEN "plan" = 'BUSINESS'::"SubscriptionPlan_old" THEN 200
    WHEN "plan" = 'PRO'::"SubscriptionPlan_old" THEN 50
    ELSE 5
  END,
  "new_subscription_status" = CASE
    WHEN "subscription_status" = 'ACTIVE'::"SubscriptionStatus_old" THEN 'ACTIVE'::"SubscriptionStatus"
    WHEN "subscription_status" = 'CANCELLED'::"SubscriptionStatus_old" THEN 'CANCELLED'::"SubscriptionStatus"
    ELSE 'TRIALING'::"SubscriptionStatus"
  END;

ALTER TABLE "users"
  ALTER COLUMN "trial_start_at" SET NOT NULL,
  ALTER COLUMN "trial_end_at" SET NOT NULL;

ALTER TABLE "users"
  DROP COLUMN "plan",
  DROP COLUMN "subscription_status";

ALTER TABLE "users"
  RENAME COLUMN "new_subscription_status" TO "subscription_status";

ALTER TABLE "monitors"
  ADD COLUMN "paused_by_billing" BOOLEAN NOT NULL DEFAULT false;

DROP TYPE "SubscriptionPlan_old";
DROP TYPE "SubscriptionStatus_old";
