import { Module } from '@nestjs/common';
import { NotificationController } from './notification.controller.js';
import { NotificationService } from './notification.service.js';
import { PrismaModule } from '../../prisma/prisma.module.js';
import { ApiKeyModule } from '../api-key/api-key.module.js';

@Module({
  imports: [PrismaModule, ApiKeyModule],
  controllers: [NotificationController],
  providers: [NotificationService],
  exports: [NotificationService],
})
export class NotificationModule {}
