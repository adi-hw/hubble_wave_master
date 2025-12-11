import {
  Body,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  NotFoundException,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard, RequestContext, RolesGuard, Roles } from '@eam-platform/auth-guard';
import {
  TenantDbService,
  NotificationTemplate,
  NotificationChannel,
  NotificationDelivery,
  InAppNotification,
} from '@eam-platform/tenant-db';

interface CreateNotificationTemplateDto {
  code: string;
  name: string;
  description?: string;
  supportedChannels: string[];
  emailSubject?: string;
  emailBodyHtml?: string;
  emailBodyText?: string;
  inAppTitle?: string;
  inAppBody?: string;
  smsBody?: string;
  pushTitle?: string;
  pushBody?: string;
  availableVariables?: any[];
  isActive?: boolean;
}

interface CreateNotificationChannelDto {
  code: string;
  name: string;
  channelType: 'email' | 'sms' | 'push' | 'in_app' | 'webhook';
  config: Record<string, any>;
  isDefault?: boolean;
  isActive?: boolean;
}

@Controller('admin/notifications')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('tenant_admin', 'platform_admin')
export class NotificationsController {
  constructor(private readonly tenantDb: TenantDbService) {}

  // ========== Notification Templates ==========

  @Get('templates')
  async listTemplates(
    @Query('active') active: string,
    @Query('channel') channel: string,
    @Req() req: any,
  ) {
    const ctx: RequestContext = req.context || req.user;
    // Access check done by RolesGuard

    const repo = await this.tenantDb.getRepository<NotificationTemplate>(
      ctx.tenantId,
      NotificationTemplate,
    );

    const where: any = {};
    if (active !== undefined) where.isActive = active === 'true';

    let templates = await repo.find({
      where,
      order: { code: 'ASC' },
    });

    // Filter by channel if specified
    if (channel) {
      templates = templates.filter((t) => t.supportedChannels?.includes(channel));
    }

    return { items: templates };
  }

  @Get('templates/:id')
  async getTemplate(@Query('id') id: string, @Req() req: any) {
    const ctx: RequestContext = req.context || req.user;
    // Access check done by RolesGuard

    const repo = await this.tenantDb.getRepository<NotificationTemplate>(
      ctx.tenantId,
      NotificationTemplate,
    );
    const template = await repo.findOne({ where: { id } });

    if (!template) {
      throw new NotFoundException('Notification template not found');
    }

    return template;
  }

  @Post('templates')
  async createTemplate(@Body() body: CreateNotificationTemplateDto, @Req() req: any) {
    const ctx: RequestContext = req.context || req.user;
    // Access check done by RolesGuard

    const repo = await this.tenantDb.getRepository<NotificationTemplate>(
      ctx.tenantId,
      NotificationTemplate,
    );

    // Check for duplicate code
    const existing = await repo.findOne({ where: { code: body.code, tenantId: ctx.tenantId } });
    if (existing) {
      throw new ForbiddenException(`Template with code "${body.code}" already exists`);
    }

    const template = repo.create({
      tenantId: ctx.tenantId,
      code: body.code,
      name: body.name,
      description: body.description,
      supportedChannels: body.supportedChannels,
      emailSubject: body.emailSubject,
      emailBodyHtml: body.emailBodyHtml,
      emailBodyText: body.emailBodyText,
      inAppTitle: body.inAppTitle,
      inAppBody: body.inAppBody,
      smsBody: body.smsBody,
      pushTitle: body.pushTitle,
      pushBody: body.pushBody,
      availableVariables: body.availableVariables,
      source: 'tenant',
      isActive: body.isActive !== false,
      isSystem: false,
    });

    return repo.save(template);
  }

  @Patch('templates/:id')
  async updateTemplate(
    @Query('id') id: string,
    @Body() body: Partial<CreateNotificationTemplateDto>,
    @Req() req: any,
  ) {
    const ctx: RequestContext = req.context || req.user;
    // Access check done by RolesGuard

    const repo = await this.tenantDb.getRepository<NotificationTemplate>(
      ctx.tenantId,
      NotificationTemplate,
    );
    const template = await repo.findOne({ where: { id } });

    if (!template) {
      throw new NotFoundException('Notification template not found');
    }

    if (template.isSystem) {
      throw new ForbiddenException('Cannot modify system templates');
    }

    // Check for duplicate code if changing
    if (body.code && body.code !== template.code) {
      const existing = await repo.findOne({ where: { code: body.code, tenantId: ctx.tenantId } });
      if (existing) {
        throw new ForbiddenException(`Template with code "${body.code}" already exists`);
      }
    }

    // Build update object
    const updateData: Partial<NotificationTemplate> = {};
    if (body.code !== undefined) updateData.code = body.code;
    if (body.name !== undefined) updateData.name = body.name;
    if (body.description !== undefined) updateData.description = body.description;
    if (body.supportedChannels !== undefined) updateData.supportedChannels = body.supportedChannels;
    if (body.emailSubject !== undefined) updateData.emailSubject = body.emailSubject;
    if (body.emailBodyHtml !== undefined) updateData.emailBodyHtml = body.emailBodyHtml;
    if (body.emailBodyText !== undefined) updateData.emailBodyText = body.emailBodyText;
    if (body.inAppTitle !== undefined) updateData.inAppTitle = body.inAppTitle;
    if (body.inAppBody !== undefined) updateData.inAppBody = body.inAppBody;
    if (body.smsBody !== undefined) updateData.smsBody = body.smsBody;
    if (body.pushTitle !== undefined) updateData.pushTitle = body.pushTitle;
    if (body.pushBody !== undefined) updateData.pushBody = body.pushBody;
    if (body.availableVariables !== undefined) updateData.availableVariables = body.availableVariables;
    if (body.isActive !== undefined) updateData.isActive = body.isActive;

    const updated = repo.merge(template, updateData);
    return repo.save(updated);
  }

