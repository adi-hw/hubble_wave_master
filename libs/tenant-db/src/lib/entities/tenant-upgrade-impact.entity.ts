import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, Index, ManyToOne, JoinColumn } from 'typeorm';
import { UpgradeManifest } from './upgrade-manifest.entity';

export type ImpactStatus = 'pending_analysis' | 'analyzed' | 'resolved' | 'acknowledged' | 'auto_resolved';
export type ImpactSeverity = 'none' | 'low' | 'medium' | 'high' | 'critical';
export type ResolutionStrategy = 'auto_merge' | 'manual_review' | 'keep_tenant' | 'use_platform' | 'custom_merge';

/**
 * Tracks the impact of platform upgrades on individual tenant customizations.
 * Used to show tenant admins what will change during an upgrade and let them preview/resolve conflicts.
 */
@Entity('tenant_upgrade_impact')
@Index(['tenantId', 'upgradeManifestId'], { unique: false })
@Index(['tenantId', 'status'])
@Index(['upgradeManifestId'])
@Index(['impactSeverity'])
export class TenantUpgradeImpact {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'tenant_id', type: 'uuid' })
  tenantId!: string;

  @Column({ name: 'upgrade_manifest_id', type: 'uuid' })
  upgradeManifestId!: string;

  @ManyToOne(() => UpgradeManifest)
  @JoinColumn({ name: 'upgrade_manifest_id' })
  upgradeManifest?: UpgradeManifest;

  @Column({ name: 'customization_id', type: 'uuid', nullable: true })
  customizationId?: string; // Reference to TenantCustomization

  @Column({ name: 'config_type', type: 'varchar', length: 50 })
  configType!: string; // 'table', 'field', 'acl', 'workflow', etc.

  @Column({ name: 'resource_key', type: 'varchar', length: 255 })
  resourceKey!: string; // e.g., 'asset', 'asset.status'

  @Column({ name: 'impact_type', type: 'varchar', length: 30 })
  impactType!: 'conflict' | 'override_affected' | 'extension_affected' | 'deprecated' | 'removed' | 'new_available';

  @Column({ name: 'impact_severity', type: 'varchar', length: 20 })
  impactSeverity!: ImpactSeverity;

  @Column({ type: 'text', nullable: true })
  description?: string;

  /**
   * The current tenant customization value before upgrade.
   */
  @Column({ name: 'current_tenant_value', type: 'jsonb', nullable: true })
  currentTenantValue?: Record<string, any>;

  /**
   * The platform config value in the current version.
   */
  @Column({ name: 'current_platform_value', type: 'jsonb', nullable: true })
  currentPlatformValue?: Record<string, any>;

  /**
   * The new platform config value after upgrade.
   */
  @Column({ name: 'new_platform_value', type: 'jsonb', nullable: true })
  newPlatformValue?: Record<string, any>;

  /**
   * The diff between current and new platform values.
   */
  @Column({ name: 'platform_diff', type: 'jsonb', nullable: true })
  platformDiff?: any[]; // JSON Patch format

  /**
   * Conflicts detected between tenant customization and platform changes.
   */
  @Column({ type: 'jsonb', nullable: true })
  conflicts?: ConflictDetail[];

  /**
   * Suggested resolution based on analysis.
   */
  @Column({ name: 'suggested_resolution', type: 'varchar', length: 30, nullable: true })
  suggestedResolution?: ResolutionStrategy;

  /**
   * Preview of what the merged result would look like.
   */
  @Column({ name: 'preview_merged_value', type: 'jsonb', nullable: true })
  previewMergedValue?: Record<string, any>;

  @Column({ type: 'varchar', length: 30, default: 'pending_analysis' })
  status!: ImpactStatus;

  /**
   * Resolution chosen by tenant admin (if manual review required).
   */
  @Column({ name: 'resolution_choice', type: 'varchar', length: 30, nullable: true })
  resolutionChoice?: ResolutionStrategy;

  /**
   * Custom merged value if admin chose 'custom_merge'.
   */
  @Column({ name: 'custom_resolution_value', type: 'jsonb', nullable: true })
  customResolutionValue?: Record<string, any>;

  @Column({ name: 'resolved_by', type: 'uuid', nullable: true })
  resolvedBy?: string;

  @Column({ name: 'resolved_at', type: 'timestamptz', nullable: true })
  resolvedAt?: Date;

  @Column({ name: 'resolution_notes', type: 'text', nullable: true })
  resolutionNotes?: string;

  /**
   * Whether this impact was auto-resolved during upgrade.
   */
  @Column({ name: 'auto_resolved', type: 'boolean', default: false })
  autoResolved!: boolean;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}

// Supporting interface for conflicts
export interface ConflictDetail {
  path: string; // JSON path to conflicting property
  conflictType: 'value_changed' | 'property_removed' | 'property_added' | 'type_mismatch';
  tenantValue: any;
  platformOldValue: any;
  platformNewValue: any;
  description?: string;
}
