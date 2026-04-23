import { Injectable, NotFoundException, ForbiddenException, BadRequestException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import crypto from 'node:crypto';
import { PrismaService } from '../../prisma/prisma.service.js';
import { EntitlementService } from '../entitlement/entitlement.service.js';
import { CreateTargetDto, UpdateTargetDto, LinkTargetDto, CreateCollectorDto } from './dto/target.dto.js';

@Injectable()
export class TargetService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly entitlementService: EntitlementService,
  ) {}

  async create(userId: string, dto: CreateTargetDto, isAdmin = false) {
    // Check entitlement — admins get unlimited
    const entitlement = await this.entitlementService.canCreateTarget(userId, isAdmin);
    if (!entitlement.allowed) {
      throw new ForbiddenException(entitlement.reason);
    }
    // Validate baseUrl format — strip trailing slash
    const normalizedUrl = dto.baseUrl.replace(/\/+$/, '');

    // Optionally verify projectId belongs to user
    if (dto.projectId) {
      const project = await this.prisma.project.findFirst({
        where: { id: dto.projectId, userId },
      });
      if (!project) {
        throw new BadRequestException('Project not found or does not belong to you.');
      }
    }

    const parsedUrl = new URL(normalizedUrl);
    const hostname = parsedUrl.hostname;
    const targetKind = dto.targetKind ?? this.classifyTargetKind(normalizedUrl);
    const environment = dto.environment ?? this.classifyEnvironment(normalizedUrl);
    const criticality = dto.criticality ?? 'MEDIUM';

    return this.prisma.$transaction(async (tx) => {
      const target = await tx.securityTarget.create({
        data: {
          userId,
          name: dto.name,
          baseUrl: normalizedUrl,
          description: dto.description,
          projectId: dto.projectId,
          monitorId: dto.monitorId,
          targetKind: targetKind as any,
          environment: environment as any,
          criticality: criticality as any,
          metadata: toJson(dto.metadata),
        },
      });

      const rootAsset = await tx.securityAsset.create({
        data: {
          targetId: target.id,
          kind: targetKind as any,
          name: dto.name,
          hostname,
          address: parsedUrl.origin,
          environment: environment as any,
          criticality: criticality as any,
          reachability: environment === 'LAB' || environment === 'DEVELOPMENT' ? 'INTERNAL' : 'EXTERNAL',
          tags: ['root', targetKind.toLowerCase()],
          metadata: {
            baseUrl: normalizedUrl,
            source: 'target_onboarding',
          },
        },
      });

      const domainAsset = await tx.securityAsset.create({
        data: {
          targetId: target.id,
          parentAssetId: rootAsset.id,
          kind: 'DOMAIN',
          name: hostname,
          hostname,
          address: hostname,
          environment: environment as any,
          criticality: criticality as any,
          reachability: environment === 'LAB' || environment === 'DEVELOPMENT' ? 'INTERNAL' : 'EXTERNAL',
          tags: ['domain', 'initial'],
          metadata: {
            source: 'target_onboarding',
          },
        },
      });

      await tx.securityRelationship.create({
        data: {
          targetId: target.id,
          fromAssetId: rootAsset.id,
          toAssetId: domainAsset.id,
          kind: 'HOSTS',
          confidence: 'HIGH',
          metadata: {
            source: 'target_onboarding',
          },
        },
      });

      return tx.securityTarget.findUniqueOrThrow({
        where: { id: target.id },
        include: { verifications: true, assets: true },
      });
    });
  }

  async findAllByUser(userId: string) {
    return this.prisma.securityTarget.findMany({
      where: { userId },
      include: {
        verifications: { orderBy: { createdAt: 'desc' }, take: 1 },
        scans: { orderBy: { createdAt: 'desc' }, take: 1 },
        assets: { take: 3, orderBy: { createdAt: 'asc' } },
        _count: { select: { scans: true, endpoints: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOneByUser(targetId: string, userId: string) {
    const target = await this.prisma.securityTarget.findFirst({
      where: { id: targetId, userId },
      include: {
        verifications: { orderBy: { createdAt: 'desc' } },
        scanProfiles: true,
        scans: { orderBy: { createdAt: 'desc' }, take: 5 },
        assets: { orderBy: { createdAt: 'asc' } },
        collectors: { orderBy: { createdAt: 'desc' } },
        _count: { select: { scans: true, endpoints: true } },
      },
    });

    if (!target) {
      throw new NotFoundException('Security target not found.');
    }

    return target;
  }

  async update(targetId: string, userId: string, dto: UpdateTargetDto) {
    await this.assertOwnership(targetId, userId);

    return this.prisma.securityTarget.update({
      where: { id: targetId },
      data: {
        ...(dto.name !== undefined && { name: dto.name }),
        ...(dto.description !== undefined && { description: dto.description }),
        ...(dto.projectId !== undefined && { projectId: dto.projectId }),
        ...(dto.monitorId !== undefined && { monitorId: dto.monitorId }),
        ...(dto.targetKind !== undefined && { targetKind: dto.targetKind as any }),
        ...(dto.environment !== undefined && { environment: dto.environment as any }),
        ...(dto.criticality !== undefined && { criticality: dto.criticality as any }),
        ...(dto.metadata !== undefined && { metadata: toJson(dto.metadata) }),
      } as any,
    });
  }

  async remove(targetId: string, userId: string) {
    await this.assertOwnership(targetId, userId);

    return this.prisma.securityTarget.delete({
      where: { id: targetId },
    });
  }

  async linkToProjectOrMonitor(targetId: string, userId: string, dto: LinkTargetDto) {
    await this.assertOwnership(targetId, userId);

    if (dto.projectId) {
      const project = await this.prisma.project.findFirst({
        where: { id: dto.projectId, userId },
      });
      if (!project) {
        throw new BadRequestException('Project not found or does not belong to you.');
      }
    }

    return this.prisma.securityTarget.update({
      where: { id: targetId },
      data: {
        projectId: dto.projectId ?? undefined,
        monitorId: dto.monitorId ?? undefined,
      },
    });
  }

  async unlinkFromProjectAndMonitor(targetId: string, userId: string) {
    await this.assertOwnership(targetId, userId);

    return this.prisma.securityTarget.update({
      where: { id: targetId },
      data: { projectId: null, monitorId: null },
    });
  }

  async listAssets(targetId: string, userId: string) {
    await this.assertOwnership(targetId, userId);

    return this.prisma.securityAsset.findMany({
      where: { targetId },
      orderBy: [{ criticality: 'desc' }, { createdAt: 'asc' }],
      include: {
        collector: { select: { id: true, name: true, status: true } },
      },
    });
  }

  async createCollector(targetId: string, userId: string, dto: CreateCollectorDto) {
    await this.assertOwnership(targetId, userId);

    return this.prisma.securityCollector.create({
      data: {
        targetId,
        name: dto.name,
        environment: (dto.environment ?? 'PRODUCTION') as any,
        capabilities: toJson(dto.capabilities),
        allowlist: toJson(dto.allowlist),
        policy: toJson(dto.policy),
        registrationToken: crypto.randomUUID(),
      },
    });
  }

  async listCollectors(targetId: string, userId: string) {
    await this.assertOwnership(targetId, userId);

    return this.prisma.securityCollector.findMany({
      where: { targetId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async listScenarioPacks(targetId: string, userId: string) {
    const target = await this.prisma.securityTarget.findFirst({
      where: { id: targetId, userId },
      select: { id: true, targetKind: true },
    });

    if (!target) {
      throw new NotFoundException('Security target not found.');
    }

    const packs = await this.prisma.securityScenarioPack.findMany({
      orderBy: [{ family: 'asc' }, { name: 'asc' }],
      include: {
        steps: { orderBy: { orderIndex: 'asc' } },
      },
    });

    return packs.filter((pack) => {
      const kinds = Array.isArray(pack.supportedAssetKinds) ? pack.supportedAssetKinds : [];
      return kinds.length === 0 || kinds.includes(target.targetKind);
    });
  }

  async assertOwnership(targetId: string, userId: string) {
    const target = await this.prisma.securityTarget.findFirst({
      where: { id: targetId, userId },
      select: { id: true },
    });

    if (!target) {
      throw new NotFoundException('Security target not found.');
    }

    return target;
  }

  private classifyTargetKind(baseUrl: string) {
    const url = new URL(baseUrl);
    const host = url.hostname.toLowerCase();

    if (host.startsWith('api.') || url.pathname.startsWith('/api')) {
      return 'API';
    }

    return 'WEB_APP';
  }

  private classifyEnvironment(baseUrl: string) {
    const host = new URL(baseUrl).hostname.toLowerCase();

    if (host === 'localhost' || host.startsWith('127.') || host.endsWith('.local')) {
      return 'LAB';
    }

    if (host.includes('staging') || host.includes('preview') || host.includes('dev')) {
      return 'STAGING';
    }

    return 'PRODUCTION';
  }
}

function toJson(value: unknown): Prisma.InputJsonValue | undefined {
  return value === undefined ? undefined : (value as Prisma.InputJsonValue);
}
