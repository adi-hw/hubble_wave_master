import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

export type AuditEventCategory =
  | 'authentication'
  | 'authorization'
  | 'data_access'
  | 'data_modification'
  | 'configuration'
  | 'security'
  | 'system'
  | 'integration'
  | 'workflow'
  | 'ai';

export type AuditSeverity = 'info' | 'warning' | 'critical' | 'security';

/**
 * Advanced Audit Configuration
 * Controls what gets audited, retention, and export settings
 */
@Entity('audit_configs')
export class AuditConfig {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ length: 100 })
  name!: string;

  @Column({ default: true })
  isActive!: boolean;

  // Categories to audit
  @Column({ type: 'simple-array', default: '' })
  enabledCategories!: AuditEventCategory[];

  // Severity threshold (only log events at or above this level)
  @Column({ type: 'varchar', length: 20, default: 'info' })
  severityThreshold!: AuditSeverity;

  // Retention settings
  @Column({ type: 'int', default: 90 })
  retentionDays!: number;

  @Column({ type: 'int', nullable: true })
  maxRecordsPerDay?: number;

  // Archive settings
  @Column({ default: false })
  archiveEnabled!: boolean;

  @Column({ type: 'int', nullable: true })
  archiveAfterDays?: number;

  @Column({ type: 'varchar', length: 50, nullable: true })
  archiveDestination?: string; // 's3', 'azure_blob', 'gcs', 'local'

  @Column({ type: 'jsonb', nullable: true })
  archiveConfig?: {
    bucket?: string;
    prefix?: string;
    region?: string;
    encryptionKey?: string;
  };

  // Real-time alerting
  @Column({ default: false })
  alertingEnabled!: boolean;

  @Column({ type: 'jsonb', default: [] })
  alertRules!: Array<{
    id: string;
    name: string;
    condition: {
      category?: AuditEventCategory;
      severity?: AuditSeverity;
      action?: string;
      pattern?: string;
      threshold?: number;
      timeWindowMinutes?: number;
    };
    channels: Array<{
      type: 'email' | 'webhook' | 'slack' | 'teams';
      target: string;
    }>;
    enabled: boolean;
  }>;

  // SIEM integration
  @Column({ default: false })
  siemEnabled!: boolean;

  @Column({ type: 'varchar', length: 50, nullable: true })
  siemProvider?: string; // 'splunk', 'elastic', 'sentinel', 'qradar'

  @Column({ type: 'jsonb', nullable: true })
  siemConfig?: {
    endpoint?: string;
    apiKey?: string;
    index?: string;
    format?: 'json' | 'cef' | 'leef';
  };

  // PII masking
  @Column({ default: true })
  maskPii!: boolean;

  @Column({ type: 'simple-array', nullable: true })
  piiFields?: string[];

  // Immutability settings
  @Column({ default: true })
  immutable!: boolean;

  @Column({ default: false })
  requireDigitalSignature!: boolean;

  @CreateDateColumn({ type: 'timestamp with time zone' })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'timestamp with time zone' })
  updatedAt!: Date;
}

/**
 * Enhanced Audit Log Entry
 * Comprehensive audit trail with compliance support
 */
