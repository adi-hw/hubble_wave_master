import { Injectable, NotFoundException } from '@nestjs/common';
import { TenantDbService } from '@eam-platform/tenant-db';
import {
  ImportDefinition,
  ImportJob,
  ImportStatus,
  ExportDefinition,
  ExportJob,
  ExportStatus,
  ConnectionDefinition,
  WebhookDefinition,
  WebhookLog,
} from '@eam-platform/tenant-db';

@Injectable()
export class ImportExportService {
  constructor(private tenantDb: TenantDbService) {}

  // ============ Import Definitions ============

  async getImportDefinitions(tenantId: string) {
    const ds = await this.tenantDb.getDataSource(tenantId);
    const repo = ds.getRepository(ImportDefinition);
    return repo.find({ order: { name: 'ASC' } });
  }

  async getImportDefinition(tenantId: string, id: string) {
    const ds = await this.tenantDb.getDataSource(tenantId);
    const repo = ds.getRepository(ImportDefinition);
    const def = await repo.findOne({ where: { id } });
    if (!def) throw new NotFoundException('Import definition not found');
    return def;
  }

  async createImportDefinition(tenantId: string, data: Record<string, unknown>, userId?: string) {
    const ds = await this.tenantDb.getDataSource(tenantId);
    const repo = ds.getRepository(ImportDefinition);
    const def = repo.create({ ...data, createdBy: userId } as Partial<ImportDefinition>);
    return repo.save(def);
  }

  async updateImportDefinition(tenantId: string, id: string, data: Record<string, unknown>) {
    const ds = await this.tenantDb.getDataSource(tenantId);
    const repo = ds.getRepository(ImportDefinition);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await repo.update(id, data as any);
    return this.getImportDefinition(tenantId, id);
  }

  async deleteImportDefinition(tenantId: string, id: string) {
    const ds = await this.tenantDb.getDataSource(tenantId);
    const repo = ds.getRepository(ImportDefinition);
    await repo.delete(id);
  }

  // ============ Import Jobs ============

  async getImportJobs(tenantId: string, filters?: { status?: ImportStatus; collectionCode?: string }) {
    const ds = await this.tenantDb.getDataSource(tenantId);
    const repo = ds.getRepository(ImportJob);
    const qb = repo.createQueryBuilder('job');

    if (filters?.status) {
      qb.andWhere('job.status = :status', { status: filters.status });
    }
    if (filters?.collectionCode) {
      qb.andWhere('job.collectionCode = :collectionCode', { collectionCode: filters.collectionCode });
    }

    return qb.orderBy('job.createdAt', 'DESC').getMany();
  }

  async getImportJob(tenantId: string, id: string) {
    const ds = await this.tenantDb.getDataSource(tenantId);
    const repo = ds.getRepository(ImportJob);
    const job = await repo.findOne({ where: { id } });
    if (!job) throw new NotFoundException('Import job not found');
    return job;
  }

  async createImportJob(tenantId: string, data: Partial<ImportJob>, userId?: string) {
    const ds = await this.tenantDb.getDataSource(tenantId);
    const repo = ds.getRepository(ImportJob);
    const job = repo.create({ ...data, status: 'draft', createdBy: userId });
    return repo.save(job);
  }

  async updateImportJobStatus(
    tenantId: string,
    id: string,
    status: ImportStatus,
    progress?: { processedRows?: number; successCount?: number; errorCount?: number; skipCount?: number; errors?: unknown[] }
  ) {
    const ds = await this.tenantDb.getDataSource(tenantId);
    const repo = ds.getRepository(ImportJob);

    const updateData: Record<string, unknown> = { status };

    if (status === 'processing') {
      updateData.startedAt = new Date();
    } else if (status === 'completed' || status === 'failed') {
      updateData.completedAt = new Date();
    }

    if (progress) {
      Object.assign(updateData, progress);
    }

    await repo.update(id, updateData);
    return this.getImportJob(tenantId, id);
  }

  async cancelImportJob(tenantId: string, id: string) {
    return this.updateImportJobStatus(tenantId, id, 'cancelled');
  }

  // ============ Export Definitions ============

  async getExportDefinitions(tenantId: string) {
    const ds = await this.tenantDb.getDataSource(tenantId);
    const repo = ds.getRepository(ExportDefinition);
    return repo.find({ order: { name: 'ASC' } });
  }

  async getExportDefinition(tenantId: string, id: string) {
    const ds = await this.tenantDb.getDataSource(tenantId);
    const repo = ds.getRepository(ExportDefinition);
    const def = await repo.findOne({ where: { id } });
    if (!def) throw new NotFoundException('Export definition not found');
    return def;
  }

  async createExportDefinition(tenantId: string, data: Record<string, unknown>, userId?: string) {
    const ds = await this.tenantDb.getDataSource(tenantId);
    const repo = ds.getRepository(ExportDefinition);
    const def = repo.create({ ...data, createdBy: userId } as Partial<ExportDefinition>);
    return repo.save(def);
  }

