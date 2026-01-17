// ============================================================
// Instance Database Entities
// ============================================================

// ─────────────────────────────────────────────────────────────────
// Core Identity
// ─────────────────────────────────────────────────────────────────
export { User, UserStatus } from './user.entity';

// ─────────────────────────────────────────────────────────────────
// RBAC (Role-Based Access Control)
// ─────────────────────────────────────────────────────────────────
export { Role, RoleScope } from './role.entity';
export { Permission } from './permission.entity';
export { RolePermission, UserRole, AssignmentSource } from './role-permission.entity';
export { Group, GroupType, GroupMember, GroupRole } from './group.entity';

// ─────────────────────────────────────────────────────────────────
// Schema Engine (Collections & Properties)
// ─────────────────────────────────────────────────────────────────
export { CollectionDefinition, OwnerType } from './collection-definition.entity';
export { PropertyDefinition, DefaultValueType } from './property-definition.entity';
export { PropertyType, PropertyTypeCategory, ChoiceList, ChoiceItem } from './property-type.entity';
export {
  CollectionIndex,
  CollectionConstraint,
  CollectionIndexType,
  CollectionConstraintType,
} from './collection-index.entity';
export { SchemaChangeLog, SchemaEntityType, SchemaChangeType, SchemaChangeSource, PerformedByType } from './schema-change-log.entity';
export { SchemaSyncState, SyncResult, DriftDetails } from './schema-sync-state.entity';

// ─────────────────────────────────────────────────────────────────
// Access Control
// ─────────────────────────────────────────────────────────────────
export { CollectionAccessRule, PropertyAccessRule, UserSession, BreakGlassSession } from './access-rule.entity';
export type { BreakGlassReasonCode, BreakGlassStatus } from './access-rule.entity';
export { AccessCondition, AccessConditionGroup } from './access-conditions.entity';

// ─────────────────────────────────────────────────────────────────
// Authentication & Settings
// ─────────────────────────────────────────────────────────────────
export { AuthSettings, AuthEvent, AuditLog, NavProfile, NavProfileItem, InstanceSetting } from './settings.entity';
export { NavNode, NavPatch } from './navigation.entity';
export { PasswordPolicy, LdapConfig, SsoProvider } from './auth-config.entity';
export { InstanceCustomization, ConfigChangeHistory } from './instance-config.entity';

// ─────────────────────────────────────────────────────────────────
// Auth Tokens
// ─────────────────────────────────────────────────────────────────
export {
  PasswordHistory,
  PasswordResetToken,
  EmailVerificationToken,
  RefreshToken,
  ApiKey,
  MfaMethod,
  UserInvitation,
  SAMLAuthState,
  LoginAttempt,
} from './auth-tokens.entity';
export type { LoginAttemptResult } from './auth-tokens.entity';

// ─────────────────────────────────────────────────────────────────
// Theme
// ─────────────────────────────────────────────────────────────────
export {
  ThemeDefinition,
  UserThemePreference,
  InstanceBranding,
  ThemeConfig,
  ThemeType,
  ContrastLevel,
  ColorScheme,
  ColorSchemePref,
  PreferenceSource,
} from './theme.entity';

// ─────────────────────────────────────────────────────────────────
// User Preferences
// ─────────────────────────────────────────────────────────────────
export {
  UserPreference,
  DensityMode,
  SidebarPosition,
  DateFormat,
  TimeFormat,
  StartOfWeek,
  NotificationFrequency,
  PinnedNavigationItem,
  KeyboardShortcut,
  NotificationPreferences,
  AccessibilitySettings,
  TablePreferences,
  DashboardPreferences,
} from './user-preference.entity';

// ─────────────────────────────────────────────────────────────────
// Modules
// ─────────────────────────────────────────────────────────────────
export { ModuleEntity, ModuleSecurity, ModuleType, ModuleTargetConfig } from './module.entity';

