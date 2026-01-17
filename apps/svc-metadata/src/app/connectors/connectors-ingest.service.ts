import { BadRequestException, ConflictException, Injectable } from '@nestjs/common';
import { EntityManager } from 'typeorm';
import {
  CollectionDefinition,
  ConnectorAuthType,
  ConnectorConnection,
  ConnectorType,
  ConflictResolution,
  DataTransformation,
  ExternalConnector,
  PropertyMapping,
  PropertyMappingEntry,
  SyncConfiguration,
  SyncDirection,
  SyncMode,
} from '@hubblewave/instance-db';

type ConnectorAsset = {
  definitions?: ConnectorDefinitionAsset[];
  installations?: ConnectorInstallationAsset[];
};

type ConnectorDefinitionAsset = {
  code: string;
  name: string;
  description?: string;
  type: ConnectorType;
  version?: string;
  icon_url?: string;
  documentation_url?: string;
  config_schema?: Record<string, unknown>;
  auth_type: ConnectorAuthType;
  supported_operations?: string[];
  metadata?: Record<string, unknown>;
};

type ConnectorInstallationAsset = {
  code: string;
  name: string;
  connector_code: string;
  description?: string;
  config?: Record<string, unknown>;
  credential_ref?: string;
  mappings?: ConnectorMappingAsset[];
  syncs?: ConnectorSyncAsset[];
  metadata?: Record<string, unknown>;
};

type ConnectorMappingAsset = {
  code: string;
  name: string;
  source_entity: string;
  target_collection_code?: string;
  direction?: SyncDirection;
  mappings?: PropertyMappingEntry[];
  transformations?: DataTransformation[];
  filters?: Record<string, unknown>;
  sync_mode?: SyncMode;
  conflict_resolution?: ConflictResolution;
  metadata?: Record<string, unknown>;
};

type ConnectorSyncAsset = {
  code: string;
  name: string;
  description?: string;
  mapping_code?: string;
  schedule?: string;
  direction?: SyncDirection;
  sync_mode?: SyncMode;
  conflict_resolution?: ConflictResolution;
  batch_size?: number;
  metadata?: Record<string, unknown>;
};

