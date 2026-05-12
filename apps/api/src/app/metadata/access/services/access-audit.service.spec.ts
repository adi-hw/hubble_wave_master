import type { Repository } from 'typeorm';
import type { AccessAuditLog, AccessRuleAuditLog } from '@hubblewave/instance-db';
import type {
  DecisionProvenance,
  FieldDecisionProvenance,
} from '@hubblewave/authorization';
import { AccessAuditService } from './access-audit.service';

/**
 * §28.7 — provenance must flow into the F021 audit log.
 *
 * Two paths to cover:
 *   - `logAdminBypass`: the AuthorizationService emits a wouldBeProvenance
 *     when it short-circuits an admin caller (the forensic shape that
 *     answers "what would the policy have decided"). The adapter must
 *     persist it into `context.additionalData.provenance`.
 *   - `logAccess`: non-admin denials and grants accept a `provenance`
 *     parameter. The adapter persists it identically.
 */

type RepoStub<T extends object> = {
  create: jest.Mock<T, [Partial<T>]>;
  save: jest.Mock<Promise<T>, [T]>;
};

function buildRepoStub<T extends object>(): RepoStub<T> {
  // create() echoes the input; save() resolves to the same object so the
  // production-shape `create → save` chain works without a real DB.
  const create = jest.fn((input: Partial<T>) => input as T);
  const save = jest.fn(async (entity: T) => entity);
  return { create, save };
}

const PROVENANCE: DecisionProvenance = {
  effect: 'allow',
  matchedLevel: 2,
  matchedRuleId: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
  matchedPrincipal: 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
  fallbackChain: ['level-1: no match', 'level-2: allow matched (rule: aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa)'],
};

const FIELD_PROVENANCE: FieldDecisionProvenance = {
  effect: 'mask',
  matchedLevel: 2,
  matchedRuleId: 'cccccccc-cccc-cccc-cccc-cccccccccccc',
  matchedPrincipal: 'dddddddd-dddd-dddd-dddd-dddddddddddd',
  fallbackChain: ['level-1: no match', 'level-2: allow matched (rule: cccccccc-cccc-cccc-cccc-cccccccccccc)'],
  maskingStrategy: 'PARTIAL',
};

