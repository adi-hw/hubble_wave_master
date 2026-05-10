import { Injectable, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { CollectionDefinition, PropertyDefinition, PropertyType } from '@hubblewave/instance-db';
import { CollectionStorageService } from '../../../../api/src/app/metadata/collection/collection-storage.service';

const STANDARD_COLUMNS = new Set([
  'id',
  'created_at',
  'updated_at',
  'created_by',
  'updated_by',
  'deleted_at',
]);
const COLUMN_PATTERN = /^[a-zA-Z_][a-zA-Z0-9_]*$/;

export type SchemaPlan = {
  schema: string;
  generatedAt: string;
  operations: SchemaOperation[];
  issues: SchemaPlanIssue[];
};

export type SchemaPlanIssue = {
  severity: 'warning' | 'blocking';
  collectionCode: string;
  propertyCode?: string;
  message: string;
};

export type SchemaOperation =
  | {
      type: 'create_table';
      schema: string;
      table: string;
      ddl: string;
    }
  | {
      type: 'add_column';
      schema: string;
      table: string;
      column: {
        name: string;
        type: string;
        nullable: boolean;
        defaultValue?: string;
      };
    }
  | {
      type: 'add_index';
      schema: string;
      table: string;
      indexName: string;
      columns: string[];
      unique: boolean;
    };

@Injectable()
export class SchemaDiffService {
  constructor(
    @InjectRepository(CollectionDefinition)
    private readonly collectionRepo: Repository<CollectionDefinition>,
    @InjectRepository(PropertyDefinition)
    private readonly propertyRepo: Repository<PropertyDefinition>,
    @InjectRepository(PropertyType)
    private readonly propertyTypeRepo: Repository<PropertyType>,
    private readonly dataSource: DataSource,
    private readonly collectionStorage: CollectionStorageService,
  ) {}

  async buildPlan(options?: {
    collectionCodes?: string[];
    schema?: string;
    includeDraft?: boolean;
  }): Promise<SchemaPlan> {
    const schema = options?.schema || 'public';
    const collections = await this.loadCollections(
      options?.collectionCodes,
      options?.includeDraft === true,
    );
    // Effective properties per collection — own + inherited from
    // extendsCollectionId chain. Per ADR-8 each child collection
    // physically materializes its parents' columns into its own
    // table at deploy time, so the diff loop must see ancestor
    // columns when iterating a child. This implements §6.4's
    // "cascades parent column changes to all child tables" promise:
    // editing a parent's properties produces add_column ops on
    // every child table in the same SchemaPlan transaction.
    const includeDraft = options?.includeDraft === true;
    const propertiesByCollection = await this.loadEffectivePropertiesByCollection(
      collections,
      includeDraft,
    );
    const propertyTypeMap = await this.loadPropertyTypes();

    const operations: SchemaOperation[] = [];
    const issues: SchemaPlanIssue[] = [];
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();

    try {
      for (const collection of collections) {
        const tableName = collection.tableName;
        const collectionProperties = propertiesByCollection.get(collection.id) || [];
        const tableExists = await this.collectionStorage.tableExists(queryRunner, schema, tableName);

        if (!tableExists) {
          operations.push({
            type: 'create_table',
            schema,
            table: tableName,
            ddl: this.collectionStorage.generateCreateTableDdl(schema, tableName),
          });
        }

        const existingColumns = tableExists
          ? await this.collectionStorage.getTableColumns(queryRunner, schema, tableName)
          : [];
        const existingColumnNames = new Set(existingColumns.map((col) => col.name));

        for (const property of collectionProperties) {
          const columnName = property.columnName;
          if (!columnName || STANDARD_COLUMNS.has(columnName)) {
            continue;
          }
          if (!COLUMN_PATTERN.test(columnName)) {
            throw new BadRequestException(`Invalid column name ${columnName} on ${collection.code}`);
          }
          if (existingColumnNames.has(columnName)) {
            continue;
          }

          if (tableExists && property.isRequired && !property.defaultValue) {
            issues.push({
              severity: 'blocking',
              collectionCode: collection.code,
              propertyCode: property.code,
              message:
                `Property ${collection.code}.${property.code} is required without a default value. ` +
                'Add a default value or make it optional before deploying this column.',
            });
          }

          const columnType = this.resolveColumnType(property, propertyTypeMap);
          operations.push({
            type: 'add_column',
            schema,
            table: tableName,
            column: {
              name: columnName,
              type: columnType,
              nullable: !property.isRequired,
              defaultValue: property.defaultValue || undefined,
            },
          });
        }

        const existingIndexes = await this.loadIndexes(queryRunner, schema, tableName);
        for (const property of collectionProperties) {
          if (!property.columnName || STANDARD_COLUMNS.has(property.columnName)) {
            continue;
          }
          if (!property.isIndexed && !property.isUnique) {
            continue;
          }
          const unique = !!property.isUnique;
          if (this.hasIndex(existingIndexes, [property.columnName], unique)) {
            continue;
          }
          operations.push({
            type: 'add_index',
            schema,
            table: tableName,
            indexName: this.buildIndexName(tableName, property.columnName, unique),
            columns: [property.columnName],
            unique,
          });
        }
      }
    } finally {
      await queryRunner.release();
    }

    return {
      schema,
      generatedAt: new Date().toISOString(),
      operations,
      issues,
    };
  }

  private async loadCollections(
    collectionCodes?: string[],
    includeDraft = false,
  ): Promise<CollectionDefinition[]> {
    const qb = this.collectionRepo.createQueryBuilder('c')
      .where('c.is_active = true')
      .orderBy('c.code', 'ASC');

    if (includeDraft) {
      qb.andWhere("c.status IN ('draft', 'published')");
    } else {
      qb.andWhere("c.status = 'published'");
    }

    if (collectionCodes && collectionCodes.length > 0) {
      qb.andWhere('c.code IN (:...codes)', { codes: collectionCodes });
    }

    return qb.getMany();
  }

  private async loadProperties(
    collectionIds: string[],
    includeDraft = false,
  ): Promise<PropertyDefinition[]> {
    if (collectionIds.length === 0) {
      return [];
    }
    const qb = this.propertyRepo.createQueryBuilder('p')
      .where('p.collection_id IN (:...collectionIds)', { collectionIds })
      .andWhere('p.is_active = true')
      .orderBy('p.collection_id', 'ASC')
      .addOrderBy('p.code', 'ASC');

    if (includeDraft) {
      qb.andWhere("p.status IN ('draft', 'published')");
    } else {
      qb.andWhere("p.status = 'published'");
    }

    return qb.getMany();
  }

  private groupProperties(properties: PropertyDefinition[]): Map<string, PropertyDefinition[]> {
    const map = new Map<string, PropertyDefinition[]>();
    for (const property of properties) {
      const entry = map.get(property.collectionId) || [];
      entry.push(property);
      map.set(property.collectionId, entry);
    }
    return map;
  }

  /**
   * Returns a map of collectionId → effective property list (own +
   * inherited via extendsCollectionId, transitively). Order preserves
   * own properties first, then ancestor properties walking upward.
   * Deduplicates by columnName so a child overriding a parent column
   * keeps only one entry (the child's wins).
   */
  private async loadEffectivePropertiesByCollection(
    collections: CollectionDefinition[],
    includeDraft = false,
  ): Promise<Map<string, PropertyDefinition[]>> {
    const allCollections = await this.collectionRepo.find();
    const idToCollection = new Map<string, CollectionDefinition>(
      allCollections.map((c) => [c.id, c]),
    );

    const chainOf = (id: string): string[] => {
      const chain: string[] = [];
      const seen = new Set<string>();
      let cursor: CollectionDefinition | undefined = idToCollection.get(id);
      while (cursor && !seen.has(cursor.id)) {
        chain.push(cursor.id);
        seen.add(cursor.id);
        const parentId = (cursor as unknown as { extendsCollectionId?: string | null })
          .extendsCollectionId;
        if (!parentId) break;
        cursor = idToCollection.get(parentId);
      }
      return chain;
    };

    const relevantIds = new Set<string>();
    for (const c of collections) for (const id of chainOf(c.id)) relevantIds.add(id);
    const allProperties = await this.loadProperties([...relevantIds], includeDraft);
    const byOwner = this.groupProperties(allProperties);

    const result = new Map<string, PropertyDefinition[]>();
    for (const c of collections) {
      const merged: PropertyDefinition[] = [];
      const seen = new Set<string>();
      for (const id of chainOf(c.id)) {
        const props = byOwner.get(id) ?? [];
        for (const p of props) {
          const key = (p.columnName ?? p.code ?? '').toLowerCase();
          if (!key || seen.has(key)) continue;
          seen.add(key);
          merged.push(p);
        }
      }
      result.set(c.id, merged);
    }
    return result;
  }

  private async loadPropertyTypes(): Promise<Map<string, PropertyType>> {
    const types = await this.propertyTypeRepo.find();
    const map = new Map<string, PropertyType>();
    for (const type of types) {
      map.set(type.id, type);
    }
    return map;
  }

  private resolveColumnType(
    property: PropertyDefinition,
    propertyTypeMap: Map<string, PropertyType>
  ): string {
    const propertyType = propertyTypeMap.get(property.propertyTypeId);
    if (!propertyType) {
      throw new BadRequestException(`Property type not found for ${property.code}`);
    }
    const baseType = propertyType.baseType;
    if (!baseType) {
      throw new BadRequestException(`Property type ${propertyType.code} has no base type`);
    }

    const typeCode = propertyType.code.toLowerCase();
    if (typeCode === 'integer' || typeCode === 'duration') {
      return 'INTEGER';
    }
    if (typeCode === 'currency' || typeCode === 'decimal' || typeCode === 'percentage') {
      return 'NUMERIC';
    }

    switch (baseType.toLowerCase()) {
      case 'string':
      case 'text':
        return 'TEXT';
      case 'number':
        return 'NUMERIC';
      case 'boolean':
        return 'BOOLEAN';
      case 'uuid':
        return 'UUID';
      case 'date':
        return 'DATE';
      case 'datetime':
        return 'TIMESTAMPTZ';
      case 'time':
        return 'TIME';
      case 'object':
      case 'array':
      case 'json':
      case 'jsonb':
        return 'JSONB';
      default:
        throw new BadRequestException(
          `Unsupported base type ${baseType} for property type ${propertyType.code}`,
        );
    }
  }

  private async loadIndexes(
    queryRunner: ReturnType<DataSource['createQueryRunner']>,
    schema: string,
    tableName: string
  ): Promise<Array<{ name: string; columns: string[]; unique: boolean }>> {
    const rows = await queryRunner.query(
      `
      SELECT indexname, indexdef
      FROM pg_indexes
      WHERE schemaname = $1
        AND tablename = $2
      `,
      [schema, tableName]
    );

    return rows.map((row: { indexname: string; indexdef: string }) => {
      const columns = this.parseIndexColumns(row.indexdef);
      const unique = row.indexdef.toLowerCase().includes('unique');
      return {
        name: row.indexname,
        columns,
        unique,
      };
    });
  }

  private parseIndexColumns(indexDef: string): string[] {
    const match = indexDef.match(/\(([^)]+)\)/);
    if (!match) {
      return [];
    }
    return match[1].split(',').map((part) => part.trim().replace(/"/g, ''));
  }

  private hasIndex(
    indexes: Array<{ columns: string[]; unique: boolean }>,
    columns: string[],
    unique: boolean,
  ): boolean {
    const target = columns.map((column) => column.toLowerCase());
    return indexes.some((index) => {
      if (unique && !index.unique) {
        return false;
      }
      const indexCols = index.columns.map((column) => column.toLowerCase());
      return target.length === indexCols.length
        && target.every((column, idx) => column === indexCols[idx]);
    });
  }

  private buildIndexName(tableName: string, columnName: string, unique: boolean): string {
    const prefix = unique ? 'ux' : 'idx';
    const safeTable = tableName.replace(/[^a-zA-Z0-9_]/g, '_');
    const safeColumn = columnName.replace(/[^a-zA-Z0-9_]/g, '_');
    return `${prefix}_${safeTable}_${safeColumn}`.substring(0, 63);
  }
}
