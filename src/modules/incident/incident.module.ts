import { Module } from '@nestjs/common';
import { IncidentController } from './incident.controller.js';
import { IncidentService } from './incident.service.js';
import { ChangeModule } from '../change/change.module.js';

@Module({
  imports: [ChangeModule],
  controllers: [IncidentController],
  providers: [IncidentService],
  exports: [IncidentService],
})
export class IncidentModule {}
