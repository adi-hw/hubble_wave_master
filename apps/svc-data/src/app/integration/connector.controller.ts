/**
 * Connector Controller
 * HubbleWave Platform - Phase 5
 */

import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { JwtAuthGuard, CurrentUser, RequestUser } from '@hubblewave/auth-guard';
import { ConnectorService } from './connector.service';
import {
  ConnectionStatus,
  SyncDirection,
  SyncMode,
  ConflictResolution,
  PropertyMappingEntry,
  SyncRunStatus,
} from '@hubblewave/instance-db';

interface CreateConnectionDto {
  connectorId: string;
  name: string;
  description?: string;
  config: Record<string, unknown>;
  credentialRef?: string;
}

interface CreatePropertyMappingDto {
  connectionId: string;
  name: string;
  sourceEntity: string;
  targetCollectionId: string;
  direction?: SyncDirection;
  mappings: PropertyMappingEntry[];
  syncMode?: SyncMode;
  conflictResolution?: ConflictResolution;
}

interface CreateSyncConfigDto {
  name: string;
  description?: string;
  connectionId: string;
  mappingId?: string;
  schedule?: string;
  direction?: SyncDirection;
  syncMode?: SyncMode;
  conflictResolution?: ConflictResolution;
  batchSize?: number;
}

@ApiTags('Connectors')
@ApiBearerAuth()
@Controller('connectors')
@UseGuards(JwtAuthGuard)
export class ConnectorController {
  constructor(private readonly connectorService: ConnectorService) {}

  // Connectors (System-defined)

  @Get()
  @ApiOperation({ summary: 'Get all available connectors' })
  @ApiResponse({ status: 200, description: 'List of connectors' })
  async findAllConnectors(
    @Query('type') type?: string,
    @Query('isActive') isActive?: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    return this.connectorService.findAllConnectors({
      type,
      isActive: isActive ? isActive === 'true' : undefined,
      limit: limit ? parseInt(limit) : undefined,
      offset: offset ? parseInt(offset) : undefined,
    });
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get connector by ID' })
  @ApiResponse({ status: 200, description: 'Connector details' })
  async findConnector(@Param('id') id: string) {
    return this.connectorService.findConnectorById(id);
  }

  // Connections (User-created instances)

  @Post('connections')
  @ApiOperation({ summary: 'Create a new connection' })
  @ApiResponse({ status: 201, description: 'Connection created' })
  async createConnection(@Body() dto: CreateConnectionDto, @CurrentUser() user: RequestUser) {
    return this.connectorService.createConnection({
      ...dto,
      createdBy: user.id,
    });
  }

  @Get('connections')
  async findAllConnections(
    @Query('connectorId') connectorId?: string,
    @Query('status') status?: ConnectionStatus,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    return this.connectorService.findAllConnections({
      connectorId,
      status,
      limit: limit ? parseInt(limit) : undefined,
      offset: offset ? parseInt(offset) : undefined,
    });
  }

  @Get('connections/:id')
  async findConnection(@Param('id') id: string) {
    return this.connectorService.findConnectionById(id);
  }

  @Put('connections/:id')
  async updateConnection(@Param('id') id: string, @Body() dto: Partial<CreateConnectionDto>) {
    return this.connectorService.updateConnection(id, dto);
  }

  @Delete('connections/:id')
  async deleteConnection(@Param('id') id: string) {
    await this.connectorService.deleteConnection(id);
    return { success: true };
  }

  @Post('connections/:id/test')
  async testConnection(@Param('id') id: string) {
    return this.connectorService.testConnection(id);
  }

  // Property Mappings

  @Post('mappings')
  @ApiOperation({ summary: 'Create a property mapping' })
  @ApiResponse({ status: 201, description: 'Property mapping created' })
  async createMapping(@Body() dto: CreatePropertyMappingDto, @CurrentUser() user: RequestUser) {
    return this.connectorService.createPropertyMapping({
      ...dto,
      createdBy: user.id,
    });
  }

  @Get('connections/:connectionId/mappings')
  async findMappings(@Param('connectionId') connectionId: string) {
    return this.connectorService.findAllPropertyMappings(connectionId);
  }

  @Get('mappings/:id')
  async findMapping(@Param('id') id: string) {
    return this.connectorService.findPropertyMappingById(id);
  }

  @Put('mappings/:id')
  async updateMapping(@Param('id') id: string, @Body() dto: Partial<CreatePropertyMappingDto>) {
    return this.connectorService.updatePropertyMapping(id, dto);
  }

  @Delete('mappings/:id')
  async deleteMapping(@Param('id') id: string) {
    await this.connectorService.deletePropertyMapping(id);
    return { success: true };
  }

  // Sync Configurations

  @Post('sync-configs')
  @ApiOperation({ summary: 'Create a sync configuration' })
  @ApiResponse({ status: 201, description: 'Sync config created' })
  async createSyncConfig(@Body() dto: CreateSyncConfigDto, @CurrentUser() user: RequestUser) {
    return this.connectorService.createSyncConfig({
      ...dto,
      createdBy: user.id,
    });
  }

  @Get('sync-configs')
  async findAllSyncConfigs(
    @Query('connectionId') connectionId?: string,
    @Query('isActive') isActive?: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    return this.connectorService.findAllSyncConfigs({
      connectionId,
      isActive: isActive ? isActive === 'true' : undefined,
      limit: limit ? parseInt(limit) : undefined,
      offset: offset ? parseInt(offset) : undefined,
    });
  }

  @Get('sync-configs/:id')
  async findSyncConfig(@Param('id') id: string) {
    return this.connectorService.findSyncConfigById(id);
  }

  @Put('sync-configs/:id')
  async updateSyncConfig(@Param('id') id: string, @Body() dto: Partial<CreateSyncConfigDto>) {
    return this.connectorService.updateSyncConfig(id, dto);
  }

  @Delete('sync-configs/:id')
  async deleteSyncConfig(@Param('id') id: string) {
    await this.connectorService.deleteSyncConfig(id);
    return { success: true };
  }

  // Sync Execution

  @Post('sync-configs/:id/run')
  async runSync(@Param('id') id: string) {
    return this.connectorService.runSync(id);
  }

  @Get('sync-configs/:id/runs')
  async findSyncRuns(
    @Param('id') id: string,
    @Query('status') status?: SyncRunStatus,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    return this.connectorService.findSyncRuns(id, {
      status,
      limit: limit ? parseInt(limit) : undefined,
      offset: offset ? parseInt(offset) : undefined,
    });
  }

  @Get('runs/:runId')
  async findSyncRun(@Param('runId') runId: string) {
    return this.connectorService.findSyncRunById(runId);
  }

  @Post('runs/:runId/cancel')
  async cancelSyncRun(@Param('runId') runId: string) {
    return this.connectorService.cancelSyncRun(runId);
  }

  // Scheduled Sync Processing

  @Post('process-scheduled')
  async processScheduled() {
    const count = await this.connectorService.processScheduledSyncs();
    return { processed: count };
  }
}
