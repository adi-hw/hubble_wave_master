/**
 * Connector Service
 * HubbleWave Platform - Phase 5
 *
 * Manages external connectors and data synchronization.
 */

import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository, LessThan } from 'typeorm';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { AuthorizationService } from '@hubblewave/authorization';
import {
  ExternalConnector,
  ConnectorConnection,
  PropertyMapping,
  SyncConfiguration,
  SyncRun,
  ConnectionStatus,
  SyncDirection,
  SyncMode,
  ConflictResolution,
  PropertyMappingEntry,
  SyncRunStatus,
  CollectionDefinition,
  PropertyDefinition,
  AuditLog,
} from '@hubblewave/instance-db';
import { ConnectorCredentialsService } from './connector-credentials.service';
import { EventOutboxService } from '../events/event-outbox.service';
import { RequestContext } from '@hubblewave/auth-guard';

interface CreateConnectionDto {
  connectorId: string;
  name: string;
  description?: string;
  config: Record<string, unknown>;
  credentialRef?: string;
  createdBy?: string;
}

interface CreatePropertyMappingDto {
  connectionId: string;
  name: string;
  sourceEntity: string;
  targetCollectionId: string;
  direction?: SyncDirection;
  mappings: PropertyMappingEntry[];
  syncMode?: SyncMode;
  conflictResolution?: ConflictResolution;
  createdBy?: string;
}

interface CreateSyncConfigDto {
  name: string;
  description?: string;
  connectionId: string;
  mappingId?: string;
  schedule?: string;
  direction?: SyncDirection;
  syncMode?: SyncMode;
  conflictResolution?: ConflictResolution;
  batchSize?: number;
  createdBy?: string;
}

type RetryPolicy = {
  enabled: boolean;
  maxAttempts: number;
  backoffSeconds: number;
  backoffMultiplier: number;
  maxBackoffSeconds: number;
};

type RetryState = {
  consecutiveFailures: number;
  lastFailureAt?: string | null;
  nextRetryAt?: string | null;
};

@Injectable()
export class ConnectorService {
  private readonly systemUserId = '00000000-0000-0000-0000-000000000000';

  constructor(
    @InjectRepository(ExternalConnector)
    private readonly connectorRepo: Repository<ExternalConnector>,
    @InjectRepository(ConnectorConnection)
    private readonly connectionRepo: Repository<ConnectorConnection>,
    @InjectRepository(PropertyMapping)
    private readonly mappingRepo: Repository<PropertyMapping>,
    @InjectRepository(CollectionDefinition)
    private readonly collectionRepo: Repository<CollectionDefinition>,
    @InjectRepository(PropertyDefinition)
    private readonly propertyRepo: Repository<PropertyDefinition>,
    @InjectRepository(AuditLog)
    private readonly auditRepo: Repository<AuditLog>,
    @InjectRepository(SyncConfiguration)
    private readonly syncConfigRepo: Repository<SyncConfiguration>,
    @InjectRepository(SyncRun)
    private readonly syncRunRepo: Repository<SyncRun>,
    private readonly eventEmitter: EventEmitter2,
    private readonly dataSource: DataSource,
    private readonly authz: AuthorizationService,
    private readonly outboxService: EventOutboxService,
    private readonly credentialsService: ConnectorCredentialsService,
  ) {
  }

  // Connector Management

  async findAllConnectors(params: {
    type?: string;
    isActive?: boolean;
    limit?: number;
    offset?: number;
  } = {}): Promise<{ items: ExternalConnector[]; total: number }> {
    const where: Record<string, unknown> = {};
    if (params.type) where.type = params.type;
    if (params.isActive !== undefined) where.isActive = params.isActive;

    const [items, total] = await this.connectorRepo.findAndCount({
      where,
      take: params.limit || 50,
      skip: params.offset || 0,
      order: { name: 'ASC' },
    });

    return { items, total };
  }

  async findConnectorById(id: string): Promise<ExternalConnector | null> {
    return this.connectorRepo.findOne({ where: { id } });
  }

  async findConnectorByCode(code: string): Promise<ExternalConnector | null> {
    return this.connectorRepo.findOne({ where: { code } });
  }

  // Connection Management

  async createConnection(dto: CreateConnectionDto): Promise<ConnectorConnection> {
    const connector = await this.findConnectorById(dto.connectorId);
    if (!connector) throw new Error('Connector not found');

    const connection = this.connectionRepo.create({
      connectorId: dto.connectorId,
      name: dto.name,
      description: dto.description,
      config: dto.config,
      credentialRef: dto.credentialRef || null,
      status: 'disconnected' as ConnectionStatus,
      isActive: true,
      createdBy: dto.createdBy,
    });

    return this.connectionRepo.save(connection);
  }

  async findConnectionById(id: string): Promise<ConnectorConnection | null> {
    return this.connectionRepo.findOne({
      where: { id },
      relations: ['connector'],
    });
  }

