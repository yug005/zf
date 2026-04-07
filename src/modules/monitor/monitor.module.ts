import { Module } from '@nestjs/common';
import { MonitorController } from './monitor.controller.js';
import { MonitorSecretController } from './monitor-secret.controller.js';
import { MonitorService } from './monitor.service.js';
import { BillingModule } from '../billing/billing.module.js';
import { SecurityModule } from '../../common/security/security.module.js';
import { MonitorSecretService } from './monitor-secret.service.js';

@Module({
  imports: [BillingModule, SecurityModule],
  controllers: [MonitorController, MonitorSecretController],
  providers: [MonitorService, MonitorSecretService],
  exports: [MonitorService, MonitorSecretService],
})
export class MonitorModule {}
