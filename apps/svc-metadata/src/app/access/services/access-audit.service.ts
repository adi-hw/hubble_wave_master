import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AccessAuditLog, AccessRuleAuditLog } from '@hubblewave/instance-db';

@Injectable()
export class AccessAuditService {
  constructor(
    @InjectRepository(AccessAuditLog)
    private readonly auditRepo: Repository<AccessAuditLog>,
    @InjectRepository(AccessRuleAuditLog)
    private readonly ruleAuditRepo: Repository<AccessRuleAuditLog>,
  ) {}

  async logAccess(
    collectionId: string,
    userId: string,
    operation: string,
    accessGranted: boolean,
    details: any,
  ): Promise<void> {
    const log = this.auditRepo.create({
      userId,
      resource: collectionId,
      action: operation,
      decision: accessGranted ? 'ALLOW' : 'DENY',
      context: {
        recordId: details.recordId || null,
        propertyCode: details.propertyCode || null,
        denialReason: details.denialReason || null,
        isBreakGlass: !!details.sessionId,
        breakGlassSessionId: details.sessionId || null,
        breakGlassJustification: details.justification || null,
        trace: details.trace || null,
      },
    });

    // Fire and forget - don't block request on audit write
    // In production, we might want a safer queue mechanism
    this.auditRepo.save(log).catch(err => {
      console.error('Failed to write audit log:', err);
    });
  }

  async logRuleChange(
    ruleType: 'collection' | 'property',
    ruleId: string,
    collectionId: string,
    action: 'create' | 'update' | 'delete',
    previousState: any,
    newState: any,
    userId: string,
  ): Promise<void> {
    const log = this.ruleAuditRepo.create({
      ruleId,
      action,
      changes: {
        ruleType,
        collectionId,
        previousState,
        newState,
      },
      performedBy: userId,
    } as any);

    this.ruleAuditRepo.save(log).catch(err => {
      console.error('Failed to write rule audit log:', err);
    });
  }
}

