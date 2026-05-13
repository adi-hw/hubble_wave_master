// libs/instance-db/src/lib/entities/index.ts
//
// Public re-export barrel for all instance-database entities.
// Per-area exports live in sibling files:
//
//   identity.ts      — users, RBAC, sessions, auth tokens, signing keys,
//                      service principals, advanced auth
//   metadata.ts      — schema engine, access-control rules, forms, views,
//                      navigation, workspaces, packs, search, localization
//   automation.ts    — business rules, process flows, SLA, decision tables,
//                      guided processes, connectors, event outbox
//   ava.ts           — AVA conversations, proposals, ModelOps, app-builder
//   settings.ts      — instance settings, nav, themes, user preferences,
//                      audit logs, runtime anomalies
//   analytics.ts     — dashboards, metrics, reports
//   notifications.ts — notification templates, queue, in-app, push tokens
//   integrations.ts  — OAuth, webhooks, connectors, import/export, sync
//
// External consumers MUST continue to import from `@hubblewave/instance-db`.
// Never import directly from per-area file paths — those paths are an
// internal implementation detail of this library. See Plan Fix 24 PR-A.

export * from './identity';
export * from './metadata';
export * from './automation';
export * from './ava';
export * from './settings';
export * from './analytics';
export * from './notifications';
export * from './integrations';

// ============================================================
// Entity Array for TypeORM Configuration
// ============================================================

import { User } from './user.entity';
import { Role } from './role.entity';
import { Permission } from './permission.entity';
import { RolePermission, UserRole } from './role-permission.entity';
import { Group, GroupMember, GroupRole } from './group.entity';
import { Application, ApplicationRevision } from './application.entity';
import {
  CollectionDefinition,
  CollectionDefinitionRevision,
} from './collection-definition.entity';
import {
  PropertyDefinition,
  PropertyDefinitionRevision,
} from './property-definition.entity';
import { PropertyType, ChoiceList, ChoiceItem } from './property-type.entity';
import { CollectionIndex, CollectionConstraint } from './collection-index.entity';
import { SchemaChangeLog } from './schema-change-log.entity';
import { SchemaSyncState } from './schema-sync-state.entity';
import { CollectionAccessRule, PropertyAccessRule, UserSession, BreakGlassSession } from './access-rule.entity';
import { AccessCondition, AccessConditionGroup } from './access-conditions.entity';
import { AuthSettings, AuthEvent, AuditLog, NavProfile, NavProfileItem, InstanceSetting } from './settings.entity';
import { NavNode, NavPatch } from './navigation.entity';
import { PasswordPolicy, LdapConfig, SsoProvider } from './auth-config.entity';
import { InstanceCustomization, ConfigChangeHistory } from './instance-config.entity';
import {
  PasswordHistory,
  PasswordResetToken,
  EmailVerificationToken,
  RefreshToken,
  ApiKey,
  UserInvitation,
  MfaMethod,
  SAMLAuthState,
  LoginAttempt,
} from './auth-tokens.entity';
import { KeyMetadata } from './key-metadata.entity';
import { ServicePrincipal } from './service-principal.entity';
import { ThemeDefinition, UserThemePreference, InstanceBranding } from './theme.entity';
import { UserPreference } from './user-preference.entity';
import { ModuleEntity, ModuleSecurity } from './module.entity';
import { FormDefinition, FormVersion } from './form.entity';
import {
  ViewDefinition,
  ViewDefinitionRevision,
  ViewVariant,
  WidgetCatalog,
} from './view.entity';
import {
  NavigationModule,
  NavigationModuleRevision,
  NavigationVariant,
} from './navigation-module.entity';
import {
  SearchExperience,
  SearchSource,
  SearchDictionary,
  SearchIndexState,
} from './search.entity';
import {
  Locale,
  TranslationKey,
  TranslationValue,
  LocalizationBundle,
  TranslationRequest,
} from './localization.entity';
import {
  DatasetDefinition,
  DatasetSnapshot,
  ModelArtifact,
  ModelEvaluation,
  ModelTrainingJob,
  ModelDeployment,
} from './modelops.entity';
import { AccessRuleAuditLog, AccessAuditLog, PropertyAuditLog } from './audit.entity';
import { InstanceEventOutbox } from './event-outbox.entity';
import { DependentReviewQueueEntry } from './dependent-review-queue.entity';
import { DisplayRule, DisplayRuleRevision } from './display-rule.entity';
import { Connector } from './connector.entity';
import {
  DecisionTable,
  DecisionInput,
  DecisionRow,
  DecisionTableRevision,
} from './decision-table.entity';
import {
  GuidedProcessDefinition,
  GuidedProcessStage,
  GuidedProcessActivity,
  GuidedProcessRevision,
} from './guided-process.entity';
import {
  WorkspaceDefinition,
  WorkspacePage,
  WorkspaceVariant,
} from './workspace.entity';
import { ChangePackage } from './change-package.entity';
import { RuntimeAnomaly } from './runtime-anomaly.entity';
import {
  AVAAuditTrail,
  AVAPermissionConfig,
  AVAGlobalSettings,
  AVAConversation,
  AVAMessage,
  AVAIntent,
  AVAContext,
  AVAPrediction,
  AVAAnomaly,
  AVASuggestion,
  AVAFeedback,
  AVAKnowledgeEmbedding,
  AVAUsageMetrics,
} from './ava.entity';
import {
  AVATool,
  AVATopic,
  AVACard,
  AVAPromptPolicy,
} from './ava-registry.entity';
import { AvaProposal } from './ava-proposal.entity';
import {
  AnalyticsEvent,
  AggregatedMetric,
  MetricDefinition,
  MetricPoint,
  DashboardDefinition,
  AlertDefinition,
  Report,
} from './analytics.entity';
import {
  WebAuthnCredential,
  WebAuthnChallenge,
  MagicLinkToken,
  TrustedDevice,
  ImpersonationSession,
  Delegation,
  BehavioralProfile,
  SecurityAlert,
} from './advanced-auth.entity';
import {
  AutomationRule,
  AutomationRuleRevision,
  ScheduledJob,
  AutomationExecutionLog,
  ClientScript,
} from './automation.entity';
import {
  ProcessFlowDefinition,
  ProcessFlowDefinitionRevision,
  ProcessFlowInstance,
  ProcessFlowExecutionHistory,
  Approval,
} from './process-flow.entity';
import {
  BusinessHours,
  SLADefinition,
  SLAInstance,
  SLABreach,
  StateMachineDefinition,
  StateChangeHistory,
} from './sla.entity';
import {
  NotificationTemplate,
  NotificationQueue,
  NotificationHistory,
  InAppNotification,
  UserNotificationPreferences,
  DeviceToken,
} from './notification.entity';
import {
  PackReleaseRecord,
  PackObjectRevision,
  PackObjectState,
  PackInstallLock,
} from './pack.entity';
import {
  IntegrationApiKey,
  OAuthClient,
  OAuthAuthorizationCode,
  OAuthAccessToken,
  OAuthRefreshToken,
  WebhookSubscription,
  WebhookDelivery,
  ExternalConnector,
  ConnectorConnection,
  PropertyMapping,
  ImportJob,
  ExportJob,
  SyncConfiguration,
  SyncRun,
  ApiRequestLog,
} from './integration.entity';
import {
  SprintRecording,
  AvaStory,
  StoryImplementation,
  CustomizationRegistry,
  UpgradeImpactAnalysis,
  UpgradeFix,
  GeneratedDocumentation,
  DocumentationVersion,
  PredictiveInsight,
  InsightAnalysisJob,
  DigitalTwin,
  SensorReading,
  SelfHealingEvent,
  ServiceHealthStatus,
  RecoveryAction,
  AIReport,
  AIReportTemplate,
  NLQuery,
  SavedNLQuery,
  ZeroCodeApp,
  ZeroCodeAppVersion,
  AppBuilderComponent,
  VoiceCommand,
  VoiceCommandPattern,
  UserBehavior,
  PredictiveSuggestion,
  UserPattern,
} from './app-builder.entity';

