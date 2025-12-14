import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
  Unique,
} from 'typeorm';
import { TenantUser } from './tenant-user.entity';

@Entity('user_api_keys')
@Index(['userId'])
@Index(['keyPrefix'])
@Index(['userId'], { where: '"is_active" = true' })
@Unique(['userId', 'name'])
export class UserApiKey {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'user_id', type: 'uuid' })
  userId!: string;

  @ManyToOne(() => TenantUser, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user!: TenantUser;

  @Column({ type: 'varchar', length: 100 })
  name!: string;

  @Column({ type: 'text', nullable: true })
  description?: string | null;

  // Key storage (only prefix shown, full key hashed)
  @Column({ name: 'key_prefix', type: 'varchar', length: 12 })
  keyPrefix!: string;

  @Column({ name: 'key_hash', type: 'varchar', length: 255 })
  keyHash!: string;

  // Permissions
  @Column({ type: 'jsonb', default: () => `'["read"]'` })
  scopes!: string[];

  // Rate limiting
  @Column({ name: 'rate_limit_per_minute', type: 'int', default: 60 })
  rateLimitPerMinute!: number;

  // Expiration
  @Column({ name: 'expires_at', type: 'timestamptz', nullable: true })
  expiresAt?: Date | null;

  // Usage tracking
  @Column({ name: 'last_used_at', type: 'timestamptz', nullable: true })
  lastUsedAt?: Date | null;

  @Column({ name: 'last_used_ip', type: 'varchar', length: 45, nullable: true })
  lastUsedIp?: string | null;

  @Column({ name: 'usage_count', type: 'bigint', default: 0 })
  usageCount!: number;

  // Status
  @Column({ name: 'is_active', type: 'boolean', default: true })
  isActive!: boolean;

  @Column({ name: 'revoked_at', type: 'timestamptz', nullable: true })
  revokedAt?: Date | null;

  @Column({ name: 'revoked_by', type: 'uuid', nullable: true })
  revokedBy?: string | null;

  @ManyToOne(() => TenantUser, { nullable: true })
  @JoinColumn({ name: 'revoked_by' })
  revokedByUser?: TenantUser | null;

  @Column({ name: 'revoke_reason', type: 'text', nullable: true })
  revokeReason?: string | null;

  // Audit timestamps
  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}
