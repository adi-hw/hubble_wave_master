import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
} from 'typeorm';

/**
 * Types of schema entities that can be tracked.
 */
export type SchemaEntityType = 'collection' | 'property';

/**
 * Types of changes that can be made to schema entities.
 * 
 * - **create**: New entity added (collection or property)
 * - **update**: Existing entity modified (label, settings, etc.)
 * - **delete**: Entity removed (soft-delete for safety)
 * - **sync**: Synchronization operation between metadata and physical schema
 * - **rollback**: Reverting a previous change
 */
export type SchemaChangeType = 'create' | 'update' | 'delete' | 'sync' | 'rollback';

/**
 * Source of the schema change.
 * 
 * - **api**: Change made through the REST API (user action)
 * - **migration**: Change made through TypeORM migration (platform update)
 * - **sync**: Change made by automatic sync service (drift correction)
 * - **manual**: Change made directly in database (should be rare)
 * - **system**: Change made by system process (background job, etc.)
 */
export type SchemaChangeSource = 'api' | 'migration' | 'sync' | 'manual' | 'system';

/**
 * Who performed the schema change.
 * 
 * - **user**: Regular user through the UI/API
 * - **system**: Automated system process
 * - **migration**: Database migration script
 */
export type PerformedByType = 'user' | 'system' | 'migration';

/**
 * SchemaChangeLog Entity
 * 
 * Provides a complete audit trail of all schema modifications in HubbleWave.
 * This is critical for several reasons:
 * 
 * 1. **HIPAA Compliance**: Healthcare environments require complete audit
 *    trails of all system changes that could affect PHI handling.
 * 
 * 2. **Debugging**: When schema issues occur, the change log helps identify
 *    what changed, when, and who made the change.
 * 
 * 3. **Rollback Support**: The before_state and after_state fields enable
 *    automated or manual rollback of changes within a retention period.
 * 
 * 4. **Change Management**: Provides visibility into schema evolution over
 *    time for governance and compliance reviews.
 * 
 * The log stores:
 * - What entity was changed (collection or property)
 * - The type of change (create, update, delete, sync)
 * - Who made the change and how (API, migration, sync)
 * - Before and after state snapshots for rollback
 * - The actual DDL statements executed (if any)
 * 
 * @example
 * ```typescript
 * // The log is populated automatically by the DDL Executor Service
 * // Here's what an entry looks like:
 * {
 *   entityType: 'property',
 *   entityCode: 'x_badge_number',
 *   changeType: 'create',
 *   changeSource: 'api',
 *   performedByType: 'user',
 *   performedBy: 'user-uuid-here',
 *   beforeState: null,
 *   afterState: { code: 'x_badge_number', dataType: 'text', ... },
 *   ddlStatements: ['ALTER TABLE tenant_user ADD COLUMN x_badge_number VARCHAR(255)'],
 *   success: true,
 * }
 * ```
 */
@Entity('schema_change_log')
@Index('idx_schema_change_entity', ['entityType', 'entityId'])
@Index('idx_schema_change_entity_code', ['entityType', 'entityCode'])
@Index('idx_schema_change_created', ['createdAt'])
@Index('idx_schema_change_performer', ['performedBy', 'createdAt'])
@Index('idx_schema_change_type', ['changeType', 'createdAt'])
export class SchemaChangeLog {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  // ═══════════════════════════════════════════════════════════════════════════
  // WHAT CHANGED
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Type of schema entity that was changed.
   * Either 'collection' (table-level) or 'property' (column-level).
   */
  @Column({ 
    type: 'varchar', 
    length: 20, 
    name: 'entity_type' 
  })
  entityType: SchemaEntityType;

  /**
   * UUID of the entity that was changed.
   * References either collection_definition.id or property_definition.id.
   */
  @Column({ type: 'uuid', name: 'entity_id' })
  entityId: string;

  /**
   * Code/identifier of the entity for human-readable logs.
   * Stored separately so logs remain readable even if entity is deleted.
   */
  @Column({ type: 'varchar', length: 100, name: 'entity_code' })
  entityCode: string;

  // ═══════════════════════════════════════════════════════════════════════════
  // CHANGE DETAILS
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Type of change that was made.
   */
  @Column({ 
    type: 'varchar', 
    length: 20, 
    name: 'change_type' 
  })
  changeType: SchemaChangeType;

  /**
   * How the change was initiated.
   */
  @Column({ 
    type: 'varchar', 
    length: 20, 
    name: 'change_source' 
  })
  changeSource: SchemaChangeSource;

