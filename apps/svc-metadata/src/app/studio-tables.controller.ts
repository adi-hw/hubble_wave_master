import {
  Body,
  Controller,
  Delete,
  Get,
  NotFoundException,
  BadRequestException,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard, RequestContext, RolesGuard, Roles } from '@eam-platform/auth-guard';
import { TenantDbService, TableUiConfig, FieldUiConfig } from '@eam-platform/tenant-db';
import { TableAcl, FieldAcl, AbacPolicy } from '@eam-platform/platform-db';

type AclPayload = Partial<TableAcl> & { operation?: string };

interface CreateFieldDto {
  label: string;
  code: string;
  type: string;
  required?: boolean;
  isUnique?: boolean;
  defaultValue?: string;
  showInForms?: boolean;
  showInLists?: boolean;
  isInternal?: boolean;
  config?: {
    choices?: Array<{ value: string; label: string }>;
    referenceTable?: string;
    referenceDisplayField?: string;
    multiSelect?: boolean;
    maxLength?: number;
    minValue?: number;
    maxValue?: number;
    precision?: number;
    dateFormat?: string;
    allowCustomValues?: boolean;
  };
}

interface CreateTableDto {
  label: string;
  code: string;
  description?: string;
  options?: {
    enableOwnership?: boolean;
    enableOptimisticLocking?: boolean;
    enableOrganization?: boolean;
    enableTags?: boolean;
  };
}

interface BulkUpdateFieldsDto {
  fieldCodes: string[];
  property: string;
  value: any;
}

// Interface for table info from information_schema
interface TableInfo {
  tableName: string;
  label: string;
  category: string;
  isSystem: boolean;
  isHidden: boolean;
  columnCount: number;
  description?: string;
  icon?: string;
}

// Interface for column info from information_schema
interface ColumnInfo {
  columnName: string;
  label: string;
  dataType: string;
  isNullable: boolean;
  columnDefault: string | null;
  maxLength: number | null;
  numericPrecision: number | null;
  ordinalPosition: number;
  showInList: boolean;
  showInForm: boolean;
  isHidden: boolean;
  displayOrder: number;
  description?: string;
  placeholder?: string;
  choices?: Array<{ value: string; label: string }>;
  referenceTable?: string;
}

@Controller('studio')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('tenant_admin', 'platform_admin')
export class StudioTablesController {
  constructor(
    private readonly tenantDb: TenantDbService,
  ) {}