@Injectable()
export class ConnectorsIngestService {
  async applyAsset(
    manager: EntityManager,
    rawAsset: unknown,
    context: { packCode: string; releaseId: string; actorId?: string; status?: 'draft' | 'published' | 'deprecated' },
  ): Promise<void> {
    const asset = this.parseAsset(rawAsset);
    const connectorRepo = manager.getRepository(ExternalConnector);
    const connectionRepo = manager.getRepository(ConnectorConnection);
    const mappingRepo = manager.getRepository(PropertyMapping);
    const syncRepo = manager.getRepository(SyncConfiguration);
    const collectionRepo = manager.getRepository(CollectionDefinition);

    for (const definition of asset.definitions || []) {
      const existing = await connectorRepo.findOne({ where: { code: definition.code } });
      if (existing) {
        this.assertPackOwnership(existing.metadata, context.packCode, 'connector', definition.code);
        existing.name = definition.name;
        existing.description = definition.description ?? undefined;
        existing.type = definition.type;
        existing.version = definition.version || existing.version;
        existing.iconUrl = definition.icon_url ?? undefined;
        existing.documentationUrl = definition.documentation_url ?? undefined;
        existing.configSchema = definition.config_schema || {};
        existing.authType = definition.auth_type;
        existing.supportedOperations = definition.supported_operations || [];
        existing.metadata = this.mergeMetadata(definition.metadata, context, existing.metadata);
        existing.isActive = true;
        existing.updatedBy = context.actorId;
        await connectorRepo.save(existing);
      } else {
        const created = connectorRepo.create({
          code: definition.code,
          name: definition.name,
          description: definition.description ?? undefined,
          type: definition.type,
          version: definition.version || '1.0.0',
          iconUrl: definition.icon_url ?? undefined,
          documentationUrl: definition.documentation_url ?? undefined,
          configSchema: definition.config_schema || {},
          authType: definition.auth_type,
          supportedOperations: definition.supported_operations || [],
          metadata: this.mergeMetadata(definition.metadata, context),
          isSystem: false,
          isActive: true,
          createdBy: context.actorId || undefined,
          updatedBy: context.actorId || undefined,
        });
        await connectorRepo.save(created);
      }
    }

    for (const installation of asset.installations || []) {
      const connector = await connectorRepo.findOne({ where: { code: installation.connector_code } });
      if (!connector) {
        throw new BadRequestException(`Unknown connector ${installation.connector_code} for installation ${installation.code}`);
      }

      let connection = await connectionRepo.findOne({ where: { code: installation.code } });
      if (connection) {
        this.assertPackOwnership(connection.metadata, context.packCode, 'connection', installation.code);
        if (connection.connectorId !== connector.id) {
          throw new ConflictException(`Connection ${installation.code} is bound to a different connector`);
        }
        connection.name = installation.name;
        connection.description = installation.description ?? undefined;
        connection.config = installation.config || {};
        connection.credentialRef = installation.credential_ref ?? connection.credentialRef ?? null;
        connection.metadata = this.mergeMetadata(installation.metadata, context, connection.metadata);
        connection.isActive = true;
        connection.updatedBy = context.actorId || undefined;
        await connectionRepo.save(connection);
      } else {
        connection = connectionRepo.create({
          code: installation.code,
          connectorId: connector.id,
          name: installation.name,
          description: installation.description ?? undefined,
          config: installation.config || {},
          credentialRef: installation.credential_ref ?? null,
          status: 'disconnected',
          isActive: true,
          metadata: this.mergeMetadata(installation.metadata, context),
          createdBy: context.actorId || undefined,
          updatedBy: context.actorId || undefined,
        });
        connection = await connectionRepo.save(connection);
      }

      const mappingByCode = new Map<string, PropertyMapping>();
      for (const mapping of installation.mappings || []) {
        let targetCollectionId: string | undefined;
        if (mapping.target_collection_code) {
          const collection = await collectionRepo.findOne({
            where: { code: mapping.target_collection_code, isActive: true },
          });
          if (!collection) {
            throw new BadRequestException(
              `Unknown collection ${mapping.target_collection_code} for mapping ${mapping.code}`,
            );
          }
          targetCollectionId = collection.id;
        }

        const existing = await mappingRepo.findOne({
          where: { code: mapping.code, connectionId: connection.id },
        });
        if (existing) {
          this.assertPackOwnership(existing.metadata, context.packCode, 'mapping', mapping.code);
          existing.name = mapping.name;
          existing.sourceEntity = mapping.source_entity;
          existing.targetCollectionId = targetCollectionId;
          existing.direction = mapping.direction || existing.direction;
          existing.mappings = mapping.mappings || [];
          existing.transformations = mapping.transformations || [];
          existing.filters = mapping.filters || undefined;
          existing.syncMode = mapping.sync_mode || existing.syncMode;
          existing.conflictResolution = mapping.conflict_resolution || existing.conflictResolution;
          existing.metadata = this.mergeMetadata(mapping.metadata, context, existing.metadata);
          existing.isActive = true;
          existing.updatedBy = context.actorId || undefined;
          mappingByCode.set(mapping.code, await mappingRepo.save(existing));
        } else {
          const created = mappingRepo.create({
            code: mapping.code,
            connectionId: connection.id,
            name: mapping.name,
            sourceEntity: mapping.source_entity,
            targetCollectionId,
            direction: mapping.direction || 'bidirectional',
            mappings: mapping.mappings || [],
            transformations: mapping.transformations || [],
            filters: mapping.filters || undefined,
            syncMode: mapping.sync_mode || 'incremental',
            conflictResolution: mapping.conflict_resolution || 'source_wins',
            metadata: this.mergeMetadata(mapping.metadata, context),
            isActive: true,
            createdBy: context.actorId || undefined,
            updatedBy: context.actorId || undefined,
          });
          mappingByCode.set(mapping.code, await mappingRepo.save(created));
        }
      }

      for (const sync of installation.syncs || []) {
        const resolvedMapping =
          sync.mapping_code
            ? mappingByCode.get(sync.mapping_code)
            : mappingByCode.size === 1
              ? Array.from(mappingByCode.values())[0]
              : undefined;
        if (sync.mapping_code && !resolvedMapping) {
          throw new BadRequestException(`Unknown mapping ${sync.mapping_code} for sync ${sync.code}`);
        }

        const existing = await syncRepo.findOne({
          where: { code: sync.code, connectionId: connection.id },
        });
        if (existing) {
          this.assertPackOwnership(existing.metadata, context.packCode, 'sync', sync.code);
          existing.name = sync.name;
          existing.description = sync.description ?? existing.description;
          existing.mappingId = resolvedMapping?.id || existing.mappingId;
          existing.schedule = sync.schedule ?? existing.schedule;
          existing.direction = sync.direction || existing.direction;
          existing.syncMode = sync.sync_mode || existing.syncMode;
          existing.conflictResolution = sync.conflict_resolution || existing.conflictResolution;
          existing.batchSize = sync.batch_size || existing.batchSize;
          existing.metadata = this.mergeMetadata(sync.metadata, context, existing.metadata);
          existing.isActive = true;
          existing.updatedBy = context.actorId || undefined;
          await syncRepo.save(existing);
        } else {
          const created = syncRepo.create({
            code: sync.code,
            name: sync.name,
            description: sync.description ?? undefined,
            connectionId: connection.id,
            mappingId: resolvedMapping?.id,
            schedule: sync.schedule ?? undefined,
            direction: sync.direction || 'bidirectional',
            syncMode: sync.sync_mode || 'incremental',
            conflictResolution: sync.conflict_resolution || 'source_wins',
            batchSize: sync.batch_size || 100,
            metadata: this.mergeMetadata(sync.metadata, context),
            isActive: true,
            createdBy: context.actorId || undefined,
            updatedBy: context.actorId || undefined,
          });
          await syncRepo.save(created);
        }
      }
    }
  }

