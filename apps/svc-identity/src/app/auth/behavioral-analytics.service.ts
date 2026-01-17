/**
 * Behavioral Analytics Service
 * HubbleWave Platform - Phase 1
 *
 * Service for user behavior profiling and anomaly detection.
 */

import {
  Injectable,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, MoreThan } from 'typeorm';
import {
  BehavioralProfile,
  SecurityAlert,
  AuthEvent,
  AuditLog,
} from '@hubblewave/instance-db';

const ANOMALY_THRESHOLD = 70; // Score above this triggers alert
const LEARNING_PERIOD_DAYS = 14;

export interface BehaviorEvent {
  userId: string;
  eventType: string;
  timestamp: Date;
  ipAddress?: string;
  userAgent?: string;
  location?: {
    country?: string;
    city?: string;
    latitude?: number;
    longitude?: number;
  };
  metadata?: Record<string, unknown>;
}

export interface AnomalyResult {
  isAnomaly: boolean;
  score: number;
  factors: string[];
  recommendation: 'allow' | 'challenge' | 'block' | 'alert';
}

export interface UserBehaviorSummary {
  userId: string;
  typicalLoginHours: number[];
  typicalDaysOfWeek: number[];
  knownIpAddresses: string[];
  knownLocations: string[];
  averageSessionDuration: number;
  averageActionsPerSession: number;
  lastUpdated: Date;
}

@Injectable()
export class BehavioralAnalyticsService {
  private readonly logger = new Logger(BehavioralAnalyticsService.name);

  constructor(
    @InjectRepository(BehavioralProfile)
    private readonly profileRepo: Repository<BehavioralProfile>,
    @InjectRepository(SecurityAlert)
    private readonly alertRepo: Repository<SecurityAlert>,
    @InjectRepository(AuthEvent)
    private readonly authEventRepo: Repository<AuthEvent>,
    @InjectRepository(AuditLog)
    private readonly auditLogRepo: Repository<AuditLog>,
  ) {}

  /**
   * Record a behavior event and check for anomalies
   */
  async recordEvent(event: BehaviorEvent): Promise<AnomalyResult> {
    // Get or create behavioral profile
    let profile = await this.profileRepo.findOne({
      where: { userId: event.userId },
    });

    if (!profile) {
      profile = await this.createInitialProfile(event.userId);
    }

    // Analyze event against profile
    const anomalyResult = await this.analyzeEvent(event, profile);

    // Update profile with new event data
    await this.updateProfile(profile, event);

    // Create alert if anomaly detected
    if (anomalyResult.isAnomaly && anomalyResult.score >= ANOMALY_THRESHOLD) {
      await this.createSecurityAlert(event, anomalyResult);
    }

    return anomalyResult;
  }

