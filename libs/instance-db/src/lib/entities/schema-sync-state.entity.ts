import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  UpdateDateColumn,
  Index,
} from 'typeorm';

/**
 * Result of a sync operation.
 */
export type SyncResult = 'success' | 'issues_found' | 'error' | 'timeout';

/**
 * Drift details structure
 */
export interface DriftDetails {
  issues?: Array<{
    type: 'orphaned_table' | 'orphaned_column' | 'missing_table' |
          'missing_column' | 'type_mismatch' | 'constraint_mismatch';
    severity: 'error' | 'warning' | 'info';
    collection?: string;
    property?: string;
    message: string;
    autoResolvable: boolean;
    suggestedAction?: string;
  }>;
  checkedAt?: string;
  errorMessage?: string;
}

/**
 * SchemaSyncState Entity
 *
 * A singleton table (only one row ever exists) that tracks the state of
 * schema synchronization between metadata and physical PostgreSQL schema.
 */
@Entity('schema_sync_state')
@Index('idx_schema_sync_lock', ['syncLockExpiresAt'])
export class SchemaSyncState {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  // ═══════════════════════════════════════════════════════════════════════════
  // DISTRIBUTED LOCK MANAGEMENT
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Instance ID that currently holds the sync lock.
   * NULL when no lock is held.
   */
  @Column({ type: 'varchar', length: 100, name: 'sync_lock_holder', nullable: true })
  syncLockHolder?: string | null;

  /**
   * When the current lock was acquired.
   */
  @Column({ type: 'timestamptz', name: 'sync_lock_acquired_at', nullable: true })
  syncLockAcquiredAt?: Date | null;

  /**
   * When the current lock expires.
   */
  @Column({ type: 'timestamptz', name: 'sync_lock_expires_at', nullable: true })
  syncLockExpiresAt?: Date | null;

  // ═══════════════════════════════════════════════════════════════════════════
  // LAST SYNC RUN INFORMATION
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * When the last full sync/drift check completed.
   */
  @Column({ type: 'timestamptz', name: 'last_full_sync_at', nullable: true })
  lastFullSyncAt?: Date | null;

  /**
   * How long the last sync took in milliseconds.
   */
  @Column({ type: 'integer', name: 'last_full_sync_duration_ms', nullable: true })
  lastFullSyncDurationMs?: number | null;

  /**
   * Result of the last sync operation.
   */
  @Column({ type: 'varchar', length: 20, name: 'last_full_sync_result', nullable: true })
  lastFullSyncResult?: SyncResult | null;

  // ═══════════════════════════════════════════════════════════════════════════
  // DRIFT DETECTION RESULTS
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * When drift was last checked.
   */
  @Column({ type: 'timestamptz', name: 'last_drift_check_at', nullable: true })
  lastDriftCheckAt?: Date | null;

  /**
   * Whether any drift between metadata and physical schema was detected.
   */
  @Column({ type: 'boolean', name: 'drift_detected', default: false })
  driftDetected!: boolean;

  /**
   * Detailed information about detected drift.
   */
  @Column({ type: 'jsonb', name: 'drift_details', nullable: true })
  driftDetails?: DriftDetails | null;

  // ═══════════════════════════════════════════════════════════════════════════
  // STATISTICS
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Total number of collection definitions in metadata.
   */
  @Column({ type: 'integer', name: 'total_collections', default: 0 })
  totalCollections!: number;

  /**
   * Total number of property definitions in metadata.
   */
  @Column({ type: 'integer', name: 'total_properties', default: 0 })
  totalProperties!: number;

  /**
   * Number of physical tables without collection definitions.
   */
  @Column({ type: 'integer', name: 'orphaned_tables', default: 0 })
  orphanedTables!: number;

  /**
   * Number of physical columns without property definitions.
   */
  @Column({ type: 'integer', name: 'orphaned_columns', default: 0 })
  orphanedColumns!: number;

  // ═══════════════════════════════════════════════════════════════════════════
  // METADATA
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * When this record was last modified.
   */
  @UpdateDateColumn({ type: 'timestamptz', name: 'updated_at' })
  updatedAt!: Date;

  // ═══════════════════════════════════════════════════════════════════════════
  // HELPER METHODS
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Checks if the sync lock is currently held by any instance.
   */
  isLocked(): boolean {
    if (!this.syncLockHolder) {
      return false;
    }
    if (this.syncLockExpiresAt && this.syncLockExpiresAt < new Date()) {
      return false;
    }
    return true;
  }

  /**
   * Checks if the sync lock is held by a specific instance.
   */
  isLockedBy(instanceId: string): boolean {
    return this.isLocked() && this.syncLockHolder === instanceId;
  }

  /**
   * Returns the number of issues detected in last drift check.
   */
  getIssueCount(): number {
    return this.driftDetails?.issues?.length ?? 0;
  }

  /**
   * Returns issues filtered by severity.
   */
  getIssuesBySeverity(severity: 'error' | 'warning' | 'info'): DriftDetails['issues'] {
    if (!this.driftDetails?.issues) {
      return [];
    }
    return this.driftDetails.issues.filter(i => i.severity === severity);
  }

  /**
   * Returns how long since the last sync in human-readable format.
   */
  getTimeSinceLastSync(): string {
    if (!this.lastFullSyncAt) {
      return 'Never';
    }

    const now = new Date();
    const diffMs = now.getTime() - this.lastFullSyncAt.getTime();
    const diffMinutes = Math.floor(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffMinutes < 1) return 'Just now';
    if (diffMinutes < 60) return `${diffMinutes} minute${diffMinutes > 1 ? 's' : ''} ago`;
    if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
    return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
  }

  /**
   * Returns true if sync is overdue (more than 2 hours since last sync).
   */
  isSyncOverdue(thresholdHours = 2): boolean {
    if (!this.lastFullSyncAt) {
      return true;
    }

    const now = new Date();
    const diffMs = now.getTime() - this.lastFullSyncAt.getTime();
    const diffHours = diffMs / (1000 * 60 * 60);

    return diffHours > thresholdHours;
  }

  /**
   * Returns a summary suitable for logging or display.
   */
  getSummary(): string {
    const syncTime = this.getTimeSinceLastSync();
    const issueCount = this.getIssueCount();
    const status = this.driftDetected ? 'Drift Detected' : 'In Sync';

    return `Schema Status: ${status} | Last Check: ${syncTime} | ` +
           `Collections: ${this.totalCollections} | Properties: ${this.totalProperties} | ` +
           `Issues: ${issueCount}`;
  }
}