  async deactivateAsset(
    manager: EntityManager,
    rawAsset: unknown,
    context: { packCode: string; releaseId: string; actorId?: string },
  ): Promise<void> {
    const asset = this.parseAsset(rawAsset);
    const connectorRepo = manager.getRepository(ExternalConnector);
    const connectionRepo = manager.getRepository(ConnectorConnection);
    const mappingRepo = manager.getRepository(PropertyMapping);
    const syncRepo = manager.getRepository(SyncConfiguration);

    for (const definition of asset.definitions || []) {
      const existing = await connectorRepo.findOne({ where: { code: definition.code } });
      if (!existing) continue;
      this.assertPackOwnership(existing.metadata, context.packCode, 'connector', definition.code);
      existing.isActive = false;
      existing.metadata = this.mergeMetadata(definition.metadata, { ...context, status: 'deprecated' }, existing.metadata);
      existing.updatedBy = context.actorId;
      await connectorRepo.save(existing);
    }

    for (const installation of asset.installations || []) {
      const connection = await connectionRepo.findOne({ where: { code: installation.code } });
      if (!connection) {
        continue;
      }
      this.assertPackOwnership(connection.metadata, context.packCode, 'connection', installation.code);
      connection.isActive = false;
      connection.metadata = this.mergeMetadata(installation.metadata, { ...context, status: 'deprecated' }, connection.metadata);
      connection.updatedBy = context.actorId || undefined;
      await connectionRepo.save(connection);

      const mappings = await mappingRepo.find({ where: { connectionId: connection.id } });
      for (const mapping of mappings) {
        this.assertPackOwnership(mapping.metadata, context.packCode, 'mapping', mapping.code || mapping.id);
        mapping.isActive = false;
        mapping.metadata = this.mergeMetadata(mapping.metadata, { ...context, status: 'deprecated' }, mapping.metadata);
        mapping.updatedBy = context.actorId || undefined;
      }
      if (mappings.length) {
        await mappingRepo.save(mappings);
      }

      const syncs = await syncRepo.find({ where: { connectionId: connection.id } });
      for (const sync of syncs) {
        this.assertPackOwnership(sync.metadata, context.packCode, 'sync', sync.code || sync.id);
        sync.isActive = false;
        sync.metadata = this.mergeMetadata(sync.metadata, { ...context, status: 'deprecated' }, sync.metadata);
        sync.updatedBy = context.actorId || undefined;
      }
      if (syncs.length) {
        await syncRepo.save(syncs);
      }
    }
  }

