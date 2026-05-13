// libs/instance-db/src/lib/entities/metadata.ts
//
// Metadata-area entities: application registry, schema engine (collections,
// properties, indexes, change log), access-control rules, modules, forms,
// views, navigation, workspaces, display rules, search, localization, packs,
// dependent-review queue, and change packages.
//
// Public API surface is unchanged — entities continue to be exported via
// the package barrel `@hubblewave/instance-db`. This file exists to make
// area ownership explicit and to ease future code navigation. See Plan
// Fix 24 PR-A for the restructure rationale.

export {
  Application,
  ApplicationRevision,
} from './application.entity';
export type { ApplicationStatus, ApplicationRevisionStatus } from './application.entity';

export {
  CollectionDefinition,
  CollectionDefinitionRevision,
  OwnerType,
} from './collection-definition.entity';
export type {
  CollectionDefinitionStatus,
  CollectionDefinitionRevisionStatus,
} from './collection-definition.entity';

export {
  PropertyDefinition,
  PropertyDefinitionRevision,
  DefaultValueType,
} from './property-definition.entity';
export type {
  PropertyDefinitionStatus,
  PropertyDefinitionRevisionStatus,
  PropertyBehavioralAttributes,
} from './property-definition.entity';

export { PropertyType, PropertyTypeCategory, ChoiceList, ChoiceItem } from './property-type.entity';

export {
  CollectionIndex,
  CollectionConstraint,
  CollectionIndexType,
  CollectionConstraintType,
} from './collection-index.entity';

export { SchemaChangeLog, SchemaEntityType, SchemaChangeType, SchemaChangeSource, PerformedByType } from './schema-change-log.entity';
export { SchemaSyncState, SyncResult, DriftDetails } from './schema-sync-state.entity';

export { CollectionAccessRule, PropertyAccessRule, UserSession, BreakGlassSession } from './access-rule.entity';
export type { BreakGlassReasonCode, BreakGlassStatus } from './access-rule.entity';
export { AccessCondition, AccessConditionGroup } from './access-conditions.entity';

export { ModuleEntity, ModuleSecurity, ModuleType, ModuleTargetConfig } from './module.entity';

export { FormDefinition, FormVersion } from './form.entity';
export type { FormDefinitionStatus, FormVersionStatus } from './form.entity';

export {
  ViewDefinition,
  ViewDefinitionRevision,
  ViewVariant,
  WidgetCatalog,
} from './view.entity';
export type { ViewScope, ViewKind, ViewRevisionStatus } from './view.entity';

export {
  NavigationModule,
  NavigationModuleRevision,
  NavigationVariant,
} from './navigation-module.entity';
export type { NavigationScope, NavigationRevisionStatus } from './navigation-module.entity';

export {
  SearchExperience,
  SearchSource,
  SearchDictionary,
  SearchIndexState,
} from './search.entity';
export type { SearchScope, SearchIndexStatus } from './search.entity';

export {
  Locale,
  TranslationKey,
  TranslationValue,
  LocalizationBundle,
  TranslationRequest,
} from './localization.entity';
export type { LocaleDirection, TranslationStatus, TranslationRequestStatus } from './localization.entity';

export {
  WorkspaceDefinition,
  WorkspacePage,
  WorkspaceVariant,
} from './workspace.entity';
export type {
  WorkspaceStatus,
  WorkspacePageKind,
  WorkspaceVariantScope,
  PanelLayout,
} from './workspace.entity';

export { DisplayRule, DisplayRuleRevision } from './display-rule.entity';
export type {
  DisplayRuleStatus,
  DisplayRuleRevisionStatus,
  DisplayActionKind,
  DisplayAction,
} from './display-rule.entity';

export {
  PackReleaseRecord,
  PackObjectRevision,
  PackObjectState,
  PackInstallLock,
  PackReleaseStatus,
  PackActorType,
  PackObjectType,
} from './pack.entity';

export { DependentReviewQueueEntry } from './dependent-review-queue.entity';
export type {
  DependentReviewStatus,
  DependentReviewChangeKind,
  DependentReviewClassification,
} from './dependent-review-queue.entity';

export { ChangePackage } from './change-package.entity';
export type {
  ChangePackageStatus,
  MetadataChange,
} from './change-package.entity';
