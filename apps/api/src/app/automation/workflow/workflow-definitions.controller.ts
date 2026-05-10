import { Body, Controller, Delete, Get, Param, Post, Put, Query, UseGuards } from '@nestjs/common';
import {
  CurrentUser,
  JwtAuthGuard,
  PermissionsGuard,
  RequestUser,
  RequirePermission,
} from '@hubblewave/auth-guard';
import { WorkflowDefinitionService } from './workflow-definition.service';
import { CreateWorkflowDefinitionRequest, UpdateWorkflowDefinitionRequest } from './workflow.types';

// ADR-12 permission slugs. App Studio's Flows tab is gated client-side by
// metadata.flows.edit; the API mirrors that grant so delegated flow editors
// (non-admins) can list, mutate, and publish flows for collections they own.
// PermissionsGuard's internal admin-bypass keeps platform admins permitted.
@Controller('workflows/definitions')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class WorkflowDefinitionsController {
  constructor(private readonly definitions: WorkflowDefinitionService) {}

  @Get()
  @RequirePermission(['collection.read', 'metadata.flows.edit'], 'any')
  async list(
    @Query('collectionId') collectionId?: string,
    @Query('active') active?: string,
    @Query('code') code?: string,
  ) {
    return this.definitions.list({
      collectionId,
      code,
      active: active === undefined ? undefined : active === 'true',
    });
  }

  @Get(':id')
  @RequirePermission(['collection.read', 'metadata.flows.edit'], 'any')
  async getById(@Param('id') id: string) {
    return this.definitions.getById(id);
  }

  @Post()
  @RequirePermission('metadata.flows.edit')
  async create(
    @Body() body: CreateWorkflowDefinitionRequest,
    @CurrentUser() user?: RequestUser,
  ) {
    return this.definitions.create(body, this.toActor(user));
  }

  @Put(':id')
  @RequirePermission('metadata.flows.edit')
  async update(
    @Param('id') id: string,
    @Body() body: UpdateWorkflowDefinitionRequest,
    @CurrentUser() user?: RequestUser,
  ) {
    return this.definitions.update(id, body, this.toActor(user));
  }

  @Delete(':id')
  @RequirePermission('metadata.flows.edit')
  async delete(@Param('id') id: string, @CurrentUser() user?: RequestUser) {
    return this.definitions.delete(id, user?.id);
  }

  @Post(':id/activate')
  @RequirePermission('metadata.flows.edit')
  async activate(@Param('id') id: string, @CurrentUser() user?: RequestUser) {
    return this.definitions.activate(id, user?.id);
  }

  @Post(':id/deactivate')
  @RequirePermission('metadata.flows.edit')
  async deactivate(@Param('id') id: string, @CurrentUser() user?: RequestUser) {
    return this.definitions.deactivate(id, user?.id);
  }

  @Post(':id/duplicate')
  @RequirePermission('metadata.flows.edit')
  async duplicate(
    @Param('id') id: string,
    @Body() body: { code: string },
    @CurrentUser() user?: RequestUser,
  ) {
    return this.definitions.duplicate(id, body.code, this.toActor(user));
  }

  @Post(':id/publish')
  @RequirePermission('metadata.flows.edit')
  async publish(@Param('id') id: string, @CurrentUser() user?: RequestUser) {
    return this.definitions.publish(id, user?.id);
  }

  @Post(':id/deprecate')
  @RequirePermission('metadata.flows.edit')
  async deprecate(@Param('id') id: string, @CurrentUser() user?: RequestUser) {
    return this.definitions.deprecate(id, user?.id);
  }

  /**
   * Plan §8.1.8 — flow test runner.
   *
   * Runs the flow against caller-supplied mock input data inside a
   * "test-mode" context. The runner enforces:
   *  - Caller must hold `metadata.flows.edit` for this collection
   *    (already gated by the controller-level guard).
   *  - The flow runs as the caller (not the flow's runAs setting),
   *    so the caller's authz applies — they cannot test-run with
   *    elevated privileges.
   *  - `dryRun` defaults to `true`: record-mutating actions short-
   *    circuit before SQL writes; the engine returns the planned
   *    actions in the step-by-step log so the author can verify the
   *    intended effect without polluting production data.
   *  - Set `dryRun: false` to run a wet test (real writes); useful
   *    when the canvas integrates against a real connector.
   */
  @Post(':id/test-run')
  @RequirePermission('metadata.flows.edit')
  async testRun(
    @Param('id') id: string,
    @Body() body: { input?: Record<string, unknown>; recordId?: string; dryRun?: boolean },
    @CurrentUser() user?: RequestUser,
  ) {
    return this.definitions.testRun(
      id,
      {
        input: body.input ?? {},
        recordId: body.recordId,
        dryRun: body.dryRun !== false,
      },
      this.toActor(user),
    );
  }

  @Get(':id/revisions')
  @RequirePermission(['collection.read', 'metadata.flows.edit'], 'any')
  async listRevisions(@Param('id') id: string) {
    return this.definitions.listRevisions(id);
  }

  private toActor(user?: RequestUser) {
    if (!user) return undefined;
    return {
      id: user.id,
      roles: user.roles,
      permissions: user.permissions,
    };
  }
}
