import { Module } from '@nestjs/common';
import { EntitlementController } from './entitlement.controller.js';
import { EntitlementService } from './entitlement.service.js';

@Module({
  controllers: [EntitlementController],
  providers: [EntitlementService],
  exports: [EntitlementService],
})
export class SecurityEntitlementModule {}
