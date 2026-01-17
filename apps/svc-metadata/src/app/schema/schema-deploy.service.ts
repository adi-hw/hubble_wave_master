import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import {
  CollectionDefinition,
  PropertyDefinition,
  SchemaChangeLog,
} from '@hubblewave/instance-db';
import { CollectionStorageService } from '../collection/collection-storage.service';
import { SchemaDiffService, SchemaOperation, SchemaPlan } from './schema-diff.service';

const IDENTIFIER_PATTERN = /^[a-zA-Z_][a-zA-Z0-9_]*$/;

@Injectable()
export class SchemaDeployService {
  constructor(
    private readonly diffService: SchemaDiffService,
    private readonly collectionStorage: CollectionStorageService,
    private readonly dataSource: DataSource,
    @InjectRepository(CollectionDefinition)
    private readonly collectionRepo: Repository<CollectionDefinition>,
    @InjectRepository(PropertyDefinition)
    private readonly propertyRepo: Repository<PropertyDefinition>,
  ) {}

  async applyPlan(
    options?: { collectionCodes?: string[]; schema?: string },
    actorId?: string,
  ): Promise<{ plan: SchemaPlan; applied: SchemaOperation[] }> {
    const plan = await this.diffService.buildPlan(options);
    if (plan.operations.length === 0) {
      return { plan, applied: [] };
    }

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    const applied: SchemaOperation[] = [];

    try {
      for (const operation of plan.operations) {
        this.assertSafeIdentifiers(operation);

        if (operation.type === 'create_table') {
          await this.collectionStorage.createStorageTable(
            queryRunner,
            operation.schema,
            operation.table,
          );
          await this.logChange(queryRunner, operation, actorId);
          applied.push(operation);
          continue;
        }

        if (operation.type === 'add_column') {
          await this.collectionStorage.addColumn(
            queryRunner,
            operation.schema,
            operation.table,
            {
              name: operation.column.name,
              type: operation.column.type,
              nullable: operation.column.nullable,
              defaultValue: operation.column.defaultValue,
            },
          );
          await this.logChange(queryRunner, operation, actorId);
          applied.push(operation);
          continue;
        }

        if (operation.type === 'add_index') {
          const ddl = this.buildCreateIndexDdl(operation);
          await queryRunner.query(ddl);
          await this.logChange(queryRunner, operation, actorId, ddl);
          applied.push(operation);
          continue;
        }
      }

      await queryRunner.commitTransaction();
      return { plan, applied };
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  private assertSafeIdentifiers(operation: SchemaOperation): void {
    const identifiers = [];
    if (operation.type === 'create_table') {
      identifiers.push(operation.schema, operation.table);
    } else if (operation.type === 'add_column') {
      identifiers.push(operation.schema, operation.table, operation.column.name);
    } else if (operation.type === 'add_index') {
      identifiers.push(operation.schema, operation.table, operation.indexName, ...operation.columns);
    }

    for (const value of identifiers) {
      if (!IDENTIFIER_PATTERN.test(value)) {
        throw new BadRequestException(`Invalid SQL identifier: ${value}`);
      }
    }
  }

  private buildCreateIndexDdl(operation: Extract<SchemaOperation, { type: 'add_index' }>): string {
    const unique = operation.unique ? 'UNIQUE ' : '';
    const columns = operation.columns.map((col) => `"${col}"`).join(', ');
    return `CREATE ${unique}INDEX "${operation.indexName}" ON "${operation.schema}"."${operation.table}" (${columns})`;
  }

  private async logChange(
    queryRunner: ReturnType<DataSource['createQueryRunner']>,
    operation: SchemaOperation,
    actorId?: string,
    ddlOverride?: string,
  ): Promise<void> {
    const collection = await this.collectionRepo.findOne({
      where: { tableName: operation.table },
    });
    if (!collection) {
      throw new BadRequestException(`No collection metadata for table ${operation.table}`);
    }

    let entityType: 'collection' | 'property' = 'collection';
    let entityId = collection.id;
    let entityCode = collection.code;
    let beforeState: Record<string, unknown> | null = null;
    let afterState: Record<string, unknown> | null = null;

    if (operation.type === 'add_column' || operation.type === 'add_index') {
      const columnName = operation.type === 'add_column'
        ? operation.column.name
        : operation.columns[0];
      const property = await this.propertyRepo.findOne({
        where: {
          collectionId: collection.id,
          columnName,
        },
      });
      if (!property) {
        throw new BadRequestException(
          `No property metadata for column ${columnName} on ${collection.code}`
        );
      }
      entityType = 'property';
      entityId = property.id;
      entityCode = `${collection.code}.${property.code}`;
      if (operation.type === 'add_column') {
        beforeState = { column: columnName, exists: false };
        afterState = { column: columnName, exists: true, property: this.buildPropertySnapshot(property) };
      } else {
        beforeState = { index: operation.indexName, exists: false, property: this.buildPropertySnapshot(property) };
        afterState = { index: operation.indexName, exists: true, property: this.buildPropertySnapshot(property) };
      }
    } else if (operation.type === 'create_table') {
      beforeState = { table: operation.table, exists: false };
      afterState = { table: operation.table, exists: true, collection: this.buildCollectionSnapshot(collection) };
    }

    const ddl = ddlOverride || this.deriveDdl(operation);
    const log = queryRunner.manager.create(SchemaChangeLog, {
      entityType,
      entityId,
      entityCode,
      changeType: 'sync',
      changeSource: 'sync',
      beforeState,
      afterState,
      ddlStatements: ddl ? [ddl] : null,
      performedBy: actorId || null,
      performedByType: actorId ? 'user' : 'system',
      success: true,
    });
    await queryRunner.manager.save(SchemaChangeLog, log);
  }

  private deriveDdl(operation: SchemaOperation): string | null {
    if (operation.type === 'create_table') {
      return operation.ddl;
    }
    if (operation.type === 'add_column') {
      const nullable = operation.column.nullable ? '' : ' NOT NULL';
      const defaultValue = operation.column.defaultValue ? ` DEFAULT ${operation.column.defaultValue}` : '';
      return `ALTER TABLE "${operation.schema}"."${operation.table}" ADD COLUMN "${operation.column.name}" ${operation.column.type}${nullable}${defaultValue}`;
    }
    if (operation.type === 'add_index') {
      return this.buildCreateIndexDdl(operation);
    }
    return null;
  }

  private buildCollectionSnapshot(collection: CollectionDefinition): Record<string, unknown> {
    return {
      id: collection.id,
      code: collection.code,
      tableName: collection.tableName,
      name: collection.name,
      metadata: collection.metadata,
    };
  }

  private buildPropertySnapshot(property: PropertyDefinition): Record<string, unknown> {
    return {
      id: property.id,
      code: property.code,
      columnName: property.columnName,
      propertyTypeId: property.propertyTypeId,
      isRequired: property.isRequired,
      isUnique: property.isUnique,
      isIndexed: property.isIndexed,
      metadata: property.metadata,
    };
  }
}
