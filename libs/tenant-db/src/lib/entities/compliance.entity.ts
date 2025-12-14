import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

export type ComplianceFramework =
  | 'gdpr'
  | 'hipaa'
  | 'sox'
  | 'pci_dss'
  | 'iso_27001'
  | 'nist'
  | 'fedramp'
  | 'ccpa'
  | 'custom';

export type PolicyStatus = 'draft' | 'active' | 'deprecated' | 'archived';

export type EnforcementAction = 'block' | 'warn' | 'log' | 'notify' | 'quarantine';

export type DataClassificationLevel =
  | 'public'
  | 'internal'
  | 'confidential'
  | 'restricted'
  | 'top_secret';

/**
 * Compliance Framework Configuration
 * Defines which compliance frameworks are enabled and their settings
 */
@Entity('compliance_frameworks')
export class ComplianceFrameworkConfig {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'varchar', length: 30 })
  @Index()
  framework!: ComplianceFramework;

  @Column({ length: 100 })
  name!: string;

  @Column({ type: 'text', nullable: true })
  description?: string;

  @Column({ default: true })
  isEnabled!: boolean;

  // Framework-specific settings
  @Column({ type: 'jsonb', default: {} })
  settings!: {
    // GDPR specific
    dataRetentionDays?: number;
    consentRequired?: boolean;
    rightToErasure?: boolean;
    dataPortability?: boolean;

    // HIPAA specific
    phiHandling?: boolean;
    auditControls?: boolean;
    accessControls?: boolean;
    transmissionSecurity?: boolean;

    // PCI DSS specific
    cardDataProtection?: boolean;
    accessRestriction?: boolean;
    networkSecurity?: boolean;

    // SOX specific
    financialControls?: boolean;
    changeManagement?: boolean;
    accessCertification?: boolean;

    // General
    encryptionRequired?: boolean;
    mfaRequired?: boolean;
    passwordPolicy?: {
      minLength?: number;
      requireUppercase?: boolean;
      requireNumbers?: boolean;
      requireSpecialChars?: boolean;
      expirationDays?: number;
      historyCount?: number;
    };
  };

  // Required controls
  @Column({ type: 'jsonb', default: [] })
  requiredControls!: Array<{
    controlId: string;
    name: string;
    description: string;
    category: string;
    isImplemented: boolean;
    implementationNotes?: string;
    lastReviewedAt?: string;
    nextReviewAt?: string;
  }>;

  // Certification tracking
  @Column({ type: 'timestamp with time zone', nullable: true })
  certifiedAt?: Date;

  @Column({ type: 'timestamp with time zone', nullable: true })
  certificationExpiresAt?: Date;

  @Column({ length: 255, nullable: true })
  certificationBody?: string;

  @Column({ length: 100, nullable: true })
  certificationNumber?: string;

  @CreateDateColumn({ type: 'timestamp with time zone' })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'timestamp with time zone' })
  updatedAt!: Date;
}

/**
 * Data Classification Policy
 * Defines rules for classifying data
 */
@Entity('data_classification_policies')
export class DataClassificationPolicy {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ length: 100 })
  name!: string;

  @Column({ type: 'text', nullable: true })
  description?: string;

  @Column({ type: 'varchar', length: 20, default: 'active' })
  status!: PolicyStatus;

  @Column({ type: 'int', default: 0 })
  priority!: number;

  // Classification rules
  @Column({ type: 'jsonb' })
  rules!: Array<{
    id: string;
    name: string;
    description?: string;
    classificationLevel: DataClassificationLevel;
    conditions: {
      collectionPatterns?: string[];
      fieldPatterns?: string[];
      valuePatterns?: string[];
      dataTypes?: string[];
      tags?: string[];
    };
    action: EnforcementAction;
  }>;

  // Default classification
  @Column({ type: 'varchar', length: 20, default: 'internal' })
  defaultClassification!: DataClassificationLevel;

  // Enforcement settings
  @Column({ default: true })
  enforceOnRead!: boolean;

  @Column({ default: true })
  enforceOnWrite!: boolean;

  @Column({ default: true })
  enforceOnExport!: boolean;

  @CreateDateColumn({ type: 'timestamp with time zone' })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'timestamp with time zone' })
  updatedAt!: Date;

  @Column({ type: 'uuid', nullable: true })
  createdBy?: string;
}

/**
 * Data Loss Prevention (DLP) Policy
 * Controls data exfiltration and sharing
 */
