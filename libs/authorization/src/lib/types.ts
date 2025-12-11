export type TableOperation = 'create' | 'read' | 'update' | 'delete';
export type FieldOperation = 'read' | 'write';

export type MaskingStrategy = 'NONE' | 'PARTIAL' | 'FULL';

export interface FieldMeta {
  code: string;
  label?: string;
  type?: string;
  isSystem?: boolean;
  isInternal?: boolean;
  showInForms?: boolean;
  showInLists?: boolean;
  storagePath?: string;
  validators?: Record<string, any>;
}

export interface AuthorizedFieldMeta extends FieldMeta {
  canRead: boolean;
  canWrite: boolean;
  maskingStrategy: MaskingStrategy;
}
