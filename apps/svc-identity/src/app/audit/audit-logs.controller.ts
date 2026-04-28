import {
  Controller,
  Get,
  Query,
  UseGuards,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between } from 'typeorm';
import { AuthEvent } from '@hubblewave/instance-db';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionGuard } from '../roles/guards/permission.guard';
import { RequirePermission } from '../roles/decorators/permission.decorator';

interface AuditLogsQuery {
  q?: string;
  severity?: string;
  eventType?: string;
  startDate?: string;
  endDate?: string;
  page?: string;
  pageSize?: string;
}

/**
 * AuditLogsController
 *
 * Provides endpoints for viewing system audit logs.
 */
@Controller('audit-logs')
@UseGuards(JwtAuthGuard)
export class AuditLogsController {
  constructor(
    @InjectRepository(AuthEvent)
    private readonly authEventRepo: Repository<AuthEvent>,
  ) {}

  /**
   * Get paginated audit logs with filtering
   */
  @Get()
  @RequirePermission('admin.audit')
  @UseGuards(PermissionGuard)
  async getAuditLogs(@Query() query: AuditLogsQuery) {
    const page = query.page ? parseInt(query.page, 10) : 1;
    const pageSize = query.pageSize ? parseInt(query.pageSize, 10) : 50;
    const skip = (page - 1) * pageSize;

    // Build where clause
    const where: Record<string, unknown> = {};

    // Search by user email or event type
    if (query.q) {
      // For now, we'll filter in-memory since we need complex OR logic
      // In production, use a full-text search index
    }

    // Filter by event type
    if (query.eventType && query.eventType !== 'all') {
      where.eventType = query.eventType;
    }

    // Filter by date range
    if (query.startDate && query.endDate) {
      where.createdAt = Between(new Date(query.startDate), new Date(query.endDate));
    }

    // Get total count
    const total = await this.authEventRepo.count({ where });

    // Get paginated results
    const events = await this.authEventRepo.find({
      where,
      relations: ['user'],
      order: { createdAt: 'DESC' },
      skip,
      take: pageSize,
    });

    // Map to expected response format
    const data = events.map((event) => this.mapEventToAuditEntry(event));

    // If search query provided, filter results
    let filteredData = data;
    if (query.q) {
      const searchLower = query.q.toLowerCase();
      filteredData = data.filter(
        (entry) =>
          entry.actor.name.toLowerCase().includes(searchLower) ||
          entry.actor.email.toLowerCase().includes(searchLower) ||
          entry.action.toLowerCase().includes(searchLower) ||
          entry.resource.type.toLowerCase().includes(searchLower)
      );
    }

    // Filter by severity if provided
    if (query.severity && query.severity !== 'all') {
      filteredData = filteredData.filter((entry) => entry.severity === query.severity);
    }

    return {
      data: filteredData,
      total: query.q || query.severity ? filteredData.length : total,
      page,
      pageSize,
      totalPages: Math.ceil((query.q || query.severity ? filteredData.length : total) / pageSize),
    };
  }

  /**
   * Export audit logs as CSV
   */
  @Get('export')
  @RequirePermission('admin.audit')
  @UseGuards(PermissionGuard)
  async exportAuditLogs(@Query() query: AuditLogsQuery) {
    // Get all logs matching the filter (no pagination for export)
    const where: Record<string, unknown> = {};

    if (query.eventType && query.eventType !== 'all') {
      where.eventType = query.eventType;
    }

    if (query.startDate && query.endDate) {
      where.createdAt = Between(new Date(query.startDate), new Date(query.endDate));
    }

    const events = await this.authEventRepo.find({
      where,
      relations: ['user'],
      order: { createdAt: 'DESC' },
      take: 10000, // Limit export to 10k records
    });

    const data = events.map((event) => this.mapEventToAuditEntry(event));

    // Generate CSV
    const headers = ['ID', 'Timestamp', 'Event Type', 'Actor Name', 'Actor Email', 'Resource Type', 'Action', 'Success', 'IP Address'];
    const rows = data.map((entry) => [
      entry.id,
      entry.timestamp,
      entry.eventType,
      entry.actor.name,
      entry.actor.email,
      entry.resource.type,
      entry.action,
      entry.success ? 'Yes' : 'No',
      entry.ipAddress,
    ]);

    const csv = [headers, ...rows].map((row) => row.join(',')).join('\n');

    return { csv, filename: `audit-logs-${new Date().toISOString().split('T')[0]}.csv` };
  }

  private mapEventToAuditEntry(event: AuthEvent) {
    // Determine severity based on event type and success
    let severity: 'info' | 'warning' | 'critical' = 'info';
    if (!event.success) {
      severity = event.eventType?.includes('login') ? 'warning' : 'critical';
    }
    if (event.eventType?.includes('delete') || event.eventType?.includes('permission')) {
      severity = 'warning';
    }

    // Map event type to standard types
    let eventType: string = event.eventType || 'access';
    if (eventType.includes('login')) eventType = 'login';
    else if (eventType.includes('logout')) eventType = 'logout';
    else if (eventType.includes('create')) eventType = 'create';
    else if (eventType.includes('update')) eventType = 'update';
    else if (eventType.includes('delete')) eventType = 'delete';

    return {
      id: event.id,
      eventType,
      severity,
      actor: {
        id: event.userId || 'system',
        name: event.user?.displayName || event.user?.email?.split('@')[0] || 'System',
        email: event.user?.email || 'system@hubblewave.com',
        type: event.userId ? 'user' : 'system',
      },
      resource: {
        type: event.eventType?.split('_')[0] || 'auth',
        id: event.userId || 'system',
        name: event.eventType || 'Unknown',
      },
      action: event.eventType || 'unknown',
      details: event.geoLocation || {},
      ipAddress: event.ipAddress || 'unknown',
      userAgent: event.userAgent,
      timestamp: event.createdAt?.toISOString() || new Date().toISOString(),
      success: event.success,
      complianceFlags: [],
    };
  }
}
