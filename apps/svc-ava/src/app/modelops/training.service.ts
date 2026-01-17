import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  AuditLog,
  DatasetSnapshot,
  InstanceEventOutbox,
  ModelArtifact,
  ModelTrainingJob,
} from '@hubblewave/instance-db';
import { ModelTrainingRequest, ModelTrainingSummary } from './training.types';

@Injectable()
export class ModelTrainingService {
  constructor(
    @InjectRepository(ModelTrainingJob)
    private readonly trainingRepo: Repository<ModelTrainingJob>,
    @InjectRepository(DatasetSnapshot)
    private readonly snapshotRepo: Repository<DatasetSnapshot>,
    @InjectRepository(ModelArtifact)
    private readonly artifactRepo: Repository<ModelArtifact>,
    @InjectRepository(InstanceEventOutbox)
    private readonly outboxRepo: Repository<InstanceEventOutbox>,
    @InjectRepository(AuditLog)
    private readonly auditRepo: Repository<AuditLog>,
  ) {}

  async listJobs(): Promise<ModelTrainingSummary[]> {
    const jobs = await this.trainingRepo.find({ order: { createdAt: 'DESC' } });
    return jobs.map((job) => ({
      id: job.id,
      datasetSnapshotId: job.datasetSnapshotId,
      modelCode: job.modelCode,
      modelName: job.modelName,
      modelVersion: job.modelVersion,
      algorithm: job.algorithm,
      status: job.status,
      modelArtifactId: job.modelArtifactId || null,
      requestedBy: job.requestedBy || null,
      startedAt: job.startedAt ? job.startedAt.toISOString() : null,
      completedAt: job.completedAt ? job.completedAt.toISOString() : null,
      createdAt: job.createdAt.toISOString(),
    }));
  }

  async getJob(id: string): Promise<ModelTrainingJob> {
    const job = await this.trainingRepo.findOne({ where: { id } });
    if (!job) {
      throw new NotFoundException('Training job not found');
    }
    return job;
  }

  async requestTraining(payload: ModelTrainingRequest, actorId?: string): Promise<ModelTrainingJob> {
    this.validateRequest(payload);
    const snapshot = await this.ensureSnapshot(payload.datasetSnapshotId);

    const existing = await this.artifactRepo.findOne({
      where: { code: payload.modelCode, version: payload.modelVersion },
    });
    if (existing) {
      throw new BadRequestException('Model artifact already exists for this version');
    }

    const job = this.trainingRepo.create({
      datasetSnapshotId: snapshot.id,
      modelCode: payload.modelCode,
      modelName: payload.modelName.trim(),
      modelVersion: payload.modelVersion.trim(),
      algorithm: payload.algorithm.trim(),
      hyperparameters: payload.hyperparameters || {},
      trainingConfig: payload.trainingConfig || {},
      metrics: {},
      status: 'pending',
      requestedBy: actorId || null,
      metadata: payload.metadata || {},
    });
    const saved = await this.trainingRepo.save(job);

    const outbox = this.outboxRepo.create({
      eventType: 'ava.model.train',
      collectionCode: 'model_training_jobs',
      recordId: saved.id,
      payload: {
        trainingJobId: saved.id,
      },
    });
    await this.outboxRepo.save(outbox);

    await this.logAudit('model_training_jobs', 'modelops.training.request', actorId, saved.id, null, {
      modelCode: saved.modelCode,
      modelVersion: saved.modelVersion,
      datasetSnapshotId: saved.datasetSnapshotId,
      status: saved.status,
    });

    return saved;
  }

  private validateRequest(payload: ModelTrainingRequest) {
    if (!payload.datasetSnapshotId) {
      throw new BadRequestException('datasetSnapshotId is required');
    }
    if (!payload.modelCode || !/^[a-z0-9_]+$/.test(payload.modelCode)) {
      throw new BadRequestException('modelCode must be lowercase alphanumeric with underscores');
    }
    if (!payload.modelName || !payload.modelName.trim()) {
      throw new BadRequestException('modelName is required');
    }
    if (!payload.modelVersion || !payload.modelVersion.trim()) {
      throw new BadRequestException('modelVersion is required');
    }
    if (!payload.algorithm || !payload.algorithm.trim()) {
      throw new BadRequestException('algorithm is required');
    }
  }

  private async ensureSnapshot(snapshotId: string): Promise<DatasetSnapshot> {
    const snapshot = await this.snapshotRepo.findOne({ where: { id: snapshotId } });
    if (!snapshot) {
      throw new NotFoundException('Dataset snapshot not found');
    }
    if (snapshot.status !== 'completed') {
      throw new BadRequestException('Dataset snapshot is not completed');
    }
    return snapshot;
  }

  private async logAudit(
    collectionCode: string,
    action: string,
    actorId: string | undefined,
    recordId: string,
    oldValues: Record<string, unknown> | null,
    newValues: Record<string, unknown>,
  ) {
    const log = this.auditRepo.create({
      userId: actorId || null,
      action,
      collectionCode,
      recordId,
      oldValues,
      newValues,
    });
    await this.auditRepo.save(log);
  }
}
