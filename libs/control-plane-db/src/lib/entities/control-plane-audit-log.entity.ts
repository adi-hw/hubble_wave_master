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
import { ControlPlaneUser } from './control-plane-user.entity';

/**
 * ControlPlaneAuditLog entity - audit trail for control plane operations
 * Stored in Control Plane database (eam_control)
 * 
 * Tracks all administrative actions performed by HubbleWave staff
 */
@Entity('control_plane_audit_log')
@Index(['userId'])
@Index(['customerId'])
@Index(['instanceId'])
@Index(['action'])
@Index(['createdAt'])
export class ControlPlaneAuditLog {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  /** User who performed the action */
  @Column({ name: 'user_id', type: 'uuid', nullable: true })
  userId?: string | null;

  @ManyToOne(() => ControlPlaneUser, { nullable: true })
  @JoinColumn({ name: 'user_id' })
  user?: ControlPlaneUser | null;

  /** Customer affected (if applicable) */
  @Column({ name: 'customer_id', type: 'uuid', nullable: true })
  customerId?: string | null;

  @ManyToOne(() => Customer, { nullable: true })
  @JoinColumn({ name: 'customer_id' })
  customer?: Customer | null;

  /** Instance affected (if applicable) */
  @Column({ name: 'instance_id', type: 'uuid', nullable: true })
  instanceId?: string | null;

  @ManyToOne(() => Instance, { nullable: true })
  @JoinColumn({ name: 'instance_id' })
  instance?: Instance | null;

  // ─────────────────────────────────────────────────────────────────
  // Action Details
  // ─────────────────────────────────────────────────────────────────

  /** Action performed (e.g., 'customer.create', 'instance.provision', 'instance.suspend') */
  @Column({ type: 'varchar', length: 100 })
  action!: string;

  /** Resource type affected */
  @Column({ name: 'resource_type', type: 'varchar', length: 50, nullable: true })
  resourceType?: string | null;

  /** Resource ID affected */
  @Column({ name: 'resource_id', type: 'uuid', nullable: true })
  resourceId?: string | null;

  /** Action result (success, failure, etc.) */
  @Column({ type: 'varchar', length: 20, default: 'success' })
  result!: string;

  /** Error message (if failed) */
  @Column({ name: 'error_message', type: 'text', nullable: true })
  errorMessage?: string | null;

  // ─────────────────────────────────────────────────────────────────
  // Change Tracking
  // ─────────────────────────────────────────────────────────────────

  /** Previous values (for updates) */
  @Column({ name: 'old_values', type: 'jsonb', nullable: true })
  oldValues?: Record<string, unknown> | null;

  /** New values (for creates/updates) */
  @Column({ name: 'new_values', type: 'jsonb', nullable: true })
  newValues?: Record<string, unknown> | null;

  /** Additional details */
  @Column({ type: 'jsonb', default: () => `'{}'` })
  details!: Record<string, unknown>;

  // ─────────────────────────────────────────────────────────────────
  // Request Context
  // ─────────────────────────────────────────────────────────────────

  /** IP address of requester */
  @Column({ name: 'ip_address', type: 'varchar', length: 45, nullable: true })
  ipAddress?: string | null;

  /** User agent string */
  @Column({ name: 'user_agent', type: 'text', nullable: true })
  userAgent?: string | null;

  /** Request ID for correlation */
  @Column({ name: 'request_id', type: 'varchar', length: 100, nullable: true })
  requestId?: string | null;

  // ─────────────────────────────────────────────────────────────────
  // Timestamp
  // ─────────────────────────────────────────────────────────────────

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;
}
