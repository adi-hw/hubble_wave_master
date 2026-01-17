import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, Index, ManyToOne, JoinColumn } from 'typeorm';

// ============================================================
// AVA (AI Virtual Assistant) Entities - Phase 6 Enhanced
// ============================================================

export type AVAActionType = 'navigate' | 'create' | 'update' | 'delete' | 'execute';
export type IntentCategory = 'ticket_management' | 'asset_management' | 'procurement' | 'knowledge' | 'analytics' | 'user_management' | 'system' | 'unknown';
export type ConversationStatus = 'active' | 'completed' | 'abandoned' | 'escalated';
export type MessageRole = 'user' | 'assistant' | 'system';
export type SuggestionType = 'property_value' | 'action' | 'knowledge_article' | 'similar_item' | 'process_flow' | 'template';
export type PredictionType = 'ticket_volume' | 'sla_breach' | 'incident' | 'anomaly' | 'resource_need';
export type FeedbackType = 'helpful' | 'not_helpful' | 'incorrect' | 'offensive';
export type AVAActionStatus = 'pending' | 'confirmed' | 'completed' | 'failed' | 'reverted' | 'cancelled';

/**
 * AVA Audit Trail - Records all actions performed by AVA
 */
@Entity('ava_audit_trail')
@Index(['userId'])
@Index(['actionType'])
@Index(['status'])
@Index(['targetCollection'])
@Index(['createdAt'])
export class AVAAuditTrail {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'user_id', type: 'uuid' })
  userId!: string;

  @Column({ name: 'user_name', nullable: true })
  userName?: string;

  @Column({ name: 'user_role', nullable: true })
  userRole?: string;

  @Column({ name: 'conversation_id', type: 'uuid', nullable: true })
  conversationId?: string;

  @Column({ name: 'user_message', type: 'text', nullable: true })
  userMessage?: string;

  @Column({ name: 'ava_response', type: 'text', nullable: true })
  avaResponse?: string;

  @Column({ name: 'action_type', type: 'varchar', length: 50 })
  actionType!: AVAActionType;

  @Column({ type: 'varchar', length: 50, default: 'pending' })
  status!: AVAActionStatus;

  @Column({ name: 'action_label', nullable: true })
  actionLabel?: string;

  @Column({ name: 'action_target', nullable: true })
  actionTarget?: string;

  @Column({ name: 'target_collection', nullable: true })
  targetCollection?: string;

  @Column({ name: 'target_record_id', type: 'uuid', nullable: true })
  targetRecordId?: string;

  @Column({ name: 'target_display_value', nullable: true })
  targetDisplayValue?: string;

  @Column({ name: 'before_data', type: 'jsonb', nullable: true })
  beforeData?: Record<string, unknown>;

  @Column({ name: 'after_data', type: 'jsonb', nullable: true })
  afterData?: Record<string, unknown>;

  @Column({ name: 'action_params', type: 'jsonb', nullable: true })
  actionParams?: Record<string, unknown>;

  @Column({ name: 'suggested_actions', type: 'jsonb', nullable: true })
  suggestedActions?: Record<string, unknown>[];

  @Column({ name: 'preview_payload', type: 'jsonb', nullable: true })
  previewPayload?: Record<string, unknown>;

  @Column({ name: 'approval_payload', type: 'jsonb', nullable: true })
  approvalPayload?: Record<string, unknown>;

  @Column({ name: 'execution_payload', type: 'jsonb', nullable: true })
  executionPayload?: Record<string, unknown>;

  @Column({ name: 'is_revertible', default: false })
  isRevertible!: boolean;

  @Column({ name: 'ip_address', nullable: true })
  ipAddress?: string;

  @Column({ name: 'user_agent', type: 'text', nullable: true })
  userAgent?: string;

  @Column({ name: 'session_id', type: 'uuid', nullable: true })
  sessionId?: string;

  @Column({ name: 'error_message', type: 'text', nullable: true })
  errorMessage?: string;

  @Column({ name: 'error_code', nullable: true })
  errorCode?: string;

  @Column({ name: 'duration_ms', type: 'int', nullable: true })
  durationMs?: number;

  @Column({ name: 'completed_at', type: 'timestamptz', nullable: true })
  completedAt?: Date;

  @Column({ name: 'reverted_at', type: 'timestamptz', nullable: true })
  revertedAt?: Date;

  @Column({ name: 'reverted_by', type: 'uuid', nullable: true })
  revertedBy?: string;

  @Column({ name: 'revert_reason', type: 'text', nullable: true })
  revertReason?: string;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;
}

/**
 * AVA Permission Configuration
 */
