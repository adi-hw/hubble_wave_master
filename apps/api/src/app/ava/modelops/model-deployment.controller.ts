import { Body, Controller, Get, Param, Post, Put, Req, UseGuards } from '@nestjs/common';
import {
  AuthenticatedOnly,
  InstanceRequest,
  JwtAuthGuard,
  PermissionsGuard,
  RequirePermission,
  extractContext,
} from '@hubblewave/auth-guard';
import { ModelDeploymentService } from './model-deployment.service';
import { ModelDeploymentRequest, ModelDeploymentUpdate } from './model-deployment.types';

/**
 * Canon §28 / §11 / W2 Stream 3 — AVA model deployment surface. Reads
 * are `@AuthenticatedOnly` (visibility into which models are live);
 * deployments and deployment updates carry AVA trust-posture
 * implications (canon §12) and are gated by `ava:admin`.
 */
@Controller('ava/deployments')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class ModelDeploymentController {
  constructor(private readonly deploymentService: ModelDeploymentService) {}

  @Get()
  @AuthenticatedOnly()
  async list() {
    return this.deploymentService.listDeployments();
  }

  @Get(':id')
  @AuthenticatedOnly()
  async get(@Param('id') id: string) {
    return this.deploymentService.getDeployment(id);
  }

  @Post()
  @RequirePermission('ava:admin')
  async create(@Body() body: ModelDeploymentRequest, @Req() req?: InstanceRequest) {
    const context = extractContext(req || {});
    return this.deploymentService.createDeployment(body, context.userId || undefined);
  }

  @Put(':id')
  @RequirePermission('ava:admin')
  async update(
    @Param('id') id: string,
    @Body() body: ModelDeploymentUpdate,
    @Req() req?: InstanceRequest,
  ) {
    const context = extractContext(req || {});
    return this.deploymentService.updateDeployment(id, body, context.userId || undefined);
  }
}
