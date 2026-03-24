import { Controller, Get, Patch, Param, Query } from '@nestjs/common';
import { AlertService } from './alert.service.js';
import { CurrentUser } from '../auth/decorators/current-user.decorator.js';

@Controller('alerts')
export class AlertController {
  constructor(private readonly alertService: AlertService) {}

  /**
   * GET /api/v1/alerts?monitorId=...&status=...
   * List alerts — ownership verified via monitor → project → user chain.
   */
  @Get()
  async findAll(
    @CurrentUser('id') userId: string,
    @Query('monitorId') monitorId?: string,
    @Query('status') status?: string,
    @Query('limit') limit?: number,
  ) {
    return this.alertService.findAllByMonitor(userId, monitorId, status, limit);
  }

  /**
   * GET /api/v1/alerts/:id
   */
  @Get(':id')
  async findOne(
    @CurrentUser('id') userId: string,
    @Param('id') id: string,
  ) {
    return this.alertService.findOne(userId, id);
  }

  /**
   * PATCH /api/v1/alerts/:id/acknowledge
   */
  @Patch(':id/acknowledge')
  async acknowledge(
    @CurrentUser('id') userId: string,
    @Param('id') id: string,
  ) {
    return this.alertService.acknowledge(userId, id);
  }

  /**
   * PATCH /api/v1/alerts/:id/resolve
   */
  @Patch(':id/resolve')
  async resolve(
    @CurrentUser('id') userId: string,
    @Param('id') id: string,
  ) {
    return this.alertService.resolve(userId, id);
  }
}