describe('AccessAuditService (§28.7 provenance)', () => {
  it('18. logAdminBypass writes wouldBeProvenance into context.additionalData.provenance', () => {
    const auditRepo = buildRepoStub<AccessAuditLog>();
    const ruleAuditRepo = buildRepoStub<AccessRuleAuditLog>();
    const service = new AccessAuditService(
      auditRepo as unknown as Repository<AccessAuditLog>,
      ruleAuditRepo as unknown as Repository<AccessRuleAuditLog>,
    );

    service.logAdminBypass({
      userId: 'admin-1',
      resource: 'collection-1',
      action: 'read',
      context: {
        recordId: 'rec-1',
        wouldBeProvenance: PROVENANCE,
      },
    });

    expect(auditRepo.create).toHaveBeenCalledTimes(1);
    const created = auditRepo.create.mock.calls[0][0] as Partial<AccessAuditLog>;
    expect(created.decision).toBe('ALLOW');
    expect(created.context?.additionalData).toMatchObject({
      adminBypass: true,
      recordId: 'rec-1',
      provenance: PROVENANCE,
    });
    // wouldBeProvenance is unwrapped — only the canonical `provenance`
    // key is persisted so downstream queries don't have to know about
    // the transport-shape key.
    expect((created.context?.additionalData as Record<string, unknown>)['wouldBeProvenance']).toBeUndefined();
  });

  it('18b. logAdminBypass without provenance writes the audit row without a provenance key', () => {
    // Pre-§28.7 callers (e.g. the deprecated *Table wrappers when no
    // audit port is configured) call logAdminBypass without provenance.
    // The adapter must still write a coherent audit row.
    const auditRepo = buildRepoStub<AccessAuditLog>();
    const ruleAuditRepo = buildRepoStub<AccessRuleAuditLog>();
    const service = new AccessAuditService(
      auditRepo as unknown as Repository<AccessAuditLog>,
      ruleAuditRepo as unknown as Repository<AccessRuleAuditLog>,
    );

    service.logAdminBypass({
      userId: 'admin-1',
      resource: 'collection-1',
      action: 'read',
    });

    const created = auditRepo.create.mock.calls[0][0] as Partial<AccessAuditLog>;
    expect((created.context?.additionalData as Record<string, unknown>)['provenance']).toBeUndefined();
    expect(created.context?.additionalData).toMatchObject({ adminBypass: true });
  });

  it('19. logAccess accepts a provenance parameter and stores it in context.additionalData.provenance', async () => {
    const auditRepo = buildRepoStub<AccessAuditLog>();
    const ruleAuditRepo = buildRepoStub<AccessRuleAuditLog>();
    const service = new AccessAuditService(
      auditRepo as unknown as Repository<AccessAuditLog>,
      ruleAuditRepo as unknown as Repository<AccessRuleAuditLog>,
    );

    await service.logAccess(
      'coll-1',
      'user-1',
      'read',
      false, // access denied
      {
        denialReason: 'No matching allow rule',
        provenance: FIELD_PROVENANCE,
      },
    );

    expect(auditRepo.create).toHaveBeenCalledTimes(1);
    const created = auditRepo.create.mock.calls[0][0] as Partial<AccessAuditLog>;
    expect(created.decision).toBe('DENY');
    expect(created.context?.additionalData).toMatchObject({
      denialReason: 'No matching allow rule',
      provenance: FIELD_PROVENANCE,
    });
  });

  it('19b. logAccess without provenance writes the audit row without a provenance key (backward compat)', async () => {
    const auditRepo = buildRepoStub<AccessAuditLog>();
    const ruleAuditRepo = buildRepoStub<AccessRuleAuditLog>();
    const service = new AccessAuditService(
      auditRepo as unknown as Repository<AccessAuditLog>,
      ruleAuditRepo as unknown as Repository<AccessRuleAuditLog>,
    );

    await service.logAccess('coll-1', 'user-1', 'read', true, {
      trace: 'business-as-usual',
    });

    const created = auditRepo.create.mock.calls[0][0] as Partial<AccessAuditLog>;
    expect((created.context?.additionalData as Record<string, unknown>)['provenance']).toBeUndefined();
    expect(created.context?.additionalData).toMatchObject({ trace: 'business-as-usual' });
  });

  it('20. logSecurityEvent writes the event with decision=HIGH_SEVERITY and the kind/severity in context (canon §29.5)', () => {
    const auditRepo = buildRepoStub<AccessAuditLog>();
    const ruleAuditRepo = buildRepoStub<AccessRuleAuditLog>();
    const service = new AccessAuditService(
      auditRepo as unknown as Repository<AccessAuditLog>,
      ruleAuditRepo as unknown as Repository<AccessRuleAuditLog>,
    );

    service.logSecurityEvent({
      userId: 'user-1',
      kind: 'reuse_detected',
      severity: 'high',
      context: {
        familyId: 'fam-1',
        sessionId: 'sess-1',
        ipAddressAtReuse: '203.0.113.7',
        userAgentAtReuse: 'curl/7.85',
      },
    });

    expect(auditRepo.create).toHaveBeenCalledTimes(1);
    const created = auditRepo.create.mock.calls[0][0] as Partial<AccessAuditLog>;
    expect(created.decision).toBe('HIGH_SEVERITY');
    expect(created.userId).toBe('user-1');
    expect(created.resource).toBe('security_event');
    expect(created.action).toBe('reuse_detected');
    expect(created.context?.additionalData).toMatchObject({
      kind: 'reuse_detected',
      severity: 'high',
      familyId: 'fam-1',
      sessionId: 'sess-1',
      ipAddressAtReuse: '203.0.113.7',
      userAgentAtReuse: 'curl/7.85',
    });
  });
});
