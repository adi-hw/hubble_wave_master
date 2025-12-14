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
import { JwtAuthGuard, TenantId, CurrentUser } from '@eam-platform/auth-guard';
import { ImportExportService } from './import-export.service';
import { ImportStatus, ExportStatus } from '@eam-platform/tenant-db';

@Controller('import-export')
@UseGuards(JwtAuthGuard)
export class ImportExportController {
  constructor(private readonly service: ImportExportService) {}

  // ============ Import Definitions ============

  @Get('imports/definitions')
  getImportDefinitions(@TenantId() tenantId: string) {
    return this.service.getImportDefinitions(tenantId);
  }

  @Get('imports/definitions/:id')
  getImportDefinition(@TenantId() tenantId: string, @Param('id') id: string) {
    return this.service.getImportDefinition(tenantId, id);
  }

  @Post('imports/definitions')
  createImportDefinition(
    @TenantId() tenantId: string,
    @Body() data: Record<string, unknown>,
    @CurrentUser('id') userId: string
  ) {
    return this.service.createImportDefinition(tenantId, data, userId);
  }

  @Put('imports/definitions/:id')
  updateImportDefinition(
    @TenantId() tenantId: string,
    @Param('id') id: string,
    @Body() data: Record<string, unknown>
  ) {
    return this.service.updateImportDefinition(tenantId, id, data);
  }

  @Delete('imports/definitions/:id')
  deleteImportDefinition(@TenantId() tenantId: string, @Param('id') id: string) {
    return this.service.deleteImportDefinition(tenantId, id);
  }

  // ============ Import Jobs ============

  @Get('imports/jobs')
  getImportJobs(
    @TenantId() tenantId: string,
    @Query('status') status?: ImportStatus,
    @Query('collectionCode') collectionCode?: string
  ) {
    return this.service.getImportJobs(tenantId, { status, collectionCode });
  }

  @Get('imports/jobs/:id')
  getImportJob(@TenantId() tenantId: string, @Param('id') id: string) {
    return this.service.getImportJob(tenantId, id);
  }

  @Post('imports/jobs')
  createImportJob(
    @TenantId() tenantId: string,
    @Body() data: { collectionCode: string; format: string; fileName: string; fileSize: number },
    @CurrentUser('id') userId: string
  ) {
    return this.service.startQuickImport(
      tenantId,
      data.collectionCode,
      data.format as 'csv' | 'xlsx' | 'json',
      data.fileName,
      data.fileSize,
      userId
    );
  }

  @Put('imports/jobs/:id/mapping')
  setImportMapping(
    @TenantId() tenantId: string,
    @Param('id') id: string,
    @Body() data: { columnMappings: unknown[]; keyFields?: string[] }
  ) {
    return this.service.setImportMapping(tenantId, id, data.columnMappings, data.keyFields);
  }

  @Post('imports/jobs/:id/validate')
  validateImportJob(@TenantId() tenantId: string, @Param('id') id: string) {
    return this.service.validateImportJob(tenantId, id);
  }

  @Post('imports/jobs/:id/execute')
  executeImportJob(@TenantId() tenantId: string, @Param('id') id: string) {
    return this.service.executeImportJob(tenantId, id);
  }

  @Post('imports/jobs/:id/cancel')
  cancelImportJob(@TenantId() tenantId: string, @Param('id') id: string) {
    return this.service.cancelImportJob(tenantId, id);
  }

  // ============ Export Definitions ============

  @Get('exports/definitions')
  getExportDefinitions(@TenantId() tenantId: string) {
    return this.service.getExportDefinitions(tenantId);
  }

  @Get('exports/definitions/:id')
  getExportDefinition(@TenantId() tenantId: string, @Param('id') id: string) {
    return this.service.getExportDefinition(tenantId, id);
  }

  @Post('exports/definitions')
  createExportDefinition(
    @TenantId() tenantId: string,
    @Body() data: Record<string, unknown>,
    @CurrentUser('id') userId: string
  ) {
    return this.service.createExportDefinition(tenantId, data, userId);
  }

