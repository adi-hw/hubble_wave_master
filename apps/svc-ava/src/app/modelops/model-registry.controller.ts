import { Body, Controller, Get, Param, Post, Put, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard, InstanceRequest, extractContext } from '@hubblewave/auth-guard';
import { ModelRegistryService } from './model-registry.service';
import { ModelArtifactRegister, ModelArtifactRequest, ModelArtifactUpdate } from './model-registry.types';

@Controller('api/ava/models')
@UseGuards(JwtAuthGuard)
export class ModelRegistryController {
  constructor(private readonly registry: ModelRegistryService) {}

  @Get()
  async list() {
    return this.registry.listArtifacts();
  }

  @Get(':id')
  async get(@Param('id') id: string) {
    return this.registry.getArtifact(id);
  }

  @Post()
  async create(@Body() body: ModelArtifactRequest, @Req() req?: InstanceRequest) {
    const context = extractContext(req || {});
    return this.registry.createArtifact(body, context.userId || undefined);
  }

  @Put(':id')
  async update(
    @Param('id') id: string,
    @Body() body: ModelArtifactUpdate,
    @Req() req?: InstanceRequest,
  ) {
    const context = extractContext(req || {});
    return this.registry.updateArtifact(id, body, context.userId || undefined);
  }

  @Post(':id/register')
  async register(
    @Param('id') id: string,
    @Body() body: ModelArtifactRegister,
    @Req() req?: InstanceRequest,
  ) {
    const context = extractContext(req || {});
    return this.registry.registerArtifact(id, body, context.userId || undefined);
  }

  @Get(':id/download-url')
  async downloadUrl(@Param('id') id: string) {
    return this.registry.createDownloadUrl(id);
  }
}
