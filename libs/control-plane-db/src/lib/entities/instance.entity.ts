import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Customer } from './customer.entity';

/**
 * Instance environment type
 */
export type InstanceEnvironment = 'production' | 'staging' | 'dev';

/**
 * Instance status
 */
export type InstanceStatus = 'pending' | 'provisioning' | 'active' | 'suspended' | 'terminated' | 'failed';

/**
 * Instance health status
 */
export type InstanceHealth = 'healthy' | 'degraded' | 'unhealthy' | 'unknown';

/**
 * Resource tier configuration
 */
export type ResourceTier = 'standard' | 'professional' | 'enterprise';

/**
 * Instance entity - represents a deployed customer instance
 * Stored in Control Plane database (eam_control)
 * 
 * NOTE: This is NOT "tenant_instances" - we don't use tenant terminology!
 * Each instance is a completely isolated customer environment with its own database.
 */
@Entity('instances')
@Index(['customerId'])
@Index(['environment'])
@Index(['status'])
@Index(['health'])
@Index(['region'])
@Index(['domain'], { unique: true, where: 'domain IS NOT NULL' })
@Index(['customerId', 'environment'], { unique: true })
export class Instance {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  /** Customer this instance belongs to */
  @Column({ name: 'customer_id', type: 'uuid' })
  customerId!: string;

  @ManyToOne(() => Customer, (customer) => customer.instances)
  @JoinColumn({ name: 'customer_id' })
  customer?: Customer;

  // ─────────────────────────────────────────────────────────────────
  // Instance Identity
  // ─────────────────────────────────────────────────────────────────

  /** Environment type */
  @Column({ type: 'varchar', length: 20 })
  environment!: InstanceEnvironment;

  /** Instance status */
  @Column({ type: 'varchar', length: 20, default: 'pending' })
  status!: InstanceStatus;

  /** Health status */
  @Column({ type: 'varchar', length: 20, default: 'unknown' })
  health!: InstanceHealth;

  // ─────────────────────────────────────────────────────────────────
  // Domain & Access
  // ─────────────────────────────────────────────────────────────────

  /** Primary domain name for this instance (e.g., acme.dev.hubblewave.com) */
  @Column({ type: 'varchar', length: 255, nullable: true })
  domain?: string | null;

  /** Custom domain (CNAME) if configured (e.g., eam.acme-hospital.com) */
  @Column({ name: 'custom_domain', type: 'varchar', length: 255, nullable: true })
  customDomain?: string | null;

  /** SSL certificate status for custom domain */
  @Column({ name: 'ssl_status', type: 'varchar', length: 50, nullable: true })
  sslStatus?: string | null;

  // ─────────────────────────────────────────────────────────────────
  // Infrastructure
  // ─────────────────────────────────────────────────────────────────

  /** Cloud region (e.g., 'us-east-1', 'eu-west-1') */
  @Column({ type: 'varchar', length: 50 })
  region!: string;

  /** Application version deployed */
  @Column({ type: 'varchar', length: 50 })
  version!: string;

  /** Resource tier (CPU, memory, storage) */
  @Column({ name: 'resource_tier', type: 'varchar', length: 20, default: 'standard' })
  resourceTier!: ResourceTier;

  /** Database name for this instance */
  @Column({ name: 'database_name', type: 'varchar', length: 100 })
  databaseName!: string;

  /** Database host */
  @Column({ name: 'database_host', type: 'varchar', length: 255, nullable: true })
  databaseHost?: string | null;

  /** Database port */
  @Column({ name: 'database_port', type: 'integer', default: 5432 })
  databasePort!: number;

  /** Kubernetes namespace */
  @Column({ name: 'k8s_namespace', type: 'varchar', length: 100, nullable: true })
  k8sNamespace?: string | null;

  /** Kubernetes cluster name */
  @Column({ name: 'k8s_cluster', type: 'varchar', length: 100, nullable: true })
  k8sCluster?: string | null;

  /** Terraform workspace name */
  @Column({ name: 'terraform_workspace', type: 'varchar', length: 100, nullable: true })
  terraformWorkspace?: string | null;

  // ─────────────────────────────────────────────────────────────────
  // Health & Monitoring
  // ─────────────────────────────────────────────────────────────────

  /** Last health check timestamp */
  @Column({ name: 'last_health_check', type: 'timestamptz', nullable: true })
  lastHealthCheck?: Date | null;

  /** Health check details */
  @Column({ name: 'health_details', type: 'jsonb', default: () => `'{}'` })
  healthDetails!: Record<string, unknown>;

  /** Resource utilization metrics (latest snapshot) */
  @Column({ name: 'resource_metrics', type: 'jsonb', default: () => `'{}'` })
  resourceMetrics!: {
    cpu_usage?: number;
    memory_usage?: number;
    disk_usage?: number;
    network_io?: number;
    db_connections?: number;
    active_users?: number;
  };

  // ─────────────────────────────────────────────────────────────────
  // Provisioning & Deployment
  // ─────────────────────────────────────────────────────────────────

  /** When provisioning started */
  @Column({ name: 'provisioning_started_at', type: 'timestamptz', nullable: true })
  provisioningStartedAt?: Date | null;

  /** When provisioning completed */
  @Column({ name: 'provisioning_completed_at', type: 'timestamptz', nullable: true })
  provisioningCompletedAt?: Date | null;

  /** Last deployment timestamp */
  @Column({ name: 'last_deployed_at', type: 'timestamptz', nullable: true })
  lastDeployedAt?: Date | null;

  /** Last deployment version */
  @Column({ name: 'last_deployed_version', type: 'varchar', length: 50, nullable: true })
  lastDeployedVersion?: string | null;

  /** Provisioning/deployment error message */
  @Column({ name: 'error_message', type: 'text', nullable: true })
  errorMessage?: string | null;

  // ─────────────────────────────────────────────────────────────────
  // Configuration & Metadata
  // ─────────────────────────────────────────────────────────────────

  /** Instance-specific configuration */
  @Column({ type: 'jsonb', default: () => `'{}'` })
  config!: Record<string, unknown>;

  /** Feature flags for this instance */
  @Column({ name: 'feature_flags', type: 'jsonb', default: () => `'[]'` })
  featureFlags!: string[];

  /** Additional metadata */
  @Column({ type: 'jsonb', default: () => `'{}'` })
  metadata!: Record<string, unknown>;

  // ─────────────────────────────────────────────────────────────────
  // Maintenance
  // ─────────────────────────────────────────────────────────────────

  /** Maintenance window (e.g., "Sun 02:00-06:00 UTC") */
  @Column({ name: 'maintenance_window', type: 'varchar', length: 100, nullable: true })
  maintenanceWindow?: string | null;

  /** Next scheduled maintenance */
  @Column({ name: 'next_maintenance', type: 'timestamptz', nullable: true })
  nextMaintenance?: Date | null;

  /** Backup retention days */
  @Column({ name: 'backup_retention_days', type: 'integer', default: 30 })
  backupRetentionDays!: number;

  /** Last backup timestamp */
  @Column({ name: 'last_backup_at', type: 'timestamptz', nullable: true })
  lastBackupAt?: Date | null;

  // ─────────────────────────────────────────────────────────────────
  // Audit Fields
  // ─────────────────────────────────────────────────────────────────

  @Column({ name: 'created_by', type: 'uuid', nullable: true })
  createdBy?: string | null;

  @Column({ name: 'updated_by', type: 'uuid', nullable: true })
  updatedBy?: string | null;

  @Column({ name: 'deleted_at', type: 'timestamptz', nullable: true })
  deletedAt?: Date | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}
