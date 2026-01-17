import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { CurrentUser, JwtAuthGuard, RequestUser } from '@hubblewave/auth-guard';
import { NotificationService, SendNotificationRequest } from './notification.service';

@Controller('notifications')
@UseGuards(JwtAuthGuard)
export class NotificationsController {
  constructor(private readonly notifications: NotificationService) {}

  @Post('send')
  async send(
    @Body() body: SendNotificationRequest,
    @CurrentUser() user?: RequestUser,
  ) {
    return this.notifications.send({
      ...body,
      actorId: user?.id,
    });
  }
}
