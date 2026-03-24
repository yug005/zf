import { Body, Controller, Get, Post, Query } from '@nestjs/common';
import { BillingService } from './billing.service.js';
import { Public } from '../auth/decorators/public.decorator.js';
import { CurrentUser } from '../auth/decorators/current-user.decorator.js';
import type { AuthenticatedUser } from '../auth/interfaces/index.js';

@Controller('billing')
export class BillingController {
  constructor(private readonly billingService: BillingService) {}

  /**
   * GET /api/v1/billing/plans
   * Public — pricing plans are visible to everyone.
   */
  @Public()
  @Get('plans')
  async getPlans() {
    return this.billingService.getPlans();
  }

  /**
   * GET /api/v1/billing/subscription
   */
  @Get('subscription')
  async getSubscriptionDetails(@CurrentUser('id') userId: string) {
    return this.billingService.getSubscriptionDetails(userId);
  }

  /**
   * GET /api/v1/billing/webhooks/razorpay/logs
   */
  @Get('webhooks/razorpay/logs')
  async getRazorpayWebhookLogs(
    @CurrentUser() user: AuthenticatedUser,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('processed') processed?: string,
    @Query('signatureValid') signatureValid?: string,
    @Query('eventType') eventType?: string,
    @Query('search') search?: string,
  ) {
    return this.billingService.getRazorpayWebhookLogs(user.email, {
      page,
      limit,
      processed,
      signatureValid,
      eventType,
      search,
    });
  }

  /**
   * POST /api/v1/billing/subscription/checkout
   */
  @Post('subscription/checkout')
  async createCheckoutSession(
    @CurrentUser('id') userId: string,
    @Body('planId') planId: string,
  ) {
    return this.billingService.createSubscriptionCheckout(userId, planId);
  }

  /**
   * POST /api/v1/billing/subscription/cancel
   */
  @Post('subscription/cancel')
  async cancelSubscription(@CurrentUser('id') userId: string) {
    return this.billingService.cancelActiveSubscription(userId);
  }
}
