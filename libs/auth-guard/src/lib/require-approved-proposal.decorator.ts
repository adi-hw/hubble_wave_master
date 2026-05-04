import { SetMetadata } from '@nestjs/common';

export const REQUIRE_APPROVED_PROPOSAL_KEY = 'requireApprovedProposal';

/**
 * Marks a handler as requiring an approved AvaProposal.
 *
 * The handler must receive a `proposalId` either in the JSON body or via the
 * `X-Ava-Proposal-Id` header. The {@link RequireApprovedProposalGuard} loads
 * the proposal, verifies it is in the 'approved' state, and stashes it on
 * the request as `req.avaProposal` for downstream use.
 *
 * Canon §12: AVA actions must progress Suggest → Preview → Approve → Execute
 * → Audit. This decorator is how individual execution endpoints enforce the
 * 'approved' precondition.
 *
 * @example
 * ```typescript
 * @Post('execute')
 * @UseGuards(JwtAuthGuard, RequireApprovedProposalGuard)
 * @RequireApprovedProposal()
 * async execute(@Body() body: ExecuteDto) { ... }
 * ```
 */
export const RequireApprovedProposal = (): MethodDecorator =>
  SetMetadata(REQUIRE_APPROVED_PROPOSAL_KEY, true);
