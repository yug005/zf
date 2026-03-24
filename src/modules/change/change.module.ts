import { Module } from '@nestjs/common';
import { ChangeController } from './change.controller.js';
import { ChangeService } from './change.service.js';

@Module({
  controllers: [ChangeController],
  providers: [ChangeService],
  exports: [ChangeService],
})
export class ChangeModule {}