@Entity('ava_permission_configs')
@Index(['collectionCode', 'actionType'], { unique: true })
export class AVAPermissionConfig {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'collection_code', nullable: true })
  collectionCode?: string;

  @Column({ name: 'action_type', type: 'varchar', length: 50 })
  actionType!: AVAActionType;

  @Column({ name: 'is_enabled', default: true })
  isEnabled!: boolean;

  @Column({ name: 'requires_confirmation', default: true })
  requiresConfirmation!: boolean;

  @Column({ name: 'allowed_roles', type: 'jsonb', default: () => `'[]'` })
  allowedRoles!: string[];

  @Column({ name: 'excluded_roles', type: 'jsonb', default: () => `'[]'` })
  excludedRoles!: string[];

  @Column({ name: 'created_by', type: 'uuid', nullable: true })
  createdBy?: string;

  @Column({ name: 'updated_by', type: 'uuid', nullable: true })
  updatedBy?: string;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}

/**
 * AVA Global Settings
 */
@Entity('ava_global_settings')
export class AVAGlobalSettings {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'ava_enabled', default: true })
  avaEnabled!: boolean;

  @Column({ name: 'read_only_mode', default: false })
  readOnlyMode!: boolean;

  @Column({ name: 'allow_create_actions', default: true })
  allowCreateActions!: boolean;

  @Column({ name: 'allow_update_actions', default: true })
  allowUpdateActions!: boolean;

  @Column({ name: 'allow_delete_actions', default: false })
  allowDeleteActions!: boolean;

  @Column({ name: 'allow_execute_actions', default: true })
  allowExecuteActions!: boolean;

  @Column({ name: 'default_requires_confirmation', default: true })
  defaultRequiresConfirmation!: boolean;

  @Column({ name: 'system_read_only_collections', type: 'jsonb', default: () => `'[]'` })
  systemReadOnlyCollections!: string[];

  @Column({ name: 'user_rate_limit_per_hour', default: 100 })
  userRateLimitPerHour!: number;

  @Column({ name: 'global_rate_limit_per_hour', default: 10000 })
  globalRateLimitPerHour!: number;

  @Column({ name: 'updated_by', type: 'uuid', nullable: true })
  updatedBy?: string;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}

// ============================================================
// Phase 6: AVA Conversation & Context Entities
// ============================================================

/**
 * AVA Conversation - Tracks multi-turn conversations
 */
@Entity('ava_conversations')
@Index(['userId'])
@Index(['status'])
@Index(['createdAt'])
export class AVAConversation {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'user_id', type: 'uuid' })
  userId!: string;

  @Column({ type: 'varchar', length: 50, default: 'active' })
  status!: ConversationStatus;

  @Column({ type: 'text', nullable: true })
  title?: string;

  @Column({ name: 'message_count', default: 0 })
  messageCount!: number;

  @Column({ name: 'last_activity_at', type: 'timestamptz', nullable: true })
  lastActivityAt?: Date;

  @Column({ name: 'context_summary', type: 'text', nullable: true })
  contextSummary?: string;

  @Column({ name: 'session_metadata', type: 'jsonb', nullable: true })
  sessionMetadata?: Record<string, unknown>;

  @Column({ name: 'escalated_to', type: 'uuid', nullable: true })
  escalatedTo?: string;

  @Column({ name: 'escalation_reason', type: 'text', nullable: true })
  escalationReason?: string;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}

/**
 * AVA Message - Individual messages in a conversation
 */
@Entity('ava_messages')
@Index(['conversationId'])
@Index(['role'])
@Index(['createdAt'])
export class AVAMessage {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'conversation_id', type: 'uuid' })
  conversationId!: string;

  @ManyToOne(() => AVAConversation, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'conversation_id' })
  conversation!: AVAConversation;

  @Column({ type: 'varchar', length: 20 })
  role!: MessageRole;

  @Column({ type: 'text' })
  content!: string;

  @Column({ name: 'intent_id', type: 'uuid', nullable: true })
  intentId?: string;

  @Column({ name: 'detected_entities', type: 'jsonb', nullable: true })
  detectedEntities?: Record<string, unknown>;

  @Column({ name: 'sentiment_score', type: 'decimal', precision: 5, scale: 4, nullable: true })
  sentimentScore?: number;

  @Column({ name: 'tool_calls', type: 'jsonb', nullable: true })
  toolCalls?: Record<string, unknown>[];

  @Column({ name: 'token_count', type: 'int', nullable: true })
  tokenCount?: number;

  @Column({ name: 'response_time_ms', type: 'int', nullable: true })
  responseTimeMs?: number;

  @Column({ name: 'model_used', nullable: true })
  modelUsed?: string;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;
}

