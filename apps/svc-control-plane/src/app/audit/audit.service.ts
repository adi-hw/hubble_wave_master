import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  ControlPlaneAuditLog,
  AuditSeverity,
  ActorType,
  TargetType,
} from '@hubblewave/control-plane-db';

export interface CreateAuditLogDto {
  customerId?: string;
  eventType: string;
  severity: AuditSeverity;
  actor: string;
  actorType: ActorType;
  target: string;
  targetType: TargetType;
  description: string;
  metadata?: Record<string, unknown>;
  ipAddress?: string;
  userAgent?: string;
  correlationId?: string;
  durationMs?: number;
}

export interface AuditLogQueryParams {
  customerId?: string;
  eventType?: string;
  severity?: AuditSeverity;
  actorType?: ActorType;
  targetType?: TargetType;
  actor?: string;
  startDate?: Date;
  endDate?: Date;
  search?: string;
  page?: number;
  limit?: number;
}

@Injectable()
export class AuditService {
  constructor(
    @InjectRepository(ControlPlaneAuditLog)
    private readonly auditRepo: Repository<ControlPlaneAuditLog>,
  ) {}

  async findAll(params: AuditLogQueryParams = {}) {
    const {
      customerId,
      eventType,
      severity,
      actorType,
      targetType,
      actor,
      startDate,
      endDate,
      search,
      page = 1,
      limit = 50,
    } = params;

    let query = this.auditRepo.createQueryBuilder('log');

    if (customerId) {
      query = query.andWhere('log.customer_id = :customerId', { customerId });
    }
    if (eventType) {
      query = query.andWhere('log.event_type LIKE :eventType', { eventType: `${eventType}%` });
    }
    if (severity) {
      query = query.andWhere('log.severity = :severity', { severity });
    }
    if (actorType) {
      query = query.andWhere('log.actor_type = :actorType', { actorType });
    }
    if (targetType) {
      query = query.andWhere('log.target_type = :targetType', { targetType });
    }
    if (actor) {
      query = query.andWhere('log.actor ILIKE :actor', { actor: `%${actor}%` });
    }
    if (startDate) {
      query = query.andWhere('log.created_at >= :startDate', { startDate });
    }
    if (endDate) {
      query = query.andWhere('log.created_at <= :endDate', { endDate });
    }
    if (search) {
      query = query.andWhere(
        '(log.description ILIKE :search OR log.target ILIKE :search)',
        { search: `%${search}%` }
      );
    }

    const [logs, total] = await query
      .orderBy('log.created_at', 'DESC')
      .skip((page - 1) * limit)
      .take(limit)
      .getManyAndCount();

    return {
      data: logs,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async findOne(id: string): Promise<ControlPlaneAuditLog | null> {
    return this.auditRepo.findOne({ where: { id } });
  }

  async create(dto: CreateAuditLogDto): Promise<ControlPlaneAuditLog> {
    const log = this.auditRepo.create(dto);
    return this.auditRepo.save(log);
  }

  async log(
    eventType: string,
    description: string,
    options: Partial<CreateAuditLogDto> = {}
  ): Promise<ControlPlaneAuditLog> {
    return this.create({
      eventType,
      description,
      severity: options.severity || 'info',
      actor: options.actor || 'system',
      actorType: options.actorType || 'system',
      target: options.target || '',
      targetType: options.targetType || 'customer',
      ...options,
    });
  }

  async getStats(customerId?: string) {
    let query = this.auditRepo.createQueryBuilder('log');

    if (customerId) {
      query = query.where('log.customer_id = :customerId', { customerId });
    }

    const bySeverity = await query
      .clone()
      .select('log.severity', 'severity')
      .addSelect('COUNT(*)', 'count')
      .groupBy('log.severity')
      .getRawMany();

    const byEventType = await query
      .clone()
      .select("SPLIT_PART(log.event_type, '.', 1)", 'category')
      .addSelect('COUNT(*)', 'count')
      .groupBy("SPLIT_PART(log.event_type, '.', 1)")
      .orderBy('count', 'DESC')
      .limit(10)
      .getRawMany();

    return {
      bySeverity: bySeverity.reduce((acc, s) => {
        acc[s.severity] = parseInt(s.count);
        return acc;
      }, {} as Record<string, number>),
      byEventType,
    };
  }

  async getRecentActivity(customerId?: string, limit = 10) {
    let query = this.auditRepo.createQueryBuilder('log');

    if (customerId) {
      query = query.where('log.customer_id = :customerId', { customerId });
    }

    return query
      .orderBy('log.created_at', 'DESC')
      .limit(limit)
      .getMany();
  }

  async purgeOlderThan(days: number) {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - days);
    await this.auditRepo
      .createQueryBuilder()
      .delete()
      .where('created_at < :cutoff', { cutoff })
      .execute();
  }
}
