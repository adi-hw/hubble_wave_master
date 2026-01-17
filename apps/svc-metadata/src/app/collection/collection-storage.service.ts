/**
 * Sprint 1.1: Collections — Storage Service
 *
 * This service manages the physical database storage for collections:
 * - Creating storage tables with standard schema
 * - Adding versioning (history) tables
 * - Validating table existence and structure
 * - Generating DDL for manual creation
 *
 * IMPORTANT: All operations use QueryRunner for transaction support.
 * Never commit transactions here - let the caller manage transaction boundaries.
 *
 * @module CollectionStorageService
 */

import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { QueryRunner } from 'typeorm';

// ============================================================================
// SQL Identifier Validation
// ============================================================================

/**
 * Validates and sanitizes a SQL identifier (table name, column name, schema name).
 * Prevents SQL injection by ensuring identifiers match expected patterns.
 *
 * Valid identifiers:
 * - Start with a letter or underscore
 * - Contain only letters, numbers, and underscores
 * - Maximum 63 characters (PostgreSQL limit)
 * - Not a reserved SQL keyword
 */
function validateSqlIdentifier(identifier: string, type: 'schema' | 'table' | 'column'): string {
  if (!identifier || typeof identifier !== 'string') {
    throw new BadRequestException(`Invalid ${type} name: must be a non-empty string`);
  }

  // Check length (PostgreSQL limit is 63 characters)
  if (identifier.length > 63) {
    throw new BadRequestException(`Invalid ${type} name: exceeds 63 character limit`);
  }

  // Check pattern: must start with letter or underscore, followed by letters, numbers, underscores
  const validPattern = /^[a-zA-Z_][a-zA-Z0-9_]*$/;
  if (!validPattern.test(identifier)) {
    throw new BadRequestException(
      `Invalid ${type} name "${identifier}": must start with a letter or underscore ` +
      'and contain only letters, numbers, and underscores'
    );
  }

  if (type === 'schema' && identifier.toLowerCase() === 'public') {
    return identifier;
  }

  // List of reserved SQL keywords that should not be used as identifiers
  const reservedKeywords = new Set([
    'select', 'insert', 'update', 'delete', 'drop', 'create', 'alter', 'table',
    'index', 'view', 'database', 'schema', 'from', 'where', 'and', 'or', 'not',
    'null', 'true', 'false', 'in', 'between', 'like', 'is', 'as', 'on', 'join',
    'left', 'right', 'inner', 'outer', 'full', 'cross', 'natural', 'using',
    'order', 'by', 'asc', 'desc', 'limit', 'offset', 'group', 'having', 'union',
    'intersect', 'except', 'all', 'distinct', 'case', 'when', 'then', 'else', 'end',
    'if', 'exists', 'primary', 'key', 'foreign', 'references', 'constraint', 'unique',
    'check', 'default', 'not', 'cascade', 'restrict', 'set', 'trigger', 'function',
    'procedure', 'return', 'returns', 'begin', 'commit', 'rollback', 'transaction',
    'user', 'role', 'grant', 'revoke', 'public', 'with', 'recursive', 'values',
  ]);

  if (reservedKeywords.has(identifier.toLowerCase())) {
    throw new BadRequestException(
      `Invalid ${type} name "${identifier}": cannot use reserved SQL keyword`
    );
  }

  return identifier;
}

/**
 * Escapes a PostgreSQL identifier by wrapping in double quotes.
 * The identifier must be validated first using validateSqlIdentifier.
 */
function escapeIdentifier(identifier: string): string {
  // Double any existing double quotes (PostgreSQL escape rule)
  return `"${identifier.replace(/"/g, '""')}"`;
}

// ============================================================================
// Types & Interfaces
// ============================================================================

/**
 * Configuration for a storage table column.
 */
export interface ColumnDefinition {
  name: string;
  type: string;
  nullable?: boolean;
  defaultValue?: string;
  primaryKey?: boolean;
  unique?: boolean;
  references?: {
    table: string;
    column: string;
  };
}

/**
 * Result of validating a storage table.
 */
export interface TableValidationResult {
  exists: boolean;
  isValid: boolean;
  missingColumns: string[];
  extraColumns: string[];
  typeIssues: Array<{ column: string; expected: string; actual: string }>;
}

/**
 * Result of analyzing an existing table for registration.
 */
