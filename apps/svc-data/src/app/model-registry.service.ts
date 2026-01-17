import { Injectable, NotFoundException, OnModuleDestroy, Logger } from '@nestjs/common';
import { CollectionDefinition, PropertyDefinition } from '@hubblewave/instance-db';
import { DataSource } from 'typeorm';
import NodeCache from 'node-cache';

/** Return type for getCollection method */
export interface CollectionInfo {
  collectionCode: string;
  label: string;
  storageTable: string;
  storageSchema: string;
  category: string;
  isSystem: boolean;
}

// Internal interface for UI config
interface PropertyUiConfig {
    propertyId: string;
    label?: string;
    isVisibleInForm?: boolean;
    isVisibleInList?: boolean;
}

/** Return type for getProperties method */
export interface PropertyInfo {
  code: string;
  label: string;
  type: string;
  backendType: string;
  uiWidget: string;
  storagePath: string;
  nullable: boolean;
  isUnique: boolean;
  defaultValue: string | null;
  config: {
    maxLength?: number | null;
    precision?: number | null;
    choices?: Array<{ value: string; label: string }> | null;
    referenceCollection?: string | null;
    referenceDisplayProperty?: string | null;
  };
  validators: Record<string, unknown>;
  isInternal: boolean;
  isSystem: boolean;
  showInForms: boolean;
  showInLists: boolean;
  displayOrder: number;
}

/**
 * Database-first model registry service.
 * Discovers collections and properties from information_schema and collection_definitions.
 *
 * Cache Strategy:
 * - Default TTL: 30 seconds for automatic expiration
 * - Manual invalidation: Call invalidateCache() when schema or UI config changes
 */
@Injectable()
export class ModelRegistryService implements OnModuleDestroy {
  private readonly logger = new Logger(ModelRegistryService.name);
  private cache: NodeCache;

  constructor(private readonly dataSource: DataSource) {
    this.cache = new NodeCache({ stdTTL: 30, checkperiod: 60 });
  }

  /**
   * Invalidate cache for a specific collection, or all collections.
   * Call this method when:
   * - Collection schema changes (properties added/removed)
   * - UI config is updated
   * - Admin manually requests cache refresh
   *
   * @param collectionCode - Optional specific collection to invalidate. If not provided, invalidates all collections.
   */
  invalidateCache(collectionCode?: string): void {
    if (collectionCode) {
      const collectionKey = `collection:${collectionCode}`;
      const propertiesKey = `properties:${collectionCode}`;
      this.cache.del([collectionKey, propertiesKey]);
      this.logger.debug(`Invalidated cache for collection ${collectionCode}`);
    } else {
      this.clearAllCache();
      this.logger.debug(`Invalidated all cache entries`);
    }
  }

  /**
   * Force refresh cache for a specific collection by fetching fresh data.
   * Useful when you need the latest data immediately after a schema change.
   *
   * @param collectionCode - The collection to refresh
   * @param roles - Optional roles for property visibility
   * @returns Fresh collection and property data
   */
  async refreshCollectionCache(
    collectionCode: string,
    roles?: string[]
  ): Promise<{ collection: CollectionInfo; properties: PropertyInfo[] }> {
    this.invalidateCache(collectionCode);
    const collection = await this.getCollection(collectionCode);
    const properties = await this.getProperties(collectionCode, roles);
    return { collection, properties };
  }

  /**
   * Get collection info from information_schema and collection_definitions
   */
  async getCollection(collectionCode: string): Promise<CollectionInfo> {
    const cacheKey = `collection:${collectionCode}`;
    const cached = this.cache.get<CollectionInfo>(cacheKey);
    if (cached) return cached;

    const ds = this.dataSource;

    // Check if storage table exists in information_schema
    const result = await ds.query(`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
        AND table_type = 'BASE TABLE'
        AND table_name = $1
    `, [collectionCode]);

    if (!result || result.length === 0) {
      throw new NotFoundException(`Collection '${collectionCode}' not found in database`);
    }

    // Get collection definition if exists
    const collectionRepo = ds.getRepository(CollectionDefinition);
    const collection = await collectionRepo.findOne({ where: { tableName: collectionCode, isActive: true } });

    const collectionInfo: CollectionInfo = {
      collectionCode,
      label: collection?.name || this.formatCollectionName(collectionCode),
      storageTable: collectionCode,
      storageSchema: 'public',
      category: collection?.category || 'application',
      isSystem: collection?.isSystem ?? false,
    };

    this.cache.set(cacheKey, collectionInfo);
    return collectionInfo;
  }

