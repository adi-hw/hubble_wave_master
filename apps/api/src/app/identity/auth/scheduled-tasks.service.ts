import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AuthEventsService } from './auth-events.service';
import { RefreshTokenService } from './refresh-token.service';
import { PasswordResetService } from './password-reset.service';

/**
 * Scheduled Tasks Service
 *
 * Handles periodic cleanup of expired/old authentication data:
 * - Audit events older than retention period
 * - Expired refresh tokens
 * - Expired password reset tokens
 *
 * Uses a simple interval-based scheduler (NestJS @Cron could also be used)
 */
@Injectable()
export class ScheduledTasksService implements OnModuleInit {
  private readonly logger = new Logger(ScheduledTasksService.name);

  // Default retention periods (configurable via environment)
  private readonly auditEventRetentionDays: number;
  private readonly cleanupIntervalMs: number;
  private cleanupTimer: NodeJS.Timeout | null = null;

  constructor(
    private readonly configService: ConfigService,
    private readonly authEventsService: AuthEventsService,
    private readonly refreshTokenService: RefreshTokenService,
    private readonly passwordResetService: PasswordResetService,
  ) {
    // Default: keep audit events for 90 days
    this.auditEventRetentionDays = this.configService.get<number>('AUDIT_RETENTION_DAYS', 90);
    // Default: run cleanup every 6 hours
    this.cleanupIntervalMs = this.configService.get<number>('CLEANUP_INTERVAL_HOURS', 6) * 60 * 60 * 1000;
  }

  onModuleInit() {
    // Don't run cleanup in test environment
    if (process.env.NODE_ENV === 'test') {
      this.logger.log('Skipping scheduled cleanup in test environment');
      return;
    }

    this.logger.log(
      `Scheduled cleanup initialized: ` +
      `audit retention=${this.auditEventRetentionDays} days, ` +
      `interval=${this.cleanupIntervalMs / (60 * 60 * 1000)} hours`
    );

    // Run initial cleanup after 1 minute (allow app to fully start)
    setTimeout(() => this.runCleanup(), 60 * 1000);

    // Schedule recurring cleanup
    this.cleanupTimer = setInterval(() => this.runCleanup(), this.cleanupIntervalMs);
  }

  onModuleDestroy() {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = null;
    }
  }

  /**
   * Run all cleanup tasks
   */
  async runCleanup(): Promise<void> {
    this.logger.log('Starting scheduled cleanup tasks...');
    const startTime = Date.now();

    try {
      // 1. Clean up old audit events
      await this.cleanupAuditEvents();

      // 2. Clean up expired refresh tokens
      await this.cleanupExpiredTokens();

      // 3. Clean up expired password reset tokens
      await this.cleanupPasswordResetTokens();

      const duration = Date.now() - startTime;
      this.logger.log(`Scheduled cleanup completed in ${duration}ms`);
    } catch (error) {
      this.logger.error('Error during scheduled cleanup:', error);
    }
  }

  private async cleanupAuditEvents(): Promise<void> {
    try {
      await this.authEventsService.cleanupOlderThan(this.auditEventRetentionDays);
      this.logger.debug(`Cleaned up audit events older than ${this.auditEventRetentionDays} days`);
    } catch (error) {
      this.logger.error('Failed to cleanup audit events:', error);
    }
  }

  private async cleanupExpiredTokens(): Promise<void> {
    try {
      await this.refreshTokenService.cleanupExpiredTokens();
      this.logger.debug('Cleaned up expired refresh tokens');
    } catch (error) {
      this.logger.error('Failed to cleanup refresh tokens:', error);
    }
  }

  private async cleanupPasswordResetTokens(): Promise<void> {
    try {
      await this.passwordResetService.cleanupExpiredTokens();
      this.logger.debug('Cleaned up expired password reset tokens');
    } catch (error) {
      this.logger.error('Failed to cleanup password reset tokens:', error);
    }
  }
}