  async findAllConnections(params: {
    connectorId?: string;
    status?: ConnectionStatus;
    limit?: number;
    offset?: number;
  } = {}): Promise<{ items: ConnectorConnection[]; total: number }> {
    const where: Record<string, unknown> = {};
    if (params.connectorId) where.connectorId = params.connectorId;
    if (params.status) where.status = params.status;

    const [items, total] = await this.connectionRepo.findAndCount({
      where,
      relations: ['connector'],
      take: params.limit || 50,
      skip: params.offset || 0,
      order: { createdAt: 'DESC' },
    });

    return { items, total };
  }

  async testConnection(id: string): Promise<{ success: boolean; error?: string }> {
    const connection = await this.findConnectionById(id);
    if (!connection) throw new Error('Connection not found');

    try {
      connection.status = 'testing';
      await this.connectionRepo.save(connection);

      const credentials = connection.credentialRef
        ? await this.credentialsService.resolveCredentials(connection.credentialRef)
        : {};

      await this.executeConnectionTest(connection.connector, connection.config, credentials);

      connection.status = 'connected';
      connection.lastConnectedAt = new Date();
      connection.errorMessage = undefined;
      await this.connectionRepo.save(connection);

      return { success: true };

    } catch (error) {
      const err = error as Error;
      connection.status = 'error';
      connection.errorMessage = err.message;
      await this.connectionRepo.save(connection);

      return { success: false, error: err.message };
    }
  }

  private async executeConnectionTest(
    connector: ExternalConnector,
    config: Record<string, unknown>,
    credentials: Record<string, unknown>,
  ): Promise<void> {
    switch (connector.code) {
      case 'salesforce':
        await this.testSalesforceConnection(config, credentials);
        break;
      case 'jira':
        await this.testJiraConnection(config, credentials);
        break;
      case 'servicenow':
        await this.testServiceNowConnection(config, credentials);
        break;
      case 'sap':
        await this.testSAPConnection(config, credentials);
        break;
      case 'rest_api':
        await this.testRestApiConnection(config, credentials);
        break;
      default:
        throw new Error(`Connector type ${connector.code} not supported`);
    }
  }

  private async testSalesforceConnection(
    config: Record<string, unknown>,
    _credentials: Record<string, unknown>,
  ): Promise<void> {
    const instanceUrl = config.instanceUrl as string;
    if (!instanceUrl) throw new Error('Instance URL required');

    const response = await fetch(`${instanceUrl}/services/data/v58.0/`, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
    });

