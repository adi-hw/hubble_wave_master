import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  AuditLog,
  CollectionDefinition,
  DatasetDefinition,
  DatasetSnapshot,
  InstanceEventOutbox,
} from '@hubblewave/instance-db';
import { DatasetDefinitionRequest, DatasetDefinitionUpdate, DatasetSnapshotSummary } from './dataset.types';

@Injectable()
export class DatasetService {
  constructor(
    @InjectRepository(DatasetDefinition)
    private readonly definitionRepo: Repository<DatasetDefinition>,
    @InjectRepository(DatasetSnapshot)
    private readonly snapshotRepo: Repository<DatasetSnapshot>,
    @InjectRepository(InstanceEventOutbox)
    private readonly outboxRepo: Repository<InstanceEventOutbox>,
    @InjectRepository(CollectionDefinition)
    private readonly collectionRepo: Repository<CollectionDefinition>,
    @InjectRepository(AuditLog)
    private readonly auditRepo: Repository<AuditLog>,
  ) {}

  async listDefinitions(): Promise<DatasetDefinition[]> {
    return this.definitionRepo.find({ order: { createdAt: 'DESC' } });
  }

  async getDefinition(id: string): Promise<DatasetDefinition> {
    const definition = await this.definitionRepo.findOne({ where: { id } });
    if (!definition) {
      throw new NotFoundException('Dataset definition not found');
    }
    return definition;
  }

  async createDefinition(payload: DatasetDefinitionRequest, actorId?: string): Promise<DatasetDefinition> {
    this.validateDefinition(payload);
    await this.ensureCollection(payload.sourceCollectionCode);

    const existing = await this.definitionRepo.findOne({ where: { code: payload.code } });
    if (existing) {
      throw new BadRequestException(`Dataset ${payload.code} already exists`);
    }

    const definition = this.definitionRepo.create({
      code: payload.code,
      name: payload.name.trim(),
      description: payload.description?.trim() || null,
      sourceCollectionCode: payload.sourceCollectionCode,
      filter: payload.filter || {},
      labelMapping: payload.labelMapping || {},
      featureMapping: payload.featureMapping || {},
      status: payload.status || 'draft',
      version: 1,
      metadata: payload.metadata || {},
      isActive: true,
      createdBy: actorId || null,
      updatedBy: actorId || null,
    });

    const saved = await this.definitionRepo.save(definition);
    await this.logAudit('dataset_definitions', 'modelops.dataset.create', actorId, saved.id, null, {
      code: saved.code,
      name: saved.name,
      status: saved.status,
    });
    return saved;
  }

  async updateDefinition(
    id: string,
    payload: DatasetDefinitionUpdate,
    actorId?: string,
  ): Promise<DatasetDefinition> {
    const definition = await this.getDefinition(id);
    const previous = {
      name: definition.name,
      description: definition.description,
      sourceCollectionCode: definition.sourceCollectionCode,
      status: definition.status,
      filter: definition.filter,
      labelMapping: definition.labelMapping,
      featureMapping: definition.featureMapping,
      version: definition.version,
    };

    if (payload.name !== undefined) {
      if (!payload.name.trim()) {
        throw new BadRequestException('Dataset name is required');
      }
      definition.name = payload.name.trim();
    }
    if (payload.description !== undefined) {
      definition.description = payload.description?.trim() || null;
    }
    if (payload.sourceCollectionCode !== undefined) {
      await this.ensureCollection(payload.sourceCollectionCode);
      definition.sourceCollectionCode = payload.sourceCollectionCode;
    }
    if (payload.filter !== undefined) {
      definition.filter = payload.filter || {};
    }
    if (payload.labelMapping !== undefined) {
      definition.labelMapping = payload.labelMapping || {};
    }
    if (payload.featureMapping !== undefined) {
      definition.featureMapping = payload.featureMapping || {};
    }
    if (payload.status) {
      definition.status = payload.status;
    }
    if (payload.metadata) {
      definition.metadata = { ...(definition.metadata || {}), ...payload.metadata };
    }

    definition.version = definition.version + 1;
    definition.updatedBy = actorId || null;

    const saved = await this.definitionRepo.save(definition);
    await this.logAudit('dataset_definitions', 'modelops.dataset.update', actorId, saved.id, previous, {
      name: saved.name,
      description: saved.description,
      sourceCollectionCode: saved.sourceCollectionCode,
      status: saved.status,
      filter: saved.filter,
      labelMapping: saved.labelMapping,
      featureMapping: saved.featureMapping,
      version: saved.version,
    });
    return saved;
  }

  async requestSnapshot(definitionId: string, actorId?: string): Promise<DatasetSnapshot> {
    const definition = await this.getDefinition(definitionId);
    if (!definition.isActive) {
      throw new BadRequestException('Dataset definition is inactive');
    }

    const snapshot = this.snapshotRepo.create({
      datasetDefinitionId: definition.id,
      status: 'pending',
      metadata: {
        definition: this.snapshotDefinition(definition),
      },
      requestedBy: actorId || null,
    });
    const saved = await this.snapshotRepo.save(snapshot);

    const outbox = this.outboxRepo.create({
      eventType: 'ava.dataset.snapshot',
      collectionCode: 'dataset_snapshots',
      recordId: saved.id,
      payload: {
        snapshotId: saved.id,
        definitionId: definition.id,
        requestedBy: actorId || null,
      },
    });
    await this.outboxRepo.save(outbox);

    await this.logAudit('dataset_snapshots', 'modelops.dataset.snapshot.request', actorId, saved.id, null, {
      datasetDefinitionId: definition.id,
      status: saved.status,
    });

    return saved;
  }

  async listSnapshots(definitionId: string): Promise<DatasetSnapshotSummary[]> {
    const snapshots = await this.snapshotRepo.find({
      where: { datasetDefinitionId: definitionId },
      order: { createdAt: 'DESC' },
    });

    return snapshots.map((snapshot) => ({
      id: snapshot.id,
      datasetDefinitionId: snapshot.datasetDefinitionId,
      status: snapshot.status,
      snapshotUri: snapshot.snapshotUri || null,
      rowCount: snapshot.rowCount ?? null,
      checksum: snapshot.checksum || null,
      requestedBy: snapshot.requestedBy || null,
      startedAt: snapshot.startedAt ? snapshot.startedAt.toISOString() : null,
      completedAt: snapshot.completedAt ? snapshot.completedAt.toISOString() : null,
      createdAt: snapshot.createdAt.toISOString(),
    }));
  }

  private validateDefinition(payload: DatasetDefinitionRequest) {
    if (!payload.code || !payload.code.trim()) {
      throw new BadRequestException('Dataset code is required');
    }
    if (!/^[a-z0-9_]+$/.test(payload.code)) {
      throw new BadRequestException('Dataset code must be lowercase alphanumeric with underscores');
    }
    if (!payload.name || !payload.name.trim()) {
      throw new BadRequestException('Dataset name is required');
    }
    if (!payload.sourceCollectionCode || !payload.sourceCollectionCode.trim()) {
      throw new BadRequestException('Source collection code is required');
    }
  }

  private async ensureCollection(collectionCode: string): Promise<void> {
    const collection = await this.collectionRepo.findOne({ where: { code: collectionCode, isActive: true } });
    if (!collection) {
      throw new NotFoundException(`Collection ${collectionCode} not found`);
    }
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
      capturedAt: new Date().toISOString(),
    };
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
