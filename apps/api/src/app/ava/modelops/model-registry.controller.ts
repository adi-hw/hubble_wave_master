import { Body, Controller, Get, Param, Post, Put, Req, UseGuards } from '@nestjs/common';
import {
  AuthenticatedOnly,
  InstanceRequest,
  JwtAuthGuard,
  PermissionsGuard,
  RequirePermission,
  extractContext,
} from '@hubblewave/auth-guard';
import { ModelRegistryService } from './model-registry.service';
import { ModelArtifactRegister, ModelArtifactRequest, ModelArtifactUpdate } from './model-registry.types';

/**
 * Canon §28 / §11 / W2 Stream 3 — AVA model artifact registry. Reads
 * are `@AuthenticatedOnly` (any user can inspect registered models +
 * fetch a download URL — the URL itself is short-lived and signed).
 * Registry mutations (create / update / register-artifact) carry AVA
 * trust-posture implications and are gated by `ava:admin`. The
 * pre-W2 `RolesGuard` + bare `@Roles('admin')` are retired.
 */
@Controller('ava/models')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class ModelRegistryController {
  constructor(private readonly registry: ModelRegistryService) {}

  @Get()
  @AuthenticatedOnly()
  async list() {
    return this.registry.listArtifacts();
  }

  @Get(':id')
  @AuthenticatedOnly()
  async get(@Param('id') id: string) {
    return this.registry.getArtifact(id);
  }

  @Post()
  @RequirePermission('ava:admin')
  async create(@Body() body: ModelArtifactRequest, @Req() req?: InstanceRequest) {
    const context = extractContext(req || {});
    return this.registry.createArtifact(body, context.userId || undefined);
  }

  @Put(':id')
  @RequirePermission('ava:admin')
  async update(
    @Param('id') id: string,
    @Body() body: ModelArtifactUpdate,
    @Req() req?: InstanceRequest,
  ) {
    const context = extractContext(req || {});
    return this.registry.updateArtifact(id, body, context.userId || undefined);
  }

  @Post(':id/register')
  @RequirePermission('ava:admin')
  async register(
    @Param('id') id: string,
    @Body() body: ModelArtifactRegister,
    @Req() req?: InstanceRequest,
  ) {
    const context = extractContext(req || {});
    return this.registry.registerArtifact(id, body, context.userId || undefined);
  }

  @Get(':id/download-url')
  @AuthenticatedOnly()
  async downloadUrl(@Param('id') id: string) {
    return this.registry.createDownloadUrl(id);
  }
}
