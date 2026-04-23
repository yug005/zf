import { Module } from '@nestjs/common';
import { TargetController } from './target.controller.js';
import { TargetService } from './target.service.js';
import { SecurityEntitlementModule } from '../entitlement/entitlement.module.js';

@Module({
  imports: [SecurityEntitlementModule],
  controllers: [TargetController],
  providers: [TargetService],
  exports: [TargetService],
})
export class SecurityTargetModule {}
