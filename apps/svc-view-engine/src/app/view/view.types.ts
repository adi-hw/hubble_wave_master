import type { ViewKind, ViewScope } from '@hubblewave/instance-db';

export type ViewResolveInput = {
  route?: string;
  kind: ViewKind;
  collection?: string;
};

export type ViewContext = {
  userId: string;
  roles: string[];
  groups: string[];
};

export type FieldPermission = {
  canRead: boolean;
  canWrite: boolean;
  maskingStrategy: 'NONE' | 'PARTIAL' | 'FULL';
};

export type ResolvedView = {
  definitionId: string;
  viewCode: string;
  name: string;
  description?: string | null;
  kind: ViewKind;
  targetCollectionCode?: string | null;
  revisionId: string;
  revision: number;
  scope: ViewScope;
  scopeKey?: string | null;
  priority: number;
  layout: Record<string, unknown>;
  fieldPermissions?: Record<string, FieldPermission>;
  widgetBindings: Record<string, unknown>;
  actions: Record<string, unknown>;
  publishedAt?: Date | null;
  resolvedAt: Date;
};
