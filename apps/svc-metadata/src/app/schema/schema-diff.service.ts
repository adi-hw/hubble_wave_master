import { Injectable, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { CollectionDefinition, PropertyDefinition, PropertyType } from '@hubblewave/instance-db';
import { CollectionStorageService } from '../collection/collection-storage.service';

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

  async buildPlan(options?: { collectionCodes?: string[]; schema?: string }): Promise<SchemaPlan> {
    const schema = options?.schema || 'public';
    const collections = await this.loadPublishedCollections(options?.collectionCodes);
    const properties = await this.loadPublishedProperties(collections.map((c) => c.id));
    const propertiesByCollection = this.groupProperties(properties);
    const propertyTypeMap = await this.loadPropertyTypes();

    const operations: SchemaOperation[] = [];
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

          if (property.isRequired && !property.defaultValue) {
            throw new BadRequestException(
              `Property ${collection.code}.${property.code} is required without a default value`
            );
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
    };
  }

  private async loadPublishedCollections(collectionCodes?: string[]): Promise<CollectionDefinition[]> {
    const qb = this.collectionRepo.createQueryBuilder('c')
      .where('c.is_active = true')
      .andWhere("COALESCE(c.metadata->>'status','published') = 'published'")
      .orderBy('c.code', 'ASC');

    if (collectionCodes && collectionCodes.length > 0) {
      qb.andWhere('c.code IN (:...codes)', { codes: collectionCodes });
    }

    return qb.getMany();
  }

  private async loadPublishedProperties(collectionIds: string[]): Promise<PropertyDefinition[]> {
    if (collectionIds.length === 0) {
      return [];
    }
    return this.propertyRepo.createQueryBuilder('p')
      .where('p.collection_id IN (:...collectionIds)', { collectionIds })
      .andWhere('p.is_active = true')
      .andWhere("COALESCE(p.metadata->>'status','published') = 'published'")
      .orderBy('p.collection_id', 'ASC')
      .addOrderBy('p.code', 'ASC')
      .getMany();
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
    return baseType.toUpperCase();
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
