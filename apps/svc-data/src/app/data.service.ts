import { Injectable, BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { AuthorizationService, AuthorizedPropertyMeta } from '@hubblewave/authorization';
import { RequestContext } from '@hubblewave/auth-guard';
import { ListRecordsDto, PAGINATION_CONSTANTS, BULK_OPERATION_CONSTANTS } from '@hubblewave/shared-types';
import { ModelRegistryService } from './model-registry.service';


@Injectable()
export class DataService {
  constructor(
    private readonly modelRegistry: ModelRegistryService,
    private readonly dataSource: DataSource,
    private readonly authz: AuthorizationService,
  ) {}

  private ensureSafeIdentifier(value: string, label: string) {
    if (!value || !/^[A-Za-z_][A-Za-z0-9_]*$/.test(value)) {
      throw new BadRequestException(`Invalid ${label} name`);
    }
    return value;
  }

  /**
   * Returns quoted schema.table for use in raw SQL queries
   */
  private buildPhysicalTableRaw(table: { storageSchema: string; storageTable: string }) {
    const schema = this.ensureSafeIdentifier(table.storageSchema, 'schema');
    const name = this.ensureSafeIdentifier(table.storageTable, 'table');
    return `"${schema}"."${name}"`;
  }

  /**
   * Returns unquoted schema.table for use with TypeORM query builder
   * TypeORM will add its own quotes around the table name
   */
  private buildPhysicalTableForQb(table: { storageSchema: string; storageTable: string }) {
    const schema = this.ensureSafeIdentifier(table.storageSchema, 'schema');
    const name = this.ensureSafeIdentifier(table.storageTable, 'table');
    return `${schema}.${name}`;
  }

  private parseStoragePath(storagePath: string) {
    if (!storagePath) {
      throw new BadRequestException('Unsupported storage path');
    }
    if (!storagePath.includes(':')) {
      const col = storagePath;
      this.ensureSafeIdentifier(col, 'column');
      return { type: 'column' as const, column: col };
    }
    if (storagePath.startsWith('column:')) {
      const col = storagePath.split(':')[1];
      this.ensureSafeIdentifier(col, 'column');
      return { type: 'column' as const, column: col };
    }
    if (storagePath.startsWith('json:')) {
      const parts = storagePath.split(':')[1].split('.');
      if (parts.length !== 2) {
        throw new BadRequestException('Invalid json storage path');
      }
      const [col, path] = parts;
      this.ensureSafeIdentifier(col, 'column');
      if (!/^[A-Za-z0-9_]+$/.test(path)) {
        throw new BadRequestException('Invalid json path');
      }
      return { type: 'json' as const, column: col, path };
    }
    throw new BadRequestException('Unsupported storage path');
  }

  private buildAbacParams(ctx: RequestContext) {
    return {
      userId: ctx.userId,
      roles: ctx.roles,
      groups: ctx.attributes?.groups ?? [],
      sites: ctx.attributes?.sites ?? [],
    };
  }

  // List records with pagination
  async list(ctx: RequestContext, collectionCode: string, query?: ListRecordsDto) {
    const page = query?.page ?? PAGINATION_CONSTANTS.DEFAULT_PAGE;
    const limit = Math.min(
      query?.limit ?? PAGINATION_CONSTANTS.DEFAULT_PAGE_SIZE,
      PAGINATION_CONSTANTS.MAX_PAGE_SIZE
    );
    const skip = (page - 1) * limit;

    const model = await this.modelRegistry.getCollection(collectionCode);
    await this.authz.ensureTableAccess(ctx, model.storageTable, 'read');

    const allProperties = await this.modelRegistry.getProperties(collectionCode, ctx.roles);
    const readableProperties = await this.authz.filterReadableFields(ctx, model.storageTable, allProperties);
    if (!readableProperties.length) {
      throw new ForbiddenException('No readable properties on this collection');
    }

    const selectParts = ['t.id', 't.created_at', 't.updated_at'];
    readableProperties.forEach((p) => {
      if (!p.storagePath) return;
      const parsed = this.parseStoragePath(p.storagePath);
      if (parsed.type === 'column') {
        selectParts.push(`t."${parsed.column}" AS "${p.code}"`);
      } else if (parsed.type === 'json') {
        selectParts.push(`t."${parsed.column}"->>'${parsed.path}' AS "${p.code}"`);
      }
    });

    // SECURITY: Use safe parameterized row-level security predicates
    const { clauses: rlsClauses, params: rlsParams } = await this.authz.buildRowLevelClause(ctx, model.storageTable, 'read', 't');
    const ds = this.dataSource;

    // Build count query with safe parameterized RLS
    const countQb = ds.createQueryBuilder().select('COUNT(*)', 'total').from(this.buildPhysicalTableForQb(model), 't');
    rlsClauses.forEach((clause) => countQb.andWhere(clause));
    countQb.setParameters({ ...this.buildAbacParams(ctx), ...rlsParams });
    const countResult = await countQb.getRawOne();
    const total = parseInt(countResult?.total || '0', 10);

    // Build data query with pagination and safe parameterized RLS
    const qb = ds.createQueryBuilder().select(selectParts).from(this.buildPhysicalTableForQb(model), 't');
    rlsClauses.forEach((clause) => qb.andWhere(clause));
    qb.setParameters({ ...this.buildAbacParams(ctx), ...rlsParams });

    // Apply sorting
    const sortBy = query?.sortBy || 'created_at';
    const sortOrder = query?.sortOrder || 'DESC';
    if (readableProperties.some(p => p.code === sortBy) || ['id', 'created_at', 'updated_at'].includes(sortBy)) {
      qb.orderBy(`t."${this.ensureSafeIdentifier(sortBy, 'sort property')}"`, sortOrder);
    } else {
      qb.orderBy('t."created_at"', 'DESC');
    }

    // Apply pagination
    qb.offset(skip).limit(limit);

    const rows = await qb.getRawMany();
    const masked = await Promise.all(rows.map((row: unknown) => this.authz.maskRecord(ctx, model.storageTable, row as Record<string, unknown>, readableProperties as AuthorizedPropertyMeta[])));

    return {
      data: masked,
      properties: readableProperties,
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  // Get single record
  async getOne(ctx: RequestContext, collectionCode: string, id: string) {
    const model = await this.modelRegistry.getCollection(collectionCode);
    await this.authz.ensureTableAccess(ctx, model.storageTable, 'read');

    const allProperties = await this.modelRegistry.getProperties(collectionCode, ctx.roles);
    const readableProperties = await this.authz.filterReadableFields(ctx, model.storageTable, allProperties);
    if (!readableProperties.length) {
      throw new ForbiddenException('No readable properties on this collection');
    }

    const selectParts = ['t.id', 't.created_at', 't.updated_at'];
    readableProperties.forEach((p) => {
      if (!p.storagePath) return;
      const parsed = this.parseStoragePath(p.storagePath);
      if (parsed.type === 'column') {
        selectParts.push(`t."${parsed.column}" AS "${p.code}"`);
      } else if (parsed.type === 'json') {
        selectParts.push(`t."${parsed.column}"->>'${parsed.path}' AS "${p.code}"`);
      }
    });

    // SECURITY: Use safe parameterized row-level security predicates
    const { clauses: rlsClauses, params: rlsParams } = await this.authz.buildRowLevelClause(ctx, model.storageTable, 'read', 't');
    const ds = this.dataSource;
    const qb = ds.createQueryBuilder().select(selectParts).from(this.buildPhysicalTableForQb(model), 't');
    qb.where('t.id = :id', { id });
    rlsClauses.forEach((clause) => qb.andWhere(clause));
    qb.setParameters({ ...this.buildAbacParams(ctx), ...rlsParams });

    const result = await qb.getRawMany();
    if (!result[0]) throw new NotFoundException();

    return {
      record: await this.authz.maskRecord(ctx, model.storageTable, result[0], readableProperties as AuthorizedPropertyMeta[]),
      properties: readableProperties,
    };
  }

  // Create record
  async create(ctx: RequestContext, collectionCode: string, payload: Record<string, any>) {
    const model = await this.modelRegistry.getCollection(collectionCode);
    await this.authz.ensureTableAccess(ctx, model.storageTable, 'create');

    const allProperties = await this.modelRegistry.getProperties(collectionCode, ctx.roles);
    const writableProperties = await this.authz.filterWritableFields(ctx, model.storageTable, allProperties);
    const allowedPropertyCodes = new Set(writableProperties.map((p) => p.code));

    const columns: string[] = [];
    const values: string[] = [];
    const params: any[] = [];
    let paramIdx = 1;
    const jsonUpdates: Record<string, any> = {};

    for (const [key, value] of Object.entries(payload)) {
      if (!allowedPropertyCodes.has(key)) continue;
      const property = allProperties.find((p) => p.code === key);
      if (!property) continue;
      const parsed = this.parseStoragePath(property.storagePath);
      if (parsed.type === 'column') {
        columns.push(`"${parsed.column}"`);
        values.push(`$${paramIdx++}`);
        params.push(value);
      } else if (parsed.type === 'json') {
        if (!jsonUpdates[parsed.column]) jsonUpdates[parsed.column] = {};
        jsonUpdates[parsed.column][parsed.path] = value;
      }
    }

    for (const [col, jsonObj] of Object.entries(jsonUpdates)) {
      columns.push(`"${col}"`);
      values.push(`$${paramIdx++}`);
      params.push(JSON.stringify(jsonObj));
    }

    if (columns.length === 0) {
      throw new ForbiddenException('No writable properties in payload');
    }

    const physicalTable = this.buildPhysicalTableRaw(model);
    const sql = `INSERT INTO ${physicalTable} (${columns.join(', ')}) VALUES (${values.join(', ')}) RETURNING id`;
    const ds = this.dataSource;
    const result = await ds.query(sql, params);
    return this.getOne(ctx, collectionCode, result[0].id);
  }

  // Update record
  async update(ctx: RequestContext, collectionCode: string, id: string, payload: Record<string, any>) {
    const model = await this.modelRegistry.getCollection(collectionCode);
    await this.authz.ensureTableAccess(ctx, model.storageTable, 'update');

    const allProperties = await this.modelRegistry.getProperties(collectionCode, ctx.roles);
    const writableProperties = await this.authz.filterWritableFields(ctx, model.storageTable, allProperties);
    const allowedPropertyCodes = new Set(writableProperties.map((p) => p.code));

    const ds = this.dataSource;

    // SECURITY: Use TypeORM query builder for safe parameterized updates
    const qb = ds.createQueryBuilder()
      .update(this.buildPhysicalTableForQb(model))
      .where('id = :id', { id });

    const updateValues: Record<string, any> = {};
    const jsonUpdates: Record<string, any> = {};

    for (const [key, value] of Object.entries(payload)) {
      if (!allowedPropertyCodes.has(key)) continue;
      const property = allProperties.find((p) => p.code === key);
      if (!property) continue;
      const parsed = this.parseStoragePath(property.storagePath);
      if (parsed.type === 'column') {
        updateValues[parsed.column] = value;
      } else if (parsed.type === 'json') {
        if (!jsonUpdates[parsed.column]) jsonUpdates[parsed.column] = {};
        jsonUpdates[parsed.column][parsed.path] = value;
      }
    }

    for (const [col, jsonObj] of Object.entries(jsonUpdates)) {
      updateValues[col] = JSON.stringify(jsonObj);
    }

    if (Object.keys(updateValues).length === 0) {
      throw new BadRequestException('No valid properties provided to update');
    }

    qb.set(updateValues);

    // SECURITY: Apply safe parameterized row-level security predicates
    const { clauses: rlsClauses, params: rlsParams } = await this.authz.buildRowLevelClause(ctx, model.storageTable, 'update', this.buildPhysicalTableForQb(model));
    rlsClauses.forEach((clause) => qb.andWhere(clause));
    qb.setParameters({ ...this.buildAbacParams(ctx), ...rlsParams });

    const result = await qb.execute();
    if (result.affected === 0) throw new NotFoundException();
    return this.getOne(ctx, collectionCode, id);
  }

  // Delete record
  async delete(ctx: RequestContext, collectionCode: string, id: string) {
    const model = await this.modelRegistry.getCollection(collectionCode);
    await this.authz.ensureTableAccess(ctx, model.storageTable, 'delete');

    const ds = this.dataSource;

    // SECURITY: Use TypeORM query builder for safe parameterized deletes
    const qb = ds.createQueryBuilder()
      .delete()
      .from(this.buildPhysicalTableForQb(model))
      .where('id = :id', { id });

    // SECURITY: Apply safe parameterized row-level security predicates
    const { clauses: rlsClauses, params: rlsParams } = await this.authz.buildRowLevelClause(ctx, model.storageTable, 'delete', this.buildPhysicalTableForQb(model));
    rlsClauses.forEach((clause) => qb.andWhere(clause));
    qb.setParameters({ ...this.buildAbacParams(ctx), ...rlsParams });

    const result = await qb.execute();
    if (result.affected === 0) throw new NotFoundException();
    return { success: true };
  }

  // Bulk update multiple records
  async bulkUpdate(
    ctx: RequestContext,
    collectionCode: string,
    ids: (string | number)[],
    payload: Record<string, any>
  ) {
    if (!ids.length) {
      throw new BadRequestException('No IDs provided for bulk update');
    }
    if (ids.length > BULK_OPERATION_CONSTANTS.MAX_BULK_UPDATE_SIZE) {
      throw new BadRequestException(
        `Bulk update limited to ${BULK_OPERATION_CONSTANTS.MAX_BULK_UPDATE_SIZE} records. Use pagination for larger operations.`
      );
    }

    const model = await this.modelRegistry.getCollection(collectionCode);
    await this.authz.ensureTableAccess(ctx, model.storageTable, 'update');

    const allProperties = await this.modelRegistry.getProperties(collectionCode, ctx.roles);
    const writableProperties = await this.authz.filterWritableFields(ctx, model.storageTable, allProperties);
    const allowedPropertyCodes = new Set(writableProperties.map((p) => p.code));

    const ds = this.dataSource;

    // SECURITY: Use TypeORM query builder for safe parameterized bulk updates
    const qb = ds.createQueryBuilder()
      .update(this.buildPhysicalTableForQb(model))
      .whereInIds(ids);

    const updateValues: Record<string, any> = {};
    const jsonUpdates: Record<string, any> = {};

    for (const [key, value] of Object.entries(payload)) {
      if (!allowedPropertyCodes.has(key)) continue;
      const property = allProperties.find((p) => p.code === key);
      if (!property) continue;
      const parsed = this.parseStoragePath(property.storagePath);
      if (parsed.type === 'column') {
        updateValues[parsed.column] = value;
      } else if (parsed.type === 'json') {
        if (!jsonUpdates[parsed.column]) jsonUpdates[parsed.column] = {};
        jsonUpdates[parsed.column][parsed.path] = value;
      }
    }

    // Add JSON column updates
    for (const [col, jsonObj] of Object.entries(jsonUpdates)) {
      updateValues[col] = JSON.stringify(jsonObj);
    }

    if (Object.keys(updateValues).length === 0) {
      throw new BadRequestException('No valid properties provided to update');
    }

    // Add updated_at timestamp
    updateValues['updated_at'] = () => 'NOW()';

    qb.set(updateValues);

    // SECURITY: Apply safe parameterized row-level security predicates
    const { clauses: rlsClauses, params: rlsParams } = await this.authz.buildRowLevelClause(ctx, model.storageTable, 'update', this.buildPhysicalTableForQb(model));
    rlsClauses.forEach((clause) => qb.andWhere(clause));
    qb.setParameters({ ...this.buildAbacParams(ctx), ...rlsParams });

    const result = await qb.execute();

    return {
      success: true,
      updatedCount: result.affected || 0,
      requestedCount: ids.length,
    };
  }

  // Bulk delete multiple records
  async bulkDelete(ctx: RequestContext, collectionCode: string, ids: (string | number)[]) {
    if (!ids.length) {
      throw new BadRequestException('No IDs provided for bulk delete');
    }
    if (ids.length > BULK_OPERATION_CONSTANTS.MAX_BULK_DELETE_SIZE) {
      throw new BadRequestException(
        `Bulk delete limited to ${BULK_OPERATION_CONSTANTS.MAX_BULK_DELETE_SIZE} records. Use pagination for larger operations.`
      );
    }

    const model = await this.modelRegistry.getCollection(collectionCode);
    await this.authz.ensureTableAccess(ctx, model.storageTable, 'delete');

    const ds = this.dataSource;

    // SECURITY: Use TypeORM query builder for safe parameterized bulk deletes
    const qb = ds.createQueryBuilder()
      .delete()
      .from(this.buildPhysicalTableForQb(model))
      .whereInIds(ids);

    // SECURITY: Apply safe parameterized row-level security predicates
    const { clauses: rlsClauses, params: rlsParams } = await this.authz.buildRowLevelClause(ctx, model.storageTable, 'delete', this.buildPhysicalTableForQb(model));
    rlsClauses.forEach((clause) => qb.andWhere(clause));
    qb.setParameters({ ...this.buildAbacParams(ctx), ...rlsParams });

    const result = await qb.execute();

    return {
      success: true,
      deletedCount: result.affected || 0,
      requestedCount: ids.length,
    };
  }
}

