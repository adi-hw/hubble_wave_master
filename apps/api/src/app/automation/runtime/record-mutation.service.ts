import { Injectable } from '@nestjs/common';
import { DataSource, EntityManager } from 'typeorm';
import { AuthorizationService } from '@hubblewave/authorization';
import { UserRequestContext } from '@hubblewave/auth-guard';
import {
  CollectionDefinition,
  PropertyDefinition,
  withAudit,
  AuditRecorder,
} from '@hubblewave/instance-db';
import { OutboxPublisherService } from './outbox-publisher.service';

type CollectionWithProperties = {
  collection: CollectionDefinition;
  properties: PropertyDefinition[];
};

@Injectable()
export class RecordMutationService {
  private readonly systemUserId = '00000000-0000-0000-0000-000000000000';

  constructor(
    private readonly dataSource: DataSource,
    private readonly authz: AuthorizationService,
    private readonly outboxPublisher: OutboxPublisherService,
  ) {}

  async getRecordById(
    collectionCode: string,
    recordId: string,
    mgr?: EntityManager,
  ): Promise<Record<string, unknown> | null> {
    const { collection, properties } = await this.getCollectionWithProperties(
      collectionCode,
      mgr,
    );
    if (!collection) return null;

    const schema = this.ensureSafeIdentifier('public', 'schema');
    const safeTable = this.ensureSafeIdentifier(collection.tableName, 'table');
    const sql = `SELECT * FROM "${schema}"."${safeTable}" WHERE id = $1`;
    const runner = mgr ?? this.dataSource;
    const records = (await runner.query(sql, [recordId])) as Record<string, unknown>[];
    if (!records.length) return null;
    return this.mapRowToRecord(records[0], properties);
  }

  async createRecord(params: {
    collectionCode: string;
    values: Record<string, unknown>;
    actorId?: string | null;
    // Cross-invocation cycle/depth state forwarded onto the outbox event the
    // mutation emits, so the next runtime invocation can detect cycles and
    // enforce MAX_DEPTH across automation chains.
    executionChain?: string[];
    executionDepth?: number;
  }): Promise<Record<string, unknown>> {
    return withAudit(this.dataSource, (mgr, recordAudit) =>
      this.createRecordInTransaction(params, mgr, recordAudit),
    );
  }

  async createRecordInTransaction(
    params: {
      collectionCode: string;
      values: Record<string, unknown>;
      actorId?: string | null;
      executionChain?: string[];
      executionDepth?: number;
    },
    mgr: EntityManager,
    recordAudit: AuditRecorder,
  ): Promise<Record<string, unknown>> {
    const { collection, properties } = await this.getCollectionWithProperties(
      params.collectionCode,
      mgr,
    );
    const context = await this.buildRequestContext(params.actorId ?? null);
    await this.authz.ensureCollectionAccess(context, collection.id, 'create');

    const writable = await this.authz.filterWritableFieldsForCollection(
      context,
      collection.id,
      this.toPropertyMeta(properties),
    );
    const writableCodes = new Set(writable.map((p) => p.code));

    const insertData: Record<string, unknown> = {};
    for (const prop of properties) {
      if (!writableCodes.has(prop.code)) {
        continue;
      }
      if (params.values[prop.code] === undefined) {
        continue;
      }
      const column = this.getStorageColumn(prop);
      insertData[column] = params.values[prop.code];
    }

    const tableName = `${this.ensureSafeIdentifier('public', 'schema')}.${this.ensureSafeIdentifier(
      collection.tableName,
      'table',
    )}`;

    const result = await mgr
      .createQueryBuilder()
      .insert()
      .into(tableName)
      .values(insertData)
      .returning('id')
      .execute();

    const newId = result.identifiers[0]?.id;
    if (!newId) {
      throw new Error('Failed to create record');
    }

    const record = await this.getRecordById(collection.code, newId, mgr);
    if (!record) {
      throw new Error('Created record could not be loaded');
    }

    recordAudit({
      userId: params.actorId ?? null,
      action: 'create',
      collectionCode: collection.code,
      recordId: newId,
      newValues: record,
    });

    await this.outboxPublisher.publishRecordEvent(
      {
        eventType: 'record.created',
        collectionCode: collection.code,
        recordId: newId,
        record,
        previousRecord: null,
        changedProperties: Object.keys(record || {}),
        userId: params.actorId ?? null,
        executionChain: params.executionChain,
        executionDepth: params.executionDepth,
      },
      mgr,
    );

    return record;
  }