// ─────────────────────────────────────────────────────────────────
// Forms
// ─────────────────────────────────────────────────────────────────
export { FormDefinition, FormVersion } from './form.entity';

// ─────────────────────────────────────────────────────────────────
// Views
// ─────────────────────────────────────────────────────────────────
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

// Search
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

// ModelOps (AVA Predict)
export {
  DatasetDefinition,
  DatasetSnapshot,
  ModelArtifact,
  ModelEvaluation,
  ModelTrainingJob,
  ModelDeployment,
} from './modelops.entity';
export type {
  DatasetDefinitionStatus,
  DatasetSnapshotStatus,
  ModelArtifactStatus,
  ModelEvaluationStatus,
  ModelTrainingStatus,
  ModelDeploymentStatus,
} from './modelops.entity';

// AVA Registry
export {
  AVATool,
  AVATopic,
  AVACard,
  AVAPromptPolicy,
  AVAToolApprovalPolicy,
} from './ava-registry.entity';

// ─────────────────────────────────────────────────────────────────
// Audit Logs
// ─────────────────────────────────────────────────────────────────
export { AccessRuleAuditLog, AccessAuditLog, PropertyAuditLog } from './audit.entity';

export { InstanceEventOutbox, OutboxStatus } from './event-outbox.entity';

// ─────────────────────────────────────────────────────────────────
// AVA (AI Virtual Assistant) - Phase 6 Enhanced
// ─────────────────────────────────────────────────────────────────
export {
  // Core AVA types
  AVAActionType,
  AVAActionStatus,
  IntentCategory,
  ConversationStatus,
  MessageRole,
  SuggestionType,
  PredictionType,
  FeedbackType,
  // Core AVA entities
  AVAAuditTrail,
  AVAPermissionConfig,
  AVAGlobalSettings,
  // Phase 6: Conversations & Context
  AVAConversation,
  AVAMessage,
  AVAIntent,
  AVAContext,
  // Phase 6: Predictive Analytics
  AVAPrediction,
  AVAAnomaly,
  // Phase 6: Smart Suggestions & Learning
  AVASuggestion,
  AVAFeedback,
  AVAKnowledgeEmbedding,
  AVAUsageMetrics,
} from './ava.entity';

// ─────────────────────────────────────────────────────────────────
// Analytics & Reporting
// ─────────────────────────────────────────────────────────────────
export {
  AnalyticsEvent,
  AggregatedMetric,
  MetricDefinition,
  MetricPoint,
  DashboardDefinition,
  AlertDefinition,
  Report,
} from './analytics.entity';
export type {
  ReportColumn,
  ReportFilter,
  ReportSorting,
  ReportGrouping,
  ReportDataSource,
  MetricCadence,
  MetricAggregation,
  MetricSourceType,
} from './analytics.entity';

// ─────────────────────────────────────────────────────────────────
// Automation (Business Rules, Scheduled Jobs, Client Scripts)
// ─────────────────────────────────────────────────────────────────
export {
  AutomationRule,
  ScheduledJob,
  AutomationExecutionLog,
  ClientScript,
} from './automation.entity';
export type {
  TriggerTiming,
  TriggerOperation,
  AutomationConditionType,
  AutomationActionType,
  ExecutionStatus,
  ScheduleFrequency,
  AutomationAction,
  ClientScriptTrigger,
  ClientScriptAction,
} from './automation.entity';

// ─────────────────────────────────────────────────────────────────
// Advanced Authentication (WebAuthn, Magic Link, Device Trust, etc.)
// ─────────────────────────────────────────────────────────────────
export {
  WebAuthnCredential,
  WebAuthnChallenge,
  MagicLinkToken,
  TrustedDevice,
  ImpersonationSession,
  Delegation,
  BehavioralProfile,
  SecurityAlert,
} from './advanced-auth.entity';
export type {
  DeviceTrustStatus,
  DelegationStatus,
  AlertSeverity,
  AlertStatus,
} from './advanced-auth.entity';

