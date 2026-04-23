import { Module } from '@nestjs/common';
import { CadenceController } from './cadence.controller.js';
import { CadenceService } from './cadence.service.js';
import { SecurityEntitlementModule } from '../entitlement/entitlement.module.js';
import { SecurityEngineModule } from '../engine/security-engine.module.js';

@Module({
  imports: [SecurityEntitlementModule, SecurityEngineModule],
  controllers: [CadenceController],
  providers: [CadenceService],
  exports: [CadenceService],
})
export class SecurityCadenceModule {}
