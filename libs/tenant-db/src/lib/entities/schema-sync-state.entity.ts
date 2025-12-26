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
 * SchemaSyncState Entity
 * 
 * A singleton table (only one row ever exists) that tracks the state of
 * schema synchronization between metadata and physical PostgreSQL schema.
 * 
 * This entity serves several critical purposes:
 * 
 * 1. **Distributed Locking**: In a multi-instance deployment, multiple
 *    service instances might try to run drift detection simultaneously.
 *    The sync_lock_* fields implement a simple distributed lock to ensure
 *    only one instance runs at a time.
 * 
 * 2. **Drift Detection State**: Tracks when drift was last checked, whether
 *    drift was detected, and details about what's out of sync.
 * 
 * 3. **Statistics**: Provides quick access to counts of collections,
 *    properties, orphaned tables, etc. without expensive queries.
 * 
 * 4. **Observability**: The fields in this table can be exposed to
 *    monitoring dashboards to alert on schema drift.
 * 
 * The singleton pattern is enforced by:
 * - Migration inserts exactly one row on first run
 * - Application code uses UPDATE, never INSERT
 * - No DELETE operations should ever occur
 * 
 * @example
 * ```typescript
 * // Checking sync state before operations
 * const state = await schemaSyncStateRepo.findOne({});
 * if (state.driftDetected) {
 *   console.warn('Schema drift detected:', state.driftDetails);
 * }
 * 
 * // Acquiring lock for sync operation
 * const acquired = await schemaSyncService.acquireSyncLock();
 * if (!acquired) {
 *   console.log('Another instance is running sync');
 *   return;
 * }
 * ```
 */
@Entity('schema_sync_state')
@Index('idx_schema_sync_lock', ['syncLockExpiresAt'])
export class SchemaSyncState {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  // ═══════════════════════════════════════════════════════════════════════════
  // DISTRIBUTED LOCK MANAGEMENT
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Instance ID that currently holds the sync lock.
   * This is typically a unique identifier for the service instance
   * (e.g., hostname + process ID or a UUID generated at startup).
   * NULL when no lock is held.
   */
  @Column({ type: 'varchar', length: 100, name: 'sync_lock_holder', nullable: true })
  syncLockHolder: string;

  /**
   * When the current lock was acquired.
   * Used for debugging and monitoring lock hold times.
   */
  @Column({ type: 'timestamptz', name: 'sync_lock_acquired_at', nullable: true })
  syncLockAcquiredAt: Date;

  /**
   * When the current lock expires.
   * Locks automatically expire after this time to prevent deadlocks
   * if the lock holder crashes. Default timeout is 5 minutes.
   * 
   * Another instance can acquire the lock if:
   * - sync_lock_holder IS NULL, OR
   * - sync_lock_expires_at < NOW()
   */
  @Column({ type: 'timestamptz', name: 'sync_lock_expires_at', nullable: true })
  syncLockExpiresAt: Date;

  // ═══════════════════════════════════════════════════════════════════════════
  // LAST SYNC RUN INFORMATION
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * When the last full sync/drift check completed.
   * Used to determine if sync is overdue (alerting).
   */
  @Column({ type: 'timestamptz', name: 'last_full_sync_at', nullable: true })
  lastFullSyncAt: Date;

  /**
   * How long the last sync took in milliseconds.
   * Useful for capacity planning and detecting performance degradation.
   */
  @Column({ type: 'integer', name: 'last_full_sync_duration_ms', nullable: true })
  lastFullSyncDurationMs: number;

  /**
   * Result of the last sync operation.
   * - success: No issues found, everything in sync
   * - issues_found: Sync completed but drift was detected
   * - error: Sync failed to complete (see driftDetails for error)
   * - timeout: Sync took too long and was aborted
   */
  @Column({ type: 'varchar', length: 20, name: 'last_full_sync_result', nullable: true })
  lastFullSyncResult: SyncResult;

  // ═══════════════════════════════════════════════════════════════════════════
  // DRIFT DETECTION RESULTS
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * When drift was last checked (may be more recent than full sync
   * if incremental checks are performed).
   */
  @Column({ type: 'timestamptz', name: 'last_drift_check_at', nullable: true })
  lastDriftCheckAt: Date;

  /**
   * Whether any drift between metadata and physical schema was detected.
   * This is the primary flag for monitoring/alerting.
   * 
   * When true, investigate driftDetails for specifics.
   */
  @Column({ type: 'boolean', name: 'drift_detected', default: false })
  driftDetected: boolean;

  /**
   * Detailed information about detected drift.
   * Contains an array of SyncIssue objects when drift is detected.
   * NULL when no drift exists.
   * 
   * Structure:
   * ```json
   * {
   *   "issues": [
   *     {
   *       "type": "missing_column",
   *       "severity": "error",
   *       "collection": "work_orders",
   *       "property": "assigned_to",
   *       "message": "Column 'assigned_to' not found in table 't_work_orders'",
   *       "autoResolvable": true,
   *       "suggestedAction": "Add column to table"
   *     }
   *   ],
   *   "checkedAt": "2025-01-15T10:30:00Z"
   * }
   * ```
   */
  @Column({ type: 'jsonb', name: 'drift_details', nullable: true })
  driftDetails: {
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
  };

  // ═══════════════════════════════════════════════════════════════════════════
  // STATISTICS
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Total number of collection definitions in metadata.
   * Quick reference without querying collection_definition table.
   */
  @Column({ type: 'integer', name: 'total_collections', default: 0 })
  totalCollections: number;

  /**
   * Total number of property definitions in metadata.
   * Quick reference without querying property_definition table.
   */
  @Column({ type: 'integer', name: 'total_properties', default: 0 })
  totalProperties: number;

  /**
   * Number of physical tables without collection definitions.
   * These might be:
   * - Legacy tables not yet migrated
   * - Tables created manually outside the platform
   * - Orphaned tables from failed cleanup
   */
  @Column({ type: 'integer', name: 'orphaned_tables', default: 0 })
  orphanedTables: number;

  /**
   * Number of physical columns without property definitions.
   * Similar to orphaned tables but at column level.
   */
  @Column({ type: 'integer', name: 'orphaned_columns', default: 0 })
  orphanedColumns: number;

  // ═══════════════════════════════════════════════════════════════════════════
  // METADATA
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * When this record was last modified.
   * Automatically updated by trigger on every change.
   */
  @UpdateDateColumn({ type: 'timestamptz', name: 'updated_at' })
  updatedAt: Date;

  // ═══════════════════════════════════════════════════════════════════════════
  // HELPER METHODS
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Checks if the sync lock is currently held by any instance.
   * Returns false if lock is null or expired.
   */
  isLocked(): boolean {
    if (!this.syncLockHolder) {
      return false;
    }
    if (this.syncLockExpiresAt && this.syncLockExpiresAt < new Date()) {
      return false; // Lock expired
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
  getIssuesBySeverity(severity: 'error' | 'warning' | 'info'): typeof this.driftDetails.issues {
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
   * This can be used for monitoring alerts.
   */
  isSyncOverdue(thresholdHours: number = 2): boolean {
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
    const status = this.driftDetected ? '⚠️ Drift Detected' : '✓ In Sync';
    
    return `Schema Status: ${status} | Last Check: ${syncTime} | ` +
           `Collections: ${this.totalCollections} | Properties: ${this.totalProperties} | ` +
           `Issues: ${issueCount}`;
  }
}
