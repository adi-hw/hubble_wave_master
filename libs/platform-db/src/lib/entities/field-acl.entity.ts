import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn } from 'typeorm';

@Entity('field_acl')
export class FieldAcl {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'tenant_id', type: 'uuid', nullable: true })
  tenantId!: string | null;

  @Column({ name: 'table_name' })
  tableName!: string;

  @Column({ name: 'field_name' })
  fieldName!: string;

  @Column({ name: 'operation', type: 'enum', enumName: 'field_operation' })
  operation!: string;

  @Column({ name: 'required_permission_id', type: 'uuid', nullable: true })
  requiredPermissionId?: string;

  @Column({ name: 'required_roles', type: 'text', array: true, nullable: true })
  requiredRoles?: string[];

  @Column({ name: 'condition_expression', type: 'jsonb', nullable: true })
  conditionExpression?: any;

  @Column({ name: 'masking_strategy', type: 'enum', enumName: 'masking_strategy', default: 'NONE' })
  maskingStrategy!: string;

  @Column({ name: 'is_enabled', type: 'boolean', default: true })
  isEnabled!: boolean;

  @Column({ name: 'priority', type: 'int', default: 100 })
  priority!: number;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}
