import { Injectable, Logger } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource, QueryRunner } from 'typeorm';
import { PerformedByType } from '@hubblewave/instance-db';

/**
 * Mapping from HubbleWave data types to PostgreSQL column types.
 */
const DATA_TYPE_MAP: Record<string, {
  pgType: string;
  defaultConstraints?: string;
}> = {
  // Text types
  'text': { pgType: 'VARCHAR(255)' },
  'long_text': { pgType: 'TEXT' },
  'longtext': { pgType: 'TEXT' },
  'rich_text': { pgType: 'TEXT' },
  'rich-text': { pgType: 'TEXT' },
  'email': { pgType: 'VARCHAR(255)' },
  'phone': { pgType: 'VARCHAR(50)' },
  'url': { pgType: 'VARCHAR(2048)' },
  'ip_address': { pgType: 'VARCHAR(64)' },
  'mac_address': { pgType: 'VARCHAR(64)' },
  'color': { pgType: 'VARCHAR(64)' },
  'password_hashed': { pgType: 'TEXT' },
  'secret_encrypted': { pgType: 'TEXT' },
  'domain_scope': { pgType: 'VARCHAR(255)' },
  'translated_string': { pgType: 'TEXT' },
  'translated_rich_text': { pgType: 'TEXT' },

  // Numeric types
  'number': { pgType: 'NUMERIC' },
  'integer': { pgType: 'INTEGER' },
  'decimal': { pgType: 'NUMERIC(19,4)' },
  'currency': { pgType: 'NUMERIC(19,4)' },
  'percent': { pgType: 'NUMERIC(9,4)' },
  'percentage': { pgType: 'NUMERIC(9,4)' },
  'auto_number': { pgType: 'NUMERIC' },
  'long': { pgType: 'NUMERIC' },
  'float': { pgType: 'NUMERIC' },
  'double': { pgType: 'NUMERIC' },

  // Boolean
  'boolean': { pgType: 'BOOLEAN', defaultConstraints: 'DEFAULT false' },

  // Date/Time types
  'date': { pgType: 'DATE' },
  'datetime': { pgType: 'TIMESTAMPTZ' },
  'time': { pgType: 'TIME' },
  'duration': { pgType: 'INTERVAL' },

  // Reference types
  'reference': { pgType: 'UUID' },
  'user': { pgType: 'UUID' },
  'group': { pgType: 'UUID' },
  'hierarchical': { pgType: 'UUID' },
  'user_reference': { pgType: 'UUID' },
  'group_reference': { pgType: 'UUID' },
  'location_reference': { pgType: 'UUID' },
  'multi_reference': { pgType: 'JSONB', defaultConstraints: "DEFAULT '[]'::jsonb" },
  'multi-reference': { pgType: 'JSONB', defaultConstraints: "DEFAULT '[]'::jsonb" },
  'multi_user': { pgType: 'JSONB', defaultConstraints: "DEFAULT '[]'::jsonb" },
  'multi-user': { pgType: 'JSONB', defaultConstraints: "DEFAULT '[]'::jsonb" },

  // Choice types
  'choice': { pgType: 'VARCHAR(100)' },
  'multi_choice': { pgType: 'JSONB', defaultConstraints: "DEFAULT '[]'::jsonb" },
  'multi-choice': { pgType: 'JSONB', defaultConstraints: "DEFAULT '[]'::jsonb" },
  'tags': { pgType: 'JSONB', defaultConstraints: "DEFAULT '[]'::jsonb" },

  // Complex types
  'attachment': { pgType: 'JSONB', defaultConstraints: "DEFAULT '[]'::jsonb" },
  'file': { pgType: 'JSONB', defaultConstraints: "DEFAULT '[]'::jsonb" },
  'image': { pgType: 'JSONB', defaultConstraints: "DEFAULT '[]'::jsonb" },
  'audio': { pgType: 'JSONB', defaultConstraints: "DEFAULT '[]'::jsonb" },
  'video': { pgType: 'JSONB', defaultConstraints: "DEFAULT '[]'::jsonb" },
  'json': { pgType: 'JSONB' },
  'key_value': { pgType: 'JSONB' },
  'condition': { pgType: 'JSONB' },
  'geolocation': { pgType: 'JSONB' },
  'geo_point': { pgType: 'JSONB' },
  'formula': { pgType: 'TEXT' },
  'rollup': { pgType: 'TEXT' },
  'lookup': { pgType: 'TEXT' },
  'process_flow_stage': { pgType: 'TEXT' },
  'script_ref': { pgType: 'TEXT' },

  // Identifier type
  'uuid': { pgType: 'UUID' },
  'guid': { pgType: 'UUID' },
};

