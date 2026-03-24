import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SubscriptionPlan, SubscriptionStatus } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../../prisma/prisma.service.js';
import { SubscriptionAccessService } from '../billing/subscription-access.service.js';
import { PLAN_LIMITS } from '../billing/constants.js';

const BCRYPT_SALT_ROUNDS = 12;

@Injectable()
export class AdminBootstrapService implements OnModuleInit {
  private readonly logger = new Logger(AdminBootstrapService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
    private readonly subscriptionAccessService: SubscriptionAccessService,
  ) {}

  async onModuleInit(): Promise<void> {
    const email = this.configService.get<string>('ADMIN_EMAIL')?.trim().toLowerCase();
    const password = this.configService.get<string>('ADMIN_PASSWORD')?.trim();
    const name = this.configService.get<string>('ADMIN_NAME')?.trim() || 'Admin';

    if (!email || !password) {
      this.logger.log('Admin bootstrap skipped because ADMIN_EMAIL or ADMIN_PASSWORD is missing.');
      return;
    }

    const hashedPassword = await bcrypt.hash(password, BCRYPT_SALT_ROUNDS);
    const trialWindow = this.subscriptionAccessService.buildTrialWindow();

    const user = await this.prisma.user.upsert({
      where: { email },
      update: {
        password: hashedPassword,
        name,
        isActive: true,
        isVerified: true,
        trialStartAt: trialWindow.trialStartAt,
        trialEndAt: trialWindow.trialEndAt,
        subscriptionPlan: SubscriptionPlan.ENTERPRISE,
        subscriptionStatus: SubscriptionStatus.ACTIVE,
        monitorLimit: PLAN_LIMITS[SubscriptionPlan.ENTERPRISE].maxMonitors,
      },
      create: {
        email,
        password: hashedPassword,
        name,
        isActive: true,
        isVerified: true,
        trialStartAt: trialWindow.trialStartAt,
        trialEndAt: trialWindow.trialEndAt,
        subscriptionPlan: SubscriptionPlan.ENTERPRISE,
        subscriptionStatus: SubscriptionStatus.ACTIVE,
        monitorLimit: PLAN_LIMITS[SubscriptionPlan.ENTERPRISE].maxMonitors,
      },
      select: {
        id: true,
        email: true,
      },
    });

    this.logger.log(`Admin account ready for ${user.email}.`);
  }
}
