import { Body, Controller, Get, Param, Post, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard, InstanceRequest, extractContext } from '@hubblewave/auth-guard';
import { ModelTrainingService } from './training.service';
import { ModelTrainingRequest } from './training.types';

@Controller('api/ava/training-jobs')
@UseGuards(JwtAuthGuard)
export class TrainingController {
  constructor(private readonly trainingService: ModelTrainingService) {}

  @Get()
  async list() {
    return this.trainingService.listJobs();
  }

  @Get(':id')
  async get(@Param('id') id: string) {
    return this.trainingService.getJob(id);
  }

  @Post()
  async create(@Body() body: ModelTrainingRequest, @Req() req?: InstanceRequest) {
    const context = extractContext(req || {});
    return this.trainingService.requestTraining(body, context.userId || undefined);
  }
}
