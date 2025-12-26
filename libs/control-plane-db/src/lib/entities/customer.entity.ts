import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
  OneToMany,
} from 'typeorm';
import { Instance } from './instance.entity';
import { Subscription } from './subscription.entity';
import { License } from './license.entity';

/**
 * Customer status
 */
export type CustomerStatus = 'active' | 'suspended' | 'terminated' | 'pending';

/**
 * Customer tier (pricing/feature level)
 */
export type CustomerTier = 'starter' | 'professional' | 'enterprise';

/**
 * Customer entity - represents a HubbleWave customer organization
 * Stored in Control Plane database (eam_control)
 * 
 * Each customer can have multiple instances (production, staging, development)
 */
@Entity('customers')
@Index(['code'], { unique: true })
@Index(['status'])
@Index(['tier'])
export class Customer {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  /** Unique customer code (used in URLs, API keys, etc.) */
  @Column({ type: 'varchar', length: 50, unique: true })
  code!: string;

  /** Customer organization name */
  @Column({ type: 'varchar', length: 255 })
  name!: string;

  /** Customer status */
  @Column({ type: 'varchar', length: 20, default: 'pending' })
  status!: CustomerStatus;

  /** Service tier */
  @Column({ type: 'varchar', length: 20, default: 'professional' })
  tier!: CustomerTier;

  // ─────────────────────────────────────────────────────────────────
  // Contract Information
  // ─────────────────────────────────────────────────────────────────

  /** Contract start date */
  @Column({ name: 'contract_start', type: 'date', nullable: true })
  contractStart?: Date | null;

  /** Contract end date */
  @Column({ name: 'contract_end', type: 'date', nullable: true })
  contractEnd?: Date | null;

  /** Contract value (annual) */
  @Column({ name: 'contract_value', type: 'decimal', precision: 12, scale: 2, nullable: true })
  contractValue?: number | null;

  /** Currency for contract value */
  @Column({ type: 'varchar', length: 3, default: 'USD' })
  currency!: string;

  // ─────────────────────────────────────────────────────────────────
  // Contact Information
  // ─────────────────────────────────────────────────────────────────

  /** Primary contact name */
  @Column({ name: 'primary_contact_name', type: 'varchar', length: 255, nullable: true })
  primaryContactName?: string | null;

  /** Primary contact email */
  @Column({ name: 'primary_contact_email', type: 'varchar', length: 320, nullable: true })
  primaryContactEmail?: string | null;

  /** Primary contact phone */
  @Column({ name: 'primary_contact_phone', type: 'varchar', length: 50, nullable: true })
  primaryContactPhone?: string | null;

  /** Technical contact email */
  @Column({ name: 'technical_contact_email', type: 'varchar', length: 320, nullable: true })
  technicalContactEmail?: string | null;

  /** Billing email */
  @Column({ name: 'billing_email', type: 'varchar', length: 320, nullable: true })
  billingEmail?: string | null;

  // ─────────────────────────────────────────────────────────────────
  // Address Information
  // ─────────────────────────────────────────────────────────────────

  @Column({ name: 'address_line1', type: 'varchar', length: 255, nullable: true })
  addressLine1?: string | null;

  @Column({ name: 'address_line2', type: 'varchar', length: 255, nullable: true })
  addressLine2?: string | null;

  @Column({ type: 'varchar', length: 100, nullable: true })
  city?: string | null;

  @Column({ type: 'varchar', length: 100, nullable: true })
  state?: string | null;

  @Column({ name: 'postal_code', type: 'varchar', length: 20, nullable: true })
  postalCode?: string | null;

  @Column({ type: 'varchar', length: 100, nullable: true })
  country?: string | null;

  // ─────────────────────────────────────────────────────────────────
  // Limits & Quotas
  // ─────────────────────────────────────────────────────────────────

  /** Maximum number of users across all instances */
  @Column({ name: 'max_users', type: 'integer', nullable: true })
  maxUsers?: number | null;

  /** Maximum number of assets across all instances */
  @Column({ name: 'max_assets', type: 'integer', nullable: true })
  maxAssets?: number | null;

  /** Maximum storage in GB */
  @Column({ name: 'max_storage_gb', type: 'integer', nullable: true })
  maxStorageGb?: number | null;

  /** Maximum number of instances (prod, staging, dev) */
  @Column({ name: 'max_instances', type: 'integer', default: 3 })
  maxInstances!: number;

  // ─────────────────────────────────────────────────────────────────
  // Settings & Metadata
  // ─────────────────────────────────────────────────────────────────

  /** Customer-specific settings */
  @Column({ type: 'jsonb', default: () => `'{}'` })
  settings!: Record<string, unknown>;

  /** Feature flags enabled for this customer */
  @Column({ name: 'feature_flags', type: 'jsonb', default: () => `'[]'` })
  featureFlags!: string[];

  /** Additional metadata */
  @Column({ type: 'jsonb', default: () => `'{}'` })
  metadata!: Record<string, unknown>;

  /** Internal notes (HubbleWave staff only) */
  @Column({ type: 'text', nullable: true })
  notes?: string | null;

  // ─────────────────────────────────────────────────────────────────
  // Relations
  // ─────────────────────────────────────────────────────────────────

  @OneToMany(() => Instance, (instance) => instance.customer)
  instances?: Instance[];

  @OneToMany(() => Subscription, (subscription) => subscription.customer)
  subscriptions?: Subscription[];

  @OneToMany(() => License, (license) => license.customer)
  licenses?: License[];

  // ─────────────────────────────────────────────────────────────────
  // Audit Fields
  // ─────────────────────────────────────────────────────────────────

  @Column({ name: 'created_by', type: 'uuid', nullable: true })
  createdBy?: string | null;

  @Column({ name: 'updated_by', type: 'uuid', nullable: true })
  updatedBy?: string | null;

  @Column({ name: 'deleted_at', type: 'timestamptz', nullable: true })
  deletedAt?: Date | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}
