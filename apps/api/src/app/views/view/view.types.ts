import type { DisplayAction, ViewKind, ViewScope } from '@hubblewave/instance-db';

export type ViewResolveInput = {
  route?: string;
  kind: ViewKind;
  collection?: string;
  /**
   * Optional view code to pin the resolution to a specific
   * authored view. The Workspace RecordDetailPanel passes its
   * configured `formCode` through here so the panel renders the
   * named form rather than the default-resolved one. When omitted,
   * scope/priority resolution picks the best match for the actor.
   */
  code?: string;
};

export type ViewContext = {
  userId: string;
  roleCodes: string[];
  groups: string[];
};

export type FieldPermission = {
  canRead: boolean;
  canWrite: boolean;
  maskingStrategy: 'NONE' | 'PARTIAL' | 'FULL';
};

/**
 * DisplayRule projection returned alongside a resolved view. Only
 * published, active rules for the collection are included — drafts
 * stay invisible to runtime callers per the publish lifecycle. The
 * frontend feeds these into composeDisplay() to derive show/hide,
 * mandatory/readonly, and setValue effects per record state.
 */
export type ResolvedDisplayRule = {
  id: string;
  name: string;
  priority: number;
  isActive: boolean;
  condition: Record<string, unknown>;
  actions: DisplayAction[];
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
  /** Published Display Rules scoped to this view's targetCollection. */
  displayRules: ResolvedDisplayRule[];
  publishedAt?: Date | null;
  resolvedAt: Date;
};