  async updateRecord(params: {
    collectionCode: string;
    recordId: string;
    changes: Record<string, unknown>;
    actorId?: string | null;
    // Cross-invocation cycle/depth state forwarded onto the outbox event the
    // mutation emits, so the next runtime invocation can detect cycles and
    // enforce MAX_DEPTH across automation chains.
    executionChain?: string[];
    executionDepth?: number;
  }): Promise<Record<string, unknown>> {
    return withAudit(this.dataSource, (mgr, recordAudit) =>
      this.updateRecordInTransaction(params, mgr, recordAudit),
    );
  }

  async updateRecordInTransaction(
    params: {
      collectionCode: string;
      recordId: string;
      changes: Record<string, unknown>;
      actorId?: string | null;
      executionChain?: string[];
      executionDepth?: number;
    },
    mgr: EntityManager,
    recordAudit: AuditRecorder,
  ): Promise<Record<string, unknown>> {
    const { collection, properties } = await this.getCollectionWithProperties(
      params.collectionCode,
      mgr,
    );
    const context = await this.buildRequestContext(params.actorId ?? null);
    await this.authz.ensureCollectionAccess(context, collection.id, 'update');

    const previousRecord = await this.getRecordById(collection.code, params.recordId, mgr);
    if (!previousRecord) {
      throw new Error(`Record '${params.recordId}' not found`);
    }

    const writable = await this.authz.filterWritableFieldsForCollection(
      context,
      collection.id,
      this.toPropertyMeta(properties),
    );
    const writableCodes = new Set(writable.map((p) => p.code));

    const updateData: Record<string, unknown> = {};
    for (const [code, value] of Object.entries(params.changes)) {
      if (!writableCodes.has(code)) {
        continue;
      }
      const prop = properties.find((p) => p.code === code);
      if (!prop) continue;
      const column = this.getStorageColumn(prop);
      updateData[column] = value;
    }

    if (Object.keys(updateData).length === 0) {
      return previousRecord;
    }

    const tableName = `${this.ensureSafeIdentifier('public', 'schema')}.${this.ensureSafeIdentifier(
      collection.tableName,
      'table',
    )}`;

    await mgr
      .createQueryBuilder()
      .update(tableName)
      .set(updateData)
      .where('id = :id', { id: params.recordId })
      .execute();

    const updatedRecord = await this.getRecordById(collection.code, params.recordId, mgr);
    if (!updatedRecord) {
      throw new Error('Updated record could not be loaded');
    }

    recordAudit({
      userId: params.actorId ?? null,
      action: 'update',
      collectionCode: collection.code,
      recordId: params.recordId,
      oldValues: previousRecord,
      newValues: updatedRecord,
    });

    await this.outboxPublisher.publishRecordEvent(
      {
        eventType: 'record.updated',
        collectionCode: collection.code,
        recordId: params.recordId,
        record: updatedRecord,
        previousRecord,
        changedProperties: this.calculateChangedProperties(previousRecord, updatedRecord),
        userId: params.actorId ?? null,
        executionChain: params.executionChain,
        executionDepth: params.executionDepth,
      },
      mgr,
    );

    return updatedRecord;
  }

