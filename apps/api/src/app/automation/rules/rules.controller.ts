/**
 * AutomationController
 * HubbleWave Platform - Phase 3
 *
 * REST API for managing automation rules and scheduled jobs.
 */

import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  ParseUUIDPipe,
  UseGuards,
} from '@nestjs/common';
import {
  AuthenticatedOnly,
  CurrentUser,
  JwtAuthGuard,
  PermissionsGuard,
  RequestUser,
  RequirePermission,
} from '@hubblewave/auth-guard';
import {
  AutomationService,
  CreateAutomationDto,
  UpdateAutomationDto,
} from './rules.service';
import {
  ScheduledJobService,
  CreateScheduledJobDto,
  UpdateScheduledJobDto,
} from '../scheduling/scheduled-job.service';
import { ExecutionLogService, ExecutionStatus } from '../runtime/execution-log.service';
import { AvaAutomationService, AvaAutomationRequest } from '../ava/ava-automation.service';

/**
 * Canon §28 / W2 Stream 3 Task 24 — automation rules + scheduled
 * jobs administration. Every handler is gated by
 * `@RequirePermission('metadata:flow:manage')` (or the array form
 * `[metadata:collection:read, metadata:flow:manage] any` for
 * read-tier views into a single collection's automations). The
 * two AVA-automation assistant routes carry the user-facing
 * `@AuthenticatedOnly()` instead — AI feature surface per canon §11.
 */
