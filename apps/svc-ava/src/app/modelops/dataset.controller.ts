import { Body, Controller, Get, Param, Post, Put, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard, InstanceRequest, extractContext } from '@hubblewave/auth-guard';
import { DatasetService } from './dataset.service';
import { DatasetDefinitionRequest, DatasetDefinitionUpdate } from './dataset.types';

@Controller('api/ava/datasets')
@UseGuards(JwtAuthGuard)
export class DatasetController {
  constructor(private readonly datasetService: DatasetService) {}

  @Get()
  async list() {
    return this.datasetService.listDefinitions();
  }

  @Get(':id')
  async get(@Param('id') id: string) {
    return this.datasetService.getDefinition(id);
  }

  @Post()
  async create(@Body() body: DatasetDefinitionRequest, @Req() req?: InstanceRequest) {
    const context = extractContext(req || {});
    return this.datasetService.createDefinition(body, context.userId || undefined);
  }

  @Put(':id')
  async update(
    @Param('id') id: string,
    @Body() body: DatasetDefinitionUpdate,
    @Req() req?: InstanceRequest,
  ) {
    const context = extractContext(req || {});
    return this.datasetService.updateDefinition(id, body, context.userId || undefined);
  }

  @Post(':id/snapshots')
  async createSnapshot(@Param('id') id: string, @Req() req?: InstanceRequest) {
    const context = extractContext(req || {});
    return this.datasetService.requestSnapshot(id, context.userId || undefined);
  }

  @Get(':id/snapshots')
  async listSnapshots(@Param('id') id: string) {
    return this.datasetService.listSnapshots(id);
  }
}