/**
 * AVA Intent - Records intent classification
 */
@Entity('ava_intents')
@Index(['messageId'])
@Index(['category'])
@Index(['intentName'])
export class AVAIntent {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'message_id', type: 'uuid' })
  messageId!: string;

  @ManyToOne(() => AVAMessage, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'message_id' })
  message!: AVAMessage;

  @Column({ type: 'varchar', length: 50 })
  category!: IntentCategory;

  @Column({ name: 'intent_name', type: 'varchar', length: 100 })
  intentName!: string;

  @Column({ type: 'decimal', precision: 5, scale: 4 })
  confidence!: number;

  @Column({ name: 'detected_entities', type: 'jsonb', nullable: true })
  detectedEntities?: Record<string, unknown>;

  @Column({ name: 'required_permissions', type: 'jsonb', nullable: true })
  requiredPermissions?: string[];

  @Column({ name: 'is_clarification_needed', default: false })
  isClarificationNeeded!: boolean;

  @Column({ name: 'clarification_question', type: 'text', nullable: true })
  clarificationQuestion?: string;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;
}

/**
 * AVA Context - Stores session/user context
 */
@Entity('ava_contexts')
@Index(['userId'])
@Index(['contextType'])
@Index(['expiresAt'])
export class AVAContext {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'user_id', type: 'uuid' })
  userId!: string;

  @Column({ name: 'conversation_id', type: 'uuid', nullable: true })
  conversationId?: string;

  @Column({ name: 'context_type', type: 'varchar', length: 50 })
  contextType!: string;

  @Column({ name: 'context_key', type: 'varchar', length: 100 })
  contextKey!: string;

  @Column({ name: 'context_value', type: 'jsonb' })
  contextValue!: Record<string, unknown>;

  @Column({ name: 'expires_at', type: 'timestamptz', nullable: true })
  expiresAt?: Date;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}

// ============================================================
// Phase 6: AVA Predictive Analytics Entities
// ============================================================

/**
 * AVA Prediction - Stores predictive analytics results
 */
@Entity('ava_predictions')
@Index(['predictionType'])
@Index(['targetDate'])
@Index(['isActive'])
export class AVAPrediction {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'prediction_type', type: 'varchar', length: 50 })
  predictionType!: PredictionType;

  @Column({ name: 'target_date', type: 'date' })
  targetDate!: Date;

  @Column({ name: 'prediction_value', type: 'jsonb' })
  predictionValue!: Record<string, unknown>;

  @Column({ type: 'decimal', precision: 5, scale: 4, nullable: true })
  confidence?: number;

  @Column({ name: 'model_version', nullable: true })
  modelVersion?: string;

  @Column({ name: 'input_features', type: 'jsonb', nullable: true })
  inputFeatures?: Record<string, unknown>;

  @Column({ name: 'is_active', default: true })
  isActive!: boolean;

  @Column({ name: 'actual_value', type: 'jsonb', nullable: true })
  actualValue?: Record<string, unknown>;

  @Column({ type: 'decimal', precision: 5, scale: 4, nullable: true })
  accuracy?: number;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @Column({ name: 'verified_at', type: 'timestamptz', nullable: true })
  verifiedAt?: Date;
}

/**
 * AVA Anomaly - Detected anomalies
 */
@Entity('ava_anomalies')
@Index(['anomalyType'])
@Index(['severity'])
@Index(['isResolved'])
@Index(['detectedAt'])
export class AVAAnomaly {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'anomaly_type', type: 'varchar', length: 100 })
  anomalyType!: string;

  @Column({ type: 'varchar', length: 20 })
  severity!: 'low' | 'medium' | 'high' | 'critical';

  @Column({ type: 'text' })
  description!: string;

  @Column({ name: 'affected_entity', nullable: true })
  affectedEntity?: string;

  @Column({ name: 'affected_entity_id', type: 'uuid', nullable: true })
  affectedEntityId?: string;

  @Column({ name: 'metric_value', type: 'decimal', precision: 15, scale: 4, nullable: true })
  metricValue?: number;

  @Column({ name: 'expected_value', type: 'decimal', precision: 15, scale: 4, nullable: true })
  expectedValue?: number;

  @Column({ name: 'deviation_percentage', type: 'decimal', precision: 7, scale: 4, nullable: true })
  deviationPercentage?: number;

  @Column({ type: 'decimal', precision: 5, scale: 4, nullable: true })
  confidence?: number;

  @Column({ name: 'recommended_actions', type: 'jsonb', nullable: true })
  recommendedActions?: string[];

  @Column({ name: 'is_resolved', default: false })
  isResolved!: boolean;

  @Column({ name: 'resolved_by', type: 'uuid', nullable: true })
  resolvedBy?: string;

  @Column({ name: 'resolution_notes', type: 'text', nullable: true })
  resolutionNotes?: string;

  @Column({ name: 'detected_at', type: 'timestamptz' })
  detectedAt!: Date;

  @Column({ name: 'resolved_at', type: 'timestamptz', nullable: true })
  resolvedAt?: Date;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;
}

