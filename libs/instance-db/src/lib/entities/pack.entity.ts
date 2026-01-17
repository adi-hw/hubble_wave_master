import {
  Entity,
  PrimaryGeneratedColumn,
  PrimaryColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { User } from './user.entity';

export type PackReleaseStatus = 'applying' | 'applied' | 'failed' | 'rolled_back' | 'skipped';
export type PackActorType = 'user' | 'system';
export type PackObjectType =
  | 'metadata'
  | 'access'
  | 'views'
  | 'navigation'
  | 'connectors'
  | 'search'
  | 'localization'
  | 'automation'
  | 'workflows'
  | 'insights'
  | 'ava'
  | 'seed';

@Entity('pack_release_records')
@Index(['packCode', 'packReleaseId'])
@Index(['status'])
export class PackReleaseRecord {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'pack_code', type: 'varchar', length: 200 })
  packCode!: string;

  @Column({ name: 'pack_release_id', type: 'varchar', length: 50 })
  packReleaseId!: string;

  @Column({ type: 'varchar', length: 30 })
  status!: PackReleaseStatus;

  @Column({ type: 'jsonb' })
  manifest!: Record<string, unknown>;

  @Column({ name: 'artifact_sha256', type: 'varchar', length: 64, nullable: true })
  artifactSha256?: string | null;

  @Column({ name: 'install_summary', type: 'jsonb', default: () => `'{}'` })
  installSummary!: Record<string, unknown>;

  @Column({ type: 'jsonb', default: () => `'[]'` })
  warnings!: Record<string, unknown>[];

  @Column({ name: 'applied_by', type: 'uuid', nullable: true })
  appliedBy?: string | null;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'applied_by' })
  appliedByUser?: User | null;

  @Column({ name: 'applied_by_type', type: 'varchar', length: 20, default: 'system' })
  appliedByType!: PackActorType;

  @Column({ name: 'started_at', type: 'timestamptz', default: () => 'now()' })
  startedAt!: Date;

  @Column({ name: 'completed_at', type: 'timestamptz', nullable: true })
  completedAt?: Date | null;

  @Column({ name: 'rollback_of_release_id', type: 'uuid', nullable: true })
  rollbackOfReleaseId?: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}

@Entity('pack_object_revisions')
@Index(['objectType', 'objectKey'])
@Index(['releaseRecordId'])
export class PackObjectRevision {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'release_record_id', type: 'uuid' })
  releaseRecordId!: string;

  @ManyToOne(() => PackReleaseRecord, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'release_record_id' })
  releaseRecord?: PackReleaseRecord;

  @Column({ name: 'object_type', type: 'varchar', length: 30 })
  objectType!: PackObjectType;

  @Column({ name: 'object_key', type: 'varchar', length: 255 })
  objectKey!: string;

  @Column({ name: 'object_hash', type: 'varchar', length: 64 })
  objectHash!: string;

  @Column({ name: 'object_id', type: 'uuid', nullable: true })
  objectId?: string | null;

  @Column({ type: 'jsonb' })
  content!: Record<string, unknown>;

  @Column({ name: 'created_by', type: 'uuid', nullable: true })
  createdBy?: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;
}

@Entity('pack_object_states')
@Index(['objectType', 'objectKey'], { unique: true })
@Index(['packCode'])
export class PackObjectState {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'object_type', type: 'varchar', length: 30 })
  objectType!: PackObjectType;

  @Column({ name: 'object_key', type: 'varchar', length: 255 })
  objectKey!: string;

  @Column({ name: 'pack_code', type: 'varchar', length: 200 })
  packCode!: string;

  @Column({ name: 'current_revision_id', type: 'uuid' })
  currentRevisionId!: string;

  @ManyToOne(() => PackObjectRevision)
  @JoinColumn({ name: 'current_revision_id' })
  currentRevision?: PackObjectRevision;

  @Column({ name: 'current_hash', type: 'varchar', length: 64 })
  currentHash!: string;

  @Column({ name: 'object_id', type: 'uuid', nullable: true })
  objectId?: string | null;

  @Column({ name: 'is_active', type: 'boolean', default: true })
  isActive!: boolean;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}

@Entity('pack_install_locks')
export class PackInstallLock {
  @PrimaryColumn({ name: 'lock_key', type: 'varchar', length: 100 })
  lockKey!: string;

  @Column({ name: 'lock_holder', type: 'varchar', length: 100, nullable: true })
  lockHolder?: string | null;

  @Column({ name: 'lock_acquired_at', type: 'timestamptz', nullable: true })
  lockAcquiredAt?: Date | null;

  @Column({ name: 'lock_expires_at', type: 'timestamptz', nullable: true })
  lockExpiresAt?: Date | null;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}
