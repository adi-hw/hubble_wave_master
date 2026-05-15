import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

/**
 * Lifecycle states for an AVA proposal.
 *
 * Canon §12: AVA progression — Suggest → Preview → Approve → Execute → Audit.
 *
 * Allowed transitions:
 *   suggested → previewed | rejected
 *   previewed → approved  | rejected
 *   approved  → executed  | failed
 *
 * Terminal states: executed, failed, rejected.
 *
 * A proposal must reach 'approved' before any execute step can run; this is
 * enforced both in {@link AvaProposalService} and the
 * `RequireApprovedProposalGuard`.
 */
export type AvaProposalState =
  | 'suggested'
  | 'previewed'
  | 'approved'
  | 'rejected'
  | 'executed'
  | 'failed';

/**
 * AvaProposal — the canonical record of an AVA-originated action moving
 * through the Suggest → Preview → Approve → Execute → Audit progression.
 *
 * AVA never executes mutations directly. It emits proposals; an operator
 * (or, in a future iteration, an auto-approval policy) advances the
 * proposal through the state machine, and only an 'approved' proposal is
 * eligible for execution.
 */
@Entity({ name: 'ava_proposal', schema: 'ava' })
@Index(['state', 'createdAt'])
@Index(['actorId', 'state'])
export class AvaProposal {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  /**
   * The kind of action being proposed.
   * Examples: 'create_record', 'update_record', 'delete_record', 'run_automation'.
   */
  @Column({ name: 'kind', type: 'varchar', length: 100 })
  kind!: string;

  /**
   * The serialized action payload — exactly what would be executed if
   * the proposal is approved.
   */
  @Column({ name: 'payload', type: 'jsonb' })
  payload!: Record<string, unknown>;

  /**
   * AVA's reasoning for proposing this action. Surfaced to operators during
   * approval; preserved in audit history.
   */
  @Column({ name: 'rationale', type: 'text', nullable: true })
  rationale?: string | null;

  /**
   * Current lifecycle state. See {@link AvaProposalState}.
   */
  @Column({
    name: 'state',
    type: 'enum',
    enum: ['suggested', 'previewed', 'approved', 'rejected', 'executed', 'failed'],
  })
  state!: AvaProposalState;

  /**
   * The user who most recently advanced the proposal's state.
   * Null while the proposal is still in 'suggested' (no operator has touched it).
   */
  @Column({ name: 'actor_id', type: 'uuid', nullable: true })
  actorId?: string | null;

  /**
   * Dry-run result captured during the 'previewed' transition. Used to give
   * operators a deterministic before/after view at approval time.
   */
  @Column({ name: 'preview_result', type: 'jsonb', nullable: true })
  previewResult?: Record<string, unknown> | null;

  /**
   * Result captured when the proposal transitions to 'executed'.
   */
  @Column({ name: 'execution_result', type: 'jsonb', nullable: true })
  executionResult?: Record<string, unknown> | null;

  /**
   * Reason recorded when the proposal transitions to 'rejected'.
   */
  @Column({ name: 'rejection_reason', type: 'text', nullable: true })
  rejectionReason?: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}
