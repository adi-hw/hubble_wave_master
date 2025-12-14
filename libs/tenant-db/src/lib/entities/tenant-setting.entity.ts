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

export type SettingValueType = 'string' | 'number' | 'boolean' | 'json' | 'array';
export type SettingUiComponent =
  | 'text'
  | 'textarea'
  | 'number'
  | 'toggle'
  | 'select'
  | 'multiselect'
  | 'json_editor'
  | 'password'
  | 'email'
  | 'url';

@Entity('tenant_settings')
@Index(['category'])
@Unique(['category', 'key'])
export class TenantSetting {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'varchar', length: 50 })
  category!: string;

  @Column({ type: 'varchar', length: 100 })
  key!: string;

  @Column({ type: 'jsonb' })
  value!: unknown;

  @Column({ name: 'value_type', type: 'varchar', length: 20, default: 'string' })
  valueType!: SettingValueType;

  // UI metadata
  @Column({ name: 'display_name', type: 'varchar', length: 200, nullable: true })
  displayName?: string | null;

  @Column({ type: 'text', nullable: true })
  description?: string | null;

  @Column({ name: 'ui_component', type: 'varchar', length: 50, nullable: true })
  uiComponent?: SettingUiComponent | null;

  @Column({ name: 'ui_options', type: 'jsonb', default: () => `'{}'` })
  uiOptions!: Record<string, unknown>;

  // Validation
  @Column({ name: 'validation_rules', type: 'jsonb', nullable: true })
  validationRules?: Record<string, unknown> | null;

  @Column({ name: 'default_value', type: 'jsonb', nullable: true })
  defaultValue?: unknown | null;

  // Access control
  @Column({ name: 'requires_admin', type: 'boolean', default: true })
  requiresAdmin!: boolean;

  @Column({ name: 'is_sensitive', type: 'boolean', default: false })
  isSensitive!: boolean;

  @Column({ name: 'is_readonly', type: 'boolean', default: false })
  isReadonly!: boolean;

  // Grouping and ordering
  @Column({ name: 'display_order', type: 'int', default: 0 })
  displayOrder!: number;

  @Column({ name: 'group_name', type: 'varchar', length: 100, nullable: true })
  groupName?: string | null;

  // Audit
  @Column({ name: 'updated_by', type: 'uuid', nullable: true })
  updatedBy?: string | null;

  @ManyToOne(() => TenantUser, { nullable: true })
  @JoinColumn({ name: 'updated_by' })
  updatedByUser?: TenantUser | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}
