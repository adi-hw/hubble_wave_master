import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AccessAuditLog, AccessRuleAuditLog } from '@hubblewave/instance-db';
import type {
  AccessAuditEvent,
  AccessAuditPort,
  AccessDeniedEvent,
  SecurityAuditEvent,
} from '@hubblewave/auth-guard';
import type {
  DecisionProvenance,
  FieldDecisionProvenance,
} from '@hubblewave/authorization';

@Injectable()
export class AccessAuditService implements AccessAuditPort {
  private readonly logger = new Logger(AccessAuditService.name);

  constructor(
    @InjectRepository(AccessAuditLog)
    private readonly auditRepo: Repository<AccessAuditLog>,
    @InjectRepository(AccessRuleAuditLog)
    private readonly ruleAuditRepo: Repository<AccessRuleAuditLog>,
  ) {}

  /**
   * F021: persist a row when an admin bypass short-circuits an authorization
   * check. Fire-and-forget — save errors are logged but never thrown so a
   * down audit table cannot regress the runtime decision (canon §10 audit
   * must not compromise runtime correctness).
   *
   * §28.7: when the caller supplies `event.context.wouldBeProvenance`, the
   * shape is persisted into `context.additionalData.provenance` so forensic
   * queries can answer "what would the policy have decided had the admin
   * bypass not fired".
   */
  logAdminBypass(event: AccessAuditEvent): void {
    const { wouldBeProvenance, ...rest } = event.context ?? {};
    const log = this.auditRepo.create({
      userId: event.userId,
      resource: event.resource,
      action: event.action,
      decision: 'ALLOW',
      context: {
        additionalData: {
          adminBypass: true,
          ...rest,
          ...(wouldBeProvenance ? { provenance: wouldBeProvenance } : {}),
        },
      },
    });
    this.auditRepo.save(log).catch((err) => {
      this.logger.error('Failed to write admin bypass audit log', err);
    });
  }

  /**
   * canon §29.5: persist a high-severity security event that is NOT an
   * authorization short-circuit (e.g. refresh-token reuse). Written to the
   * same `AccessAuditLog` surface as admin bypasses with
   * `decision = 'HIGH_SEVERITY'` so SIEM queries can filter on the
   * distinguishing value.
   *
   * Plaintext IP / User-Agent values from the caller flow straight into
   * the audit row — canon §29.5 explicitly carves this table out from the
   * "hashes only" rule that governs the operational `refresh_tokens`
   * table, because the audit log has stricter retention and access
   * controls. Operators forensically investigating a reuse case need the
   * plaintext attribution.
   *
   * Same fire-and-forget posture as `logAdminBypass` — a down audit table
   * must not regress runtime correctness.
   */
  logSecurityEvent(event: SecurityAuditEvent): void {
    const log = this.auditRepo.create({
      userId: event.userId,
      resource: 'security_event',
      action: event.kind,
      decision: 'HIGH_SEVERITY',
      context: {
        additionalData: {
          kind: event.kind,
          severity: event.severity,
          ...(event.context ?? {}),
        },
      },
    });
    this.auditRepo.save(log).catch((err) => {
      this.logger.error('Failed to write security event audit log', err);
    });
  }

  /**
   * W2 Stream 2 PR6 — write an audit row for a 403 produced by the
   * guard chain (`PermissionsGuard` or `CollectionAccessGuard`).
   * Captures the §28.7 deny provenance alongside the request context
   * so operators can answer "why did user X get 403 on route Y"
   * directly from the audit log without re-running the evaluator.
   *
   * Same fire-and-forget posture as `logAdminBypass` /
   * `logSecurityEvent` — a down audit table must not regress runtime
   * correctness (the 403 is the authoritative response; failing to
   * record an audit row must not turn into a 500).
   */
  logAccessDenied(event: AccessDeniedEvent): void {
    const log = this.auditRepo.create({
      userId: event.userId,
      resource: `${event.resource.kind}:${event.resource.identifier}`,
      action: 'access_denied',
      decision: 'DENY',
      context: {
        additionalData: {
          resourceKind: event.resource.kind,
          resourceIdentifier: event.resource.identifier,
          authzProvenance: event.provenance,
          ...(event.requestContext ?? {}),
        },
      },
    });
    this.auditRepo.save(log).catch((err) => {
      this.logger.error('Failed to write access-denied audit log', err);
    });
  }

  /**
   * F021 — write an audit row for an authorization decision (allow or
   * deny) made on the non-admin path.
   *
   * §28.7: when the caller supplies `details.provenance`, the shape is
   * persisted into `context.additionalData.provenance` so compliance
   * reviewers can reconstruct "which level fired, which rule matched, and
   * the fallback chain" directly from the audit log without re-running the
   * evaluator.
   */
  async logAccess(
    collectionId: string,
    userId: string,
    operation: string,
    accessGranted: boolean,
    details: {
      sessionId?: string;
      recordId?: string | null;
      propertyCode?: string | null;
      denialReason?: string | null;
      justification?: string | null;
      trace?: string | null;
      ipAddress?: string;
      userAgent?: string;
      provenance?: DecisionProvenance | FieldDecisionProvenance;
      [key: string]: unknown;
    },
  ): Promise<void> {
    const log = this.auditRepo.create({
      userId,
      resource: collectionId,
      action: operation,
      decision: accessGranted ? 'ALLOW' : 'DENY',
      context: {
        sessionId: details.sessionId || undefined,
        additionalData: {
          recordId: details.recordId || null,
          propertyCode: details.propertyCode || null,
          denialReason: details.denialReason || null,
          isBreakGlass: !!details.sessionId,
          breakGlassSessionId: details.sessionId || null,
          breakGlassJustification: details.justification || null,
          trace: details.trace || null,
          ...(details.provenance ? { provenance: details.provenance } : {}),
        }
      },
    });

    // Fire and forget - don't block request on audit write
    // In production, we might want a safer queue mechanism
    this.auditRepo.save(log).catch(err => {
      this.logger.error('Failed to write audit log', err);
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
      this.logger.error('Failed to write rule audit log', err);
    });
  }
}

