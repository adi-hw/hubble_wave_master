import { Injectable, Logger, Inject, Optional, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EventEmitter2, OnEvent } from '@nestjs/event-emitter';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In, LessThan } from 'typeorm';
import {
  NotificationTemplate,
  NotificationChannel,
  NotificationDelivery,
  InAppNotification,
  UserNotificationPreferences,
} from '@hubblewave/instance-db';
import {
  ChannelProvider,
  EmailProvider,
  SmsProvider,
  PushProvider,
  InAppProvider,
  WebhookProvider,
} from './notification-providers';

export interface SendNotificationRequest {
  templateCode: string;
  recipients: NotificationRecipient[];
  data: Record<string, unknown>;
  channels?: string[];
  scheduledAt?: Date;
  triggerType?: 'process_flow' | 'approval' | 'subscription' | 'direct';
  triggerReferenceId?: string;
}

export interface NotificationRecipient {
  userId?: string;
  email?: string;
  phone?: string;
  name?: string;
  deviceTokens?: Array<{ token: string; platform: 'ios' | 'android' | 'web' }>;
}

export interface NotificationResult {
  success: boolean;
  deliveryIds: string[];
  errors: { recipient: NotificationRecipient; error: string }[];
}

@Injectable()
export class NotificationService implements OnModuleInit {
  private readonly logger = new Logger(NotificationService.name);
  private channelProviders: Map<string, ChannelProvider> = new Map();

  constructor(
    @InjectRepository(NotificationTemplate)
    private readonly templateRepo: Repository<NotificationTemplate>,
    @InjectRepository(NotificationChannel)
    private readonly channelRepo: Repository<NotificationChannel>,
    @InjectRepository(NotificationDelivery)
    private readonly deliveryRepo: Repository<NotificationDelivery>,
    @InjectRepository(InAppNotification)
    private readonly inAppRepo: Repository<InAppNotification>,
    @Optional()
    @InjectRepository(UserNotificationPreferences)
    private readonly userPrefsRepo: Repository<UserNotificationPreferences> | undefined,
    private readonly eventEmitter: EventEmitter2,
    private readonly configService: ConfigService,
    @Optional() @Inject('EMAIL_PROVIDER') emailProvider?: EmailProvider,
    @Optional() @Inject('SMS_PROVIDER') smsProvider?: SmsProvider,
    @Optional() @Inject('PUSH_PROVIDER') pushProvider?: PushProvider
  ) {
    // Register injected providers or create new ones
    this.registerProvider(
      'email',
      emailProvider || new EmailProvider(this.configService)
    );
    this.registerProvider(
      'sms',
      smsProvider || new SmsProvider(this.configService)
    );
    this.registerProvider(
      'push',
      pushProvider || new PushProvider(this.configService)
    );
    this.registerProvider('in_app', new InAppProvider(this.inAppRepo));
    this.registerProvider('webhook', new WebhookProvider());
  }

  async onModuleInit() {
    this.logger.log('NotificationService initialized with providers: ' +
      Array.from(this.channelProviders.keys()).join(', '));
  }

  /**
   * Register a channel provider
   */
  registerProvider(channelType: string, provider: ChannelProvider): void {
    this.channelProviders.set(channelType, provider);
    this.logger.debug(`Registered notification provider: ${channelType}`);
  }

