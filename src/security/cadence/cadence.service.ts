import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../../prisma/prisma.service.js';
import { ScanProducer } from '../engine/producer/scan.producer.js';
import { EntitlementService } from '../entitlement/entitlement.service.js';

@Injectable()
export class CadenceService {
  private readonly logger = new Logger(CadenceService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly scanProducer: ScanProducer,
    private readonly entitlementService: EntitlementService,
  ) {}

  async setCadence(targetId: string, userId: string, cadence: string, tier: string, isAdmin = false) {
    const target = await this.prisma.securityTarget.findFirst({
      where: { id: targetId, userId },
    });
    if (!target) {
      throw new NotFoundException('Security target not found.');
    }

    // Check entitlement
    const entitlement = await this.entitlementService.canInitiateScan(
      userId,
      tier as any,
      cadence as any,
      isAdmin,
    );
    if (!entitlement.allowed) {
      throw new BadRequestException(entitlement.reason);
    }

    // Upsert profile
    const existing = await this.prisma.securityScanProfile.findFirst({
      where: { targetId, isActive: true },
    });

    if (existing) {
      return this.prisma.securityScanProfile.update({
        where: { id: existing.id },
        data: { cadence: cadence as any, tier: tier as any, isActive: true },
      });
    }

    return this.prisma.securityScanProfile.create({
      data: {
        targetId,
        cadence: cadence as any,
        tier: tier as any,
        isActive: true,
      },
    });
  }

  async removeCadence(targetId: string, userId: string) {
    const target = await this.prisma.securityTarget.findFirst({
      where: { id: targetId, userId },
    });
    if (!target) {
      throw new NotFoundException('Security target not found.');
    }

    await this.prisma.securityScanProfile.updateMany({
      where: { targetId, isActive: true },
      data: { isActive: false },
    });

    return { message: 'Recurring scan cadence removed.' };
  }

  /**
   * Cron: run daily at 03:00 UTC to process recurring scan schedules.
   */
  @Cron(CronExpression.EVERY_DAY_AT_3AM)
  async processRecurringScans() {
    this.logger.log('Processing recurring security scans...');

    const activeProfiles = await this.prisma.securityScanProfile.findMany({
      where: { isActive: true, cadence: { not: 'ONCE' } },
      include: { target: { select: { id: true, baseUrl: true, userId: true, verificationState: true } } },
    });

    const now = new Date();

    for (const profile of activeProfiles) {
      if (!this.isDue(profile.cadence!, profile.lastScheduledAt, now)) {
        continue;
      }

      // Check entitlement
      const entitlement = await this.entitlementService.canInitiateScan(
        profile.target.userId,
        profile.tier as any,
        profile.cadence as any,
        false,
      );

      if (!entitlement.allowed) {
        this.logger.warn(`Skipping recurring scan for target ${profile.targetId}: ${entitlement.reason}`);
        continue;
      }

      try {
        const scan = await this.prisma.securityScan.create({
          data: {
            targetId: profile.targetId,
            profileId: profile.id,
            tier: profile.tier as any,
            status: 'QUEUED',
            stage: 'TARGET_PREP',
          },
        });

        await this.scanProducer.enqueueScan({
          scanId: scan.id,
          targetId: profile.target.id,
          tier: profile.tier,
          baseUrl: profile.target.baseUrl,
          userId: profile.target.userId,
        });

        await this.prisma.securityScanProfile.update({
          where: { id: profile.id },
          data: { lastScheduledAt: now },
        });

        this.logger.log(`Recurring scan enqueued: ${scan.id} for target ${profile.targetId}`);
      } catch (error) {
        this.logger.error(`Failed to enqueue recurring scan for ${profile.targetId}: ${error}`);
      }
    }
  }

  private isDue(cadence: string, lastScheduledAt: Date | null, now: Date): boolean {
    if (!lastScheduledAt) return true;

    const elapsed = now.getTime() - lastScheduledAt.getTime();

    switch (cadence) {
      case 'DAILY':
        return elapsed >= 23 * 60 * 60 * 1000; // ~23 hours
      case 'WEEKLY':
        return elapsed >= 6.5 * 24 * 60 * 60 * 1000; // ~6.5 days
      case 'MONTHLY':
        return elapsed >= 27 * 24 * 60 * 60 * 1000; // ~27 days
      default:
        return false;
    }
  }
}