  @Put('exports/definitions/:id')
  updateExportDefinition(
    @TenantId() tenantId: string,
    @Param('id') id: string,
    @Body() data: Record<string, unknown>
  ) {
    return this.service.updateExportDefinition(tenantId, id, data);
  }

  @Delete('exports/definitions/:id')
  deleteExportDefinition(@TenantId() tenantId: string, @Param('id') id: string) {
    return this.service.deleteExportDefinition(tenantId, id);
  }

  // ============ Export Jobs ============

  @Get('exports/jobs')
  getExportJobs(
    @TenantId() tenantId: string,
    @Query('status') status?: ExportStatus,
    @Query('collectionCode') collectionCode?: string
  ) {
    return this.service.getExportJobs(tenantId, { status, collectionCode });
  }

  @Get('exports/jobs/:id')
  getExportJob(@TenantId() tenantId: string, @Param('id') id: string) {
    return this.service.getExportJob(tenantId, id);
  }

  @Post('exports/jobs')
  createExportJob(
    @TenantId() tenantId: string,
    @Body() data: { collectionCode: string; format: string; columns?: { propertyCode: string }[]; filters?: unknown[] },
    @CurrentUser('id') userId: string
  ) {
    return this.service.quickExport(
      tenantId,
      data.collectionCode,
      data.format as 'csv' | 'xlsx' | 'json',
      data.columns?.map((c) => c.propertyCode),
      data.filters,
      userId
    );
  }

  // ============ Connections ============

  @Get('connections')
  getConnections(@TenantId() tenantId: string) {
    return this.service.getConnections(tenantId);
  }

  @Get('connections/:id')
  getConnection(@TenantId() tenantId: string, @Param('id') id: string) {
    return this.service.getConnection(tenantId, id);
  }

  @Post('connections')
  createConnection(
    @TenantId() tenantId: string,
    @Body() data: Record<string, unknown>,
    @CurrentUser('id') userId: string
  ) {
    return this.service.createConnection(tenantId, data, userId);
  }

  @Put('connections/:id')
  updateConnection(
    @TenantId() tenantId: string,
    @Param('id') id: string,
    @Body() data: Record<string, unknown>
  ) {
    return this.service.updateConnection(tenantId, id, data);
  }

  @Delete('connections/:id')
  deleteConnection(@TenantId() tenantId: string, @Param('id') id: string) {
    return this.service.deleteConnection(tenantId, id);
  }

  @Post('connections/:id/test')
  testConnection(@TenantId() tenantId: string, @Param('id') id: string) {
    return this.service.testConnection(tenantId, id);
  }

  // ============ Webhooks ============

  @Get('webhooks')
  getWebhooks(@TenantId() tenantId: string) {
    return this.service.getWebhooks(tenantId);
  }

  @Get('webhooks/:id')
  getWebhook(@TenantId() tenantId: string, @Param('id') id: string) {
    return this.service.getWebhook(tenantId, id);
  }

  @Post('webhooks')
  createWebhook(
    @TenantId() tenantId: string,
    @Body() data: Record<string, unknown>,
    @CurrentUser('id') userId: string
  ) {
    return this.service.createWebhook(tenantId, data, userId);
  }

  @Put('webhooks/:id')
  updateWebhook(
    @TenantId() tenantId: string,
    @Param('id') id: string,
    @Body() data: Record<string, unknown>
  ) {
    return this.service.updateWebhook(tenantId, id, data);
  }

  @Delete('webhooks/:id')
  deleteWebhook(@TenantId() tenantId: string, @Param('id') id: string) {
    return this.service.deleteWebhook(tenantId, id);
  }

  @Get('webhooks/:id/logs')
  getWebhookLogs(
    @TenantId() tenantId: string,
    @Param('id') id: string,
    @Query('limit') limit?: string
  ) {
    return this.service.getWebhookLogs(tenantId, id, limit ? parseInt(limit) : 100);
  }
}
