import { Module } from '@nestjs/common';
import { BillingController } from './billing.controller.js';
import { BillingService } from './billing.service.js';
import { RazorpayService } from './razorpay.service.js';
import { RazorpayWebhookController } from './webhook.controller.js';
import { SubscriptionAccessService } from './subscription-access.service.js';
import { AlertsModule } from '../../engine/alerts/alerts.module.js';

@Module({
  imports: [AlertsModule],
  controllers: [BillingController, RazorpayWebhookController],
  providers: [BillingService, RazorpayService, SubscriptionAccessService],
  exports: [BillingService, SubscriptionAccessService],
})
export class BillingModule {}
