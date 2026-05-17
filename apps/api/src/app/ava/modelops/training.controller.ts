import { Body, Controller, Get, Param, Post, Req, UseGuards } from '@nestjs/common';
import {
  AuthenticatedOnly,
  InstanceRequest,
  JwtAuthGuard,
  PermissionsGuard,
  RequirePermission,
  extractContext,
} from '@hubblewave/auth-guard';
import { ModelTrainingService } from './training.service';
import { ModelTrainingRequest } from './training.types';

/**
 * Canon §28 / §11 / W2 Stream 3 — AVA model training jobs. Reads are
 * `@AuthenticatedOnly` (job visibility for any AVA-feature user);
 * training-job creation consumes platform compute and feeds into
 * canon §12 trust decisions, so it is gated by `ava:admin`.
 */
@Controller('ava/training-jobs')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class TrainingController {
  constructor(private readonly trainingService: ModelTrainingService) {}

  @Get()
  @AuthenticatedOnly()
  async list() {
    return this.trainingService.listJobs();
  }

  @Get(':id')
  @AuthenticatedOnly()
  async get(@Param('id') id: string) {
    return this.trainingService.getJob(id);
  }

  @Post()
  @RequirePermission('ava:admin')
  async create(@Body() body: ModelTrainingRequest, @Req() req?: InstanceRequest) {
    const context = extractContext(req || {});
    return this.trainingService.requestTraining(body, context.userId || undefined);
  }
}