  async deleteRecord(params: {
    collectionCode: string;
    recordId: string;
    actorId?: string | null;
    executionChain?: string[];
    executionDepth?: number;
  }): Promise<Record<string, unknown>> {
    return withAudit(this.dataSource, (mgr, recordAudit) =>
      this.deleteRecordInTransaction(params, mgr, recordAudit),
    );
  }

  async deleteRecordInTransaction(
    params: {
      collectionCode: string;
      recordId: string;
      actorId?: string | null;
      executionChain?: string[];
      executionDepth?: number;
    },
    mgr: EntityManager,
    recordAudit: AuditRecorder,
  ): Promise<Record<string, unknown>> {
    const { collection } = await this.getCollectionWithProperties(
      params.collectionCode,
      mgr,
    );
    const context = await this.buildRequestContext(params.actorId ?? null);
    await this.authz.ensureCollectionAccess(context, collection.id, 'delete');

    const record = await this.getRecordById(collection.code, params.recordId, mgr);
    if (!record) {
      throw new Error(`Record '${params.recordId}' not found`);
    }

    const tableName = `${this.ensureSafeIdentifier('public', 'schema')}.${this.ensureSafeIdentifier(
      collection.tableName,
      'table',
    )}`;

    await mgr
      .createQueryBuilder()
      .delete()
      .from(tableName)
      .where('id = :id', { id: params.recordId })
      .execute();

    recordAudit({
      userId: params.actorId ?? null,
      action: 'delete',
      collectionCode: collection.code,
      recordId: params.recordId,
      oldValues: record,
    });

    await this.outboxPublisher.publishRecordEvent(
      {
        eventType: 'record.deleted',
        collectionCode: collection.code,
        recordId: params.recordId,
        record,
        previousRecord: record,
        changedProperties: Object.keys(record || {}),
        userId: params.actorId ?? null,
        executionChain: params.executionChain,
        executionDepth: params.executionDepth,
      },
      mgr,
    );

    return record;
  }

  private async getCollectionWithProperties(
    collectionCode: string,
    mgr?: EntityManager,
  ): Promise<CollectionWithProperties> {
    const runner = mgr ?? this.dataSource;
    const collectionRepo = runner.getRepository(CollectionDefinition);
    const propertyRepo = runner.getRepository(PropertyDefinition);

    const collection = await collectionRepo.findOne({
      where: { code: collectionCode, isActive: true },
    });

    if (!collection) {
      throw new Error(`Collection '${collectionCode}' not found`);
    }

    const properties = await propertyRepo.find({
      where: { collectionId: collection.id, isActive: true },
      order: { position: 'ASC' },
    });

    return { collection, properties };
  }

  private toPropertyMeta(properties: PropertyDefinition[]): Array<{
    code: string;
    label: string;
    isSystem: boolean;
    storagePath: string;
  }> {
    return properties.map((p) => ({
      code: p.code,
      label: p.name,
      isSystem: p.isSystem,
      storagePath: `column:${this.getStorageColumn(p)}`,
    }));
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
    previousRecord: Record<string, unknown>,
    currentRecord: Record<string, unknown>,
  ): string[] {
    const changes: string[] = [];
    const keys = new Set([...Object.keys(previousRecord || {}), ...Object.keys(currentRecord || {})]);
    for (const key of keys) {
      if (JSON.stringify(previousRecord?.[key]) !== JSON.stringify(currentRecord?.[key])) {
        changes.push(key);
      }
    }
    return changes;
  }

  private async buildRequestContext(userId: string | null): Promise<UserRequestContext> {
    if (!userId) {
      return {
        kind: 'user',
        userId: this.systemUserId,
        roleIds: [],
        roleCodes: [],
        permissionCodes: [],
        groupIds: [],
        isAdmin: true,
        securityStamp: '',
      };
    }

    return {
      kind: 'user',
      userId,
      roleIds: [],
      roleCodes: [],
      permissionCodes: [],
      groupIds: [],
      isAdmin: false,
      securityStamp: '',
    };
  }
}
