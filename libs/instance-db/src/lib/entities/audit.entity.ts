import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn } from 'typeorm';

/**
 * Represents a field change in an audit log entry.
 */
export interface AuditFieldChange {
  field: string;
  oldValue: unknown;
  newValue: unknown;
}

/**
 * Structured changes recorded in access rule audit logs.
 */
export interface AccessRuleChanges {
  changes: AuditFieldChange[];
  previousState?: Record<string, unknown>;
  newState?: Record<string, unknown>;
}

/**
 * Context captured during access checks for auditing.
 */
export interface AccessAuditContext {
  ipAddress?: string;
  userAgent?: string;
  sessionId?: string;
  requestPath?: string;
  requestMethod?: string;
  matchedRules?: string[];
  evaluationTime?: number;
  additionalData?: Record<string, unknown>;
}

@Entity('access_rule_audit_logs')
export class AccessRuleAuditLog {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'rule_id', type: 'uuid' })
  ruleId!: string;

  @Column()
  action!: string;

  @Column({ type: 'jsonb', nullable: true })
  changes?: AccessRuleChanges | null;

  @Column({ name: 'performed_by', type: 'uuid' })
  performedBy!: string;

  @CreateDateColumn()
  performedAt!: Date;
}

@Entity('access_audit_logs')
export class AccessAuditLog {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'user_id', type: 'uuid' })
  userId!: string;

  @Column()
  resource!: string;

  @Column()
  action!: string;

  @Column()
  decision!: string;

  @Column({ type: 'jsonb', nullable: true })
  context?: AccessAuditContext | null;

  @CreateDateColumn()
  timestamp!: Date;
}

@Entity('property_audit_logs')
export class PropertyAuditLog {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'property_id', type: 'uuid' })
  propertyId!: string;

  @Column({ name: 'record_id', type: 'uuid' })
  recordId!: string;

  @Column({ type: 'text', nullable: true })
  oldValue?: string | null;

  @Column({ type: 'text', nullable: true })
  newValue?: string | null;

  @Column({ name: 'changed_by', type: 'uuid' })
  changedBy!: string;

  @CreateDateColumn()
  changedAt!: Date;
}

@Entity('view_audit_logs')
export class ViewAuditLog {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'view_id', type: 'uuid' })
  viewId!: string;

  @Column()
  action!: string;

  @Column({ name: 'performed_by', type: 'uuid' })
  performedBy!: string;

  @CreateDateColumn()
  timestamp!: Date;
}
