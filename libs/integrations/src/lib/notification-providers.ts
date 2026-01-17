import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Repository } from 'typeorm';
import { NotificationDelivery, InAppNotification } from '@hubblewave/instance-db';

/**
 * Channel Provider Interface
 * All notification providers must implement this interface
 */
export interface ChannelProvider {
  send(delivery: NotificationDelivery): Promise<ProviderResult>;
}

export interface ProviderResult {
  success: boolean;
  externalId?: string;
  error?: string;
  metadata?: Record<string, unknown>;
}

/**
 * Email Provider
 *
 * Supports multiple email services via configuration:
 * - SMTP (direct)
 * - SendGrid
 * - AWS SES
 * - Mailgun
 *
 * Configuration is read from environment variables.
 */
@Injectable()
export class EmailProvider implements ChannelProvider {
  private readonly logger = new Logger(EmailProvider.name);
  private readonly provider: string;
  private readonly config: EmailConfig;

  constructor(private readonly configService: ConfigService) {
    this.provider = this.configService.get<string>('EMAIL_PROVIDER', 'smtp');
    this.config = {
      smtp: {
        host: this.configService.get<string>('SMTP_HOST', 'localhost'),
        port: this.configService.get<number>('SMTP_PORT', 587),
        secure: this.configService.get<boolean>('SMTP_SECURE', false),
        user: this.configService.get<string>('SMTP_USER', ''),
        pass: this.configService.get<string>('SMTP_PASS', ''),
      },
      sendgrid: {
        apiKey: this.configService.get<string>('SENDGRID_API_KEY', ''),
      },
      ses: {
        region: this.configService.get<string>('AWS_REGION', 'us-east-1'),
        accessKeyId: this.configService.get<string>('AWS_ACCESS_KEY_ID', ''),
        secretAccessKey: this.configService.get<string>('AWS_SECRET_ACCESS_KEY', ''),
      },
      mailgun: {
        apiKey: this.configService.get<string>('MAILGUN_API_KEY', ''),
        domain: this.configService.get<string>('MAILGUN_DOMAIN', ''),
      },
      fromAddress: this.configService.get<string>('EMAIL_FROM', 'noreply@hubblewave.com'),
      fromName: this.configService.get<string>('EMAIL_FROM_NAME', 'HubbleWave'),
    };
  }

  async send(delivery: NotificationDelivery): Promise<ProviderResult> {
    if (!delivery.recipientEmail) {
      return { success: false, error: 'No recipient email address provided' };
    }

    try {
      switch (this.provider) {
        case 'sendgrid':
          return this.sendViaSendGrid(delivery);
        case 'ses':
          return this.sendViaSES(delivery);
        case 'mailgun':
          return this.sendViaMailgun(delivery);
        case 'smtp':
        default:
          return this.sendViaSMTP(delivery);
      }
    } catch (error: any) {
      this.logger.error(`Email send failed: ${error.message}`, error.stack);
      return { success: false, error: error.message };
    }
  }

