import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
  ManyToOne,
  OneToMany,
  JoinColumn,
} from 'typeorm';
import { User } from './user.entity';

// ============================================================
// Phase 7: Revolutionary Features Entities
// ============================================================

// ─────────────────────────────────────────────────────────────────
// SECTION 1: AVA-Powered Agile Development
// ─────────────────────────────────────────────────────────────────

export type SprintRecordingStatus = 'pending' | 'processing' | 'analyzed' | 'archived';
export type StoryType = 'feature' | 'enhancement' | 'bug' | 'chore';
export type StoryPriority = 'critical' | 'high' | 'medium' | 'low';
export type StoryStatus = 'draft' | 'approved' | 'in_progress' | 'done';
export type ArtifactType = 'collection' | 'property' | 'rule' | 'flow' | 'view';

/**
 * Sprint Recording - Stores uploaded sprint planning recordings
 */
@Entity('sprint_recordings')
@Index(['status'])
@Index(['recordedAt'])
@Index(['recordedBy'])
export class SprintRecording {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'varchar', length: 255 })
  title!: string;

  @Column({ name: 'recording_url', type: 'varchar', length: 500, nullable: true })
  recordingUrl?: string | null;

  @Column({ type: 'text', nullable: true })
  transcript?: string | null;

  @Column({ name: 'duration_seconds', type: 'int', nullable: true })
  durationSeconds?: number | null;

  @Column({ name: 'recorded_at', type: 'timestamptz' })
  recordedAt!: Date;

  @Column({ name: 'recorded_by', type: 'uuid', nullable: true })
  recordedBy?: string | null;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'recorded_by' })
  recordedByUser?: User | null;

  @Column({ type: 'varchar', length: 20, default: 'pending' })
  status!: SprintRecordingStatus;

  @Column({ type: 'jsonb', nullable: true })
  analysis?: Record<string, unknown> | null;

  @OneToMany(() => AvaStory, story => story.recording)
  stories?: AvaStory[];

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}

/**
 * AVA Story - AI-generated user stories from recordings
 */
@Entity('ava_stories')
@Index(['recordingId'])
@Index(['status'])
@Index(['priority'])
export class AvaStory {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'recording_id', type: 'uuid', nullable: true })
  recordingId?: string | null;

  @ManyToOne(() => SprintRecording, recording => recording.stories, { nullable: true, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'recording_id' })
  recording?: SprintRecording | null;

  @Column({ type: 'varchar', length: 255 })
  title!: string;

  @Column({ type: 'text', nullable: true })
  description?: string | null;

  @Column({ name: 'story_type', type: 'varchar', length: 50, nullable: true })
  storyType?: StoryType | null;

  @Column({ type: 'varchar', length: 20, nullable: true })
  priority?: StoryPriority | null;

  @Column({ name: 'estimated_points', type: 'int', nullable: true })
  estimatedPoints?: number | null;

  @Column({ name: 'acceptance_criteria', type: 'jsonb', nullable: true })
  acceptanceCriteria?: Array<{ criterion: string; testable: boolean }> | null;

  @Column({ name: 'suggested_collections', type: 'jsonb', nullable: true })
  suggestedCollections?: Array<{
    code: string;
    name: string;
    properties: Array<{ code: string; type: string; ref?: string }>;
  }> | null;

  @Column({ name: 'suggested_rules', type: 'jsonb', nullable: true })
  suggestedRules?: Array<{
    trigger: string;
    condition: string;
    action: string;
  }> | null;

  @Column({ name: 'suggested_flows', type: 'jsonb', nullable: true })
  suggestedFlows?: Record<string, unknown>[] | null;

  @Column({ type: 'varchar', length: 20, default: 'draft' })
  status!: StoryStatus;

  @Column({ name: 'approved_by', type: 'uuid', nullable: true })
  approvedBy?: string | null;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'approved_by' })
  approvedByUser?: User | null;

  @Column({ name: 'approved_at', type: 'timestamptz', nullable: true })
  approvedAt?: Date | null;

  @OneToMany(() => StoryImplementation, impl => impl.story)
  implementations?: StoryImplementation[];

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}

/**
 * Story Implementation - Tracks artifacts created from stories
 */
@Entity('story_implementations')
@Index(['storyId'])
@Index(['artifactType', 'artifactId'])
export class StoryImplementation {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'story_id', type: 'uuid' })
  storyId!: string;

  @ManyToOne(() => AvaStory, story => story.implementations, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'story_id' })
  story!: AvaStory;

  @Column({ name: 'artifact_type', type: 'varchar', length: 50 })
  artifactType!: ArtifactType;

  @Column({ name: 'artifact_id', type: 'uuid' })
  artifactId!: string;

  @Column({ name: 'generated_by_ava', default: true })
  generatedByAva!: boolean;

  @Column({ name: 'manual_modifications', type: 'jsonb', nullable: true })
  manualModifications?: Record<string, unknown> | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;
}

