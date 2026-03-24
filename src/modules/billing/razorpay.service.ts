import { Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Razorpay from 'razorpay';
import crypto from 'crypto';

@Injectable()
export class RazorpayService {
  private readonly logger = new Logger(RazorpayService.name);
  private razorpay?: Razorpay;
  private readonly webhookSecret?: string;
  private readonly configured: boolean;

  constructor(private readonly configService: ConfigService) {
    const key_id = this.configService.get<string>('RAZORPAY_KEY_ID')?.trim();
    const key_secret = this.configService.get<string>('RAZORPAY_KEY_SECRET')?.trim();
    this.webhookSecret = this.configService.get<string>('RAZORPAY_WEBHOOK_SECRET')?.trim();

    this.configured = Boolean(key_id && key_secret && this.webhookSecret);

    if (!this.configured) {
      this.logger.warn(
        'Razorpay is not fully configured. Billing checkout and webhooks are disabled.',
      );
      return;
    }

    this.razorpay = new Razorpay({ key_id: key_id!, key_secret: key_secret! });
  }

  isConfigured(): boolean {
    return this.configured;
  }

  private getClient(): Razorpay {
    if (!this.razorpay) {
      throw new ServiceUnavailableException(
        'Billing is not configured yet. Add Razorpay environment variables to enable checkout.',
      );
    }

    return this.razorpay;
  }

  /**
   * Create or retrieve a Razorpay customer by email
   */
  async getOrCreateCustomer(email: string, name?: string): Promise<string> {
    try {
      const razorpay = this.getClient();
      const existingCustomers = await razorpay.customers.all({ count: 1 });
      const customer = existingCustomers.items.find((c: any) => c.email === email);
      if (customer) return customer.id;

      const newCustomer = await razorpay.customers.create({ email, name: name || undefined });
      return newCustomer.id;
    } catch (error: any) {
      this.logger.error(`Failed to get/create customer: ${error.message}`);
      throw error;
    }
  }

  /**
   * Creates a subscription for the given planId
   */
  async createSubscription(customerId: string, planId: string): Promise<any> {
    try {
      return await this.getClient().subscriptions.create({
        plan_id: planId,
        customer_id: customerId,
        total_count: 120, // Example count
        customer_notify: 1,
      } as any);
    } catch (error: any) {
      this.logger.error(`Failed to create subscription: ${error.message}`);
      throw error;
    }
  }

  /**
   * Cancel an active subscription
   */
  async cancelSubscription(subscriptionId: string): Promise<boolean> {
    try {
      await this.getClient().subscriptions.cancel(subscriptionId);
      return true;
    } catch (error: any) {
      this.logger.error(`Failed to cancel subscription: ${error.message}`);
      return false; // already cancelled or error
    }
  }

  /**
   * Validates Razorpay Webhook Signature
   */
  verifyWebhookSignature(payload: string, signature: string): boolean {
    if (!this.webhookSecret) {
      this.logger.warn('Received Razorpay webhook while billing is not configured.');
      return false;
    }

    const expectedSignature = crypto
      .createHmac('sha256', this.webhookSecret)
      .update(payload)
      .digest('hex');

    const expectedBuffer = Buffer.from(expectedSignature);
    const receivedBuffer = Buffer.from(signature);
    if (expectedBuffer.length !== receivedBuffer.length) {
      return false;
    }

    return crypto.timingSafeEqual(expectedBuffer, receivedBuffer);
  }
}
