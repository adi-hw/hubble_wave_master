/**
 * Import/Export Service
 * HubbleWave Platform - Phase 5
 *
 * Handles data import and export operations with various formats.
 */

import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { EventEmitter2 } from '@nestjs/event-emitter';
import {
  ImportJob,
  ExportJob,
  ImportExportStatus,
  PropertyMappingEntry,
  ExportFormat,
} from '@hubblewave/instance-db';

interface CreateImportJobDto {
  name: string;
  type: string;
  sourceType: 'file' | 'api' | 'connector';
  sourceConfig?: Record<string, unknown>;
  fileName?: string;
  fileSize?: number;
  fileType?: string;
  targetCollectionId: string;
  propertyMapping: PropertyMappingEntry[];
  options?: Record<string, unknown>;
  createdBy?: string;
}

interface CreateExportJobDto {
  name: string;
  sourceCollectionId: string;
  query?: Record<string, unknown>;
  format: ExportFormat;
  options?: Record<string, unknown>;
  includeProperties?: string[];
  excludeProperties?: string[];
  createdBy?: string;
}

interface ParsedRecord {
  data: Record<string, unknown>;
  rowNumber: number;
}

@Injectable()
export class ImportExportService {
  constructor(
    @InjectRepository(ImportJob)
    private readonly importJobRepo: Repository<ImportJob>,
    @InjectRepository(ExportJob)
    private readonly exportJobRepo: Repository<ExportJob>,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  // Import Operations

  async createImportJob(dto: CreateImportJobDto): Promise<ImportJob> {
    const job = this.importJobRepo.create({
      ...dto,
      status: 'pending' as ImportExportStatus,
      progress: 0,
      processedRecords: 0,
      successfulRecords: 0,
      failedRecords: 0,
      skippedRecords: 0,
      errorLog: [],
    });

    return this.importJobRepo.save(job);
  }

  async startImport(jobId: string, fileBuffer?: Buffer): Promise<ImportJob> {
    const job = await this.importJobRepo.findOne({ where: { id: jobId } });
    if (!job) throw new Error('Import job not found');

    job.status = 'processing';
    job.startedAt = new Date();
    await this.importJobRepo.save(job);

    this.processImportJob(job, fileBuffer);

    return job;
  }

  private async processImportJob(job: ImportJob, fileBuffer?: Buffer): Promise<void> {
    try {
      job.status = 'validating';
      await this.importJobRepo.save(job);

      let records: ParsedRecord[];

      if (job.sourceType === 'file' && fileBuffer) {
        records = await this.parseFile(fileBuffer, job.fileType || 'csv');
      } else if (job.sourceType === 'api') {
        records = await this.fetchFromApi(job.sourceConfig || {});
      } else {
        throw new Error('Invalid source type or missing file buffer');
      }

      job.totalRecords = records.length;
      job.status = 'processing';
      await this.importJobRepo.save(job);

      const batchSize = (job.options?.batchSize as number) || 100;

      for (let i = 0; i < records.length; i += batchSize) {
        const batch = records.slice(i, i + batchSize);
        await this.processBatch(job, batch);

        job.progress = Math.floor(((i + batch.length) / records.length) * 100);
        await this.importJobRepo.save(job);

        this.eventEmitter.emit('import.progress', {
          jobId: job.id,
          progress: job.progress,
          processedRecords: job.processedRecords,
        });
      }

      job.status = 'completed';
      job.completedAt = new Date();
      await this.importJobRepo.save(job);

      this.eventEmitter.emit('import.completed', { jobId: job.id });

    } catch (error) {
      const err = error as Error;
      job.status = 'failed';
      job.errorLog.push({
        row: 0,
        property: 'system',
        value: '',
        error: err.message,
      });
      job.completedAt = new Date();
      await this.importJobRepo.save(job);

      this.eventEmitter.emit('import.failed', { jobId: job.id, error: err.message });
    }
  }

  private async parseFile(buffer: Buffer, fileType: string): Promise<ParsedRecord[]> {
    const content = buffer.toString('utf-8');

    switch (fileType.toLowerCase()) {
      case 'csv':
        return this.parseCSV(content);
      case 'json':
        return this.parseJSON(content);
      case 'xlsx':
      case 'xls':
        return this.parseExcel(buffer);
      default:
        throw new Error(`Unsupported file type: ${fileType}`);
    }
  }

  private async parseCSV(content: string): Promise<ParsedRecord[]> {
    const lines = content.split('\n').filter(line => line.trim());
    if (lines.length === 0) return [];

    const headers = this.parseCSVLine(lines[0]);
    const records: ParsedRecord[] = [];

    for (let i = 1; i < lines.length; i++) {
      const values = this.parseCSVLine(lines[i]);
      const data: Record<string, unknown> = {};

      headers.forEach((header, index) => {
        data[header.trim()] = values[index]?.trim() || null;
      });

      records.push({ data, rowNumber: i + 1 });
    }

    return records;
  }

  private parseCSVLine(line: string): string[] {
    const values: string[] = [];
    let current = '';
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
      const char = line[i];

      if (char === '"') {
        inQuotes = !inQuotes;
      } else if (char === ',' && !inQuotes) {
        values.push(current);
        current = '';
      } else {
        current += char;
      }
    }

    values.push(current);
    return values;
  }

