import { Controller, Get, Post, Body, Param, UseGuards } from '@nestjs/common';
import { ProjectService } from './project.service.js';
import { CreateProjectDto } from './dto/create-project.dto.js';
import { CurrentUser } from '../auth/decorators/current-user.decorator.js';
import { ProjectOwnershipGuard } from '../auth/guards/project-ownership.guard.js';

@Controller('projects')
export class ProjectController {
  constructor(private readonly projectService: ProjectService) {}

  /**
   * POST /api/v1/projects
   * Create a project — userId is taken from the authenticated user.
   */
  @Post()
  async create(
    @CurrentUser('id') userId: string,
    @Body() dto: CreateProjectDto,
  ) {
    return this.projectService.create(userId, dto);
  }

  /**
   * GET /api/v1/projects
   * List all projects for the authenticated user.
   */
  @Get()
  async findAll(@CurrentUser('id') userId: string) {
    return this.projectService.findAllByUser(userId);
  }

  /**
   * GET /api/v1/projects/:id
   * Get a single project — ownership verified by guard.
   */
  @UseGuards(ProjectOwnershipGuard)
  @Get(':id')
  async findOne(@Param('id') id: string) {
    return this.projectService.findOne(id);
  }
}
