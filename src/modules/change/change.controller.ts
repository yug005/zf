import { Body, Controller, Get, Post, Query } from '@nestjs/common';
import { CurrentUser } from '../auth/decorators/current-user.decorator.js';
import { ChangeService } from './change.service.js';
import { CreateChangeEventDto } from './dto/create-change-event.dto.js';
import { BulkCreateChangeEventsDto } from './dto/bulk-create-change-events.dto.js';
import { IngestDeployDto } from './dto/ingest-deploy.dto.js';

@Controller('changes')
export class ChangeController {
  constructor(private readonly changeService: ChangeService) {}

  @Post()
  async create(
    @CurrentUser('id') userId: string,
    @Body() dto: CreateChangeEventDto,
  ) {
    return this.changeService.create(userId, dto);
  }

  @Post('bulk')
  async createBulk(
    @CurrentUser('id') userId: string,
    @Body() dto: BulkCreateChangeEventsDto,
  ) {
    return this.changeService.createBulk(userId, dto.events);
  }

  @Post('ingest/deploy')
  async ingestDeploy(
    @CurrentUser('id') userId: string,
    @Body() dto: IngestDeployDto,
  ) {
    return this.changeService.ingestDeploy(userId, dto);
  }

  @Get()
  async findAll(
    @CurrentUser('id') userId: string,
    @Query('projectId') projectId?: string,
    @Query('monitorId') monitorId?: string,
    @Query('type') type?: string,
    @Query('activeWatch') activeWatch?: string,
    @Query('limit') limit?: number,
  ) {
    return this.changeService.findAll(userId, {
      projectId,
      monitorId,
      type,
      activeWatch: activeWatch === 'true',
      limit,
    });
  }
}
