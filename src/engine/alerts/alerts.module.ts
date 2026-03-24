import { Module } from '@nestjs/common';
import { NotificationService } from './notification.service.js';

/**
 * AlertsModule — exposes NotificationService for alert delivery.
 * Imported by MonitorEngineModule (for workers) and BillingModule (for trial emails).
 * Avoids circular dependency between those two modules.
 */
@Module({
  providers: [NotificationService],
  exports: [NotificationService],
})
export class AlertsModule {}
