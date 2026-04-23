import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service.js';

@Injectable()
export class FindingService {
  constructor(private readonly prisma: PrismaService) {}

  async listByScan(
    scanId: string,
    userId: string,
    filters?: {
      severity?: string;
      category?: string;
      status?: string;
    },
  ) {
    // Verify scan ownership
    const scan = await this.prisma.securityScan.findUnique({
      where: { id: scanId },
      include: { target: { select: { userId: true } } },
    });
    if (!scan || scan.target.userId !== userId) {
      throw new NotFoundException('Scan not found.');
    }

    return this.prisma.securityFinding.findMany({
      where: {
        scanId,
        ...(filters?.severity && { severity: filters.severity as any }),
        ...(filters?.category && { category: filters.category as any }),
        ...(filters?.status && { status: filters.status as any }),
      },
      orderBy: [{ severity: 'asc' }, { exploitability: 'asc' }],
    });
  }

  async updateStatus(
    findingId: string,
    userId: string,
    data: { status?: string; falsePositive?: boolean; fpNotes?: string },
  ) {
    const finding = await this.prisma.securityFinding.findUnique({
      where: { id: findingId },
      include: { scan: { include: { target: { select: { userId: true } } } } },
    });
    if (!finding || finding.scan.target.userId !== userId) {
      throw new NotFoundException('Finding not found.');
    }

    return this.prisma.securityFinding.update({
      where: { id: findingId },
      data: {
        ...(data.status && { status: data.status as any }),
        ...(data.falsePositive !== undefined && { falsePositive: data.falsePositive }),
        ...(data.fpNotes !== undefined && { fpNotes: data.fpNotes }),
      },
    });
  }
}
