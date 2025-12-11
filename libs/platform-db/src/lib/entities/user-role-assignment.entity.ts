import { Entity, Column, PrimaryGeneratedColumn, ManyToOne, JoinColumn, CreateDateColumn, Unique } from 'typeorm';
import { TenantUserMembership } from './tenant-user-membership.entity';
import { Role } from './role.entity';

@Entity('user_role_assignments')
@Unique(['tenantUserMembershipId', 'roleId'])
export class UserRoleAssignment {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'tenant_user_membership_id', type: 'uuid' })
  tenantUserMembershipId!: string;

  @ManyToOne(() => TenantUserMembership)
  @JoinColumn({ name: 'tenant_user_membership_id' })
  membership!: TenantUserMembership;

  @Column({ name: 'role_id', type: 'uuid' })
  roleId!: string;

  @ManyToOne(() => Role)
  @JoinColumn({ name: 'role_id' })
  role!: Role;

  @Column({ name: 'source', type: 'enum', enumName: 'role_assignment_source', default: 'DIRECT' })
  source!: string;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;
}