@Entity('audit_entries')
@Index(['category', 'createdAt'])
@Index(['userId', 'createdAt'])
@Index(['resourceType', 'resourceId'])
@Index(['severity', 'createdAt'])
@Index(['sessionId'])
export class AuditEntry {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'varchar', length: 30 })
  category!: AuditEventCategory;

  @Column({ type: 'varchar', length: 20, default: 'info' })
  severity!: AuditSeverity;

  @Column({ length: 100 })
  action!: string;

  @Column({ type: 'text', nullable: true })
  description?: string;

  // Actor information
  @Column({ type: 'uuid', nullable: true })
  userId?: string;

  @Column({ length: 255, nullable: true })
  userEmail?: string;

  @Column({ length: 255, nullable: true })
  userDisplayName?: string;

  @Column({ type: 'varchar', length: 50, nullable: true })
  actorType?: string; // 'user', 'system', 'automation', 'integration', 'api'

  @Column({ type: 'uuid', nullable: true })
  sessionId?: string;

  @Column({ type: 'uuid', nullable: true })
  ssoSessionId?: string;

  // Resource information
  @Column({ length: 100, nullable: true })
  resourceType?: string;

  @Column({ type: 'uuid', nullable: true })
  resourceId?: string;

  @Column({ length: 255, nullable: true })
  resourceName?: string;

  // Change tracking
  @Column({ type: 'jsonb', nullable: true })
  previousValues?: Record<string, unknown>;

  @Column({ type: 'jsonb', nullable: true })
  newValues?: Record<string, unknown>;

  @Column({ type: 'jsonb', nullable: true })
  changedFields?: string[];

  // Request context
  @Column({ type: 'varchar', length: 45, nullable: true })
  ipAddress?: string;

  @Column({ type: 'text', nullable: true })
  userAgent?: string;

  @Column({ type: 'varchar', length: 10, nullable: true })
  httpMethod?: string;

  @Column({ type: 'text', nullable: true })
  requestPath?: string;

  @Column({ type: 'int', nullable: true })
  responseStatus?: number;

  @Column({ type: 'int', nullable: true })
  durationMs?: number;

  // Geolocation (if available)
  @Column({ type: 'varchar', length: 2, nullable: true })
  geoCountry?: string;

  @Column({ length: 100, nullable: true })
  geoCity?: string;

  // Correlation
  @Column({ type: 'uuid', nullable: true })
  correlationId?: string;

  @Column({ type: 'uuid', nullable: true })
  parentEventId?: string;

  // Compliance metadata
  @Column({ type: 'simple-array', nullable: true })
  complianceFrameworks?: string[]; // 'gdpr', 'hipaa', 'sox', 'pci'

  @Column({ default: false })
  containsPii!: boolean;

  @Column({ type: 'jsonb', nullable: true })
  dataClassification?: {
    level: 'public' | 'internal' | 'confidential' | 'restricted';
    categories?: string[];
  };

  // Integrity
  @Column({ type: 'text', nullable: true })
  checksum?: string;

  @Column({ type: 'text', nullable: true })
  signature?: string;

  // Additional context
  @Column({ type: 'jsonb', nullable: true })
  metadata?: Record<string, unknown>;

  @Column({ type: 'text', nullable: true })
  errorMessage?: string;

  @Column({ type: 'text', nullable: true })
  stackTrace?: string;

  @CreateDateColumn({ type: 'timestamp with time zone' })
  @Index()
  createdAt!: Date;

  // Archived flag for retention management
  @Column({ default: false })
  isArchived!: boolean;

  @Column({ type: 'timestamp with time zone', nullable: true })
  archivedAt?: Date;
}

/**
 * Audit Report Definition
 * Pre-defined and custom audit reports
 */
@Entity('audit_reports')
export class AuditReport {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ length: 100 })
  name!: string;

  @Column({ type: 'text', nullable: true })
  description?: string;

  @Column({ type: 'varchar', length: 50, default: 'custom' })
  reportType!: string; // 'login_activity', 'data_changes', 'security_events', 'compliance', 'custom'

  @Column({ default: true })
  isActive!: boolean;

  @Column({ default: false })
  isSystem!: boolean;

  // Query configuration
  @Column({ type: 'jsonb' })
  filters!: {
    categories?: AuditEventCategory[];
    severities?: AuditSeverity[];
    actions?: string[];
    resourceTypes?: string[];
    dateRange?: {
      type: 'relative' | 'absolute';
      days?: number;
      startDate?: string;
      endDate?: string;
    };
    userIds?: string[];
  };

  @Column({ type: 'jsonb', nullable: true })
  groupBy?: string[];

  @Column({ type: 'jsonb', nullable: true })
  aggregations?: Array<{
    field: string;
    function: 'count' | 'sum' | 'avg' | 'min' | 'max';
    alias: string;
  }>;

  // Scheduling
  @Column({ default: false })
  scheduleEnabled!: boolean;

  @Column({ type: 'varchar', length: 100, nullable: true })
  scheduleExpression?: string; // cron expression

  @Column({ type: 'simple-array', nullable: true })
  scheduleRecipients?: string[];

  @Column({ type: 'varchar', length: 20, nullable: true })
  exportFormat?: string; // 'pdf', 'csv', 'xlsx', 'json'

  @Column({ type: 'timestamp with time zone', nullable: true })
  lastRunAt?: Date;

  @Column({ type: 'timestamp with time zone', nullable: true })
  nextRunAt?: Date;

  @CreateDateColumn({ type: 'timestamp with time zone' })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'timestamp with time zone' })
  updatedAt!: Date;

  @Column({ type: 'uuid', nullable: true })
  createdBy?: string;
}
