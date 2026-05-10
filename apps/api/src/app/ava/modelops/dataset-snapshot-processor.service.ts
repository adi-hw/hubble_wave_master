import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Inject } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { createHash } from 'crypto';
import { DataSource, Repository } from 'typeorm';
import {
  AuditLog,
  AnalyticsEvent,
  CollectionDefinition,
  DatasetDefinition,
  DatasetSnapshot,
  InstanceEventOutbox,
} from '@hubblewave/instance-db';
import {
  STORAGE_CLIENT,
  STORAGE_CONFIG,
  StorageClient,
  StorageConfig,
  buildStorageKey,
} from '@hubblewave/storage';

@Injectable()
export class DatasetSnapshotProcessorService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(DatasetSnapshotProcessorService.name);
  private pollTimer: NodeJS.Timeout | null = null;
  private isRunning = false;
  private readonly batchSize: number;
  private readonly pollIntervalMs: number;
  private readonly lockTimeoutMs: number;
  private readonly bucketName: string;

  constructor(
    private readonly dataSource: DataSource,
    private readonly configService: ConfigService,
    @InjectRepository(DatasetSnapshot)
    private readonly snapshotRepo: Repository<DatasetSnapshot>,
    @InjectRepository(DatasetDefinition)
    private readonly definitionRepo: Repository<DatasetDefinition>,
    @InjectRepository(CollectionDefinition)
    private readonly collectionRepo: Repository<CollectionDefinition>,
    @InjectRepository(InstanceEventOutbox)
    private readonly outboxRepo: Repository<InstanceEventOutbox>,
    @InjectRepository(AuditLog)
    private readonly auditRepo: Repository<AuditLog>,
    @InjectRepository(AnalyticsEvent)
    private readonly analyticsRepo: Repository<AnalyticsEvent>,
    @Inject(STORAGE_CLIENT)
    private readonly storageClient: StorageClient,
    @Inject(STORAGE_CONFIG)
    private readonly storageConfig: StorageConfig,
  ) {
    this.batchSize = parseInt(this.configService.get('DATASET_OUTBOX_BATCH_SIZE', '10'), 10);
    this.pollIntervalMs = parseInt(this.configService.get('DATASET_OUTBOX_POLL_MS', '3000'), 10);
    this.lockTimeoutMs = parseInt(this.configService.get('DATASET_OUTBOX_LOCK_TIMEOUT_MS', '60000'), 10);
    this.bucketName = this.storageConfig.buckets.modelVault;
  }

  onModuleInit(): void {
    this.pollTimer = setInterval(() => {
      void this.poll();
    }, this.pollIntervalMs);
  }

  onModuleDestroy(): void {
    if (this.pollTimer) {
      clearInterval(this.pollTimer);
      this.pollTimer = null;
    }
  }

  private async poll(): Promise<void> {
    if (this.isRunning) return;
    this.isRunning = true;

    try {
      const entries = await this.claimPending();
      if (!entries.length) return;

      for (const entry of entries) {
        try {
          const payload = entry.payload as { snapshotId?: string };
          if (!payload.snapshotId) {
            throw new Error('Snapshot id is required');
          }
          await this.processSnapshot(payload.snapshotId);
          await this.markProcessed(entry.id);
        } catch (error) {
          await this.markFailed(entry.id, (error as Error).message);
        }
      }
    } catch (error) {
      this.logger.error(`Dataset snapshot poll failed: ${(error as Error).message}`);
    } finally {
      this.isRunning = false;
    }
  }

  private async processSnapshot(snapshotId: string): Promise<void> {
    const snapshot = await this.snapshotRepo.findOne({ where: { id: snapshotId } });
    if (!snapshot) {
      throw new Error('Dataset snapshot not found');
    }
    if (snapshot.status === 'completed') {
      return;
    }

    snapshot.status = 'running';
    snapshot.startedAt = new Date();
    snapshot.errorMessage = null;
    await this.snapshotRepo.save(snapshot);

    const definition = await this.definitionRepo.findOne({ where: { id: snapshot.datasetDefinitionId } });
    if (!definition) {
      throw new Error('Dataset definition not found');
    }
    const collection = await this.collectionRepo.findOne({
      where: { code: definition.sourceCollectionCode, isActive: true },
    });
    if (!collection) {
      throw new Error(`Collection ${definition.sourceCollectionCode} not found`);
    }

    try {
      const rowCount = await this.countRows(collection.tableName, definition.filter || {});
      const snapshotKey = buildStorageKey('model-vault', 'datasets', definition.code, `${snapshot.id}.json`);
      const payload = this.buildSnapshotPayload(definition, rowCount);
      const checksum = this.computeChecksum(payload);

      await this.storageClient.putObject({
        bucket: this.bucketName,
        key: snapshotKey,
        body: JSON.stringify(payload),
        contentType: 'application/json',
        metadata: {
          dataset_code: definition.code,
          snapshot_id: snapshot.id,
        },
      });

      snapshot.status = 'completed';
      snapshot.completedAt = new Date();
      snapshot.rowCount = rowCount;
      snapshot.snapshotUri = `s3://${this.bucketName}/${snapshotKey}`;
      snapshot.checksum = checksum;
      snapshot.metadata = {
        ...snapshot.metadata,
        definition: this.snapshotDefinition(definition),
        rowCount,
      };
      await this.snapshotRepo.save(snapshot);

      await this.logAudit('modelops.dataset.snapshot.complete', snapshot.id, null, {
        datasetDefinitionId: definition.id,
        rowCount,
        checksum,
        snapshotKey,
      });
      await this.logAnalytics('modelops.dataset.snapshot.completed', snapshot.requestedBy || undefined, {
        datasetDefinitionId: definition.id,
        snapshotId: snapshot.id,
        rowCount,
        status: snapshot.status,
      });
    } catch (error) {
      snapshot.status = 'failed';
      snapshot.completedAt = new Date();
      snapshot.errorMessage = (error as Error).message;
      await this.snapshotRepo.save(snapshot);

      await this.logAudit('modelops.dataset.snapshot.failed', snapshot.id, null, {
        datasetDefinitionId: definition.id,
        error: snapshot.errorMessage,
      });
      await this.logAnalytics('modelops.dataset.snapshot.failed', snapshot.requestedBy || undefined, {
        datasetDefinitionId: definition.id,
        snapshotId: snapshot.id,
        error: snapshot.errorMessage,
        status: snapshot.status,
      });
      throw error;
    }
  }

  private async countRows(tableName: string, filter: Record<string, unknown>): Promise<number> {
    const qb = this.dataSource.createQueryBuilder().select('COUNT(*)', 'count').from(tableName, 't');
    const conditions = Object.entries(filter || {});
    conditions.forEach(([key, value], index) => {
      if (!this.isSafeColumn(key)) {
        throw new Error(`Unsupported filter column ${key}`);
      }
      const param = `filter_${index}`;
      qb.andWhere(`t.${key} = :${param}`, { [param]: value });
    });
    const result = await qb.getRawOne<{ count: string }>();
    return result?.count ? Number(result.count) : 0;
  }

  private computeChecksum(payload: Record<string, unknown>): string {
    return createHash('sha256').update(JSON.stringify(payload)).digest('hex');
  }

  private snapshotDefinition(definition: DatasetDefinition): Record<string, unknown> {
    return {
      id: definition.id,
      code: definition.code,
      name: definition.name,
      description: definition.description,
      sourceCollectionCode: definition.sourceCollectionCode,
      filter: definition.filter,
      labelMapping: definition.labelMapping,
      featureMapping: definition.featureMapping,
      version: definition.version,
      status: definition.status,
    };
  }

  private buildSnapshotPayload(definition: DatasetDefinition, rowCount: number): Record<string, unknown> {
    return {
      definition: this.snapshotDefinition(definition),
      rowCount,
      capturedAt: new Date().toISOString(),
    };
  }

  private isSafeColumn(column: string): boolean {
    return /^[a-zA-Z0-9_]+$/.test(column);
  }

  private async logAudit(
    action: string,
    recordId: string,
    oldValues: Record<string, unknown> | null,
    newValues: Record<string, unknown>,
  ) {
    const log = this.auditRepo.create({
      userId: null,
      action,
      collectionCode: 'dataset_snapshots',
      recordId,
      oldValues,
      newValues,
    });
    await this.auditRepo.save(log);
  }

  private async logAnalytics(
    eventType: string,
    userId: string | undefined,
    metadata: Record<string, unknown>,
  ): Promise<void> {
    const event = this.analyticsRepo.create({
      userId,
      eventType,
      eventCategory: 'modelops',
      eventAction: eventType.split('.').pop(),
      eventValue: metadata.rowCount as number | undefined,
      metadata,
      timestamp: new Date(),
    });
    await this.analyticsRepo.save(event);
  }

  private async claimPending(): Promise<InstanceEventOutbox[]> {
    const lockCutoff = new Date(Date.now() - this.lockTimeoutMs).toISOString();
    const query = `
      UPDATE instance_event_outbox
      SET status = 'processing', locked_at = NOW(), attempts = attempts + 1
      WHERE id IN (
        SELECT id
        FROM instance_event_outbox
        WHERE status = 'pending'
          AND (locked_at IS NULL OR locked_at < $1)
          AND event_type = 'ava.dataset.snapshot'
        ORDER BY created_at ASC
        LIMIT $2
        FOR UPDATE SKIP LOCKED
      )
      RETURNING *
    `;

    const rows = (await this.dataSource.query(query, [lockCutoff, this.batchSize])) as Array<{
      id: string;
      event_type: string;
      collection_code: string | null;
      record_id: string | null;
      payload: Record<string, unknown>;
      status: string;
      attempts: number;
      locked_at: Date | null;
      processed_at: Date | null;
      error_message: string | null;
      created_at: Date;
    }>;

    return (rows || []).map((row) => ({
      id: row.id,
      eventType: row.event_type,
      collectionCode: row.collection_code,
      recordId: row.record_id,
      payload: row.payload,
      status: row.status as InstanceEventOutbox['status'],
      attempts: row.attempts,
      lockedAt: row.locked_at,
      processedAt: row.processed_at,
      errorMessage: row.error_message,
      createdAt: row.created_at,
    }));
  }

  private async markProcessed(id: string): Promise<void> {
    await this.outboxRepo
      .createQueryBuilder()
      .update(InstanceEventOutbox)
      .set({
        status: 'processed',
        processedAt: new Date(),
        lockedAt: null,
        errorMessage: null,
      })
      .where('id = :id', { id })
      .execute();
  }

  private async markFailed(id: string, message: string): Promise<void> {
    await this.outboxRepo
      .createQueryBuilder()
      .update(InstanceEventOutbox)
      .set({
        status: 'failed',
        processedAt: new Date(),
        lockedAt: null,
        errorMessage: message,
      })
      .where('id = :id', { id })
      .execute();
  }
}
