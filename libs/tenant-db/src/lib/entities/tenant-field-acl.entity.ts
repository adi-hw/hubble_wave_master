import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
  Unique,
} from 'typeorm';
import { AclPrincipalType } from './tenant-table-acl.entity';

export enum FieldAclAccess {
  NONE = 'none',
  READ = 'read',
  WRITE = 'write',
}

/**
 * TenantFieldAcl - Field-level access control lists
 *
 * Defines fine-grained access control at the field level.
 * This allows hiding or making specific fields read-only
 * for certain roles, groups, or users.
 */
@Entity('tenant_field_acls')
@Unique(['tableCode', 'fieldCode', 'principalType', 'principalId'])
@Index(['tableCode', 'fieldCode'])
@Index(['principalType', 'principalId'])
export class TenantFieldAcl {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'table_code', type: 'varchar', length: 100 })
  tableCode!: string;

  @Column({ name: 'field_code', type: 'varchar', length: 100 })
  fieldCode!: string;

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
    enum: FieldAclAccess,
    enumName: 'field_acl_access',
    default: FieldAclAccess.READ,
  })
  access!: FieldAclAccess;

  @Column({ name: 'created_by', type: 'uuid', nullable: true })
  createdBy?: string;

  @Column({ name: 'updated_by', type: 'uuid', nullable: true })
  updatedBy?: string;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}