// ============================================================
// Phase 6: AVA Smart Suggestions & Learning
// ============================================================

/**
 * AVA Suggestion - Smart suggestions provided by AVA
 */
@Entity('ava_suggestions')
@Index(['userId'])
@Index(['suggestionType'])
@Index(['targetEntity'])
@Index(['isAccepted'])
export class AVASuggestion {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'user_id', type: 'uuid' })
  userId!: string;

  @Column({ name: 'conversation_id', type: 'uuid', nullable: true })
  conversationId?: string;

  @Column({ name: 'suggestion_type', type: 'varchar', length: 50 })
  suggestionType!: SuggestionType;

  @Column({ name: 'target_entity', nullable: true })
  targetEntity?: string;

  @Column({ name: 'target_field', nullable: true })
  targetField?: string;

  @Column({ name: 'suggested_value', type: 'jsonb' })
  suggestedValue!: Record<string, unknown>;

  @Column({ type: 'text', nullable: true })
  explanation?: string;

  @Column({ type: 'decimal', precision: 5, scale: 4, nullable: true })
  confidence?: number;

  @Column({ name: 'is_accepted', type: 'boolean', nullable: true })
  isAccepted?: boolean;

  @Column({ name: 'user_feedback', type: 'text', nullable: true })
  userFeedback?: string;

  @Column({ name: 'response_time_ms', type: 'int', nullable: true })
  responseTimeMs?: number;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @Column({ name: 'responded_at', type: 'timestamptz', nullable: true })
  respondedAt?: Date;
}

/**
 * AVA Feedback - User feedback for learning
 */
@Entity('ava_feedback')
@Index(['userId'])
@Index(['messageId'])
@Index(['feedbackType'])
export class AVAFeedback {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'user_id', type: 'uuid' })
  userId!: string;

  @Column({ name: 'message_id', type: 'uuid', nullable: true })
  messageId?: string;

  @Column({ name: 'suggestion_id', type: 'uuid', nullable: true })
  suggestionId?: string;

  @Column({ name: 'feedback_type', type: 'varchar', length: 50 })
  feedbackType!: FeedbackType;

  @Column({ type: 'int', nullable: true })
  rating?: number;

  @Column({ type: 'text', nullable: true })
  comment?: string;

  @Column({ name: 'expected_response', type: 'text', nullable: true })
  expectedResponse?: string;

  @Column({ name: 'is_processed', default: false })
  isProcessed!: boolean;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;
}

/**
 * AVA Knowledge Embedding - Vector embeddings for knowledge search
 */
@Entity('ava_knowledge_embeddings')
@Index(['sourceType'])
@Index(['sourceId'])
export class AVAKnowledgeEmbedding {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'source_type', type: 'varchar', length: 50 })
  sourceType!: string;

  @Column({ name: 'source_id', type: 'uuid' })
  sourceId!: string;

  @Column({ name: 'content_hash', type: 'varchar', length: 64 })
  contentHash!: string;

  @Column({ type: 'text' })
  content!: string;

  @Column({ type: 'jsonb' })
  embedding!: number[];

  @Column({ name: 'embedding_model', type: 'varchar', length: 100 })
  embeddingModel!: string;

  @Column({ type: 'jsonb', nullable: true })
  metadata?: Record<string, unknown>;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}

/**
 * AVA Usage Metrics - Track AVA usage for analytics
 */
@Entity('ava_usage_metrics')
@Index(['userId'])
@Index(['metricDate'])
@Index(['metricType'])
export class AVAUsageMetrics {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'user_id', type: 'uuid', nullable: true })
  userId?: string;

  @Column({ name: 'metric_date', type: 'date' })
  metricDate!: Date;

  @Column({ name: 'metric_type', type: 'varchar', length: 100 })
  metricType!: string;

  @Column({ name: 'metric_value', type: 'decimal', precision: 15, scale: 4 })
  metricValue!: number;

  @Column({ type: 'jsonb', nullable: true })
  dimensions?: Record<string, unknown>;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;
}
