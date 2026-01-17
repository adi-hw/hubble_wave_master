/**
 * Admin Configuration Console Types
 * These types mirror the backend entities and API responses
 */

// ========== Config Types ==========

export type ConfigType =
  | 'collection'
  | 'property'
  | 'access_rule'
  | 'process_flow'
  | 'script'
  | 'approval'
  | 'notification'
  | 'event'
  | 'automation_rule';

export type CustomizationType = 'override' | 'extend' | 'new';

export type ChangeType = 'create' | 'update' | 'delete' | 'restore' | 'rollback';

export type ChangeSource = 'admin_console' | 'api' | 'upgrade' | 'import' | 'migration' | 'system';

export type ImpactSeverity = 'none' | 'low' | 'medium' | 'high' | 'critical';

export type ImpactStatus = 'pending_analysis' | 'analyzed' | 'resolved' | 'acknowledged' | 'auto_resolved';

export type ResolutionStrategy = 'auto_merge' | 'manual_review' | 'keep_instance' | 'use_platform' | 'custom_merge';

// ========== Platform Config ==========

export interface PlatformConfig {
  id: string;
  configType: ConfigType;
  resourceKey: string;
  configData: Record<string, any>;
  platformVersion: string;
  schemaVersion: number;
  checksum: string;
  description?: string;
  createdAt: string;
}

// ========== Instance Customization ==========

export interface InstanceCustomization {
  id: string;
  instanceId: string;
  configType: ConfigType;
  resourceKey: string;
  customizationType: CustomizationType;
  basePlatformVersion?: string;
  baseConfigChecksum?: string;
  customConfig: Record<string, any>;
  diffFromBase?: JsonPatchOperation[];
  isActive: boolean;
  createdBy?: string;
  createdAt: string;
  updatedBy?: string;
  updatedAt: string;
  version: number;
  previousVersionId?: string;
}

export interface CreateCustomizationDto {
  configType: ConfigType;
  resourceKey: string;
  customizationType: CustomizationType;
  customConfig: Record<string, any>;
  basePlatformVersion?: string;
}

export interface UpdateCustomizationDto {
  customizationType?: CustomizationType;
  customConfig?: Record<string, any>;
  basePlatformVersion?: string;
}

// ========== Config Change History ==========

export interface ConfigChangeHistory {
  id: string;
  instanceId?: string;
  configType: ConfigType;
  resourceKey: string;
  changeType: ChangeType;
  previousValue?: Record<string, any>;
  newValue?: Record<string, any>;
  diff?: JsonPatchOperation[];
  changeReason?: string;
  changeSource: ChangeSource;
  changedBy?: string;
  changedAt: string;
  isRollbackable: boolean;
  rolledBackAt?: string;
  rolledBackBy?: string;
  rollbackToHistoryId?: string;
  platformVersion?: string;
  correlationId?: string;
}

// ========== Upgrade Management ==========

export interface UpgradeManifest {
  id: string;
  fromVersion: string;
  toVersion: string;
  upgradeType: 'major' | 'minor' | 'patch' | 'hotfix';
  description?: string;
  releaseNotes?: string;
  releaseDate?: string;
  configChanges: ConfigChange[];
  migrations: MigrationEntry[];
  breakingChanges: BreakingChange[];
  deprecations: Deprecation[];
  preChecks: PreCheck[];
  postChecks: PostCheck[];
  isMandatory: boolean;
  minDowntimeMinutes: number;
  checksum: string;
  createdAt: string;
}

export interface ConfigChange {
  configType: ConfigType;
  resourceKey: string;
  changeType: 'added' | 'modified' | 'removed' | 'deprecated';
  previousChecksum?: string;
  newChecksum?: string;
  diff?: JsonPatchOperation[];
  impactLevel: ImpactSeverity;
  description?: string;
}

export interface MigrationEntry {
  name: string;
  timestamp: number;
  type: 'schema' | 'data' | 'seed';
  reversible: boolean;
  description?: string;
}

export interface BreakingChange {
  code: string;
  title: string;
  description: string;
  affectedConfigTypes: ConfigType[];
  migrationGuide?: string;
  automatable: boolean;
}

