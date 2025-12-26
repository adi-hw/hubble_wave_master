import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
  OneToMany,
} from 'typeorm';
import { RolePermission } from './role-permission.entity';

/**
 * Permission entity - defines granular permissions
 * 
 * NOTE: This is NOT "tenant_permissions" - we don't use tenant terminology!
 * This table exists in each customer's isolated database.
 * There is NO tenant_id column.
 */
@Entity('permissions')
@Index(['code'], { unique: true })
@Index(['category'])
@Index(['resourceType'])
export class Permission {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  /** Unique permission code (e.g., 'users.create', 'assets.delete') */
  @Column({ type: 'varchar', length: 100, unique: true })
  code!: string;

  /** Display name */
  @Column({ type: 'varchar', length: 255 })
  name!: string;

  /** Description */
  @Column({ type: 'text', nullable: true })
  description?: string | null;

  // ─────────────────────────────────────────────────────────────────
  // Categorization
  // ─────────────────────────────────────────────────────────────────

  /** Category for grouping (e.g., 'users', 'assets', 'admin') */
  @Column({ type: 'varchar', length: 100, nullable: true })
  category?: string | null;

  /** Resource type this permission applies to */
  @Column({ name: 'resource_type', type: 'varchar', length: 100, nullable: true })
  resourceType?: string | null;

  /** Action type (e.g., 'view', 'create', 'edit', 'delete') */
  @Column({ name: 'action_type', type: 'varchar', length: 50, nullable: true })
  actionType?: string | null;

  // ─────────────────────────────────────────────────────────────────
  // Flags
  // ─────────────────────────────────────────────────────────────────

  /** System permission (cannot be deleted) */
  @Column({ name: 'is_system', type: 'boolean', default: false })
  isSystem!: boolean;

  /** Dangerous permission (requires extra confirmation) */
  @Column({ name: 'is_dangerous', type: 'boolean', default: false })
  isDangerous!: boolean;

  // ─────────────────────────────────────────────────────────────────
  // Display
  // ─────────────────────────────────────────────────────────────────

  /** Display order within category */
  @Column({ name: 'display_order', type: 'integer', default: 0 })
  displayOrder!: number;

  /** Icon for UI display */
  @Column({ type: 'varchar', length: 100, nullable: true })
  icon?: string | null;

  // ─────────────────────────────────────────────────────────────────
  // Relations
  // ─────────────────────────────────────────────────────────────────

  @OneToMany(() => RolePermission, (rp) => rp.permission)
  rolePermissions?: RolePermission[];

  // ─────────────────────────────────────────────────────────────────
  // Timestamp
  // ─────────────────────────────────────────────────────────────────

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;
}