  private formatCollectionName(code: string): string {
    return code
      .replace(/^app_/, '')
      .split('_')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  }

  private formatPropertyName(propertyCode: string): string {
    return propertyCode
      .split('_')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  }

  private isAdmin(roles?: string[]) {
    return Array.isArray(roles) && roles.includes('admin');
  }

  /**
   * Map PostgreSQL data types to property types
   */
  private mapDataTypeToPropertyType(dataType: string): { type: string; backendType: string; uiWidget: string } {
    const typeMap: Record<string, { type: string; backendType: string; uiWidget: string }> = {
      'uuid': { type: 'uuid', backendType: 'uuid', uiWidget: 'text' },
      'character varying': { type: 'string', backendType: 'varchar', uiWidget: 'text' },
      'varchar': { type: 'string', backendType: 'varchar', uiWidget: 'text' },
      'text': { type: 'text', backendType: 'text', uiWidget: 'textarea' },
      'integer': { type: 'integer', backendType: 'integer', uiWidget: 'number' },
      'bigint': { type: 'integer', backendType: 'bigint', uiWidget: 'number' },
      'smallint': { type: 'integer', backendType: 'smallint', uiWidget: 'number' },
      'numeric': { type: 'decimal', backendType: 'numeric', uiWidget: 'number' },
      'real': { type: 'decimal', backendType: 'real', uiWidget: 'number' },
      'double precision': { type: 'decimal', backendType: 'double', uiWidget: 'number' },
      'boolean': { type: 'boolean', backendType: 'boolean', uiWidget: 'checkbox' },
      'date': { type: 'date', backendType: 'date', uiWidget: 'date' },
      'timestamp with time zone': { type: 'datetime', backendType: 'timestamptz', uiWidget: 'datetime' },
      'timestamp without time zone': { type: 'datetime', backendType: 'timestamp', uiWidget: 'datetime' },
      'time': { type: 'time', backendType: 'time', uiWidget: 'time' },
      'jsonb': { type: 'json', backendType: 'jsonb', uiWidget: 'json' },
      'json': { type: 'json', backendType: 'json', uiWidget: 'json' },
      'ARRAY': { type: 'array', backendType: 'array', uiWidget: 'tags' },
    };
    return typeMap[dataType] || { type: 'string', backendType: dataType, uiWidget: 'text' };
  }

  /**
   * Get properties from property_definitions for a collection
   */
  async getProperties(collectionCode: string, roles?: string[]): Promise<PropertyInfo[]> {
    const cacheKey = `properties:${collectionCode}`;
    const cached = this.cache.get<PropertyInfo[]>(cacheKey);
    if (cached) return cached;

    // First ensure collection exists
    await this.getCollection(collectionCode);

    const ds = this.dataSource;

    // Get collection first
    const collectionRepo = ds.getRepository(CollectionDefinition);
    const collection = await collectionRepo.findOne({ where: { tableName: collectionCode, isActive: true } });

    if (!collection) {
      // Fall back to information_schema if no collection definition
      return this.getPropertiesFromSchema(collectionCode, roles);
    }

    // Get property definitions for this collection
    const propertyRepo = ds.getRepository(PropertyDefinition);
    const properties = await propertyRepo.find({
      where: { collectionId: collection.id, isActive: true },
      order: { position: 'ASC' },
    });

    // Collect all unique reference collection IDs to look up their codes
    const referenceCollectionIds = new Set<string>();
    for (const prop of properties) {
      if (prop.referenceCollectionId) {
        referenceCollectionIds.add(prop.referenceCollectionId);
      }
    }

    // Build a map of collection ID -> collectionCode for reference lookups
    const referenceCollectionMap = new Map<string, string>();
    if (referenceCollectionIds.size > 0) {
      const refCollections = await collectionRepo.find({
        where: [...referenceCollectionIds].map(id => ({ id })),
        select: ['id', 'tableName'],
      });
      for (const refCol of refCollections) {
        referenceCollectionMap.set(refCol.id, refCol.tableName);
      }
    }

    const uiConfigMap = new Map<string, PropertyUiConfig>();

    const showHidden = this.isAdmin(roles);

    const propertyInfoList: PropertyInfo[] = properties
      .map((prop) => {
        const uiConfig = uiConfigMap.get(prop.id);
        const dataType = (prop.config as Record<string, unknown>)?.dataType as string || 'string';
        const typeInfo = this.mapDataTypeToPropertyType(dataType);

        // System properties are hidden by default
        const isSystemProperty = ['id', 'created_at', 'updated_at', 'created_by', 'updated_by', 'is_active', 'row_version'].includes(prop.columnName || prop.code);

        // Get reference collection code from the map (looked up from referenceCollectionId)
        const referenceCollection = prop.referenceCollectionId
          ? referenceCollectionMap.get(prop.referenceCollectionId) || null
          : null;

        return {
          code: prop.code,
          label: uiConfig?.label || prop.name || this.formatPropertyName(prop.code),
          type: typeInfo.type,
          backendType: typeInfo.backendType,
          uiWidget: typeInfo.uiWidget,
          storagePath: `column:${prop.columnName || prop.code}`,
          nullable: !prop.isRequired,
          isUnique: prop.isUnique ?? false,
          defaultValue: prop.defaultValue as string | null,
          config: {
            maxLength: (prop.config as Record<string, unknown>)?.maxLength as number | null,
            precision: (prop.config as Record<string, unknown>)?.precision as number | null,
            choices: (prop.config as Record<string, unknown>)?.choices as Array<{ value: string; label: string }> | null,
            referenceCollection: referenceCollection,
            referenceDisplayProperty: prop.referenceDisplayProperty || null,
          },
          validators: (prop.config as Record<string, unknown>)?.validators as Record<string, unknown> || {},
          isInternal: !prop.isVisible,
          isSystem: prop.isSystem ?? isSystemProperty,
          showInForms: uiConfig?.isVisibleInForm ?? !isSystemProperty,
          showInLists: uiConfig?.isVisibleInList ?? !isSystemProperty,
          displayOrder: prop.position ?? 0,
        };
      })
      .filter((f) => showHidden || !f.isInternal)
      .sort((a, b) => a.displayOrder - b.displayOrder);

    this.cache.set(cacheKey, propertyInfoList);
    return propertyInfoList;
  }