@Controller()
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class RulesController {
  constructor(
    private readonly automationService: AutomationService,
    private readonly scheduledJobService: ScheduledJobService,
    private readonly executionLogService: ExecutionLogService,
    private readonly avaAutomationService: AvaAutomationService,
  ) {}

  // ─────────────────────────────────────────────────────────────────
  // Automation Rules
  // ─────────────────────────────────────────────────────────────────

  @Get('automations')
  @RequirePermission('metadata:flow:manage')
  async listAllAutomations(
    @Query('includeInactive') includeInactive?: string,
  ) {
    return this.automationService.getAllAutomations(includeInactive === 'true');
  }

  // ADR-12 — App Studio's Flows tab gates the Automation Rules sub-tab
  // by metadata:flow:manage. The collection-scoped routes below mirror
  // that grant so delegated flow editors can manage rules without
  // platform-admin role. Cross-collection list / scheduled jobs / AVA
  // helpers stay on the coarse-grained @Roles('admin') gate.

  @Get('collections/:collectionId/automations')
  @UseGuards(PermissionsGuard)
  @RequirePermission(['metadata:collection:read', 'metadata:flow:manage'], 'any')
  async listAutomations(
    @Param('collectionId', ParseUUIDPipe) collectionId: string,
    @Query('includeInactive') includeInactive?: string,
  ) {
    return this.automationService.getAutomationsForCollection(
      collectionId,
      includeInactive === 'true',
    );
  }

  @Get('automations/:id')
  @UseGuards(PermissionsGuard)
  @RequirePermission(['metadata:collection:read', 'metadata:flow:manage'], 'any')
  async getAutomation(@Param('id', ParseUUIDPipe) id: string) {
    return this.automationService.getAutomation(id);
  }

  @Post('collections/:collectionId/automations')
  @UseGuards(PermissionsGuard)
  @RequirePermission('metadata:flow:manage')
  async createAutomation(
    @CurrentUser() user: RequestUser,
    @Param('collectionId', ParseUUIDPipe) collectionId: string,
    @Body() dto: CreateAutomationDto,
  ) {
    return this.automationService.createAutomation(
      { ...dto, collectionId },
      user?.id,
    );
  }

  @Put('automations/:id')
  @UseGuards(PermissionsGuard)
  @RequirePermission('metadata:flow:manage')
  async updateAutomation(
    @CurrentUser() user: RequestUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateAutomationDto,
  ) {
    return this.automationService.updateAutomation(id, dto, user?.id);
  }

  @Delete('automations/:id')
  @UseGuards(PermissionsGuard)
  @RequirePermission('metadata:flow:manage')
  async deleteAutomation(
    @Param('id', ParseUUIDPipe) id: string,
    @Query('force') force?: string,
  ) {
    return this.automationService.deleteAutomation(id, force === 'true');
  }

  @Post('automations/:id/toggle')
  @UseGuards(PermissionsGuard)
  @RequirePermission('metadata:flow:manage')
  async toggleAutomation(
    @CurrentUser() user: RequestUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.automationService.toggleAutomation(id, user?.id);
  }

  @Post('automations/:id/publish')
  @UseGuards(PermissionsGuard)
  @RequirePermission('metadata:flow:manage')
  async publishAutomation(
    @CurrentUser() user: RequestUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.automationService.publishAutomation(id, user?.id);
  }

  @Post('automations/:id/deprecate')
  @UseGuards(PermissionsGuard)
  @RequirePermission('metadata:flow:manage')
  async deprecateAutomation(
    @CurrentUser() user: RequestUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.automationService.deprecateAutomation(id, user?.id);
  }

  @Get('automations/:id/revisions')
  @UseGuards(PermissionsGuard)
  @RequirePermission(['metadata:collection:read', 'metadata:flow:manage'], 'any')
  async listAutomationRevisions(@Param('id', ParseUUIDPipe) id: string) {
    return this.automationService.listRevisions(id);
  }

  @Put('collections/:collectionId/automations/reorder')
  @UseGuards(PermissionsGuard)
  @RequirePermission('metadata:flow:manage')
  async reorderAutomations(
    @Param('collectionId', ParseUUIDPipe) collectionId: string,
    @Body() body: { order: Array<{ id: string; executionOrder: number }> },
  ) {
    return this.automationService.reorderAutomations(collectionId, body.order);
  }

  // ─────────────────────────────────────────────────────────────────
  // Scheduled Jobs
  // ─────────────────────────────────────────────────────────────────

  @Get('scheduled-jobs')
  @RequirePermission('metadata:flow:manage')
  async listScheduledJobs(@Query('includeInactive') includeInactive?: string) {
    return this.scheduledJobService.getAllJobs(includeInactive === 'true');
  }

  // Scheduled-job mutation routes inherit the class-level RolesGuard
  // but had no @Roles decorator — RolesGuard allows when no metadata
  // is present, so any authenticated user could mutate. Gate them
  // behind metadata:flow:manage (delegated flow editors); admins reach
  // the same code via the seeded admin role-permission grants.
  @Get('collections/:collectionId/scheduled-jobs')
  @UseGuards(PermissionsGuard)
  @RequirePermission(['metadata:collection:read', 'metadata:flow:manage'], 'any')
  async listCollectionScheduledJobs(
    @Param('collectionId', ParseUUIDPipe) collectionId: string,
  ) {
    return this.scheduledJobService.getJobsForCollection(collectionId);
  }

  @Get('scheduled-jobs/:id')
  @UseGuards(PermissionsGuard)
  @RequirePermission(['metadata:collection:read', 'metadata:flow:manage'], 'any')
  async getScheduledJob(@Param('id', ParseUUIDPipe) id: string) {
    return this.scheduledJobService.getJob(id);
  }

  @Post('scheduled-jobs')
  @UseGuards(PermissionsGuard)
  @RequirePermission('metadata:flow:manage')
  async createScheduledJob(
    @CurrentUser() user: RequestUser,
    @Body() dto: CreateScheduledJobDto,
  ) {
    return this.scheduledJobService.createJob(dto, user?.id);
  }

  @Put('scheduled-jobs/:id')
  @UseGuards(PermissionsGuard)
  @RequirePermission('metadata:flow:manage')
  async updateScheduledJob(
    @CurrentUser() user: RequestUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateScheduledJobDto,
  ) {
    return this.scheduledJobService.updateJob(id, dto, user?.id);
  }

  @Delete('scheduled-jobs/:id')
  @UseGuards(PermissionsGuard)
  @RequirePermission('metadata:flow:manage')
  async deleteScheduledJob(@Param('id', ParseUUIDPipe) id: string) {
    return this.scheduledJobService.deleteJob(id);
  }

  @Post('scheduled-jobs/:id/toggle')
  @UseGuards(PermissionsGuard)
  @RequirePermission('metadata:flow:manage')
  async toggleScheduledJob(
    @CurrentUser() user: RequestUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.scheduledJobService.toggleJob(id, user?.id);
  }

  // ─────────────────────────────────────────────────────────────────
  // Execution Logs
  // ─────────────────────────────────────────────────────────────────

  @Get('automations/:id/logs')
  @RequirePermission('metadata:flow:manage')
  async getAutomationLogs(
    @Param('id', ParseUUIDPipe) id: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
    @Query('status') status?: ExecutionStatus,
  ) {
    return this.executionLogService.queryLogs({
      automationId: id,
      limit: limit ? parseInt(limit, 10) : undefined,
      offset: offset ? parseInt(offset, 10) : undefined,
      status,
    });
  }

  @Get('automations/:id/stats')
  @RequirePermission('metadata:flow:manage')
  async getAutomationStats(
    @Param('id', ParseUUIDPipe) id: string,
    @Query('days') days?: string,
  ) {
    return this.executionLogService.getExecutionStats(
      id,
      days ? parseInt(days, 10) : undefined,
    );
  }

  @Get('scheduled-jobs/:id/logs')
  @RequirePermission('metadata:flow:manage')
  async getScheduledJobLogs(
    @Param('id', ParseUUIDPipe) id: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    return this.executionLogService.queryLogs({
      scheduledJobId: id,
      limit: limit ? parseInt(limit, 10) : undefined,
      offset: offset ? parseInt(offset, 10) : undefined,
    });
  }

  @Get('execution-logs/:id')
  @RequirePermission('metadata:flow:manage')
  async getExecutionLog(@Param('id', ParseUUIDPipe) id: string) {
    return this.executionLogService.getLogById(id);
  }

  // ─────────────────────────────────────────────────────────────────
  // AVA Automation Assistant
  // ─────────────────────────────────────────────────────────────────

  @Post('ava/automation')
  @AuthenticatedOnly()
  async processAvaRequest(
    @CurrentUser() _user: RequestUser,
    @Body() request: AvaAutomationRequest,
  ) {
    return this.avaAutomationService.processRequest({
      ...request,
      context: {
        ...request.context,
      },
    });
  }

  @Post('ava/automation/parse-intent')
  @AuthenticatedOnly()
  async parseAvaIntent(@Body() body: { message: string }) {
    return {
      intent: this.avaAutomationService.parseIntent(body.message),
    };
  }
}
