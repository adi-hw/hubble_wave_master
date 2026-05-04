import { NotFoundException } from '@nestjs/common';
import { DataSource, EntityManager, Repository } from 'typeorm';
import { AvaProposal, AvaProposalState } from '../entities/ava-proposal.entity';
import { AuditLog } from '../entities/settings.entity';
import { AvaProposalService } from './ava-proposal.service';
import { BadStateTransitionException } from './bad-state-transition.exception';

/**
 * In-memory fake for the AvaProposal repository. Backs both the read path
 * (`findById`, called outside the transaction) and the write path (called
 * via `mgr.getRepository(AvaProposal)` inside `withAudit`).
 *
 * Mirrors the W1.6 svc-data spec pattern: tests provide a DataSource whose
 * `transaction(fn)` invokes `fn` synchronously with a fake EntityManager.
 * On thrown errors we drop the in-memory writes to mimic real TypeORM
 * rollback semantics, which lets us assert the canon §10 contract.
 */
class FakeProposalRepository {
  private store = new Map<string, AvaProposal>();
  private idCounter = 0;

  create(partial: Partial<AvaProposal>): AvaProposal {
    return partial as AvaProposal;
  }

  async save(entity: AvaProposal): Promise<AvaProposal> {
    if (!entity.id) {
      this.idCounter += 1;
      entity.id = `proposal-${this.idCounter}`;
      entity.createdAt = new Date();
    }
    entity.updatedAt = new Date();
    this.store.set(entity.id, { ...entity });
    return { ...entity };
  }

  async findOne(opts: { where: { id: string } }): Promise<AvaProposal | null> {
    const value = this.store.get(opts.where.id);
    return value ? { ...value } : null;
  }

  size(): number {
    return this.store.size;
  }

  set(proposal: AvaProposal): void {
    this.store.set(proposal.id, { ...proposal });
  }

  snapshot(): Map<string, AvaProposal> {
    return new Map(
      Array.from(this.store.entries()).map(([id, value]) => [id, { ...value }]),
    );
  }

  restore(snapshot: Map<string, AvaProposal>): void {
    this.store = new Map(
      Array.from(snapshot.entries()).map(([id, value]) => [id, { ...value }]),
    );
  }
}

class FakeAuditRepository {
  public entries: AuditLog[] = [];
  public throwOnSave: Error | null = null;

  create(partial: Partial<AuditLog>): AuditLog {
    return partial as AuditLog;
  }

  async save(entries: AuditLog[] | AuditLog): Promise<AuditLog[] | AuditLog> {
    if (this.throwOnSave) {
      throw this.throwOnSave;
    }
    const list = Array.isArray(entries) ? entries : [entries];
    for (const entry of list) {
      if (!entry.id) {
        entry.id = `audit-${this.entries.length + 1}`;
      }
      this.entries.push({ ...entry });
    }
    return entries;
  }

  snapshot(): AuditLog[] {
    return this.entries.map((e) => ({ ...e }));
  }

  restore(snapshot: AuditLog[]): void {
    this.entries = snapshot.map((e) => ({ ...e }));
  }
}

function buildService(): {
  service: AvaProposalService;
  proposalRepo: FakeProposalRepository;
  auditRepo: FakeAuditRepository;
  dataSource: DataSource;
} {
  const proposalRepo = new FakeProposalRepository();
  const auditRepo = new FakeAuditRepository();

  // The shared EntityManager exposes both fakes by entity class so the
  // production code in AvaProposalService and withAudit can reach them
  // through `mgr.getRepository(...)`.
  const mgr = {
    getRepository(entity: unknown): Repository<AvaProposal | AuditLog> {
      if (entity === AvaProposal) {
        return proposalRepo as unknown as Repository<AvaProposal>;
      }
      if (entity === AuditLog) {
        return auditRepo as unknown as Repository<AuditLog>;
      }
      throw new Error(`Unexpected entity in test: ${String(entity)}`);
    },
  } as unknown as EntityManager;

  // The fake DataSource's `transaction(fn)` mirrors TypeORM's contract:
  // run fn(mgr); on success the in-memory writes stay; on error roll back
  // by restoring the snapshots taken before fn ran.
  const dataSource = {
    getRepository(entity: unknown): Repository<AvaProposal | AuditLog> {
      if (entity === AvaProposal) {
        return proposalRepo as unknown as Repository<AvaProposal>;
      }
      if (entity === AuditLog) {
        return auditRepo as unknown as Repository<AuditLog>;
      }
      throw new Error(`Unexpected entity in test: ${String(entity)}`);
    },
    async transaction<T>(fn: (m: EntityManager) => Promise<T>): Promise<T> {
      const proposalSnap = proposalRepo.snapshot();
      const auditSnap = auditRepo.snapshot();
      try {
        return await fn(mgr);
      } catch (err) {
        proposalRepo.restore(proposalSnap);
        auditRepo.restore(auditSnap);
        throw err;
      }
    },
  } as unknown as DataSource;

  const service = new AvaProposalService(dataSource);
  return { service, proposalRepo, auditRepo, dataSource };
}

