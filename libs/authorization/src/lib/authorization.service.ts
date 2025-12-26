import { Injectable } from '@nestjs/common';
import { RequestContext } from '@hubblewave/auth-guard';
import { AuthorizedFieldMeta, FieldMeta, TableOperation } from './types';

export interface RowLevelClause {
  clauses: string[];
  params: Record<string, unknown>;
}

@Injectable()
export class AuthorizationService {
  constructor() {}

  async getSafeRowLevelPredicates(_ctx: RequestContext, _tableName: string, _operation: TableOperation) {
    return [];
  }

  async ensureTableAccess(_ctx: RequestContext, _tableName: string, _operation: TableOperation): Promise<void> {
    return;
  }

  async canAccessTable(_ctx: RequestContext, _tableName: string, _operation: TableOperation): Promise<boolean> {
    return true;
  }

  async getAuthorizedFields(
    _ctx: RequestContext,
    _tableName: string,
    fields: FieldMeta[],
  ): Promise<AuthorizedFieldMeta[]> {
    return fields.map((field) => ({
      ...field,
      canRead: true,
      canWrite: true,
      maskingStrategy: 'NONE',
    }));
  }

  /**
   * Filter fields to only those readable by the user
   * Stub implementation - returns all fields as readable
   */
  async filterReadableFields(
    _ctx: RequestContext,
    _tableName: string,
    fields: FieldMeta[],
  ): Promise<AuthorizedFieldMeta[]> {
    return fields.map((field) => ({
      ...field,
      canRead: true,
      canWrite: true,
      maskingStrategy: 'NONE' as const,
    }));
  }

  /**
   * Filter fields to only those writable by the user
   * Stub implementation - returns all fields as writable
   */
  async filterWritableFields(
    _ctx: RequestContext,
    _tableName: string,
    fields: FieldMeta[],
  ): Promise<AuthorizedFieldMeta[]> {
    return fields.map((field) => ({
      ...field,
      canRead: true,
      canWrite: true,
      maskingStrategy: 'NONE' as const,
    }));
  }

  /**
   * Build row-level security clauses for a query
   * Stub implementation - returns empty clauses (no restrictions)
   */
  async buildRowLevelClause(
    _ctx: RequestContext,
    _tableName: string,
    _operation: TableOperation,
    _tableAlias?: string,
  ): Promise<RowLevelClause> {
    return {
      clauses: [],
      params: {},
    };
  }

  /**
   * Apply field masking to a record based on authorization
   * Stub implementation - returns record as-is (no masking)
   */
  async maskRecord(
    _ctx: RequestContext,
    _tableName: string,
    record: Record<string, unknown>,
    _fields: AuthorizedFieldMeta[],
  ): Promise<Record<string, unknown>> {
    return record;
  }
}
