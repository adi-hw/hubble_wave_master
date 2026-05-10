import { Body, Controller, ForbiddenException, Post, UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import {
  CurrentUser,
  JwtAuthGuard,
  RequestUser,
  RequirePermission,
} from '@hubblewave/auth-guard';
import { NotificationService, SendNotificationRequest } from './notification.service';

/**
 * The /notifications/send endpoint is the privileged "admin direct-send"
 * surface. A successful POST here lets the caller construct an arbitrary
 * payload and have it delivered to any recipient as an official system
 * notification — a textbook internal-phishing vector if held by anyone
 * other than admins. Server-originated notification flows (workflows,
 * automations, AVA actions) do NOT call this controller; they invoke
 * NotificationService.send() directly through DI and bypass this gate.
 *
 * Authorization: notifications.send.direct OR system.admin OR the admin
 * role. The throttle remains as defense in depth — even with the right
 * permission, no single principal should burst more than 30 sends/min.
 */
@Controller('notifications')
@UseGuards(JwtAuthGuard)
export class NotificationsController {
  constructor(private readonly notifications: NotificationService) {}

  @Post('send')
  @RequirePermission('notifications.send.direct')
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  async send(
    @Body() body: SendNotificationRequest,
    @CurrentUser() user?: RequestUser,
  ) {
    if (!user) {
      // Defensive: JwtAuthGuard should already have rejected, but the
      // service trusts actorId so we double-check at the boundary.
      throw new ForbiddenException('Authentication required');
    }
    return this.notifications.send({
      ...body,
      actorId: user.id,
    });
  }
}