export interface TableAnalysisResult {
  tableName: string;
  schema: string;
  rowCount: number;
  columns: Array<{
    name: string;
    type: string;
    nullable: boolean;
    defaultValue?: string;
    isPrimaryKey: boolean;
  }>;
  indexes: Array<{
    name: string;
    columns: string[];
    isUnique: boolean;
  }>;
  foreignKeys: Array<{
    name: string;
    column: string;
    referencesTable: string;
    referencesColumn: string;
  }>;
}

// ============================================================================
// Service Implementation
// ============================================================================

@Injectable()
export class CollectionStorageService {
  private readonly logger = new Logger(CollectionStorageService.name);

  /**
   * Standard columns that every collection storage table must have.
   * These are created automatically and correspond to system properties.
   */
  private readonly STANDARD_COLUMNS: ColumnDefinition[] = [
    {
      name: 'id',
      type: 'UUID',
      nullable: false,
      defaultValue: 'gen_random_uuid()',
      primaryKey: true,
    },
    {
      name: 'created_at',
      type: 'TIMESTAMPTZ',
      nullable: false,
      defaultValue: 'NOW()',
    },
    {
      name: 'updated_at',
      type: 'TIMESTAMPTZ',
      nullable: false,
      defaultValue: 'NOW()',
    },
    {
      name: 'created_by',
      type: 'UUID',
      nullable: true,
    },
    {
      name: 'updated_by',
      type: 'UUID',
      nullable: true,
    },
    {
      name: 'deleted_at',
      type: 'TIMESTAMPTZ',
      nullable: true,
    },
  ];

  // --------------------------------------------------------------------------
  // Table Creation
  // --------------------------------------------------------------------------

  /**
   * Create a new storage table for a collection.
   *
   * This creates a table with standard columns (id, timestamps, audit fields)
   * and sets up necessary indexes for common query patterns.
   *
   * @param queryRunner - Active query runner (caller manages transaction)
   * @param schema - Database schema (usually 'public')
   * @param tableName - Name of the table to create (e.g., 'u_vendor')
   * @throws Error if table already exists or creation fails
   */
  async createStorageTable(
    queryRunner: QueryRunner,
    schema: string,
    tableName: string
  ): Promise<void> {
    // Validate identifiers to prevent SQL injection
    const safeSchema = validateSqlIdentifier(schema, 'schema');
    const safeTableName = validateSqlIdentifier(tableName, 'table');
    const fullTableName = `${escapeIdentifier(safeSchema)}.${escapeIdentifier(safeTableName)}`;

    this.logger.debug(`Creating storage table ${fullTableName}`);

    // Check if table already exists
    const exists = await this.tableExists(queryRunner, schema, tableName);
    if (exists) {
      throw new Error(`Table ${fullTableName} already exists`);
    }

    // Build CREATE TABLE statement
    const columnDefs = this.STANDARD_COLUMNS.map((col) => {
      const safeColName = validateSqlIdentifier(col.name, 'column');
      let def = `${escapeIdentifier(safeColName)} ${col.type}`;

      if (!col.nullable) {
        def += ' NOT NULL';
      }

      if (col.defaultValue) {
        def += ` DEFAULT ${col.defaultValue}`;
      }

      if (col.primaryKey) {
        def += ' PRIMARY KEY';
      }

      return def;
    }).join(',\n  ');

    const createTableSql = `
      CREATE TABLE ${fullTableName} (
        ${columnDefs}
      )
    `;

    await queryRunner.query(createTableSql);

    // Create standard indexes
    await this.createStandardIndexes(queryRunner, schema, tableName);

    // Create updated_at trigger for automatic timestamp updates
    await this.createUpdatedAtTrigger(queryRunner, schema, tableName);

    this.logger.log(`Storage table ${fullTableName} created successfully`);
  }