  async updateExportDefinition(tenantId: string, id: string, data: Record<string, unknown>) {
    const ds = await this.tenantDb.getDataSource(tenantId);
    const repo = ds.getRepository(ExportDefinition);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await repo.update(id, data as any);
    return this.getExportDefinition(tenantId, id);
  }

  async deleteExportDefinition(tenantId: string, id: string) {
    const ds = await this.tenantDb.getDataSource(tenantId);
    const repo = ds.getRepository(ExportDefinition);
    await repo.delete(id);
  }

  // ============ Export Jobs ============

  async getExportJobs(tenantId: string, filters?: { status?: ExportStatus; collectionCode?: string }) {
    const ds = await this.tenantDb.getDataSource(tenantId);
    const repo = ds.getRepository(ExportJob);
    const qb = repo.createQueryBuilder('job');

    if (filters?.status) {
      qb.andWhere('job.status = :status', { status: filters.status });
    }
    if (filters?.collectionCode) {
      qb.andWhere('job.collectionCode = :collectionCode', { collectionCode: filters.collectionCode });
    }

    return qb.orderBy('job.createdAt', 'DESC').getMany();
  }

  async getExportJob(tenantId: string, id: string) {
    const ds = await this.tenantDb.getDataSource(tenantId);
    const repo = ds.getRepository(ExportJob);
    const job = await repo.findOne({ where: { id } });
    if (!job) throw new NotFoundException('Export job not found');
    return job;
  }

  async createExportJob(tenantId: string, data: Partial<ExportJob>, userId?: string) {
    const ds = await this.tenantDb.getDataSource(tenantId);
    const repo = ds.getRepository(ExportJob);
    const job = repo.create({ ...data, status: 'pending', createdBy: userId });
    return repo.save(job);
  }

  async startExportJob(tenantId: string, id: string) {
    const ds = await this.tenantDb.getDataSource(tenantId);
    const repo = ds.getRepository(ExportJob);
    await repo.update(id, { status: 'processing', startedAt: new Date() });
    return this.getExportJob(tenantId, id);
  }

  async completeExportJob(
    tenantId: string,
    id: string,
    result: { outputFileName: string; outputUrl: string; outputFileSize: number; totalRows: number; expiresAt?: Date }
  ) {
    const ds = await this.tenantDb.getDataSource(tenantId);
    const repo = ds.getRepository(ExportJob);
    await repo.update(id, {
      status: 'completed',
      completedAt: new Date(),
      processedRows: result.totalRows,
      ...result,
    });
    return this.getExportJob(tenantId, id);
  }

  async failExportJob(tenantId: string, id: string, errorMessage: string) {
    const ds = await this.tenantDb.getDataSource(tenantId);
    const repo = ds.getRepository(ExportJob);
    await repo.update(id, { status: 'failed', completedAt: new Date(), errorMessage });
    return this.getExportJob(tenantId, id);
  }

  // ============ Connections ============

  async getConnections(tenantId: string) {
    const ds = await this.tenantDb.getDataSource(tenantId);
    const repo = ds.getRepository(ConnectionDefinition);
    return repo.find({ order: { name: 'ASC' } });
  }

  async getConnection(tenantId: string, id: string) {
    const ds = await this.tenantDb.getDataSource(tenantId);
    const repo = ds.getRepository(ConnectionDefinition);
    const conn = await repo.findOne({ where: { id } });
    if (!conn) throw new NotFoundException('Connection not found');
    return conn;
  }

  async getConnectionByCode(tenantId: string, code: string) {
    const ds = await this.tenantDb.getDataSource(tenantId);
    const repo = ds.getRepository(ConnectionDefinition);
    const conn = await repo.findOne({ where: { code } });
    if (!conn) throw new NotFoundException('Connection not found');
    return conn;
  }

  async createConnection(tenantId: string, data: Record<string, unknown>, userId?: string) {
    const ds = await this.tenantDb.getDataSource(tenantId);
    const repo = ds.getRepository(ConnectionDefinition);
    const conn = repo.create({ ...data, createdBy: userId } as Partial<ConnectionDefinition>);
    return repo.save(conn);
  }

  async updateConnection(tenantId: string, id: string, data: Record<string, unknown>) {
    const ds = await this.tenantDb.getDataSource(tenantId);
    const repo = ds.getRepository(ConnectionDefinition);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await repo.update(id, data as any);
    return this.getConnection(tenantId, id);
  }

  async deleteConnection(tenantId: string, id: string) {
    const ds = await this.tenantDb.getDataSource(tenantId);
    const repo = ds.getRepository(ConnectionDefinition);
    await repo.delete(id);
  }

  async testConnection(tenantId: string, id: string): Promise<{ success: boolean; message?: string }> {
    const conn = await this.getConnection(tenantId, id);
    const ds = await this.tenantDb.getDataSource(tenantId);
    const repo = ds.getRepository(ConnectionDefinition);

    try {
      // Basic connectivity test based on connection type
      // In a real implementation, this would actually test the connection
      const testResult = await this.performConnectionTest(conn);

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await repo.update(id, {
        lastTestedAt: new Date(),
        testSuccess: testResult.success,
        lastError: testResult.success ? undefined : testResult.message,
        lastErrorAt: testResult.success ? undefined : new Date(),
        status: testResult.success ? 'active' : 'error',
      } as any);

      return testResult;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await repo.update(id, {
        lastTestedAt: new Date(),
        testSuccess: false,
        lastError: message,
        lastErrorAt: new Date(),
        status: 'error',
      } as any);
      return { success: false, message };
    }
  }