// ─────────────────────────────────────────────────────────────────
// Process Flows (Phase 4)
// ─────────────────────────────────────────────────────────────────
export {
  ProcessFlowDefinition,
  ProcessFlowInstance,
  ProcessFlowExecutionHistory,
  Approval,
} from './process-flow.entity';
export type {
  TriggerType,
  ProcessFlowRunAs,
  ProcessFlowNode,
  ProcessFlowConnection,
  ProcessFlowCanvas,
  ProcessFlowInstanceState,
  ExecutionHistoryStatus,
  ApprovalStatus,
  ApproverType,
  ApprovalType,
} from './process-flow.entity';

// ─────────────────────────────────────────────────────────────────
// SLA & State Machine (Phase 4)
// ─────────────────────────────────────────────────────────────────
export {
  BusinessHours,
  SLADefinition,
  SLAInstance,
  SLABreach,
  StateMachineDefinition,
  StateChangeHistory,
} from './sla.entity';
export type {
  DaySchedule,
  WeeklySchedule,
  Holiday,
  SLAType,
  SLAEscalation,
  SLAInstanceState,
  StateMachineState,
  StateMachineTransition,
} from './sla.entity';

// ─────────────────────────────────────────────────────────────────
// Notifications (Phase 4)
// ─────────────────────────────────────────────────────────────────
export {
  NotificationTemplate,
  NotificationQueue,
  NotificationHistory,
  InAppNotification,
  UserNotificationPreferences,
  DeviceToken,
} from './notification.entity';
export type {
  NotificationChannel,
  NotificationPriority,
  TemplateVariable,
  PushAction,
  InAppAction,
  NotificationQueueStatus,
  DigestFrequency,
  ChannelPreferences,
  DevicePlatform,
} from './notification.entity';

// ─────────────────────────────────────────────────────────────────
// Packs (Release Records, Lineage)
// ─────────────────────────────────────────────────────────────────
export {
  PackReleaseRecord,
  PackObjectRevision,
  PackObjectState,
  PackInstallLock,
  PackReleaseStatus,
  PackActorType,
  PackObjectType,
} from './pack.entity';