  // ═══════════════════════════════════════════════════════════════════════════
  // STATE SNAPSHOTS (for rollback)
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Complete state of the entity BEFORE the change.
   * NULL for 'create' operations since entity didn't exist.
   * This is the data needed to rollback the change.
   */
  @Column({ type: 'jsonb', name: 'before_state', nullable: true })
  beforeState: Record<string, any>;

  /**
   * Complete state of the entity AFTER the change.
   * NULL for 'delete' operations since entity no longer exists.
   * This shows what the change resulted in.
   */
  @Column({ type: 'jsonb', name: 'after_state', nullable: true })
  afterState: Record<string, any>;

  /**
   * Array of DDL (Data Definition Language) statements executed.
   * Examples: CREATE TABLE, ALTER TABLE ADD COLUMN, etc.
   * Useful for understanding exactly what changed at the database level.
   */
  @Column({ type: 'text', array: true, name: 'ddl_statements', nullable: true })
  ddlStatements: string[];

  // ═══════════════════════════════════════════════════════════════════════════
  // ACTOR INFORMATION
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * UUID of the user who performed the change.
   * NULL for system or migration changes.
   */
  @Column({ type: 'uuid', name: 'performed_by', nullable: true })
  performedBy: string;

  /**
   * Type of actor that performed the change.
   * Helps distinguish user actions from automated processes.
   */
  @Column({ 
    type: 'varchar', 
    length: 20, 
    name: 'performed_by_type' 
  })
  performedByType: PerformedByType;

  // ═══════════════════════════════════════════════════════════════════════════
  // RESULT TRACKING
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Whether the change was successful.
   * Failed changes are logged for debugging and audit purposes.
   */
  @Column({ type: 'boolean', default: true })
  success: boolean;

  /**
   * Error message if the change failed.
   * Contains details about what went wrong for debugging.
   */
  @Column({ type: 'text', name: 'error_message', nullable: true })
  errorMessage: string;

  // ═══════════════════════════════════════════════════════════════════════════
  // ROLLBACK SUPPORT
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Whether this change has been rolled back.
   * Rolled-back changes are preserved for audit trail.
   */
  @Column({ type: 'boolean', name: 'is_rolled_back', default: false })
  isRolledBack: boolean;

  /**
   * When the rollback was performed.
   */
  @Column({ type: 'timestamptz', name: 'rolled_back_at', nullable: true })
  rolledBackAt: Date;

  /**
   * User who performed the rollback.
   */
  @Column({ type: 'uuid', name: 'rolled_back_by', nullable: true })
  rolledBackBy: string;

  /**
   * Reason for the rollback.
   * Important for audit trail and understanding why changes were reverted.
   */
  @Column({ type: 'text', name: 'rollback_reason', nullable: true })
  rollbackReason: string;

  // ═══════════════════════════════════════════════════════════════════════════
  // TIMESTAMPS
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * When the change was made.
   * This is the primary ordering field for the audit trail.
   */
  @CreateDateColumn({ type: 'timestamptz', name: 'created_at' })
  createdAt: Date;

  // ═══════════════════════════════════════════════════════════════════════════
  // HELPER METHODS
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Returns true if this change can potentially be rolled back.
   * Rollback is possible if:
   * - The change was successful
   * - It hasn't already been rolled back
   * - Before state is available (for non-create operations)
   */
  canRollback(): boolean {
    if (!this.success || this.isRolledBack) {
      return false;
    }
    
    // Create operations can be rolled back by deleting the entity
    if (this.changeType === 'create') {
      return true;
    }
    
    // Update/delete operations need before_state to rollback
    if (this.changeType === 'update' || this.changeType === 'delete') {
      return this.beforeState !== null;
    }
    
    // Sync and rollback operations cannot be further rolled back
    return false;
  }

  /**
   * Returns a human-readable summary of the change.
   */
  getSummary(): string {
    const action = this.changeType.charAt(0).toUpperCase() + this.changeType.slice(1);
    const actor = this.performedByType === 'user' ? 'User' : 
                  this.performedByType === 'migration' ? 'Migration' : 'System';
    const result = this.success ? 'succeeded' : 'failed';
    
    return `${action} ${this.entityType} '${this.entityCode}' by ${actor} ${result}`;
  }

  /**
   * Returns the DDL statements as a formatted string for display.
   */
  getFormattedDdl(): string {
    if (!this.ddlStatements || this.ddlStatements.length === 0) {
      return '(no DDL executed)';
    }
    return this.ddlStatements.join(';\n') + ';';
  }
}
