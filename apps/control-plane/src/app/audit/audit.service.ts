import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ControlPlaneAuditLog } from '@hubblewave/control-plane-db';

// Result types for audit logs
export type AuditResult = 'success' | 'failure' | 'partial';

export interface CreateAuditLogDto {
  userId?: string;
  customerId?: string;
  instanceId?: string;
  action: string;
  resourceType?: string;
  resourceId?: string;
  result?: string;
  errorMessage?: string;
  oldValues?: Record<string, unknown>;
  newValues?: Record<string, unknown>;
  details?: Record<string, unknown>;
  ipAddress?: string;
  userAgent?: string;
  requestId?: string;
}

export interface AuditLogQueryParams {
  userId?: string;
  customerId?: string;
  instanceId?: string;
  action?: string;
  resourceType?: string;
  result?: AuditResult;
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
      userId,
      customerId,
      instanceId,
      action,
      resourceType,
      result,
      startDate,
      endDate,
      search,
      page = 1,
      limit = 50,
    } = params;

    let query = this.auditRepo.createQueryBuilder('log');

    if (userId) {
      query = query.andWhere('log.user_id = :userId', { userId });
    }
    if (customerId) {
      query = query.andWhere('log.customer_id = :customerId', { customerId });
    }
    if (instanceId) {
      query = query.andWhere('log.instance_id = :instanceId', { instanceId });
    }
    if (action) {
      query = query.andWhere('log.action LIKE :action', { action: `${action}%` });
    }
    if (resourceType) {
      query = query.andWhere('log.resource_type = :resourceType', { resourceType });
    }
    if (result) {
      query = query.andWhere('log.result = :result', { result });
    }
    if (startDate) {
      query = query.andWhere('log.created_at >= :startDate', { startDate });
    }
    if (endDate) {
      query = query.andWhere('log.created_at <= :endDate', { endDate });
    }
    if (search) {
      query = query.andWhere(
        '(log.action ILIKE :search OR log.error_message ILIKE :search)',
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
    action: string,
    descriptionOrOptions?: string | Partial<CreateAuditLogDto>,
    legacyOptions?: Record<string, unknown>
  ): Promise<ControlPlaneAuditLog> {
    let options: Partial<CreateAuditLogDto> = {};
    let description: string | undefined;

    if (typeof descriptionOrOptions === 'string') {
      description = descriptionOrOptions;
      options = (legacyOptions || {}) as Partial<CreateAuditLogDto>;
    } else {
      options = descriptionOrOptions || {};
    }

    return this.create({
      action,
      result: options.result || 'success',
      details: {
        ...(options.details || {}),
        ...(description ? { description } : {}),
        ...(legacyOptions?.metadata ? { legacyMetadata: legacyOptions.metadata } : {}),
      },
      userId: options.userId,
      customerId: options.customerId || (legacyOptions?.customerId as string),
      instanceId: options.instanceId || (legacyOptions?.instanceId as string),
      resourceType: options.resourceType || (legacyOptions?.targetType as string),
      resourceId: options.resourceId || (legacyOptions?.target as string),
      ipAddress: options.ipAddress || (legacyOptions?.ipAddress as string),
      userAgent: options.userAgent || (legacyOptions?.userAgent as string),
      requestId: options.requestId || (legacyOptions?.correlationId as string),
    });
  }

  async getStats(customerId?: string) {
    let query = this.auditRepo.createQueryBuilder('log');

    if (customerId) {
      query = query.where('log.customer_id = :customerId', { customerId });
    }

    const byResult = await query
      .clone()
      .select('log.result', 'result')
      .addSelect('COUNT(*)', 'count')
      .groupBy('log.result')
      .getRawMany();

    const byAction = await query
      .clone()
      .select("SPLIT_PART(log.action, '.', 1)", 'category')
      .addSelect('COUNT(*)', 'count')
      .groupBy("SPLIT_PART(log.action, '.', 1)")
      .orderBy('count', 'DESC')
      .limit(10)
      .getRawMany();

    return {
      byResult: byResult.reduce((acc, s) => {
        acc[s.result] = parseInt(s.count);
        return acc;
      }, {} as Record<string, number>),
      byAction,
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