  /**
   * Create standard indexes for a collection storage table.
   * These indexes optimize common query patterns.
   */
  private async createStandardIndexes(
    queryRunner: QueryRunner,
    schema: string,
    tableName: string
  ): Promise<void> {
    // Validate identifiers (already validated by caller, but defense in depth)
    const safeSchema = validateSqlIdentifier(schema, 'schema');
    const safeTableName = validateSqlIdentifier(tableName, 'table');
    const prefix = safeTableName.replace(/^u_/, '');
    const safePrefix = validateSqlIdentifier(prefix.substring(0, 50), 'column'); // Ensure index name fits

    const escapedSchema = escapeIdentifier(safeSchema);
    const escapedTableName = escapeIdentifier(safeTableName);
    const fullTableName = `${escapedSchema}.${escapedTableName}`;

    // Index for soft delete filtering (most queries filter by deleted_at IS NULL)
    await queryRunner.query(`
      CREATE INDEX ${escapeIdentifier(`idx_${safePrefix}_deleted`)}
      ON ${fullTableName} (deleted_at)
      WHERE deleted_at IS NULL
    `);

    // Index for created_at (common sorting)
    await queryRunner.query(`
      CREATE INDEX ${escapeIdentifier(`idx_${safePrefix}_created`)}
      ON ${fullTableName} (created_at DESC)
    `);

    // Index for updated_at (common sorting, recent changes)
    await queryRunner.query(`
      CREATE INDEX ${escapeIdentifier(`idx_${safePrefix}_updated`)}
      ON ${fullTableName} (updated_at DESC)
    `);

    // Index for created_by (filter by user)
    await queryRunner.query(`
      CREATE INDEX ${escapeIdentifier(`idx_${safePrefix}_created_by`)}
      ON ${fullTableName} (created_by)
      WHERE created_by IS NOT NULL
    `);
  }

  /**
   * Create a trigger that automatically updates the updated_at column.
   */
  private async createUpdatedAtTrigger(
    queryRunner: QueryRunner,
    schema: string,
    tableName: string
  ): Promise<void> {
    // Validate identifiers (already validated by caller, but defense in depth)
    const safeSchema = validateSqlIdentifier(schema, 'schema');
    const safeTableName = validateSqlIdentifier(tableName, 'table');

    const triggerName = `trg_${safeTableName}_updated_at`.substring(0, 63);
    const functionName = `fn_${safeTableName}_set_updated_at`.substring(0, 63);

    const escapedSchema = escapeIdentifier(safeSchema);
    const escapedTableName = escapeIdentifier(safeTableName);

    // Create or replace the trigger function
    await queryRunner.query(`
      CREATE OR REPLACE FUNCTION ${escapedSchema}.${escapeIdentifier(functionName)}()
      RETURNS TRIGGER AS $$
      BEGIN
        NEW.updated_at = NOW();
        RETURN NEW;
      END;
      $$ LANGUAGE plpgsql
    `);

    // Create the trigger
    await queryRunner.query(`
      CREATE TRIGGER ${escapeIdentifier(triggerName)}
      BEFORE UPDATE ON ${escapedSchema}.${escapedTableName}
      FOR EACH ROW
      EXECUTE FUNCTION ${escapedSchema}.${escapeIdentifier(functionName)}()
    `);
  }

  // --------------------------------------------------------------------------
  // Versioning Support
  // --------------------------------------------------------------------------

