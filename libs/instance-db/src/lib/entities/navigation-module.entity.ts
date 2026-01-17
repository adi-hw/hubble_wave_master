import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { User } from './user.entity';

export type NavigationScope = 'system' | 'instance' | 'role' | 'group' | 'personal';
export type NavigationRevisionStatus = 'draft' | 'published';

@Entity('navigation_modules')
@Index(['code'], { unique: true })
export class NavigationModule {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'code', type: 'varchar', length: 120 })
  code!: string;

  @Column({ name: 'name', type: 'varchar', length: 255 })
  name!: string;

  @Column({ name: 'description', type: 'text', nullable: true })
  description?: string | null;

  @Column({ name: 'metadata', type: 'jsonb', default: () => `'{}'` })
  metadata!: Record<string, unknown>;

  @Column({ name: 'is_active', type: 'boolean', default: true })
  isActive!: boolean;

  @Column({ name: 'created_by', type: 'uuid', nullable: true })
  createdBy?: string | null;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'created_by' })
  createdByUser?: User | null;

  @Column({ name: 'updated_by', type: 'uuid', nullable: true })
  updatedBy?: string | null;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'updated_by' })
  updatedByUser?: User | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}

@Entity('navigation_module_revisions')
@Index(['moduleId'])
@Index(['status'])
@Index(['moduleId', 'revision'], { unique: true })
export class NavigationModuleRevision {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'navigation_module_id', type: 'uuid' })
  moduleId!: string;

  @ManyToOne(() => NavigationModule, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'navigation_module_id' })
  module?: NavigationModule;

  @Column({ name: 'revision', type: 'integer' })
  revision!: number;

  @Column({ name: 'status', type: 'varchar', length: 20 })
  status!: NavigationRevisionStatus;

  @Column({ name: 'layout', type: 'jsonb', default: () => `'{}'` })
  layout!: Record<string, unknown>;

  @Column({ name: 'created_by', type: 'uuid', nullable: true })
  createdBy?: string | null;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'created_by' })
  createdByUser?: User | null;

  @Column({ name: 'published_by', type: 'uuid', nullable: true })
  publishedBy?: string | null;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'published_by' })
  publishedByUser?: User | null;

  @Column({ name: 'published_at', type: 'timestamptz', nullable: true })
  publishedAt?: Date | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;
}

@Entity('navigation_variants')
@Index(['moduleId'])
@Index(['scope'])
@Index(['scopeKey'])
export class NavigationVariant {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'navigation_module_id', type: 'uuid' })
  moduleId!: string;

  @ManyToOne(() => NavigationModule, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'navigation_module_id' })
  module?: NavigationModule;

  @Column({ name: 'scope', type: 'varchar', length: 20 })
  scope!: NavigationScope;

  @Column({ name: 'scope_key', type: 'varchar', length: 120, nullable: true })
  scopeKey?: string | null;

  @Column({ name: 'priority', type: 'integer', default: 100 })
  priority!: number;

  @Column({ name: 'is_active', type: 'boolean', default: true })
  isActive!: boolean;

  @Column({ name: 'created_by', type: 'uuid', nullable: true })
  createdBy?: string | null;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'created_by' })
  createdByUser?: User | null;

  @Column({ name: 'updated_by', type: 'uuid', nullable: true })
  updatedBy?: string | null;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'updated_by' })
  updatedByUser?: User | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}
