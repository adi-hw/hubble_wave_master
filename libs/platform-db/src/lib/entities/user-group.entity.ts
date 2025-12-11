import { Entity, Column, PrimaryGeneratedColumn, ManyToOne, JoinColumn, CreateDateColumn, Unique } from 'typeorm';
import { TenantUserMembership } from './tenant-user-membership.entity';
import { Group } from './group.entity';

@Entity('user_groups')
@Unique(['tenantUserMembershipId', 'groupId'])
export class UserGroup {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'tenant_user_membership_id', type: 'uuid' })
  tenantUserMembershipId!: string;

  @ManyToOne(() => TenantUserMembership)
  @JoinColumn({ name: 'tenant_user_membership_id' })
  membership!: TenantUserMembership;

  @Column({ name: 'group_id', type: 'uuid' })
  groupId!: string;

  @ManyToOne(() => Group)
  @JoinColumn({ name: 'group_id' })
  group!: Group;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;
}