  /**
   * Enable versioning for a collection by creating a history table.
   *
   * The history table stores previous versions of records, enabling:
   * - Point-in-time recovery
   * - Audit trail of all changes
   * - Comparison between versions
   *
   * @param queryRunner - Active query runner
   * @param schema - Database schema
   * @param tableName - Main table name (history table will be tableName_history)
   */
  async enableVersioning(
    queryRunner: QueryRunner,
    schema: string,
    tableName: string
  ): Promise<void> {
    // Validate identifiers to prevent SQL injection
    const safeSchema = validateSqlIdentifier(schema, 'schema');
    const safeTableName = validateSqlIdentifier(tableName, 'table');
    const historyTableName = `${safeTableName}_history`.substring(0, 63);
    const safeHistoryTableName = validateSqlIdentifier(historyTableName, 'table');
    const fullHistoryTable = `${escapeIdentifier(safeSchema)}.${escapeIdentifier(safeHistoryTableName)}`;

    this.logger.debug(`Enabling versioning for ${safeTableName} (creating ${safeHistoryTableName})`);

    // Check if history table already exists
    const exists = await this.tableExists(queryRunner, schema, historyTableName);
    if (exists) {
      this.logger.warn(`History table ${fullHistoryTable} already exists, skipping`);
      return;
    }

    // Get current table structure
    const columns = await this.getTableColumns(queryRunner, schema, tableName);

    // Build history table with additional versioning columns
    const columnDefs = columns.map((col) => {
      // Remove primary key constraint from history (allows duplicates)
      const safeColName = validateSqlIdentifier(col.name, 'column');
      const type = col.type;
      return `${escapeIdentifier(safeColName)} ${type}`;
    });

    // Add versioning metadata columns
    columnDefs.push('"_version" INTEGER NOT NULL');
    columnDefs.push('"_operation" VARCHAR(10) NOT NULL'); // INSERT, UPDATE, DELETE
    columnDefs.push('"_changed_at" TIMESTAMPTZ NOT NULL DEFAULT NOW()');
    columnDefs.push('"_changed_by" UUID');

    // Create history table
    await queryRunner.query(`
      CREATE TABLE ${fullHistoryTable} (
        "_history_id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        ${columnDefs.join(',\n        ')}
      )
    `);

    // Create index for efficient history queries
    const idxRecordName = `idx_${safeHistoryTableName}_record`.substring(0, 63);
    const idxChangedName = `idx_${safeHistoryTableName}_changed`.substring(0, 63);

    await queryRunner.query(`
      CREATE INDEX ${escapeIdentifier(idxRecordName)}
      ON ${fullHistoryTable} (id, _version DESC)
    `);

    await queryRunner.query(`
      CREATE INDEX ${escapeIdentifier(idxChangedName)}
      ON ${fullHistoryTable} (_changed_at DESC)
    `);

    // Create trigger to automatically capture history on changes
    await this.createHistoryTrigger(queryRunner, schema, tableName, historyTableName, columns);

    // Add version column to main table if not exists
    const hasVersionColumn = columns.some((c) => c.name === '_version');
    if (!hasVersionColumn) {
      await queryRunner.query(`
        ALTER TABLE ${escapeIdentifier(safeSchema)}.${escapeIdentifier(safeTableName)}
        ADD COLUMN "_version" INTEGER NOT NULL DEFAULT 1
      `);
    }

    this.logger.log(`Versioning enabled for ${safeTableName}`);
  }

  /**
   * Create triggers to automatically capture record history.
   */
  private async createHistoryTrigger(
    queryRunner: QueryRunner,
    schema: string,
    tableName: string,
    historyTableName: string,
    columns: Array<{ name: string; type: string }>
  ): Promise<void> {
    // Validate identifiers (already validated by caller, but defense in depth)
    const safeSchema = validateSqlIdentifier(schema, 'schema');
    const safeTableName = validateSqlIdentifier(tableName, 'table');
    const safeHistoryTableName = validateSqlIdentifier(historyTableName, 'table');

    const functionName = `fn_${safeTableName}_history`.substring(0, 63);
    const triggerName = `trg_${safeTableName}_history`.substring(0, 63);

    const escapedSchema = escapeIdentifier(safeSchema);
    const escapedTableName = escapeIdentifier(safeTableName);
    const escapedHistoryTableName = escapeIdentifier(safeHistoryTableName);

    // Column names for the INSERT statement - validate each column name
    const columnNames = columns.map((c) => {
      const safeColName = validateSqlIdentifier(c.name, 'column');
      return escapeIdentifier(safeColName);
    }).join(', ');

    const oldValues = columns.map((c) => {
      const safeColName = validateSqlIdentifier(c.name, 'column');
      return `OLD.${escapeIdentifier(safeColName)}`;
    }).join(', ');

    // Create the history capture function
    await queryRunner.query(`
      CREATE OR REPLACE FUNCTION ${escapedSchema}.${escapeIdentifier(functionName)}()
      RETURNS TRIGGER AS $$
      DECLARE
        v_operation VARCHAR(10);
        v_version INTEGER;
      BEGIN
        IF TG_OP = 'DELETE' THEN
          v_operation := 'DELETE';
          v_version := OLD._version;

          INSERT INTO ${escapedSchema}.${escapedHistoryTableName}
            (${columnNames}, _version, _operation, _changed_by)
          VALUES
            (${oldValues}, v_version, v_operation, OLD.updated_by);

          RETURN OLD;

        ELSIF TG_OP = 'UPDATE' THEN
          v_operation := 'UPDATE';
          v_version := OLD._version;

          -- Capture the OLD state before the update
          INSERT INTO ${escapedSchema}.${escapedHistoryTableName}
            (${columnNames}, _version, _operation, _changed_by)
          VALUES
            (${oldValues}, v_version, v_operation, NEW.updated_by);

          -- Increment version for the new record
          NEW._version := OLD._version + 1;

          RETURN NEW;

        ELSIF TG_OP = 'INSERT' THEN
          -- Set initial version
          NEW._version := 1;
          RETURN NEW;
        END IF;

        RETURN NULL;
      END;
      $$ LANGUAGE plpgsql
    `);

    // Create triggers for INSERT, UPDATE, DELETE
    await queryRunner.query(`
      CREATE TRIGGER ${escapeIdentifier(triggerName)}
      BEFORE INSERT OR UPDATE OR DELETE ON ${escapedSchema}.${escapedTableName}
      FOR EACH ROW
      EXECUTE FUNCTION ${escapedSchema}.${escapeIdentifier(functionName)}()
    `);
  }

