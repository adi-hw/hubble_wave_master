import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, ManyToOne, OneToMany, JoinColumn, Index } from 'typeorm';
import { Role } from './role.entity';

export enum ModuleType {
  LIST = 'list',
  RECORD = 'record',
  FORM = 'form',
  DASHBOARD = 'dashboard',
  REPORT = 'report',
  URL = 'url',
  CUSTOM = 'custom',
  WIZARD = 'wizard'
}

export interface ModuleTargetConfig {
  table?: string;
  url?: string;
  route?: string;
  params?: Record<string, any>;
}

@Entity('modules')
@Index(['key'], { unique: true })
export class ModuleEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ unique: true })
  key!: string;

  @Column({ nullable: true })
  slug?: string;

  @Column()
  label!: string;

  // Legacy support alias if needed, primarily using label
  get name(): string { return this.label; }

  @Column({ nullable: true })
  icon?: string;

  @Column({ name: 'sort_order', default: 0 })
  sortOrder!: number;

  @Column({ type: 'varchar', default: 'list' })
  type!: ModuleType;

  @Column({ nullable: true })
  route?: string;

  @Column({ type: 'jsonb', nullable: true, name: 'target_config' })
  targetConfig?: ModuleTargetConfig;

  @Column({ nullable: true, name: 'application_key' })
  applicationKey?: string;

  @Column({ default: true, name: 'is_active' })
  isActive!: boolean;

  @OneToMany(() => ModuleSecurity, (ms: any) => ms.module)
  security?: ModuleSecurity[];

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}

@Entity('module_security')
export class ModuleSecurity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'module_id', type: 'uuid' })
  moduleId!: string;

  @ManyToOne(() => ModuleEntity)
  @JoinColumn({ name: 'module_id' })
  module?: ModuleEntity;

  @Column({ name: 'role_id', type: 'uuid' })
  roleId!: string;

  @ManyToOne(() => Role)
  @JoinColumn({ name: 'role_id' })
  role?: Role;

  @Column({ default: true })
  canView!: boolean;
}
