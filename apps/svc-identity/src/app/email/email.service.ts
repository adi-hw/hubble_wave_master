import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';

export interface EmailOptions {
  to: string;
  subject: string;
  text: string;
  html?: string;
}

@Injectable()
export class EmailService {
  private transporter: nodemailer.Transporter | null = null;
  private readonly logger = new Logger(EmailService.name);
  private readonly fromAddress: string;

  constructor(private configService: ConfigService) {
    const emailProvider = this.configService.get('EMAIL_PROVIDER', 'console');
    this.fromAddress = this.configService.get('EMAIL_FROM', 'noreply@eam-platform.com');

    if (emailProvider === 'smtp') {
      this.initializeSMTP();
    } else if (emailProvider === 'sendgrid') {
      this.initializeSendGrid();
    } else {
      this.logger.warn('Email provider not configured. Emails will be logged to console.');
    }
  }

  private initializeSMTP() {
    this.transporter = nodemailer.createTransport({
      host: this.configService.get('SMTP_HOST', 'localhost'),
      port: this.configService.get('SMTP_PORT', 587),
      secure: this.configService.get('SMTP_SECURE', false), // true for 465, false for other ports
      auth: {
        user: this.configService.get('SMTP_USER'),
        pass: this.configService.get('SMTP_PASSWORD'),
      },
    });

    this.logger.log('SMTP email transporter initialized');
  }

  private initializeSendGrid() {
    // SendGrid uses SMTP protocol
    this.transporter = nodemailer.createTransport({
      host: 'smtp.sendgrid.net',
      port: 587,
      secure: false,
      auth: {
        user: 'apikey',
        pass: this.configService.get('SENDGRID_API_KEY'),
      },
    });

    this.logger.log('SendGrid email transporter initialized');
  }

  async sendEmail(options: EmailOptions): Promise<void> {
    if (!this.transporter) {
      // Fall back to console logging for development
      this.logger.log('='.repeat(80));
      this.logger.log('EMAIL (Console Mode)');
      this.logger.log('='.repeat(80));
      this.logger.log(`To: ${options.to}`);
      this.logger.log(`Subject: ${options.subject}`);
      this.logger.log('');
      this.logger.log(options.text);
      this.logger.log('='.repeat(80));
      return;
    }

    const transporter = this.transporter;
    try {
      const info = await transporter.sendMail({
        from: this.fromAddress,
        to: options.to,
        subject: options.subject,
        text: options.text,
        html: options.html || options.text,
      });

      this.logger.log(`Email sent: ${info.messageId} to ${options.to}`);
    } catch (error) {
      this.logger.error(`Failed to send email to ${options.to}: ${(error as Error).message}`);
      throw error;
    }
  }

  async sendPasswordResetEmail(email: string, token: string, tenantSlug: string): Promise<void> {
    const resetUrl = `${this.configService.get('FRONTEND_URL', 'http://localhost:4200')}/reset-password?token=${token}&tenant=${tenantSlug}`;

    await this.sendEmail({
      to: email,
      subject: 'Password Reset Request',
      text: `You requested a password reset for your EAM Platform account.

Click the link below to reset your password:
${resetUrl}

This link will expire in 1 hour.

If you did not request this, please ignore this email and your password will remain unchanged.

Best regards,
EAM Platform Team`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2>Password Reset Request</h2>
          <p>You requested a password reset for your EAM Platform account.</p>
          <p>Click the button below to reset your password:</p>
          <p style="text-align: center; margin: 30px 0;">
            <a href="${resetUrl}" style="background-color: #007bff; color: white; padding: 12px 30px; text-decoration: none; border-radius: 4px; display: inline-block;">Reset Password</a>
          </p>
          <p><small>Or copy this link: ${resetUrl}</small></p>
          <p><strong>This link will expire in 1 hour.</strong></p>
          <p>If you did not request this, please ignore this email and your password will remain unchanged.</p>
          <hr style="margin: 30px 0; border: none; border-top: 1px solid #eee;">
          <p style="color: #666; font-size: 12px;">Best regards,<br>EAM Platform Team</p>
        </div>
      `,
    });
  }

  async sendEmailVerification(email: string, token: string, tenantSlug: string): Promise<void> {
    const verifyUrl = `${this.configService.get('FRONTEND_URL', 'http://localhost:4200')}/verify-email?token=${token}&tenant=${tenantSlug}`;

    await this.sendEmail({
      to: email,
      subject: 'Verify Your Email Address',
      text: `Welcome to EAM Platform!

Please verify your email address to complete your registration.

Click the link below to verify:
${verifyUrl}

This link will expire in 24 hours.

Best regards,
EAM Platform Team`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2>Welcome to EAM Platform!</h2>
          <p>Thank you for registering. Please verify your email address to complete your account setup.</p>
          <p style="text-align: center; margin: 30px 0;">
            <a href="${verifyUrl}" style="background-color: #28a745; color: white; padding: 12px 30px; text-decoration: none; border-radius: 4px; display: inline-block;">Verify Email</a>
          </p>
          <p><small>Or copy this link: ${verifyUrl}</small></p>
          <p><strong>This link will expire in 24 hours.</strong></p>
          <hr style="margin: 30px 0; border: none; border-top: 1px solid #eee;">
          <p style="color: #666; font-size: 12px;">Best regards,<br>EAM Platform Team</p>
        </div>
      `,
    });
  }

  async sendPasswordChangedNotification(email: string): Promise<void> {
    await this.sendEmail({
      to: email,
      subject: 'Password Changed Successfully',
      text: `Your password has been changed successfully.

If you did not make this change, please contact support immediately.

Best regards,
EAM Platform Team`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2>Password Changed</h2>
          <p>Your password has been changed successfully.</p>
          <p><strong>If you did not make this change, please contact support immediately.</strong></p>
          <hr style="margin: 30px 0; border: none; border-top: 1px solid #eee;">
          <p style="color: #666; font-size: 12px;">Best regards,<br>EAM Platform Team</p>
        </div>
      `,
    });
  }
}
