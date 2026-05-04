import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { DataSource, Repository } from 'typeorm';
import { AvaProposal, AvaProposalState } from '../entities/ava-proposal.entity';
import { AuditLog } from '../entities/settings.entity';
import { BadStateTransitionException } from './bad-state-transition.exception';

/**
 * Allowed forward transitions for the AvaProposal state machine.
 *
 * Rejection is handled separately because it is permitted from any
 * non-terminal state (see {@link TERMINAL_STATES}).
 */
const ALLOWED_TRANSITIONS: Record<AvaProposalState, AvaProposalState[]> = {
  suggested: ['previewed', 'rejected'],
  previewed: ['approved', 'rejected'],
  approved: ['executed', 'failed'],
  rejected: [],
  executed: [],
  failed: [],
};

const TERMINAL_STATES: ReadonlySet<AvaProposalState> = new Set([
  'rejected',
  'executed',
  'failed',
]);

/**
 * AvaProposalService — implements the AVA proposal lifecycle defined in
 * canon §12 (Suggest → Preview → Approve → Execute → Audit).
 *
 * Each transition method is the only sanctioned way to mutate proposal
 * state. Illegal transitions throw {@link BadStateTransitionException};
 * every transition writes an AuditLog entry so the lifecycle is fully
 * reconstructible.
 *
 * AVA itself never executes a mutation directly. It calls {@link suggest}
 * to record an intent. Operators invoke {@link preview}, {@link approve},
 * {@link reject}; downstream executors call {@link markExecuted} or
 * {@link markFailed} after running the approved action.
 */
@Injectable()
export class AvaProposalService {
  private readonly logger = new Logger(AvaProposalService.name);

  constructor(private readonly dataSource: DataSource) {}

  /**
   * Create a new proposal in the 'suggested' state.
   * Called by AVA when it has an action to propose.
   */
  async suggest(
    kind: string,
    payload: Record<string, unknown>,
    rationale?: string,
  ): Promise<AvaProposal> {
    const repo = this.repo();
    const proposal = repo.create({
      kind,
      payload,
      rationale: rationale ?? null,
      state: 'suggested',
    });
    const saved = await repo.save(proposal);
    await this.recordAudit(saved, null, 'suggested', null, {
      kind,
      hasRationale: Boolean(rationale),
    });
    return saved;
  }

  /**
   * Transition: suggested → previewed.
   * Records the dry-run result so an approver sees what will happen.
   */
  async preview(
    id: string,
    actorId: string,
    previewResult: Record<string, unknown>,
  ): Promise<AvaProposal> {
    const proposal = await this.requireProposal(id);
    this.assertTransition(proposal, 'previewed');

    const previousState = proposal.state;
    proposal.state = 'previewed';
    proposal.actorId = actorId;
    proposal.previewResult = previewResult;
    const saved = await this.repo().save(proposal);

    await this.recordAudit(saved, actorId, 'previewed', previousState, {
      previewResultKeys: Object.keys(previewResult),
    });
    return saved;
  }

  /**
   * Transition: previewed → approved.
   * Default policy: every approval requires an explicit operator action.
   */
  async approve(id: string, actorId: string): Promise<AvaProposal> {
    const proposal = await this.requireProposal(id);
    this.assertTransition(proposal, 'approved');

    const previousState = proposal.state;
    proposal.state = 'approved';
    proposal.actorId = actorId;
    const saved = await this.repo().save(proposal);

    await this.recordAudit(saved, actorId, 'approved', previousState, null);
    return saved;
  }

  /**
   * Transition: any non-terminal state → rejected.
   */
  async reject(id: string, actorId: string, reason: string): Promise<AvaProposal> {
    const proposal = await this.requireProposal(id);
    if (TERMINAL_STATES.has(proposal.state)) {
      throw new BadStateTransitionException(proposal.id, proposal.state, 'rejected');
    }

    const previousState = proposal.state;
    proposal.state = 'rejected';
    proposal.actorId = actorId;
    proposal.rejectionReason = reason;
    const saved = await this.repo().save(proposal);

    await this.recordAudit(saved, actorId, 'rejected', previousState, { reason });
    return saved;
  }

  /**
   * Transition: approved → executed.
   * Called by the downstream executor after the action succeeds.
   */
  async markExecuted(
    id: string,
    executionResult: Record<string, unknown>,
  ): Promise<AvaProposal> {
    const proposal = await this.requireProposal(id);
    this.assertTransition(proposal, 'executed');

    const previousState = proposal.state;
    proposal.state = 'executed';
    proposal.executionResult = executionResult;
    const saved = await this.repo().save(proposal);

    await this.recordAudit(saved, proposal.actorId ?? null, 'executed', previousState, {
      executionResultKeys: Object.keys(executionResult),
    });
    return saved;
  }

  /**
   * Transition: approved → failed.
   * Called by the downstream executor when the action throws.
   */
  async markFailed(id: string, error: string): Promise<AvaProposal> {
    const proposal = await this.requireProposal(id);
    this.assertTransition(proposal, 'failed');

    const previousState = proposal.state;
    proposal.state = 'failed';
    proposal.executionResult = { error };
    const saved = await this.repo().save(proposal);

    await this.recordAudit(saved, proposal.actorId ?? null, 'failed', previousState, {
      error,
    });
    return saved;
  }

  /**
   * Lookup helper — used by the RequireApprovedProposalGuard and the
   * proposal lifecycle controller. Returns null when the proposal is not found.
   */
  async findById(id: string): Promise<AvaProposal | null> {
    return this.repo().findOne({ where: { id } });
  }

  private repo(): Repository<AvaProposal> {
    return this.dataSource.getRepository(AvaProposal);
  }

  private async requireProposal(id: string): Promise<AvaProposal> {
    const proposal = await this.findById(id);
    if (!proposal) {
      throw new NotFoundException(`AvaProposal ${id} not found`);
    }
    return proposal;
  }

  private assertTransition(proposal: AvaProposal, target: AvaProposalState): void {
    const allowed = ALLOWED_TRANSITIONS[proposal.state];
    if (!allowed.includes(target)) {
      throw new BadStateTransitionException(proposal.id, proposal.state, target);
    }
  }

  private async recordAudit(
    proposal: AvaProposal,
    actorId: string | null,
    newState: AvaProposalState,
    previousState: AvaProposalState | null,
    metadata: Record<string, unknown> | null,
  ): Promise<void> {
    try {
      const repo = this.dataSource.getRepository(AuditLog);
      const entry = repo.create({
        userId: actorId ?? null,
        collectionCode: 'ava_proposal',
        recordId: proposal.id,
        action: `ava_proposal.${newState}`,
        oldValues: previousState ? { state: previousState } : null,
        newValues: {
          state: newState,
          kind: proposal.kind,
          ...(metadata ?? {}),
        },
      });
      await repo.save(entry);
    } catch (err) {
      this.logger.warn(
        `Failed to write audit log for AvaProposal ${proposal.id} → ${newState}: ${(err as Error).message}`,
      );
    }
  }
}
