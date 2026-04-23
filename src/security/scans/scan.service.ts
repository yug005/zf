import {
  Injectable,
  Logger,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service.js';
import { EntitlementService } from '../entitlement/entitlement.service.js';
import { ScanProducer } from '../engine/producer/scan.producer.js';
import type { InitiateScanDto } from './dto/scan.dto.js';

@Injectable()
export class ScanService {
  private readonly logger = new Logger(ScanService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly entitlementService: EntitlementService,
    private readonly scanProducer: ScanProducer,
  ) {}

  /**
   * Initiate a new security scan for a target.
   */
  async initiateScan(targetId: string, userId: string, dto: InitiateScanDto, isAdmin = false) {
    // 1. Verify target ownership
    const target = await this.prisma.securityTarget.findFirst({
      where: { id: targetId, userId },
    });
    if (!target) {
      throw new NotFoundException('Security target not found.');
    }

    // 2. Check verification state (admins bypass all verification)
    if (!isAdmin) {
      if (dto.tier === 'STANDARD' && target.verificationState === 'UNVERIFIED') {
        throw new BadRequestException(
          'Standard scan requires ownership confirmation. Please verify your target first.',
        );
      }
      if (
        (dto.tier === 'ADVANCED' || dto.tier === 'EMULATION' || dto.tier === 'CONTINUOUS_VALIDATION') &&
        target.verificationState !== 'DNS_VERIFIED' &&
        target.verificationState !== 'HTTP_VERIFIED'
      ) {
        throw new BadRequestException(
          'Advanced, emulation, and continuous validation scans require DNS or HTTP technical verification.',
        );
      }
    }

    // 3. Check entitlement
    const entitlement = await this.entitlementService.canInitiateScan(
      userId,
      dto.tier as any,
      (dto.cadence || 'ONCE') as any,
      isAdmin,
    );
    if (!entitlement.allowed) {
      throw new ForbiddenException(entitlement.reason);
    }

    // 4. Create scan record
    const scan = await this.prisma.securityScan.create({
      data: {
        targetId,
        tier: dto.tier as any,
        executionMode: (dto.executionMode ?? dto.tier) as any,
        status: 'QUEUED',
        stage: 'TARGET_PREP',
        assetScope: toJson(dto.assetScope),
        authenticatedContext: toJson(dto.authenticatedContext),
      },
    });

    // 5. Consume free scan if applicable
    if (entitlement.plan === 'FREE' && !isAdmin) {
      await this.entitlementService.consumeFreeScan(userId);
    }

    // 6. Enqueue job
    await this.scanProducer.enqueueScan({
      scanId: scan.id,
      targetId: target.id,
      tier: dto.tier,
      executionMode: dto.executionMode ?? dto.tier,
      baseUrl: target.baseUrl,
      userId,
      enabledCategories: dto.enabledCategories,
      assetScope: dto.assetScope,
      authenticatedContext: dto.authenticatedContext as any,
      isAdmin,
    });

    this.logger.log(`Scan ${scan.id} initiated for target ${targetId} (${dto.tier})`);

    return scan;
  }

  /**
   * List scans for a target.
   */
  async listByTarget(targetId: string, userId: string) {
    // Verify ownership
    const target = await this.prisma.securityTarget.findFirst({
      where: { id: targetId, userId },
      select: { id: true },
    });
    if (!target) {
      throw new NotFoundException('Security target not found.');
    }

    return this.prisma.securityScan.findMany({
      where: { targetId },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        tier: true,
        executionMode: true,
        status: true,
        stage: true,
        stageProgress: true,
        score: true,
        riskLevel: true,
        severityCounts: true,
        summary: true,
        startedAt: true,
        completedAt: true,
        createdAt: true,
        errorMessage: true,
      },
    });
  }

  /**
   * Get a single scan by ID (with ownership check).
   */
  async getById(scanId: string, userId: string) {
    const scan = await this.prisma.securityScan.findUnique({
      where: { id: scanId },
      include: {
        target: { select: { id: true, name: true, baseUrl: true, userId: true } },
      },
    });

    if (!scan || scan.target.userId !== userId) {
      throw new NotFoundException('Scan not found.');
    }

    return scan;
  }

  async replayScan(scanId: string, userId: string) {
    const existing = await this.prisma.securityScan.findUnique({
      where: { id: scanId },
      include: { target: { select: { userId: true } } },
    });

    if (!existing || existing.target.userId !== userId) {
      throw new NotFoundException('Scan not found.');
    }

    return this.initiateScan(existing.targetId, userId, {
      tier: existing.tier as any,
      executionMode: existing.executionMode as any,
      enabledCategories: undefined,
      assetScope: (existing.assetScope as Record<string, unknown> | undefined) ?? undefined,
      authenticatedContext: (existing.authenticatedContext as any) ?? undefined,
    });
  }
}

function toJson(value: unknown): Prisma.InputJsonValue | undefined {
  return value === undefined ? undefined : (value as Prisma.InputJsonValue);
}
