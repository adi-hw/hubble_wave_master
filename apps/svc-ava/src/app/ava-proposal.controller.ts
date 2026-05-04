import {
  Body,
  Controller,
  Get,
  NotFoundException,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import {
  AvaProposal,
  AvaProposalService,
} from '@hubblewave/instance-db';
import { CurrentUser, JwtAuthGuard, RequestUser } from '@hubblewave/auth-guard';

interface SuggestProposalDto {
  kind: string;
  payload: Record<string, unknown>;
  rationale?: string;
}

interface PreviewProposalDto {
  previewResult: Record<string, unknown>;
}

interface RejectProposalDto {
  reason: string;
}

interface ExecuteProposalDto {
  // Allow callers to pass a result snapshot when they handle execution
  // entirely client-side (rare). The full server-side executor path will
  // call markExecuted/markFailed directly via AvaProposalService.
  executionResult?: Record<string, unknown>;
}

/**
 * AVA Proposal lifecycle controller — exposes the canon §12 state machine
 * (Suggest → Preview → Approve → Execute → Audit) over HTTP.
 *
 * AVA itself only ever creates proposals. It never advances them. Operators
 * (or, in a future iteration, an auto-approval policy) move a proposal
 * through preview → approve. The execute endpoint records execution
 * outcomes; the underlying mutation is wired in service-by-service via the
 * `RequireApprovedProposalGuard`.
 */
@ApiTags('AVA - Proposals')
@ApiBearerAuth()
@Controller('api/ava/proposals')
@UseGuards(JwtAuthGuard)
export class AvaProposalController {
  constructor(private readonly proposalService: AvaProposalService) {}

  @Post()
  @ApiOperation({
    summary: 'AVA emits a suggested proposal',
    description:
      'Creates a proposal in the "suggested" state. AVA never executes ' +
      'directly — every action begins life as a proposal that an operator ' +
      'must approve.',
  })
  @ApiResponse({ status: 201, description: 'Proposal created in suggested state' })
  async suggest(@Body() dto: SuggestProposalDto): Promise<AvaProposal> {
    return this.proposalService.suggest(dto.kind, dto.payload, dto.rationale);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Fetch a proposal by id' })
  @ApiResponse({ status: 200, description: 'Proposal' })
  async findOne(@Param('id') id: string): Promise<AvaProposal> {
    const proposal = await this.proposalService.findById(id);
    if (!proposal) {
      throw new NotFoundException(`Proposal ${id} not found`);
    }
    return proposal;
  }

  @Post(':id/preview')
  @ApiOperation({
    summary: 'Transition: suggested → previewed',
    description:
      'Records a dry-run result alongside the proposal so an approver can ' +
      'see exactly what will happen before consenting.',
  })
  @ApiResponse({ status: 200, description: 'Proposal transitioned to previewed' })
  async preview(
    @Param('id') id: string,
    @CurrentUser() user: RequestUser,
    @Body() dto: PreviewProposalDto,
  ): Promise<AvaProposal> {
    return this.proposalService.preview(id, user.id, dto.previewResult);
  }

  @Post(':id/approve')
  @ApiOperation({
    summary: 'Transition: previewed → approved',
    description:
      'Default policy is one explicit approval per proposal — no implicit ' +
      'or batch approvals. Auto-approval for low-risk operations is ' +
      'deferred to a follow-up.',
  })
  @ApiResponse({ status: 200, description: 'Proposal transitioned to approved' })
  async approve(
    @Param('id') id: string,
    @CurrentUser() user: RequestUser,
  ): Promise<AvaProposal> {
    return this.proposalService.approve(id, user.id);
  }

  @Post(':id/reject')
  @ApiOperation({ summary: 'Transition: any non-terminal state → rejected' })
  @ApiResponse({ status: 200, description: 'Proposal transitioned to rejected' })
  async reject(
    @Param('id') id: string,
    @CurrentUser() user: RequestUser,
    @Body() dto: RejectProposalDto,
  ): Promise<AvaProposal> {
    return this.proposalService.reject(id, user.id, dto.reason);
  }

  @Post(':id/execute')
  @ApiOperation({
    summary: 'Transition: approved → executed (or failed)',
    description:
      'For server-side mutations the canonical path is for the executing ' +
      'service to call AvaProposalService.markExecuted / markFailed ' +
      'directly. This endpoint exists so a proposal whose execution lives ' +
      'entirely client-side (e.g. a UI navigation action) can still be ' +
      'closed out properly.',
  })
  @ApiResponse({
    status: 200,
    description: 'Proposal closed out as executed',
  })
  async execute(
    @Param('id') id: string,
    @Body() dto: ExecuteProposalDto,
  ): Promise<AvaProposal> {
    return this.proposalService.markExecuted(id, dto.executionResult ?? {});
  }
}
