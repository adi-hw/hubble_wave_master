import {
  BadRequestException,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { REQUIRE_APPROVED_PROPOSAL_KEY } from './require-approved-proposal.decorator';

/**
 * Minimal contract the guard needs from any AvaProposal-style service.
 *
 * Defining the shape locally lets `@hubblewave/auth-guard` stay free of a
 * hard dependency on `@hubblewave/instance-db`. The concrete service is
 * supplied by the consuming app via the `AvaProposalService` DI token.
 */
export interface AvaProposalLookup {
  findById(id: string): Promise<{
    id: string;
    state: 'suggested' | 'previewed' | 'approved' | 'rejected' | 'executed' | 'failed';
    [key: string]: unknown;
  } | null>;
}

/**
 * DI token used by the guard to locate the proposal service.
 * The InstanceDbModule already registers a 'AvaProposalService' string token
 * pointing at the concrete `AvaProposalService`.
 */
export const AVA_PROPOSAL_SERVICE_TOKEN = 'AvaProposalService';

/**
 * RequireApprovedProposalGuard — enforces canon §12 at the handler level.
 *
 * Activates only when {@link REQUIRE_APPROVED_PROPOSAL_KEY} is set on the
 * route. Looks up the referenced proposal and rejects the request unless
 * it is in the 'approved' state, then stashes the proposal on
 * `request.avaProposal` for downstream use.
 *
 * Errors:
 *   - 400 BadRequestException — no proposalId on the request
 *   - 404 NotFoundException   — proposalId references no existing proposal
 *   - 403 ForbiddenException  — proposal is in any state other than 'approved'
 */
@Injectable()
export class RequireApprovedProposalGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    @Inject(AVA_PROPOSAL_SERVICE_TOKEN)
    private readonly proposalService: AvaProposalLookup,
  ) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const required = this.reflector.get<boolean>(
      REQUIRE_APPROVED_PROPOSAL_KEY,
      ctx.getHandler(),
    );
    if (!required) {
      return true;
    }

    const req = ctx.switchToHttp().getRequest();
    const proposalId =
      (req.body && req.body.proposalId) ||
      (req.headers && req.headers['x-ava-proposal-id']);

    if (!proposalId) {
      throw new BadRequestException(
        '@RequireApprovedProposal handler requires proposalId in body or X-Ava-Proposal-Id header',
      );
    }

    const proposal = await this.proposalService.findById(String(proposalId));
    if (!proposal) {
      throw new NotFoundException(`Proposal ${proposalId} not found`);
    }

    if (proposal.state !== 'approved') {
      throw new ForbiddenException(
        `Proposal ${proposalId} is in state '${proposal.state}', must be 'approved' to execute`,
      );
    }

    // Stash for the handler — consumers may type req.avaProposal in their
    // own request augmentation.
    (req as Record<string, unknown>)['avaProposal'] = proposal;
    return true;
  }
}
