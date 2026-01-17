/**
 * Behavioral Analytics Controller
 * HubbleWave Platform - Phase 1
 *
 * REST endpoints for behavioral profiling and security alerts.
 */

import {
  Controller,
  Post,
  Get,
  Patch,
  Body,
  Param,
  Query,
  UseGuards,
  Request,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { PermissionGuard } from '../roles/guards/permission.guard';
import { RequirePermission } from '../roles/decorators/permission.decorator';
import { BehavioralAnalyticsService, BehaviorEvent } from './behavioral-analytics.service';

interface RequestWithUser {
  user: {
    sub: string;
    username: string;
  };
  ip?: string;
  headers: {
    'user-agent'?: string;
  };
}

@Controller('auth/security')
@UseGuards(JwtAuthGuard)
export class BehavioralAnalyticsController {
  constructor(
    private readonly analyticsService: BehavioralAnalyticsService,
  ) {}

  /**
   * Get my behavioral profile summary
   */
  @Get('profile')
  async getMyProfile(@Request() req: RequestWithUser) {
    const summary = await this.analyticsService.getProfileSummary(req.user.sub);

    if (!summary) {
      return {
        hasProfile: false,
        message: 'Profile is being built. Check back after a few logins.',
      };
    }

    return {
      hasProfile: true,
      typicalLoginHours: summary.typicalLoginHours,
      typicalDaysOfWeek: summary.typicalDaysOfWeek.map(d => this.getDayName(d)),
      knownLocations: summary.knownLocations,
      averageSessionDuration: `${Math.round(summary.averageSessionDuration / 60)} minutes`,
      lastUpdated: summary.lastUpdated,
    };
  }

  /**
   * Get user's behavioral profile (admin)
   */
  @Get('profile/:userId')
  @UseGuards(PermissionGuard)
  @RequirePermission('admin.audit')
  async getUserProfile(@Param('userId') userId: string) {
    const summary = await this.analyticsService.getProfileSummary(userId);

    if (!summary) {
      return { hasProfile: false };
    }

    return {
      hasProfile: true,
      userId: summary.userId,
      typicalLoginHours: summary.typicalLoginHours,
      typicalDaysOfWeek: summary.typicalDaysOfWeek.map(d => this.getDayName(d)),
      knownIpAddresses: summary.knownIpAddresses,
      knownLocations: summary.knownLocations,
      averageSessionDuration: summary.averageSessionDuration,
      averageActionsPerSession: summary.averageActionsPerSession,
      lastUpdated: summary.lastUpdated,
    };
  }

  /**
   * Record a behavior event (internal use)
   */
  @Post('events')
  @UseGuards(PermissionGuard)
  @RequirePermission('admin.settings')
  @HttpCode(HttpStatus.OK)
  async recordEvent(@Body() event: BehaviorEvent) {
    const result = await this.analyticsService.recordEvent(event);

    return {
      isAnomaly: result.isAnomaly,
      score: result.score,
      factors: result.factors,
      recommendation: result.recommendation,
    };
  }

  /**
   * List security alerts
   */
  @Get('alerts')
  @UseGuards(PermissionGuard)
  @RequirePermission('admin.audit')
  async listAlerts(
    @Query('userId') userId?: string,
    @Query('status') status?: string,
    @Query('severity') severity?: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    const result = await this.analyticsService.listAlerts({
      userId,
      status,
      severity,
      limit: limit ? parseInt(limit, 10) : undefined,
      offset: offset ? parseInt(offset, 10) : undefined,
    });

    return {
      alerts: result.alerts.map(alert => ({
        id: alert.id,
        userId: alert.userId,
        user: alert.user ? {
          id: alert.user.id,
          email: alert.user.email,
          displayName: alert.user.displayName,
        } : undefined,
        alertType: alert.alertType,
        severity: alert.severity,
        status: alert.status,
        title: alert.title,
        description: alert.description,
        createdAt: alert.createdAt,
        acknowledgedAt: alert.acknowledgedAt,
        resolvedAt: alert.resolvedAt,
      })),
      total: result.total,
    };
  }

  /**
   * Get my security alerts
   */
  @Get('my-alerts')
  async getMyAlerts(
    @Request() req: RequestWithUser,
    @Query('status') status?: string,
    @Query('limit') limit?: string,
  ) {
    const result = await this.analyticsService.listAlerts({
      userId: req.user.sub,
      status,
      limit: limit ? parseInt(limit, 10) : 10,
    });

    return {
      alerts: result.alerts.map(alert => ({
        id: alert.id,
        alertType: alert.alertType,
        severity: alert.severity,
        status: alert.status,
        title: alert.title,
        description: alert.description,
        createdAt: alert.createdAt,
      })),
      total: result.total,
    };
  }

  /**
   * Update alert status
   */
  @Patch('alerts/:alertId')
  @UseGuards(PermissionGuard)
  @RequirePermission('admin.audit')
  @HttpCode(HttpStatus.OK)
  async updateAlertStatus(
    @Request() req: RequestWithUser,
    @Param('alertId') alertId: string,
    @Body() body: {
      status: 'acknowledged' | 'investigating' | 'resolved' | 'false_positive';
      notes?: string;
    },
  ) {
    const alert = await this.analyticsService.updateAlertStatus(
      alertId,
      body.status,
      req.user.sub,
      body.notes,
    );

    return {
      success: true,
      alert: {
        id: alert.id,
        status: alert.status,
        acknowledgedAt: alert.acknowledgedAt,
        resolvedAt: alert.resolvedAt,
      },
    };
  }

  /**
   * Get recent anomalies (dashboard widget)
   */
  @Get('dashboard/anomalies')
  @UseGuards(PermissionGuard)
  @RequirePermission('admin.audit')
  async getRecentAnomalies(@Query('limit') limit?: string) {
    const anomalies = await this.analyticsService.getRecentAnomalies(
      limit ? parseInt(limit, 10) : 10,
    );

    return {
      anomalies: anomalies.map(alert => ({
        id: alert.id,
        userId: alert.userId,
        user: alert.user ? {
          email: alert.user.email,
          displayName: alert.user.displayName,
        } : undefined,
        alertType: alert.alertType,
        severity: alert.severity,
        title: alert.title,
        createdAt: alert.createdAt,
      })),
    };
  }

  /**
   * Get security metrics (dashboard)
   */
  @Get('dashboard/metrics')
  @UseGuards(PermissionGuard)
  @RequirePermission('admin.audit')
  async getSecurityMetrics() {
    return this.analyticsService.getSecurityMetrics();
  }

  private getDayName(day: number): string {
    const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    return days[day] || 'Unknown';
  }
}
