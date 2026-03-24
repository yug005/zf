import { Controller, Get, Post, Patch, Delete, Body, Param, Query, UseGuards } from '@nestjs/common';
import { MonitorService } from './monitor.service.js';
import { CreateMonitorDto } from './dto/create-monitor.dto.js';
import { UpdateMonitorDto } from './dto/update-monitor.dto.js';
import { CurrentUser } from '../auth/decorators/current-user.decorator.js';

@Controller('monitors')
export class MonitorController {
  constructor(private readonly monitorService: MonitorService) {}

  /**
   * POST /api/v1/monitors
   * Create a monitor — ownership of the parent project is verified in the service.
   */
  @Post()
  async create(
    @CurrentUser('id') userId: string,
    @Body() dto: CreateMonitorDto,
  ) {
    return this.monitorService.create(userId, dto);
  }

  /**
   * GET /api/v1/monitors?projectId=...
   * List monitors — only returns monitors belonging to the user's projects.
   */
  @Get()
  async findAll(
    @CurrentUser('id') userId: string,
    @Query('projectId') projectId: string,
  ) {
    return this.monitorService.findAllByProject(userId, projectId);
  }

  /**
   * GET /api/v1/monitors/:id
   * Get a single monitor — ownership verified in service.
   */
  @Get(':id')
  async findOne(
    @CurrentUser('id') userId: string,
    @Param('id') id: string,
  ) {
    return this.monitorService.findOne(userId, id);
  }

  /**
   * PATCH /api/v1/monitors/:id
   */
  @Patch(':id')
  async update(
    @CurrentUser('id') userId: string,
    @Param('id') id: string,
    @Body() dto: UpdateMonitorDto,
  ) {
    return this.monitorService.update(userId, id, dto);
  }

  /**
   * PATCH /api/v1/monitors/:id/pause
   */
  @Patch(':id/pause')
  async pause(
    @CurrentUser('id') userId: string,
    @Param('id') id: string,
  ) {
    return this.monitorService.togglePause(userId, id, true);
  }

  /**
   * PATCH /api/v1/monitors/:id/resume
   */
  @Patch(':id/resume')
  async resume(
    @CurrentUser('id') userId: string,
    @Param('id') id: string,
  ) {
    return this.monitorService.togglePause(userId, id, false);
  }

  /**
   * DELETE /api/v1/monitors/:id
   */
  @Delete(':id')
  async remove(
    @CurrentUser('id') userId: string,
    @Param('id') id: string,
  ) {
    return this.monitorService.deleteMonitor(userId, id);
  }
}
