import { Module } from '@nestjs/common';
import { StatusPagesService } from './status-pages.service.js';
import { StatusPagesController } from './status-pages.controller.js';
import { PrismaModule } from '../prisma/prisma.module.js';

@Module({
  imports: [PrismaModule],
  controllers: [StatusPagesController],
  providers: [StatusPagesService],
})
export class StatusPagesModule {}
