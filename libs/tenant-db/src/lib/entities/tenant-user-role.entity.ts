import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
  Index,
  Unique,
} from 'typeorm';
import { TenantRole } from './tenant-role.entity';

/**
 * TenantUserRole - Direct role assignments to users
 *
 * Note: userId references a user in the platform-db UserAccount table.
 * We store the UUID reference but don't create a foreign key since
 * this is a cross-database relationship.
 */
@Entity('tenant_user_roles')
@Unique(['userId', 'roleId'])
@Index(['userId'])
@Index(['roleId'])
export class TenantUserRole {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'user_id', type: 'uuid' })
  userId!: string;

  @Column({ name: 'role_id', type: 'uuid' })
  roleId!: string;

  @ManyToOne(() => TenantRole, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'role_id' })
  role!: TenantRole;

  @Column({ name: 'assigned_by', type: 'uuid', nullable: true })
  assignedBy?: string;

  @Column({ name: 'expires_at', type: 'timestamptz', nullable: true })
  expiresAt?: Date;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;
}
