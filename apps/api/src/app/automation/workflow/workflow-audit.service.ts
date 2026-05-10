import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AuditLog } from '@hubblewave/instance-db';

@Injectable()
export class WorkflowAuditService {
  constructor(
    @InjectRepository(AuditLog)
    private readonly auditRepo: Repository<AuditLog>,
  ) {}

  async record(params: {
    actorId?: string;
    action: string;
    recordId?: string;
    oldValues?: Record<string, unknown> | null;
    newValues?: Record<string, unknown> | null;
  }) {
    const entry = this.auditRepo.create({
      userId: params.actorId || null,
      action: params.action,
      collectionCode: 'process_flow_definitions',
      recordId: params.recordId || null,
      oldValues: params.oldValues ?? null,
      newValues: params.newValues ?? null,
    });
    await this.auditRepo.save(entry);
  }
}
