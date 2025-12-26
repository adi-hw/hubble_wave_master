import { Injectable } from '@nestjs/common';

export interface StorageTypeConfig {
  storageType: string;
  defaultWidget: string;
  supportsUnique: boolean;
  supportsPattern?: boolean;
  supportsMinMax?: boolean;
  requiresChoices?: boolean;
  requiresReference?: boolean;
}

export interface AddColumnResult {
  success: boolean;
  columnName: string;
  columnType: string;
  indexCreated: boolean;
  error?: string;
}

@Injectable()
export class PropertyStorageService {
  getTypeConfig(_dataType: any): StorageTypeConfig {
    return { storageType: 'TEXT', defaultWidget: 'input', supportsUnique: false };
  }

  getStorageType(_dataType: any): string {
    return 'TEXT';
  }

  getDefaultWidget(_dataType: any): string {
    return 'input';
  }

  toColumnName(propertyCode: string): string {
    const safe = propertyCode.toLowerCase().replace(/[^a-z0-9_]/g, '_');
    return `p_${safe}`.substring(0, 63);
  }

  async addColumn(
    _queryRunner: any,
    _schema: string,
    _tableName: string,
    columnName: string,
    _dataType: any,
    _options: {
      isRequired?: boolean;
      isUnique?: boolean;
      defaultValue?: string;
    } = {},
  ): Promise<AddColumnResult> {
    return {
      success: true,
      columnName,
      columnType: 'TEXT',
      indexCreated: false,
    };
  }

  async dropColumn(
    _queryRunner: any,
    _schema: string,
    _tableName: string,
    _columnName: string,
  ): Promise<boolean> {
    return true;
  }

  async addUniqueIndex(
    _queryRunner: any,
    _schema: string,
    _tableName: string,
    columnName: string,
  ): Promise<{ success: boolean; indexName?: string; error?: string }> {
    return { success: true, indexName: `idx_${columnName}`.substring(0, 63) };
  }

  async dropUniqueIndex(
    _queryRunner: any,
    _schema: string,
    _tableName: string,
    _columnName: string,
  ): Promise<boolean> {
    return true;
  }

  async checkForDuplicates(
    _queryRunner: any,
    _schema: string,
    _tableName: string,
    _columnName: string,
  ): Promise<{ count: number; examples: string[] }> {
    return { count: 0, examples: [] };
  }

  async checkForNulls(
    _queryRunner: any,
    _schema: string,
    _tableName: string,
    _columnName: string,
  ): Promise<number> {
    return 0;
  }
}

