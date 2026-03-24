import {
  Controller,
  ForbiddenException,
  Headers,
  Logger,
  Post,
  Req,
  Res,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { Public } from '../auth/decorators/public.decorator.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import { BillingService } from './billing.service.js';
import { RazorpayService } from './razorpay.service.js';

@Controller('webhooks/razorpay')
export class RazorpayWebhookController {
  private readonly logger = new Logger(RazorpayWebhookController.name);

  constructor(
    private readonly razorpayService: RazorpayService,
    private readonly billingService: BillingService,
    private readonly prisma: PrismaService,
  ) {}

  @Public()
  @Post()
  async handleWebhook(
    @Req() req: Request & { rawBody?: Buffer },
    @Res() res: Response,
    @Headers('x-razorpay-signature') signature: string,
  ) {
    const event = req.body?.event || 'unknown';
    const externalId =
      req.body?.payload?.subscription?.entity?.id ||
      req.body?.payload?.payment?.entity?.id ||
      null;
    const webhookLog = await this.prisma.webhookEventLog.create({
      data: {
        provider: 'RAZORPAY',
        eventType: event,
        externalId,
        payload: (req.body || {}) as never,
        signatureValid: Boolean(signature),
      },
      select: { id: true },
    });

    if (!signature) {
      await this.prisma.webhookEventLog.update({
        where: { id: webhookLog.id },
        data: {
          errorMessage: 'Missing Razorpay signature',
        },
      });
      throw new ForbiddenException('Missing Razorpay signature');
    }

    const rawBody = req.rawBody?.toString('utf8');
    if (!rawBody) {
      this.logger.error('Razorpay webhook rejected because raw body is unavailable.');
      await this.prisma.webhookEventLog.update({
        where: { id: webhookLog.id },
        data: {
          signatureValid: false,
          errorMessage: 'Raw body unavailable for webhook verification',
        },
      });
      throw new ForbiddenException('Invalid webhook payload');
    }

    const isValid = this.razorpayService.verifyWebhookSignature(rawBody, signature);
    if (!isValid) {
      this.logger.error('Invalid Razorpay webhook signature');
      await this.prisma.webhookEventLog.update({
        where: { id: webhookLog.id },
        data: {
          signatureValid: false,
          errorMessage: 'Invalid Razorpay signature',
        },
      });
      throw new ForbiddenException('Invalid signature');
    }

    const payload = req.body?.payload;

    try {
      await this.billingService.processWebhook(event, payload);
      await this.prisma.webhookEventLog.update({
        where: { id: webhookLog.id },
        data: {
          signatureValid: true,
          processed: true,
          processedAt: new Date(),
          errorMessage: null,
        },
      });
    } catch (error: unknown) {
      this.logger.error(
        `Failed to process webhook event ${event}: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
      await this.prisma.webhookEventLog.update({
        where: { id: webhookLog.id },
        data: {
          signatureValid: true,
          processed: false,
          errorMessage: error instanceof Error ? error.message : 'Unknown error',
        },
      });
    }

    res.status(200).send({ status: 'ok' });
  }
}