// ─────────────────────────────────────────────────────────────────
// SECTION 2: Intelligent Upgrade Assistant
// ─────────────────────────────────────────────────────────────────

export type CustomizationType = 'collection' | 'property' | 'rule' | 'flow' | 'script' | 'access_rule';
export type AnalysisStatus = 'pending' | 'running' | 'complete' | 'failed';
export type FixType = 'auto' | 'manual' | 'recommended';

// Enums for service layer
export enum ImpactSeverity {
  NONE = 'none',
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  CRITICAL = 'critical',
}

export enum FixStatus {
  PENDING = 'pending',
  APPLIED = 'applied',
  REJECTED = 'rejected',
  SKIPPED = 'skipped',
}

/**
 * Customization Registry - Tracks all customizations for upgrade analysis
 */
@Entity('customization_registry')
@Index(['customizationType'])
@Index(['artifactId'])
@Index(['customizationType', 'artifactId'], { unique: true })
export class CustomizationRegistry {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'customization_type', type: 'varchar', length: 50 })
  customizationType!: CustomizationType;

  @Column({ name: 'artifact_id', type: 'uuid' })
  artifactId!: string;

  @Column({ name: 'artifact_code', type: 'varchar', length: 100, nullable: true })
  artifactCode?: string | null;

  @Column({ name: 'is_system_modified', default: false })
  isSystemModified!: boolean;

  @Column({ name: 'original_hash', type: 'varchar', length: 64, nullable: true })
  originalHash?: string | null;

  @Column({ name: 'current_hash', type: 'varchar', length: 64, nullable: true })
  currentHash?: string | null;

  @Column({ type: 'jsonb', default: () => `'[]'` })
  dependencies!: string[];

  @Column({ type: 'jsonb', default: () => `'[]'` })
  dependents!: string[];

  @Column({ name: 'platform_version_created', type: 'varchar', length: 20, nullable: true })
  platformVersionCreated?: string | null;

  @Column({ name: 'last_analyzed_version', type: 'varchar', length: 20, nullable: true })
  lastAnalyzedVersion?: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}

/**
 * Upgrade Impact Analysis - Results of upgrade compatibility analysis
 */
@Entity('upgrade_impact_analyses')
@Index(['fromVersion', 'toVersion'])
@Index(['analysisStatus'])
export class UpgradeImpactAnalysis {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'from_version', type: 'varchar', length: 20 })
  fromVersion!: string;

  @Column({ name: 'to_version', type: 'varchar', length: 20 })
  toVersion!: string;

  @Column({ name: 'analysis_status', type: 'varchar', length: 20, default: 'pending' })
  analysisStatus!: AnalysisStatus;

  @Column({ name: 'total_customizations', type: 'int', nullable: true })
  totalCustomizations?: number | null;

  @Column({ name: 'breaking_count', type: 'int', nullable: true })
  breakingCount?: number | null;

  @Column({ name: 'warning_count', type: 'int', nullable: true })
  warningCount?: number | null;

  @Column({ name: 'safe_count', type: 'int', nullable: true })
  safeCount?: number | null;

  @Column({ name: 'impact_details', type: 'jsonb', nullable: true })
  impactDetails?: Array<{
    customizationId: string;
    severity: 'breaking' | 'warning' | 'safe';
    description: string;
    autoFixable: boolean;
    suggestedFix?: string;
  }> | null;

  @Column({ name: 'ava_recommendations', type: 'text', nullable: true })
  avaRecommendations?: string | null;

  @Column({ name: 'auto_fixable_count', type: 'int', nullable: true })
  autoFixableCount?: number | null;

  @Column({ name: 'analyzed_at', type: 'timestamptz', nullable: true })
  analyzedAt?: Date | null;

  @Column({ name: 'analyzed_by', type: 'uuid', nullable: true })
  analyzedBy?: string | null;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'analyzed_by' })
  analyzedByUser?: User | null;

  @OneToMany(() => UpgradeFix, fix => fix.analysis)
  fixes?: UpgradeFix[];

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;
}

/**
 * Upgrade Fix - Auto-generated or manual fixes for upgrade issues
 */
