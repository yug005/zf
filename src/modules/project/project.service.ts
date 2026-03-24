import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service.js';
import { CreateProjectDto } from './dto/create-project.dto.js';

@Injectable()
export class ProjectService {
  private readonly logger = new Logger(ProjectService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Create a project scoped to the authenticated user.
   */
  async create(userId: string, dto: CreateProjectDto) {
    this.logger.log(`Creating project "${dto.name}" for user ${userId}`);
    return this.prisma.project.create({
      data: {
        name: dto.name,
        slug: dto.slug,
        description: dto.description,
        userId, // Always set from JWT, never from user input
      },
    });
  }

  /**
   * List all projects belonging to the authenticated user.
   */
  async findAllByUser(userId: string) {
    return this.prisma.project.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * Get a single project by ID (ownership already verified by guard).
   */
  async findOne(id: string) {
    const project = await this.prisma.project.findUnique({
      where: { id },
      include: { monitors: true },
    });

    if (!project) {
      throw new NotFoundException(`Project with ID "${id}" not found`);
    }

    return project;
  }

  /**
   * Verify a project belongs to a given user.
   * Used by other modules for cross-resource ownership checks.
   */
  async verifyOwnership(projectId: string, userId: string): Promise<boolean> {
    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
      select: { userId: true },
    });

    return project?.userId === userId;
  }
}
