import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn } from 'typeorm';

@Entity('table_acl')
export class TableAcl {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'tenant_id', type: 'uuid', nullable: true })
  tenantId!: string | null;

  @Column({ name: 'table_name' })
  tableName!: string;

  @Column({ name: 'operation', type: 'enum', enumName: 'acl_operation' })
  operation!: string;

  @Column({ name: 'required_permission_id', type: 'uuid', nullable: true })
  requiredPermissionId?: string;

  @Column({ name: 'required_roles', type: 'text', array: true, nullable: true })
  requiredRoles?: string[];

  @Column({ name: 'condition_expression', type: 'jsonb', nullable: true })
  conditionExpression?: any;

  @Column({ name: 'script_reference', nullable: true })
  scriptReference?: string;

  @Column({ name: 'priority', type: 'int', default: 100 })
  priority!: number;

  @Column({ name: 'is_enabled', type: 'boolean', default: true })
  isEnabled!: boolean;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}
