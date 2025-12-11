import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, ManyToOne, JoinColumn } from 'typeorm';
import { Tenant } from './tenant.entity';
import { UserAccount } from './user-account.entity';

@Entity('tenant_user_memberships')
export class TenantUserMembership {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'tenant_id', type: 'uuid' })
  tenantId!: string;

  @ManyToOne(() => Tenant)
  @JoinColumn({ name: 'tenant_id' })
  tenant!: Tenant;

  @Column({ name: 'user_id', type: 'uuid' })
  userId!: string;

  @ManyToOne(() => UserAccount)
  @JoinColumn({ name: 'user_id' })
  user!: UserAccount;

  @Column({ type: 'enum', enumName: 'tenant_user_membership_status', default: 'ACTIVE' })
  status!: string;

  @Column({ name: 'is_tenant_admin', type: 'boolean', default: false })
  isTenantAdmin!: boolean;

  @Column({ nullable: true })
  title?: string;

  @Column({ nullable: true })
  department?: string;

  @Column({ name: 'employee_id', nullable: true })
  employeeId?: string;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}
