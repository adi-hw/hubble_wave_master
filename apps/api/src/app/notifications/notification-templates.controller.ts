import { Body, Controller, Get, Param, Post, Put, UseGuards } from '@nestjs/common';
import {
  CurrentUser,
  JwtAuthGuard,
  PermissionsGuard,
  RequestUser,
  RequirePermission,
} from '@hubblewave/auth-guard';
import { NotificationService, NotificationTemplateInput } from './notification.service';

/**
 * Canon §28 / W2 Stream 3 — notification template administration is
 * platform-admin configuration. Gated by
 * `@RequirePermission('system:configure')`.
 */
@Controller('notifications/templates')
@UseGuards(JwtAuthGuard, PermissionsGuard)
@RequirePermission('system:configure')
export class NotificationTemplatesController {
  constructor(private readonly notifications: NotificationService) {}

  @Get()
  async list() {
    return this.notifications.listTemplates();
  }

  @Get(':id')
  async get(@Param('id') id: string) {
    return this.notifications.getTemplate(id);
  }

  @Post()
  async create(
    @Body() body: NotificationTemplateInput,
    @CurrentUser() user?: RequestUser,
  ) {
    return this.notifications.createTemplate(body, user?.id);
  }

  @Put(':id')
  async update(
    @Param('id') id: string,
    @Body() body: NotificationTemplateInput,
    @CurrentUser() user?: RequestUser,
  ) {
    return this.notifications.updateTemplate(id, body, user?.id);
  }
}
