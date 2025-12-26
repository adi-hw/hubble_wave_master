import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn } from 'typeorm';

@Entity('access_rule_audit_logs')
export class AccessRuleAuditLog {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'rule_id', type: 'uuid' })
  ruleId!: string;

  @Column()
  action!: string; // 'create', 'update', 'delete'

  @Column({ type: 'jsonb', nullable: true })
  changes?: any | null;

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
  decision!: string; // 'ALLOW', 'DENY'

  @Column({ type: 'jsonb', nullable: true })
  context?: any | null;

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