@Entity('dlp_policies')
export class DLPPolicy {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ length: 100 })
  name!: string;

  @Column({ type: 'text', nullable: true })
  description?: string;

  @Column({ type: 'varchar', length: 20, default: 'active' })
  status!: PolicyStatus;

  @Column({ type: 'int', default: 0 })
  priority!: number;

  // Scope
  @Column({ type: 'simple-array', nullable: true })
  targetCollections?: string[];

  @Column({ type: 'simple-array', nullable: true })
  targetRoles?: string[];

  @Column({ type: 'simple-array', nullable: true })
  excludedUsers?: string[];

  // Detection rules
  @Column({ type: 'jsonb' })
  detectionRules!: Array<{
    id: string;
    name: string;
    type: 'pattern' | 'keyword' | 'dictionary' | 'ml';
    config: {
      patterns?: string[];
      keywords?: string[];
      dictionaryId?: string;
      confidence?: number;
    };
    dataTypes?: string[];
  }>;

  // Content types to scan
  @Column({ type: 'simple-array', default: '' })
  contentTypes!: string[]; // 'text', 'attachment', 'export', 'api_response'

  // Actions
  @Column({ type: 'varchar', length: 20, default: 'warn' })
  primaryAction!: EnforcementAction;

  @Column({ type: 'jsonb', nullable: true })
  actionConfig?: {
    notifyUser?: boolean;
    notifyAdmin?: boolean;
    notifyEmail?: string[];
    blockMessage?: string;
    quarantineLocation?: string;
    redactFields?: boolean;
  };

  // Exemptions
  @Column({ default: false })
  allowOverride!: boolean;

  @Column({ type: 'simple-array', nullable: true })
  overrideJustifications?: string[];

  @Column({ default: false })
  requireApproval!: boolean;

  @Column({ type: 'uuid', nullable: true })
  approvalWorkflowId?: string;

  @CreateDateColumn({ type: 'timestamp with time zone' })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'timestamp with time zone' })
  updatedAt!: Date;

  @Column({ type: 'uuid', nullable: true })
  createdBy?: string;
}

/**
 * DLP Incident record
 * Tracks policy violations and their resolution
 */
@Entity('dlp_incidents')
@Index(['policyId', 'createdAt'])
@Index(['userId', 'createdAt'])
@Index(['status'])
export class DLPIncident {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid' })
  policyId!: string;

  @Column({ length: 100 })
  policyName!: string;

  @Column({ type: 'varchar', length: 20, default: 'open' })
  status!: 'open' | 'investigating' | 'resolved' | 'false_positive' | 'escalated';

  @Column({ type: 'varchar', length: 20 })
  severity!: 'low' | 'medium' | 'high' | 'critical';

  // Violation details
  @Column({ type: 'uuid', nullable: true })
  userId?: string;

  @Column({ length: 255, nullable: true })
  userEmail?: string;

  @Column({ length: 100 })
  action!: string; // 'export', 'share', 'download', 'api_access'

  @Column({ length: 100, nullable: true })
  resourceType?: string;

  @Column({ type: 'uuid', nullable: true })
  resourceId?: string;

  @Column({ length: 255, nullable: true })
  resourceName?: string;

  // Detection information
  @Column({ type: 'jsonb' })
  detectionDetails!: {
    ruleId: string;
    ruleName: string;
    matchedPatterns?: string[];
    matchedKeywords?: string[];
    confidence?: number;
    sampleContent?: string; // Redacted sample
  };

  // Action taken
  @Column({ type: 'varchar', length: 20 })
  actionTaken!: EnforcementAction;

  @Column({ default: false })
  wasBlocked!: boolean;

  @Column({ default: false })
  wasOverridden!: boolean;

  @Column({ type: 'text', nullable: true })
  overrideJustification?: string;

  @Column({ type: 'uuid', nullable: true })
  overrideApprovedBy?: string;

  // Context
  @Column({ type: 'varchar', length: 45, nullable: true })
  ipAddress?: string;

  @Column({ type: 'text', nullable: true })
  userAgent?: string;

  // Resolution
  @Column({ type: 'uuid', nullable: true })
  assignedTo?: string;

  @Column({ type: 'text', nullable: true })
  resolutionNotes?: string;

  @Column({ type: 'timestamp with time zone', nullable: true })
  resolvedAt?: Date;

  @Column({ type: 'uuid', nullable: true })
  resolvedBy?: string;

  @CreateDateColumn({ type: 'timestamp with time zone' })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'timestamp with time zone' })
  updatedAt!: Date;
}

