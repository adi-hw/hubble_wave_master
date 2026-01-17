import { Injectable } from '@nestjs/common';
import { DataSource, Repository } from 'typeorm';
import { AuthorizationService } from '@hubblewave/authorization';
import { RequestContext } from '@hubblewave/auth-guard';
import {
  CollectionDefinition,
  PropertyDefinition,
  AuditLog,
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
  ): Promise<Record<string, unknown> | null> {
    const { collection, properties } = await this.getCollectionWithProperties(collectionCode);

    const schema = this.ensureSafeIdentifier('public', 'schema');
    const safeTable = this.ensureSafeIdentifier(collection.tableName, 'table');
    const sql = `SELECT * FROM "${schema}"."${safeTable}" WHERE id = $1`;
    const records = (await this.dataSource.query(sql, [recordId])) as Record<string, unknown>[];
    if (!records.length) return null;
    return this.mapRowToRecord(records[0], properties);
  }

  async createRecord(params: {
    collectionCode: string;
    values: Record<string, unknown>;
    actorId?: string | null;
  }): Promise<Record<string, unknown>> {
    const { collection, properties } = await this.getCollectionWithProperties(params.collectionCode);
    const context = await this.buildRequestContext(params.actorId ?? null);
    await this.authz.ensureTableAccess(context, collection.tableName, 'create');

    const writable = await this.authz.filterWritableFields(
      context,
      collection.tableName,
      this.toPropertyMeta(properties),
    );
    const writableCodes = new Set(writable.map((p) => p.code));

    const insertData: Record<string, unknown> = {};
    for (const prop of properties) {
      if (!writableCodes.has(prop.code)) continue;
      if (params.values[prop.code] === undefined) continue;
      const column = this.getStorageColumn(prop);
      insertData[column] = params.values[prop.code];
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

    const newId = result.identifiers[0]?.id;
    if (!newId) {
      throw new Error('Failed to create record');
    }

    const record = await this.getRecordById(collection.code, newId);
    if (!record) {
      throw new Error('Created record could not be loaded');
    }

    await this.writeAuditLog({
      userId: params.actorId ?? null,
      action: 'create',
      collectionCode: collection.code,
      recordId: newId,
      newValues: record,
    });

    await this.outboxPublisher.publish({
      eventType: 'record.created',
      collectionCode: collection.code,
      recordId: newId,
      payload: {
        collectionCode: collection.code,
        recordId: newId,
        record,
        previousRecord: null,
        changedProperties: Object.keys(record || {}),
        userId: params.actorId ?? null,
      },
    });

    return record;
  }

  async updateRecord(params: {
    collectionCode: string;
    recordId: string;
    changes: Record<string, unknown>;
    actorId?: string | null;
  }): Promise<Record<string, unknown>> {
    const { collection, properties } = await this.getCollectionWithProperties(params.collectionCode);
    const context = await this.buildRequestContext(params.actorId ?? null);
    await this.authz.ensureTableAccess(context, collection.tableName, 'update');

    const previousRecord = await this.getRecordById(collection.code, params.recordId);
    if (!previousRecord) {
      throw new Error(`Record '${params.recordId}' not found`);
    }

    const writable = await this.authz.filterWritableFields(
      context,
      collection.tableName,
      this.toPropertyMeta(properties),
    );
    const writableCodes = new Set(writable.map((p) => p.code));

    const updateData: Record<string, unknown> = {};
    for (const [code, value] of Object.entries(params.changes)) {
      if (!writableCodes.has(code)) continue;
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

    await this.dataSource
      .createQueryBuilder()
      .update(tableName)
      .set(updateData)
      .where('id = :id', { id: params.recordId })
      .execute();

    const updatedRecord = await this.getRecordById(collection.code, params.recordId);
    if (!updatedRecord) {
      throw new Error('Updated record could not be loaded');
    }

    await this.writeAuditLog({
      userId: params.actorId ?? null,
      action: 'update',
      collectionCode: collection.code,
      recordId: params.recordId,
      oldValues: previousRecord,
      newValues: updatedRecord,
    });

    await this.outboxPublisher.publish({
      eventType: 'record.updated',
      collectionCode: collection.code,
      recordId: params.recordId,
      payload: {
        collectionCode: collection.code,
        recordId: params.recordId,
        record: updatedRecord,
        previousRecord,
        changedProperties: this.calculateChangedProperties(previousRecord, updatedRecord),
        userId: params.actorId ?? null,
      },
    });

    return updatedRecord;
  }

  private async getCollectionWithProperties(
    collectionCode: string,
  ): Promise<CollectionWithProperties> {
    const collectionRepo = this.dataSource.getRepository(CollectionDefinition);
    const propertyRepo = this.dataSource.getRepository(PropertyDefinition);

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

  private async writeAuditLog(params: {
    userId: string | null;
    action: string;
    collectionCode: string;
    recordId?: string | null;
    oldValues?: Record<string, unknown> | null;
    newValues?: Record<string, unknown> | null;
    permissionCode?: string | null;
  }): Promise<void> {
    const repo: Repository<AuditLog> = this.dataSource.getRepository(AuditLog);
    const entry = repo.create({
      userId: params.userId ?? null,
      collectionCode: params.collectionCode,
      recordId: params.recordId ?? null,
      action: params.action,
      oldValues: params.oldValues ?? null,
      newValues: params.newValues ?? null,
      permissionCode: params.permissionCode ?? null,
    });
    await repo.save(entry);
  }

  private async buildRequestContext(userId: string | null): Promise<RequestContext> {
    if (!userId) {
      return {
        userId: this.systemUserId,
        roles: [],
        permissions: [],
        isAdmin: true,
      };
    }

    return {
      userId,
      roles: [],
      permissions: [],
      isAdmin: false,
    };
  }
}