  private async performConnectionTest(conn: ConnectionDefinition): Promise<{ success: boolean; message?: string }> {
    // Placeholder for actual connection testing logic
    // Would implement HTTP requests, database connections, etc.
    if (!conn.baseUrl && conn.type !== 'database') {
      return { success: false, message: 'Base URL is required' };
    }

    // Simulate successful test
    return { success: true };
  }

  // ============ Webhooks ============

  async getWebhooks(tenantId: string) {
    const ds = await this.tenantDb.getDataSource(tenantId);
    const repo = ds.getRepository(WebhookDefinition);
    return repo.find({ order: { name: 'ASC' } });
  }

  async getWebhook(tenantId: string, id: string) {
    const ds = await this.tenantDb.getDataSource(tenantId);
    const repo = ds.getRepository(WebhookDefinition);
    const webhook = await repo.findOne({ where: { id } });
    if (!webhook) throw new NotFoundException('Webhook not found');
    return webhook;
  }

  async getWebhookByCode(tenantId: string, code: string) {
    const ds = await this.tenantDb.getDataSource(tenantId);
    const repo = ds.getRepository(WebhookDefinition);
    const webhook = await repo.findOne({ where: { code } });
    if (!webhook) throw new NotFoundException('Webhook not found');
    return webhook;
  }

  async createWebhook(tenantId: string, data: Record<string, unknown>, userId?: string) {
    const ds = await this.tenantDb.getDataSource(tenantId);
    const repo = ds.getRepository(WebhookDefinition);
    const webhook = repo.create({ ...data, createdBy: userId } as Partial<WebhookDefinition>);
    return repo.save(webhook);
  }

  async updateWebhook(tenantId: string, id: string, data: Record<string, unknown>) {
    const ds = await this.tenantDb.getDataSource(tenantId);
    const repo = ds.getRepository(WebhookDefinition);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await repo.update(id, data as any);
    return this.getWebhook(tenantId, id);
  }

  async deleteWebhook(tenantId: string, id: string) {
    const ds = await this.tenantDb.getDataSource(tenantId);
    const repo = ds.getRepository(WebhookDefinition);
    await repo.delete(id);
  }

  // ============ Webhook Logs ============

  async getWebhookLogs(tenantId: string, webhookId?: string, limit = 100) {
    const ds = await this.tenantDb.getDataSource(tenantId);
    const repo = ds.getRepository(WebhookLog);
    const qb = repo.createQueryBuilder('log');

    if (webhookId) {
      qb.where('log.webhookDefinitionId = :webhookId', { webhookId });
    }

    return qb.orderBy('log.createdAt', 'DESC').take(limit).getMany();
  }

  async createWebhookLog(tenantId: string, data: Partial<WebhookLog>) {
    const ds = await this.tenantDb.getDataSource(tenantId);
    const repo = ds.getRepository(WebhookLog);
    const log = repo.create(data);
    return repo.save(log);
  }

  // ============ Quick Export (Ad-hoc) ============

  async quickExport(
    tenantId: string,
    collectionCode: string,
    format: 'csv' | 'xlsx' | 'json',
    columns?: string[],
    filters?: unknown[],
    userId?: string
  ) {
    // Create a one-time export job
    const job = await this.createExportJob(
      tenantId,
      {
        collectionCode,
        format,
        columns: columns?.map((c) => ({ propertyCode: c })),
        filters,
      } as Partial<ExportJob>,
      userId
    );

    // In a real implementation, this would queue the job for processing
    return job;
  }

  // ============ Quick Import (Ad-hoc) ============

  async startQuickImport(
    tenantId: string,
    collectionCode: string,
    format: 'csv' | 'xlsx' | 'json',
    fileName: string,
    fileSize: number,
    userId?: string
  ) {
    const job = await this.createImportJob(
      tenantId,
      {
        collectionCode,
        format,
        fileName,
        fileSize,
      },
      userId
    );

    return job;
  }

  async setImportMapping(
    tenantId: string,
    jobId: string,
    columnMappings: unknown[],
    _keyFields?: string[]
  ) {
    const ds = await this.tenantDb.getDataSource(tenantId);
    const repo = ds.getRepository(ImportJob);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await repo.update(jobId, { columnMappings, status: 'ready' } as any);
    return this.getImportJob(tenantId, jobId);
  }

  async validateImportJob(tenantId: string, jobId: string) {
    // In a real implementation, this would validate the import data
    return this.updateImportJobStatus(tenantId, jobId, 'validating');
  }

  async executeImportJob(tenantId: string, jobId: string) {
    // In a real implementation, this would process the import
    return this.updateImportJobStatus(tenantId, jobId, 'processing');
  }
}
