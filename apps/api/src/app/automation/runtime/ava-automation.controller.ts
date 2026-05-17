import {
  BadRequestException,
  Body,
  Controller,
  Inject,
  Logger,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import {
  AuthenticatedOnly,
  JwtAuthGuard,
  RequireApprovedProposal,
  RequireApprovedProposalGuard,
} from '@hubblewave/auth-guard';
import { AvaProposalService } from '@hubblewave/instance-db';
import { AutomationRuntimeService } from './automation-runtime.service';
import { RecordEventPayload } from './automation-runtime.types';

interface ExecuteAvaAutomationDto {
  proposalId: string;
}

/**
 * Entry point for AVA-triggered automation runs.
 *
 * The {@link RequireApprovedProposalGuard} blocks the request unless the
 * referenced proposal is already in the 'approved' state. After a
 * successful run we transition the proposal to 'executed'; on error we
 * transition to 'failed'. Either way the canon §12 lifecycle is closed
 * out and audited.
 */
@ApiTags('Automation - AVA-Triggered')
@ApiBearerAuth()
@Controller('api/automation/ava')
export class AvaAutomationController {
  private readonly logger = new Logger(AvaAutomationController.name);

  constructor(
    private readonly runtime: AutomationRuntimeService,
    @Inject('AvaProposalService')
    private readonly proposals: AvaProposalService,
  ) {}

  @Post('execute')
  @AuthenticatedOnly()
  @UseGuards(JwtAuthGuard, RequireApprovedProposalGuard)
  @RequireApprovedProposal()
  @ApiOperation({
    summary: 'Execute an AVA-approved automation',
    description:
      'Runs an automation triggered by an AVA proposal. The proposal MUST ' +
      'be in the "approved" state — the RequireApprovedProposalGuard ' +
      'rejects the request otherwise.',
  })
  @ApiResponse({ status: 200, description: 'Automation executed successfully' })
  @ApiResponse({ status: 403, description: 'Proposal is not in approved state' })
  async execute(
    @Body() _dto: ExecuteAvaAutomationDto,
    @Req() req: { avaProposal?: { id: string; payload: Record<string, unknown> } },
  ): Promise<{ success: boolean; proposalId: string }> {
    const proposal = req.avaProposal;
    if (!proposal) {
      // Defensive — the guard should have populated this.
      throw new BadRequestException('Proposal context missing on request');
    }

    const payload = proposal.payload as Partial<RecordEventPayload> | undefined;
    if (!payload || !payload.collectionCode || !payload.recordId || !payload.eventType) {
      const failure = await this.proposals.markFailed(
        proposal.id,
        'Proposal payload missing required fields (collectionCode, recordId, eventType)',
      );
      throw new BadRequestException(
        `Proposal ${proposal.id} payload is invalid; marked failed (state=${failure.state})`,
      );
    }

    try {
      await this.runtime.processRecordEvent(payload as RecordEventPayload);
      const updated = await this.proposals.markExecuted(proposal.id, {
        collectionCode: payload.collectionCode,
        recordId: payload.recordId,
        eventType: payload.eventType,
      });
      return { success: true, proposalId: updated.id };
    } catch (err) {
      const message = (err as Error).message ?? 'Unknown error';
      this.logger.error(
        `AVA automation execution failed for proposal ${proposal.id}: ${message}`,
        (err as Error).stack,
      );
      await this.proposals.markFailed(proposal.id, message);
      throw err;
    }
  }
}
