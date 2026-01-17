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

export type SearchScope = 'system' | 'instance' | 'role' | 'group' | 'personal';

@Entity('search_experiences')
@Index(['code'], { unique: true })
@Index(['scope'])
@Index(['scopeKey'])
export class SearchExperience {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'code', type: 'varchar', length: 120 })
  code!: string;

  @Column({ name: 'name', type: 'varchar', length: 255 })
  name!: string;

  @Column({ name: 'description', type: 'text', nullable: true })
  description?: string | null;

  @Column({ name: 'scope', type: 'varchar', length: 20 })
  scope!: SearchScope;

  @Column({ name: 'scope_key', type: 'varchar', length: 120, nullable: true })
  scopeKey?: string | null;

  @Column({ name: 'config', type: 'jsonb', default: () => `'{}'` })
  config!: Record<string, unknown>;

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

@Entity('search_sources')
@Index(['code'], { unique: true })
@Index(['collectionCode'])
export class SearchSource {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'code', type: 'varchar', length: 120 })
  code!: string;

  @Column({ name: 'name', type: 'varchar', length: 255 })
  name!: string;

  @Column({ name: 'description', type: 'text', nullable: true })
  description?: string | null;

  @Column({ name: 'collection_code', type: 'varchar', length: 120 })
  collectionCode!: string;

  @Column({ name: 'config', type: 'jsonb', default: () => `'{}'` })
  config!: Record<string, unknown>;

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

@Entity('search_dictionaries')
@Index(['code'], { unique: true })
@Index(['locale'])
export class SearchDictionary {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'code', type: 'varchar', length: 120 })
  code!: string;

  @Column({ name: 'name', type: 'varchar', length: 255 })
  name!: string;

  @Column({ name: 'locale', type: 'varchar', length: 20, default: 'en' })
  locale!: string;

  @Column({ name: 'entries', type: 'jsonb', default: () => `'[]'` })
  entries!: Array<{ term: string; synonyms: string[] }>;

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

export type SearchIndexStatus = 'idle' | 'running' | 'failed' | 'paused';

@Entity('search_index_state')
@Index(['collectionCode'], { unique: true })
export class SearchIndexState {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'collection_code', type: 'varchar', length: 120 })
  collectionCode!: string;

  @Column({ name: 'status', type: 'varchar', length: 20, default: 'idle' })
  status!: SearchIndexStatus;

  @Column({ name: 'last_indexed_at', type: 'timestamptz', nullable: true })
  lastIndexedAt?: Date | null;

  @Column({ name: 'last_cursor', type: 'varchar', length: 200, nullable: true })
  lastCursor?: string | null;

  @Column({ name: 'stats', type: 'jsonb', default: () => `'{}'` })
  stats!: Record<string, unknown>;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}
