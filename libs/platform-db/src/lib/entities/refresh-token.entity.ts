import { Entity, Column, PrimaryGeneratedColumn, ManyToOne, JoinColumn, CreateDateColumn } from 'typeorm';
import { UserAccount } from './user-account.entity';
import { Tenant } from './tenant.entity';

@Entity('refresh_tokens')
export class RefreshToken {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'user_id', type: 'uuid' })
  userId!: string;

  @ManyToOne(() => UserAccount)
  @JoinColumn({ name: 'user_id' })
  user!: UserAccount;

  @Column({ name: 'tenant_id', type: 'uuid' })
  tenantId!: string;

  @ManyToOne(() => Tenant)
  @JoinColumn({ name: 'tenant_id' })
  tenant!: Tenant;

  @Column({ name: 'token_hash', unique: true })
  tokenHash!: string;

  @Column({ name: 'family_id', type: 'uuid' })
  familyId!: string;

  @Column({ name: 'issued_at', type: 'timestamptz', default: () => 'now()' })
  issuedAt!: Date;

  @Column({ name: 'expires_at', type: 'timestamptz' })
  expiresAt!: Date;

  @Column({ name: 'last_used_at', type: 'timestamptz', nullable: true })
  lastUsedAt?: Date;

  @Column({ name: 'revoked_at', type: 'timestamptz', nullable: true })
  revokedAt?: Date;

  @Column({ name: 'revoked_reason', nullable: true })
  revokedReason?: string;

  @Column({ name: 'replaced_by_id', type: 'uuid', nullable: true })
  replacedById?: string;

  @ManyToOne(() => RefreshToken, { nullable: true })
  @JoinColumn({ name: 'replaced_by_id' })
  replacedBy?: RefreshToken | null;

  @Column({ name: 'created_by_ip', type: 'inet', nullable: true })
  createdByIp?: string;

  @Column({ name: 'created_user_agent', nullable: true })
  createdUserAgent?: string;

  @Column({ name: 'last_ip', type: 'inet', nullable: true })
  lastIp?: string;

  @Column({ name: 'last_user_agent', nullable: true })
  lastUserAgent?: string;

  @Column({ name: 'is_reuse_suspect', type: 'boolean', default: false })
  isReuseSuspect!: boolean;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @Column({ name: 'created_by', type: 'uuid', nullable: true })
  createdBy?: string;

  @Column({ name: 'deleted_at', type: 'timestamptz', nullable: true })
  deletedAt?: Date | null;
}