/**
 * Consent Record for GDPR compliance
 */
@Entity('consent_records')
@Index(['userId', 'purposeId'])
@Index(['consentGiven', 'expiresAt'])
export class ConsentRecord {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid' })
  @Index()
  userId!: string;

  @Column({ length: 255, nullable: true })
  userEmail?: string;

  @Column({ type: 'uuid' })
  purposeId!: string;

  @Column({ length: 100 })
  purposeName!: string;

  @Column({ type: 'text', nullable: true })
  purposeDescription?: string;

  @Column({ default: false })
  consentGiven!: boolean;

  @Column({ type: 'varchar', length: 50 })
  consentMethod!: string; // 'explicit', 'implicit', 'opt_out', 'third_party'

  @Column({ type: 'varchar', length: 50 })
  consentSource!: string; // 'web_form', 'api', 'email', 'verbal', 'written'

  @Column({ type: 'text', nullable: true })
  consentText?: string;

  @Column({ type: 'varchar', length: 10, nullable: true })
  consentVersion?: string;

  // Validity
  @Column({ type: 'timestamp with time zone' })
  effectiveAt!: Date;

  @Column({ type: 'timestamp with time zone', nullable: true })
  expiresAt?: Date;

  @Column({ type: 'timestamp with time zone', nullable: true })
  withdrawnAt?: Date;

  @Column({ type: 'text', nullable: true })
  withdrawalReason?: string;

  // Legal basis
  @Column({ type: 'varchar', length: 50, nullable: true })
  legalBasis?: string; // 'consent', 'contract', 'legal_obligation', 'vital_interests', 'public_task', 'legitimate_interests'

  // Proof
  @Column({ type: 'varchar', length: 45, nullable: true })
  ipAddress?: string;

  @Column({ type: 'text', nullable: true })
  userAgent?: string;

  @Column({ type: 'text', nullable: true })
  proofDocumentId?: string;

  @CreateDateColumn({ type: 'timestamp with time zone' })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'timestamp with time zone' })
  updatedAt!: Date;
}

/**
 * Data Subject Request (GDPR DSR)
 */
@Entity('data_subject_requests')
@Index(['userId', 'status'])
@Index(['requestType', 'status'])
export class DataSubjectRequest {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ length: 20, unique: true })
  requestNumber!: string;

  @Column({ type: 'uuid', nullable: true })
  userId?: string;

  @Column({ length: 255 })
  subjectEmail!: string;

  @Column({ length: 255, nullable: true })
  subjectName?: string;

  @Column({ type: 'varchar', length: 30 })
  requestType!:
    | 'access'
    | 'rectification'
    | 'erasure'
    | 'restriction'
    | 'portability'
    | 'objection';

  @Column({ type: 'varchar', length: 20, default: 'pending' })
  status!:
    | 'pending'
    | 'verified'
    | 'in_progress'
    | 'completed'
    | 'rejected'
    | 'extended';

  @Column({ type: 'text', nullable: true })
  description?: string;

  // Verification
  @Column({ default: false })
  identityVerified!: boolean;

  @Column({ type: 'varchar', length: 50, nullable: true })
  verificationMethod?: string;

  @Column({ type: 'timestamp with time zone', nullable: true })
  verifiedAt?: Date;

  // Processing
  @Column({ type: 'uuid', nullable: true })
  assignedTo?: string;

  @Column({ type: 'timestamp with time zone' })
  dueDate!: Date;

  @Column({ type: 'timestamp with time zone', nullable: true })
  extendedDueDate?: Date;

  @Column({ type: 'text', nullable: true })
  extensionReason?: string;

  // Results
  @Column({ type: 'jsonb', nullable: true })
  dataCollected?: {
    collections: string[];
    recordCount: number;
    attachmentCount: number;
    exportFileId?: string;
  };

  @Column({ type: 'jsonb', nullable: true })
  actionsPerformed?: Array<{
    action: string;
    timestamp: string;
    details: string;
  }>;

  @Column({ type: 'text', nullable: true })
  rejectionReason?: string;

  // Audit trail
  @Column({ type: 'jsonb', default: [] })
  history!: Array<{
    action: string;
    timestamp: string;
    userId?: string;
    notes?: string;
  }>;

  @CreateDateColumn({ type: 'timestamp with time zone' })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'timestamp with time zone' })
  updatedAt!: Date;

  @Column({ type: 'timestamp with time zone', nullable: true })
  completedAt?: Date;
}