@Entity('upgrade_fixes')
@Index(['analysisId'])
@Index(['customizationId'])
export class UpgradeFix {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'analysis_id', type: 'uuid' })
  analysisId!: string;

  @ManyToOne(() => UpgradeImpactAnalysis, analysis => analysis.fixes, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'analysis_id' })
  analysis!: UpgradeImpactAnalysis;

  @Column({ name: 'customization_id', type: 'uuid' })
  customizationId!: string;

  @ManyToOne(() => CustomizationRegistry, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'customization_id' })
  customization!: CustomizationRegistry;

  @Column({ name: 'fix_type', type: 'varchar', length: 20 })
  fixType!: FixType;

  @Column({ name: 'original_code', type: 'text', nullable: true })
  originalCode?: string | null;

  @Column({ name: 'fixed_code', type: 'text', nullable: true })
  fixedCode?: string | null;

  @Column({ name: 'fix_description', type: 'text', nullable: true })
  fixDescription?: string | null;

  @Column({ name: 'applied_by', type: 'uuid', nullable: true })
  appliedBy?: string | null;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'applied_by' })
  appliedByUser?: User | null;

  @Column({ name: 'applied_at', type: 'timestamptz', nullable: true })
  appliedAt?: Date | null;

  @Column({ name: 'rollback_available', default: true })
  rollbackAvailable!: boolean;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;
}

// ─────────────────────────────────────────────────────────────────
// SECTION 3: Living Documentation System
// ─────────────────────────────────────────────────────────────────

export type DocArtifactType = 'collection' | 'property' | 'rule' | 'flow' | 'access_rule' | 'view';

export interface DocContent {
  summary: string;
  purpose: string;
  properties?: Array<{
    code: string;
    name: string;
    type: string;
    description: string;
    validValues?: string[];
    businessRules?: string[];
  }>;
  relationships?: Array<{
    direction: 'incoming' | 'outgoing';
    relatedCollection: string;
    relationship: string;
    viaProperty: string;
  }>;
  automationRules?: Array<{
    name: string;
    trigger: string;
    description: string;
    affectedProperties: string[];
  }>;
  accessRules?: Array<{
    role: string;
    permissions: string[];
    conditions?: string;
  }>;
  apiExamples?: {
    list: string;
    get: string;
    create: string;
    update: string;
  };
}

/**
 * Generated Documentation - Auto-generated documentation for artifacts
 */
@Entity('generated_documentation')
@Index(['artifactType', 'artifactId'], { unique: true })
@Index(['artifactCode'])
export class GeneratedDocumentation {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'artifact_type', type: 'varchar', length: 50 })
  artifactType!: DocArtifactType;

  @Column({ name: 'artifact_id', type: 'uuid' })
  artifactId!: string;

  @Column({ name: 'artifact_code', type: 'varchar', length: 100, nullable: true })
  artifactCode?: string | null;

  @Column({ type: 'jsonb' })
  documentation!: DocContent;

  @Column({ name: 'search_text', type: 'text', nullable: true })
  searchText?: string | null;

  @Column({ default: 1 })
  version!: number;

  @Column({ name: 'generated_at', type: 'timestamptz', default: () => 'NOW()' })
  generatedAt!: Date;

  @Column({ name: 'generated_by', type: 'varchar', length: 50, default: 'ava' })
  generatedBy!: string;

  @OneToMany(() => DocumentationVersion, v => v.documentation)
  versions?: DocumentationVersion[];

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}

/**
 * Documentation Version - Version history for documentation
 */
@Entity('documentation_versions')
@Index(['documentationId', 'version'])
export class DocumentationVersion {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'documentation_id', type: 'uuid' })
  documentationId!: string;

  @ManyToOne(() => GeneratedDocumentation, doc => doc.versions, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'documentation_id' })
  documentation!: GeneratedDocumentation;

  @Column()
  version!: number;

  @Column({ type: 'jsonb' })
  content!: DocContent;

  @Column({ name: 'change_summary', type: 'text', nullable: true })
  changeSummary?: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;
}

// ─────────────────────────────────────────────────────────────────
// SECTION 4: Predictive Operations
// ─────────────────────────────────────────────────────────────────

export type InsightType = 'capacity' | 'security' | 'performance' | 'compliance' | 'usage';
export type InsightSeverity = 'info' | 'warning' | 'critical';
export type InsightStatus = 'open' | 'acknowledged' | 'resolved' | 'dismissed';
export type JobStatus = 'pending' | 'running' | 'completed' | 'failed';

/**
 * Predictive Insight - Proactive insights generated by AVA
 */
