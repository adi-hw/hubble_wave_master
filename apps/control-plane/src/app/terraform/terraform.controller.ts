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
import { Roles } from '../auth/roles.decorator';

@Controller('terraform')
@Roles('operator')
export class TerraformController {
  constructor(private readonly terraformService: TerraformService) {}

  @Get('jobs')
  async findAll(@Query() query: TerraformJobQueryParams) {
    return this.terraformService.findAll(query);
  }

  @Get('jobs/running')
  async getRunningJobs() {
    return this.terraformService.getRunningJobs();
  }

  @Get('jobs/stats')
  async getStats() {
    return this.terraformService.getStats();
  }

  @Get('jobs/:id')
  async findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.terraformService.findOne(id);
  }

  @Post('jobs')
  async create(@Body() dto: CreateTerraformJobDto) {
    return this.terraformService.create(dto);
  }

  @Patch('jobs/:id/start')
  async start(@Param('id', ParseUUIDPipe) id: string) {
    return this.terraformService.start(id);
  }

  @Patch('jobs/:id/output')
  async appendOutput(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() line: TerraformOutputLine,
  ) {
    return this.terraformService.appendOutput(id, line);
  }

  @Patch('jobs/:id/plan')
  async updatePlan(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() plan: { add: number; change: number; destroy: number },
  ) {
    return this.terraformService.updatePlan(id, plan);
  }

  @Patch('jobs/:id/complete')
  async complete(@Param('id', ParseUUIDPipe) id: string) {
    return this.terraformService.complete(id);
  }

  @Patch('jobs/:id/fail')
  async fail(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: { errorMessage: string },
  ) {
    return this.terraformService.fail(id, body.errorMessage);
  }

  @Patch('jobs/:id/cancel')
  async cancel(@Param('id', ParseUUIDPipe) id: string) {
    return this.terraformService.cancel(id);
  }
}
