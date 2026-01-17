import { Body, Controller, Get, Param, Post, Put, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard, InstanceRequest, extractContext } from '@hubblewave/auth-guard';
import { ModelDeploymentService } from './model-deployment.service';
import { ModelDeploymentRequest, ModelDeploymentUpdate } from './model-deployment.types';

@Controller('api/ava/deployments')
@UseGuards(JwtAuthGuard)
export class ModelDeploymentController {
  constructor(private readonly deploymentService: ModelDeploymentService) {}

  @Get()
  async list() {
    return this.deploymentService.listDeployments();
  }

  @Get(':id')
  async get(@Param('id') id: string) {
    return this.deploymentService.getDeployment(id);
  }

  @Post()
  async create(@Body() body: ModelDeploymentRequest, @Req() req?: InstanceRequest) {
    const context = extractContext(req || {});
    return this.deploymentService.createDeployment(body, context.userId || undefined);
  }

  @Put(':id')
  async update(
    @Param('id') id: string,
    @Body() body: ModelDeploymentUpdate,
    @Req() req?: InstanceRequest,
  ) {
    const context = extractContext(req || {});
    return this.deploymentService.updateDeployment(id, body, context.userId || undefined);
  }
}