  /**
   * Analyze an event against the user's behavioral profile
   */
  private async analyzeEvent(
    event: BehaviorEvent,
    profile: BehavioralProfile,
  ): Promise<AnomalyResult> {
    const factors: string[] = [];
    let score = 0;

    // Check if in learning period
    const profileAge = Date.now() - profile.createdAt.getTime();
    const isLearning = profileAge < LEARNING_PERIOD_DAYS * 24 * 60 * 60 * 1000;

    if (isLearning) {
      return {
        isAnomaly: false,
        score: 0,
        factors: ['Profile in learning period'],
        recommendation: 'allow',
      };
    }

    // Analyze login hour
    const eventHour = event.timestamp.getHours();
    const hourPatterns = profile.loginHours || {};
    const typicalHours = Object.entries(hourPatterns)
      .filter(([, count]) => count > 3)
      .map(([hour]) => parseInt(hour));

    if (typicalHours.length > 0 && !typicalHours.includes(eventHour)) {
      score += 20;
      factors.push(`Unusual login hour: ${eventHour}:00`);
    }

    // Analyze day of week
    const eventDay = event.timestamp.getDay();
    const dayName = this.getDayName(eventDay);
    const dayPatterns = profile.loginDays || {};
    const typicalDays = Object.entries(dayPatterns)
      .filter(([, count]) => count > 2)
      .map(([day]) => day);

    if (typicalDays.length > 0 && !typicalDays.includes(dayName)) {
      score += 15;
      factors.push(`Unusual day of week: ${dayName}`);
    }

    // Analyze IP address
    if (event.ipAddress) {
      const knownIpRanges = profile.knownIpRanges || [];
      const isKnownIp = knownIpRanges.some(range => range.frequency > 2);

      if (knownIpRanges.length > 0 && !isKnownIp) {
        score += 25;
        factors.push(`New IP address: ${this.maskIp(event.ipAddress)}`);

        // Check for impossible travel
        const lastEvent = await this.getLastAuthEvent(event.userId);
        if (lastEvent && event.location && lastEvent.details?.location) {
          const timeDiff = event.timestamp.getTime() - lastEvent.createdAt.getTime();
          const hoursDiff = timeDiff / (1000 * 60 * 60);

          // If location changed significantly in short time
          if (hoursDiff < 2 && this.isDistantLocation(event.location, lastEvent.details.location as Record<string, unknown>)) {
            score += 40;
            factors.push('Impossible travel detected');
          }
        }
      }
    }

    // Analyze location
    if (event.location?.country) {
      const knownLocations = profile.knownLocations || [];
      const isKnownLocation = knownLocations.some(
        loc => loc.country === event.location?.country && loc.frequency > 2,
      );

      if (knownLocations.length > 0 && !isKnownLocation) {
        score += 30;
        factors.push(`New location: ${event.location.country}`);
      }
    }

    // Normalize score
    score = Math.min(100, score);

    // Determine recommendation
    let recommendation: 'allow' | 'challenge' | 'block' | 'alert';
    if (score < 30) {
      recommendation = 'allow';
    } else if (score < 50) {
      recommendation = 'challenge';
    } else if (score < 80) {
      recommendation = 'alert';
    } else {
      recommendation = 'block';
    }

    return {
      isAnomaly: score >= 30,
      score,
      factors,
      recommendation,
    };
  }

  /**
   * Create initial behavioral profile for a user
   */
  private async createInitialProfile(userId: string): Promise<BehavioralProfile> {
    const profile = this.profileRepo.create({
      userId,
      loginHours: {},
      loginDays: {},
      knownLocations: [],
      knownIpRanges: [],
      knownDevices: [],
      avgSessionDuration: 30,
      avgActionsPerSession: 10,
      lastUpdatedAt: new Date(),
      dataPoints: 0,
      confidenceScore: 0,
    });

    await this.profileRepo.save(profile);

    this.logger.log(`Created behavioral profile for user ${userId}`);

    return profile;
  }

  /**
   * Update profile with new event data
   */
  private async updateProfile(
    profile: BehavioralProfile,
    event: BehaviorEvent,
  ): Promise<void> {
    // Update login hour pattern
    const hour = event.timestamp.getHours().toString();
    profile.loginHours[hour] = (profile.loginHours[hour] || 0) + 1;

    // Update day of week pattern
    const dayName = this.getDayName(event.timestamp.getDay());
    profile.loginDays[dayName] = (profile.loginDays[dayName] || 0) + 1;

    // Update known locations
    if (event.location?.country) {
      const existingLocation = profile.knownLocations.find(
        loc => loc.country === event.location?.country,
      );
      if (existingLocation) {
        existingLocation.frequency += 1;
        existingLocation.lastSeen = new Date().toISOString();
      } else {
        profile.knownLocations.push({
          city: event.location.city,
          country: event.location.country,
          countryCode: event.location.country.substring(0, 2).toUpperCase(),
          frequency: 1,
          lastSeen: new Date().toISOString(),
        });
      }
    }

    profile.lastUpdatedAt = new Date();
    profile.dataPoints += 1;
    profile.confidenceScore = Math.min(100, profile.dataPoints * 5);

    await this.profileRepo.save(profile);
  }

