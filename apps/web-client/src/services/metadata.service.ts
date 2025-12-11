import api from './metadataApi';

export interface FieldDefinition {
  name: string;
  type: string;
  required?: boolean;
  [key: string]: any;
}

export interface TableDefinition {
  id: string;
  tableName: string;
  displayName: string;
  description?: string;
  category?: string;
  storageTable?: string;
  storageSchema?: string;
  flags?: Record<string, any>;
  fields?: FieldDefinition[];
  createdAt: string; // or Date, depending on backend; we'll treat as string in frontend
  updatedAt?: string;
}

/**
 * Fetch all tables for the current tenant.
 */
export const getTables = async (): Promise<TableDefinition[]> => {
  const response = await api.get<TableDefinition[]>('/tables');
  return response.data;
};

/**
 * Create a new table with fields.
 */
export const createTable = async (
  tableName: string,
  displayName: string,
  fields: FieldDefinition[]
): Promise<TableDefinition> => {
  const response = await api.post<TableDefinition>('/tables', {
    name: tableName,
    tableName,
    displayName,
    fields,
  });
  return response.data;
};