  // --------------------------------------------------------------------------
  // Table Analysis & Validation
  // --------------------------------------------------------------------------

  /**
   * Check if a table exists in the database.
   */
  async tableExists(queryRunner: QueryRunner, schema: string, tableName: string): Promise<boolean> {
    const result = await queryRunner.query(
      `
      SELECT EXISTS (
        SELECT FROM information_schema.tables
        WHERE table_schema = $1
        AND table_name = $2
      ) as exists
      `,
      [schema, tableName]
    );

    return result[0]?.exists === true;
  }

  /**
   * Get the columns of an existing table.
   */
  async getTableColumns(
    queryRunner: QueryRunner,
    schema: string,
    tableName: string
  ): Promise<Array<{ name: string; type: string; nullable: boolean; defaultValue?: string }>> {
    const result = await queryRunner.query(
      `
      SELECT
        column_name as name,
        UPPER(udt_name) as type,
        is_nullable = 'YES' as nullable,
        column_default as "defaultValue"
      FROM information_schema.columns
      WHERE table_schema = $1
      AND table_name = $2
      ORDER BY ordinal_position
      `,
      [schema, tableName]
    );

    return result;
  }

  /**
   * Analyze an existing table for registration as a collection.
   * This helps users understand what properties will be created.
   */
  async analyzeTable(
    queryRunner: QueryRunner,
    schema: string,
    tableName: string
  ): Promise<TableAnalysisResult> {
    // Validate identifiers to prevent SQL injection
    const safeSchema = validateSqlIdentifier(schema, 'schema');
    const safeTableName = validateSqlIdentifier(tableName, 'table');
    const fullTableName = `${escapeIdentifier(safeSchema)}.${escapeIdentifier(safeTableName)}`;

    // Get row count
    const countResult = await queryRunner.query(
      `SELECT COUNT(*) as count FROM ${fullTableName}`
    );
    const rowCount = parseInt(countResult[0]?.count || '0', 10);

    // Get columns
    const columns = await this.getTableColumns(queryRunner, schema, tableName);

    // Get primary key info
    const pkResult = await queryRunner.query(
      `
      SELECT a.attname as column_name
      FROM pg_index i
      JOIN pg_attribute a ON a.attrelid = i.indrelid AND a.attnum = ANY(i.indkey)
      WHERE i.indrelid = $1::regclass
      AND i.indisprimary
      `,
      [`${schema}.${tableName}`]
    );
    const pkColumns = new Set(pkResult.map((r: { column_name: string }) => r.column_name));

    // Enhance columns with PK info
    const enhancedColumns = columns.map((col) => ({
      ...col,
      isPrimaryKey: pkColumns.has(col.name),
    }));

    // Get indexes
    const indexResult = await queryRunner.query(
      `
      SELECT
        i.relname as name,
        array_agg(a.attname ORDER BY k.n) as columns,
        ix.indisunique as "isUnique"
      FROM pg_index ix
      JOIN pg_class i ON i.oid = ix.indexrelid
      JOIN pg_class t ON t.oid = ix.indrelid
      JOIN pg_namespace n ON n.oid = t.relnamespace
      CROSS JOIN LATERAL unnest(ix.indkey) WITH ORDINALITY AS k(attnum, n)
      JOIN pg_attribute a ON a.attrelid = t.oid AND a.attnum = k.attnum
      WHERE n.nspname = $1
      AND t.relname = $2
      AND NOT ix.indisprimary
      GROUP BY i.relname, ix.indisunique
      `,
      [schema, tableName]
    );

    // Get foreign keys
    const fkResult = await queryRunner.query(
      `
      SELECT
        tc.constraint_name as name,
        kcu.column_name as column,
        ccu.table_name as "referencesTable",
        ccu.column_name as "referencesColumn"
      FROM information_schema.table_constraints tc
      JOIN information_schema.key_column_usage kcu
        ON tc.constraint_name = kcu.constraint_name
        AND tc.table_schema = kcu.table_schema
      JOIN information_schema.constraint_column_usage ccu
        ON ccu.constraint_name = tc.constraint_name
        AND ccu.table_schema = tc.table_schema
      WHERE tc.table_schema = $1
      AND tc.table_name = $2
      AND tc.constraint_type = 'FOREIGN KEY'
      `,
      [schema, tableName]
    );

    return {
      tableName,
      schema,
      rowCount,
      columns: enhancedColumns,
      indexes: indexResult,
      foreignKeys: fkResult,
    };
  }