  private parseAsset(raw: unknown): ConnectorAsset {
    if (!raw || typeof raw !== 'object') {
      throw new BadRequestException('Connector asset must be an object');
    }
    const asset = raw as ConnectorAsset;
    const hasContent =
      (asset.definitions && asset.definitions.length) ||
      (asset.installations && asset.installations.length);
    if (!hasContent) {
      throw new BadRequestException('Connector asset must include definitions or installations');
    }

    this.validateDefinitions(asset.definitions || []);
    this.validateInstallations(asset.installations || []);

    return asset;
  }

  private validateDefinitions(definitions: ConnectorDefinitionAsset[]): void {
    const seen = new Set<string>();
    for (const definition of definitions) {
      if (!definition.code || typeof definition.code !== 'string') {
        throw new BadRequestException('Connector definition code is required');
      }
      if (!this.isValidCode(definition.code)) {
        throw new BadRequestException(`Connector definition code ${definition.code} is invalid`);
      }
      if (seen.has(definition.code)) {
        throw new BadRequestException(`Duplicate connector definition code ${definition.code}`);
      }
      seen.add(definition.code);
      if (!definition.name || typeof definition.name !== 'string') {
        throw new BadRequestException(`Connector definition ${definition.code} is missing name`);
      }
      if (!this.isValidConnectorType(definition.type)) {
        throw new BadRequestException(`Connector definition ${definition.code} has invalid type`);
      }
      if (!this.isValidAuthType(definition.auth_type)) {
        throw new BadRequestException(`Connector definition ${definition.code} has invalid auth type`);
      }
    }
  }

  private validateInstallations(installations: ConnectorInstallationAsset[]): void {
    const seen = new Set<string>();
    for (const installation of installations) {
      if (!installation.code || typeof installation.code !== 'string') {
        throw new BadRequestException('Connector installation code is required');
      }
      if (!this.isValidCode(installation.code)) {
        throw new BadRequestException(`Connector installation code ${installation.code} is invalid`);
      }
      if (seen.has(installation.code)) {
        throw new BadRequestException(`Duplicate connector installation code ${installation.code}`);
      }
      seen.add(installation.code);
      if (!installation.name || typeof installation.name !== 'string') {
        throw new BadRequestException(`Connector installation ${installation.code} is missing name`);
      }
      if (!installation.connector_code || typeof installation.connector_code !== 'string') {
        throw new BadRequestException(`Connector installation ${installation.code} is missing connector_code`);
      }
      if (installation.credential_ref !== undefined && typeof installation.credential_ref !== 'string') {
        throw new BadRequestException(`Connector installation ${installation.code} has invalid credential_ref`);
      }
      this.validateMappings(installation.mappings || []);
      this.validateSyncs(installation.syncs || []);
    }
  }