/**
 * Options for creating a new table in PostgreSQL.
 */
export interface CreateTableOptions {
  tableName: string;
  schemaName?: string;
  columns: ColumnDefinition[];
  addStandardColumns?: boolean;
}

/**
 * Definition for a column to be created in PostgreSQL.
 */
export interface ColumnDefinition {
  name: string;
  dataType: string;
  nullable?: boolean;
  defaultValue?: string;
  unique?: boolean;
  references?: {
    table: string;
    column: string;
  };
}

/**
 * Options for altering an existing table.
 */
export interface AlterTableOptions {
  tableName: string;
  schemaName?: string;
  addColumns?: ColumnDefinition[];
  dropColumns?: string[];
  alterColumns?: {
    name: string;
    newName?: string;
    newType?: string;
    nullable?: boolean;
    defaultValue?: string | null;
  }[];
}

/**
 * Result of a DDL operation.
 */
export interface DdlResult {
  success: boolean;
  ddl: string[];
  error?: string;
}

/**
 * Context for tracking who performed a schema change.
 */
export interface ChangeContext {
  entityId: string;
  performedBy?: string;
  performedByType: PerformedByType;
}

/**
 * DdlExecutorService
 *
 * This service is responsible for executing DDL (Data Definition Language)
 * statements against PostgreSQL with transaction safety and audit logging.
 */
@Injectable()
export class DdlExecutorService {
  private readonly logger = new Logger(DdlExecutorService.name);

  constructor(
    @InjectDataSource()
    private readonly dataSource: DataSource,
  ) {}

  // ═══════════════════════════════════════════════════════════════════════════
  // TABLE OPERATIONS
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Creates a new PostgreSQL table with standard audit columns and triggers.
   */
  async createTable(
    options: CreateTableOptions,
    changeContext: ChangeContext,
  ): Promise<DdlResult> {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    const ddlStatements: string[] = [];
    const schema = options.schemaName || 'public';
    const fullTableName = `"${schema}"."${options.tableName}"`;

    try {
      const columnDefs: string[] = [];

      // Add standard audit columns if requested
      if (options.addStandardColumns !== false) {
        columnDefs.push('id UUID PRIMARY KEY DEFAULT gen_random_uuid()');
        columnDefs.push('created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()');
        columnDefs.push('updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()');
        columnDefs.push('created_by UUID');
        columnDefs.push('updated_by UUID');
        columnDefs.push('is_deleted BOOLEAN NOT NULL DEFAULT false');
        columnDefs.push('deleted_at TIMESTAMPTZ');
      }

      // Add user-defined columns
      for (const col of options.columns) {
        columnDefs.push(this.buildColumnDefinition(col));
      }

      // Generate and execute CREATE TABLE
      const createTableSql = `CREATE TABLE ${fullTableName} (\n  ${columnDefs.join(',\n  ')}\n)`;
      ddlStatements.push(createTableSql);
      await queryRunner.query(createTableSql);

      // Add standard indexes
      if (options.addStandardColumns !== false) {
        const createdAtIndexSql = `CREATE INDEX "idx_${options.tableName}_created_at" ON ${fullTableName}(created_at DESC)`;
        ddlStatements.push(createdAtIndexSql);
        await queryRunner.query(createdAtIndexSql);

        const notDeletedIndexSql = `CREATE INDEX "idx_${options.tableName}_not_deleted" ON ${fullTableName}(is_deleted) WHERE is_deleted = false`;
        ddlStatements.push(notDeletedIndexSql);
        await queryRunner.query(notDeletedIndexSql);
      }

      // Create trigger function for automatic updated_at
      const triggerFunctionSql = `
        CREATE OR REPLACE FUNCTION update_${options.tableName}_updated_at()
        RETURNS TRIGGER AS $$
        BEGIN
          NEW.updated_at = NOW();
          RETURN NEW;
        END;
        $$ LANGUAGE plpgsql
      `;
      ddlStatements.push(triggerFunctionSql.trim());
      await queryRunner.query(triggerFunctionSql);

      // Attach the trigger to the table
      const triggerSql = `
        CREATE TRIGGER trg_${options.tableName}_updated_at
        BEFORE UPDATE ON ${fullTableName}
        FOR EACH ROW
        EXECUTE FUNCTION update_${options.tableName}_updated_at()
      `;
      ddlStatements.push(triggerSql.trim());
      await queryRunner.query(triggerSql);

      // Log the successful change
      await this.logSchemaChange(queryRunner, {
        entityType: 'collection',
        entityId: changeContext.entityId,
        entityCode: options.tableName,
        changeType: 'create',
        changeSource: changeContext.performedByType === 'migration' ? 'migration' : 'api',
        beforeState: null,
        afterState: { tableName: options.tableName, columns: options.columns },
        ddlStatements,
        performedBy: changeContext.performedBy,
        performedByType: changeContext.performedByType,
        success: true,
      });

      await queryRunner.commitTransaction();

      this.logger.log(
        `Created table ${fullTableName} with ${options.columns.length} custom columns ` +
        `(${options.addStandardColumns !== false ? '+6 standard columns' : 'no standard columns'})`
      );

      return { success: true, ddl: ddlStatements };
    } catch (error: any) {
      await queryRunner.rollbackTransaction();

      await this.logSchemaChangeSafe({
        entityType: 'collection',
        entityId: changeContext.entityId,
        entityCode: options.tableName,
        changeType: 'create',
        changeSource: changeContext.performedByType === 'migration' ? 'migration' : 'api',
        beforeState: null,
        afterState: { tableName: options.tableName, columns: options.columns },
        ddlStatements,
        performedBy: changeContext.performedBy,
        performedByType: changeContext.performedByType,
        success: false,
        errorMessage: error.message,
      });

      this.logger.error(`Failed to create table ${fullTableName}: ${error.message}`);

      return { success: false, ddl: ddlStatements, error: error.message };
    } finally {
      await queryRunner.release();
    }
  }

