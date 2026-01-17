import { BadRequestException, Injectable, NotFoundException, OnModuleInit } from '@nestjs/common';
import { Inject } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  AuditLog,
  DatasetSnapshot,
  ModelArtifact,
} from '@hubblewave/instance-db';
import {
  STORAGE_CLIENT,
  STORAGE_CONFIG,
  StorageClient,
  StorageConfig,
  buildStorageKey,
} from '@hubblewave/storage';
import { ModelArtifactRegister, ModelArtifactRequest, ModelArtifactUpdate } from './model-registry.types';

@Injectable()
export class ModelRegistryService implements OnModuleInit {
  private readonly bucketName: string;

  constructor(
    @InjectRepository(ModelArtifact)
    private readonly artifactRepo: Repository<ModelArtifact>,
    @InjectRepository(DatasetSnapshot)
    private readonly snapshotRepo: Repository<DatasetSnapshot>,
    @InjectRepository(AuditLog)
    private readonly auditRepo: Repository<AuditLog>,
    @Inject(STORAGE_CLIENT)
    private readonly storageClient: StorageClient,
    @Inject(STORAGE_CONFIG)
    private readonly storageConfig: StorageConfig,
  ) {
    this.bucketName = this.storageConfig.buckets.modelVault;
  }

  async onModuleInit(): Promise<void> {
    await this.storageClient.ensureBucket(this.bucketName);
  }

  async listArtifacts(): Promise<ModelArtifact[]> {
    return this.artifactRepo.find({ order: { createdAt: 'DESC' } });
  }

  async getArtifact(id: string): Promise<ModelArtifact> {
    const artifact = await this.artifactRepo.findOne({ where: { id } });
    if (!artifact) {
      throw new NotFoundException('Model artifact not found');
    }
    return artifact;
  }

  async createArtifact(payload: ModelArtifactRequest, actorId?: string) {
    this.validateCreate(payload);
    const snapshot = await this.resolveSnapshot(payload.datasetSnapshotId);
    const key = this.buildArtifactKey(payload.code, payload.version, payload.filename);
    const contentType = payload.contentType || 'application/octet-stream';

    const artifact = this.artifactRepo.create({
      code: payload.code,
      name: payload.name.trim(),
      version: payload.version.trim(),
      description: payload.description?.trim() || null,
      datasetSnapshotId: snapshot?.id || null,
      artifactBucket: this.bucketName,
      artifactKey: key,
      contentType,
      status: 'draft',
      metadata: payload.metadata || {},
      createdBy: actorId || null,
      updatedBy: actorId || null,
    });

    const saved = await this.artifactRepo.save(artifact);

    const uploadUrl = await this.storageClient.getSignedUrl({
      bucket: this.bucketName,
      key,
      operation: 'put',
      expiresInSeconds: 900,
      contentType,
    });

    await this.logAudit('model_artifacts', 'modelops.model.create', actorId, saved.id, null, {
      code: saved.code,
      version: saved.version,
      datasetSnapshotId: saved.datasetSnapshotId,
      artifactKey: saved.artifactKey,
    });

    return {
      artifact: saved,
      upload: {
        bucket: this.bucketName,
        key,
        url: uploadUrl,
        expiresInSeconds: 900,
      },
    };
  }

  async updateArtifact(
    id: string,
    payload: ModelArtifactUpdate,
    actorId?: string,
  ): Promise<ModelArtifact> {
    const artifact = await this.getArtifact(id);
    const previous = {
      name: artifact.name,
      description: artifact.description,
      status: artifact.status,
      metadata: artifact.metadata,
    };

    if (payload.name !== undefined) {
      if (!payload.name.trim()) {
        throw new BadRequestException('Model name is required');
      }
      artifact.name = payload.name.trim();
    }
    if (payload.description !== undefined) {
      artifact.description = payload.description?.trim() || null;
    }
    if (payload.status) {
      artifact.status = payload.status;
    }
    if (payload.metadata) {
      artifact.metadata = { ...(artifact.metadata || {}), ...payload.metadata };
    }
    artifact.updatedBy = actorId || null;

    const saved = await this.artifactRepo.save(artifact);
    await this.logAudit('model_artifacts', 'modelops.model.update', actorId, saved.id, previous, {
      name: saved.name,
      description: saved.description,
      status: saved.status,
      metadata: saved.metadata,
    });
    return saved;
  }

  async registerArtifact(
    id: string,
    payload: ModelArtifactRegister,
    actorId?: string,
  ): Promise<ModelArtifact> {
    const artifact = await this.getArtifact(id);
    if (!payload.checksum || !payload.checksum.trim()) {
      throw new BadRequestException('Checksum is required');
    }

    const previous = {
      checksum: artifact.checksum,
      sizeBytes: artifact.sizeBytes,
      contentType: artifact.contentType,
      status: artifact.status,
    };

    artifact.checksum = payload.checksum.trim();
    if (payload.sizeBytes !== undefined) {
      artifact.sizeBytes = String(payload.sizeBytes);
    }
    if (payload.contentType) {
      artifact.contentType = payload.contentType;
    }
    artifact.status = 'registered';
    artifact.updatedBy = actorId || null;

    const saved = await this.artifactRepo.save(artifact);
    await this.logAudit('model_artifacts', 'modelops.model.register', actorId, saved.id, previous, {
      checksum: saved.checksum,
      sizeBytes: saved.sizeBytes,
      contentType: saved.contentType,
      status: saved.status,
    });
    return saved;
  }

  async createDownloadUrl(id: string): Promise<{ url: string; expiresInSeconds: number }> {
    const artifact = await this.getArtifact(id);
    const url = await this.storageClient.getSignedUrl({
      bucket: artifact.artifactBucket,
      key: artifact.artifactKey,
      operation: 'get',
      expiresInSeconds: 900,
    });
    return { url, expiresInSeconds: 900 };
  }

  private validateCreate(payload: ModelArtifactRequest) {
    if (!payload.code || !payload.code.trim()) {
      throw new BadRequestException('Model code is required');
    }
    if (!/^[a-z0-9_]+$/.test(payload.code)) {
      throw new BadRequestException('Model code must be lowercase alphanumeric with underscores');
    }
    if (!payload.name || !payload.name.trim()) {
      throw new BadRequestException('Model name is required');
    }
    if (!payload.version || !payload.version.trim()) {
      throw new BadRequestException('Model version is required');
    }
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

  private buildArtifactKey(code: string, version: string, filename?: string): string {
    const safeFilename = filename?.trim() || 'model.bin';
    return buildStorageKey('model-vault', code, version, safeFilename);
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
