import {
  Controller,
  Get,
  Patch,
  Post,
  Query,
  Req,
} from '@nestjs/common';
import type { Request } from 'express';
import { NotificationService, InAppNotification } from './notification.service.js';

@Controller('notifications')
export class NotificationController {
  constructor(private readonly notificationService: NotificationService) {}

  @Get()
  async getNotifications(
    @Req() req: Request,
    @Query('limit') limit?: string,
  ): Promise<InAppNotification[]> {
    const userId = (req.user as { id: string }).id;
    return this.notificationService.getUserNotifications(userId, limit ? Number(limit) : 20);
  }

  @Get('unread-count')
  async getUnreadCount(@Req() req: Request): Promise<{ count: number }> {
    const userId = (req.user as { id: string }).id;
    const count = await this.notificationService.getUnreadCount(userId);
    return { count };
  }

  @Patch(':id/read')
  async markAsRead(@Req() req: Request): Promise<void> {
    const userId = (req.user as { id: string }).id;
    const notificationId = req.params['id'] as string;
    await this.notificationService.markAsRead(userId, notificationId);
  }

  @Post('read-all')
  async markAllAsRead(@Req() req: Request): Promise<void> {
    const userId = (req.user as { id: string }).id;
    await this.notificationService.markAllAsRead(userId);
  }
}
