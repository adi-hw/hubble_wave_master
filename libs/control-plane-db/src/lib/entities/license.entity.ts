// ============================================================
// LICENSE ENTITY
// ============================================================

import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Customer } from './customer.entity';
import { Instance } from './instance.entity';

/**
 * License type
 */
export type LicenseType = 'starter' | 'professional' | 'enterprise' | 'trial';

/**
 * License status
 */
export type LicenseStatus = 'active' | 'pending' | 'expired' | 'revoked';

/**
 * License entity - represents a software license for a customer
 * Stored in Control Plane database (eam_control)
 */
@Entity('licenses')
@Index(['customerId'])
@Index(['instanceId'])
@Index(['licenseKey'], { unique: true })
@Index(['expiresAt'])
@Index(['status'])
export class License {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  /** Customer this license belongs to */
  @Column({ name: 'customer_id', type: 'uuid' })
  customerId!: string;

  @ManyToOne(() => Customer, (customer) => customer.licenses)
  @JoinColumn({ name: 'customer_id' })
  customer?: Customer;

  /** Instance this license is assigned to (optional) */
  @Column({ name: 'instance_id', type: 'uuid', nullable: true })
  instanceId?: string | null;

  @ManyToOne(() => Instance, { nullable: true })
  @JoinColumn({ name: 'instance_id' })
  instance?: Instance | null;

  /** Unique license key */
  @Column({ name: 'license_key', type: 'varchar', length: 500, unique: true })
  licenseKey!: string;

  /** License type */
  @Column({ name: 'license_type', type: 'varchar', length: 50 })
  licenseType!: LicenseType;

  /** License status */
  @Column({ type: 'varchar', length: 20, default: 'active' })
  status!: LicenseStatus;

  /** Enabled features */
  @Column({ type: 'jsonb', default: () => `'[]'` })
  features!: string[];

  /** Maximum users allowed */
  @Column({ name: 'max_users', type: 'integer', nullable: true })
  maxUsers?: number | null;

  /** Maximum assets allowed */
  @Column({ name: 'max_assets', type: 'integer', nullable: true })
  maxAssets?: number | null;

  /** Cryptographic signature */
  @Column({ type: 'varchar', length: 500, nullable: true })
  signature?: string | null;

  /** Additional metadata */
  @Column({ type: 'jsonb', default: () => `'{}'` })
  metadata!: Record<string, unknown>;

  /** Who created this license */
  @Column({ name: 'created_by', type: 'uuid', nullable: true })
  createdBy?: string | null;

  /** When license was issued */
  @Column({ name: 'issued_at', type: 'timestamptz', default: () => 'NOW()' })
  issuedAt!: Date;

  /** When license expires */
  @Column({ name: 'expires_at', type: 'timestamptz', nullable: true })
  expiresAt?: Date | null;

  /** When license was revoked (if revoked) */
  @Column({ name: 'revoked_at', type: 'timestamptz', nullable: true })
  revokedAt?: Date | null;

  /** Who revoked this license */
  @Column({ name: 'revoked_by', type: 'uuid', nullable: true })
  revokedBy?: string | null;

  /** Revocation reason */
  @Column({ name: 'revoke_reason', type: 'text', nullable: true })
  revokeReason?: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;
}
