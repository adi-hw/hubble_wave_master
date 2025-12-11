export type MaskingStrategy = 'NONE' | 'PARTIAL' | 'FULL';

export interface AuthorizedFieldMeta {
  code: string;
  label: string;
  type: string;
  isSystem: boolean;
  isInternal: boolean;
  showInForms: boolean;
  showInLists: boolean;
  canRead: boolean;
  canWrite: boolean;
  maskingStrategy: MaskingStrategy;
  nullable?: boolean;
  isUnique?: boolean;
  defaultValue?: string;
  config?: Record<string, unknown>;
}

export interface TableMeta {
  table: {
    code: string;
    dbTableName: string;
    label: string;
  };
  fields: AuthorizedFieldMeta[];
}