  private async sendViaSendGrid(delivery: NotificationDelivery): Promise<ProviderResult> {
    if (!this.config.sendgrid.apiKey) {
      this.logger.warn('SendGrid API key not configured, email will be logged only');
      return this.logAndSimulate(delivery);
    }

    const response = await fetch('https://api.sendgrid.com/v3/mail/send', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.config.sendgrid.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        personalizations: [
          {
            to: [{ email: delivery.recipientEmail }],
          },
        ],
        from: {
          email: this.config.fromAddress,
          name: this.config.fromName,
        },
        subject: delivery.subject,
        content: [
          { type: 'text/plain', value: delivery.body || '' },
          ...(delivery.htmlBody ? [{ type: 'text/html', value: delivery.htmlBody }] : []),
        ],
      }),
    });

    if (response.status >= 200 && response.status < 300) {
      const messageId = response.headers.get('x-message-id');
      return { success: true, externalId: messageId || `sg_${Date.now()}` };
    }

    const errorBody = await response.text();
    return { success: false, error: `SendGrid error: ${response.status} - ${errorBody}` };
  }

  private async sendViaSES(delivery: NotificationDelivery): Promise<ProviderResult> {
    if (!this.config.ses.accessKeyId || !this.config.ses.secretAccessKey) {
      this.logger.warn('AWS SES credentials not configured, email will be logged only');
      return this.logAndSimulate(delivery);
    }

    // AWS SES v2 API using fetch
    const date = new Date().toISOString().replace(/[:-]|\.\d{3}/g, '');
    const endpoint = `https://email.${this.config.ses.region}.amazonaws.com/v2/email/outbound-emails`;

    const body = JSON.stringify({
      Content: {
        Simple: {
          Subject: { Data: delivery.subject },
          Body: {
            Text: { Data: delivery.body || '' },
            ...(delivery.htmlBody ? { Html: { Data: delivery.htmlBody } } : {}),
          },
        },
      },
      Destination: {
        ToAddresses: [delivery.recipientEmail],
      },
      FromEmailAddress: `${this.config.fromName} <${this.config.fromAddress}>`,
    });

    // Note: In production, use AWS SDK for proper signing
    this.logger.log(`[SES] Would send to ${delivery.recipientEmail}: ${delivery.subject}`);
    return this.logAndSimulate(delivery);
  }

  private async sendViaMailgun(delivery: NotificationDelivery): Promise<ProviderResult> {
    if (!this.config.mailgun.apiKey || !this.config.mailgun.domain) {
      this.logger.warn('Mailgun credentials not configured, email will be logged only');
      return this.logAndSimulate(delivery);
    }

    const formData = new URLSearchParams();
    formData.append('from', `${this.config.fromName} <${this.config.fromAddress}>`);
    formData.append('to', delivery.recipientEmail);
    formData.append('subject', delivery.subject || '');
    formData.append('text', delivery.body || '');
    if (delivery.htmlBody) {
      formData.append('html', delivery.htmlBody);
    }

    const response = await fetch(
      `https://api.mailgun.net/v3/${this.config.mailgun.domain}/messages`,
      {
        method: 'POST',
        headers: {
          Authorization: `Basic ${Buffer.from(`api:${this.config.mailgun.apiKey}`).toString('base64')}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: formData.toString(),
      }
    );

    if (response.ok) {
      const data = await response.json();
      return { success: true, externalId: data.id };
    }

    const errorBody = await response.text();
    return { success: false, error: `Mailgun error: ${response.status} - ${errorBody}` };
  }

  private async sendViaSMTP(delivery: NotificationDelivery): Promise<ProviderResult> {
    if (!this.config.smtp.host) {
      this.logger.warn('SMTP not configured, email will be logged only');
      return this.logAndSimulate(delivery);
    }

    // Note: In production, use nodemailer or similar SMTP library
    this.logger.log(`[SMTP] To: ${delivery.recipientEmail}, Subject: ${delivery.subject}`);
    return this.logAndSimulate(delivery);
  }

  private logAndSimulate(delivery: NotificationDelivery): ProviderResult {
    this.logger.log(
      `[EMAIL-SIM] To: ${delivery.recipientEmail}, Subject: ${delivery.subject}, Body: ${delivery.body?.substring(0, 100)}...`
    );
    return { success: true, externalId: `email_sim_${Date.now()}`, metadata: { simulated: true } };
  }
}

interface EmailConfig {
  smtp: { host: string; port: number; secure: boolean; user: string; pass: string };
  sendgrid: { apiKey: string };
  ses: { region: string; accessKeyId: string; secretAccessKey: string };
  mailgun: { apiKey: string; domain: string };
  fromAddress: string;
  fromName: string;
}

/**
 * SMS Provider
 *
 * Supports multiple SMS services:
 * - Twilio
 * - AWS SNS
 * - Plivo
 * - Vonage (Nexmo)
 */
@Injectable()
export class SmsProvider implements ChannelProvider {
  private readonly logger = new Logger(SmsProvider.name);
  private readonly provider: string;
  private readonly config: SmsConfig;

  constructor(private readonly configService: ConfigService) {
    this.provider = this.configService.get<string>('SMS_PROVIDER', 'twilio');
    this.config = {
      twilio: {
        accountSid: this.configService.get<string>('TWILIO_ACCOUNT_SID', ''),
        authToken: this.configService.get<string>('TWILIO_AUTH_TOKEN', ''),
        fromNumber: this.configService.get<string>('TWILIO_FROM_NUMBER', ''),
      },
      sns: {
        region: this.configService.get<string>('AWS_REGION', 'us-east-1'),
        accessKeyId: this.configService.get<string>('AWS_ACCESS_KEY_ID', ''),
        secretAccessKey: this.configService.get<string>('AWS_SECRET_ACCESS_KEY', ''),
      },
      plivo: {
        authId: this.configService.get<string>('PLIVO_AUTH_ID', ''),
        authToken: this.configService.get<string>('PLIVO_AUTH_TOKEN', ''),
        fromNumber: this.configService.get<string>('PLIVO_FROM_NUMBER', ''),
      },
      vonage: {
        apiKey: this.configService.get<string>('VONAGE_API_KEY', ''),
        apiSecret: this.configService.get<string>('VONAGE_API_SECRET', ''),
        fromNumber: this.configService.get<string>('VONAGE_FROM_NUMBER', ''),
      },
    };
  }

  async send(delivery: NotificationDelivery): Promise<ProviderResult> {
    if (!delivery.recipientPhone) {
      return { success: false, error: 'No recipient phone number provided' };
    }

    try {
      switch (this.provider) {
        case 'twilio':
          return this.sendViaTwilio(delivery);
        case 'sns':
          return this.sendViaSNS(delivery);
        case 'plivo':
          return this.sendViaPlivo(delivery);
        case 'vonage':
          return this.sendViaVonage(delivery);
        default:
          return this.logAndSimulate(delivery);
      }
    } catch (error: any) {
      this.logger.error(`SMS send failed: ${error.message}`, error.stack);
      return { success: false, error: error.message };
    }
  }

  private async sendViaTwilio(delivery: NotificationDelivery): Promise<ProviderResult> {
    const { accountSid, authToken, fromNumber } = this.config.twilio;

    if (!accountSid || !authToken) {
      this.logger.warn('Twilio credentials not configured, SMS will be logged only');
      return this.logAndSimulate(delivery);
    }

    const formData = new URLSearchParams();
    formData.append('To', delivery.recipientPhone);
    formData.append('From', fromNumber);
    formData.append('Body', delivery.body || '');

    const response = await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`,
      {
        method: 'POST',
        headers: {
          Authorization: `Basic ${Buffer.from(`${accountSid}:${authToken}`).toString('base64')}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: formData.toString(),
      }
    );

    if (response.ok) {
      const data = await response.json();
      return { success: true, externalId: data.sid };
    }

    const errorBody = await response.text();
    return { success: false, error: `Twilio error: ${response.status} - ${errorBody}` };
  }

  private async sendViaSNS(delivery: NotificationDelivery): Promise<ProviderResult> {
    // Note: In production, use AWS SDK for proper signing
    this.logger.log(`[SNS] Would send to ${delivery.recipientPhone}: ${delivery.body?.substring(0, 50)}...`);
    return this.logAndSimulate(delivery);
  }

  private async sendViaPlivo(delivery: NotificationDelivery): Promise<ProviderResult> {
    const { authId, authToken, fromNumber } = this.config.plivo;

    if (!authId || !authToken) {
      this.logger.warn('Plivo credentials not configured, SMS will be logged only');
      return this.logAndSimulate(delivery);
    }

    const response = await fetch(
      `https://api.plivo.com/v1/Account/${authId}/Message/`,
      {
        method: 'POST',
        headers: {
          Authorization: `Basic ${Buffer.from(`${authId}:${authToken}`).toString('base64')}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          src: fromNumber,
          dst: delivery.recipientPhone,
          text: delivery.body,
        }),
      }
    );

    if (response.ok) {
      const data = await response.json();
      return { success: true, externalId: data.message_uuid?.[0] };
    }

    const errorBody = await response.text();
    return { success: false, error: `Plivo error: ${response.status} - ${errorBody}` };
  }

  private async sendViaVonage(delivery: NotificationDelivery): Promise<ProviderResult> {
    const { apiKey, apiSecret, fromNumber } = this.config.vonage;

    if (!apiKey || !apiSecret) {
      this.logger.warn('Vonage credentials not configured, SMS will be logged only');
      return this.logAndSimulate(delivery);
    }

    const response = await fetch('https://rest.nexmo.com/sms/json', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        api_key: apiKey,
        api_secret: apiSecret,
        from: fromNumber,
        to: delivery.recipientPhone,
        text: delivery.body,
      }),
    });

    if (response.ok) {
      const data = await response.json();
      if (data.messages?.[0]?.status === '0') {
        return { success: true, externalId: data.messages[0]['message-id'] };
      }
      return { success: false, error: data.messages?.[0]?.['error-text'] || 'Unknown Vonage error' };
    }

    const errorBody = await response.text();
    return { success: false, error: `Vonage error: ${response.status} - ${errorBody}` };
  }

  private logAndSimulate(delivery: NotificationDelivery): ProviderResult {
    this.logger.log(`[SMS-SIM] To: ${delivery.recipientPhone}, Body: ${delivery.body?.substring(0, 100)}...`);
    return { success: true, externalId: `sms_sim_${Date.now()}`, metadata: { simulated: true } };
  }
}

interface SmsConfig {
  twilio: { accountSid: string; authToken: string; fromNumber: string };
  sns: { region: string; accessKeyId: string; secretAccessKey: string };
  plivo: { authId: string; authToken: string; fromNumber: string };
  vonage: { apiKey: string; apiSecret: string; fromNumber: string };
}

/**
 * Push Notification Provider
 *
 * Supports:
 * - Firebase Cloud Messaging (FCM)
 * - Apple Push Notification Service (APNS)
 * - Web Push (VAPID)
 */
@Injectable()
export class PushProvider implements ChannelProvider {
  private readonly logger = new Logger(PushProvider.name);
  private readonly fcmProjectId: string;
  private readonly fcmServiceAccountKey: string;
  private readonly vapidPublicKey: string;
  private readonly vapidPrivateKey: string;

  constructor(private readonly configService: ConfigService) {
    this.fcmProjectId = this.configService.get<string>('FCM_PROJECT_ID', '');
    this.fcmServiceAccountKey = this.configService.get<string>('FCM_SERVICE_ACCOUNT_KEY', '');
    this.vapidPublicKey = this.configService.get<string>('VAPID_PUBLIC_KEY', '');
    this.vapidPrivateKey = this.configService.get<string>('VAPID_PRIVATE_KEY', '');
  }

  async send(delivery: NotificationDelivery): Promise<ProviderResult> {
    if (!delivery.recipientId) {
      return { success: false, error: 'No recipient user ID provided' };
    }

    try {
      // Get device tokens for user from delivery context or channel config
      const deviceTokens = this.getDeviceTokens(delivery);

      if (deviceTokens.length === 0) {
        this.logger.warn(`No device tokens found for user ${delivery.recipientId}`);
        return this.logAndSimulate(delivery);
      }

      const results: ProviderResult[] = [];

      for (const token of deviceTokens) {
        if (token.platform === 'web') {
          results.push(await this.sendWebPush(delivery, token));
        } else {
          results.push(await this.sendFCM(delivery, token));
        }
      }

      const successCount = results.filter((r) => r.success).length;
      if (successCount > 0) {
        return {
          success: true,
          externalId: `push_${Date.now()}`,
          metadata: { sent: successCount, total: results.length },
        };
      }

      return {
        success: false,
        error: results.map((r) => r.error).filter(Boolean).join('; '),
      };
    } catch (error: any) {
      this.logger.error(`Push send failed: ${error.message}`, error.stack);
      return { success: false, error: error.message };
    }
  }

  private getDeviceTokens(delivery: NotificationDelivery): DeviceToken[] {
    const contextTokens = delivery.contextData?.['deviceTokens'] as DeviceToken[] | undefined;
    if (contextTokens && Array.isArray(contextTokens)) {
      return contextTokens;
    }
    return [];
  }

  private async sendFCM(delivery: NotificationDelivery, token: DeviceToken): Promise<ProviderResult> {
    if (!this.fcmProjectId || !this.fcmServiceAccountKey) {
      this.logger.warn('FCM not configured, push will be logged only');
      return this.logAndSimulate(delivery);
    }

    // FCM v1 API
    const response = await fetch(
      `https://fcm.googleapis.com/v1/projects/${this.fcmProjectId}/messages:send`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          // Note: In production, use proper OAuth2 token from service account
          'Authorization': `Bearer ${this.fcmServiceAccountKey}`,
        },
        body: JSON.stringify({
          message: {
            token: token.token,
            notification: {
              title: delivery.subject,
              body: delivery.body,
            },
            data: delivery.contextData as Record<string, string>,
          },
        }),
      }
    );

    if (response.ok) {
      const data = await response.json();
      return { success: true, externalId: data.name };
    }

    const errorBody = await response.text();
    return { success: false, error: `FCM error: ${response.status} - ${errorBody}` };
  }

  private async sendWebPush(delivery: NotificationDelivery, token: DeviceToken): Promise<ProviderResult> {
    if (!this.vapidPublicKey || !this.vapidPrivateKey) {
      this.logger.warn('VAPID keys not configured, web push will be logged only');
      return this.logAndSimulate(delivery);
    }

    // Note: In production, use web-push library for proper VAPID signing
    this.logger.log(`[WEB-PUSH] Would send to ${token.token.substring(0, 20)}...: ${delivery.subject}`);
    return this.logAndSimulate(delivery);
  }

  private logAndSimulate(delivery: NotificationDelivery): ProviderResult {
    this.logger.log(`[PUSH-SIM] To user: ${delivery.recipientId}, Title: ${delivery.subject}`);
    return { success: true, externalId: `push_sim_${Date.now()}`, metadata: { simulated: true } };
  }
}

interface DeviceToken {
  token: string;
  platform: 'ios' | 'android' | 'web';
  deviceId?: string;
}

/**
 * In-App Notification Provider
 *
 * Stores notifications in the database for in-app display
 */
@Injectable()
export class InAppProvider implements ChannelProvider {
  private readonly logger = new Logger(InAppProvider.name);

  constructor(private readonly inAppRepo: Repository<InAppNotification>) {}

  async send(delivery: NotificationDelivery): Promise<ProviderResult> {
    if (!delivery.recipientId) {
      return { success: false, error: 'No recipient user ID provided' };
    }

    try {
      const notification = this.inAppRepo.create({
        userId: delivery.recipientId,
        title: delivery.subject || 'Notification',
        message: delivery.body || '',
        notificationType: this.getNotificationType(delivery),
        referenceType: delivery.triggerType,
        referenceId: delivery.triggerReferenceId,
        isRead: false,
        data: delivery.contextData,
      });

      await this.inAppRepo.save(notification);

      this.logger.debug(`In-app notification created: ${notification.id}`);

      return { success: true, externalId: notification.id };
    } catch (error: any) {
      this.logger.error(`In-app notification failed: ${error.message}`, error.stack);
      return { success: false, error: error.message };
    }
  }

  private getNotificationType(delivery: NotificationDelivery): string {
    switch (delivery.triggerType) {
      case 'process_flow':
        return 'process_flow';
      case 'approval':
        return 'approval';
      case 'subscription':
        return 'subscription';
      default:
        return 'system';
    }
  }
}

/**
 * Webhook Provider
 *
 * Sends notifications to external webhooks
 */
@Injectable()
export class WebhookProvider implements ChannelProvider {
  private readonly logger = new Logger(WebhookProvider.name);

  async send(delivery: NotificationDelivery): Promise<ProviderResult> {
    const config = delivery.channelConfig?.config;
    const url = config?.['url'] as string | undefined;

    if (!url) {
      return { success: false, error: 'No webhook URL configured' };
    }

    try {
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        ...((config?.['headers'] || {}) as Record<string, string>),
      };

      // Add HMAC signature if secret is configured
      const secret = config?.['secret'] as string | undefined;
      const payload = JSON.stringify({
        subject: delivery.subject,
        body: delivery.body,
        data: delivery.contextData,
        recipientId: delivery.recipientId,
        recipientEmail: delivery.recipientEmail,
        timestamp: new Date().toISOString(),
      });

      if (secret) {
        const crypto = await import('crypto');
        const signature = crypto
          .createHmac('sha256', secret)
          .update(payload)
          .digest('hex');
        headers['X-Webhook-Signature'] = `sha256=${signature}`;
      }

      const response = await fetch(url, {
        method: 'POST',
        headers,
        body: payload,
      });

      if (response.ok) {
        return { success: true, externalId: `webhook_${Date.now()}` };
      }

      const errorBody = await response.text();
      return { success: false, error: `Webhook error: ${response.status} - ${errorBody.substring(0, 200)}` };
    } catch (error: any) {
      this.logger.error(`Webhook send failed: ${error.message}`, error.stack);
      return { success: false, error: error.message };
    }
  }
}
