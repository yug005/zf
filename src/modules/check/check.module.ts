import { Module } from '@nestjs/common';
import { CheckController } from './check.controller.js';
import { CheckService } from './check.service.js';

@Module({
  controllers: [CheckController],
  providers: [CheckService],
  exports: [CheckService],
})
export class CheckModule {}
