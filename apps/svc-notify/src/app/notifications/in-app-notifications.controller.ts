import { Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { CurrentUser, JwtAuthGuard, RequestUser } from '@hubblewave/auth-guard';
import { InAppNotificationService } from './in-app-notification.service';

@Controller('notifications/in-app')
@UseGuards(JwtAuthGuard)
export class InAppNotificationsController {
  constructor(private readonly inApp: InAppNotificationService) {}

  @Get()
  async list(@CurrentUser() user: RequestUser, @Query('unreadOnly') unreadOnly?: string) {
    return this.inApp.listForUser(user.id, unreadOnly === 'true');
  }

  @Get('unread-count')
  async unreadCount(@CurrentUser() user: RequestUser) {
    return { count: await this.inApp.getUnreadCount(user.id) };
  }

  @Post(':id/read')
  async markRead(@Param('id') id: string, @CurrentUser() user: RequestUser) {
    return this.inApp.markAsRead(id, user.id);
  }

  @Post('read-all')
  async markAll(@CurrentUser() user: RequestUser) {
    return { updated: await this.inApp.markAllAsRead(user.id) };
  }
}
