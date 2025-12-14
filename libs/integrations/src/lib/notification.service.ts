import { Injectable, Logger } from '@nestjs/common';
import { EventEmitter2, OnEvent } from '@nestjs/event-emitter';
import {
  TenantDbService,
  NotificationTemplate,
  NotificationChannel,
  NotificationDelivery,
  InAppNotification,
} from '@eam-platform/tenant-db';
import { IsNull } from 'typeorm';

export interface SendNotificationRequest {
  tenantId: string;
  templateCode: string;
  recipients: NotificationRecipient[];
  data: Record<string, unknown>;
  channels?: string[];
  scheduledAt?: Date;
  triggerType?: 'workflow' | 'approval' | 'subscription' | 'direct';
  triggerReferenceId?: string;
}

export interface NotificationRecipient {
  userId?: string;
  email?: string;
  phone?: string;
  name?: string;
}

export interface NotificationResult {
  success: boolean;
  deliveryIds: string[];
  errors: { recipient: NotificationRecipient; error: string }[];
}

export interface ChannelProvider {
  send(delivery: NotificationDelivery): Promise<{ success: boolean; externalId?: string; error?: string }>;
}

@Injectable()
export class NotificationService {
  private readonly logger = new Logger(NotificationService.name);
  private channelProviders: Map<string, ChannelProvider> = new Map();

  constructor(
    private readonly tenantDb: TenantDbService,
    private readonly eventEmitter: EventEmitter2
  ) {
    // Register built-in providers
    this.registerProvider('email', new EmailProvider());
    this.registerProvider('in_app', new InAppProvider(this.tenantDb));
    this.registerProvider('sms', new SmsProvider());
    this.registerProvider('push', new PushProvider());
    this.registerProvider('webhook', new WebhookProvider());
  }

  /**
   * Register a channel provider
   */
  registerProvider(channelType: string, provider: ChannelProvider): void {
    this.channelProviders.set(channelType, provider);
  }

  /**
   * Send notification to recipients
   */
  async send(request: SendNotificationRequest): Promise<NotificationResult> {
    const result: NotificationResult = {
      success: true,
      deliveryIds: [],
      errors: [],
    };

    try {
      const dataSource = await this.tenantDb.getDataSource(request.tenantId);
      const templateRepo = dataSource.getRepository(NotificationTemplate);
      const channelRepo = dataSource.getRepository(NotificationChannel);
      const deliveryRepo = dataSource.getRepository(NotificationDelivery);

      // Find template
      const template = await templateRepo.findOne({
        where: [
          { tenantId: request.tenantId, code: request.templateCode, isActive: true },
          { tenantId: IsNull(), code: request.templateCode, isActive: true },
        ],
      });

      if (!template) {
        throw new Error(`Template not found: ${request.templateCode}`);
      }

      // Determine channels to use
      const channels = request.channels || template.supportedChannels;

      // Get channel configurations
      const channelConfigs = await channelRepo.find({
        where: { tenantId: request.tenantId, isActive: true },
      });

      // Create deliveries for each recipient and channel
      for (const recipient of request.recipients) {
        for (const channel of channels) {
          try {
            // Find channel config
            const channelConfig = channelConfigs.find(
              (c) => c.channelType === channel && (c.isDefault || channelConfigs.filter((x) => x.channelType === channel).length === 1)
            ) || channelConfigs.find((c) => c.channelType === channel);

            // Render content
            const rendered = this.renderTemplate(template, channel, request.data);

            // Create delivery record
            const delivery = deliveryRepo.create({
              tenantId: request.tenantId,
              triggerType: request.triggerType || 'direct',
              triggerReferenceId: request.triggerReferenceId,
              templateId: template.id,
              templateCode: template.code,
              recipientId: recipient.userId,
              recipientEmail: recipient.email,
              recipientPhone: recipient.phone,
              channel,
              channelConfigId: channelConfig?.id,
              subject: rendered.subject,
              body: rendered.body,
              htmlBody: rendered.htmlBody,
              contextData: request.data as Record<string, any>,
              status: request.scheduledAt ? 'pending' : 'queued',
              scheduledAt: request.scheduledAt || new Date(),
            });

            await deliveryRepo.save(delivery);
            result.deliveryIds.push(delivery.id);

            // If not scheduled, send immediately
            if (!request.scheduledAt) {
              this.processDelivery(request.tenantId, delivery.id);
            }
          } catch (error: any) {
            result.errors.push({ recipient, error: error.message });
            result.success = false;
          }
        }
      }
    } catch (error: any) {
      this.logger.error(`Notification send failed: ${error.message}`, error.stack);
      result.success = false;
      result.errors.push({ recipient: request.recipients[0], error: error.message });
    }

    return result;
  }