  /**
   * Get table info, checking if it exists in the database
   */
  private async getTableAndEnsure(ctx: RequestContext, tableName: string): Promise<{ tableName: string; label: string }> {
    const ds = await this.tenantDb.getDataSource(ctx.tenantId);

    const result = await ds.query(`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
        AND table_type = 'BASE TABLE'
        AND table_name = $1
    `, [tableName]);

    if (!result || result.length === 0) {
      throw new NotFoundException(`Table "${tableName}" not found`);
    }

    const uiConfigRepo = ds.getRepository(TableUiConfig);
    const uiConfig = await uiConfigRepo.findOne({ where: { tableName } });

    return {
      tableName,
      label: uiConfig?.label || this.formatTableName(tableName),
    };
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

  private normalizePolicyAction(action?: string) {
    return action === 'write' ? 'update' : action;
  }

  /**
   * DATABASE-FIRST: List all tables from information_schema
   */
  @Get('tables')
  async listTables(
    @Query('includeHidden') includeHidden: string,
    @Query('category') category: string,
    @Req() req: any,
  ) {
    const ctx: RequestContext = req.context || req.user;
    const showHidden = includeHidden === 'true';

    try {
      const ds = await this.tenantDb.getDataSource(ctx.tenantId);

      const tablesResult = await ds.query(`
        SELECT
          t.table_name,
          (SELECT COUNT(*) FROM information_schema.columns c
           WHERE c.table_schema = t.table_schema AND c.table_name = t.table_name) as column_count
        FROM information_schema.tables t
        WHERE t.table_schema = 'public'
          AND t.table_type = 'BASE TABLE'
        ORDER BY t.table_name
      `);

      const uiConfigRepo = ds.getRepository(TableUiConfig);
      const uiConfigs = await uiConfigRepo.find();
      const uiConfigMap = new Map(uiConfigs.map(c => [c.tableName, c]));

      const items: TableInfo[] = tablesResult.map((t: any) => {
        const config = uiConfigMap.get(t.table_name);
        return {
          tableName: t.table_name,
          label: config?.label || this.formatTableName(t.table_name),
          category: config?.category || 'application',
          isSystem: config?.isSystem ?? false,
          isHidden: config?.isHidden ?? false,
          columnCount: parseInt(t.column_count, 10),
          description: config?.description,
          icon: config?.icon,
        };
      });

      let filtered = items;
      if (!showHidden) {
        filtered = filtered.filter(t => !t.isHidden);
      }
      if (category) {
        filtered = filtered.filter(t => t.category === category);
      }

      const categories = [...new Set(items.map(t => t.category))].sort();

      return {
        items: filtered,
        categories,
        total: items.length,
        filtered: filtered.length,
      };
    } catch (error) {
      console.warn('Failed to fetch tables:', (error as Error).message);
      return { items: [], categories: [], total: 0, filtered: 0 };
    }
  }

  /**
   * DATABASE-FIRST: Get columns for a table from information_schema
   */
  @Get('tables/:tableName/fields')
  async listFields(
    @Param('tableName') tableName: string,
    @Query('includeHidden') includeHidden: string,
    @Req() req: any,
  ) {
    const ctx: RequestContext = req.context || req.user;
    const showHidden = includeHidden === 'true';

    await this.getTableAndEnsure(ctx, tableName);

    const ds = await this.tenantDb.getDataSource(ctx.tenantId);

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

    const uiConfigRepo = ds.getRepository(FieldUiConfig);
    const uiConfigs = await uiConfigRepo.find({ where: { tableName } });
    const uiConfigMap = new Map(uiConfigs.map(c => [c.columnName, c]));

    const items: ColumnInfo[] = columnsResult.map((c: any) => {
      const config = uiConfigMap.get(c.column_name);
      return {
        columnName: c.column_name,
        label: config?.label || this.formatColumnName(c.column_name),
        dataType: c.data_type,
        isNullable: c.is_nullable === 'YES',
        columnDefault: c.column_default,
        maxLength: c.character_maximum_length,
        numericPrecision: c.numeric_precision,
        ordinalPosition: c.ordinal_position,
        showInList: config?.showInList ?? true,
        showInForm: config?.showInForm ?? true,
        isHidden: config?.isHidden ?? false,
        displayOrder: config?.displayOrder ?? c.ordinal_position,
        description: config?.description,
        placeholder: config?.placeholder,
        choices: config?.choices,
        referenceTable: config?.referenceTable,
      };
    });

    let filtered = items;
    if (!showHidden) {
      filtered = filtered.filter(f => !f.isHidden);
    }
    filtered.sort((a, b) => a.displayOrder - b.displayOrder);

    return {
      tableName,
      items: filtered,
      total: items.length,
      filtered: filtered.length,
    };
  }

  /**
   * Update UI configuration for a table
   */
  @Patch('tables/:tableName/config')
  async updateTableConfig(
    @Param('tableName') tableName: string,
    @Body() body: Partial<TableUiConfig>,
    @Req() req: any,
  ) {
    const ctx: RequestContext = req.context || req.user;
    await this.getTableAndEnsure(ctx, tableName);

    const ds = await this.tenantDb.getDataSource(ctx.tenantId);
    const repo = ds.getRepository(TableUiConfig);

    let config = await repo.findOne({ where: { tableName } });

    if (config) {
      Object.assign(config, {
        label: body.label ?? config.label,
        pluralLabel: body.pluralLabel ?? config.pluralLabel,
        description: body.description ?? config.description,
        icon: body.icon ?? config.icon,
        color: body.color ?? config.color,
        category: body.category ?? config.category,
        isHidden: body.isHidden ?? config.isHidden,
        showInNav: body.showInNav ?? config.showInNav,
        showInSearch: body.showInSearch ?? config.showInSearch,
        defaultSortField: body.defaultSortField ?? config.defaultSortField,
        defaultSortDirection: body.defaultSortDirection ?? config.defaultSortDirection,
        recordsPerPage: body.recordsPerPage ?? config.recordsPerPage,
        displayField: body.displayField ?? config.displayField,
        updatedBy: ctx.userId,
      });
    } else {
      config = repo.create({
        tableName,
        label: body.label || this.formatTableName(tableName),
        pluralLabel: body.pluralLabel,
        description: body.description,
        icon: body.icon,
        color: body.color,
        category: body.category || 'application',
        isHidden: body.isHidden ?? false,
        isSystem: false,
        showInNav: body.showInNav ?? true,
        showInSearch: body.showInSearch ?? true,
        defaultSortField: body.defaultSortField,
        defaultSortDirection: body.defaultSortDirection || 'asc',
        recordsPerPage: body.recordsPerPage || 25,
        displayField: body.displayField,
        createdBy: ctx.userId,
        updatedBy: ctx.userId,
      });
    }

    return repo.save(config);
  }

  /**
   * Update UI configuration for a field
   */
  @Patch('tables/:tableName/fields/:columnName/config')
  async updateFieldConfig(
    @Param('tableName') tableName: string,
    @Param('columnName') columnName: string,
    @Body() body: Partial<FieldUiConfig>,
    @Req() req: any,
  ) {
    const ctx: RequestContext = req.context || req.user;
    await this.getTableAndEnsure(ctx, tableName);

    const ds = await this.tenantDb.getDataSource(ctx.tenantId);

    const columnCheck = await ds.query(`
      SELECT column_name FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = $1 AND column_name = $2
    `, [tableName, columnName]);

    if (!columnCheck || columnCheck.length === 0) {
      throw new NotFoundException(`Column "${columnName}" not found in table "${tableName}"`);
    }

    const repo = ds.getRepository(FieldUiConfig);
    let config = await repo.findOne({ where: { tableName, columnName } });

    if (config) {
      Object.assign(config, {
        label: body.label ?? config.label,
        description: body.description ?? config.description,
        placeholder: body.placeholder ?? config.placeholder,
        helpText: body.helpText ?? config.helpText,
        showInList: body.showInList ?? config.showInList,
        showInForm: body.showInForm ?? config.showInForm,
        showInDetail: body.showInDetail ?? config.showInDetail,
        isHidden: body.isHidden ?? config.isHidden,
        displayOrder: body.displayOrder ?? config.displayOrder,
        formSection: body.formSection ?? config.formSection,
        formWidth: body.formWidth ?? config.formWidth,
        validationMessage: body.validationMessage ?? config.validationMessage,
        referenceTable: body.referenceTable ?? config.referenceTable,
        referenceDisplayField: body.referenceDisplayField ?? config.referenceDisplayField,
        choices: body.choices ?? config.choices,
        formatPattern: body.formatPattern ?? config.formatPattern,
        prefix: body.prefix ?? config.prefix,
        suffix: body.suffix ?? config.suffix,
        updatedBy: ctx.userId,
      });
    } else {
      config = repo.create({
        tableName,
        columnName,
        label: body.label || this.formatColumnName(columnName),
        description: body.description,
        placeholder: body.placeholder,
        helpText: body.helpText,
        showInList: body.showInList ?? true,
        showInForm: body.showInForm ?? true,
        showInDetail: body.showInDetail ?? true,
        isHidden: body.isHidden ?? false,
        displayOrder: body.displayOrder ?? 0,
        formSection: body.formSection,
        formWidth: body.formWidth || 'full',
        validationMessage: body.validationMessage,
        referenceTable: body.referenceTable,
        referenceDisplayField: body.referenceDisplayField,
        choices: body.choices,
        formatPattern: body.formatPattern,
        prefix: body.prefix,
        suffix: body.suffix,
        createdBy: ctx.userId,
        updatedBy: ctx.userId,
      });
    }

    return repo.save(config);
  }

  /**
   * DATABASE-FIRST: Create a new table
   */
  @Post('tables')
  async createTable(@Body() body: CreateTableDto, @Req() req: any) {
    const ctx: RequestContext = req.context || req.user;

    if (!body.label?.trim()) {
      throw new BadRequestException('Table label is required');
    }
    if (!body.code?.trim()) {
      throw new BadRequestException('Table code is required');
    }
    if (!/^[a-z][a-z0-9_]*$/.test(body.code)) {
      throw new BadRequestException('Table code must start with a letter and contain only lowercase letters, numbers, and underscores');
    }

    const ds = await this.tenantDb.getDataSource(ctx.tenantId);
    const tableName = `app_${body.code}`;
    const options = body.options || {};

    const existingTable = await ds.query(`
      SELECT table_name FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = $1
    `, [tableName]);

    if (existingTable && existingTable.length > 0) {
      throw new BadRequestException(`Table "${tableName}" already exists`);
    }

    let createTableSql = `
      CREATE TABLE ${tableName} (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        created_by UUID,
        updated_by UUID,
        is_active BOOLEAN NOT NULL DEFAULT TRUE,
        deleted_at TIMESTAMPTZ`;

    if (options.enableOwnership) createTableSql += `, owner_id UUID`;
    if (options.enableOptimisticLocking) createTableSql += `, row_version INTEGER NOT NULL DEFAULT 1`;
    if (options.enableOrganization) createTableSql += `, organization_id UUID`;
    if (options.enableTags) createTableSql += `, tags TEXT[] DEFAULT '{}'`;

    createTableSql += `);`;

    await ds.query(createTableSql);

    await ds.query(`
      CREATE INDEX IF NOT EXISTS idx_${body.code}_active ON ${tableName}(is_active) WHERE is_active = TRUE;
      CREATE INDEX IF NOT EXISTS idx_${body.code}_created_at ON ${tableName}(created_at);
    `);

    await ds.query(`
      CREATE OR REPLACE FUNCTION update_timestamp()
      RETURNS TRIGGER AS $$
      BEGIN
        NEW.updated_at = NOW();
        RETURN NEW;
      END;
      $$ LANGUAGE plpgsql;

      DROP TRIGGER IF EXISTS trg_${body.code}_updated_at ON ${tableName};
      CREATE TRIGGER trg_${body.code}_updated_at
        BEFORE UPDATE ON ${tableName}
        FOR EACH ROW
        EXECUTE FUNCTION update_timestamp();
    `);

    if (options.enableOptimisticLocking) {
      await ds.query(`
        CREATE OR REPLACE FUNCTION increment_row_version()
        RETURNS TRIGGER AS $$
        BEGIN
          NEW.row_version = OLD.row_version + 1;
          RETURN NEW;
        END;
        $$ LANGUAGE plpgsql;

        DROP TRIGGER IF EXISTS trg_${body.code}_row_version ON ${tableName};
        CREATE TRIGGER trg_${body.code}_row_version
          BEFORE UPDATE ON ${tableName}
          FOR EACH ROW
          EXECUTE FUNCTION increment_row_version();
      `);
    }

    // Create UI config
    const uiConfigRepo = ds.getRepository(TableUiConfig);
    const uiConfig = uiConfigRepo.create({
      tableName,
      label: body.label,
      pluralLabel: body.label + 's',
      description: body.description,
      category: 'application',
      isHidden: false,
      isSystem: false,
      showInNav: true,
      showInSearch: true,
      createdBy: ctx.userId,
      updatedBy: ctx.userId,
    });
    await uiConfigRepo.save(uiConfig);

    // Create field UI configs for system columns
    const fieldUiConfigRepo = ds.getRepository(FieldUiConfig);
    const systemFieldConfigs = [
      { columnName: 'id', label: 'ID', showInList: false, showInForm: false, isHidden: true, displayOrder: -100 },
      { columnName: 'created_at', label: 'Created', showInList: true, showInForm: false, isHidden: false, displayOrder: -90 },
      { columnName: 'created_by', label: 'Created By', showInList: true, showInForm: false, isHidden: false, displayOrder: -89 },
      { columnName: 'updated_at', label: 'Updated', showInList: true, showInForm: false, isHidden: false, displayOrder: -88 },
      { columnName: 'updated_by', label: 'Updated By', showInList: false, showInForm: false, isHidden: false, displayOrder: -87 },
      { columnName: 'is_active', label: 'Active', showInList: true, showInForm: true, isHidden: false, displayOrder: -86 },
      { columnName: 'deleted_at', label: 'Deleted At', showInList: false, showInForm: false, isHidden: true, displayOrder: -85 },
    ];

    if (options.enableOwnership) systemFieldConfigs.push({ columnName: 'owner_id', label: 'Owner', showInList: true, showInForm: true, isHidden: false, displayOrder: -84 });
    if (options.enableOptimisticLocking) systemFieldConfigs.push({ columnName: 'row_version', label: 'Version', showInList: false, showInForm: false, isHidden: true, displayOrder: -83 });
    if (options.enableOrganization) systemFieldConfigs.push({ columnName: 'organization_id', label: 'Organization', showInList: true, showInForm: true, isHidden: false, displayOrder: -82 });
    if (options.enableTags) systemFieldConfigs.push({ columnName: 'tags', label: 'Tags', showInList: true, showInForm: true, isHidden: false, displayOrder: -81 });

    for (const fieldConfig of systemFieldConfigs) {
      const config = fieldUiConfigRepo.create({
        tableName,
        ...fieldConfig,
        createdBy: ctx.userId,
        updatedBy: ctx.userId,
      });
      await fieldUiConfigRepo.save(config);
    }

    return {
      tableName,
      label: body.label,
      category: 'application',
      isSystem: false,
      columnCount: systemFieldConfigs.length,
    };
  }

  /**
   * DATABASE-FIRST: Add a new column to a table
   */
  @Post('tables/:tableName/fields')
  async createField(
    @Param('tableName') tableName: string,
    @Body() body: CreateFieldDto,
    @Req() req: any,
  ) {
    const ctx: RequestContext = req.context || req.user;
    await this.getTableAndEnsure(ctx, tableName);

    if (!body.label?.trim()) throw new BadRequestException('Field label is required');
    if (!body.code?.trim()) throw new BadRequestException('Field code is required');
    if (!body.type?.trim()) throw new BadRequestException('Field type is required');
    if (!/^[a-z][a-z0-9_]*$/.test(body.code)) {
      throw new BadRequestException('Field code must start with a letter and contain only lowercase letters, numbers, and underscores');
    }

    const ds = await this.tenantDb.getDataSource(ctx.tenantId);

    const existingColumn = await ds.query(`
      SELECT column_name FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = $1 AND column_name = $2
    `, [tableName, body.code]);

    if (existingColumn && existingColumn.length > 0) {
      throw new BadRequestException(`Column "${body.code}" already exists in table "${tableName}"`);
    }

    const sqlType = this.mapFieldTypeToSql(body.type);
    const nullableStr = body.required === true ? 'NOT NULL' : '';
    const uniqueStr = body.isUnique === true ? 'UNIQUE' : '';
    const defaultStr = body.defaultValue ? `DEFAULT '${body.defaultValue}'` : '';

    await ds.query(`ALTER TABLE ${tableName} ADD COLUMN "${body.code}" ${sqlType} ${nullableStr} ${uniqueStr} ${defaultStr}`.trim());

    const fieldUiConfigRepo = ds.getRepository(FieldUiConfig);
    const existingConfigs = await fieldUiConfigRepo.find({ where: { tableName } });
    const maxOrder = existingConfigs.reduce((max, c) => Math.max(max, c.displayOrder || 0), 0);

    const config = fieldUiConfigRepo.create({
      tableName,
      columnName: body.code,
      label: body.label,
      showInList: body.showInLists ?? true,
      showInForm: body.showInForms ?? true,
      isHidden: body.isInternal ?? false,
      displayOrder: maxOrder + 1,
      choices: body.config?.choices,
      referenceTable: body.config?.referenceTable,
      referenceDisplayField: body.config?.referenceDisplayField,
      createdBy: ctx.userId,
      updatedBy: ctx.userId,
    });
    await fieldUiConfigRepo.save(config);

    return {
      columnName: body.code,
      label: body.label,
      dataType: sqlType,
      isNullable: body.required !== true,
      showInList: body.showInLists ?? true,
      showInForm: body.showInForms ?? true,
      displayOrder: maxOrder + 1,
    };
  }

  private mapFieldTypeToSql(fieldType: string): string {
    const typeMap: Record<string, string> = {
      string: 'VARCHAR(255)',
      text: 'TEXT',
      integer: 'INTEGER',
      decimal: 'NUMERIC(19,4)',
      boolean: 'BOOLEAN',
      date: 'DATE',
      datetime: 'TIMESTAMPTZ',
      time: 'TIME',
      uuid: 'UUID',
      choice: 'VARCHAR(100)',
      multi_choice: 'JSONB',
      reference: 'UUID',
      multi_reference: 'JSONB',
      email: 'VARCHAR(320)',
      url: 'VARCHAR(2048)',
      phone: 'VARCHAR(50)',
      currency: 'NUMERIC(19,4)',
      percent: 'NUMERIC(10,4)',
      json: 'JSONB',
      tags: 'TEXT[]',
    };
    return typeMap[fieldType] || 'TEXT';
  }

  /**
   * DATABASE-FIRST: Hide a field (doesn't actually delete the column)
   */
  @Delete('tables/:tableName/fields/:columnName')
  async hideField(
    @Param('tableName') tableName: string,
    @Param('columnName') columnName: string,
    @Req() req: any,
  ) {
    const ctx: RequestContext = req.context || req.user;
    await this.getTableAndEnsure(ctx, tableName);

    const ds = await this.tenantDb.getDataSource(ctx.tenantId);

    const columnCheck = await ds.query(`
      SELECT column_name FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = $1 AND column_name = $2
    `, [tableName, columnName]);

    if (!columnCheck || columnCheck.length === 0) {
      throw new NotFoundException(`Column "${columnName}" not found in table "${tableName}"`);
    }

    // Instead of deleting, we hide the field
    const repo = ds.getRepository(FieldUiConfig);
    let config = await repo.findOne({ where: { tableName, columnName } });

    if (config) {
      config.isHidden = true;
      config.updatedBy = ctx.userId;
    } else {
      config = repo.create({
        tableName,
        columnName,
        label: this.formatColumnName(columnName),
        isHidden: true,
        createdBy: ctx.userId,
        updatedBy: ctx.userId,
      });
    }

    await repo.save(config);

    return { success: true, message: `Field "${columnName}" hidden` };
  }

  /**
   * Bulk update field UI configs
   */
  @Patch('tables/:tableName/fields/bulk')
  async bulkUpdateFields(
    @Param('tableName') tableName: string,
    @Body() body: BulkUpdateFieldsDto,
    @Req() req: any,
  ) {
    const ctx: RequestContext = req.context || req.user;
    await this.getTableAndEnsure(ctx, tableName);

    if (!body.fieldCodes || !Array.isArray(body.fieldCodes) || body.fieldCodes.length === 0) {
      throw new BadRequestException('fieldCodes is required and must be a non-empty array');
    }
    if (!body.property) {
      throw new BadRequestException('property is required');
    }

    const ds = await this.tenantDb.getDataSource(ctx.tenantId);
    const repo = ds.getRepository(FieldUiConfig);

    const allowedProperties = ['showInList', 'showInForm', 'isHidden', 'displayOrder'];
    if (!allowedProperties.includes(body.property)) {
      throw new BadRequestException(`Property "${body.property}" is not allowed for bulk update`);
    }

    const updated: string[] = [];
    const failed: string[] = [];

    for (const columnName of body.fieldCodes) {
      try {
        let config = await repo.findOne({ where: { tableName, columnName } });

        if (!config) {
          config = repo.create({
            tableName,
            columnName,
            label: this.formatColumnName(columnName),
            createdBy: ctx.userId,
          });
        }

        (config as any)[body.property] = body.value;
        config.updatedBy = ctx.userId;
        await repo.save(config);
        updated.push(columnName);
      } catch (err) {
        failed.push(columnName);
      }
    }

    return {
      updated: updated.length,
      failed: failed.length,
      updatedFields: updated,
      failedFields: failed,
    };
  }

  // ACL endpoints remain for now but use tableName directly
  @Get('tables/:tableName/acl')
  async getTableAcl(@Param('tableName') tableName: string, @Req() req: any) {
    const ctx: RequestContext = req.context || req.user;
    await this.getTableAndEnsure(ctx, tableName);

    const repo = await this.tenantDb.getRepository<TableAcl>(ctx.tenantId, TableAcl as any);
    const rows = await repo.find({
      where: [
        { tenantId: ctx.tenantId, tableName },
        { tenantId: undefined as any, tableName },
      ],
      order: { priority: 'ASC' },
    });

    const operations = rows.map((r) => ({
      operation: r.operation as any,
      requiredRoles: r.requiredRoles || [],
      requiredPermissions: [],
      hasAbacRules: !!r.conditionExpression,
    }));

    return { tableName, operations };
  }

  @Patch('tables/:tableName/acl')
  async updateTableAcl(
    @Param('tableName') tableName: string,
    @Body() body: { operations: AclPayload[]; acl?: AclPayload[] },
    @Req() req: any,
  ) {
    const ctx: RequestContext = req.context || req.user;
    await this.getTableAndEnsure(ctx, tableName);

    const repo = await this.tenantDb.getRepository<TableAcl>(ctx.tenantId, TableAcl as any);
    await repo.delete({ tenantId: ctx.tenantId, tableName });

    const payloads = body?.operations || body?.acl || [];
    if (payloads.length) {
      const entities = payloads.map((p) =>
        repo.create({
          ...(p as any),
          tenantId: ctx.tenantId,
          tableName,
          operation: p.operation || 'read',
          requiredPermissionId: p.requiredPermissionId ?? undefined,
          requiredRoles: p.requiredRoles ?? undefined,
          conditionExpression: p.conditionExpression ?? undefined,
          priority: p.priority ?? 100,
          isEnabled: p.isEnabled ?? true,
        }) as any,
      );
      await repo.save(entities as any);
    }

    return this.getTableAcl(tableName, req);
  }

  @Get('tables/:tableName/fields/:columnName/acl')
  async getFieldAcl(
    @Param('tableName') tableName: string,
    @Param('columnName') columnName: string,
    @Req() req: any,
  ) {
    const ctx: RequestContext = req.context || req.user;
    await this.getTableAndEnsure(ctx, tableName);

    const repo = await this.tenantDb.getRepository<FieldAcl>(ctx.tenantId, FieldAcl as any);
    const rows = await repo.find({
      where: [
        { tenantId: ctx.tenantId, tableName, fieldName: columnName },
        { tenantId: undefined as any, tableName, fieldName: columnName },
      ],
      order: { priority: 'ASC' },
    });

    const toRules = (operation: 'read' | 'write') =>
      rows
        .filter((r) => r.operation === operation)
        .flatMap((r) => (r.requiredRoles || []).map((role) => ({ role, access: 'VISIBLE' as const })));

    return {
      fieldCode: columnName,
      read: { mode: toRules('read').length ? 'CUSTOM' : 'INHERIT', rules: toRules('read') },
      write: { mode: toRules('write').length ? 'CUSTOM' : 'INHERIT', rules: toRules('write') },
    };
  }

  @Patch('tables/:tableName/fields/:columnName/acl')
  async updateFieldAcl(
    @Param('tableName') tableName: string,
    @Param('columnName') columnName: string,
    @Body() body: any,
    @Req() req: any,
  ) {
    const ctx: RequestContext = req.context || req.user;
    await this.getTableAndEnsure(ctx, tableName);

    const repo = await this.tenantDb.getRepository<FieldAcl>(ctx.tenantId, FieldAcl as any);
    await repo.delete({ tenantId: ctx.tenantId, tableName, fieldName: columnName });

    const readRules = body?.read?.rules || [];
    const writeRules = body?.write?.rules || [];

    const entities: FieldAcl[] = [];
    readRules.forEach((rule: any, idx: number) => {
      entities.push(
        repo.create({
          tenantId: ctx.tenantId,
          tableName,
          fieldName: columnName,
          operation: 'read',
          requiredRoles: rule.role ? [rule.role] : [],
          maskingStrategy: rule.access === 'MASK_FULL' ? 'FULL' : rule.access === 'MASK_PARTIAL' ? 'PARTIAL' : 'NONE',
          priority: 100 + idx,
          isEnabled: true,
        }),
      );
    });

    writeRules.forEach((rule: any, idx: number) => {
      entities.push(
        repo.create({
          tenantId: ctx.tenantId,
          tableName,
          fieldName: columnName,
          operation: 'write',
          requiredRoles: rule.role ? [rule.role] : [],
          maskingStrategy: 'NONE',
          priority: 200 + idx,
          isEnabled: true,
        }),
      );
    });

    if (entities.length) {
      await repo.save(entities);
    }

    return this.getFieldAcl(tableName, columnName, req);
  }

  @Get('abac-policies')
  async listAbacPolicies(
    @Query('tableName') tableName: string,
    @Query('resourceType') resourceType: string,
    @Req() req: any,
  ) {
    const ctx: RequestContext = req.context || req.user;
    const repo = await this.tenantDb.getRepository<AbacPolicy>(ctx.tenantId, AbacPolicy as any);

    const where: any = { tenantId: ctx.tenantId };
    if (tableName) where.resource = tableName;
    if (resourceType) where.resourceType = resourceType;

    return repo.find({ where, order: { priority: 'ASC' } });
  }

  @Post('abac-policies')
  async createAbacPolicy(@Body() body: Partial<AbacPolicy>, @Req() req: any) {
    const ctx: RequestContext = req.context || req.user;
    const repo = await this.tenantDb.getRepository<AbacPolicy>(ctx.tenantId, AbacPolicy as any);

    const entity = repo.create({
      tenantId: ctx.tenantId,
      name: body.name,
      description: body.description,
      subjectFilter: body.subjectFilter ?? {},
      resourceType: body.resourceType ?? 'table',
      resource: body.resource,
      action: this.normalizePolicyAction(body.action) ?? 'read',
      condition: body.condition ?? {},
      effect: body.effect ?? 'ALLOW',
      priority: body.priority ?? 100,
      isEnabled: body.isEnabled ?? true,
    });

    return repo.save(entity);
  }

  @Patch('abac-policies/:id')
  async updateAbacPolicy(
    @Param('id') id: string,
    @Body() body: Partial<AbacPolicy>,
    @Req() req: any,
  ) {
    const ctx: RequestContext = req.context || req.user;
    const repo = await this.tenantDb.getRepository<AbacPolicy>(ctx.tenantId, AbacPolicy as any);

    const existing = await repo.findOne({ where: { id, tenantId: ctx.tenantId } });
    if (!existing) throw new NotFoundException('Policy not found');

    const updated = repo.merge(existing, {
      name: body.name ?? existing.name,
      description: body.description ?? existing.description,
      subjectFilter: body.subjectFilter ?? existing.subjectFilter,
      resourceType: body.resourceType ?? existing.resourceType,
      resource: body.resource ?? existing.resource,
      action: this.normalizePolicyAction(body.action) ?? existing.action,
      condition: body.condition ?? existing.condition,
      effect: body.effect ?? existing.effect,
      priority: body.priority ?? existing.priority,
      isEnabled: body.isEnabled ?? existing.isEnabled,
    });

    return repo.save(updated);
  }
}
