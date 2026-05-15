import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn } from 'typeorm';

/**
 * Typed customization value supporting common configuration patterns.
 */
export interface CustomizationValue {
  enabled?: boolean;
  settings?: Record<string, unknown>;
  overrides?: Record<string, unknown>;
  metadata?: Record<string, string>;
}

/**
 * Details of a configuration change for audit purposes.
 */
export interface ConfigChangeDetails {
  previousValue?: CustomizationValue;
  newValue?: CustomizationValue;
  changedFields?: string[];
  reason?: string;
  source?: 'ui' | 'api' | 'migration' | 'system';
}

/**
 * `instance_customizations` was rewritten by migration 1813000000000-
 * upgrade-assistant-tables.ts to a snake_case schema with additional
 * columns (instance_id, customization_type, original_value, description).
 * The codebase does not wire a SnakeNamingStrategy, so every @Column on
 * this entity carries an explicit `name:` override to bridge the entity's
 * camelCase property names to the DB's snake_case columns. Without these
 * overrides, every repo query against InstanceCustomization fails at
 * runtime with "column configType does not exist".
 *
 * Note: the sibling entity ConfigChangeHistory below uses unquoted
 * camelCase column names because that table was created by the
 * InitialSchema1766696011515 TypeORM-generated migration with
 * default-CamelCase identifiers. It's an existing naming-strategy
 * inconsistency in the schema; do not try to "fix" that table without
 * a migration.
 */
@Entity('instance_customizations')
export class InstanceCustomization {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'instance_id', type: 'varchar', length: 100, default: 'default-instance' })
  instanceId!: string;

  @Column({ name: 'config_type', type: 'varchar', length: 50 })
  configType!: string;

  @Column({ name: 'resource_key', type: 'varchar', length: 255 })
  resourceKey!: string;

  @Column({ name: 'customization_type', type: 'varchar', length: 20, default: 'override' })
  customizationType!: string;

  @Column({ name: 'original_value', type: 'jsonb', nullable: true })
  originalValue?: CustomizationValue;

  @Column({ name: 'custom_value', type: 'jsonb' })
  value!: CustomizationValue;

  @Column({ type: 'text', nullable: true })
  description?: string;

  @Column({ name: 'is_active', default: true })
  isActive!: boolean;

  @Column({ name: 'created_by', type: 'uuid', nullable: true })
  createdBy?: string;

  @Column({ name: 'updated_by', type: 'uuid', nullable: true })
  updatedBy?: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;
}

@Entity('config_change_history')
export class ConfigChangeHistory {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column()
  configType!: string;

  @Column({ nullable: true })
  code?: string;

  @Column()
  changeType!: string;

  @Column({ type: 'jsonb', nullable: true })
  details?: ConfigChangeDetails;

  @Column({ nullable: true })
  userId?: string;

  @CreateDateColumn()
  changedAt!: Date;
}