  /**
   * Process a delivery (send to channel provider)
   */
  async processDelivery(tenantId: string, deliveryId: string): Promise<void> {
    try {
      const dataSource = await this.tenantDb.getDataSource(tenantId);
      const deliveryRepo = dataSource.getRepository(NotificationDelivery);

      const delivery = await deliveryRepo.findOne({
        where: { id: deliveryId },
        relations: ['channelConfig'],
      });

      if (!delivery) {
        this.logger.warn(`Delivery not found: ${deliveryId}`);
        return;
      }

      // Update status to sending
      delivery.status = 'sending';
      await deliveryRepo.save(delivery);

      // Get provider
      const provider = this.channelProviders.get(delivery.channel);
      if (!provider) {
        throw new Error(`No provider for channel: ${delivery.channel}`);
      }

      // Send
      const result = await provider.send(delivery);

      if (result.success) {
        delivery.status = 'sent';
        delivery.sentAt = new Date();
        delivery.externalMessageId = result.externalId;
      } else {
        delivery.status = 'failed';
        delivery.failedAt = new Date();
        delivery.failureReason = result.error;
        delivery.retryCount += 1;
      }

      await deliveryRepo.save(delivery);

      // Emit event
      this.eventEmitter.emit('notification.delivered', {
        tenantId,
        deliveryId,
        status: delivery.status,
        channel: delivery.channel,
      });
    } catch (error: any) {
      this.logger.error(`Delivery processing failed: ${error.message}`, error.stack);
    }
  }

  /**
   * Render template with data
   */
  private renderTemplate(
    template: NotificationTemplate,
    channel: string,
    data: Record<string, unknown>
  ): { subject?: string; body?: string; htmlBody?: string } {
    const interpolate = (text: string | undefined | null): string | undefined => {
      if (!text) return undefined;
      return text.replace(/\{\{(\w+(?:\.\w+)*)\}\}/g, (_, path) => {
        const value = this.getNestedValue(data, path);
        return value !== undefined ? String(value) : '';
      });
    };

    switch (channel) {
      case 'email':
        return {
          subject: interpolate(template.emailSubject),
          body: interpolate(template.emailBodyText),
          htmlBody: interpolate(template.emailBodyHtml),
        };
      case 'in_app':
        return {
          subject: interpolate(template.inAppTitle),
          body: interpolate(template.inAppBody),
        };
      case 'sms':
        return {
          body: interpolate(template.smsBody),
        };
      case 'push':
        return {
          subject: interpolate(template.pushTitle),
          body: interpolate(template.pushBody),
        };
      default:
        return {
          subject: interpolate(template.emailSubject || template.inAppTitle),
          body: interpolate(template.emailBodyText || template.inAppBody),
        };
    }
  }

  /**
   * Get nested value from object
   */
  private getNestedValue(obj: Record<string, unknown>, path: string): unknown {
    const parts = path.split('.');
    let current: unknown = obj;

    for (const part of parts) {
      if (current === null || current === undefined) return undefined;
      if (typeof current !== 'object') return undefined;
      current = (current as Record<string, unknown>)[part];
    }

    return current;
  }

  /**
   * Process scheduled deliveries (called by cron job)
   */
  async processScheduledDeliveries(tenantId: string): Promise<number> {
    const dataSource = await this.tenantDb.getDataSource(tenantId);
    const deliveryRepo = dataSource.getRepository(NotificationDelivery);

    const pendingDeliveries = await deliveryRepo.find({
      where: {
        tenantId,
        status: 'pending',
      },
      order: { scheduledAt: 'ASC' },
      take: 100,
    });

    const dueDeliveries = pendingDeliveries.filter(
      (d) => d.scheduledAt <= new Date()
    );

    for (const delivery of dueDeliveries) {
      await this.processDelivery(tenantId, delivery.id);
    }

    return dueDeliveries.length;
  }

  /**
   * Retry failed deliveries
   */
  async retryFailedDeliveries(tenantId: string, maxRetries = 3): Promise<number> {
    const dataSource = await this.tenantDb.getDataSource(tenantId);
    const deliveryRepo = dataSource.getRepository(NotificationDelivery);

    const failedDeliveries = await deliveryRepo
      .createQueryBuilder('d')
      .where('d.tenant_id = :tenantId', { tenantId })
      .andWhere('d.status = :status', { status: 'failed' })
      .andWhere('d.retry_count < :maxRetries', { maxRetries })
      .andWhere('d.failed_at < :cutoff', { cutoff: new Date(Date.now() - 5 * 60 * 1000) })
      .orderBy('d.failed_at', 'ASC')
      .take(50)
      .getMany();

    for (const delivery of failedDeliveries) {
      delivery.status = 'queued';
      await deliveryRepo.save(delivery);
      await this.processDelivery(tenantId, delivery.id);
    }

    return failedDeliveries.length;
  }

