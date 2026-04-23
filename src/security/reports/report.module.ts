import { Module } from '@nestjs/common';
import { ReportService } from './report.service.js';
import { ReportController } from './report.controller.js';
import { SecurityEngineModule } from '../engine/security-engine.module.js';

@Module({
  imports: [SecurityEngineModule],
  controllers: [ReportController],
  providers: [ReportService],
  exports: [ReportService],
})
export class SecurityReportModule {}