  /**
   * Soft-deletes a table by renaming it with a timestamp prefix.
   */
  async dropTable(
    tableName: string,
    changeContext: ChangeContext,
    schemaName: string = 'public',
  ): Promise<DdlResult> {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    const ddlStatements: string[] = [];
    const fullTableName = `"${schemaName}"."${tableName}"`;

    try {
      const timestamp = Date.now();
      const deletedTableName = `_deleted_${timestamp}_${tableName}`;

      const renameSql = `ALTER TABLE ${fullTableName} RENAME TO "${deletedTableName}"`;
      ddlStatements.push(renameSql);
      await queryRunner.query(renameSql);

      await this.logSchemaChange(queryRunner, {
        entityType: 'collection',
        entityId: changeContext.entityId,
        entityCode: tableName,
        changeType: 'delete',
        changeSource: changeContext.performedByType === 'migration' ? 'migration' : 'api',
        beforeState: { tableName },
        afterState: {
          renamedTo: deletedTableName,
          scheduledPurgeAfter: '30 days',
          recoveryInstructions: `To recover, run: ALTER TABLE "${schemaName}"."${deletedTableName}" RENAME TO "${tableName}"`
        },
        ddlStatements,
        performedBy: changeContext.performedBy,
        performedByType: changeContext.performedByType,
        success: true,
      });

      await queryRunner.commitTransaction();

      this.logger.log(
        `Soft-deleted table ${fullTableName} (renamed to ${deletedTableName}).`
      );

      return { success: true, ddl: ddlStatements };
    } catch (error: any) {
      await queryRunner.rollbackTransaction();

      this.logger.error(`Failed to soft-delete table ${fullTableName}: ${error.message}`);

      return { success: false, ddl: ddlStatements, error: error.message };
    } finally {
      await queryRunner.release();
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // COLUMN OPERATIONS
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Adds a new column to an existing table.
   */
  async addColumn(
    tableName: string,
    column: ColumnDefinition,
    changeContext: ChangeContext,
    schemaName: string = 'public',
  ): Promise<DdlResult> {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    const ddlStatements: string[] = [];
    const fullTableName = `"${schemaName}"."${tableName}"`;

    try {
      const columnDef = this.buildColumnDefinition(column);
      const alterSql = `ALTER TABLE ${fullTableName} ADD COLUMN ${columnDef}`;
      ddlStatements.push(alterSql);
      await queryRunner.query(alterSql);

      if (column.dataType === 'reference' && column.references) {
        const indexSql = `CREATE INDEX "idx_${tableName}_${column.name}" ON ${fullTableName}("${column.name}")`;
        ddlStatements.push(indexSql);
        await queryRunner.query(indexSql);
      }

      await this.logSchemaChange(queryRunner, {
        entityType: 'property',
        entityId: changeContext.entityId,
        entityCode: column.name,
        changeType: 'create',
        changeSource: changeContext.performedByType === 'migration' ? 'migration' : 'api',
        beforeState: null,
        afterState: column,
        ddlStatements,
        performedBy: changeContext.performedBy,
        performedByType: changeContext.performedByType,
        success: true,
      });

      await queryRunner.commitTransaction();

      this.logger.log(`Added column '${column.name}' to ${fullTableName}`);

      return { success: true, ddl: ddlStatements };
    } catch (error: any) {
      await queryRunner.rollbackTransaction();

      this.logger.error(
        `Failed to add column '${column.name}' to ${fullTableName}: ${error.message}`
      );

      return { success: false, ddl: ddlStatements, error: error.message };
    } finally {
      await queryRunner.release();
    }
  }

  /**
   * Soft-deletes a column by renaming it with a timestamp prefix.
   */
  async dropColumn(
    tableName: string,
    columnName: string,
    changeContext: ChangeContext,
    schemaName: string = 'public',
  ): Promise<DdlResult> {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    const ddlStatements: string[] = [];
    const fullTableName = `"${schemaName}"."${tableName}"`;

    try {
      const columnInfo = await queryRunner.query(`
        SELECT
          column_name,
          data_type,
          is_nullable,
          column_default,
          character_maximum_length,
          numeric_precision,
          numeric_scale
        FROM information_schema.columns
        WHERE table_schema = $1 AND table_name = $2 AND column_name = $3
      `, [schemaName, tableName, columnName]);

      if (columnInfo.length === 0) {
        throw new Error(`Column '${columnName}' does not exist in ${fullTableName}`);
      }

      const timestamp = Date.now();
      const deletedColumnName = `_deleted_${timestamp}_${columnName}`;

      const renameSql = `ALTER TABLE ${fullTableName} RENAME COLUMN "${columnName}" TO "${deletedColumnName}"`;
      ddlStatements.push(renameSql);
      await queryRunner.query(renameSql);

      await this.logSchemaChange(queryRunner, {
        entityType: 'property',
        entityId: changeContext.entityId,
        entityCode: columnName,
        changeType: 'delete',
        changeSource: changeContext.performedByType === 'migration' ? 'migration' : 'api',
        beforeState: columnInfo[0],
        afterState: {
          renamedTo: deletedColumnName,
          scheduledPurgeAfter: '30 days',
          recoveryInstructions: `To recover, run: ALTER TABLE ${fullTableName} RENAME COLUMN "${deletedColumnName}" TO "${columnName}"`
        },
        ddlStatements,
        performedBy: changeContext.performedBy,
        performedByType: changeContext.performedByType,
        success: true,
      });

      await queryRunner.commitTransaction();

      this.logger.log(
        `Soft-deleted column '${columnName}' from ${fullTableName} ` +
        `(renamed to '${deletedColumnName}')`
      );

      return { success: true, ddl: ddlStatements };
    } catch (error: any) {
      await queryRunner.rollbackTransaction();

      this.logger.error(
        `Failed to soft-delete column '${columnName}' from ${fullTableName}: ${error.message}`
      );

      return { success: false, ddl: ddlStatements, error: error.message };
    } finally {
      await queryRunner.release();
    }
  }

  /**
   * Modifies an existing column's properties.
   */
  async alterColumn(
    tableName: string,
    columnName: string,
    modifications: {
      nullable?: boolean;
      defaultValue?: string | null;
    },
    changeContext: ChangeContext,
    schemaName: string = 'public',
  ): Promise<DdlResult> {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    const ddlStatements: string[] = [];
    const fullTableName = `"${schemaName}"."${tableName}"`;

    try {
      const beforeState = await queryRunner.query(`
        SELECT column_name, is_nullable, column_default
        FROM information_schema.columns
        WHERE table_schema = $1 AND table_name = $2 AND column_name = $3
      `, [schemaName, tableName, columnName]);

      if (beforeState.length === 0) {
        throw new Error(`Column '${columnName}' does not exist in ${fullTableName}`);
      }

      if (modifications.nullable !== undefined) {
        const nullableSql = modifications.nullable
          ? `ALTER TABLE ${fullTableName} ALTER COLUMN "${columnName}" DROP NOT NULL`
          : `ALTER TABLE ${fullTableName} ALTER COLUMN "${columnName}" SET NOT NULL`;
        ddlStatements.push(nullableSql);
        await queryRunner.query(nullableSql);
      }

      if (modifications.defaultValue !== undefined) {
        const defaultSql = modifications.defaultValue === null
          ? `ALTER TABLE ${fullTableName} ALTER COLUMN "${columnName}" DROP DEFAULT`
          : `ALTER TABLE ${fullTableName} ALTER COLUMN "${columnName}" SET DEFAULT ${modifications.defaultValue}`;
        ddlStatements.push(defaultSql);
        await queryRunner.query(defaultSql);
      }

      await this.logSchemaChange(queryRunner, {
        entityType: 'property',
        entityId: changeContext.entityId,
        entityCode: columnName,
        changeType: 'update',
        changeSource: changeContext.performedByType === 'migration' ? 'migration' : 'api',
        beforeState: beforeState[0],
        afterState: { ...beforeState[0], ...modifications },
        ddlStatements,
        performedBy: changeContext.performedBy,
        performedByType: changeContext.performedByType,
        success: true,
      });

      await queryRunner.commitTransaction();

      this.logger.log(`Modified column '${columnName}' in ${fullTableName}`);

      return { success: true, ddl: ddlStatements };
    } catch (error: any) {
      await queryRunner.rollbackTransaction();

      this.logger.error(
        `Failed to modify column '${columnName}' in ${fullTableName}: ${error.message}`
      );

      return { success: false, ddl: ddlStatements, error: error.message };
    } finally {
      await queryRunner.release();
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // HELPER METHODS
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Builds a PostgreSQL column definition from a HubbleWave column definition.
   */
  private buildColumnDefinition(column: ColumnDefinition): string {
    const typeInfo = DATA_TYPE_MAP[column.dataType];
    if (!typeInfo) {
      throw new Error(
        `Unknown data type: '${column.dataType}'. ` +
        `Valid types are: ${Object.keys(DATA_TYPE_MAP).join(', ')}`
      );
    }

    const parts: string[] = [`"${column.name}"`, typeInfo.pgType];

    if (column.nullable === false) {
      parts.push('NOT NULL');
    }

    if (column.defaultValue !== undefined) {
      parts.push(`DEFAULT ${column.defaultValue}`);
    } else if (typeInfo.defaultConstraints && column.nullable !== false) {
      parts.push(typeInfo.defaultConstraints);
    }

    if (column.unique) {
      parts.push('UNIQUE');
    }

    if (column.references) {
      parts.push(
        `REFERENCES "${column.references.table}"("${column.references.column}")`
      );
    }

    return parts.join(' ');
  }

  /**
   * Logs a schema change to the schema_change_log table.
   */
  private async logSchemaChange(
    queryRunner: QueryRunner,
    change: {
      entityType: 'collection' | 'property';
      entityId: string;
      entityCode: string;
      changeType: string;
      changeSource: string;
      beforeState: Record<string, unknown> | null;
      afterState: Record<string, unknown> | null;
      ddlStatements: string[];
      performedBy?: string;
      performedByType: string;
      success: boolean;
      errorMessage?: string;
    },
  ): Promise<void> {
    await queryRunner.query(`
      INSERT INTO schema_change_log (
        entity_type, entity_id, entity_code, change_type, change_source,
        before_state, after_state, ddl_statements,
        performed_by, performed_by_type, success, error_message
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
    `, [
      change.entityType,
      change.entityId,
      change.entityCode,
      change.changeType,
      change.changeSource,
      change.beforeState ? JSON.stringify(change.beforeState) : null,
      change.afterState ? JSON.stringify(change.afterState) : null,
      change.ddlStatements,
      change.performedBy || null,
      change.performedByType,
      change.success,
      change.errorMessage || null,
    ]);
  }

  /**
   * Logs a schema change outside of the main transaction.
   */
  private async logSchemaChangeSafe(
    change: {
      entityType: 'collection' | 'property';
      entityId: string;
      entityCode: string;
      changeType: string;
      changeSource: string;
      beforeState: Record<string, unknown> | null;
      afterState: Record<string, unknown> | null;
      ddlStatements: string[];
      performedBy?: string;
      performedByType: string;
      success: boolean;
      errorMessage?: string;
    },
  ): Promise<void> {
    try {
      await this.dataSource.query(`
        INSERT INTO schema_change_log (
          entity_type, entity_id, entity_code, change_type, change_source,
          before_state, after_state, ddl_statements,
          performed_by, performed_by_type, success, error_message
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
      `, [
        change.entityType,
        change.entityId,
        change.entityCode,
        change.changeType,
        change.changeSource,
        change.beforeState ? JSON.stringify(change.beforeState) : null,
        change.afterState ? JSON.stringify(change.afterState) : null,
        change.ddlStatements,
        change.performedBy || null,
        change.performedByType,
        change.success,
        change.errorMessage || null,
      ]);
    } catch (logError: any) {
      this.logger.warn(`Failed to log schema change: ${logError.message}`);
    }
  }
}