@Entity('predictive_insights')
@Index(['insightType'])
@Index(['severity'])
@Index(['status'])
@Index(['expiresAt'])
export class PredictiveInsight {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'insight_type', type: 'varchar', length: 50 })
  insightType!: InsightType;

  @Column({ type: 'varchar', length: 20 })
  severity!: InsightSeverity;

  @Column({ type: 'varchar', length: 255 })
  title!: string;

  @Column({ type: 'text' })
  description!: string;

  @Column({ name: 'affected_artifact_type', type: 'varchar', length: 50, nullable: true })
  affectedArtifactType?: string | null;

  @Column({ name: 'affected_artifact_id', type: 'uuid', nullable: true })
  affectedArtifactId?: string | null;

  @Column({ name: 'data_points', type: 'jsonb', nullable: true })
  dataPoints?: Record<string, unknown> | null;

  @Column({ name: 'suggested_actions', type: 'jsonb', nullable: true })
  suggestedActions?: Array<{
    action: string;
    description: string;
    autoApplicable: boolean;
    actionPayload?: Record<string, unknown>;
  }> | null;

  @Column({ type: 'varchar', length: 20, default: 'open' })
  status!: InsightStatus;

  @Column({ name: 'resolved_action', type: 'varchar', length: 100, nullable: true })
  resolvedAction?: string | null;

  @Column({ name: 'resolved_by', type: 'uuid', nullable: true })
  resolvedBy?: string | null;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'resolved_by' })
  resolvedByUser?: User | null;

  @Column({ name: 'resolved_at', type: 'timestamptz', nullable: true })
  resolvedAt?: Date | null;

  @Column({ name: 'expires_at', type: 'timestamptz', nullable: true })
  expiresAt?: Date | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;
}

/**
 * Insight Analysis Job - Scheduled jobs for insight generation
 */
@Entity('insight_analysis_jobs')
@Index(['jobType'], { unique: true })
@Index(['nextRunAt'])
export class InsightAnalysisJob {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'job_type', type: 'varchar', length: 50 })
  jobType!: InsightType;

  @Column({ name: 'last_run_at', type: 'timestamptz', nullable: true })
  lastRunAt?: Date | null;

  @Column({ name: 'next_run_at', type: 'timestamptz', nullable: true })
  nextRunAt?: Date | null;

  @Column({ name: 'run_frequency_hours', default: 24 })
  runFrequencyHours!: number;

  @Column({ type: 'varchar', length: 20, default: 'pending' })
  status!: JobStatus;

  @Column({ name: 'last_result', type: 'jsonb', nullable: true })
  lastResult?: Record<string, unknown> | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}

// ─────────────────────────────────────────────────────────────────
// SECTION 5: Digital Twins
// ─────────────────────────────────────────────────────────────────

export type SensorQuality = 'good' | 'uncertain' | 'bad';

export interface SensorMapping {
  sensorId: string;
  dataType: string;
  targetProperty: string;
  unit?: string;
  transform?: {
    type: 'scale' | 'offset' | 'formula';
    value: number | string;
  };
}

export type TwinStatus = 'active' | 'inactive' | 'error';

/**
 * Digital Twin - Virtual representation of physical assets
 */
@Entity('digital_twins')
@Index(['assetId'], { unique: true })
@Index(['isActive'])
@Index(['status'])
export class DigitalTwin {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'varchar', length: 255 })
  name!: string;

  @Column({ type: 'text', nullable: true })
  description?: string | null;

  @Column({ name: 'asset_id', type: 'varchar', length: 255 })
  assetId!: string;

  @Column({ name: 'asset_type', type: 'varchar', length: 100 })
  assetType!: string;

  @Column({ type: 'varchar', length: 20, default: 'active' })
  status!: TwinStatus;

  @Column({ name: 'model_url', type: 'text', nullable: true })
  modelUrl?: string | null;

  @Column({ name: 'model_version', type: 'varchar', length: 50, nullable: true })
  modelVersion?: string | null;

  @Column({ name: 'sync_interval', default: 1000 })
  syncInterval!: number;

  @Column({ name: 'sensor_mappings', type: 'jsonb', default: () => `'[]'` })
  sensorMappings!: SensorMapping[];

  @Column({ type: 'jsonb', default: () => `'{}'` })
  state!: Record<string, unknown>;

  @Column({ name: 'is_active', default: true })
  isActive!: boolean;

  @Column({ name: 'last_sync_at', type: 'timestamptz', nullable: true })
  lastSyncAt?: Date | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}

/**
 * Sensor Reading - Time-series sensor data
 */
@Entity('sensor_readings')
@Index(['assetId', 'timestamp'])
@Index(['sensorId', 'timestamp'])
export class SensorReading {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'asset_id', type: 'varchar', length: 255 })
  assetId!: string;

  @Column({ name: 'sensor_id', type: 'varchar', length: 255 })
  sensorId!: string;

  @Column({ name: 'data_type', type: 'varchar', length: 100, nullable: true })
  dataType?: string | null;

  @Column({ type: 'decimal', precision: 20, scale: 6, nullable: true })
  value?: number | null;

  @Column({ type: 'varchar', length: 50, nullable: true })
  unit?: string | null;

  @Column({ type: 'varchar', length: 20, default: 'good' })
  quality!: SensorQuality;

  @Column({ type: 'timestamptz', default: () => 'NOW()' })
  timestamp!: Date;
}

// ─────────────────────────────────────────────────────────────────
// SECTION 6: Self-Healing Infrastructure
// ─────────────────────────────────────────────────────────────────

