import { Injectable, ConflictException, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { CreateStatusPageDto } from './dto/create-status-page.dto.js';
import { UpdateStatusPageDto } from './dto/update-status-page.dto.js';

@Injectable()
export class StatusPagesService {
  constructor(private readonly prisma: PrismaService) {}

  async create(userId: string, dto: CreateStatusPageDto) {
    const existing = await this.prisma.statusPage.findUnique({
      where: { slug: dto.slug },
    });
    if (existing) {
      throw new ConflictException('Status page with this slug already exists');
    }

    return this.prisma.statusPage.create({
      data: {
        userId,
        name: dto.name,
        slug: dto.slug,
        mode: dto.mode ?? 'SIMPLE',
        monitors: {
          create: dto.monitorIds?.map(id => ({ monitorId: id })) || [],
        },
      },
    });
  }

  async findAllForUser(userId: string) {
    return this.prisma.statusPage.findMany({
      where: { userId },
      include: { monitors: { include: { monitor: true } } },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOneForUser(userId: string, id: string) {
    const page = await this.prisma.statusPage.findFirst({
      where: { id, userId },
      include: {
        monitors: {
          include: { monitor: true },
        },
      },
    });
    if (!page) throw new NotFoundException('Status page not found');
    return page;
  }

  async update(userId: string, id: string, dto: UpdateStatusPageDto) {
    await this.findOneForUser(userId, id);

    return this.prisma.$transaction(async (tx) => {
      if (dto.monitorIds) {
        // Simple approach: clear and re-add
        await tx.statusPageMonitor.deleteMany({
          where: { statusPageId: id },
        });
        await tx.statusPageMonitor.createMany({
          data: dto.monitorIds.map((mId) => ({
            statusPageId: id,
            monitorId: mId,
          })),
        });
      }

      return tx.statusPage.update({
        where: { id },
        data: {
          name: dto.name,
          slug: dto.slug,
          mode: dto.mode,
        },
      });
    });
  }

  async delete(userId: string, id: string) {
    await this.findOneForUser(userId, id); // check exists
    return this.prisma.statusPage.delete({ where: { id } });
  }

  async addMonitor(userId: string, id: string, monitorId: string) {
    await this.findOneForUser(userId, id);
    return this.prisma.statusPageMonitor.create({
      data: { statusPageId: id, monitorId },
    });
  }

  async removeMonitor(userId: string, id: string, monitorId: string) {
    await this.findOneForUser(userId, id);
    return this.prisma.statusPageMonitor.delete({
      where: {
        statusPageId_monitorId: { statusPageId: id, monitorId },
      },
    });
  }

  // Public API
  async getPublicPage(slug: string) {
    const page = await this.prisma.statusPage.findUnique({
      where: { slug },
      include: {
        monitors: {
          include: {
            monitor: {
              select: {
                id: true,
                name: true,
                url: true,
                status: true,
                expectedStatus: true,
                checkResults: {
                  take: 50,
                  orderBy: { checkedAt: 'desc' },
                  select: {
                    responseTimeMs: true,
                    status: true,
                    checkedAt: true,
                  },
                },
              }
            }
          }
        }
      }
    });

    if (!page) throw new NotFoundException('Status page not found');

    const mappedMonitors = page.monitors.map(m => m.monitor);
    let overallStatus = 'UP';
    if (mappedMonitors.some(m => m.status === 'DOWN')) {
      overallStatus = 'DOWN';
    } else if (mappedMonitors.some(m => m.status === 'DEGRADED')) {
      overallStatus = 'DEGRADED';
    } else if (mappedMonitors.some(m => m.status === 'PAUSED')) {
      overallStatus = 'PAUSED'; // Optional: Handle paused
    }

    const incidents = await this.prisma.incident.findMany({
      where: { monitorId: { in: mappedMonitors.map(m => m.id) } },
      orderBy: { createdAt: 'desc' },
      take: 5,
      include: { monitor: { select: { name: true } } }
    });

    return {
      id: page.id,
      name: page.name,
      mode: page.mode,
      overallStatus,
      monitors: mappedMonitors.map((monitor) => {
        const successfulChecks = monitor.checkResults.filter((check) => check.status === 'SUCCESS');
        const responseTimes = monitor.checkResults
          .map((check) => check.responseTimeMs)
          .filter((value): value is number => typeof value === 'number' && value > 0);

        return {
          id: monitor.id,
          name: monitor.name,
          url: monitor.url,
          status: monitor.status,
          expectedStatus: monitor.expectedStatus,
          uptimePercentage: monitor.checkResults.length
            ? Number(((successfulChecks.length / monitor.checkResults.length) * 100).toFixed(1))
            : null,
          avgResponseTimeMs: responseTimes.length
            ? Math.round(responseTimes.reduce((sum, value) => sum + value, 0) / responseTimes.length)
            : null,
          latencySeries: page.mode === 'ADVANCED'
            ? monitor.checkResults
                .slice()
                .reverse()
                .map((check) => ({
                  checkedAt: check.checkedAt,
                  responseTimeMs: check.responseTimeMs,
                  status: check.status,
                }))
            : undefined,
        };
      }),
      incidents,
      updatedAt: new Date().toISOString()
    };
  }
}
