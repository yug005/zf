import { Controller, Get, Param, Req } from '@nestjs/common';
import { ReportService } from './report.service.js';

@Controller('security')
export class ReportController {
  constructor(private readonly reportService: ReportService) {}

  @Get('scans/:scanId/report')
  getReport(@Req() req: any, @Param('scanId') scanId: string) {
    return this.reportService.getExecutiveReport(scanId, req.user.id);
  }

  @Get('scans/:scanId/attack-paths')
  getAttackPaths(@Req() req: any, @Param('scanId') scanId: string) {
    return this.reportService.getAttackPaths(scanId, req.user.id);
  }

  @Get('scans/:scanId/evidence')
  getEvidence(@Req() req: any, @Param('scanId') scanId: string) {
    return this.reportService.getEvidence(scanId, req.user.id);
  }
}
