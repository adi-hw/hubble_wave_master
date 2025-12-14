import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
  Check,
} from 'typeorm';
import { TenantUser } from './tenant-user.entity';

export type DelegationType = 'all' | 'approval' | 'specific_module';

@Entity('user_delegates')
@Index(['userId'])
@Index(['delegateId'])
@Index(['userId', 'delegateId'], { where: '"revoked_at" IS NULL' })
@Check('"user_id" != "delegate_id"')
@Check('"ends_at" IS NULL OR "ends_at" > "starts_at"')
export class UserDelegate {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'user_id', type: 'uuid' })
  userId!: string;

  @ManyToOne(() => TenantUser, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user!: TenantUser;

  @Column({ name: 'delegate_id', type: 'uuid' })
  delegateId!: string;

  @ManyToOne(() => TenantUser, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'delegate_id' })
  delegate!: TenantUser;

  // Delegation scope
  @Column({ name: 'delegation_type', type: 'varchar', length: 50 })
  delegationType!: DelegationType;

  @Column({ name: 'module_scope', type: 'varchar', length: 100, nullable: true })
  moduleScope?: string | null;

  // Time bounds
  @Column({ name: 'starts_at', type: 'timestamptz', default: () => 'NOW()' })
  startsAt!: Date;

  @Column({ name: 'ends_at', type: 'timestamptz', nullable: true })
  endsAt?: Date | null;

  // Permissions delegated
  @Column({ name: 'can_approve', type: 'boolean', default: true })
  canApprove!: boolean;

  @Column({ name: 'can_create', type: 'boolean', default: false })
  canCreate!: boolean;

  @Column({ name: 'can_edit', type: 'boolean', default: false })
  canEdit!: boolean;

  // Notes
  @Column({ type: 'text', nullable: true })
  notes?: string | null;

  // Audit
  @Column({ name: 'created_by', type: 'uuid', nullable: true })
  createdBy?: string | null;

  @ManyToOne(() => TenantUser, { nullable: true })
  @JoinColumn({ name: 'created_by' })
  createdByUser?: TenantUser | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @Column({ name: 'revoked_at', type: 'timestamptz', nullable: true })
  revokedAt?: Date | null;

  @Column({ name: 'revoked_by', type: 'uuid', nullable: true })
  revokedBy?: string | null;

  @ManyToOne(() => TenantUser, { nullable: true })
  @JoinColumn({ name: 'revoked_by' })
  revokedByUser?: TenantUser | null;

  @Column({ name: 'revoke_reason', type: 'text', nullable: true })
  revokeReason?: string | null;
}
