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
// metadata:flow:manage; the API mirrors that grant so delegated flow editors
// (non-admins) can list, mutate, and publish flows for collections they own.
// Platform admins reach the same code via seeded role-permission grants.
@Controller('workflows/definitions')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class WorkflowDefinitionsController {
  constructor(private readonly definitions: WorkflowDefinitionService) {}

  @Get()
  @RequirePermission(['metadata:collection:read', 'metadata:flow:manage'], 'any')
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
  @RequirePermission(['metadata:collection:read', 'metadata:flow:manage'], 'any')
  async getById(@Param('id') id: string) {
    return this.definitions.getById(id);
  }

  @Post()
  @RequirePermission('metadata:flow:manage')
  async create(
    @Body() body: CreateWorkflowDefinitionRequest,
    @CurrentUser() user?: RequestUser,
  ) {
    return this.definitions.create(body, this.toActor(user));
  }

  @Put(':id')
  @RequirePermission('metadata:flow:manage')
  async update(
    @Param('id') id: string,
    @Body() body: UpdateWorkflowDefinitionRequest,
    @CurrentUser() user?: RequestUser,
  ) {
    return this.definitions.update(id, body, this.toActor(user));
  }

  @Delete(':id')
  @RequirePermission('metadata:flow:manage')
  async delete(@Param('id') id: string, @CurrentUser() user?: RequestUser) {
    return this.definitions.delete(id, user?.id);
  }

  @Post(':id/activate')
  @RequirePermission('metadata:flow:manage')
  async activate(@Param('id') id: string, @CurrentUser() user?: RequestUser) {
    return this.definitions.activate(id, user?.id);
  }

  @Post(':id/deactivate')
  @RequirePermission('metadata:flow:manage')
  async deactivate(@Param('id') id: string, @CurrentUser() user?: RequestUser) {
    return this.definitions.deactivate(id, user?.id);
  }

  @Post(':id/duplicate')
  @RequirePermission('metadata:flow:manage')
  async duplicate(
    @Param('id') id: string,
    @Body() body: { code: string },
    @CurrentUser() user?: RequestUser,
  ) {
    return this.definitions.duplicate(id, body.code, this.toActor(user));
  }

  @Post(':id/publish')
  @RequirePermission('metadata:flow:manage')
  async publish(@Param('id') id: string, @CurrentUser() user?: RequestUser) {
    return this.definitions.publish(id, user?.id);
  }

  @Post(':id/deprecate')
  @RequirePermission('metadata:flow:manage')
  async deprecate(@Param('id') id: string, @CurrentUser() user?: RequestUser) {
    return this.definitions.deprecate(id, user?.id);
  }

  /**
   * Plan §8.1.8 — flow test runner.
   *
   * Runs the flow against caller-supplied mock input data inside a
   * "test-mode" context. The runner enforces:
   *  - Caller must hold `metadata:flow:manage` for this collection
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
  @RequirePermission('metadata:flow:manage')
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
  @RequirePermission(['metadata:collection:read', 'metadata:flow:manage'], 'any')
  async listRevisions(@Param('id') id: string) {
    return this.definitions.listRevisions(id);
  }

  private toActor(user?: RequestUser) {
    if (!user) return undefined;
    return {
      id: user.id,
      roles: user.roleCodes,
      permissions: user.permissionCodes,
    };
  }
}