export type ServiceStatus = 'healthy' | 'degraded' | 'unhealthy' | 'unknown';
export type EventType = 'health_check' | 'recovery_triggered' | 'recovery_completed' | 'recovery_failed' | 'alert';
export type RecoveryActionType = 'restart' | 'scale_up' | 'scale_down' | 'circuit_break' | 'failover' | 'rollback';

/**
 * Self-Healing Event - Records self-healing actions and their outcomes
 */
@Entity('self_healing_events')
@Index(['serviceName', 'createdAt'])
@Index(['eventType'])
export class SelfHealingEvent {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'service_name', type: 'varchar', length: 255 })
  serviceName!: string;

  @Column({ name: 'event_type', type: 'varchar', length: 100 })
  eventType!: EventType;

  @Column({ name: 'action_taken', type: 'varchar', length: 255, nullable: true })
  actionTaken?: string | null;

  @Column({ type: 'text', nullable: true })
  reason?: string | null;

  @Column({ type: 'boolean', nullable: true })
  success?: boolean | null;

  @Column({ type: 'jsonb', nullable: true })
  metrics?: Record<string, unknown> | null;

  @Column({ name: 'duration_ms', type: 'int', nullable: true })
  durationMs?: number | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;
}

/**
 * Service Health Status - Current health state of services
 */
@Entity('service_health_status')
@Index(['status'])
export class ServiceHealthStatus {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'service_name', type: 'varchar', length: 255, unique: true })
  serviceName!: string;

  @Column({ type: 'varchar', length: 20, default: 'unknown' })
  status!: ServiceStatus;

  @Column({ name: 'cpu_usage', type: 'decimal', precision: 5, scale: 2, nullable: true })
  cpuUsage?: number | null;

  @Column({ name: 'memory_usage', type: 'decimal', precision: 5, scale: 2, nullable: true })
  memoryUsage?: number | null;

  @Column({ name: 'error_rate', type: 'decimal', precision: 5, scale: 2, nullable: true })
  errorRate?: number | null;

  @Column({ name: 'response_time_ms', type: 'int', nullable: true })
  responseTimeMs?: number | null;

  @Column({ name: 'replica_count', type: 'int', nullable: true })
  replicaCount?: number | null;

  @Column({ name: 'last_check_at', type: 'timestamptz', nullable: true })
  lastCheckAt?: Date | null;

  @Column({ name: 'health_history', type: 'jsonb', default: () => `'[]'` })
  healthHistory!: Array<{
    status: ServiceStatus;
    timestamp: string;
    metrics?: Record<string, unknown>;
  }>;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}

/**
 * Recovery Action - Configured automated recovery actions
 */
@Entity('recovery_actions')
@Index(['targetService'])
@Index(['isActive'])
export class RecoveryAction {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'varchar', length: 255 })
  name!: string;

  @Column({ name: 'action_type', type: 'varchar', length: 50 })
  actionType!: RecoveryActionType;

  @Column({ name: 'target_service', type: 'varchar', length: 255, nullable: true })
  targetService?: string | null;

  @Column({ name: 'trigger_conditions', type: 'jsonb' })
  triggerConditions!: {
    metric: string;
    operator: 'gt' | 'lt' | 'eq' | 'gte' | 'lte';
    threshold: number;
    duration?: number;
  };

  @Column({ name: 'action_config', type: 'jsonb' })
  actionConfig!: Record<string, unknown>;

  @Column({ name: 'is_active', default: true })
  isActive!: boolean;

  @Column({ name: 'last_triggered_at', type: 'timestamptz', nullable: true })
  lastTriggeredAt?: Date | null;

  @Column({ name: 'trigger_count', default: 0 })
  triggerCount!: number;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}

// ─────────────────────────────────────────────────────────────────
// SECTION 7: AI Reports
// ─────────────────────────────────────────────────────────────────

export type ReportStatus = 'pending' | 'generating' | 'completed' | 'failed';
export type ReportFormat = 'pdf' | 'excel' | 'powerpoint' | 'json' | 'html';

/**
 * AI Report - Natural language generated reports
 */