  private async parseJSON(content: string): Promise<ParsedRecord[]> {
    const data = JSON.parse(content);
    const items = Array.isArray(data) ? data : [data];

    return items.map((item, index) => ({
      data: item,
      rowNumber: index + 1,
    }));
  }

  private async parseExcel(_buffer: Buffer): Promise<ParsedRecord[]> {
    throw new Error('Excel parsing not implemented - requires xlsx library');
  }

  private async fetchFromApi(config: Record<string, unknown>): Promise<ParsedRecord[]> {
    const url = config.url as string;
    if (!url) throw new Error('API URL is required');

    const response = await fetch(url, {
      method: (config.method as string) || 'GET',
      headers: (config.headers as Record<string, string>) || {},
    });

    if (!response.ok) {
      throw new Error(`API request failed: ${response.status}`);
    }

    const data = await response.json();
    const items = Array.isArray(data) ? data : (config.dataPath ? this.getNestedValue(data, config.dataPath as string) : [data]);

    return items.map((item: Record<string, unknown>, index: number) => ({
      data: item,
      rowNumber: index + 1,
    }));
  }

  private getNestedValue(obj: Record<string, unknown>, path: string): unknown[] {
    const parts = path.split('.');
    let current: unknown = obj;

    for (const part of parts) {
      if (current && typeof current === 'object') {
        current = (current as Record<string, unknown>)[part];
      } else {
        return [];
      }
    }

    return Array.isArray(current) ? current : [];
  }

  private async processBatch(job: ImportJob, records: ParsedRecord[]): Promise<void> {
    for (const record of records) {
      try {
        const mappedData = this.applyPropertyMapping(record.data, job.propertyMapping);

        const collectionId = job.targetCollectionId || '';
        const validationResult = await this.validateRecord(mappedData, collectionId);

        if (!validationResult.valid) {
          job.failedRecords++;
          job.errorLog.push({
            row: record.rowNumber,
            property: validationResult.property || 'unknown',
            value: String(validationResult.value || ''),
            error: validationResult.error || 'Validation failed',
          });
        } else {
          const duplicateHandling = job.options?.duplicateHandling as string || 'skip';
          const isDuplicate = await this.checkDuplicate(mappedData, collectionId, job.options);

          if (isDuplicate) {
            switch (duplicateHandling) {
              case 'skip':
                job.skippedRecords++;
                break;
              case 'update':
                await this.updateRecord(mappedData, collectionId);
                job.successfulRecords++;
                break;
              case 'create':
              default:
                await this.createRecord(mappedData, collectionId);
                job.successfulRecords++;
            }
          } else {
            await this.createRecord(mappedData, collectionId);
            job.successfulRecords++;
          }
        }

        job.processedRecords++;

      } catch (error) {
        const err = error as Error;
        job.failedRecords++;
        job.processedRecords++;
        job.errorLog.push({
          row: record.rowNumber,
          property: 'system',
          value: '',
          error: err.message,
        });
      }
    }
  }

