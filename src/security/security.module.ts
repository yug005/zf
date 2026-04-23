import { Module } from '@nestjs/common';
import { SecurityTargetModule } from './targets/target.module.js';
import { SecurityVerificationModule } from './verification/verification.module.js';
import { SecurityEntitlementModule } from './entitlement/entitlement.module.js';
import { SecurityScanModule } from './scans/scan.module.js';
import { SecurityFindingModule } from './findings/finding.module.js';
import { SecurityReportModule } from './reports/report.module.js';
import { SecurityCadenceModule } from './cadence/cadence.module.js';
import { SecurityEngineModule } from './engine/security-engine.module.js';

/**
 * SecurityModule — root module for the Authorized API Threat Reports
 * product domain. Completely separate from monitor engine, but shares
 * Prisma, BullMQ infra, and auth guards.
 */
@Module({
  imports: [
    SecurityTargetModule,
    SecurityVerificationModule,
    SecurityEntitlementModule,
    SecurityScanModule,
    SecurityFindingModule,
    SecurityReportModule,
    SecurityCadenceModule,
    SecurityEngineModule,
  ],
})
export class SecurityModule {}
