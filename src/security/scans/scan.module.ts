import { Module } from '@nestjs/common';
import { ScanController } from './scan.controller.js';
import { ScanService } from './scan.service.js';
import { SecurityEntitlementModule } from '../entitlement/entitlement.module.js';
import { SecurityEngineModule } from '../engine/security-engine.module.js';

@Module({
  imports: [SecurityEntitlementModule, SecurityEngineModule],
  controllers: [ScanController],
  providers: [ScanService],
  exports: [ScanService],
})
export class SecurityScanModule {}
