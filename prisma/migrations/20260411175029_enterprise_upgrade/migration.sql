-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "AssetKind" ADD VALUE 'CLOUD_STORAGE';
ALTER TYPE "AssetKind" ADD VALUE 'CDN';

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "EvidenceArtifactKind" ADD VALUE 'DNS_RECORD';
ALTER TYPE "EvidenceArtifactKind" ADD VALUE 'CERTIFICATE_INFO';
ALTER TYPE "EvidenceArtifactKind" ADD VALUE 'JS_ANALYSIS';
ALTER TYPE "EvidenceArtifactKind" ADD VALUE 'STORAGE_LEAK';
ALTER TYPE "EvidenceArtifactKind" ADD VALUE 'STATE_TRANSITION';
ALTER TYPE "EvidenceArtifactKind" ADD VALUE 'SEQUENCE_TRACE';

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "FindingCategory" ADD VALUE 'XSS_DETECTION';
ALTER TYPE "FindingCategory" ADD VALUE 'OPEN_REDIRECT';
ALTER TYPE "FindingCategory" ADD VALUE 'PATH_TRAVERSAL';
ALTER TYPE "FindingCategory" ADD VALUE 'HEADER_INJECTION';
ALTER TYPE "FindingCategory" ADD VALUE 'SSTI_DETECTION';
ALTER TYPE "FindingCategory" ADD VALUE 'COMMAND_INJECTION';
ALTER TYPE "FindingCategory" ADD VALUE 'BUSINESS_LOGIC';
ALTER TYPE "FindingCategory" ADD VALUE 'DOM_XSS';
ALTER TYPE "FindingCategory" ADD VALUE 'SECRET_EXPOSURE';
ALTER TYPE "FindingCategory" ADD VALUE 'CLOUD_MISCONFIG';
ALTER TYPE "FindingCategory" ADD VALUE 'API_ABUSE';
ALTER TYPE "FindingCategory" ADD VALUE 'PERFORMANCE_RISK';

-- AlterEnum
ALTER TYPE "FindingValidationState" ADD VALUE 'UNCONFIRMED';

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "ScanStage" ADD VALUE 'ASSET_DISCOVERY';
ALTER TYPE "ScanStage" ADD VALUE 'VALIDATION_LOOP';
ALTER TYPE "ScanStage" ADD VALUE 'HISTORICAL_COMPARISON';
