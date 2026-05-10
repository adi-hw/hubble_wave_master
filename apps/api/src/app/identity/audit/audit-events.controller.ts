import {
  Controller,
  Get,
  Query,
  Res,
  UseGuards,
} from '@nestjs/common';
import { Response } from 'express';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AuditLog, buildAuditLogHash, buildAuditLogHashPayload } from '@hubblewave/instance-db';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionGuard } from '../roles/guards/permission.guard';
import { RequirePermission } from '../roles/decorators/permission.decorator';

interface AuditEventQuery {
  q?: string;
  action?: string;
  collectionCode?: string;
  recordId?: string;
  userId?: string;
  startDate?: string;
  endDate?: string;
  page?: string;
  pageSize?: string;
}

@Controller('audit/events')
@UseGuards(JwtAuthGuard)
export class AuditEventsController {
  constructor(
    @InjectRepository(AuditLog)
    private readonly auditRepo: Repository<AuditLog>,
  ) {}

  @Get()
  @RequirePermission('admin.audit')
  @UseGuards(PermissionGuard)
  async getAuditEvents(@Query() query: AuditEventQuery) {
    const page = query.page ? parseInt(query.page, 10) : 1;
    const pageSize = query.pageSize ? parseInt(query.pageSize, 10) : 50;
    const skip = (page - 1) * pageSize;

    const qb = this.auditRepo
      .createQueryBuilder('audit')
      .leftJoinAndSelect('audit.user', 'user')
      .orderBy('audit.createdAt', 'DESC')
      .addOrderBy('audit.id', 'DESC');

    if (query.userId) {
      qb.andWhere('audit.userId = :userId', { userId: query.userId });
    }

    if (query.action) {
      qb.andWhere('audit.action = :action', { action: query.action });
    }

    if (query.collectionCode) {
      qb.andWhere('audit.collectionCode = :collectionCode', { collectionCode: query.collectionCode });
    }

    if (query.recordId) {
      qb.andWhere('audit.recordId = :recordId', { recordId: query.recordId });
    }

    if (query.startDate && query.endDate) {
      qb.andWhere('audit.createdAt BETWEEN :start AND :end', {
        start: new Date(query.startDate),
        end: new Date(query.endDate),
      });
    }

    if (query.q) {
      const search = `%${query.q.toLowerCase()}%`;
      qb.andWhere(
        `(LOWER(audit.action) LIKE :search
        OR LOWER(audit.collectionCode) LIKE :search
        OR LOWER(user.email) LIKE :search
        OR LOWER(user.displayName) LIKE :search)`,
        { search },
      );
    }

    const total = await qb.getCount();
    const entries = await qb.skip(skip).take(pageSize).getMany();

    const data = entries.map((entry) => this.mapAuditEntry(entry));

    return {
      data,
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    };
  }

  @Get('export')
  @RequirePermission('admin.audit')
  @UseGuards(PermissionGuard)
  async exportAuditEvents(
    @Query() query: AuditEventQuery,
    @Res() res: Response,
  ) {
    const qb = this.auditRepo
      .createQueryBuilder('audit')
      .leftJoinAndSelect('audit.user', 'user')
      .orderBy('audit.createdAt', 'DESC')
      .addOrderBy('audit.id', 'DESC')
      .take(10000);

    if (query.userId) {
      qb.andWhere('audit.userId = :userId', { userId: query.userId });
    }

    if (query.action) {
      qb.andWhere('audit.action = :action', { action: query.action });
    }

    if (query.collectionCode) {
      qb.andWhere('audit.collectionCode = :collectionCode', { collectionCode: query.collectionCode });
    }

    if (query.recordId) {
      qb.andWhere('audit.recordId = :recordId', { recordId: query.recordId });
    }

    if (query.startDate && query.endDate) {
      qb.andWhere('audit.createdAt BETWEEN :start AND :end', {
        start: new Date(query.startDate),
        end: new Date(query.endDate),
      });
    }

    const entries = await qb.getMany();
    const data = entries.map((entry) => this.mapAuditEntry(entry));

    const headers = [
      'ID',
      'Timestamp',
      'Action',
      'Collection',
      'Record ID',
      'Actor Name',
      'Actor Email',
      'IP Address',
    ];
    const rows = data.map((entry) => [
      entry.id,
      entry.timestamp,
      entry.action,
      entry.resource.type,
      entry.resource.id,
      entry.actor.name,
      entry.actor.email,
      entry.ipAddress,
    ]);

    const csv = [headers, ...rows]
      .map((row) => row.map((cell) => this.escapeCsv(cell)).join(','))
      .join('\n');

    const filename = `audit-events-${new Date().toISOString().split('T')[0]}.csv`;
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(csv);
  }

  @Get('verify')
  @RequirePermission('admin.audit')
  @UseGuards(PermissionGuard)
  async verifyAuditChain() {
    const entries = await this.auditRepo.find({
      order: { createdAt: 'ASC', id: 'ASC' },
    });

    let previousHash: string | null = null;
    let checked = 0;

    for (const entry of entries) {
      checked += 1;

      if (entry.previousHash !== previousHash) {
        return {
          valid: false,
          checked,
          failureId: entry.id,
          failureReason: 'previous_hash_mismatch',
        };
      }

      const expected = buildAuditLogHash(
        buildAuditLogHashPayload(entry, previousHash),
      );

      if (entry.hash !== expected) {
        return {
          valid: false,
          checked,
          failureId: entry.id,
          failureReason: 'hash_mismatch',
        };
      }

      previousHash = entry.hash ?? null;
    }

    return { valid: true, checked };
  }

  private mapAuditEntry(entry: AuditLog) {
    const actor = entry.user ?? null;
    const actorName = actor?.displayName || actor?.email?.split('@')[0] || 'System';

    return {
      id: entry.id,
      eventType: this.mapEventType(entry.action),
      severity: this.mapSeverity(entry.action),
      actor: {
        id: entry.userId || 'system',
        name: actorName,
        email: actor?.email || 'system@hubblewave.com',
        type: entry.userId ? 'user' : 'system',
      },
      resource: {
        type: entry.collectionCode || 'system',
        id: entry.recordId || 'system',
        name: entry.collectionCode || entry.action,
      },
      action: entry.action,
      details: {
        oldValues: entry.oldValues || null,
        newValues: entry.newValues || null,
        hash: entry.hash || null,
        previousHash: entry.previousHash || null,
      },
      ipAddress: entry.ipAddress || 'unknown',
      userAgent: entry.userAgent,
      timestamp: entry.createdAt.toISOString(),
      success: true,
      complianceFlags: [],
    };
  }

  private mapEventType(action: string): string {
    const normalized = action.toLowerCase();
    if (normalized.includes('create')) return 'create';
    if (normalized.includes('update')) return 'update';
    if (normalized.includes('delete')) return 'delete';
    if (normalized.includes('export')) return 'export';
    if (normalized.includes('permission')) return 'permission_change';
    return 'access';
  }

  private mapSeverity(action: string): 'info' | 'warning' | 'critical' {
    const normalized = action.toLowerCase();
    if (normalized.includes('delete') || normalized.includes('permission')) {
      return 'warning';
    }
    return 'info';
  }

  private escapeCsv(value: string | null | undefined) {
    const safe = value ?? '';
    if (safe.includes(',') || safe.includes('"') || safe.includes('\n')) {
      return `"${safe.replace(/"/g, '""')}"`;
    }
    return safe;
  }
}
