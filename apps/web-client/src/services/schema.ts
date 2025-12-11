import { FieldDefinition } from '@eam-platform/shared-types';
import metadataApi from './metadataApi';

// New database-first table info structure
export interface TableDefinition {
  tableName: string;
  label: string;
  category: string;
  isSystem: boolean;
  isHidden: boolean;
  columnCount: number;
  description?: string;
  icon?: string;
  // Legacy compatibility fields
  id?: string;
  displayName?: string;
  fields?: FieldDefinition[];
}

// Response from GET /studio/tables
export interface TablesResponse {
  items: TableDefinition[];
  categories: string[];
  total: number;
  filtered: number;
}

// Column info from information_schema
export interface ColumnInfo {
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

// Response from GET /studio/tables/:tableName/fields
export interface FieldsResponse {
  tableName: string;
  items: ColumnInfo[];
  total: number;
  filtered: number;
}

// Create table DTO
export interface CreateTableDto {
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

// Create field DTO
export interface CreateFieldDto {
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

export const schemaService = {
  // Get all tables from information_schema
  getTables: async (includeHidden = false, category?: string): Promise<TableDefinition[]> => {
    const params = new URLSearchParams();
    if (includeHidden) params.append('includeHidden', 'true');
    if (category) params.append('category', category);

    const response = await metadataApi.get<TablesResponse>(`/studio/tables?${params.toString()}`);
    return response.data.items;
  },

  // Get tables with full response including categories
  getTablesWithMeta: async (includeHidden = false, category?: string): Promise<TablesResponse> => {
    const params = new URLSearchParams();
    if (includeHidden) params.append('includeHidden', 'true');
    if (category) params.append('category', category);

    const response = await metadataApi.get<TablesResponse>(`/studio/tables?${params.toString()}`);
    return response.data;
  },

  // Get table fields from information_schema
  getTable: async (tableName: string, includeHidden = false): Promise<TableDefinition & { fields: ColumnInfo[] }> => {
    const params = includeHidden ? '?includeHidden=true' : '';
    const response = await metadataApi.get<FieldsResponse>(`/studio/tables/${tableName}/fields${params}`);

    // Convert ColumnInfo to FieldDefinition-like structure for compatibility
    const fields = response.data.items.map(col => ({
      ...col,
      name: col.columnName,
      type: col.dataType,
      required: !col.isNullable,
    }));

    return {
      tableName: response.data.tableName,
      label: tableName, // Will be populated from table list if needed
      category: 'application',
      isSystem: false,
      isHidden: false,
      columnCount: response.data.total,
      fields: fields as any,
    };
  },

  // Get just the fields for a table
  getTableFields: async (tableName: string, includeHidden = false): Promise<FieldsResponse> => {
    const params = includeHidden ? '?includeHidden=true' : '';
    const response = await metadataApi.get<FieldsResponse>(`/studio/tables/${tableName}/fields${params}`);
    return response.data;
  },

  // Create a new table
  createTable: async (data: CreateTableDto): Promise<TableDefinition> => {
    const response = await metadataApi.post<TableDefinition>('/studio/tables', data);
    return response.data;
  },

  // Add a field to a table
  createField: async (tableName: string, data: CreateFieldDto): Promise<ColumnInfo> => {
    const response = await metadataApi.post<ColumnInfo>(`/studio/tables/${tableName}/fields`, data);
    return response.data;
  },

  // Update table UI config
  updateTableConfig: async (tableName: string, config: Partial<TableDefinition>): Promise<TableDefinition> => {
    const response = await metadataApi.patch<TableDefinition>(`/studio/tables/${tableName}/config`, config);
    return response.data;
  },

  // Update field UI config
  updateFieldConfig: async (tableName: string, columnName: string, config: Partial<ColumnInfo>): Promise<ColumnInfo> => {
    const response = await metadataApi.patch<ColumnInfo>(`/studio/tables/${tableName}/fields/${columnName}/config`, config);
    return response.data;
  },

  // Bulk update fields
  bulkUpdateFields: async (tableName: string, fieldCodes: string[], property: string, value: any) => {
    const response = await metadataApi.patch(`/studio/tables/${tableName}/fields/bulk`, {
      fieldCodes,
      property,
      value,
    });
    return response.data;
  },

  // Hide a field (soft delete)
  hideField: async (tableName: string, columnName: string) => {
    const response = await metadataApi.delete(`/studio/tables/${tableName}/fields/${columnName}`);
    return response.data;
  },
};