  /**
   * Get a registered provider
   */
  getProvider(channelType: string): ChannelProvider | undefined {
    return this.channelProviders.get(channelType);
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
      // Find template
      const template = await this.templateRepo.findOne({
        where: [
          { code: request.templateCode, isActive: true },
        ],
      });

      if (!template) {
        throw new Error(`Template not found: ${request.templateCode}`);
      }

      // Determine channels to use
      const channels = request.channels || template.supportedChannels;

      // Get channel configurations
      const channelConfigs = await this.channelRepo.find({
        where: { isActive: true },
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

            // Create delivery record with device tokens in context
            const contextData = {
              ...request.data,
              ...(recipient.deviceTokens ? { deviceTokens: recipient.deviceTokens } : {}),
            };

            const delivery = this.deliveryRepo.create({
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
              contextData: contextData as Record<string, any>,
              status: request.scheduledAt ? 'pending' : 'queued',
              scheduledAt: request.scheduledAt || new Date(),
            });

            await this.deliveryRepo.save(delivery);
            result.deliveryIds.push(delivery.id);

            // If not scheduled, send immediately
            if (!request.scheduledAt) {
              this.processDelivery(delivery.id);
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
  async processDelivery(deliveryId: string): Promise<void> {
    try {
      const delivery = await this.deliveryRepo.findOne({
        where: { id: deliveryId },
        relations: ['channelConfig'],
      });

      if (!delivery) {
        this.logger.warn(`Delivery not found: ${deliveryId}`);
        return;
      }

      // Update status to sending
      delivery.status = 'sending';
      await this.deliveryRepo.save(delivery);

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

      await this.deliveryRepo.save(delivery);

      // Emit event
      this.eventEmitter.emit('notification.delivered', {
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
  async processScheduledDeliveries(): Promise<number> {
    const pendingDeliveries = await this.deliveryRepo.find({
      where: {
        status: 'pending',
      },
      order: { scheduledAt: 'ASC' },
      take: 100,
    });

    const dueDeliveries = pendingDeliveries.filter(
      (d) => d.scheduledAt <= new Date()
    );

    for (const delivery of dueDeliveries) {
      await this.processDelivery(delivery.id);
    }

    return dueDeliveries.length;
  }

  /**
   * Retry failed deliveries
   */
  async retryFailedDeliveries(maxRetries = 3): Promise<number> {
    const failedDeliveries = await this.deliveryRepo
      .createQueryBuilder('d')
      .where('d.status = :status', { status: 'failed' })
      .andWhere('d.retry_count < :maxRetries', { maxRetries })
      .andWhere('d.failed_at < :cutoff', { cutoff: new Date(Date.now() - 5 * 60 * 1000) })
      .orderBy('d.failed_at', 'ASC')
      .take(50)
      .getMany();

    for (const delivery of failedDeliveries) {
      delivery.status = 'queued';
      await this.deliveryRepo.save(delivery);
      await this.processDelivery(delivery.id);
    }

    return failedDeliveries.length;
  }

  // ============ Event Handlers ============

  @OnEvent('notification.process')
  async handleNotificationProcess(payload: any): Promise<void> {
    await this.send({
      templateCode: payload.templateCode,
      recipients: payload.recipients.map((r: string) => ({ userId: r })),
      data: payload.data,
      channels: payload.channels,
      triggerType: payload.triggerType || 'process_flow',
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
      templateCode: payload.templateCode,
      recipients,
      data: payload.data || {},
      channels: payload.channels,
      triggerType: 'process_flow',
    });
  }

  // ============ Digest Mode ============

  /**
   * Check if a user has digest mode enabled
   */
  async isDigestModeEnabled(userId: string): Promise<boolean> {
    if (!this.userPrefsRepo) {
      return false;
    }

    const prefs = await this.userPrefsRepo.findOne({
      where: { userId },
    });

    return prefs?.digestMode ?? false;
  }

  /**
   * Get user's digest preferences
   */
  async getUserDigestPreferences(userId: string): Promise<{
    enabled: boolean;
    frequency: 'daily' | 'weekly';
    time: string;
  } | null> {
    if (!this.userPrefsRepo) {
      return null;
    }

    const prefs = await this.userPrefsRepo.findOne({
      where: { userId },
    });

    if (!prefs) {
      return null;
    }

    return {
      enabled: prefs.digestMode,
      frequency: prefs.digestFrequency,
      time: prefs.digestTime,
    };
  }

  /**
   * Queue notification for digest instead of immediate send
   */
  async queueForDigest(
    userId: string,
    templateCode: string,
    data: Record<string, unknown>
  ): Promise<void> {
    // Create a pending delivery marked for digest
    const template = await this.templateRepo.findOne({
      where: { code: templateCode, isActive: true },
    });

    if (!template) {
      this.logger.warn(`Template not found for digest queue: ${templateCode}`);
      return;
    }

    const rendered = this.renderTemplate(template, 'email', data);

    const delivery = this.deliveryRepo.create({
      triggerType: 'subscription',
      templateId: template.id,
      templateCode: template.code,
      recipientId: userId,
      channel: 'email',
      subject: rendered.subject,
      body: rendered.body,
      htmlBody: rendered.htmlBody,
      contextData: data as Record<string, any>,
      status: 'digest_pending',
      scheduledAt: new Date(),
    });

    await this.deliveryRepo.save(delivery);
    this.logger.debug(`Queued notification for digest: ${userId}, ${templateCode}`);
  }

  /**
   * Process digest for users who have daily digest enabled
   * Called by cron job at appropriate times
   */
  async processDailyDigests(): Promise<number> {
    if (!this.userPrefsRepo) {
      this.logger.warn('UserNotificationPreferences repository not available');
      return 0;
    }

    const currentHour = new Date().getHours();
    const currentTime = `${String(currentHour).padStart(2, '0')}:00`;

    // Find users with daily digest at current hour
    const usersWithDigest = await this.userPrefsRepo.find({
      where: {
        digestMode: true,
        digestFrequency: 'daily',
      },
    });

    // Filter by digest time (approximate hour match)
    const usersToProcess = usersWithDigest.filter((u) => {
      const userHour = parseInt(u.digestTime.split(':')[0], 10);
      return userHour === currentHour;
    });

    let processed = 0;
    for (const userPref of usersToProcess) {
      const count = await this.sendDigestForUser(userPref.userId);
      if (count > 0) {
        processed++;
      }
    }

    this.logger.log(`Processed daily digests for ${processed} users at ${currentTime}`);
    return processed;
  }

  /**
   * Process weekly digests
   * Called by cron job on configured day
   */
  async processWeeklyDigests(): Promise<number> {
    if (!this.userPrefsRepo) {
      this.logger.warn('UserNotificationPreferences repository not available');
      return 0;
    }

    const currentHour = new Date().getHours();

    // Find users with weekly digest
    const usersWithDigest = await this.userPrefsRepo.find({
      where: {
        digestMode: true,
        digestFrequency: 'weekly',
      },
    });

    // Filter by digest time
    const usersToProcess = usersWithDigest.filter((u) => {
      const userHour = parseInt(u.digestTime.split(':')[0], 10);
      return userHour === currentHour;
    });

    let processed = 0;
    for (const userPref of usersToProcess) {
      const count = await this.sendDigestForUser(userPref.userId);
      if (count > 0) {
        processed++;
      }
    }

    this.logger.log(`Processed weekly digests for ${processed} users`);
    return processed;
  }

  /**
   * Send digest email for a specific user
   */
  private async sendDigestForUser(userId: string): Promise<number> {
    // Get pending digest deliveries for user
    const pendingDeliveries = await this.deliveryRepo.find({
      where: {
        recipientId: userId,
        status: 'digest_pending' as any,
      },
      order: { createdAt: 'ASC' },
    });

    if (pendingDeliveries.length === 0) {
      return 0;
    }

    // Group notifications by template for the digest summary
    const grouped = new Map<string, typeof pendingDeliveries>();
    for (const delivery of pendingDeliveries) {
      const key = delivery.templateCode;
      if (!grouped.has(key)) {
        grouped.set(key, []);
      }
      grouped.get(key)!.push(delivery);
    }

    // Build digest content
    const digestItems: string[] = [];
    const htmlDigestItems: string[] = [];

    for (const [templateCode, deliveries] of grouped) {
      digestItems.push(`${templateCode}: ${deliveries.length} notification(s)`);
      htmlDigestItems.push(`<li><strong>${templateCode}</strong>: ${deliveries.length} notification(s)</li>`);

      // Include summaries of first few
      for (const delivery of deliveries.slice(0, 3)) {
        if (delivery.subject) {
          digestItems.push(`  - ${delivery.subject}`);
          htmlDigestItems.push(`<li style="margin-left: 20px;">${delivery.subject}</li>`);
        }
      }
      if (deliveries.length > 3) {
        digestItems.push(`  ... and ${deliveries.length - 3} more`);
        htmlDigestItems.push(`<li style="margin-left: 20px; font-style: italic;">... and ${deliveries.length - 3} more</li>`);
      }
    }

    // Send the digest email
    const digestTemplate = await this.templateRepo.findOne({
      where: { code: 'system_digest', isActive: true },
    });

    const digestData = {
      notificationCount: pendingDeliveries.length,
      digestSummary: digestItems.join('\n'),
      htmlDigestSummary: `<ul>${htmlDigestItems.join('')}</ul>`,
      generatedAt: new Date().toISOString(),
    };

    if (digestTemplate) {
      await this.send({
        templateCode: 'system_digest',
        recipients: [{ userId }],
        data: digestData,
        channels: ['email'],
        triggerType: 'subscription',
      });
    } else {
      // Fallback: send a basic digest email
      const delivery = this.deliveryRepo.create({
        triggerType: 'subscription',
        recipientId: userId,
        channel: 'email',
        subject: `Your Notification Digest (${pendingDeliveries.length} notifications)`,
        body: `You have ${pendingDeliveries.length} notifications:\n\n${digestItems.join('\n')}`,
        htmlBody: `<h2>Your Notification Digest</h2><p>You have ${pendingDeliveries.length} notifications:</p>${digestData.htmlDigestSummary}`,
        contextData: digestData,
        status: 'queued',
        scheduledAt: new Date(),
      });
      await this.deliveryRepo.save(delivery);
      await this.processDelivery(delivery.id);
    }

    // Mark pending deliveries as processed
    await this.deliveryRepo.update(
      { id: In(pendingDeliveries.map((d) => d.id)) },
      { status: 'digested' as any }
    );

    this.logger.debug(`Sent digest for user ${userId} with ${pendingDeliveries.length} notifications`);
    return pendingDeliveries.length;
  }

  /**
   * Check if notification should be queued for digest based on user preferences
   */
  async shouldQueueForDigest(userId: string, _templateCode: string): Promise<boolean> {
    if (!this.userPrefsRepo) {
      return false;
    }

    const prefs = await this.userPrefsRepo.findOne({
      where: { userId },
    });

    // Queue for digest if user has digest mode enabled
    return prefs?.digestMode ?? false;
  }
}
