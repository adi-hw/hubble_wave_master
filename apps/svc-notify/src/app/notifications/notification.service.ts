import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Cron, CronExpression } from '@nestjs/schedule';
import { Repository } from 'typeorm';
import {
  AuditLog,
  InAppNotification,
  NotificationHistory,
  NotificationQueue,
  NotificationTemplate,
  NotificationChannel,
  NotificationQueueStatus,
  UserNotificationPreferences,
} from '@hubblewave/instance-db';
import { TemplateEngineService } from './template-engine.service';

export type NotificationTemplateInput = {
  name: string;
  code: string;
  description?: string;
  category?: string;
  emailSubject?: string;
  emailBodyHtml?: string;
  emailBodyText?: string;
  smsBody?: string;
  pushTitle?: string;
  pushBody?: string;
  inAppTitle?: string;
  inAppBody?: string;
  supportedChannels?: NotificationChannel[];
};

export type SendNotificationRequest = {
  templateCode?: string;
  templateId?: string;
  recipients: string[];
  data?: Record<string, unknown>;
  channels?: NotificationChannel[];
  priority?: 'low' | 'medium' | 'high' | 'urgent';
  scheduledFor?: Date;
  actorId?: string | null;
};

@Injectable()
export class NotificationService {
  constructor(
    @InjectRepository(NotificationTemplate)
    private readonly templateRepo: Repository<NotificationTemplate>,
    @InjectRepository(NotificationQueue)
    private readonly queueRepo: Repository<NotificationQueue>,
    @InjectRepository(NotificationHistory)
    private readonly historyRepo: Repository<NotificationHistory>,
    @InjectRepository(InAppNotification)
    private readonly inAppRepo: Repository<InAppNotification>,
    @InjectRepository(UserNotificationPreferences)
    private readonly preferenceRepo: Repository<UserNotificationPreferences>,
    @InjectRepository(AuditLog)
    private readonly auditRepo: Repository<AuditLog>,
    private readonly templateEngine: TemplateEngineService,
  ) {}

  async listTemplates() {
    return this.templateRepo.find({ order: { updatedAt: 'DESC' } });
  }

  async getTemplate(id: string) {
    const template = await this.templateRepo.findOne({ where: { id } });
    if (!template) {
      throw new NotFoundException('Notification template not found');
    }
    return template;
  }

  async createTemplate(input: NotificationTemplateInput, actorId?: string) {
    if (!input.name || input.name.trim().length === 0) {
      throw new BadRequestException('template.name is required');
    }
    if (!input.code || !this.isValidCode(input.code)) {
      throw new BadRequestException('template.code must be lowercase letters, numbers, or underscore');
    }

    const existing = await this.templateRepo.findOne({ where: { code: input.code } });
    if (existing) {
      throw new ConflictException('Template code already exists');
    }

    const template = this.templateRepo.create({
      name: input.name.trim(),
      code: input.code.trim(),
      description: input.description?.trim(),
      category: input.category || 'general',
      emailSubject: input.emailSubject,
      emailBodyHtml: input.emailBodyHtml,
      emailBodyText: input.emailBodyText,
      smsBody: input.smsBody,
      pushTitle: input.pushTitle,
      pushBody: input.pushBody,
      inAppTitle: input.inAppTitle,
      inAppBody: input.inAppBody,
      supportedChannels: input.supportedChannels && input.supportedChannels.length > 0
        ? input.supportedChannels
        : ['email', 'in_app'],
      isActive: true,
      createdBy: actorId || undefined,
      updatedBy: actorId || undefined,
    } as Partial<NotificationTemplate>);

    const saved = await this.templateRepo.save(template);
    await this.writeAudit({
      actorId,
      action: 'notification.template.create',
      recordId: saved.id,
      newValues: { code: saved.code, name: saved.name },
    });
    return saved;
  }

  async updateTemplate(id: string, input: NotificationTemplateInput, actorId?: string) {
    const template = await this.getTemplate(id);
    const previous = { code: template.code, name: template.name };

    if (input.name !== undefined && input.name.trim().length === 0) {
      throw new BadRequestException('template.name is required');
    }

    template.name = input.name?.trim() || template.name;
    template.description = input.description?.trim() || template.description;
    template.category = input.category || template.category;
    template.emailSubject = input.emailSubject ?? template.emailSubject;
    template.emailBodyHtml = input.emailBodyHtml ?? template.emailBodyHtml;
    template.emailBodyText = input.emailBodyText ?? template.emailBodyText;
    template.smsBody = input.smsBody ?? template.smsBody;
    template.pushTitle = input.pushTitle ?? template.pushTitle;
    template.pushBody = input.pushBody ?? template.pushBody;
    template.inAppTitle = input.inAppTitle ?? template.inAppTitle;
    template.inAppBody = input.inAppBody ?? template.inAppBody;
    template.supportedChannels =
      input.supportedChannels && input.supportedChannels.length > 0
        ? input.supportedChannels
        : template.supportedChannels;
    template.updatedBy = actorId || undefined;

    const saved = await this.templateRepo.save(template);
    await this.writeAudit({
      actorId,
      action: 'notification.template.update',
      recordId: saved.id,
      oldValues: previous,
      newValues: { code: saved.code, name: saved.name },
    });
    return saved;
  }

