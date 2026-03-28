import { Controller, Get, Param, Query, Res } from '@nestjs/common';
import type { Response } from 'express';
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
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
    @Query('days') days?: string,
  ) {
    return this.checkService.findAllByMonitor(userId, {
      monitorId,
      limit: limit ? Number(limit) : undefined,
      offset: offset ? Number(offset) : undefined,
      days: days ? Number(days) : undefined,
    });
  }

  @Get('export')
  async exportCsv(
    @CurrentUser('id') userId: string,
    @Query('monitorId') monitorId: string,
    @Query('days') days: string,
    @Res() response: Response,
  ) {
    const parsedDays = Number(days);
    const csv = await this.checkService.exportChecksCsv(userId, {
      monitorId,
      days: parsedDays,
    });

    response.setHeader('Content-Type', 'text/csv; charset=utf-8');
    response.setHeader(
      'Content-Disposition',
      `attachment; filename="monitor-check-history-${parsedDays}d-${monitorId}.csv"`,
    );
    response.send(csv);
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