  /**
   * Validate that a storage table has the required structure.
   */
  async validateTable(
    queryRunner: QueryRunner,
    schema: string,
    tableName: string
  ): Promise<TableValidationResult> {
    const exists = await this.tableExists(queryRunner, schema, tableName);

    if (!exists) {
      return {
        exists: false,
        isValid: false,
        missingColumns: this.STANDARD_COLUMNS.map((c) => c.name),
        extraColumns: [],
        typeIssues: [],
      };
    }

    const actualColumns = await this.getTableColumns(queryRunner, schema, tableName);
    const actualColumnMap = new Map(actualColumns.map((c) => [c.name, c]));

    const missingColumns: string[] = [];
    const typeIssues: Array<{ column: string; expected: string; actual: string }> = [];

    // Check required columns
    for (const required of this.STANDARD_COLUMNS) {
      const actual = actualColumnMap.get(required.name);

      if (!actual) {
        missingColumns.push(required.name);
      } else if (!this.isTypeCompatible(required.type, actual.type)) {
        typeIssues.push({
          column: required.name,
          expected: required.type,
          actual: actual.type,
        });
      }
    }

    // Find extra columns (not standard - these are fine, just informational)
    const standardNames = new Set(this.STANDARD_COLUMNS.map((c) => c.name));
    const extraColumns = actualColumns.filter((c) => !standardNames.has(c.name)).map((c) => c.name);

    return {
      exists: true,
      isValid: missingColumns.length === 0 && typeIssues.length === 0,
      missingColumns,
      extraColumns,
      typeIssues,
    };
  }

  /**
   * Check if two PostgreSQL types are compatible.
   */
  private isTypeCompatible(expected: string, actual: string): boolean {
    const normalize = (t: string) => t.toUpperCase().replace(/\s+/g, '');
    const e = normalize(expected);
    const a = normalize(actual);

    // Direct match
    if (e === a) return true;

    // Common aliases
    const aliases: Record<string, string[]> = {
      UUID: ['UUID'],
      TIMESTAMPTZ: ['TIMESTAMPTZ', 'TIMESTAMP WITH TIME ZONE'],
      TIMESTAMP: ['TIMESTAMP', 'TIMESTAMP WITHOUT TIME ZONE'],
      TEXT: ['TEXT', 'VARCHAR', 'CHARACTER VARYING'],
      INTEGER: ['INTEGER', 'INT', 'INT4'],
      BIGINT: ['BIGINT', 'INT8'],
      BOOLEAN: ['BOOLEAN', 'BOOL'],
    };

    for (const [, variants] of Object.entries(aliases)) {
      if (variants.includes(e) && variants.includes(a)) {
        return true;
      }
    }

    return false;
  }

  // --------------------------------------------------------------------------
  // DDL Generation (for manual creation)
  // --------------------------------------------------------------------------