  async send(request: SendNotificationRequest) {
    const template = request.templateId
      ? await this.templateRepo.findOne({ where: { id: request.templateId, isActive: true } })
      : await this.templateRepo.findOne({
          where: { code: request.templateCode, isActive: true },
        });

    if (!template) {
      throw new NotFoundException('Template not found');
    }

    const channels = request.channels && request.channels.length > 0
      ? request.channels
      : template.supportedChannels;

    const results: NotificationQueue[] = [];
    for (const recipientId of request.recipients) {
      const allowedChannels = await this.filterChannelsForUser(recipientId, channels, template.category);
      if (allowedChannels.length === 0) {
        continue;
      }

      const rendered = this.renderTemplate(template, request.data || {});
      const context = {
        ...(request.data || {}),
        _renderedSubject: rendered.subject,
        _renderedBody: rendered.body,
      };

      const queueEntry = this.queueRepo.create({
        templateId: template.id,
        recipientId,
        channels: allowedChannels,
        context,
        scheduledFor: request.scheduledFor,
        priority: request.priority || 'medium',
        status: 'pending',
      });

      const saved = await this.queueRepo.save(queueEntry);
      results.push(saved);

      await this.writeAudit({
        actorId: request.actorId || null,
        action: 'notification.queue',
        recordId: saved.id,
        newValues: {
          templateCode: template.code,
          recipientId,
          channels: allowedChannels,
        },
      });
    }

    return results;
  }

  @Cron(CronExpression.EVERY_10_SECONDS)
  async processQueue(): Promise<void> {
    const pending = await this.queueRepo.find({
      where: { status: 'pending' },
      order: { createdAt: 'ASC' },
      take: 50,
    });

    for (const item of pending) {
      try {
        await this.deliver(item);
        item.status = 'sent';
        item.processedAt = new Date();
      } catch (error) {
        item.status = this.handleDeliveryError(item);
        item.lastError = (error as Error).message;
      }
      await this.queueRepo.save(item);
    }
  }

  private async deliver(item: NotificationQueue) {
    const template = item.templateId
      ? await this.templateRepo.findOne({ where: { id: item.templateId } })
      : null;
    const context = (item.context || {}) as Record<string, unknown>;
    const renderedSubject =
      typeof context['_renderedSubject'] === 'string'
        ? (context['_renderedSubject'] as string)
        : undefined;
    const renderedBody =
      typeof context['_renderedBody'] === 'string'
        ? (context['_renderedBody'] as string)
        : undefined;

    for (const channel of item.channels || []) {
      const history = this.historyRepo.create({
        notificationQueueId: item.id,
        channel,
        recipientId: item.recipientId,
        sentAt: new Date(),
      });
      await this.historyRepo.save(history);

      if (channel === 'in_app') {
        await this.inAppRepo.save(
          this.inAppRepo.create({
            userId: item.recipientId,
            title: renderedSubject || template?.inAppTitle || 'Notification',
            body: renderedBody || template?.inAppBody || '',
            priority: item.priority,
            read: false,
          })
        );
      }
    }
  }

  private renderTemplate(template: NotificationTemplate, data: Record<string, unknown>) {
    const subject = this.templateEngine.render(
      template.emailSubject || template.inAppTitle || template.pushTitle || '',
      data
    );
    const body = this.templateEngine.render(
      template.emailBodyText || template.inAppBody || template.smsBody || template.pushBody || '',
      data
    );
    return { subject, body };
  }

  private handleDeliveryError(item: NotificationQueue): NotificationQueueStatus {
    item.attempts = (item.attempts || 0) + 1;
    if (item.attempts < item.maxAttempts) {
      return 'pending';
    }
    return 'failed';
  }

  private async filterChannelsForUser(
    userId: string,
    channels: NotificationChannel[],
    category: string
  ): Promise<NotificationChannel[]> {
    const prefs = await this.preferenceRepo.findOne({ where: { userId } });
    if (!prefs) {
      return channels;
    }

    const allowedByCategory = prefs.preferences?.[category];
    const filtered = allowedByCategory && allowedByCategory.length > 0
      ? channels.filter((channel) => allowedByCategory.includes(channel))
      : channels;

    return filtered.filter((channel) => {
      if (channel === 'email') return prefs.emailEnabled;
      if (channel === 'sms') return prefs.smsEnabled;
      if (channel === 'push') return prefs.pushEnabled;
      if (channel === 'in_app') return prefs.inAppEnabled;
      return true;
    });
  }

  private isValidCode(code: string): boolean {
    return /^[a-z0-9_]+$/.test(code) && code.length <= 120;
  }

  private async writeAudit(params: {
    actorId?: string | null;
    action: string;
    recordId?: string | null;
    oldValues?: Record<string, unknown> | null;
    newValues?: Record<string, unknown> | null;
  }) {
    await this.auditRepo.save(
      this.auditRepo.create({
        userId: params.actorId || null,
        action: params.action,
        collectionCode: 'notification_queue',
        recordId: params.recordId || null,
        oldValues: params.oldValues ?? null,
        newValues: params.newValues ?? null,
      })
    );
  }
}
