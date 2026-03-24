CREATE TYPE "BusinessCriticality" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL');
CREATE TYPE "SlaTier" AS ENUM ('STANDARD', 'PREMIUM', 'ENTERPRISE');

ALTER TABLE "monitors"
ADD COLUMN "service_name" TEXT,
ADD COLUMN "feature_name" TEXT,
ADD COLUMN "customer_journey" TEXT,
ADD COLUMN "team_owner" TEXT,
ADD COLUMN "region" TEXT,
ADD COLUMN "business_criticality" "BusinessCriticality" NOT NULL DEFAULT 'MEDIUM',
ADD COLUMN "sla_tier" "SlaTier" NOT NULL DEFAULT 'STANDARD';