// ─────────────────────────────────────────────────────────────────
// Integrations & Data Management (Phase 5)
// ─────────────────────────────────────────────────────────────────
export {
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
export type {
  OAuthClientType,
  OAuthGrantType,
  WebhookEvent,
  WebhookDeliveryStatus,
  ConnectorType,
  ConnectorAuthType,
  ConnectionStatus,
  SyncDirection,
  SyncMode,
  ConflictResolution,
  ImportExportStatus,
  ImportSourceType,
  ExportFormat,
  SyncRunStatus,
  ApiScope,
  PropertyMappingEntry,
  DataTransformation,
  ImportError,
  SyncLogEntry,
} from './integration.entity';

// ─────────────────────────────────────────────────────────────────
// Phase 7: Revolutionary Features
// ─────────────────────────────────────────────────────────────────
export {
  // AVA-Powered Agile Development
  SprintRecording,
  AvaStory,
  StoryImplementation,
  // Intelligent Upgrade Assistant
  CustomizationRegistry,
  UpgradeImpactAnalysis,
  UpgradeFix,
  // Living Documentation System
  GeneratedDocumentation,
  DocumentationVersion,
  // Predictive Operations
  PredictiveInsight,
  InsightAnalysisJob,
  // Digital Twins
  DigitalTwin,
  SensorReading,
  // Self-Healing Infrastructure
  SelfHealingEvent,
  ServiceHealthStatus,
  RecoveryAction,
  // AI Reports
  AIReport,
  AIReportTemplate,
  // Natural Language Queries
  NLQuery,
  SavedNLQuery,
  // Zero-Code App Builder
  ZeroCodeApp,
  ZeroCodeAppVersion,
  AppBuilderComponent,
  // Voice Control
  VoiceCommand,
  VoiceCommandPattern,
  // Predictive UI
  UserBehavior,
  PredictiveSuggestion,
  UserPattern,
  // Enums
  ImpactSeverity,
  FixStatus,
  VoiceCommandStatus,
  BehaviorType,
  SuggestionStatus,
  PatternType,
  AppStatus,
} from './phase7-revolutionary.entity';
export type {
  // Types
  SprintRecordingStatus,
  StoryType,
  StoryPriority,
  StoryStatus,
  ArtifactType,
  CustomizationType,
  AnalysisStatus,
  FixType,
  DocArtifactType,
  DocContent,
  InsightType,
  InsightSeverity,
  InsightStatus,
  JobStatus,
  SensorQuality,
  SensorMapping,
  TwinStatus,
  ServiceStatus,
  EventType,
  RecoveryActionType,
  ReportStatus,
  ReportFormat,
  VoiceIntent,
  UserAction,
  SuggestionType as PredictiveSuggestionType,
  AppDefinition,
  AppComponent,
} from './phase7-revolutionary.entity';

// ============================================================
// Entity Array for TypeORM Configuration
// ============================================================

import { User } from './user.entity';
import { Role } from './role.entity';
import { Permission } from './permission.entity';
import { RolePermission, UserRole } from './role-permission.entity';
import { Group, GroupMember, GroupRole } from './group.entity';
import { CollectionDefinition } from './collection-definition.entity';
import { PropertyDefinition } from './property-definition.entity';
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
  ScheduledJob,
  AutomationExecutionLog,
  ClientScript,
} from './automation.entity';
import {
  ProcessFlowDefinition,
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
} from './phase7-revolutionary.entity';

/**
 * All instance database entities
 * Use this array when configuring TypeORM
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

  // Schema Engine
  CollectionDefinition,
  PropertyDefinition,
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
  NavNode,    // [NEW]
  NavPatch,   // [NEW]
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
  TranslationRequest,
  LocalizationBundle,
  DatasetDefinition,
  DatasetSnapshot,
  ModelArtifact,
  ModelEvaluation,
  ModelTrainingJob,
  ModelDeployment,
  ModelArtifact,

  // Audit Logs
  AccessRuleAuditLog,
  AccessAuditLog,
  PropertyAuditLog,

  // Event Stream
  InstanceEventOutbox,

  // AVA (AI Virtual Assistant) - Phase 6 Enhanced
  AVAAuditTrail,
  AVAPermissionConfig,
  AVAGlobalSettings,
  AVATool,
  AVATopic,
  AVACard,
  AVAPromptPolicy,
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
  ScheduledJob,
  AutomationExecutionLog,
  ClientScript,

  // Process Flows (Phase 4)
  ProcessFlowDefinition,
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

  // Phase 7: Revolutionary Features
  // AVA-Powered Agile Development
  SprintRecording,
  AvaStory,
  StoryImplementation,
  // Intelligent Upgrade Assistant
  CustomizationRegistry,
  UpgradeImpactAnalysis,
  UpgradeFix,
  // Living Documentation System
  GeneratedDocumentation,
  DocumentationVersion,
  // Predictive Operations
  PredictiveInsight,
  InsightAnalysisJob,
  // Digital Twins
  DigitalTwin,
  SensorReading,
  // Self-Healing Infrastructure
  SelfHealingEvent,
  ServiceHealthStatus,
  RecoveryAction,
  // AI Reports
  AIReport,
  AIReportTemplate,
  // Natural Language Queries
  NLQuery,
  SavedNLQuery,
  // Zero-Code App Builder
  ZeroCodeApp,
  ZeroCodeAppVersion,
  AppBuilderComponent,
  // Voice Control
  VoiceCommand,
  VoiceCommandPattern,
  // Predictive UI
  UserBehavior,
  PredictiveSuggestion,
  UserPattern,
];