  /**
   * Generate DDL SQL for creating a storage table.
   * Useful when automatic creation fails and user needs to create manually.
   */
  generateCreateTableDdl(schema: string, tableName: string): string {
    // Validate identifiers to prevent SQL injection
    const safeSchema = validateSqlIdentifier(schema, 'schema');
    const safeTableName = validateSqlIdentifier(tableName, 'table');

    const escapedSchema = escapeIdentifier(safeSchema);
    const escapedTableName = escapeIdentifier(safeTableName);
    const fullTableName = `${escapedSchema}.${escapedTableName}`;

    const columnDefs = this.STANDARD_COLUMNS.map((col) => {
      const safeColName = validateSqlIdentifier(col.name, 'column');
      let def = `  ${escapeIdentifier(safeColName)} ${col.type}`;

      if (!col.nullable) {
        def += ' NOT NULL';
      }

      if (col.defaultValue) {
        def += ` DEFAULT ${col.defaultValue}`;
      }

      if (col.primaryKey) {
        def += ' PRIMARY KEY';
      }

      return def;
    }).join(',\n');

    const prefix = safeTableName.replace(/^u_/, '');
    const safePrefix = prefix.substring(0, 50);

    const idxDeleted = escapeIdentifier(`idx_${safePrefix}_deleted`);
    const idxCreated = escapeIdentifier(`idx_${safePrefix}_created`);
    const idxUpdated = escapeIdentifier(`idx_${safePrefix}_updated`);
    const idxCreatedBy = escapeIdentifier(`idx_${safePrefix}_created_by`);
    const fnSetUpdatedAt = escapeIdentifier(`fn_${safeTableName}_set_updated_at`.substring(0, 63));
    const trgUpdatedAt = escapeIdentifier(`trg_${safeTableName}_updated_at`.substring(0, 63));

    return `
-- Create storage table for collection
CREATE TABLE ${fullTableName} (
${columnDefs}
);

-- Create indexes for common query patterns
CREATE INDEX ${idxDeleted}
  ON ${fullTableName} (deleted_at)
  WHERE deleted_at IS NULL;

CREATE INDEX ${idxCreated}
  ON ${fullTableName} (created_at DESC);

CREATE INDEX ${idxUpdated}
  ON ${fullTableName} (updated_at DESC);

CREATE INDEX ${idxCreatedBy}
  ON ${fullTableName} (created_by)
  WHERE created_by IS NOT NULL;

-- Create trigger for automatic updated_at
CREATE OR REPLACE FUNCTION ${escapedSchema}.${fnSetUpdatedAt}()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER ${trgUpdatedAt}
  BEFORE UPDATE ON ${fullTableName}
  FOR EACH ROW
  EXECUTE FUNCTION ${escapedSchema}.${fnSetUpdatedAt}();
`.trim();
  }

  // --------------------------------------------------------------------------
  // Cleanup Operations
  // --------------------------------------------------------------------------

  /**
   * Drop a storage table (use with caution).
   * This is called during rollback or when permanently deleting a collection.
   */
  async dropStorageTable(
    queryRunner: QueryRunner,
    schema: string,
    tableName: string
  ): Promise<void> {
    // Validate identifiers to prevent SQL injection
    const safeSchema = validateSqlIdentifier(schema, 'schema');
    const safeTableName = validateSqlIdentifier(tableName, 'table');

    const escapedSchema = escapeIdentifier(safeSchema);
    const escapedTableName = escapeIdentifier(safeTableName);
    const fullTableName = `${escapedSchema}.${escapedTableName}`;

    this.logger.warn(`Dropping storage table ${fullTableName}`);

    // Drop triggers first
    const triggerUpdatedAt = `trg_${safeTableName}_updated_at`.substring(0, 63);
    const triggerHistory = `trg_${safeTableName}_history`.substring(0, 63);

    await queryRunner.query(`
      DROP TRIGGER IF EXISTS ${escapeIdentifier(triggerUpdatedAt)} ON ${fullTableName}
    `);

    await queryRunner.query(`
      DROP TRIGGER IF EXISTS ${escapeIdentifier(triggerHistory)} ON ${fullTableName}
    `);

    // Drop functions
    const fnUpdatedAt = `fn_${safeTableName}_set_updated_at`.substring(0, 63);
    const fnHistory = `fn_${safeTableName}_history`.substring(0, 63);

    await queryRunner.query(`
      DROP FUNCTION IF EXISTS ${escapedSchema}.${escapeIdentifier(fnUpdatedAt)}()
    `);

    await queryRunner.query(`
      DROP FUNCTION IF EXISTS ${escapedSchema}.${escapeIdentifier(fnHistory)}()
    `);

    // Drop history table if exists
    const historyTableName = `${safeTableName}_history`.substring(0, 63);
    const historyExists = await this.tableExists(queryRunner, schema, historyTableName);
    if (historyExists) {
      await queryRunner.query(`DROP TABLE ${escapedSchema}.${escapeIdentifier(historyTableName)}`);
    }

    // Drop main table
    await queryRunner.query(`DROP TABLE IF EXISTS ${fullTableName}`);

    this.logger.log(`Storage table ${fullTableName} dropped`);
  }

