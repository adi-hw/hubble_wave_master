import { Body, Controller, Get, Param, Post, Put, UseGuards } from '@nestjs/common';
import { CurrentUser, JwtAuthGuard, RequestUser, Roles, RolesGuard } from '@hubblewave/auth-guard';
import { NotificationService, NotificationTemplateInput } from './notification.service';

@Controller('notifications/templates')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('admin')
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