  /**
   * Create a security alert
   */
  private async createSecurityAlert(
    event: BehaviorEvent,
    anomaly: AnomalyResult,
  ): Promise<SecurityAlert> {
    const alert = this.alertRepo.create({
      userId: event.userId,
      alertType: this.determineAlertType(anomaly),
      severity: this.determineSeverity(anomaly.score),
      status: 'new',
      title: this.generateAlertTitle(anomaly),
      description: anomaly.factors.join('. '),
      riskScore: anomaly.score,
      details: {
        ipAddress: event.ipAddress,
        location: event.location,
        triggerReason: anomaly.factors.join('; '),
      },
      recommendedActions: [anomaly.recommendation],
    });

    await this.alertRepo.save(alert);

    this.logger.warn(
      `Security alert created for user ${event.userId}: ${alert.title} (score: ${anomaly.score})`,
    );

    return alert;
  }

  /**
   * Get user's behavioral profile summary
   */
  async getProfileSummary(userId: string): Promise<UserBehaviorSummary | null> {
    const profile = await this.profileRepo.findOne({
      where: { userId },
    });

    if (!profile) {
      return null;
    }

    return {
      userId,
      typicalLoginHours: Object.entries(profile.loginHours || {})
        .filter(([, count]) => count > 3)
        .map(([hour]) => parseInt(hour)),
      typicalDaysOfWeek: Object.entries(profile.loginDays || {})
        .filter(([, count]) => count > 2)
        .map(([day]) => this.getDayIndex(day)),
      knownIpAddresses: (profile.knownIpRanges || [])
        .filter(range => range.frequency > 2)
        .map(range => range.cidr),
      knownLocations: (profile.knownLocations || [])
        .filter(loc => loc.frequency > 2)
        .map(loc => loc.country),
      averageSessionDuration: profile.avgSessionDuration,
      averageActionsPerSession: profile.avgActionsPerSession,
      lastUpdated: profile.updatedAt,
    };
  }

  private getDayIndex(day: string): number {
    const days: Record<string, number> = {
      'Sunday': 0, 'Monday': 1, 'Tuesday': 2, 'Wednesday': 3,
      'Thursday': 4, 'Friday': 5, 'Saturday': 6
    };
    return days[day] ?? 0;
  }

  /**
   * List security alerts for a user
   */
  async listAlerts(options: {
    userId?: string;
    status?: string;
    severity?: string;
    limit?: number;
    offset?: number;
  }): Promise<{ alerts: SecurityAlert[]; total: number }> {
    const query = this.alertRepo.createQueryBuilder('alert')
      .leftJoinAndSelect('alert.user', 'user');

    if (options.userId) {
      query.andWhere('alert.userId = :userId', { userId: options.userId });
    }

    if (options.status) {
      query.andWhere('alert.status = :status', { status: options.status });
    }

    if (options.severity) {
      query.andWhere('alert.severity = :severity', { severity: options.severity });
    }

    query.orderBy('alert.createdAt', 'DESC');

    const total = await query.getCount();

    if (options.limit) {
      query.take(options.limit);
    }
    if (options.offset) {
      query.skip(options.offset);
    }

    const alerts = await query.getMany();

    return { alerts, total };
  }

  /**
   * Update alert status (acknowledge, investigate, resolve, false_positive)
   */
  async updateAlertStatus(
    alertId: string,
    status: 'acknowledged' | 'investigating' | 'resolved' | 'false_positive',
    updatedBy: string,
    notes?: string,
  ): Promise<SecurityAlert> {
    const alert = await this.alertRepo.findOne({ where: { id: alertId } });

    if (!alert) {
      throw new Error('Alert not found');
    }

    alert.status = status;
    if (status === 'acknowledged') {
      alert.acknowledgedAt = new Date();
      alert.acknowledgedBy = updatedBy;
    } else if (status === 'resolved' || status === 'false_positive') {
      alert.resolvedAt = new Date();
      alert.resolvedBy = updatedBy;
      alert.resolutionNotes = notes;
    }

    await this.alertRepo.save(alert);

    await this.auditLogRepo.save(
      this.auditLogRepo.create({
        userId: updatedBy,
        action: `security_alert.${status}`,
        collectionCode: 'security_alert',
        recordId: alertId,
        newValues: { notes, alertType: alert.alertType },
      }),
    );

    return alert;
  }

