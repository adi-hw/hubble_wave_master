import { BadRequestException } from '@nestjs/common';
import { AvaProposalState } from '../entities/ava-proposal.entity';

/**
 * Thrown when a caller attempts an illegal AvaProposal state transition.
 *
 * The state machine (canon §12) only permits:
 *   suggested → previewed | rejected
 *   previewed → approved  | rejected
 *   approved  → executed  | failed
 *
 * Any other transition (e.g. suggested → approved, executed → previewed)
 * raises this exception so the violation surfaces as a 400 to the client
 * rather than silently corrupting the lifecycle.
 */
export class BadStateTransitionException extends BadRequestException {
  constructor(
    public readonly proposalId: string,
    public readonly fromState: AvaProposalState,
    public readonly toState: AvaProposalState,
  ) {
    super(
      `AvaProposal ${proposalId}: illegal state transition '${fromState}' → '${toState}'. ` +
        `Canon §12 requires Suggest → Preview → Approve → Execute → Audit progression.`,
    );
  }
}
