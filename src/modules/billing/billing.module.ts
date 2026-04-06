import { Module } from '@nestjs/common';
import { BillingController } from './billing.controller.js';
import { BillingService } from './billing.service.js';
import { RazorpayService } from './razorpay.service.js';
import { RazorpayWebhookController } from './webhook.controller.js';
import { SubscriptionAccessService } from './subscription-access.service.js';
import { AlertsModule } from '../../engine/alerts/alerts.module.js';
import { NotificationModule } from '../notifications/notification.module.js';
import { ManualAccessService } from './manual-access.service.js';

@Module({
  imports: [AlertsModule, NotificationModule],
  controllers: [BillingController, RazorpayWebhookController],
  providers: [BillingService, RazorpayService, SubscriptionAccessService, ManualAccessService],
  exports: [BillingService, SubscriptionAccessService, ManualAccessService],
})
export class BillingModule {}
