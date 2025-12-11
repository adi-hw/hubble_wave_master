import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, Unique } from 'typeorm';

/**
 * Tenant-local representation of a user for app data (created_by, assigned_to, etc.).
 * Links back to control-plane membership via tenant_user_id but keeps tenant DB self contained.
 */
@Entity('user_profile')
@Unique(['tenantUserId'])
export class UserProfile {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'tenant_user_id', type: 'uuid' })
  tenantUserId!: string;

  @Column({ name: 'display_name', length: 255 })
  displayName!: string;

  @Column({ length: 320 })
  email!: string;

  @Column({ name: 'phone_number', type: 'varchar', length: 50, nullable: true })
  phoneNumber?: string | null;

  @Column({ type: 'varchar', length: 20, nullable: true })
  locale?: string | null;

  @Column({ name: 'time_zone', type: 'varchar', length: 50, nullable: true })
  timeZone?: string | null;

  @Column({ type: 'varchar', nullable: true })
  title?: string | null;

  @Column({ type: 'varchar', nullable: true })
  department?: string | null;

  @Column({ type: 'jsonb', default: () => `'{}'` })
  preferences!: Record<string, any>;

  @Column({ name: 'is_active', type: 'boolean', default: true })
  isActive!: boolean;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}
