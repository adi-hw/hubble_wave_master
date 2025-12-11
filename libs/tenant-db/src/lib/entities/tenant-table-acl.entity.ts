import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
  Unique,
} from 'typeorm';

export enum AclOperation {
  READ = 'read',
  CREATE = 'create',
  WRITE = 'write',
  DELETE = 'delete',
}

export enum AclPrincipalType {
  ROLE = 'role',
  GROUP = 'group',
  USER = 'user',
}

/**
 * TenantTableAcl - Table-level access control lists
 *
 * Defines who can perform what operations on specific tables.
 * This is stored in the tenant database for tenant-scoped ACLs.
 */
@Entity('tenant_table_acls')
@Unique(['tableCode', 'principalType', 'principalId', 'operation'])
@Index(['tableCode'])
@Index(['principalType', 'principalId'])
export class TenantTableAcl {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'table_code', type: 'varchar', length: 100 })
  tableCode!: string;

  @Column({
    name: 'principal_type',
    type: 'enum',
    enum: AclPrincipalType,
    enumName: 'acl_principal_type',
  })
  principalType!: AclPrincipalType;

  @Column({ name: 'principal_id', type: 'uuid' })
  principalId!: string;

  @Column({
    type: 'enum',
    enum: AclOperation,
    enumName: 'acl_operation',
  })
  operation!: AclOperation;

  @Column({ name: 'is_allowed', type: 'boolean', default: true })
  isAllowed!: boolean;

  @Column({ type: 'text', nullable: true })
  condition?: string;

  @Column({ name: 'created_by', type: 'uuid', nullable: true })
  createdBy?: string;

  @Column({ name: 'updated_by', type: 'uuid', nullable: true })
  updatedBy?: string;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}