export interface Deprecation {
  code: string;
  resource: string;
  message: string;
  removalVersion?: string;
  replacement?: string;
}

export interface PreCheck {
  code: string;
  name: string;
  description: string;
  severity: 'warning' | 'error';
  checkScript?: string;
}

export interface PostCheck {
  code: string;
  name: string;
  description: string;
  validationScript?: string;
}

// ========== Instance Upgrade Impact ==========

export interface InstanceUpgradeImpact {
  id: string;
  instanceId: string;
  upgradeManifestId: string;
  customizationId?: string;
  configType: ConfigType;
  resourceKey: string;
  impactType: 'conflict' | 'override_affected' | 'extension_affected' | 'deprecated' | 'removed' | 'new_available';
  impactSeverity: ImpactSeverity;
  description?: string;
  currentInstanceValue?: Record<string, any>;
  currentPlatformValue?: Record<string, any>;
  newPlatformValue?: Record<string, any>;
  platformDiff?: JsonPatchOperation[];
  conflicts?: ConflictDetail[];
  suggestedResolution?: ResolutionStrategy;
  previewMergedValue?: Record<string, any>;
  status: ImpactStatus;
  resolutionChoice?: ResolutionStrategy;
  customResolutionValue?: Record<string, any>;
  resolvedBy?: string;
  resolvedAt?: string;
  resolutionNotes?: string;
  autoResolved: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ConflictDetail {
  path: string;
  conflictType: 'value_changed' | 'property_removed' | 'property_added' | 'type_mismatch';
  instanceValue: any;
  platformOldValue: any;
  platformNewValue: any;
  description?: string;
}

// ========== Business Rules ==========

export type RuleTrigger = 'before_insert' | 'after_insert' | 'before_update' | 'after_update' | 'before_delete' | 'after_delete' | 'async';
export type RuleActionType = 'set_value' | 'validate' | 'abort' | 'script' | 'process_flow' | 'notification' | 'api_call';

export interface BusinessRule {
  id: string;
  instanceId?: string;
  code: string;
  name: string;
  description?: string;
  targetCollection: string;
  trigger: RuleTrigger;
  executionOrder: number;
  conditionType: 'always' | 'property_changed' | 'condition_met' | 'script';
  watchProperties?: string[];
  conditionExpression?: ConditionExpression;
  conditionScript?: string;
  actionType: RuleActionType;
  actionConfig: Record<string, any>;
  actionScript?: string;
  onError: 'abort' | 'log_continue' | 'notify_admin';
  errorMessage?: string;
  source: 'platform' | 'module' | 'instance';
  platformVersion?: string;
  isActive: boolean;
  isSystem: boolean;
  createdBy?: string;
  updatedBy?: string;
  createdAt: string;
  updatedAt: string;
}

export interface ConditionExpression {
  operator: 'and' | 'or' | 'not';
  conditions?: ConditionExpression[];
  property?: string;
  comparison?: string;
  value?: any;
}

// ========== JSON Patch ==========

export interface JsonPatchOperation {
  op: 'add' | 'remove' | 'replace' | 'move' | 'copy' | 'test';
  path: string;
  value?: any;
  from?: string;
}

// ========== API Responses ==========

export interface ListResponse<T> {
  data: T[];
  total: number;
  page?: number;
  pageSize?: number;
}

export interface UpgradeAnalysis {
  manifest: UpgradeManifest;
  impacts: InstanceUpgradeImpact[];
  summary: {
    totalImpacts: number;
    criticalCount: number;
    highCount: number;
    mediumCount: number;
    lowCount: number;
    autoResolvable: number;
    manualReviewRequired: number;
  };
}

// ========== Filters & Query Params ==========

export interface ConfigListFilters {
  configType?: ConfigType;
  customizationType?: CustomizationType;
  active?: boolean;
  search?: string;
}

export interface HistoryListFilters {
  configType?: ConfigType;
  resourceKey?: string;
  changeType?: ChangeType;
  changedBy?: string;
  fromDate?: string;
  toDate?: string;
  limit?: number;
  offset?: number;
}

export interface UpgradeListFilters {
  fromVersion?: string;
  toVersion?: string;
  upgradeType?: string;
}
