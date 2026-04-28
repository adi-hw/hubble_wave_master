import { Injectable, Logger, Optional } from '@nestjs/common';
import { NotificationChannel } from '@hubblewave/instance-db';
import * as nodemailer from 'nodemailer';

export interface ChannelDeliveryRequest {
  recipientId: string;
  recipientEmail?: string | null;
  recipientPhone?: string | null;
  subject?: string;
  body?: string;
  bodyHtml?: string;
  metadata?: Record<string, unknown>;
}

export interface ChannelDeliveryResult {
  providerId?: string;
  providerResponse?: Record<string, unknown>;
}

/**
 * A ChannelProvider adapts an external delivery system (SMTP, Twilio, FCM,
 * etc.) into a single contract: take a rendered notification, return when
 * the upstream has accepted it, throw when it has not. The provider
 * registry below maps NotificationChannel -> ChannelProvider; the queue
 * processor calls the registered provider for each channel and marks the
 * delivery row sent / failed based on the result.
 *
 * If no provider is registered for a given channel (e.g. local dev with
 * no SMTP env vars set, or a future channel that nobody has implemented),
 * the registry returns null and the queue processor MUST mark the
 * delivery `failed` with a clear "no provider configured" reason.
 * Silent-drop semantics — marking the queue item `sent` while nothing
 * actually shipped — is forbidden; that pattern was the audit finding
 * that motivated this whole abstraction.
 */
export interface ChannelProvider {
  readonly channel: NotificationChannel;
  send(request: ChannelDeliveryRequest): Promise<ChannelDeliveryResult>;
}

/**
 * SMTP-backed email provider. Wired only when SMTP_HOST + SMTP_PORT are
 * present in env. SMTP_USER / SMTP_PASS are optional (anonymous SMTP is
 * legal but rare in production). When env is incomplete, this class is
 * not registered and the email channel falls through to "no provider
 * configured" — a fail-closed delivery, never a silent drop.
 */
@Injectable()
export class SmtpEmailProvider implements ChannelProvider {
  readonly channel: NotificationChannel = 'email';
  private readonly transporter: nodemailer.Transporter | null;
  private readonly fromAddress: string;

  constructor() {
    const host = process.env.SMTP_HOST;
    const portStr = process.env.SMTP_PORT;
    const port = portStr ? parseInt(portStr, 10) : NaN;
    if (!host || !Number.isFinite(port) || port <= 0) {
      this.transporter = null;
      this.fromAddress = '';
      return;
    }
    const user = process.env.SMTP_USER;
    const pass = process.env.SMTP_PASS;
    this.transporter = nodemailer.createTransport({
      host,
      port,
      secure: port === 465,
      auth: user && pass ? { user, pass } : undefined,
    });
    this.fromAddress =
      process.env.SMTP_FROM ?? process.env.NOTIFY_FROM ?? user ?? 'no-reply@hubblewave.local';
  }

  isConfigured(): boolean {
    return this.transporter !== null;
  }

  async send(request: ChannelDeliveryRequest): Promise<ChannelDeliveryResult> {
    if (!this.transporter) {
      throw new Error('SMTP transport not configured');
    }
    if (!request.recipientEmail) {
      throw new Error('Recipient has no email on file');
    }
    const info = await this.transporter.sendMail({
      from: this.fromAddress,
      to: request.recipientEmail,
      subject: request.subject ?? '(no subject)',
      text: request.body,
      html: request.bodyHtml,
    });
    return {
      providerId: 'smtp',
      providerResponse: {
        messageId: info.messageId,
        accepted: info.accepted,
        rejected: info.rejected,
      },
    };
  }
}

@Injectable()
export class ChannelProviderRegistry {
  private readonly logger = new Logger(ChannelProviderRegistry.name);
  private readonly providers = new Map<NotificationChannel, ChannelProvider>();

  constructor(@Optional() smtpEmail?: SmtpEmailProvider) {
    if (smtpEmail && smtpEmail.isConfigured()) {
      this.providers.set('email', smtpEmail);
    } else {
      this.logger.warn(
        'Email channel has no provider configured (SMTP_HOST / SMTP_PORT unset). ' +
          'Email notifications will fail closed until SMTP is provisioned.',
      );
    }
    // SMS, push, webhook providers intentionally not registered. Each one
    // requires a credentialed third-party SDK that the platform owner
    // provisions per-instance; until that wiring exists those channels
    // fail closed instead of silently dropping. Workflow / automation
    // authors can reroute to email or in_app where appropriate.
  }

  for(channel: NotificationChannel): ChannelProvider | null {
    return this.providers.get(channel) ?? null;
  }
}
