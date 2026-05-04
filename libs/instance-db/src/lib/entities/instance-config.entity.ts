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

@Entity('instance_customizations')
export class InstanceCustomization {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column()
  configType!: string;

  @Column()
  resourceKey!: string;

  @Column({ type: 'jsonb', nullable: true })
  value?: CustomizationValue;

  @Column({ default: true })
  isActive!: boolean;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;

  @Column({ nullable: true })
  createdBy?: string;

  @Column({ nullable: true })
  updatedBy?: string;
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
