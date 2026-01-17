import { Body, Controller, Get, Param, Post, Put, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard, InstanceRequest, extractContext } from '@hubblewave/auth-guard';
import { ModelEvaluationService } from './model-evaluation.service';
import { ModelEvaluationRequest, ModelEvaluationUpdate } from './model-evaluation.types';

@Controller('api/ava/models/:modelId/evaluations')
@UseGuards(JwtAuthGuard)
export class ModelEvaluationController {
  constructor(private readonly evaluations: ModelEvaluationService) {}

  @Get()
  async list(@Param('modelId') modelId: string) {
    return this.evaluations.listEvaluations(modelId);
  }

  @Get(':evaluationId')
  async get(
    @Param('modelId') modelId: string,
    @Param('evaluationId') evaluationId: string,
  ) {
    return this.evaluations.getEvaluation(modelId, evaluationId);
  }

  @Post()
  async create(
    @Param('modelId') modelId: string,
    @Body() body: ModelEvaluationRequest,
    @Req() req?: InstanceRequest,
  ) {
    const context = extractContext(req || {});
    return this.evaluations.createEvaluation(modelId, body, context.userId || undefined);
  }

  @Put(':evaluationId')
  async update(
    @Param('modelId') modelId: string,
    @Param('evaluationId') evaluationId: string,
    @Body() body: ModelEvaluationUpdate,
    @Req() req?: InstanceRequest,
  ) {
    const context = extractContext(req || {});
    return this.evaluations.updateEvaluation(modelId, evaluationId, body, context.userId || undefined);
  }
}