@Entity('ai_reports')
@Index(['generatedBy', 'createdAt'])
@Index(['status'])
export class AIReport {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'varchar', length: 500, nullable: true })
  title?: string | null;

  @Column({ type: 'text' })
  prompt!: string;

  @Column({ name: 'parsed_intent', type: 'jsonb', nullable: true })
  parsedIntent?: Record<string, unknown> | null;

  @Column({ type: 'jsonb' })
  definition!: {
    dataSource: {
      collections: string[];
      query?: Record<string, unknown>;
    };
    columns: Array<{
      property: string;
      aggregate?: 'sum' | 'avg' | 'count' | 'min' | 'max';
    }>;
    groupBy?: string[];
    charts?: Array<{
      type: 'bar' | 'line' | 'pie' | 'table';
      title: string;
      config: Record<string, unknown>;
    }>;
    insights?: string[];
  };

  @Column({ type: 'varchar', length: 50, nullable: true })
  format?: ReportFormat | null;

  @Column({ type: 'varchar', length: 20, default: 'pending' })
  status!: ReportStatus;

  @Column({ name: 'generated_file_url', type: 'text', nullable: true })
  generatedFileUrl?: string | null;

  @Column({ name: 'generated_by', type: 'uuid', nullable: true })
  generatedBy?: string | null;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'generated_by' })
  generatedByUser?: User | null;

  @Column({ name: 'generation_time_ms', type: 'int', nullable: true })
  generationTimeMs?: number | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}

/**
 * AI Report Template - Reusable report templates
 */
@Entity('ai_report_templates')
@Index(['category'])
@Index(['isPublic'])
export class AIReportTemplate {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'varchar', length: 255 })
  name!: string;

  @Column({ type: 'text', nullable: true })
  description?: string | null;

  @Column({ type: 'varchar', length: 100, nullable: true })
  category?: string | null;

  @Column({ name: 'base_prompt', type: 'text', nullable: true })
  basePrompt?: string | null;

  @Column({ name: 'schema_hints', type: 'jsonb', nullable: true })
  schemaHints?: Record<string, unknown> | null;

  @Column({ name: 'chart_preferences', type: 'jsonb', nullable: true })
  chartPreferences?: Record<string, unknown> | null;

  @Column({ name: 'is_public', default: false })
  isPublic!: boolean;

  @Column({ name: 'created_by', type: 'uuid', nullable: true })
  createdBy?: string | null;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'created_by' })
  createdByUser?: User | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;
}

// ─────────────────────────────────────────────────────────────────
// SECTION 8: Natural Language Queries
// ─────────────────────────────────────────────────────────────────

/**
 * NL Query - Natural language query history
 */
@Entity('nl_queries')
@Index(['userId', 'createdAt'])
export class NLQuery {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'user_id', type: 'uuid', nullable: true })
  userId?: string | null;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'user_id' })
  user?: User | null;

  @Column({ name: 'query_text', type: 'text' })
  queryText!: string;

  @Column({ name: 'parsed_intent', type: 'jsonb', nullable: true })
  parsedIntent?: Record<string, unknown> | null;

  @Column({ name: 'generated_sql', type: 'text', nullable: true })
  generatedSql?: string | null;

  @Column({ name: 'result_count', type: 'int', nullable: true })
  resultCount?: number | null;

  @Column({ type: 'decimal', precision: 3, scale: 2, nullable: true })
  confidence?: number | null;

  @Column({ name: 'execution_time_ms', type: 'int', nullable: true })
  executionTimeMs?: number | null;

  @Column({ name: 'error_message', type: 'text', nullable: true })
  errorMessage?: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;
}

/**
 * Saved NL Query - User's saved queries
 */
@Entity('saved_nl_queries')
@Index(['userId'])
@Index(['userId', 'isFavorite'])
export class SavedNLQuery {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'user_id', type: 'uuid', nullable: true })
  userId?: string | null;

  @ManyToOne(() => User, { nullable: true, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user?: User | null;

  @Column({ type: 'varchar', length: 255 })
  name!: string;

  @Column({ name: 'query_text', type: 'text' })
  queryText!: string;

  @Column({ name: 'is_favorite', default: false })
  isFavorite!: boolean;

  @Column({ name: 'usage_count', default: 0 })
  usageCount!: number;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;
}

// ─────────────────────────────────────────────────────────────────
// SECTION 9: Zero-Code App Builder
// ─────────────────────────────────────────────────────────────────

export interface AppDefinition {
  pages: Array<{
    id: string;
    name: string;
    route: string;
    layout: {
      type: 'grid' | 'flex' | 'stack';
      config: Record<string, unknown>;
    };
    components: AppComponent[];
  }>;
  navigation?: {
    type: 'sidebar' | 'topbar' | 'none';
    items: Array<{
      pageId: string;
      label: string;
      icon?: string;
    }>;
  };
  theme?: Record<string, unknown>;
  dataSources?: Record<string, unknown>;
}

export interface AppComponent {
  id: string;
  type: string;
  props: Record<string, unknown>;
  children?: AppComponent[];
  bindings?: Record<string, string>;
  events?: Record<string, string>;
}

export enum AppStatus {
  DRAFT = 'draft',
  BUILDING = 'building',
  ACTIVE = 'active',
  INACTIVE = 'inactive',
  FAILED = 'failed',
  ARCHIVED = 'archived',
}

/**
 * Zero-Code App - User-built applications
 */
@Entity('zero_code_apps')
@Index(['isPublished'])
@Index(['createdBy'])
@Index(['category'])
export class ZeroCodeApp {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'varchar', length: 255 })
  name!: string;

  @Column({ type: 'text', nullable: true })
  description?: string | null;

  @Column({ type: 'varchar', length: 50, default: '1.0.0' })
  version!: string;

  @Column({ type: 'jsonb' })
  definition!: AppDefinition;

  @Column({ name: 'is_published', default: false })
  isPublished!: boolean;

  @Column({ name: 'published_version', type: 'varchar', length: 50, nullable: true })
  publishedVersion?: string | null;

  @Column({ type: 'varchar', length: 100, nullable: true })
  icon?: string | null;

  @Column({ type: 'varchar', length: 100, nullable: true })
  category?: string | null;

  @Column({ name: 'created_by', type: 'uuid', nullable: true })
  createdBy?: string | null;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'created_by' })
  createdByUser?: User | null;

  @OneToMany(() => ZeroCodeAppVersion, v => v.app)
  versions?: ZeroCodeAppVersion[];

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;

  @Column({ name: 'published_at', type: 'timestamptz', nullable: true })
  publishedAt?: Date | null;
}

