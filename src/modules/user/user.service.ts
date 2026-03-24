import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service.js';
import { SubscriptionAccessService } from '../billing/subscription-access.service.js';

@Injectable()
export class UserService {
  private readonly logger = new Logger(UserService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly subscriptionAccessService: SubscriptionAccessService,
  ) {}

  async findOne(id: string) {
    this.logger.debug(`Finding user ${id}`);
    const access = await this.subscriptionAccessService.syncUserStateById(id);
    const user = await this.prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        email: true,
        name: true,
        avatarUrl: true,
        isActive: true,
        isVerified: true,
        createdAt: true,
      },
    });

    if (!user) {
      throw new NotFoundException(`User with ID "${id}" not found`);
    }

    return {
      ...user,
      subscriptionPlan: access.subscriptionPlan,
      subscriptionStatus: access.subscriptionStatus,
      trialStartAt: access.trialStartAt,
      trialEndAt: access.trialEndAt,
      monitorLimit: access.monitorLimit,
      hasMonitoringAccess: access.hasMonitoringAccess,
      canCreateMonitors: access.canCreateMonitors,
      daysRemainingInTrial: access.daysRemainingInTrial,
      isAdmin: access.isAdmin,
    };
  }

  async findByEmail(email: string) {
    return this.prisma.user.findUnique({ where: { email } });
  }
}