async function seed(
  service: AvaProposalService,
  state: AvaProposalState,
  proposalRepo: FakeProposalRepository,
): Promise<AvaProposal> {
  const created = await service.suggest('create_record', { foo: 'bar' }, 'why');
  if (state === 'suggested') return created;

  const updated: AvaProposal = {
    ...created,
    state,
    actorId: 'user-1',
    previewResult: state === 'previewed' ? { dryRun: true } : created.previewResult,
  };
  proposalRepo.set(updated);
  return updated;
}

describe('AvaProposalService', () => {
  describe('suggest', () => {
    it('creates a proposal in the suggested state and writes an audit entry', async () => {
      const { service, auditRepo } = buildService();

      const proposal = await service.suggest(
        'create_record',
        { collection: 'orders' },
        'AVA detected an unfulfilled order',
      );

      expect(proposal.state).toBe('suggested');
      expect(proposal.kind).toBe('create_record');
      expect(proposal.payload).toEqual({ collection: 'orders' });
      expect(proposal.rationale).toBe('AVA detected an unfulfilled order');
      expect(auditRepo.entries).toHaveLength(1);
      expect(auditRepo.entries[0].action).toBe('ava_proposal.suggested');
      expect(auditRepo.entries[0].userId).toBeNull();
    });
  });

  describe('preview', () => {
    it('transitions suggested → previewed and audits the change', async () => {
      const { service, proposalRepo, auditRepo } = buildService();
      const created = await seed(service, 'suggested', proposalRepo);

      const previewed = await service.preview(created.id, 'user-1', { dryRun: true });

      expect(previewed.state).toBe('previewed');
      expect(previewed.actorId).toBe('user-1');
      expect(previewed.previewResult).toEqual({ dryRun: true });
      expect(auditRepo.entries.map((e) => e.action)).toEqual([
        'ava_proposal.suggested',
        'ava_proposal.previewed',
      ]);
      expect(auditRepo.entries[1].oldValues).toEqual({ state: 'suggested' });
    });

    it('rejects preview from any state other than suggested', async () => {
      for (const start of ['previewed', 'approved', 'rejected', 'executed', 'failed'] as const) {
        const { service, proposalRepo } = buildService();
        const seeded = await seed(service, start, proposalRepo);
        await expect(
          service.preview(seeded.id, 'user-1', {}),
        ).rejects.toBeInstanceOf(BadStateTransitionException);
      }
    });

    it('throws NotFoundException when the proposal is missing', async () => {
      const { service } = buildService();
      await expect(service.preview('missing', 'user-1', {})).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });
  });

  describe('approve', () => {
    it('transitions previewed → approved and audits the change', async () => {
      const { service, proposalRepo, auditRepo } = buildService();
      const seeded = await seed(service, 'previewed', proposalRepo);

      const approved = await service.approve(seeded.id, 'user-2');

      expect(approved.state).toBe('approved');
      expect(approved.actorId).toBe('user-2');
      const lastAudit = auditRepo.entries[auditRepo.entries.length - 1];
      expect(lastAudit.action).toBe('ava_proposal.approved');
      expect(lastAudit.userId).toBe('user-2');
    });

    it('cannot approve a suggested proposal directly (Suggest → Approve is illegal)', async () => {
      const { service, proposalRepo } = buildService();
      const seeded = await seed(service, 'suggested', proposalRepo);

      await expect(service.approve(seeded.id, 'user-2')).rejects.toBeInstanceOf(
        BadStateTransitionException,
      );
    });

    it('rejects approve from terminal states', async () => {
      for (const start of ['rejected', 'executed', 'failed'] as const) {
        const { service, proposalRepo } = buildService();
        const seeded = await seed(service, start, proposalRepo);
        await expect(service.approve(seeded.id, 'user-2')).rejects.toBeInstanceOf(
          BadStateTransitionException,
        );
      }
    });
  });

  describe('reject', () => {
    it('transitions any non-terminal state to rejected with a reason', async () => {
      for (const start of ['suggested', 'previewed', 'approved'] as const) {
        const { service, proposalRepo, auditRepo } = buildService();
        const seeded = await seed(service, start, proposalRepo);

        const rejected = await service.reject(seeded.id, 'user-3', 'no longer relevant');

        expect(rejected.state).toBe('rejected');
        expect(rejected.rejectionReason).toBe('no longer relevant');
        const lastAudit = auditRepo.entries[auditRepo.entries.length - 1];
        expect(lastAudit.action).toBe('ava_proposal.rejected');
        expect((lastAudit.newValues as Record<string, unknown>)['reason']).toBe(
          'no longer relevant',
        );
      }
    });

    it('cannot reject a terminal-state proposal', async () => {
      for (const start of ['rejected', 'executed', 'failed'] as const) {
        const { service, proposalRepo } = buildService();
        const seeded = await seed(service, start, proposalRepo);
        await expect(
          service.reject(seeded.id, 'user-3', 'too late'),
        ).rejects.toBeInstanceOf(BadStateTransitionException);
      }
    });
  });

  describe('markExecuted', () => {
    it('transitions approved → executed and stores the execution result', async () => {
      const { service, proposalRepo, auditRepo } = buildService();
      const seeded = await seed(service, 'approved', proposalRepo);

      const executed = await service.markExecuted(seeded.id, { rowsAffected: 1 });

      expect(executed.state).toBe('executed');
      expect(executed.executionResult).toEqual({ rowsAffected: 1 });
      const lastAudit = auditRepo.entries[auditRepo.entries.length - 1];
      expect(lastAudit.action).toBe('ava_proposal.executed');
    });

    it('cannot execute a previewed proposal (Preview → Execute is illegal)', async () => {
      const { service, proposalRepo } = buildService();
      const seeded = await seed(service, 'previewed', proposalRepo);
      await expect(
        service.markExecuted(seeded.id, {}),
      ).rejects.toBeInstanceOf(BadStateTransitionException);
    });

    it('cannot execute a suggested proposal (Suggest → Execute is illegal)', async () => {
      const { service, proposalRepo } = buildService();
      const seeded = await seed(service, 'suggested', proposalRepo);
      await expect(
        service.markExecuted(seeded.id, {}),
      ).rejects.toBeInstanceOf(BadStateTransitionException);
    });
  });

  describe('markFailed', () => {
    it('transitions approved → failed and records the error', async () => {
      const { service, proposalRepo, auditRepo } = buildService();
      const seeded = await seed(service, 'approved', proposalRepo);

      const failed = await service.markFailed(seeded.id, 'database unavailable');

      expect(failed.state).toBe('failed');
      expect((failed.executionResult as Record<string, unknown>)['error']).toBe(
        'database unavailable',
      );
      const lastAudit = auditRepo.entries[auditRepo.entries.length - 1];
      expect(lastAudit.action).toBe('ava_proposal.failed');
    });

    it('cannot mark a non-approved proposal as failed', async () => {
      for (const start of ['suggested', 'previewed', 'rejected', 'executed', 'failed'] as const) {
        const { service, proposalRepo } = buildService();
        const seeded = await seed(service, start, proposalRepo);
        await expect(
          service.markFailed(seeded.id, 'whatever'),
        ).rejects.toBeInstanceOf(BadStateTransitionException);
      }
    });
  });

  describe('findById', () => {
    it('returns null for an unknown proposal', async () => {
      const { service } = buildService();
      await expect(service.findById('nope')).resolves.toBeNull();
    });

    it('returns the persisted proposal', async () => {
      const { service } = buildService();
      const created = await service.suggest('update_record', { id: 'r1' });
      const fetched = await service.findById(created.id);
      expect(fetched?.id).toBe(created.id);
      expect(fetched?.kind).toBe('update_record');
    });
  });

  describe('audit emission', () => {
    it('emits exactly one AuditLog per state transition across the full happy path', async () => {
      const { service, auditRepo } = buildService();
      const created = await service.suggest('run_automation', {});
      await service.preview(created.id, 'u', { dryRun: true });
      await service.approve(created.id, 'u');
      await service.markExecuted(created.id, { ok: true });

      expect(auditRepo.entries.map((e) => e.action)).toEqual([
        'ava_proposal.suggested',
        'ava_proposal.previewed',
        'ava_proposal.approved',
        'ava_proposal.executed',
      ]);
      expect(
        auditRepo.entries.every((e) => e.collectionCode === 'ava_proposal'),
      ).toBe(true);
      expect(auditRepo.entries.every((e) => e.recordId === created.id)).toBe(true);
    });
  });

  /**
   * Canon §10 chaos contract: state mutation and audit row commit-or-
   * rollback together. If the audit save throws after the proposal save
   * succeeds, the entire transaction must roll back so the proposal's
   * persisted state stays at its prior value and no audit row is written.
   *
   * W6.C originally wrote audit rows OUTSIDE the proposal-mutation
   * transaction; W7.A wraps both in `withAudit`. This test fails if a
   * future refactor pulls them apart again.
   */
  describe('chaos: audit-rollback contract (W7.A / canon §10)', () => {
    it('rolls back the state transition when the audit save fails', async () => {
      const { service, proposalRepo, auditRepo } = buildService();
      const seeded = await seed(service, 'previewed', proposalRepo);
      const auditCountBefore = auditRepo.entries.length;

      auditRepo.throwOnSave = new Error('audit write failed');

      await expect(service.approve(seeded.id, 'user-2')).rejects.toThrow(
        'audit write failed',
      );

      // Drop the chaos hook so the post-condition reads run cleanly.
      auditRepo.throwOnSave = null;

      // The proposal's persisted state must remain at 'previewed' — the
      // approve transition was rolled back along with the audit failure.
      const after = await service.findById(seeded.id);
      expect(after?.state).toBe('previewed');
      expect(after?.actorId).toBe('user-1');

      // No audit row was written for the failed approval.
      expect(auditRepo.entries.length).toBe(auditCountBefore);
      expect(auditRepo.entries.every((e) => e.action !== 'ava_proposal.approved')).toBe(
        true,
      );
    });
  });
});