  private applyPropertyMapping(
    data: Record<string, unknown>,
    mapping: PropertyMappingEntry[],
  ): Record<string, unknown> {
    const result: Record<string, unknown> = {};

    for (const map of mapping) {
      let value = data[map.sourceProperty];

      if (value === undefined && map.defaultValue !== undefined) {
        value = map.defaultValue;
      }

      if (map.transformation) {
        value = this.applyTransformation(value, map.transformation);
      }

      result[map.targetProperty] = value;
    }

    return result;
  }

  private applyTransformation(value: unknown, transformation: string): unknown {
    switch (transformation) {
      case 'uppercase':
        return typeof value === 'string' ? value.toUpperCase() : value;
      case 'lowercase':
        return typeof value === 'string' ? value.toLowerCase() : value;
      case 'trim':
        return typeof value === 'string' ? value.trim() : value;
      case 'number':
        return Number(value);
      case 'boolean':
        return value === 'true' || value === '1' || value === true;
      case 'date':
        return new Date(value as string);
      default:
        return value;
    }
  }

  private async validateRecord(
    _data: Record<string, unknown>,
    _collectionId: string,
  ): Promise<{ valid: boolean; property?: string; value?: unknown; error?: string }> {
    return { valid: true };
  }

  private async checkDuplicate(
    _data: Record<string, unknown>,
    _collectionId: string,
    _options?: Record<string, unknown>,
  ): Promise<boolean> {
    return false;
  }

  private async createRecord(_data: Record<string, unknown>, _collectionId: string): Promise<void> {
    this.eventEmitter.emit('record.created', { data: _data, collectionId: _collectionId });
  }

  private async updateRecord(_data: Record<string, unknown>, _collectionId: string): Promise<void> {
    this.eventEmitter.emit('record.updated', { data: _data, collectionId: _collectionId });
  }

  async findImportJob(id: string): Promise<ImportJob | null> {
    return this.importJobRepo.findOne({ where: { id } });
  }

  async findAllImportJobs(params: {
    status?: ImportExportStatus;
    collectionId?: string;
    limit?: number;
    offset?: number;
  } = {}): Promise<{ items: ImportJob[]; total: number }> {
    const where: Record<string, unknown> = {};
    if (params.status) where.status = params.status;
    if (params.collectionId) where.targetCollectionId = params.collectionId;

    const [items, total] = await this.importJobRepo.findAndCount({
      where,
      take: params.limit || 50,
      skip: params.offset || 0,
      order: { createdAt: 'DESC' },
    });

    return { items, total };
  }

  async cancelImportJob(id: string): Promise<ImportJob> {
    const job = await this.findImportJob(id);
    if (!job) throw new Error('Import job not found');

    job.status = 'cancelled';
    job.completedAt = new Date();

    return this.importJobRepo.save(job);
  }

  // Export Operations

  async createExportJob(dto: CreateExportJobDto): Promise<ExportJob> {
    const job = this.exportJobRepo.create({
      ...dto,
      status: 'pending' as ImportExportStatus,
      progress: 0,
      exportedRecords: 0,
    });

    return this.exportJobRepo.save(job);
  }

  async startExport(jobId: string): Promise<ExportJob> {
    const job = await this.exportJobRepo.findOne({ where: { id: jobId } });
    if (!job) throw new Error('Export job not found');

    job.status = 'processing';
    job.startedAt = new Date();
    await this.exportJobRepo.save(job);

    this.processExportJob(job);

    return job;
  }

