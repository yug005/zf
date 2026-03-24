import { Controller, Get, Param, Query } from '@nestjs/common';
import { IncidentStatus } from '@prisma/client';
import { CurrentUser } from '../auth/decorators/current-user.decorator.js';
import { IncidentService } from './incident.service.js';

@Controller('incidents')
export class IncidentController {
  constructor(private readonly incidentService: IncidentService) {}

  @Get()
  async findAll(
    @CurrentUser('id') userId: string,
    @Query('monitorId') monitorId?: string,
    @Query('status') status?: IncidentStatus,
    @Query('limit') limit?: number,
  ) {
    return this.incidentService.findAll(userId, { monitorId, status, limit });
  }

  @Get(':id')
  async findOne(@CurrentUser('id') userId: string, @Param('id') id: string) {
    return this.incidentService.findOne(userId, id);
  }
}
