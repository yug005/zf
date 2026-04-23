import { Module } from '@nestjs/common';
import { FindingController } from './finding.controller.js';
import { FindingService } from './finding.service.js';

@Module({
  controllers: [FindingController],
  providers: [FindingService],
  exports: [FindingService],
})
export class SecurityFindingModule {}
