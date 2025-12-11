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
import { TenantGroup } from './tenant-group.entity';

/**
 * TenantGroupMember - Maps users to tenant groups
 *
 * Note: userId references a user in the platform-db UserAccount table.
 * We store the UUID reference but don't create a foreign key since
 * this is a cross-database relationship.
 */
@Entity('tenant_group_members')
@Unique(['groupId', 'userId'])
@Index(['groupId'])
@Index(['userId'])
export class TenantGroupMember {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'group_id', type: 'uuid' })
  groupId!: string;

  @ManyToOne(() => TenantGroup, (group) => group.members, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'group_id' })
  group!: TenantGroup;

  @Column({ name: 'user_id', type: 'uuid' })
  userId!: string;

  @Column({ name: 'is_manager', type: 'boolean', default: false })
  isManager!: boolean;

  @Column({ name: 'added_by', type: 'uuid', nullable: true })
  addedBy?: string;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;
}
