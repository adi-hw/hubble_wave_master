import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Param,
  Query,
  ParseUUIDPipe,
} from '@nestjs/common';
import { TerraformService, CreateTerraformJobDto, TerraformJobQueryParams } from './terraform.service';
import { TerraformOutputLine } from '@hubblewave/control-plane-db';
import { RequirePermission } from '../auth/require-permission.decorator';

/**
 * Canon §28 / W2 Stream 3 — Terraform job surface. Reads gated by
 * `control_plane:terraform:read`; every job-lifecycle mutation
 * (create / start / append-output / update-plan / complete / fail /
 * cancel) is gated by `control_plane:terraform:invoke` — the
 * highest-blast-radius capability on the control plane (dangerous,
 * bumped to admin tier).
 */
@Controller('terraform')
export class TerraformController {
  constructor(private readonly terraformService: TerraformService) {}

  @Get('jobs')
  @RequirePermission('control_plane:terraform:read')
  async findAll(@Query() query: TerraformJobQueryParams) {
    return this.terraformService.findAll(query);
  }

  @Get('jobs/running')
  @RequirePermission('control_plane:terraform:read')
  async getRunningJobs() {
    return this.terraformService.getRunningJobs();
  }

  @Get('jobs/stats')
  @RequirePermission('control_plane:terraform:read')
  async getStats() {
    return this.terraformService.getStats();
  }

  @Get('jobs/:id')
  @RequirePermission('control_plane:terraform:read')
  async findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.terraformService.findOne(id);
  }

  @Post('jobs')
  @RequirePermission('control_plane:terraform:invoke')
  async create(@Body() dto: CreateTerraformJobDto) {
    return this.terraformService.create(dto);
  }

  @Patch('jobs/:id/start')
  @RequirePermission('control_plane:terraform:invoke')
  async start(@Param('id', ParseUUIDPipe) id: string) {
    return this.terraformService.start(id);
  }

  @Patch('jobs/:id/output')
  @RequirePermission('control_plane:terraform:invoke')
  async appendOutput(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() line: TerraformOutputLine,
  ) {
    return this.terraformService.appendOutput(id, line);
  }

  @Patch('jobs/:id/plan')
  @RequirePermission('control_plane:terraform:invoke')
  async updatePlan(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() plan: { add: number; change: number; destroy: number },
  ) {
    return this.terraformService.updatePlan(id, plan);
  }

  @Patch('jobs/:id/complete')
  @RequirePermission('control_plane:terraform:invoke')
  async complete(@Param('id', ParseUUIDPipe) id: string) {
    return this.terraformService.complete(id);
  }

  @Patch('jobs/:id/fail')
  @RequirePermission('control_plane:terraform:invoke')
  async fail(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: { errorMessage: string },
  ) {
    return this.terraformService.fail(id, body.errorMessage);
  }

  @Patch('jobs/:id/cancel')
  @RequirePermission('control_plane:terraform:invoke')
  async cancel(@Param('id', ParseUUIDPipe) id: string) {
    return this.terraformService.cancel(id);
  }
}
