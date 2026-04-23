import { Controller, Post, Get, Param, Body, Req } from '@nestjs/common';
import { ScanService } from './scan.service.js';
import { InitiateScanDto } from './dto/scan.dto.js';

@Controller('security')
export class ScanController {
  constructor(private readonly scanService: ScanService) {}

  @Post('targets/:targetId/scans')
  initiateScan(
    @Req() req: any,
    @Param('targetId') targetId: string,
    @Body() dto: InitiateScanDto,
  ) {
    return this.scanService.initiateScan(targetId, req.user.id, dto, Boolean(req.user.isAdmin));
  }

  @Get('targets/:targetId/scans')
  listByTarget(@Req() req: any, @Param('targetId') targetId: string) {
    return this.scanService.listByTarget(targetId, req.user.id);
  }

  @Get('scans/:scanId')
  getScan(@Req() req: any, @Param('scanId') scanId: string) {
    return this.scanService.getById(scanId, req.user.id);
  }

  @Post('scans/:scanId/replay')
  replayScan(@Req() req: any, @Param('scanId') scanId: string) {
    return this.scanService.replayScan(scanId, req.user.id);
  }
}