  /**
   * Fallback: Get properties from information_schema when no collection definition exists
   */
  private async getPropertiesFromSchema(collectionCode: string, roles?: string[]): Promise<PropertyInfo[]> {
    const ds = this.dataSource;

    // Get columns from information_schema for the storage table
    const columnsResult = await ds.query(`
      SELECT
        column_name,
        data_type,
        is_nullable,
        column_default,
        character_maximum_length,
        numeric_precision,
        ordinal_position
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = $1
      ORDER BY ordinal_position
    `, [collectionCode]);

    const showHidden = this.isAdmin(roles);

    // Define column result type
    interface ColumnResult {
      column_name: string;
      data_type: string;
      is_nullable: string;
      column_default: string | null;
      character_maximum_length: number | null;
      numeric_precision: number | null;
      ordinal_position: number;
    }

    const propertyList: PropertyInfo[] = (columnsResult as ColumnResult[])
      .map((col) => {
        const typeInfo = this.mapDataTypeToPropertyType(col.data_type);

        // System properties are hidden by default
        const isSystemProperty = ['id', 'created_at', 'updated_at', 'created_by', 'updated_by', 'is_active', 'row_version'].includes(col.column_name);

        return {
          code: col.column_name,
          label: this.formatPropertyName(col.column_name),
          type: typeInfo.type,
          backendType: typeInfo.backendType,
          uiWidget: typeInfo.uiWidget,
          storagePath: `column:${col.column_name}`,
          nullable: col.is_nullable === 'YES',
          isUnique: false,
          defaultValue: col.column_default,
          config: {
            maxLength: col.character_maximum_length,
            precision: col.numeric_precision,
            choices: null,
            referenceCollection: null,
            referenceDisplayProperty: null,
          },
          validators: {},
          isInternal: false,
          isSystem: isSystemProperty,
          showInForms: !isSystemProperty,
          showInLists: !isSystemProperty,
          displayOrder: col.ordinal_position,
        };
      })
      .filter((f) => showHidden || !f.isInternal)
      .sort((a, b) => a.displayOrder - b.displayOrder);

    return propertyList;
  }

  /**
   * Get form layout (returns null as layouts are generated dynamically)
   */
  async getLayout(_collectionCode: string): Promise<any> {
    // Form layouts are generated dynamically based on property definitions and UI config
    return null;
  }

  clearAllCache() {
    this.cache.flushAll();
  }

  onModuleDestroy() {
    this.cache.close();
  }
}

