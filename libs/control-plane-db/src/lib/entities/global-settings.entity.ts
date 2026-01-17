import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

@Entity('global_settings')
@Index(['scope'], { unique: true })
export class GlobalSettings {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'varchar', length: 40, default: 'global' })
  scope!: string;

  @Column({ name: 'platform_name', type: 'varchar', length: 255 })
  platformName!: string;

  @Column({ name: 'maintenance_mode', type: 'boolean', default: false })
  maintenanceMode!: boolean;

  @Column({ name: 'public_signup', type: 'boolean', default: false })
  publicSignup!: boolean;

  @Column({ name: 'default_trial_days', type: 'integer', default: 14 })
  defaultTrialDays!: number;

  @Column({ name: 'support_email', type: 'varchar', length: 320 })
  supportEmail!: string;

  @Column({ type: 'jsonb', default: () => `'{}'` })
  metadata!: Record<string, unknown>;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}
