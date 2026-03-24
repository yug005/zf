import { Controller, Get, Param, Query } from '@nestjs/common';
import { CheckService } from './check.service.js';
import { CurrentUser } from '../auth/decorators/current-user.decorator.js';

@Controller('checks')
export class CheckController {
  constructor(private readonly checkService: CheckService) {}

  /**
   * GET /api/v1/checks?monitorId=...
   * List check results — ownership verified via monitor → project → user chain.
   */
  @Get()
  async findAll(
    @CurrentUser('id') userId: string,
    @Query('monitorId') monitorId: string,
    @Query('limit') limit?: number,
    @Query('offset') offset?: number,
  ) {
    return this.checkService.findAllByMonitor(userId, monitorId, limit, offset);
  }

  /**
   * GET /api/v1/checks/:id
   * Get a single check result — ownership verified in service.
   */
  @Get(':id')
  async findOne(
    @CurrentUser('id') userId: string,
    @Param('id') id: string,
  ) {
    return this.checkService.findOne(userId, id);
  }
}
