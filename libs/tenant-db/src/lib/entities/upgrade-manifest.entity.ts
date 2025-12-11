import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, Index } from 'typeorm';

export type UpgradeStatus = 'pending' | 'in_progress' | 'completed' | 'failed' | 'rolled_back';
export type UpgradeType = 'major' | 'minor' | 'patch' | 'hotfix';

/**
 * Tracks platform upgrade manifests that define what changes are included in each version.
 * Used by the upgrade flow to analyze impact on tenant customizations.
 */
@Entity('upgrade_manifest')
@Index(['fromVersion', 'toVersion'], { unique: true })
@Index(['releaseDate'])
@Index(['upgradeType'])
export class UpgradeManifest {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'from_version', type: 'varchar', length: 20 })
  fromVersion!: string; // e.g., '2.4.0'

  @Column({ name: 'to_version', type: 'varchar', length: 20 })
  toVersion!: string; // e.g., '2.5.0'

  @Column({ name: 'upgrade_type', type: 'varchar', length: 20 })
  upgradeType!: UpgradeType;

  @Column({ type: 'text', nullable: true })
  description?: string;

  @Column({ name: 'release_notes', type: 'text', nullable: true })
  releaseNotes?: string;

  @Column({ name: 'release_date', type: 'timestamptz', nullable: true })
  releaseDate?: Date;

  /**
   * List of config changes included in this upgrade.
   * Each entry describes what changed (config type, resource key, change type).
   */
  @Column({ name: 'config_changes', type: 'jsonb', default: [] })
  configChanges!: ConfigChange[];

  /**
   * List of database migrations included in this upgrade.
   */
  @Column({ name: 'migrations', type: 'jsonb', default: [] })
  migrations!: MigrationEntry[];

  /**
   * Breaking changes that require manual intervention.
   */
  @Column({ name: 'breaking_changes', type: 'jsonb', default: [] })
  breakingChanges!: BreakingChange[];

  /**
   * Deprecations introduced in this version.
   */
  @Column({ type: 'jsonb', default: [] })
  deprecations!: Deprecation[];

  /**
   * Pre-upgrade checks that must pass before upgrading.
   */
  @Column({ name: 'pre_checks', type: 'jsonb', default: [] })
  preChecks!: PreCheck[];

  /**
   * Post-upgrade validation steps.
   */
  @Column({ name: 'post_checks', type: 'jsonb', default: [] })
  postChecks!: PostCheck[];

  @Column({ name: 'is_mandatory', type: 'boolean', default: false })
  isMandatory!: boolean;

  @Column({ name: 'min_downtime_minutes', type: 'int', default: 0 })
  minDowntimeMinutes!: number;

  @Column({ name: 'checksum', type: 'varchar', length: 64 })
  checksum!: string; // SHA-256 of manifest content for integrity

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;
}

// Supporting interfaces for JSONB columns
export interface ConfigChange {
  configType: string; // 'table', 'field', 'acl', 'workflow', etc.
  resourceKey: string; // e.g., 'asset', 'asset.status'
  changeType: 'added' | 'modified' | 'removed' | 'deprecated';
  previousChecksum?: string;
  newChecksum?: string;
  diff?: any[]; // JSON Patch format
  impactLevel: 'none' | 'low' | 'medium' | 'high' | 'critical';
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
  affectedConfigTypes: string[];
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
  checkScript?: string; // Script to run for validation
}

export interface PostCheck {
  code: string;
  name: string;
  description: string;
  validationScript?: string;
}
