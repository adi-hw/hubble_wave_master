import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Cron, CronExpression } from '@nestjs/schedule';
import { createHash } from 'crypto';
import { In, MoreThan, Repository } from 'typeorm';
import {
  AuditLog,
  InAppNotification,
  NotificationHistory,
  NotificationQueue,
  NotificationTemplate,
  NotificationChannel,
  NotificationQueueStatus,
  User,
  UserNotificationPreferences,
} from '@hubblewave/instance-db';
import { TemplateEngineService } from './template-engine.service';
import { ChannelProviderRegistry } from './channel-providers';

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
  correlationId?: string | null;
};

const IDEMPOTENCY_WINDOW_HOURS_DEFAULT = 24;

@Injectable()
export class NotificationService {
  private readonly idempotencyWindowMs: number;
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
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    private readonly templateEngine: TemplateEngineService,
    private readonly providers: ChannelProviderRegistry,
  ) {
    const configured = parseInt(process.env.NOTIFY_IDEMPOTENCY_WINDOW_HOURS || '', 10);
    const hours = Number.isFinite(configured) && configured > 0
      ? configured
      : IDEMPOTENCY_WINDOW_HOURS_DEFAULT;
    this.idempotencyWindowMs = hours * 60 * 60 * 1000;
  }

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

    // Validate every recipient resolves to an existing user before queueing.
    if (request.recipients && request.recipients.length > 0) {
      const existingUsers = await this.userRepo.find({
        where: { id: In(request.recipients) },
        select: ['id'],
      });
      const existingIds = new Set(existingUsers.map((u) => u.id));
      for (const recipientId of request.recipients) {
        if (!existingIds.has(recipientId)) {
          throw new BadRequestException(`Unknown recipient: ${recipientId}`);
        }
      }
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
      const idempotencyKey = this.computeIdempotencyKey({
        templateCode: template.code,
        recipientId,
        context: request.data || {},
        correlationId: request.correlationId || null,
      });

      const existing = await this.findRecentByIdempotencyKey(idempotencyKey);
      if (existing) {
        results.push(existing);
        continue;
      }

      const context = {
        ...(request.data || {}),
        _renderedSubject: rendered.subject,
        _renderedBody: rendered.body,
        _renderedBodyHtml: rendered.bodyHtml,
      };

      const queueEntry = this.queueRepo.create({
        templateId: template.id,
        recipientId,
        channels: allowedChannels,
        context,
        scheduledFor: request.scheduledFor,
        priority: request.priority || 'medium',
        status: 'pending',
        idempotencyKey,
      } as Partial<NotificationQueue>);

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

  private computeIdempotencyKey(parts: {
    templateCode: string;
    recipientId: string;
    context: Record<string, unknown>;
    correlationId: string | null;
  }): string {
    const sortedContext = JSON.stringify(parts.context, Object.keys(parts.context).sort());
    const material = [
      parts.templateCode,
      parts.recipientId,
      sortedContext,
      parts.correlationId ?? '',
    ].join('|');
    return createHash('sha256').update(material).digest('hex');
  }

  private async findRecentByIdempotencyKey(key: string): Promise<NotificationQueue | null> {
    const cutoff = new Date(Date.now() - this.idempotencyWindowMs);
    return this.queueRepo.findOne({
      where: {
        idempotencyKey: key,
        createdAt: MoreThan(cutoff),
      },
      order: { createdAt: 'DESC' },
    });
  }

  @Cron(CronExpression.EVERY_10_SECONDS)
  async processQueue(): Promise<void> {
    const pending = await this.queueRepo.find({
      where: { status: 'pending' },
      order: { createdAt: 'ASC' },
      take: 50,
    });

    for (const item of pending) {
      const outcome = await this.deliver(item);
      item.processedAt = new Date();
      if (outcome.failedChannels.length === 0) {
        // Every channel reported success.
        item.status = 'sent';
        item.lastError = null as unknown as string;
      } else if (outcome.sentChannels.length === 0) {
        // No channel made it through. Either retry-eligible or terminal,
        // depending on the existing retry/backoff helper.
        item.status = this.handleDeliveryError(item);
        item.lastError = outcome.failedChannels[0]?.error ?? 'delivery failed';
      } else {
        // Mixed outcome: at least one channel delivered, at least one
        // failed. Record as 'failed' with summary so the operator can
        // see partial state in the queue dashboard. The history rows
        // carry the per-channel truth.
        item.status = 'failed';
        item.lastError = outcome.failedChannels
          .map((f) => `${f.channel}: ${f.error}`)
          .join('; ');
      }
      await this.queueRepo.save(item);
    }
  }

  /**
   * Attempt delivery on every channel attached to `item`. Records one
   * NotificationHistory row per channel reflecting the actual outcome:
   * `sentAt`+`deliveredAt` on success, `failedAt`+`errorMessage` on
   * failure. Returns aggregate channel outcomes so processQueue can
   * decide the queue-level status. NEVER reports success without a
   * provider actually accepting the payload — that was the audit
   * finding that motivated this rewrite.
   */
  private async deliver(
    item: NotificationQueue,
  ): Promise<{
    sentChannels: NotificationChannel[];
    failedChannels: { channel: NotificationChannel; error: string }[];
  }> {
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
    const renderedBodyHtml =
      typeof context['_renderedBodyHtml'] === 'string'
        ? (context['_renderedBodyHtml'] as string)
        : undefined;

    // Recipient lookup — providers need email/phone for the channels they
    // serve. Failure to find the recipient is itself a per-channel
    // failure (the in_app channel only needs the userId).
    const recipient = await this.userRepo.findOne({
      where: { id: item.recipientId },
    });

    const sentChannels: NotificationChannel[] = [];
    const failedChannels: { channel: NotificationChannel; error: string }[] = [];

    for (const channel of item.channels || []) {
      const history = this.historyRepo.create({
        notificationQueueId: item.id,
        channel,
        recipientId: item.recipientId,
      });

      try {
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
          history.providerId = 'in_app';
        } else {
          const provider = this.providers.for(channel);
          if (!provider) {
            // Fail closed. Earlier code silently fell through here and
            // the queue item was still marked `sent` — that was the
            // canonical silent-drop bug.
            throw new Error(
              `No provider configured for channel '${channel}'. ` +
                `Configure the channel's adapter (e.g. SMTP_HOST for email) ` +
                `or remove the channel from the template's supportedChannels.`,
            );
          }
          const result = await provider.send({
            recipientId: item.recipientId,
            recipientEmail: recipient?.email ?? null,
            recipientPhone:
              (recipient as unknown as { phone?: string })?.phone ?? null,
            subject: renderedSubject || template?.emailSubject,
            body: renderedBody || template?.emailBodyText || template?.smsBody,
            bodyHtml: renderedBodyHtml || template?.emailBodyHtml,
          });
          if (result.providerId) history.providerId = result.providerId;
          if (result.providerResponse)
            history.providerResponse = result.providerResponse;
        }
        history.sentAt = new Date();
        history.deliveredAt = history.sentAt;
        await this.historyRepo.save(history);
        sentChannels.push(channel);
      } catch (error) {
        const sanitized = this.redactProviderError(error, channel);
        history.failedAt = new Date();
        history.errorMessage = sanitized.message;
        await this.historyRepo.save(history);
        failedChannels.push({ channel, error: sanitized.message });
      }
    }

    return { sentChannels, failedChannels };
  }

  /**
   * Strip credential-like keys from an SDK error before re-throwing. Provider
   * SDKs (SES, SendGrid, Twilio, FCM) sometimes include the full request
   * envelope — including auth headers and signing keys — on failure. Logging
   * those values would leak secrets, so we sanitize before propagating.
   */
  private redactProviderError(error: unknown, channel: NotificationChannel): Error {
    const credentialPattern = /auth(?:orization)?|api[_-]?key|password|token|secret/i;
    const baseMessage = error instanceof Error ? error.message : String(error);
    const sanitizedMessage = baseMessage.replace(
      /(auth(?:orization)?|api[_-]?key|password|token|secret)\s*[:=]\s*["']?[^"'\s,}]+["']?/gi,
      '$1=[REDACTED]',
    );

    const wrapped = new Error(`[${channel}] ${sanitizedMessage}`);
    if (error && typeof error === 'object') {
      const original = error as Record<string, unknown>;
      const safeMeta: Record<string, unknown> = {};
      for (const [key, value] of Object.entries(original)) {
        if (key === 'message' || key === 'stack') continue;
        if (credentialPattern.test(key)) {
          safeMeta[key] = '[REDACTED]';
          continue;
        }
        if (value && typeof value === 'object') {
          safeMeta[key] = this.redactObject(value as Record<string, unknown>, credentialPattern);
        } else {
          safeMeta[key] = value;
        }
      }
      (wrapped as unknown as { meta: Record<string, unknown> }).meta = safeMeta;
    }
    return wrapped;
  }

  private redactObject(
    obj: Record<string, unknown>,
    pattern: RegExp,
  ): Record<string, unknown> {
    const result: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(obj)) {
      if (pattern.test(key)) {
        result[key] = '[REDACTED]';
      } else if (value && typeof value === 'object') {
        result[key] = this.redactObject(value as Record<string, unknown>, pattern);
      } else {
        result[key] = value;
      }
    }
    return result;
  }

  private renderTemplate(template: NotificationTemplate, data: Record<string, unknown>) {
    // Subjects, SMS, push, in-app, plaintext email never reach an HTML sink, so
    // they are rendered with the text engine. emailBodyHtml is rendered with
    // the HTML engine, which escapes interpolated values to prevent injection
    // when recipient-supplied data flows through.
    const subject = this.templateEngine.renderText(
      template.emailSubject || template.inAppTitle || template.pushTitle || '',
      data
    );
    const body = this.templateEngine.renderText(
      template.emailBodyText || template.inAppBody || template.smsBody || template.pushBody || '',
      data
    );
    const bodyHtml = template.emailBodyHtml
      ? this.templateEngine.renderHtml(template.emailBodyHtml, data)
      : undefined;
    return { subject, body, bodyHtml };
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
