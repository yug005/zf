import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service.js';

/**
 * Verifies the authenticated user owns the project referenced in the request.
 *
 * Works for routes that have:
 *  - `projectId` in body (POST create)
 *  - `projectId` in query (GET list)
 *  - `:id` param (GET/PATCH/DELETE single project)
 *
 * For monitors/checks/alerts, the controller should verify ownership
 * by walking up to the project → user chain (done in services).
 */
@Injectable()
export class ProjectOwnershipGuard implements CanActivate {
  private readonly logger = new Logger(ProjectOwnershipGuard.name);

  constructor(private readonly prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const userId = request.user?.id;

    if (!userId) {
      throw new ForbiddenException('Authentication required');
    }

    // Determine the projectId from various request locations
    const projectId =
      request.params?.id ||        // GET/PATCH/DELETE /projects/:id
      request.body?.projectId ||   // POST (create with projectId in body)
      request.query?.projectId;    // GET list with projectId filter

    if (!projectId) {
      // No projectId to check — let the request through
      // (the service layer will handle userId scoping)
      return true;
    }

    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
      select: { userId: true },
    });

    if (!project) {
      // Let it through — the service will throw NotFoundException
      return true;
    }

    if (project.userId !== userId) {
      this.logger.warn(
        `User ${userId} attempted to access project ${projectId} owned by ${project.userId}`,
      );
      throw new ForbiddenException('You do not have access to this project');
    }

    return true;
  }
}