  @Delete('templates/:id')
  async deleteTemplate(@Query('id') id: string, @Req() req: any) {
    const ctx: RequestContext = req.context || req.user;
    // Access check done by RolesGuard

    const repo = await this.tenantDb.getRepository<NotificationTemplate>(
      ctx.tenantId,
      NotificationTemplate,
    );
    const template = await repo.findOne({ where: { id } });

    if (!template) {
      throw new NotFoundException('Notification template not found');
    }

    if (template.isSystem) {
      throw new ForbiddenException('Cannot delete system templates');
    }

    await repo.remove(template);
    return { success: true };
  }

  // ========== Notification Channels ==========

  @Get('channels')
  async listChannels(@Query('type') channelType: string, @Req() req: any) {
    const ctx: RequestContext = req.context || req.user;
    // Access check done by RolesGuard

    const repo = await this.tenantDb.getRepository<NotificationChannel>(
      ctx.tenantId,
      NotificationChannel,
    );

    const where: any = { tenantId: ctx.tenantId };
    if (channelType) where.channelType = channelType;

    const channels = await repo.find({
      where,
      order: { channelType: 'ASC', code: 'ASC' },
    });

    return { items: channels };
  }

  @Get('channels/:id')
  async getChannel(@Query('id') id: string, @Req() req: any) {
    const ctx: RequestContext = req.context || req.user;
    // Access check done by RolesGuard

    const repo = await this.tenantDb.getRepository<NotificationChannel>(
      ctx.tenantId,
      NotificationChannel,
    );
    const channel = await repo.findOne({ where: { id, tenantId: ctx.tenantId } });

    if (!channel) {
      throw new NotFoundException('Notification channel not found');
    }

    return channel;
  }

  @Post('channels')
  async createChannel(@Body() body: CreateNotificationChannelDto, @Req() req: any) {
    const ctx: RequestContext = req.context || req.user;
    // Access check done by RolesGuard

    const repo = await this.tenantDb.getRepository<NotificationChannel>(
      ctx.tenantId,
      NotificationChannel,
    );

    // Check for duplicate code
    const existing = await repo.findOne({ where: { code: body.code, tenantId: ctx.tenantId } });
    if (existing) {
      throw new ForbiddenException(`Channel with code "${body.code}" already exists`);
    }

    const channel = repo.create({
      tenantId: ctx.tenantId,
      code: body.code,
      name: body.name,
      channelType: body.channelType,
      config: body.config,
      isDefault: body.isDefault || false,
      isActive: body.isActive !== false,
    });

    return repo.save(channel);
  }

  @Patch('channels/:id')
  async updateChannel(
    @Query('id') id: string,
    @Body() body: Partial<CreateNotificationChannelDto>,
    @Req() req: any,
  ) {
    const ctx: RequestContext = req.context || req.user;
    // Access check done by RolesGuard

    const repo = await this.tenantDb.getRepository<NotificationChannel>(
      ctx.tenantId,
      NotificationChannel,
    );
    const channel = await repo.findOne({ where: { id, tenantId: ctx.tenantId } });

    if (!channel) {
      throw new NotFoundException('Notification channel not found');
    }

    const updated = repo.merge(channel, body);
    return repo.save(updated);
  }

  @Delete('channels/:id')
  async deleteChannel(@Query('id') id: string, @Req() req: any) {
    const ctx: RequestContext = req.context || req.user;
    // Access check done by RolesGuard

    const repo = await this.tenantDb.getRepository<NotificationChannel>(
      ctx.tenantId,
      NotificationChannel,
    );
    const channel = await repo.findOne({ where: { id, tenantId: ctx.tenantId } });

    if (!channel) {
      throw new NotFoundException('Notification channel not found');
    }

    await repo.remove(channel);
    return { success: true };
  }

  // ========== Notification Delivery Logs ==========