/**
 * Zero-Code App Version - Version history for apps
 */
@Entity('zero_code_app_versions')
@Index(['appId', 'createdAt'])
export class ZeroCodeAppVersion {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'app_id', type: 'uuid' })
  appId!: string;

  @ManyToOne(() => ZeroCodeApp, app => app.versions, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'app_id' })
  app!: ZeroCodeApp;

  @Column({ type: 'varchar', length: 50 })
  version!: string;

  @Column({ type: 'jsonb' })
  definition!: AppDefinition;

  @Column({ name: 'change_summary', type: 'text', nullable: true })
  changeSummary?: string | null;

  @Column({ name: 'created_by', type: 'uuid', nullable: true })
  createdBy?: string | null;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'created_by' })
  createdByUser?: User | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;
}

/**
 * App Builder Component - Available components for app building
 */
@Entity('app_builder_components')
@Index(['category'])
@Index(['componentType'])
export class AppBuilderComponent {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'varchar', length: 255 })
  name!: string;

  @Column({ type: 'varchar', length: 100 })
  category!: string;

  @Column({ name: 'component_type', type: 'varchar', length: 100 })
  componentType!: string;

  @Column({ name: 'default_props', type: 'jsonb' })
  defaultProps!: Record<string, unknown>;

  @Column({ type: 'jsonb' })
  schema!: {
    properties: Record<string, {
      type: string;
      title: string;
      default?: unknown;
      enum?: unknown[];
    }>;
    required?: string[];
  };

  @Column({ type: 'varchar', length: 100, nullable: true })
  icon?: string | null;

  @Column({ name: 'is_system', default: false })
  isSystem!: boolean;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;
}

// ─────────────────────────────────────────────────────────────────
// SECTION 10: Voice Control
// ─────────────────────────────────────────────────────────────────

export type VoiceIntent = 'navigate' | 'search' | 'create' | 'update' | 'report' | 'help' | 'unknown';

export enum VoiceCommandStatus {
  PROCESSING = 'processing',
  COMPLETED = 'completed',
  FAILED = 'failed',
  NEEDS_CLARIFICATION = 'needs_clarification',
}

/**
 * Voice Command - Recorded voice commands
 */
@Entity('voice_commands')
@Index(['userId', 'createdAt'])
@Index(['sessionId'])
@Index(['intent'])
export class VoiceCommand {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'user_id', type: 'uuid', nullable: true })
  userId?: string | null;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'user_id' })
  user?: User | null;

  @Column({ name: 'session_id', type: 'uuid', nullable: true })
  sessionId?: string | null;

  @Column({ name: 'command_text', type: 'text' })
  commandText!: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  intent?: VoiceIntent | null;

  @Column({ type: 'jsonb', nullable: true })
  entities?: Record<string, unknown> | null;

  @Column({ type: 'decimal', precision: 3, scale: 2, nullable: true })
  confidence?: number | null;

  @Column({ default: false })
  executed!: boolean;

  @Column({ name: 'execution_result', type: 'jsonb', nullable: true })
  executionResult?: Record<string, unknown> | null;

  @Column({ name: 'audio_duration_ms', type: 'int', nullable: true })
  audioDurationMs?: number | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;
}

/**
 * Voice Command Pattern - Patterns for intent recognition
 */
@Entity('voice_command_patterns')
@Index(['intent'], { unique: true })
@Index(['isActive'])
export class VoiceCommandPattern {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'varchar', length: 255 })
  intent!: string;

  @Column({ type: 'jsonb' })
  patterns!: string[];

  @Column({ name: 'action_type', type: 'varchar', length: 100 })
  actionType!: string;

  @Column({ name: 'action_config', type: 'jsonb' })
  actionConfig!: Record<string, unknown>;

  @Column({ type: 'text', array: true, nullable: true })
  examples?: string[] | null;

  @Column({ name: 'is_active', default: true })
  isActive!: boolean;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;
}

