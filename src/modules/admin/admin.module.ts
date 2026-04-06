import { Module } from '@nestjs/common';
import { BillingModule } from '../billing/billing.module.js';
import { AdminController } from './admin.controller.js';
import { AdminService } from './admin.service.js';
import { AdminGuard } from '../../common/admin/admin.guard.js';

@Module({
  imports: [BillingModule],
  controllers: [AdminController],
  providers: [AdminService, AdminGuard],
})
export class AdminModule {}