  @Get('deliveries')
  async listDeliveries(
    @Query('templateCode') templateCode: string,
    @Query('channel') channel: string,
    @Query('status') status: string,
    @Query('limit') limit: string,
    @Query('offset') offset: string,
    @Req() req: any,
  ) {
    const ctx: RequestContext = req.context || req.user;
    // Access check done by RolesGuard

    const repo = await this.tenantDb.getRepository<NotificationDelivery>(
      ctx.tenantId,
      NotificationDelivery,
    );

    const where: any = { tenantId: ctx.tenantId };
    if (templateCode) where.templateCode = templateCode;
    if (channel) where.channel = channel;
    if (status) where.status = status;

    const deliveries = await repo.find({
      where,
      order: { createdAt: 'DESC' },
      take: parseInt(limit, 10) || 50,
      skip: parseInt(offset, 10) || 0,
    });

    return { items: deliveries };
  }

  @Get('deliveries/:id')
  async getDelivery(@Query('id') id: string, @Req() req: any) {
    const ctx: RequestContext = req.context || req.user;
    // Access check done by RolesGuard

    const repo = await this.tenantDb.getRepository<NotificationDelivery>(
      ctx.tenantId,
      NotificationDelivery,
    );
    const delivery = await repo.findOne({ where: { id, tenantId: ctx.tenantId } });

    if (!delivery) {
      throw new NotFoundException('Notification delivery not found');
    }

    return delivery;
  }

  // ========== In-App Notifications ==========

  @Get('in-app')
  async listInAppNotifications(
    @Query('userId') userId: string,
    @Query('read') read: string,
    @Query('limit') limit: string,
    @Req() req: any,
  ) {
    const ctx: RequestContext = req.context || req.user;
    // Access check done by RolesGuard

    const repo = await this.tenantDb.getRepository<InAppNotification>(
      ctx.tenantId,
      InAppNotification,
    );

    const where: any = { tenantId: ctx.tenantId };
    if (userId) where.userId = userId;
    if (read !== undefined) where.isRead = read === 'true';

    const notifications = await repo.find({
      where,
      order: { createdAt: 'DESC' },
      take: parseInt(limit, 10) || 50,
    });

    return { items: notifications };
  }

  // ========== Test Notifications ==========

  @Post('templates/:id/test')
  async testTemplate(
    @Query('id') id: string,
    @Body() body: { recipientEmail?: string; testData?: Record<string, any> },
    @Req() req: any,
  ) {
    const ctx: RequestContext = req.context || req.user;
    // Access check done by RolesGuard

    const templateRepo = await this.tenantDb.getRepository<NotificationTemplate>(
      ctx.tenantId,
      NotificationTemplate,
    );
    const template = await templateRepo.findOne({ where: { id } });

    if (!template) {
      throw new NotFoundException('Notification template not found');
    }

    // Simulate rendering the template with test data
    const testData = body.testData || {
      workOrder: {
        id: 'test-wo-001',
        number: 'WO-2024-001',
        description: 'Test Work Order',
        priority: 'High',
        status: 'Open',
        dueDate: new Date().toISOString(),
      },
      assignee: {
        firstName: 'Test',
        lastName: 'User',
        email: body.recipientEmail || 'test@example.com',
      },
      appUrl: 'https://app.example.com',
    };

    // Simple template variable replacement
    const renderTemplate = (templateStr: string | undefined, data: Record<string, any>): string => {
      if (!templateStr) return '';
      return templateStr.replace(/\{\{([^}]+)\}\}/g, (match, path) => {
        const cleanPath = path.trim().split('|')[0].trim();
        const parts = cleanPath.split('.');
        let value: any = data;
        for (const part of parts) {
          if (value && typeof value === 'object' && part in value) {
            value = value[part];
          } else {
            return match;
          }
        }
        return String(value);
      });
    };

    const renderedTemplates: Record<string, any> = {};

    if (template.supportedChannels?.includes('email')) {
      renderedTemplates.email = {
        subject: renderTemplate(template.emailSubject, testData),
        bodyHtml: renderTemplate(template.emailBodyHtml, testData),
        bodyText: renderTemplate(template.emailBodyText, testData),
      };
    }

    if (template.supportedChannels?.includes('in_app')) {
      renderedTemplates.in_app = {
        title: renderTemplate(template.inAppTitle, testData),
        body: renderTemplate(template.inAppBody, testData),
      };
    }

    if (template.supportedChannels?.includes('sms')) {
      renderedTemplates.sms = {
        body: renderTemplate(template.smsBody, testData),
      };
    }

    if (template.supportedChannels?.includes('push')) {
      renderedTemplates.push = {
        title: renderTemplate(template.pushTitle, testData),
        body: renderTemplate(template.pushBody, testData),
      };
    }

    return {
      templateId: template.id,
      templateCode: template.code,
      supportedChannels: template.supportedChannels,
      renderedTemplates,
      testData,
      message: 'Template rendered successfully (not actually sent)',
    };
  }
}
