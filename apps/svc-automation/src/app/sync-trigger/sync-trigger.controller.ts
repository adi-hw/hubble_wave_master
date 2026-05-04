import { Body, Controller, Post, Req, UseGuards } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import {
  AuthenticatedOnly,
  extractContext,
  InstanceRequest,
  JwtAuthGuard,
} from '@hubblewave/auth-guard';
import { SyncTriggerService } from './sync-trigger.service';
import {
  ExecuteSyncTriggerRequestDto,
  ExecuteSyncTriggerResponseDto,
} from './sync-trigger.dto';

/**
 * HTTP boundary for synchronous (in-request, before/after) automation
 * triggers. Other instance services (today: svc-data) call this when a
 * record-write request needs `before` triggers to evaluate, mutate, or
 * abort in-flight, or when an `after` trigger needs to run inside the
 * caller's request lifecycle rather than via the post-commit outbox.
 *
 * Authn: standard JwtAuthGuard. The user JWT must be the original
 * end-user's, forwarded by the calling service. Service-to-service
 * impersonation (a system token claiming to be a user) is not
 * permitted on this path — use the async outbox path for system-
 * initiated work.
 *
 * Authz: `@AuthenticatedOnly`. Synchronous-trigger evaluation is
 * intrinsically a side-effect of any record write; anyone with a
 * valid JWT who can write the originating record can also fire its
 * triggers. Per-user lockdown is a customer-administration concern
 * (a customer who wants to revoke trigger evaluation for a specific
 * role can introduce a permission slug at that point), not a
 * platform-default gate.
 */
@ApiTags('Automation - Sync Trigger')
@ApiBearerAuth()
@Controller('api/automation/sync-trigger')
export class SyncTriggerController {
  constructor(private readonly service: SyncTriggerService) {}

  @Post('execute')
  @UseGuards(JwtAuthGuard)
  @AuthenticatedOnly()
  @ApiOperation({
    summary: 'Execute synchronous automation triggers for a collection event',
    description:
      'Runs all matching automations for the given (collectionId, timing, ' +
      'operation) tuple in the caller\'s request lifecycle. Returns the ' +
      'modified record, accumulated errors/warnings, the queue of post-' +
      'commit actions, and an abort signal that the caller MUST honor by ' +
      'rejecting its own write when set.',
  })
  @ApiResponse({ status: 200, description: 'Triggers executed (may include aborted result)' })
  @ApiResponse({ status: 400, description: 'Invalid request shape' })
  @ApiResponse({ status: 401, description: 'Missing or invalid Bearer token' })
  async execute(
    @Body() request: ExecuteSyncTriggerRequestDto,
    @Req() req: InstanceRequest,
  ): Promise<ExecuteSyncTriggerResponseDto> {
    const ctx = extractContext(req);
    return this.service.execute(request, ctx);
  }
}