  // ============ Event Handlers ============

  @OnEvent('notification.process')
  async handleNotificationProcess(payload: any): Promise<void> {
    await this.send({
      tenantId: payload.tenantId,
      templateCode: payload.templateCode,
      recipients: payload.recipients.map((r: string) => ({ userId: r })),
      data: payload.data,
      channels: payload.channels,
      triggerType: payload.triggerType || 'workflow',
      triggerReferenceId: payload.triggerReferenceId,
    });
  }

  @OnEvent('notification.send')
  async handleNotificationSend(payload: any): Promise<void> {
    const recipients: NotificationRecipient[] = (payload.recipients || []).map((r: string | NotificationRecipient) => {
      if (typeof r === 'string') {
        return { userId: r };
      }
      return r;
    });

    await this.send({
      tenantId: payload.tenantId,
      templateCode: payload.templateCode,
      recipients,
      data: payload.data || {},
      channels: payload.channels,
      triggerType: 'workflow',
    });
  }
}

// ============ Channel Providers ============

class EmailProvider implements ChannelProvider {
  private readonly logger = new Logger(EmailProvider.name);

  async send(delivery: NotificationDelivery): Promise<{ success: boolean; externalId?: string; error?: string }> {
    // In production, integrate with email service (SendGrid, SES, etc.)
    this.logger.log(`[EMAIL] To: ${delivery.recipientEmail}, Subject: ${delivery.subject}`);

    // Simulate sending
    if (!delivery.recipientEmail) {
      return { success: false, error: 'No recipient email' };
    }

    // TODO: Integrate with actual email provider
    return { success: true, externalId: `email_${Date.now()}` };
  }
}

class InAppProvider implements ChannelProvider {
  constructor(private readonly tenantDb: TenantDbService) {}

  async send(delivery: NotificationDelivery): Promise<{ success: boolean; externalId?: string; error?: string }> {
    if (!delivery.recipientId) {
      return { success: false, error: 'No recipient user ID' };
    }

    try {
      const dataSource = await this.tenantDb.getDataSource(delivery.tenantId);
      const inAppRepo = dataSource.getRepository(InAppNotification);

      const notification = inAppRepo.create({
        tenantId: delivery.tenantId,
        userId: delivery.recipientId,
        title: delivery.subject || 'Notification',
        message: delivery.body || '',
        notificationType: 'system',
        isRead: false,
      });

      await inAppRepo.save(notification);

      return { success: true, externalId: notification.id };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  }
}

class SmsProvider implements ChannelProvider {
  private readonly logger = new Logger(SmsProvider.name);

  async send(delivery: NotificationDelivery): Promise<{ success: boolean; externalId?: string; error?: string }> {
    this.logger.log(`[SMS] To: ${delivery.recipientPhone}, Body: ${delivery.body?.substring(0, 50)}...`);

    if (!delivery.recipientPhone) {
      return { success: false, error: 'No recipient phone number' };
    }

    // TODO: Integrate with SMS provider (Twilio, etc.)
    return { success: true, externalId: `sms_${Date.now()}` };
  }
}

class PushProvider implements ChannelProvider {
  private readonly logger = new Logger(PushProvider.name);

  async send(delivery: NotificationDelivery): Promise<{ success: boolean; externalId?: string; error?: string }> {
    this.logger.log(`[PUSH] To: ${delivery.recipientId}, Title: ${delivery.subject}`);

    if (!delivery.recipientId) {
      return { success: false, error: 'No recipient user ID' };
    }

    // TODO: Integrate with push provider (Firebase, etc.)
    return { success: true, externalId: `push_${Date.now()}` };
  }
}

class WebhookProvider implements ChannelProvider {
  private readonly logger = new Logger(WebhookProvider.name);

  async send(delivery: NotificationDelivery): Promise<{ success: boolean; externalId?: string; error?: string }> {
    const config = delivery.channelConfig?.config;
    const url = config?.['url'] as string | undefined;

    if (!url) {
      return { success: false, error: 'No webhook URL configured' };
    }

    this.logger.log(`[WEBHOOK] To: ${url}`);

    try {
      const configHeaders = (config?.['headers'] || {}) as Record<string, string>;
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...configHeaders,
        },
        body: JSON.stringify({
          subject: delivery.subject,
          body: delivery.body,
          data: delivery.contextData,
          recipientId: delivery.recipientId,
          recipientEmail: delivery.recipientEmail,
        }),
      });

      if (!response.ok) {
        return { success: false, error: `HTTP ${response.status}` };
      }

      return { success: true, externalId: `webhook_${Date.now()}` };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  }
}