  private async processExportJob(job: ExportJob): Promise<void> {
    try {
      const records = await this.fetchRecordsForExport(job);
      job.totalRecords = records.length;

      const filteredRecords = records.map(record => this.filterProperties(record, job.includeProperties, job.excludeProperties));

      let content: Buffer;
      let extension: string;

      switch (job.format) {
        case 'csv':
          content = Buffer.from(this.generateCSV(filteredRecords));
          extension = 'csv';
          break;
        case 'json':
          content = Buffer.from(JSON.stringify(filteredRecords, null, 2));
          extension = 'json';
          break;
        case 'xml':
          content = Buffer.from(this.generateXML(filteredRecords));
          extension = 'xml';
          break;
        default:
          throw new Error(`Unsupported export format: ${job.format}`);
      }

      job.fileName = `export_${job.id}.${extension}`;
      job.fileSize = content.length;
      job.fileUrl = `/api/exports/${job.id}/download`;
      job.exportedRecords = records.length;
      job.progress = 100;
      job.status = 'completed';
      job.completedAt = new Date();
      job.expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

      await this.exportJobRepo.save(job);

      this.eventEmitter.emit('export.completed', { jobId: job.id, fileUrl: job.fileUrl });

    } catch (error) {
      const err = error as Error;
      job.status = 'failed';
      job.errorMessage = err.message;
      job.completedAt = new Date();
      await this.exportJobRepo.save(job);

      this.eventEmitter.emit('export.failed', { jobId: job.id, error: err.message });
    }
  }

  private async fetchRecordsForExport(_job: ExportJob): Promise<Record<string, unknown>[]> {
    return [];
  }

  private filterProperties(
    record: Record<string, unknown>,
    includeProperties?: string[] | null,
    excludeProperties?: string[] | null,
  ): Record<string, unknown> {
    if (!includeProperties && !excludeProperties) return record;

    const result: Record<string, unknown> = {};

    if (includeProperties && includeProperties.length > 0) {
      for (const prop of includeProperties) {
        if (prop in record) {
          result[prop] = record[prop];
        }
      }
    } else {
      Object.assign(result, record);
    }

    if (excludeProperties && excludeProperties.length > 0) {
      for (const prop of excludeProperties) {
        delete result[prop];
      }
    }

    return result;
  }

  private generateCSV(records: Record<string, unknown>[]): string {
    if (records.length === 0) return '';

    const headers = Object.keys(records[0]);
    const lines: string[] = [headers.join(',')];

    for (const record of records) {
      const values = headers.map(header => {
        const value = record[header];
        if (value === null || value === undefined) return '';
        const strValue = String(value);
        if (strValue.includes(',') || strValue.includes('"') || strValue.includes('\n')) {
          return `"${strValue.replace(/"/g, '""')}"`;
        }
        return strValue;
      });
      lines.push(values.join(','));
    }

    return lines.join('\n');
  }

  private generateXML(records: Record<string, unknown>[]): string {
    const lines: string[] = ['<?xml version="1.0" encoding="UTF-8"?>', '<records>'];

    for (const record of records) {
      lines.push('  <record>');
      for (const [key, value] of Object.entries(record)) {
        const escapedValue = this.escapeXML(String(value ?? ''));
        lines.push(`    <${key}>${escapedValue}</${key}>`);
      }
      lines.push('  </record>');
    }

    lines.push('</records>');
    return lines.join('\n');
  }

  private escapeXML(value: string): string {
    return value
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&apos;');
  }

  async findExportJob(id: string): Promise<ExportJob | null> {
    return this.exportJobRepo.findOne({ where: { id } });
  }

  async findAllExportJobs(params: {
    status?: ImportExportStatus;
    collectionId?: string;
    limit?: number;
    offset?: number;
  } = {}): Promise<{ items: ExportJob[]; total: number }> {
    const where: Record<string, unknown> = {};
    if (params.status) where.status = params.status;
    if (params.collectionId) where.sourceCollectionId = params.collectionId;

    const [items, total] = await this.exportJobRepo.findAndCount({
      where,
      take: params.limit || 50,
      skip: params.offset || 0,
      order: { createdAt: 'DESC' },
    });

    return { items, total };
  }

  async cancelExportJob(id: string): Promise<ExportJob> {
    const job = await this.findExportJob(id);
    if (!job) throw new Error('Export job not found');

    job.status = 'cancelled';
    job.completedAt = new Date();

    return this.exportJobRepo.save(job);
  }

  async cleanupExpiredExports(): Promise<number> {
    const result = await this.exportJobRepo.delete({
      expiresAt: { $lt: new Date() } as unknown as Date,
    });

    return result.affected || 0;
  }
}
