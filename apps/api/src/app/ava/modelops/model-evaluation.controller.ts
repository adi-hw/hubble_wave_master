import { Body, Controller, Get, Param, Post, Put, Req, UseGuards } from '@nestjs/common';
import {
  AuthenticatedOnly,
  InstanceRequest,
  JwtAuthGuard,
  PermissionsGuard,
  RequirePermission,
  extractContext,
} from '@hubblewave/auth-guard';
import { ModelEvaluationService } from './model-evaluation.service';
import { ModelEvaluationRequest, ModelEvaluationUpdate } from './model-evaluation.types';

/**
 * Canon §28 / §11 / W2 Stream 3 — AVA model evaluation surface.
 * Reads are `@AuthenticatedOnly` (any AVA-feature user can inspect the
 * evaluation history of a model). Evaluation creation / update is
 * `ava:admin` — running evaluations consumes platform compute and
 * recording an evaluation result feeds into canon §12 trust decisions.
 */
@Controller('ava/models/:modelId/evaluations')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class ModelEvaluationController {
  constructor(private readonly evaluations: ModelEvaluationService) {}

  @Get()
  @AuthenticatedOnly()
  async list(@Param('modelId') modelId: string) {
    return this.evaluations.listEvaluations(modelId);
  }

  @Get(':evaluationId')
  @AuthenticatedOnly()
  async get(
    @Param('modelId') modelId: string,
    @Param('evaluationId') evaluationId: string,
  ) {
    return this.evaluations.getEvaluation(modelId, evaluationId);
  }

  @Post()
  @RequirePermission('ava:admin')
  async create(
    @Param('modelId') modelId: string,
    @Body() body: ModelEvaluationRequest,
    @Req() req?: InstanceRequest,
  ) {
    const context = extractContext(req || {});
    return this.evaluations.createEvaluation(modelId, body, context.userId || undefined);
  }

  @Put(':evaluationId')
  @RequirePermission('ava:admin')
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