  private validateMappings(mappings: ConnectorMappingAsset[]): void {
    const seen = new Set<string>();
    for (const mapping of mappings) {
      if (!mapping.code || typeof mapping.code !== 'string') {
        throw new BadRequestException('Connector mapping code is required');
      }
      if (!this.isValidCode(mapping.code)) {
        throw new BadRequestException(`Connector mapping code ${mapping.code} is invalid`);
      }
      if (seen.has(mapping.code)) {
        throw new BadRequestException(`Duplicate connector mapping code ${mapping.code}`);
      }
      seen.add(mapping.code);
      if (!mapping.name || typeof mapping.name !== 'string') {
        throw new BadRequestException(`Connector mapping ${mapping.code} is missing name`);
      }
      if (!mapping.source_entity || typeof mapping.source_entity !== 'string') {
        throw new BadRequestException(`Connector mapping ${mapping.code} is missing source_entity`);
      }
      if (mapping.direction && !this.isValidDirection(mapping.direction)) {
        throw new BadRequestException(`Connector mapping ${mapping.code} has invalid direction`);
      }
      if (mapping.sync_mode && !this.isValidSyncMode(mapping.sync_mode)) {
        throw new BadRequestException(`Connector mapping ${mapping.code} has invalid sync_mode`);
      }
      if (mapping.conflict_resolution && !this.isValidConflictResolution(mapping.conflict_resolution)) {
        throw new BadRequestException(`Connector mapping ${mapping.code} has invalid conflict_resolution`);
      }
    }
  }

  private validateSyncs(syncs: ConnectorSyncAsset[]): void {
    const seen = new Set<string>();
    for (const sync of syncs) {
      if (!sync.code || typeof sync.code !== 'string') {
        throw new BadRequestException('Connector sync code is required');
      }
      if (!this.isValidCode(sync.code)) {
        throw new BadRequestException(`Connector sync code ${sync.code} is invalid`);
      }
      if (seen.has(sync.code)) {
        throw new BadRequestException(`Duplicate connector sync code ${sync.code}`);
      }
      seen.add(sync.code);
      if (!sync.name || typeof sync.name !== 'string') {
        throw new BadRequestException(`Connector sync ${sync.code} is missing name`);
      }
      if (sync.direction && !this.isValidDirection(sync.direction)) {
        throw new BadRequestException(`Connector sync ${sync.code} has invalid direction`);
      }
      if (sync.sync_mode && !this.isValidSyncMode(sync.sync_mode)) {
        throw new BadRequestException(`Connector sync ${sync.code} has invalid sync_mode`);
      }
      if (sync.conflict_resolution && !this.isValidConflictResolution(sync.conflict_resolution)) {
        throw new BadRequestException(`Connector sync ${sync.code} has invalid conflict_resolution`);
      }
    }
  }

  private mergeMetadata(
    incoming: Record<string, unknown> | undefined,
    context: { packCode: string; releaseId: string; status?: 'draft' | 'published' | 'deprecated' },
    existing: Record<string, unknown> = {},
  ): Record<string, unknown> {
    const existingStatus = (existing as { status?: string }).status;
    const status = context.status || (existingStatus as 'draft' | 'published' | 'deprecated' | undefined) || 'draft';
    return {
      ...existing,
      ...incoming,
      status,
      pack: {
        code: context.packCode,
        release_id: context.releaseId,
      },
    };
  }

  private assertPackOwnership(
    metadata: Record<string, unknown>,
    packCode: string,
    entityType: 'connector' | 'connection' | 'mapping' | 'sync',
    entityCode: string,
  ): void {
    const existingPack = (metadata as { pack?: { code?: string } }).pack?.code;
    if (existingPack && existingPack !== packCode) {
      throw new ConflictException(
        `${entityType} ${entityCode} is owned by pack ${existingPack}`,
      );
    }
  }

  private isValidCode(value: string): boolean {
    return /^[a-z0-9_]+$/.test(value);
  }

  private isValidConnectorType(value: ConnectorType): boolean {
    return [
      'crm',
      'erp',
      'itsm',
      'project_management',
      'database',
      'file_storage',
      'generic',
    ].includes(value);
  }

  private isValidAuthType(value: ConnectorAuthType): boolean {
    return ['none', 'api_key', 'basic', 'oauth2', 'jwt', 'custom'].includes(value);
  }

  private isValidDirection(value: SyncDirection): boolean {
    return ['inbound', 'outbound', 'bidirectional'].includes(value);
  }

  private isValidSyncMode(value: SyncMode): boolean {
    return ['full', 'incremental', 'delta'].includes(value);
  }

  private isValidConflictResolution(value: ConflictResolution): boolean {
    return ['source_wins', 'target_wins', 'newest_wins', 'manual'].includes(value);
  }
}