  /**
   * Get recent anomalies for dashboard
   */
  async getRecentAnomalies(limit: number = 10): Promise<SecurityAlert[]> {
    return this.alertRepo.find({
      where: {
        status: 'new',
        createdAt: MoreThan(new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)),
      },
      relations: ['user'],
      order: { createdAt: 'DESC' },
      take: limit,
    });
  }

  /**
   * Get security metrics for admin dashboard
   */
  async getSecurityMetrics(): Promise<{
    totalAlerts: number;
    newAlerts: number;
    criticalAlerts: number;
    resolvedToday: number;
    averageResolutionTime: number;
  }> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const [totalAlerts, newAlerts, criticalAlerts, resolvedToday] = await Promise.all([
      this.alertRepo.count(),
      this.alertRepo.count({ where: { status: 'new' } }),
      this.alertRepo.count({ where: { severity: 'critical', status: 'new' } }),
      this.alertRepo.count({
        where: {
          status: 'resolved',
          resolvedAt: MoreThan(today),
        },
      }),
    ]);

    // Calculate average resolution time
    const resolvedAlerts = await this.alertRepo.find({
      where: {
        status: 'resolved',
        resolvedAt: MoreThan(new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)),
      },
      select: ['createdAt', 'resolvedAt'],
    });

    let averageResolutionTime = 0;
    if (resolvedAlerts.length > 0) {
      const totalTime = resolvedAlerts.reduce((sum, alert) => {
        if (alert.resolvedAt && alert.createdAt) {
          return sum + (alert.resolvedAt.getTime() - alert.createdAt.getTime());
        }
        return sum;
      }, 0);
      averageResolutionTime = totalTime / resolvedAlerts.length / (1000 * 60 * 60); // Hours
    }

    return {
      totalAlerts,
      newAlerts,
      criticalAlerts,
      resolvedToday,
      averageResolutionTime: Math.round(averageResolutionTime * 10) / 10,
    };
  }

  // ============================================================================
  // Private Helper Methods
  // ============================================================================

  private async getLastAuthEvent(userId: string): Promise<AuthEvent | null> {
    return this.authEventRepo.findOne({
      where: { userId, eventType: 'login', success: true },
      order: { createdAt: 'DESC' },
    });
  }

  private isDistantLocation(
    loc1: { latitude?: number; longitude?: number },
    loc2: Record<string, unknown>,
  ): boolean {
    if (!loc1.latitude || !loc1.longitude) return false;
    const lat2 = loc2['latitude'] as number | undefined;
    const lon2 = loc2['longitude'] as number | undefined;
    if (!lat2 || !lon2) return false;

    // Haversine formula for distance
    const R = 6371; // Earth's radius in km
    const dLat = this.toRad(lat2 - loc1.latitude);
    const dLon = this.toRad(lon2 - loc1.longitude);
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(this.toRad(loc1.latitude)) *
        Math.cos(this.toRad(lat2)) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    const distance = R * c;

    // Consider > 500km in < 2 hours as impossible travel
    return distance > 500;
  }

  private toRad(deg: number): number {
    return deg * (Math.PI / 180);
  }

  private maskIp(ip: string): string {
    const parts = ip.split('.');
    if (parts.length === 4) {
      return `${parts[0]}.${parts[1]}.***.***`;
    }
    return ip.substring(0, ip.length / 2) + '***';
  }

  private getDayName(day: number): string {
    const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    return days[day] || 'Unknown';
  }

  private determineAlertType(anomaly: AnomalyResult): string {
    if (anomaly.factors.some(f => f.includes('Impossible travel'))) {
      return 'impossible_travel';
    }
    if (anomaly.factors.some(f => f.includes('New IP'))) {
      return 'new_ip_address';
    }
    if (anomaly.factors.some(f => f.includes('New location'))) {
      return 'new_location';
    }
    if (anomaly.factors.some(f => f.includes('Unusual login hour'))) {
      return 'unusual_time';
    }
    return 'behavioral_anomaly';
  }

  private determineSeverity(score: number): 'low' | 'medium' | 'high' | 'critical' {
    if (score >= 80) return 'critical';
    if (score >= 60) return 'high';
    if (score >= 40) return 'medium';
    return 'low';
  }

  private generateAlertTitle(anomaly: AnomalyResult): string {
    const primaryFactor = anomaly.factors[0] || 'Behavioral anomaly detected';
    return primaryFactor;
  }
}
