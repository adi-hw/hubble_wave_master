import { Injectable, Logger, OnModuleDestroy, OnModuleInit, Inject } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { createHash } from 'crypto';
import { Repository } from 'typeorm';
import {
  AuditLog,
  AnalyticsEvent,
  InstanceEventOutbox,
  ModelArtifact,
  ModelTrainingJob,
  DatasetSnapshot,
} from '@hubblewave/instance-db';
import {
  STORAGE_CLIENT,
  STORAGE_CONFIG,
  StorageClient,
  StorageConfig,
  buildStorageKey,
} from '@hubblewave/storage';

@Injectable()
export class TrainingProcessorService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(TrainingProcessorService.name);
  private pollTimer: NodeJS.Timeout | null = null;
  private isRunning = false;
  private readonly batchSize: number;
  private readonly pollIntervalMs: number;
  private readonly lockTimeoutMs: number;
  private readonly bucketName: string;

  constructor(
    private readonly configService: ConfigService,
    @InjectRepository(ModelTrainingJob)
    private readonly trainingRepo: Repository<ModelTrainingJob>,
    @InjectRepository(ModelArtifact)
    private readonly artifactRepo: Repository<ModelArtifact>,
    @InjectRepository(DatasetSnapshot)
    private readonly snapshotRepo: Repository<DatasetSnapshot>,
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
    this.batchSize = parseInt(this.configService.get('TRAINING_OUTBOX_BATCH_SIZE', '5'), 10);
    this.pollIntervalMs = parseInt(this.configService.get('TRAINING_OUTBOX_POLL_MS', '4000'), 10);
    this.lockTimeoutMs = parseInt(this.configService.get('TRAINING_OUTBOX_LOCK_TIMEOUT_MS', '60000'), 10);
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
          const payload = entry.payload as { trainingJobId?: string };
          if (!payload.trainingJobId) {
            throw new Error('trainingJobId is required');
          }
          await this.processTraining(payload.trainingJobId);
          await this.markProcessed(entry.id);
        } catch (error) {
          await this.markFailed(entry.id, (error as Error).message);
        }
      }
    } catch (error) {
      this.logger.error(`Training outbox poll failed: ${(error as Error).message}`);
    } finally {
      this.isRunning = false;
    }
  }

  private async processTraining(trainingJobId: string): Promise<void> {
    const job = await this.trainingRepo.findOne({ where: { id: trainingJobId } });
    if (!job) {
      throw new Error('Training job not found');
    }
    if (job.status === 'completed') {
      return;
    }

    job.status = 'running';
    job.startedAt = new Date();
    job.errorMessage = null;
    await this.trainingRepo.save(job);

    const snapshot = await this.snapshotRepo.findOne({ where: { id: job.datasetSnapshotId } });
    if (!snapshot || snapshot.status !== 'completed') {
      throw new Error('Dataset snapshot not ready');
    }

    try {
      const artifactKey = buildStorageKey('model-vault', job.modelCode, job.modelVersion, 'model.json');
      const payload = this.buildArtifactPayload(job, snapshot);
      const checksum = createHash('sha256').update(JSON.stringify(payload)).digest('hex');

      await this.storageClient.putObject({
        bucket: this.bucketName,
        key: artifactKey,
        body: JSON.stringify(payload),
        contentType: 'application/json',
        metadata: {
          model_code: job.modelCode,
          model_version: job.modelVersion,
          training_job_id: job.id,
        },
      });

      const artifact = this.artifactRepo.create({
        code: job.modelCode,
        name: job.modelName,
        version: job.modelVersion,
        description: job.trainingConfig?.description as string | undefined,
        datasetSnapshotId: job.datasetSnapshotId,
        artifactBucket: this.bucketName,
        artifactKey,
        contentType: 'application/json',
        checksum,
        sizeBytes: String(Buffer.byteLength(JSON.stringify(payload))),
        status: 'registered',
        metadata: {
          trainingJobId: job.id,
          algorithm: job.algorithm,
          hyperparameters: job.hyperparameters,
          metrics: job.metrics,
        },
        createdBy: job.requestedBy || null,
        updatedBy: job.requestedBy || null,
      });
      const savedArtifact = await this.artifactRepo.save(artifact);

      job.status = 'completed';
      job.completedAt = new Date();
      job.modelArtifactId = savedArtifact.id;
      job.metadata = {
        ...job.metadata,
        artifactId: savedArtifact.id,
        checksum,
        artifactKey,
      };
      await this.trainingRepo.save(job);

      await this.logAudit('model_training_jobs', 'modelops.training.completed', job.id, null, {
        modelArtifactId: savedArtifact.id,
        artifactKey,
        checksum,
      });
      await this.logAnalytics('modelops.training.completed', job.requestedBy || undefined, {
        trainingJobId: job.id,
        modelArtifactId: savedArtifact.id,
        modelCode: job.modelCode,
        modelVersion: job.modelVersion,
        status: job.status,
      });
    } catch (error) {
      job.status = 'failed';
      job.completedAt = new Date();
      job.errorMessage = (error as Error).message;
      await this.trainingRepo.save(job);
      await this.logAudit('model_training_jobs', 'modelops.training.failed', job.id, null, {
        error: job.errorMessage,
      });
      await this.logAnalytics('modelops.training.failed', job.requestedBy || undefined, {
        trainingJobId: job.id,
        modelArtifactId: job.modelArtifactId,
        modelCode: job.modelCode,
        modelVersion: job.modelVersion,
        status: job.status,
        error: job.errorMessage,
      });
      throw error;
    }
  }

  private buildArtifactPayload(job: ModelTrainingJob, snapshot: DatasetSnapshot): Record<string, unknown> {
    return {
      trainingJobId: job.id,
      model: {
        code: job.modelCode,
        name: job.modelName,
        version: job.modelVersion,
        algorithm: job.algorithm,
      },
      datasetSnapshotId: snapshot.id,
      snapshotChecksum: snapshot.checksum,
      hyperparameters: job.hyperparameters,
      trainingConfig: job.trainingConfig,
      metrics: job.metrics,
      trainedAt: new Date().toISOString(),
    };
  }

  private async logAudit(
    collectionCode: string,
    action: string,
    recordId: string,
    oldValues: Record<string, unknown> | null,
    newValues: Record<string, unknown>,
  ) {
    const log = this.auditRepo.create({
      userId: null,
      action,
      collectionCode,
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
          AND event_type = 'ava.model.train'
        ORDER BY created_at ASC
        LIMIT $2
        FOR UPDATE SKIP LOCKED
      )
      RETURNING *
    `;

    const rows = (await this.outboxRepo.query(query, [lockCutoff, this.batchSize])) as Array<{
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