    if (!response.ok) {
      throw new Error(`Salesforce connection failed: ${response.status}`);
    }
  }

  private async testJiraConnection(
    config: Record<string, unknown>,
    _credentials: Record<string, unknown>,
  ): Promise<void> {
    const baseUrl = config.baseUrl as string;
    if (!baseUrl) throw new Error('Base URL required');

    const response = await fetch(`${baseUrl}/rest/api/3/myself`, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
    });

    if (!response.ok) {
      throw new Error(`Jira connection failed: ${response.status}`);
    }
  }

  private async testServiceNowConnection(
    config: Record<string, unknown>,
    _credentials: Record<string, unknown>,
  ): Promise<void> {
    const instanceUrl = config.instanceUrl as string;
    if (!instanceUrl) throw new Error('Instance URL required');

    const response = await fetch(`${instanceUrl}/api/now/table/sys_user?sysparm_limit=1`, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
    });

    if (!response.ok) {
      throw new Error(`ServiceNow connection failed: ${response.status}`);
    }
  }

  private async testSAPConnection(
    config: Record<string, unknown>,
    _credentials: Record<string, unknown>,
  ): Promise<void> {
    const baseUrl = config.baseUrl as string;
    if (!baseUrl) throw new Error('Base URL required');

    const response = await fetch(`${baseUrl}/sap/opu/odata/sap/API_BUSINESS_PARTNER/A_BusinessPartner?$top=1`, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
    });

    if (!response.ok) {
      throw new Error(`SAP connection failed: ${response.status}`);
    }
  }

  private async testRestApiConnection(
    config: Record<string, unknown>,
    _credentials: Record<string, unknown>,
  ): Promise<void> {
    const baseUrl = config.baseUrl as string;
    if (!baseUrl) throw new Error('Base URL required');

    const response = await fetch(baseUrl, {
      method: 'GET',
      headers: config.defaultHeaders as Record<string, string> || {},
    });

    if (!response.ok) {
      throw new Error(`REST API connection failed: ${response.status}`);
    }
  }

  async updateConnection(id: string, dto: Partial<CreateConnectionDto>): Promise<ConnectorConnection> {
    const connection = await this.findConnectionById(id);
    if (!connection) throw new Error('Connection not found');

    Object.assign(connection, dto);
    return this.connectionRepo.save(connection);
  }

  async deleteConnection(id: string): Promise<void> {
    await this.connectionRepo.delete(id);
  }

  // Property Mapping

  async createPropertyMapping(dto: CreatePropertyMappingDto): Promise<PropertyMapping> {
    const mapping = this.mappingRepo.create({
      ...dto,
      direction: dto.direction || 'bidirectional',
      syncMode: dto.syncMode || 'incremental',
      conflictResolution: dto.conflictResolution || 'source_wins',
      transformations: [],
      isActive: true,
    });

    return this.mappingRepo.save(mapping);
  }

  async findPropertyMappingById(id: string): Promise<PropertyMapping | null> {
    return this.mappingRepo.findOne({
      where: { id },
      relations: ['connection'],
    });
  }

  async findAllPropertyMappings(connectionId: string): Promise<PropertyMapping[]> {
    return this.mappingRepo.find({
      where: { connectionId },
      order: { createdAt: 'DESC' },
    });
  }

  async updatePropertyMapping(id: string, dto: Partial<CreatePropertyMappingDto>): Promise<PropertyMapping> {
    await this.mappingRepo.update(id, dto);
    const mapping = await this.findPropertyMappingById(id);
    if (!mapping) throw new Error('Property mapping not found');
    return mapping;
  }

  async deletePropertyMapping(id: string): Promise<void> {
    await this.mappingRepo.delete(id);
  }

  // Sync Configuration

  async createSyncConfig(dto: CreateSyncConfigDto): Promise<SyncConfiguration> {
    const config = this.syncConfigRepo.create({
      ...dto,
      direction: dto.direction || 'bidirectional',
      syncMode: dto.syncMode || 'incremental',
      conflictResolution: dto.conflictResolution || 'source_wins',
      batchSize: dto.batchSize || 100,
      isActive: true,
      runCount: 0,
      successCount: 0,
      failureCount: 0,
    });

    if (dto.schedule) {
      config.nextRunAt = this.calculateNextRun(dto.schedule);
    }

    return this.syncConfigRepo.save(config);
  }


  async findSyncConfigById(id: string): Promise<SyncConfiguration | null> {
    return this.syncConfigRepo.findOne({
      where: { id },
      relations: ['connection', 'mapping'],
    });
  }

  async findAllSyncConfigs(params: {
    connectionId?: string;
    isActive?: boolean;
    limit?: number;
    offset?: number;
  } = {}): Promise<{ items: SyncConfiguration[]; total: number }> {
    const where: Record<string, unknown> = {};
    if (params.connectionId) where.connectionId = params.connectionId;
    if (params.isActive !== undefined) where.isActive = params.isActive;

    const [items, total] = await this.syncConfigRepo.findAndCount({
      where,
      relations: ['connection'],
      take: params.limit || 50,
      skip: params.offset || 0,
      order: { createdAt: 'DESC' },
    });

    return { items, total };
  }

  async updateSyncConfig(id: string, dto: Partial<CreateSyncConfigDto>): Promise<SyncConfiguration> {
    if (dto.schedule) {
      (dto as SyncConfiguration).nextRunAt = this.calculateNextRun(dto.schedule);
    }

    await this.syncConfigRepo.update(id, dto);
    const config = await this.findSyncConfigById(id);
    if (!config) throw new Error('Sync configuration not found');
    return config;
  }

  async deleteSyncConfig(id: string): Promise<void> {
    await this.syncConfigRepo.delete(id);
  }

  // Sync Execution

  async runSync(configId: string): Promise<SyncRun> {
    const config = await this.findSyncConfigById(configId);
    if (!config) throw new Error('Sync configuration not found');

    if (config.schedule) {
      config.nextRunAt = this.calculateNextRun(config.schedule);
      await this.syncConfigRepo.save(config);
    }

    const run = this.syncRunRepo.create({
      configurationId: configId,
      status: 'running' as SyncRunStatus,
      direction: config.direction,
      recordsProcessed: 0,
      recordsCreated: 0,
      recordsUpdated: 0,
      recordsDeleted: 0,
      recordsSkipped: 0,
      recordsFailed: 0,
      conflictsDetected: 0,
      conflictsResolved: 0,
      log: [],
    });

    const savedRun = await this.syncRunRepo.save(run);

    const targetCollectionCode = config.mapping?.targetCollectionId
      ? (await this.getCollectionById(config.mapping.targetCollectionId)).code
      : null;

    await this.writeAuditLog({
      collectionCode: targetCollectionCode,
      recordId: null,
      action: 'connector.sync.run.start',
      newValues: {
        runId: savedRun.id,
        configurationId: config.id,
        connectionId: config.connectionId,
      },
    });

    this.executeSyncRun(savedRun, config);

    return savedRun;
  }

  private async executeSyncRun(run: SyncRun, config: SyncConfiguration): Promise<void> {
    try {
      this.addLogEntry(run, 'info', 'Starting sync run');

      const connection = await this.findConnectionById(config.connectionId);
      if (!connection) throw new Error('Connection not found');

      if (connection.status !== 'connected') {
        const testResult = await this.testConnection(connection.id);
        if (!testResult.success) {
          throw new Error(`Connection test failed: ${testResult.error}`);
        }
      }

      this.addLogEntry(run, 'info', 'Connection verified');

      const mapping = config.mappingId
        ? await this.findPropertyMappingById(config.mappingId)
        : null;

      await this.performSync(run, config, connection, mapping);

      run.status = 'completed';
      run.completedAt = new Date();
      run.durationMs = Date.now() - run.startedAt.getTime();

      this.addLogEntry(run, 'info', `Sync completed: ${run.recordsProcessed} records processed`);

      await this.syncRunRepo.save(run);

      config.lastRunAt = new Date();
      config.runCount++;
      config.successCount++;
      config.metadata = this.resetRetryState(config.metadata);
      if (config.schedule) {
        config.nextRunAt = this.calculateNextRun(config.schedule);
      }
      await this.syncConfigRepo.save(config);

      const targetCollectionCode = mapping?.targetCollectionId
        ? (await this.getCollectionById(mapping.targetCollectionId)).code
        : null;
      await this.writeAuditLog({
        collectionCode: targetCollectionCode,
        recordId: null,
        action: 'connector.sync.run.completed',
        newValues: {
          runId: run.id,
          configurationId: config.id,
          connectionId: config.connectionId,
          processed: run.recordsProcessed,
          created: run.recordsCreated,
          updated: run.recordsUpdated,
          failed: run.recordsFailed,
        },
      });

      this.eventEmitter.emit('sync.completed', { runId: run.id, configId: config.id });

    } catch (error) {
      const err = error as Error;
      run.status = 'failed';
      run.completedAt = new Date();
      run.durationMs = Date.now() - run.startedAt.getTime();
      run.errorMessage = err.message;

      this.addLogEntry(run, 'error', `Sync failed: ${err.message}`);

      await this.syncRunRepo.save(run);

      const configToUpdate = await this.findSyncConfigById(run.configurationId);
      if (configToUpdate) {
        configToUpdate.lastRunAt = new Date();
        configToUpdate.runCount++;
        configToUpdate.failureCount++;
        const retryPlan = this.planRetry(configToUpdate, new Date());
        configToUpdate.metadata = retryPlan.metadata;
        configToUpdate.nextRunAt = retryPlan.nextRunAt;
        await this.syncConfigRepo.save(configToUpdate);

        const targetCollectionCode = configToUpdate.mapping?.targetCollectionId
          ? (await this.getCollectionById(configToUpdate.mapping.targetCollectionId)).code
          : null;
        await this.writeAuditLog({
          collectionCode: targetCollectionCode,
          recordId: null,
          action: 'connector.sync.run.failed',
          newValues: {
            runId: run.id,
            configurationId: configToUpdate.id,
            connectionId: configToUpdate.connectionId,
            processed: run.recordsProcessed,
            failed: run.recordsFailed,
            error: err.message,
          },
        });
      }

      this.eventEmitter.emit('sync.failed', { runId: run.id, error: err.message });
    }
  }

  private async performSync(
    run: SyncRun,
    config: SyncConfiguration,
    connection: ConnectorConnection,
    mapping: PropertyMapping | null,
  ): Promise<void> {
    this.addLogEntry(run, 'info', `Sync mode: ${config.syncMode}, Direction: ${config.direction}`);

    if (!mapping) {
      throw new Error('Sync mapping is required to normalize external records');
    }
    if (!mapping.targetCollectionId) {
      throw new Error('Sync mapping must define a target collection');
    }

    const credentials = connection.credentialRef
      ? await this.credentialsService.resolveCredentials(connection.credentialRef)
      : {};

    const sourceRecords = await this.fetchSourceRecords(config, connection, credentials);
    if (sourceRecords.length === 0) {
      this.addLogEntry(run, 'info', 'No source records returned for sync');
      return;
    }

    const collection = await this.getCollectionById(mapping.targetCollectionId);
    const properties = await this.getPropertiesForCollection(collection.id);
    const identityProperty = this.resolveIdentityProperty(mapping);

    for (const sourceRecord of sourceRecords) {
      try {
        const mappedValues = this.applyPropertyMapping(mapping, sourceRecord);
        this.ensureMappedProperties(collection, properties, mapping, mappedValues);

        const upsertResult = await this.upsertRecord({
          collection,
          properties,
          values: mappedValues,
          identityProperty,
          conflictResolution: config.conflictResolution,
        });

        run.recordsProcessed += 1;
        if (upsertResult.action === 'created') {
          run.recordsCreated += 1;
        } else if (upsertResult.action === 'updated') {
          run.recordsUpdated += 1;
        } else {
          run.recordsSkipped += 1;
        }
      } catch (error) {
        run.recordsProcessed += 1;
        run.recordsFailed += 1;
        this.addLogEntry(run, 'warn', `Record normalization failed: ${(error as Error).message}`);
      }
    }

    connection.lastSyncAt = new Date();
    await this.connectionRepo.save(connection);
  }

  private async fetchSourceRecords(
    config: SyncConfiguration,
    connection: ConnectorConnection,
    credentials: Record<string, unknown>,
  ): Promise<Record<string, unknown>[]> {
    const source = this.resolveSourceConfig(config, connection);
    const url = source.url as string;
    if (!url) {
      throw new Error('Sync source config must include a url');
    }

    const method = (source.method as string | undefined)?.toUpperCase() || 'GET';
    const headers: Record<string, string> = {
      ...(source.headers as Record<string, string> | undefined),
    };

    const credentialHeaders = credentials.headers as Record<string, string> | undefined;
    if (credentialHeaders) {
      Object.assign(headers, credentialHeaders);
    }

    if (!headers['Authorization']) {
      const token = (credentials.token || credentials.bearer_token) as string | undefined;
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }
    }

    const apiKey = credentials.api_key as string | undefined;
    const apiKeyHeader =
      (credentials.api_key_header as string | undefined) ||
      (source.apiKeyHeader as string | undefined);
    if (apiKey && apiKeyHeader && !headers[apiKeyHeader]) {
      headers[apiKeyHeader] = apiKey;
    }

    const body = source.body as Record<string, unknown> | undefined;
    if (body && method !== 'GET' && method !== 'HEAD') {
      if (!headers['Content-Type']) {
        headers['Content-Type'] = 'application/json';
      }
    }

    const response = await fetch(url, {
      method,
      headers,
      body: body && method !== 'GET' && method !== 'HEAD' ? JSON.stringify(body) : undefined,
    });

    if (!response.ok) {
      throw new Error(`Sync source request failed: ${response.status}`);
    }

    const payload = (await response.json()) as Record<string, unknown> | unknown[];
    const dataPath = (source.data_path || source.dataPath) as string | undefined;
    const items = Array.isArray(payload)
      ? payload
      : dataPath
        ? this.getNestedArray(payload as Record<string, unknown>, dataPath)
        : [payload];

    return items
      .filter((item): item is Record<string, unknown> => Boolean(item && typeof item === 'object'))
      .map((item) => item);
  }

  private resolveSourceConfig(
    config: SyncConfiguration,
    connection: ConnectorConnection,
  ): Record<string, unknown> {
    const metadataSource = (config.metadata || {})['source'];
    if (metadataSource && typeof metadataSource === 'object') {
      return metadataSource as Record<string, unknown>;
    }
    const connectionSource = (connection.config || {})['source'];
    if (connectionSource && typeof connectionSource === 'object') {
      return connectionSource as Record<string, unknown>;
    }
    throw new Error('Sync source configuration is missing');
  }

  private getNestedArray(obj: Record<string, unknown>, path: string): unknown[] {
    const segments = path.split('.');
    let current: unknown = obj;
    for (const segment of segments) {
      if (current && typeof current === 'object') {
        current = (current as Record<string, unknown>)[segment];
      } else {
        return [];
      }
    }
    return Array.isArray(current) ? current : [];
  }

  private applyPropertyMapping(
    mapping: PropertyMapping,
    record: Record<string, unknown>,
  ): Record<string, unknown> {
    const result: Record<string, unknown> = {};

    for (const entry of mapping.mappings || []) {
      let value = record[entry.sourceProperty];
      if (value === undefined && entry.defaultValue !== undefined) {
        value = entry.defaultValue;
      }
      if (value === undefined || value === null) {
        if (entry.required) {
          throw new Error(`Missing required source value for ${entry.sourceProperty}`);
        }
        continue;
      }
      if (entry.transformation) {
        value = this.applyTransformation(value, entry.transformation);
      }
      if (entry.targetProperty === 'id') {
        continue;
      }
      result[entry.targetProperty] = value;
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
      case 'date': {
        const parsed = new Date(value as string);
        return Number.isNaN(parsed.getTime()) ? value : parsed;
      }
      default:
        return value;
    }
  }

  private resolveIdentityProperty(mapping: PropertyMapping): string | null {
    const metadata = mapping.metadata || {};
    const candidate =
      (metadata['identity_property'] as string | undefined) ||
      (metadata['identityProperty'] as string | undefined);
    return candidate || null;
  }

  private ensureMappedProperties(
    collection: CollectionDefinition,
    properties: PropertyDefinition[],
    mapping: PropertyMapping,
    values: Record<string, unknown>,
  ): void {
    const propertyMap = new Map(properties.map((prop) => [prop.code, prop]));
    for (const entry of mapping.mappings || []) {
      if (!propertyMap.has(entry.targetProperty)) {
        throw new Error(`Mapping target property '${entry.targetProperty}' not found on ${collection.code}`);
      }
    }
    for (const property of properties) {
      if (property.isRequired && values[property.code] === undefined) {
        const hasMapping = (mapping.mappings || []).some((entry) => entry.targetProperty === property.code);
        if (hasMapping) {
          throw new Error(`Required property '${property.code}' is missing`);
        }
      }
    }
  }

  private async upsertRecord(params: {
    collection: CollectionDefinition;
    properties: PropertyDefinition[];
    values: Record<string, unknown>;
    identityProperty: string | null;
    conflictResolution: ConflictResolution;
  }): Promise<{ action: 'created' | 'updated' | 'skipped' }> {
    const { collection, properties, values, identityProperty, conflictResolution } = params;
    const context = this.buildSystemContext();

    if (identityProperty && values[identityProperty] !== undefined) {
      const existingId = await this.findRecordIdByProperty(
        collection,
        properties,
        identityProperty,
        values[identityProperty],
      );
      if (existingId) {
        const updateAllowed = await this.shouldUpdateRecord(
          values,
          conflictResolution,
          collection,
          properties,
          existingId,
        );
        if (!updateAllowed) {
          return { action: 'skipped' };
        }
        await this.authz.ensureTableAccess(context, collection.tableName, 'update');
        await this.updateRecord(collection, properties, existingId, values);
        return { action: 'updated' };
      }
    }

    await this.authz.ensureTableAccess(context, collection.tableName, 'create');
    await this.createRecord(collection, properties, values);
    return { action: 'created' };
  }

  private async shouldUpdateRecord(
    sourceValues: Record<string, unknown>,
    conflictResolution: ConflictResolution,
    collection: CollectionDefinition,
    properties: PropertyDefinition[],
    recordId: string,
  ): Promise<boolean> {
    if (conflictResolution === 'target_wins' || conflictResolution === 'manual') {
      return false;
    }
    if (conflictResolution === 'newest_wins') {
      const sourceTimestamp = this.resolveSourceTimestamp(sourceValues);
      if (!sourceTimestamp) {
        return true;
      }
      const existing = await this.loadRecord(collection, properties, recordId);
      if (!existing) {
        return true;
      }
      const existingTimestamp = existing.updated_at as Date | undefined;
      if (!existingTimestamp) {
        return true;
      }
      return sourceTimestamp.getTime() >= new Date(existingTimestamp).getTime();
    }
    return true;
  }

  private resolveSourceTimestamp(values: Record<string, unknown>): Date | null {
    const candidate = values['updated_at'] ?? values['updatedAt'] ?? values['last_modified'] ?? values['lastModified'];
    if (candidate instanceof Date) {
      return candidate;
    }
    if (typeof candidate === 'string' || typeof candidate === 'number') {
      const parsed = new Date(candidate);
      return Number.isNaN(parsed.getTime()) ? null : parsed;
    }
    return null;
  }

  private async createRecord(
    collection: CollectionDefinition,
    properties: PropertyDefinition[],
    values: Record<string, unknown>,
  ): Promise<void> {
    const insertData: Record<string, unknown> = {};
    for (const [code, value] of Object.entries(values)) {
      const property = properties.find((prop) => prop.code === code);
      if (!property) {
        continue;
      }
      insertData[this.getStorageColumn(property)] = value;
    }

    const tableName = `${this.ensureSafeIdentifier('public', 'schema')}.${this.ensureSafeIdentifier(
      collection.tableName,
      'table',
    )}`;

    const result = await this.dataSource
      .createQueryBuilder()
      .insert()
      .into(tableName)
      .values(insertData)
      .returning('id')
      .execute();

    const recordId = result.identifiers[0]?.id as string | undefined;
    if (!recordId) {
      throw new Error('Failed to create normalized record');
    }

    const record = await this.loadRecord(collection, properties, recordId);
    if (!record) {
      throw new Error('Normalized record could not be loaded');
    }

    await this.writeAuditLog({
      collectionCode: collection.code,
      recordId,
      action: 'connector.sync.create',
      newValues: record,
    });

    await this.outboxService.enqueueRecordEvent({
      eventType: 'record.created',
      collectionCode: collection.code,
      recordId,
      record,
      previousRecord: null,
      changedProperties: Object.keys(record || {}),
      userId: this.systemUserId,
      metadata: {
        source: 'connector',
        collectionId: collection.id,
      },
    });
  }

  private async updateRecord(
    collection: CollectionDefinition,
    properties: PropertyDefinition[],
    recordId: string,
    values: Record<string, unknown>,
  ): Promise<void> {
    const updateData: Record<string, unknown> = {};
    for (const [code, value] of Object.entries(values)) {
      const property = properties.find((prop) => prop.code === code);
      if (!property) {
        continue;
      }
      updateData[this.getStorageColumn(property)] = value;
    }

    if (Object.keys(updateData).length === 0) {
      return;
    }

    const tableName = `${this.ensureSafeIdentifier('public', 'schema')}.${this.ensureSafeIdentifier(
      collection.tableName,
      'table',
    )}`;

    const previous = await this.loadRecord(collection, properties, recordId);

    await this.dataSource
      .createQueryBuilder()
      .update(tableName)
      .set(updateData)
      .where('id = :id', { id: recordId })
      .execute();

    const updated = await this.loadRecord(collection, properties, recordId);
    if (!updated) {
      throw new Error('Updated record could not be loaded');
    }

    await this.writeAuditLog({
      collectionCode: collection.code,
      recordId,
      action: 'connector.sync.update',
      oldValues: previous,
      newValues: updated,
    });

    await this.outboxService.enqueueRecordEvent({
      eventType: 'record.updated',
      collectionCode: collection.code,
      recordId,
      record: updated,
      previousRecord: previous ?? null,
      changedProperties: this.calculateChangedProperties(previous, updated),
      userId: this.systemUserId,
      metadata: {
        source: 'connector',
        collectionId: collection.id,
      },
    });
  }

  private async findRecordIdByProperty(
    collection: CollectionDefinition,
    properties: PropertyDefinition[],
    propertyCode: string,
    value: unknown,
  ): Promise<string | null> {
    const property = properties.find((prop) => prop.code === propertyCode);
    if (!property) {
      throw new Error(`Identity property '${propertyCode}' not found on ${collection.code}`);
    }

    const schema = this.ensureSafeIdentifier('public', 'schema');
    const table = this.ensureSafeIdentifier(collection.tableName, 'table');
    const column = this.ensureSafeIdentifier(this.getStorageColumn(property), 'column');

    const rows = (await this.dataSource.query(
      `SELECT id FROM "${schema}"."${table}" WHERE "${column}" = $1 LIMIT 1`,
      [value],
    )) as Array<{ id: string }>;

    return rows[0]?.id || null;
  }

  private async getCollectionById(collectionId: string): Promise<CollectionDefinition> {
    const collection = await this.collectionRepo.findOne({
      where: { id: collectionId, isActive: true },
    });
    if (!collection) {
      throw new Error(`Collection '${collectionId}' not found`);
    }
    return collection;
  }

  private async getPropertiesForCollection(collectionId: string): Promise<PropertyDefinition[]> {
    return this.propertyRepo.find({
      where: { collectionId, isActive: true },
      order: { position: 'ASC' },
    });
  }

  private async loadRecord(
    collection: CollectionDefinition,
    properties: PropertyDefinition[],
    recordId: string,
  ): Promise<Record<string, unknown> | null> {
    const schema = this.ensureSafeIdentifier('public', 'schema');
    const table = this.ensureSafeIdentifier(collection.tableName, 'table');
    const rows = (await this.dataSource.query(
      `SELECT * FROM "${schema}"."${table}" WHERE id = $1`,
      [recordId],
    )) as Record<string, unknown>[];
    if (!rows.length) {
      return null;
    }
    return this.mapRowToRecord(rows[0], properties);
  }

  private mapRowToRecord(
    row: Record<string, unknown>,
    properties: PropertyDefinition[],
  ): Record<string, unknown> {
    const record: Record<string, unknown> = {
      id: row.id,
      created_at: row.created_at,
      updated_at: row.updated_at,
    };

    for (const property of properties) {
      const column = this.getStorageColumn(property);
      if (column in row) {
        record[property.code] = row[column];
      }
    }

    return record;
  }

  private calculateChangedProperties(
    previousRecord: Record<string, unknown> | null | undefined,
    currentRecord: Record<string, unknown>,
  ): string[] {
    const changes: string[] = [];
    const keys = new Set([
      ...Object.keys(previousRecord || {}),
      ...Object.keys(currentRecord || {}),
    ]);
    for (const key of keys) {
      if (JSON.stringify(previousRecord?.[key]) !== JSON.stringify(currentRecord?.[key])) {
        changes.push(key);
      }
    }
    return changes;
  }

  private async writeAuditLog(params: {
    collectionCode?: string | null;
    recordId?: string | null;
    action: string;
    oldValues?: Record<string, unknown> | null;
    newValues?: Record<string, unknown> | null;
    permissionCode?: string | null;
  }): Promise<void> {
    const entry = this.auditRepo.create({
      userId: this.systemUserId,
      collectionCode: params.collectionCode ?? null,
      recordId: params.recordId ?? null,
      action: params.action,
      oldValues: params.oldValues ?? null,
      newValues: params.newValues ?? null,
      permissionCode: params.permissionCode ?? null,
    });
    await this.auditRepo.save(entry);
  }

  private getStorageColumn(prop: PropertyDefinition): string {
    return prop.columnName || prop.code;
  }

  private ensureSafeIdentifier(value: string, label: string): string {
    if (!value || !/^[A-Za-z_][A-Za-z0-9_]*$/.test(value)) {
      throw new Error(`Invalid ${label} name: ${value}`);
    }
    return value;
  }

  private buildSystemContext(): RequestContext {
    return {
      userId: this.systemUserId,
      roles: [],
      permissions: [],
      isAdmin: true,
    };
  }

  private addLogEntry(run: SyncRun, level: 'info' | 'warn' | 'error', message: string): void {
    run.log.push({
      timestamp: new Date().toISOString(),
      level,
      message,
    });
  }

  async findSyncRunById(id: string): Promise<SyncRun | null> {
    return this.syncRunRepo.findOne({
      where: { id },
      relations: ['configuration'],
    });
  }

  async findSyncRuns(configId: string, params: {
    status?: SyncRunStatus;
    limit?: number;
    offset?: number;
  } = {}): Promise<{ items: SyncRun[]; total: number }> {
    const where: Record<string, unknown> = { configurationId: configId };
    if (params.status) where.status = params.status;

    const [items, total] = await this.syncRunRepo.findAndCount({
      where,
      take: params.limit || 50,
      skip: params.offset || 0,
      order: { startedAt: 'DESC' },
    });

    return { items, total };
  }

  async cancelSyncRun(id: string): Promise<SyncRun> {
    const run = await this.findSyncRunById(id);
    if (!run) throw new Error('Sync run not found');

    run.status = 'cancelled';
    run.completedAt = new Date();
    run.durationMs = Date.now() - run.startedAt.getTime();

    this.addLogEntry(run, 'warn', 'Sync run cancelled by user');

    return this.syncRunRepo.save(run);
  }

  // Scheduled Sync Processing

  async processScheduledSyncs(): Promise<number> {
    const now = new Date();

    const dueConfigs = await this.syncConfigRepo.find({
      where: {
        isActive: true,
        nextRunAt: LessThan(now),
      },
    });

    let started = 0;
    for (const config of dueConfigs) {
      const runningCount = await this.syncRunRepo.count({
        where: { configurationId: config.id, status: 'running' as SyncRunStatus },
      });
      if (runningCount > 0) {
        config.nextRunAt = new Date(Date.now() + 60000);
        await this.syncConfigRepo.save(config);
        continue;
      }
      await this.runSync(config.id);
      started += 1;
    }

    return started;
  }

  private calculateNextRun(schedule: string): Date {
    const seconds = this.parseDurationSeconds(schedule);
    return new Date(Date.now() + seconds * 1000);
  }

  private parseDurationSeconds(value: string): number {
    const trimmed = value.trim();
    const match = /^P(?:(\d+)D)?(?:T(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?)?$/.exec(trimmed);
    if (!match) {
      throw new Error('Schedule must be an ISO-8601 duration like PT15M or P1D');
    }
    const days = match[1] ? Number(match[1]) : 0;
    const hours = match[2] ? Number(match[2]) : 0;
    const minutes = match[3] ? Number(match[3]) : 0;
    const seconds = match[4] ? Number(match[4]) : 0;
    const totalSeconds = days * 86400 + hours * 3600 + minutes * 60 + seconds;
    if (!Number.isFinite(totalSeconds) || totalSeconds <= 0) {
      throw new Error('Schedule duration must be greater than zero');
    }
    return totalSeconds;
  }

  private resolveRetryPolicy(metadata?: Record<string, unknown>): RetryPolicy {
    const raw = (metadata?.['retry'] as Record<string, unknown> | undefined) || {};
    const enabled = this.readBoolean(raw, 'enabled', true);
    const maxAttempts = this.readNumber(raw, 'max_attempts', 5);
    const backoffSeconds = this.readNumber(raw, 'backoff_seconds', 300);
    const backoffMultiplier = this.readNumber(raw, 'backoff_multiplier', 2);
    const maxBackoffSeconds = this.readNumber(raw, 'max_backoff_seconds', 3600);
    return {
      enabled,
      maxAttempts: Math.max(1, maxAttempts),
      backoffSeconds: Math.max(30, backoffSeconds),
      backoffMultiplier: Math.max(1, backoffMultiplier),
      maxBackoffSeconds: Math.max(300, maxBackoffSeconds),
    };
  }

  private resolveRetryState(metadata?: Record<string, unknown>): RetryState {
    const raw = (metadata?.['retry_state'] as Record<string, unknown> | undefined) || {};
    const consecutiveFailures = this.readNumber(raw, 'consecutive_failures', 0);
    const lastFailureAt = this.readString(raw, 'last_failure_at');
    const nextRetryAt = this.readString(raw, 'next_retry_at');
    return {
      consecutiveFailures,
      lastFailureAt: lastFailureAt || null,
      nextRetryAt: nextRetryAt || null,
    };
  }

  private resetRetryState(metadata?: Record<string, unknown>): Record<string, unknown> {
    const updated = { ...(metadata || {}) };
    updated['retry_state'] = {
      consecutive_failures: 0,
      last_failure_at: null,
      next_retry_at: null,
    };
    return updated;
  }

  private planRetry(
    config: SyncConfiguration,
    now: Date,
  ): { nextRunAt?: Date; metadata: Record<string, unknown> } {
    const metadata = { ...(config.metadata || {}) };
    const policy = this.resolveRetryPolicy(metadata);
    if (!policy.enabled) {
      return {
        nextRunAt: config.schedule ? this.calculateNextRun(config.schedule) : undefined,
        metadata,
      };
    }

    const state = this.resolveRetryState(metadata);
    const attempt = state.consecutiveFailures + 1;
    const next = { ...state, lastFailureAt: now.toISOString() };

    if (attempt <= policy.maxAttempts) {
      const delay = Math.min(
        policy.backoffSeconds * Math.pow(policy.backoffMultiplier, attempt - 1),
        policy.maxBackoffSeconds,
      );
      const nextRunAt = new Date(now.getTime() + delay * 1000);
      next.consecutiveFailures = attempt;
      next.nextRetryAt = nextRunAt.toISOString();
      metadata['retry_state'] = {
        consecutive_failures: next.consecutiveFailures,
        last_failure_at: next.lastFailureAt,
        next_retry_at: next.nextRetryAt,
      };
      return { nextRunAt, metadata };
    }

    metadata['retry_state'] = {
      consecutive_failures: 0,
      last_failure_at: next.lastFailureAt,
      next_retry_at: null,
    };
    return {
      nextRunAt: config.schedule ? this.calculateNextRun(config.schedule) : undefined,
      metadata,
    };
  }

  private readNumber(source: Record<string, unknown>, key: string, fallback: number): number {
    const value = source[key];
    if (typeof value === 'number' && Number.isFinite(value)) {
      return value;
    }
    if (typeof value === 'string') {
      const parsed = Number(value);
      if (Number.isFinite(parsed)) {
        return parsed;
      }
    }
    return fallback;
  }

  private readBoolean(source: Record<string, unknown>, key: string, fallback: boolean): boolean {
    const value = source[key];
    if (typeof value === 'boolean') {
      return value;
    }
    if (typeof value === 'string') {
      const normalized = value.trim().toLowerCase();
      if (normalized === 'true') {
        return true;
      }
      if (normalized === 'false') {
        return false;
      }
    }
    if (typeof value === 'number') {
      return value !== 0;
    }
    return fallback;
  }

  private readString(source: Record<string, unknown>, key: string): string | undefined {
    const value = source[key];
    return typeof value === 'string' ? value : undefined;
  }
}