/**
 * All instance database entities.
 * Use this array when configuring TypeORM.
 */
export const instanceEntities = [
  // Core Identity
  User,

  // RBAC
  Role,
  Permission,
  RolePermission,
  UserRole,
  Group,
  GroupMember,
  GroupRole,

  // Application Registry
  Application,
  ApplicationRevision,

  // Schema Engine
  CollectionDefinition,
  CollectionDefinitionRevision,
  PropertyDefinition,
  PropertyDefinitionRevision,
  PropertyType,
  ChoiceList,
  ChoiceItem,
  CollectionIndex,
  CollectionConstraint,
  SchemaChangeLog,
  SchemaSyncState,

  // Access Control
  CollectionAccessRule,
  PropertyAccessRule,
  UserSession,
  BreakGlassSession,
  AccessCondition,
  AccessConditionGroup,

  // Authentication & Settings
  AuthSettings,
  AuthEvent,
  AuditLog,
  NavProfile,
  NavProfileItem,
  NavNode,
  NavPatch,
  InstanceSetting,
  PasswordPolicy,
  LdapConfig,
  SsoProvider,
  InstanceCustomization,
  ConfigChangeHistory,

  // Auth Tokens
  PasswordHistory,
  PasswordResetToken,
  EmailVerificationToken,
  RefreshToken,
  ApiKey,
  UserInvitation,
  MfaMethod,
  SAMLAuthState,
  LoginAttempt,

  // Signing Key Registry (canon §29.2)
  KeyMetadata,

  // Service Principal Registry (canon §29.7)
  ServicePrincipal,

  // UI & Forms
  ThemeDefinition,
  UserThemePreference,
  InstanceBranding,
  UserPreference,
  FormDefinition,
  FormVersion,

  // Business Logic
  ModuleEntity,
  ModuleSecurity,

  // Views
  ViewDefinition,
  ViewDefinitionRevision,
  ViewVariant,
  WidgetCatalog,
  NavigationModule,
  NavigationModuleRevision,
  NavigationVariant,
  SearchExperience,
  SearchSource,
  SearchDictionary,
  SearchIndexState,
  Locale,
  TranslationKey,
  TranslationValue,
  LocalizationBundle,
  TranslationRequest,
  DatasetDefinition,
  DatasetSnapshot,
  ModelArtifact,
  ModelEvaluation,
  ModelTrainingJob,
  ModelDeployment,

  // Audit Logs
  AccessRuleAuditLog,
  AccessAuditLog,
  PropertyAuditLog,

  // Event Stream
  InstanceEventOutbox,

  // ADR-17 publish-impact review queue
  DependentReviewQueueEntry,

  // Phase 2 §7.3 Display Rules
  DisplayRule,
  DisplayRuleRevision,

  // Phase 3 §8.1.10 Connector framework
  Connector,

  // Phase 3 §8.2 Decision Tables (ADR-14 typed-IO model)
  DecisionTable,
  DecisionInput,
  DecisionRow,
  DecisionTableRevision,

  // Phase 3 §8.3 Guided Processes (Playbooks)
  GuidedProcessDefinition,
  GuidedProcessStage,
  GuidedProcessActivity,
  GuidedProcessRevision,

  // Phase 5 Workspaces (ADR-15)
  WorkspaceDefinition,
  WorkspacePage,
  WorkspaceVariant,

  // Phase 6 Change Packages (§11.1)
  ChangePackage,

  // Runtime Anomaly Observability (W2.D)
  RuntimeAnomaly,

  // AVA (AI Virtual Assistant) - Phase 6 Enhanced
  AVAAuditTrail,
  AVAPermissionConfig,
  AVAGlobalSettings,
  AVATool,
  AVATopic,
  AVACard,
  AVAPromptPolicy,
  AvaProposal,
  AVAConversation,
  AVAMessage,
  AVAIntent,
  AVAContext,
  AVAPrediction,
  AVAAnomaly,
  AVASuggestion,
  AVAFeedback,
  AVAKnowledgeEmbedding,
  AVAUsageMetrics,

  // Analytics & Reporting
  AnalyticsEvent,
  AggregatedMetric,
  MetricDefinition,
  MetricPoint,
  DashboardDefinition,
  AlertDefinition,
  Report,

  // Advanced Authentication
  WebAuthnCredential,
  WebAuthnChallenge,
  MagicLinkToken,
  TrustedDevice,
  ImpersonationSession,
  Delegation,
  BehavioralProfile,
  SecurityAlert,

  // Automation (Phase 3)
  AutomationRule,
  AutomationRuleRevision,
  ScheduledJob,
  AutomationExecutionLog,
  ClientScript,

  // Process Flows (Phase 4)
  ProcessFlowDefinition,
  ProcessFlowDefinitionRevision,
  ProcessFlowInstance,
  ProcessFlowExecutionHistory,
  Approval,

  // SLA & State Machine (Phase 4)
  BusinessHours,
  SLADefinition,
  SLAInstance,
  SLABreach,
  StateMachineDefinition,
  StateChangeHistory,

  // Notifications (Phase 4)
  NotificationTemplate,
  NotificationQueue,
  NotificationHistory,
  InAppNotification,
  UserNotificationPreferences,
  DeviceToken,

  // Packs
  PackReleaseRecord,
  PackObjectRevision,
  PackObjectState,
  PackInstallLock,

  // Integrations & Data Management (Phase 5)
  IntegrationApiKey,
  OAuthClient,
  OAuthAuthorizationCode,
  OAuthAccessToken,
  OAuthRefreshToken,
  WebhookSubscription,
  WebhookDelivery,
  ExternalConnector,
  ConnectorConnection,
  PropertyMapping,
  ImportJob,
  ExportJob,
  SyncConfiguration,
  SyncRun,
  ApiRequestLog,

  // App-Builder
  SprintRecording,
  AvaStory,
  StoryImplementation,
  CustomizationRegistry,
  UpgradeImpactAnalysis,
  UpgradeFix,
  GeneratedDocumentation,
  DocumentationVersion,
  PredictiveInsight,
  InsightAnalysisJob,
  DigitalTwin,
  SensorReading,
  SelfHealingEvent,
  ServiceHealthStatus,
  RecoveryAction,
  AIReport,
  AIReportTemplate,
  NLQuery,
  SavedNLQuery,
  ZeroCodeApp,
  ZeroCodeAppVersion,
  AppBuilderComponent,
  VoiceCommand,
  VoiceCommandPattern,
  UserBehavior,
  PredictiveSuggestion,
  UserPattern,
];