// ─────────────────────────────────────────────────────────────────
// SECTION 11: Predictive UI
// ─────────────────────────────────────────────────────────────────

export type UserAction = 'click' | 'view' | 'create' | 'update' | 'delete' | 'search' | 'export' | 'filter';
export type SuggestionType = 'navigation' | 'action' | 'filter' | 'shortcut' | 'tip';

export enum BehaviorType {
  CLICK = 'click',
  VIEW = 'view',
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  SEARCH = 'search',
  EXPORT = 'export',
  FILTER = 'filter',
  NAVIGATE = 'navigate',
}

export enum SuggestionStatus {
  PENDING = 'pending',
  ACCEPTED = 'accepted',
  DISMISSED = 'dismissed',
  EXPIRED = 'expired',
}

export enum PatternType {
  FREQUENT_ACTION = 'frequent_action',
  SEQUENCE = 'sequence',
  TIME_BASED = 'time_based',
  CONTEXT_BASED = 'context_based',
}

/**
 * User Behavior - Tracks user actions for pattern analysis
 */
@Entity('user_behaviors')
@Index(['userId', 'timestamp'])
@Index(['action'])
@Index(['route'])
export class UserBehavior {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'user_id', type: 'uuid' })
  userId!: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user!: User;

  @Column({ type: 'varchar', length: 255 })
  action!: UserAction;

  @Column({ type: 'jsonb', nullable: true })
  context?: Record<string, unknown> | null;

  @Column({ type: 'varchar', length: 500, nullable: true })
  route?: string | null;

  @Column({ name: 'target_entity_type', type: 'varchar', length: 100, nullable: true })
  targetEntityType?: string | null;

  @Column({ name: 'target_entity_id', type: 'uuid', nullable: true })
  targetEntityId?: string | null;

  @Column({ name: 'duration_ms', type: 'int', nullable: true })
  durationMs?: number | null;

  @Column({ type: 'timestamptz', default: () => 'NOW()' })
  timestamp!: Date;
}

/**
 * Predictive Suggestion - AI-generated UI suggestions
 */
@Entity('predictive_suggestions')
@Index(['userId', 'shownAt'])
@Index(['suggestionType'])
export class PredictiveSuggestion {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'user_id', type: 'uuid', nullable: true })
  userId?: string | null;

  @ManyToOne(() => User, { nullable: true, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user?: User | null;

  @Column({ name: 'suggestion_type', type: 'varchar', length: 100, nullable: true })
  suggestionType?: SuggestionType | null;

  @Column({ type: 'text', nullable: true })
  label?: string | null;

  @Column({ type: 'text', nullable: true })
  description?: string | null;

  @Column({ name: 'action_type', type: 'varchar', length: 100, nullable: true })
  actionType?: string | null;

  @Column({ name: 'action_payload', type: 'jsonb', nullable: true })
  actionPayload?: Record<string, unknown> | null;

  @Column({ type: 'decimal', precision: 3, scale: 2, nullable: true })
  confidence?: number | null;

  @Column({ type: 'boolean', nullable: true })
  accepted?: boolean | null;

  @Column({ type: 'boolean', default: false })
  dismissed!: boolean;

  @Column({ name: 'context_route', type: 'varchar', length: 500, nullable: true })
  contextRoute?: string | null;

  @Column({ name: 'shown_at', type: 'timestamptz', default: () => 'NOW()' })
  shownAt!: Date;

  @Column({ name: 'responded_at', type: 'timestamptz', nullable: true })
  respondedAt?: Date | null;
}

/**
 * User Pattern - Detected behavioral patterns
 */
@Entity('user_patterns')
@Index(['userId', 'patternType'])
@Index(['patternType'])
export class UserPattern {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'user_id', type: 'uuid' })
  userId!: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user!: User;

  @Column({ name: 'pattern_type', type: 'varchar', length: 100 })
  patternType!: string;

  @Column({ name: 'pattern_data', type: 'jsonb' })
  patternData!: {
    sequence?: string[];
    frequency?: number;
    timeOfDay?: string;
    dayOfWeek?: number;
    filters?: Record<string, unknown>;
    preferences?: Record<string, unknown>;
  };

  @Column({ type: 'decimal', precision: 3, scale: 2, nullable: true })
  confidence?: number | null;

  @Column({ name: 'occurrence_count', default: 1 })
  occurrenceCount!: number;

  @Column({ name: 'last_occurrence_at', type: 'timestamptz', nullable: true })
  lastOccurrenceAt?: Date | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}