  /**
   * Safely attempt to drop a table (ignores errors).
   * Used during rollback when we're not sure if the table was created.
   */
  async dropStorageTableSafe(
    queryRunner: QueryRunner,
    schema: string,
    tableName: string
  ): Promise<boolean> {
    try {
      await this.dropStorageTable(queryRunner, schema, tableName);
      return true;
    } catch (error) {
      this.logger.warn(
        `Safe drop failed for ${schema}.${tableName}: ${(error as Error).message}`
      );
      return false;
    }
  }

  // --------------------------------------------------------------------------
  // Column Management (for adding properties)
  // --------------------------------------------------------------------------

  /**
   * Add a column to a storage table.
   * Called when adding a new property to a collection.
   */
  async addColumn(
    queryRunner: QueryRunner,
    schema: string,
    tableName: string,
    column: ColumnDefinition
  ): Promise<void> {
    // Validate identifiers to prevent SQL injection
    const safeSchema = validateSqlIdentifier(schema, 'schema');
    const safeTableName = validateSqlIdentifier(tableName, 'table');
    const safeColumnName = validateSqlIdentifier(column.name, 'column');

    const fullTableName = `${escapeIdentifier(safeSchema)}.${escapeIdentifier(safeTableName)}`;

    let sql = `ALTER TABLE ${fullTableName} ADD COLUMN ${escapeIdentifier(safeColumnName)} ${column.type}`;

    if (!column.nullable) {
      sql += ' NOT NULL';
    }

    if (column.defaultValue) {
      sql += ` DEFAULT ${column.defaultValue}`;
    }

    if (column.unique) {
      sql += ' UNIQUE';
    }

    await queryRunner.query(sql);

    this.logger.debug(`Added column ${safeColumnName} to ${fullTableName}`);
  }

  /**
   * Drop a column from a storage table.
   * Called when removing a property from a collection.
   */
  async dropColumn(
    queryRunner: QueryRunner,
    schema: string,
    tableName: string,
    columnName: string
  ): Promise<void> {
    // Validate identifiers to prevent SQL injection
    const safeSchema = validateSqlIdentifier(schema, 'schema');
    const safeTableName = validateSqlIdentifier(tableName, 'table');
    const safeColumnName = validateSqlIdentifier(columnName, 'column');

    const fullTableName = `${escapeIdentifier(safeSchema)}.${escapeIdentifier(safeTableName)}`;

    // Don't allow dropping standard columns
    const isStandard = this.STANDARD_COLUMNS.some((c) => c.name === columnName);
    if (isStandard) {
      throw new BadRequestException(`Cannot drop standard column: ${columnName}`);
    }

    await queryRunner.query(
      `ALTER TABLE ${fullTableName} DROP COLUMN IF EXISTS ${escapeIdentifier(safeColumnName)}`
    );

    this.logger.debug(`Dropped column ${safeColumnName} from ${fullTableName}`);
  }

  /**
   * Rename a column in a storage table.
   */
  async renameColumn(
    queryRunner: QueryRunner,
    schema: string,
    tableName: string,
    oldName: string,
    newName: string
  ): Promise<void> {
    // Validate identifiers to prevent SQL injection
    const safeSchema = validateSqlIdentifier(schema, 'schema');
    const safeTableName = validateSqlIdentifier(tableName, 'table');
    const safeOldName = validateSqlIdentifier(oldName, 'column');
    const safeNewName = validateSqlIdentifier(newName, 'column');

    const fullTableName = `${escapeIdentifier(safeSchema)}.${escapeIdentifier(safeTableName)}`;

    // Don't allow renaming standard columns
    const isStandard = this.STANDARD_COLUMNS.some((c) => c.name === oldName);
    if (isStandard) {
      throw new BadRequestException(`Cannot rename standard column: ${oldName}`);
    }

    await queryRunner.query(
      `ALTER TABLE ${fullTableName} RENAME COLUMN ${escapeIdentifier(safeOldName)} TO ${escapeIdentifier(safeNewName)}`
    );

    this.logger.debug(`Renamed column ${safeOldName} to ${safeNewName} in ${fullTableName}`);
  }
}
