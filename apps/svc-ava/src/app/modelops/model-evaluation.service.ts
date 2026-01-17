import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  AuditLog,
  AnalyticsEvent,
  DatasetSnapshot,
  ModelArtifact,
  ModelEvaluation,
} from '@hubblewave/instance-db';
import { ModelEvaluationRequest, ModelEvaluationUpdate } from './model-evaluation.types';

@Injectable()
export class ModelEvaluationService {
  constructor(
    @InjectRepository(ModelArtifact)
    private readonly artifactRepo: Repository<ModelArtifact>,
    @InjectRepository(ModelEvaluation)
    private readonly evaluationRepo: Repository<ModelEvaluation>,
    @InjectRepository(DatasetSnapshot)
    private readonly snapshotRepo: Repository<DatasetSnapshot>,
    @InjectRepository(AuditLog)
    private readonly auditRepo: Repository<AuditLog>,
    @InjectRepository(AnalyticsEvent)
    private readonly analyticsRepo: Repository<AnalyticsEvent>,
  ) {}

  async listEvaluations(modelArtifactId: string): Promise<ModelEvaluation[]> {
    await this.ensureArtifact(modelArtifactId);
    return this.evaluationRepo.find({
      where: { modelArtifactId },
      order: { createdAt: 'DESC' },
    });
  }

  async getEvaluation(modelArtifactId: string, evaluationId: string): Promise<ModelEvaluation> {
    await this.ensureArtifact(modelArtifactId);
    const evaluation = await this.evaluationRepo.findOne({
      where: { id: evaluationId, modelArtifactId },
    });
    if (!evaluation) {
      throw new NotFoundException('Model evaluation not found');
    }
    return evaluation;
  }

  async createEvaluation(
    modelArtifactId: string,
    payload: ModelEvaluationRequest,
    actorId?: string,
  ): Promise<ModelEvaluation> {
    const artifact = await this.ensureArtifact(modelArtifactId);
    const snapshot = await this.resolveSnapshot(payload.datasetSnapshotId);

    const evaluation = this.evaluationRepo.create({
      modelArtifactId: artifact.id,
      datasetSnapshotId: snapshot?.id || null,
      metrics: payload.metrics || {},
      confusionMatrix: payload.confusionMatrix || {},
      calibrationStats: payload.calibrationStats || {},
      status: payload.status || 'completed',
      metadata: payload.metadata || {},
      createdBy: actorId || null,
    });

    const saved = await this.evaluationRepo.save(evaluation);
    await this.logAudit('model_evaluations', 'modelops.model.evaluation.create', actorId, saved.id, null, {
      modelArtifactId: artifact.id,
      datasetSnapshotId: saved.datasetSnapshotId,
      status: saved.status,
    });
    await this.logAnalytics('modelops.evaluation.created', actorId, {
      evaluationId: saved.id,
      modelArtifactId: artifact.id,
      datasetSnapshotId: saved.datasetSnapshotId,
      status: saved.status,
    });
    return saved;
  }

  async updateEvaluation(
    modelArtifactId: string,
    evaluationId: string,
    payload: ModelEvaluationUpdate,
    actorId?: string,
  ): Promise<ModelEvaluation> {
    await this.ensureArtifact(modelArtifactId);
    const evaluation = await this.getEvaluation(modelArtifactId, evaluationId);

    const previous = {
      metrics: evaluation.metrics,
      confusionMatrix: evaluation.confusionMatrix,
      calibrationStats: evaluation.calibrationStats,
      status: evaluation.status,
      metadata: evaluation.metadata,
    };

    if (payload.metrics !== undefined) {
      evaluation.metrics = payload.metrics;
    }
    if (payload.confusionMatrix !== undefined) {
      evaluation.confusionMatrix = payload.confusionMatrix;
    }
    if (payload.calibrationStats !== undefined) {
      evaluation.calibrationStats = payload.calibrationStats;
    }
    if (payload.status) {
      evaluation.status = payload.status;
    }
    if (payload.metadata) {
      evaluation.metadata = { ...(evaluation.metadata || {}), ...payload.metadata };
    }

    const saved = await this.evaluationRepo.save(evaluation);
    await this.logAudit('model_evaluations', 'modelops.model.evaluation.update', actorId, saved.id, previous, {
      metrics: saved.metrics,
      confusionMatrix: saved.confusionMatrix,
      calibrationStats: saved.calibrationStats,
      status: saved.status,
      metadata: saved.metadata,
    });
    return saved;
  }

  private async ensureArtifact(modelArtifactId: string): Promise<ModelArtifact> {
    const artifact = await this.artifactRepo.findOne({ where: { id: modelArtifactId } });
    if (!artifact) {
      throw new NotFoundException('Model artifact not found');
    }
    if (artifact.status !== 'registered') {
      throw new BadRequestException('Model artifact must be registered before evaluation');
    }
    return artifact;
  }

  private async resolveSnapshot(snapshotId?: string): Promise<DatasetSnapshot | null> {
    if (!snapshotId) return null;
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

  private async logAnalytics(
    eventType: string,
    userId: string | undefined,
    metadata: Record<string, unknown>,
  ): Promise<void> {
    const event = this.analyticsRepo.create({
      userId: userId || null,
      eventType,
      eventCategory: 'modelops',
      eventAction: eventType.split('.').pop(),
      metadata,
      timestamp: new Date(),
    });
    await this.analyticsRepo.save(event);
  }
}
