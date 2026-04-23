import { Controller, Get, Patch, Param, Query, Body, Req } from '@nestjs/common';
import { FindingService } from './finding.service.js';

@Controller('security')
export class FindingController {
  constructor(private readonly findingService: FindingService) {}

  @Get('scans/:scanId/findings')
  listFindings(
    @Req() req: any,
    @Param('scanId') scanId: string,
    @Query('severity') severity?: string,
    @Query('category') category?: string,
    @Query('status') status?: string,
  ) {
    return this.findingService.listByScan(scanId, req.user.id, { severity, category, status });
  }

  @Patch('findings/:findingId')
  updateFinding(
    @Req() req: any,
    @Param('findingId') findingId: string,
    @Body() body: { status?: string; falsePositive?: boolean; fpNotes?: string },
  ) {
    return this.findingService.updateStatus(findingId, req.user.id, body);
  }
}
