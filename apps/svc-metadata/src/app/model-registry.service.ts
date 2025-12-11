import { Injectable, NotFoundException, OnModuleDestroy } from '@nestjs/common';
import { TenantDbService, TableUiConfig, FieldUiConfig } from '@eam-platform/tenant-db';
import NodeCache from 'node-cache';

/**
 * Database-first model registry service.
 * Discovers tables and columns from information_schema instead of relying on model_table/model_field.
 */
@Injectable()
export class ModelRegistryService implements OnModuleDestroy {
  private cache: NodeCache;

  constructor(private readonly tenantDb: TenantDbService) {
    this.cache = new NodeCache({ stdTTL: 30, checkperiod: 60 });
  }

  /**
   * Get table info from information_schema
   */
  async getTable(tableName: string, tenantId: string): Promise<{
    tableName: string;
    label: string;
    storageTable: string;
    storageSchema: string;
    category: string;
    isSystem: boolean;
  }> {
    const cacheKey = `${tenantId}:table:${tableName}`;
    const cached = this.cache.get(cacheKey);
    if (cached) return cached as any;

    const ds = await this.tenantDb.getDataSource(tenantId);

    // Check if table exists in information_schema
    const result = await ds.query(`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
        AND table_type = 'BASE TABLE'
        AND table_name = $1
    `, [tableName]);

    if (!result || result.length === 0) {
      throw new NotFoundException(`Table '${tableName}' not found in database`);
    }

    // Get UI config if exists
    const uiConfigRepo = ds.getRepository(TableUiConfig);
    const uiConfig = await uiConfigRepo.findOne({ where: { tableName } });

    const tableInfo = {
      tableName,
      label: uiConfig?.label || this.formatTableName(tableName),
      storageTable: tableName,
      storageSchema: 'public',
      category: uiConfig?.category || 'application',
      isSystem: uiConfig?.isSystem ?? false,
    };

    this.cache.set(cacheKey, tableInfo);
    return tableInfo;
  }

  private formatTableName(tableName: string): string {
    return tableName
      .replace(/^app_/, '')
      .split('_')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  }

  private formatColumnName(columnName: string): string {
    return columnName
      .split('_')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  }

  private isPlatformAdmin(roles?: string[]) {
    return Array.isArray(roles) && roles.includes('platform_admin');
  }

  /**
   * Map PostgreSQL data types to field types
   */
  private mapDataTypeToFieldType(dataType: string): { type: string; backendType: string; uiWidget: string } {
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
   * Get fields from information_schema and field_ui_config
   */
  async getFields(tableName: string, tenantId: string, roles?: string[]): Promise<any[]> {
    const cacheKey = `${tenantId}:fields:${tableName}`;
    const cached = this.cache.get(cacheKey);
    if (cached) return cached as any[];

    // First ensure table exists
    await this.getTable(tableName, tenantId);

    const ds = await this.tenantDb.getDataSource(tenantId);

    // Get columns from information_schema
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
    `, [tableName]);

    // Get UI configs
    const uiConfigRepo = ds.getRepository(FieldUiConfig);
    const uiConfigs = await uiConfigRepo.find({ where: { tableName } });
    const uiConfigMap = new Map(uiConfigs.map(c => [c.columnName, c]));

    const showHidden = this.isPlatformAdmin(roles);

    const fields = columnsResult
      .map((col: any) => {
        const config = uiConfigMap.get(col.column_name);
        const typeInfo = this.mapDataTypeToFieldType(col.data_type);

        // System columns are hidden by default
        const isSystemColumn = ['id', 'created_at', 'updated_at', 'created_by', 'updated_by', 'deleted_at', 'row_version'].includes(col.column_name);

        return {
          code: col.column_name,
          label: config?.label || this.formatColumnName(col.column_name),
          type: typeInfo.type,
          backendType: typeInfo.backendType,
          uiWidget: typeInfo.uiWidget,
          storagePath: `column:${col.column_name}`,
          nullable: col.is_nullable === 'YES',
          isUnique: false, // Would need to query pg_indexes for this
          defaultValue: col.column_default,
          config: {
            maxLength: col.character_maximum_length,
            precision: col.numeric_precision,
            choices: config?.choices,
            referenceTable: config?.referenceTable,
            referenceDisplayField: config?.referenceDisplayField,
          },
          validators: {},
          isInternal: config?.isHidden ?? false,
          isSystem: isSystemColumn,
          showInForms: config?.showInForm ?? !isSystemColumn,
          showInLists: config?.showInList ?? !isSystemColumn,
          displayOrder: config?.displayOrder ?? col.ordinal_position,
        };
      })
      .filter((f: any) => showHidden || !f.isInternal)
      .sort((a: any, b: any) => a.displayOrder - b.displayOrder);

    this.cache.set(cacheKey, fields);
    return fields;
  }

  /**
   * Get form layout (placeholder - returns null for now as layouts are no longer table-based)
   */
  async getLayout(_tableName: string, _tenantId: string): Promise<any> {
    // In the new database-first approach, form layouts are generated dynamically
    // based on field_ui_config settings (formSection, formWidth, displayOrder)
    return null;
  }

  clearCache(tenantId?: string) {
    if (tenantId) {
      const keys = this.cache.keys();
      const tenantKeys = keys.filter(k => k.startsWith(`${tenantId}:`));
      this.cache.del(tenantKeys);
    } else {
      this.cache.flushAll();
    }
  }

  onModuleDestroy() {
    this.cache.close();
  }
}
