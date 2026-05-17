import { Body, Controller, Get, Param, Post, Put, Req, UseGuards } from '@nestjs/common';
import {
  AuthenticatedOnly,
  InstanceRequest,
  JwtAuthGuard,
  PermissionsGuard,
  RequirePermission,
  extractContext,
} from '@hubblewave/auth-guard';
import { DatasetService } from './dataset.service';
import { DatasetDefinitionRequest, DatasetDefinitionUpdate } from './dataset.types';

/**
 * Canon §28 / §11 / W2 Stream 3 — ML dataset administration (the
 * curated input corpora for AVA training and inference). Reads are
 * `@AuthenticatedOnly` (any user with the AVA feature surface can see
 * which datasets exist); writes are `@RequirePermission('ava:admin')` —
 * dataset mutations change the model training inputs and so the AVA
 * trust posture per canon §12.
 */
@Controller('ava/datasets')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class DatasetController {
  constructor(private readonly datasetService: DatasetService) {}

  @Get()
  @AuthenticatedOnly()
  async list() {
    return this.datasetService.listDefinitions();
  }

  @Get(':id')
  @AuthenticatedOnly()
  async get(@Param('id') id: string) {
    return this.datasetService.getDefinition(id);
  }

  @Post()
  @RequirePermission('ava:admin')
  async create(@Body() body: DatasetDefinitionRequest, @Req() req?: InstanceRequest) {
    const context = extractContext(req || {});
    return this.datasetService.createDefinition(body, context.userId || undefined);
  }

  @Put(':id')
  @RequirePermission('ava:admin')
  async update(
    @Param('id') id: string,
    @Body() body: DatasetDefinitionUpdate,
    @Req() req?: InstanceRequest,
  ) {
    const context = extractContext(req || {});
    return this.datasetService.updateDefinition(id, body, context.userId || undefined);
  }

  @Post(':id/snapshots')
  @RequirePermission('ava:admin')
  async createSnapshot(@Param('id') id: string, @Req() req?: InstanceRequest) {
    const context = extractContext(req || {});
    return this.datasetService.requestSnapshot(id, context.userId || undefined);
  }

  @Get(':id/snapshots')
  @AuthenticatedOnly()
  async listSnapshots(@Param('id') id: string) {
    return this.datasetService.listSnapshots(id);
  }
}
