// libs/instance-db/src/lib/entities/ava.ts
//
// AVA-area entities: conversational AI assistant (conversations, messages,
// intents, context, predictions, anomalies, suggestions, feedback, knowledge
// embeddings, usage metrics), AVA registry (tools, topics, cards, prompt and
// approval policies), AVA proposals (canon §12 state machine), and ModelOps
// (dataset definitions, snapshots, model artifacts, evaluations, training
// jobs, deployments).
//
// Also includes App-Builder entities that depend on AVA capabilities:
// sprint recordings, stories, upgrade assistant, documentation system,
// predictive operations, digital twins, self-healing infrastructure,
// AI reports, natural-language queries, zero-code app builder, voice
// control, and predictive UI.
//
// Public API surface is unchanged — entities continue to be exported via
// the package barrel `@hubblewave/instance-db`. This file exists to make
// area ownership explicit and to ease future code navigation. See Plan
// Fix 24 PR-A for the restructure rationale.

export {
  AVATool,
  AVATopic,
  AVACard,
  AVAPromptPolicy,
  AVAToolApprovalPolicy,
} from './ava-registry.entity';

export { AvaProposal } from './ava-proposal.entity';
export type { AvaProposalState } from './ava-proposal.entity';

export {
  AVAActionType,
  AVAActionStatus,
  IntentCategory,
  ConversationStatus,
  MessageRole,
  SuggestionType,
  PredictionType,
  FeedbackType,
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

export {
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
  ImpactSeverity,
  FixStatus,
  VoiceCommandStatus,
  BehaviorType,
  SuggestionStatus,
  PatternType,
  AppStatus,
} from './app-builder.entity';
export type {
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
} from './app-builder.entity';
