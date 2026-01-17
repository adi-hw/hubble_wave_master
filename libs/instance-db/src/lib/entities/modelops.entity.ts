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

export type DatasetDefinitionStatus = 'draft' | 'active' | 'archived';
export type DatasetSnapshotStatus = 'pending' | 'running' | 'completed' | 'failed';
export type ModelArtifactStatus = 'draft' | 'registered' | 'deprecated';
export type ModelEvaluationStatus = 'completed' | 'failed';
export type ModelTrainingStatus = 'pending' | 'running' | 'completed' | 'failed';
export type ModelDeploymentStatus = 'pending_approval' | 'approved' | 'rejected' | 'active' | 'inactive' | 'failed';

@Entity('dataset_definitions')
@Index(['code'], { unique: true })
@Index(['isActive'])
export class DatasetDefinition {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'code', type: 'varchar', length: 120 })
  code!: string;

  @Column({ name: 'name', type: 'varchar', length: 255 })
  name!: string;

  @Column({ name: 'description', type: 'text', nullable: true })
  description?: string | null;

  @Column({ name: 'source_collection_code', type: 'varchar', length: 120 })
  sourceCollectionCode!: string;

  @Column({ name: 'filter', type: 'jsonb', default: () => `'{}'` })
  filter!: Record<string, unknown>;

  @Column({ name: 'label_mapping', type: 'jsonb', default: () => `'{}'` })
  labelMapping!: Record<string, unknown>;

  @Column({ name: 'feature_mapping', type: 'jsonb', default: () => `'{}'` })
  featureMapping!: Record<string, unknown>;

  @Column({ name: 'status', type: 'varchar', length: 20, default: 'draft' })
  status!: DatasetDefinitionStatus;

  @Column({ name: 'version', type: 'int', default: 1 })
  version!: number;

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

@Entity('dataset_snapshots')
@Index(['datasetDefinitionId'])
@Index(['status'])
export class DatasetSnapshot {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'dataset_definition_id', type: 'uuid' })
  datasetDefinitionId!: string;

  @ManyToOne(() => DatasetDefinition, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'dataset_definition_id' })
  datasetDefinition?: DatasetDefinition;

  @Column({ name: 'status', type: 'varchar', length: 20, default: 'pending' })
  status!: DatasetSnapshotStatus;

  @Column({ name: 'snapshot_uri', type: 'text', nullable: true })
  snapshotUri?: string | null;

  @Column({ name: 'row_count', type: 'int', nullable: true })
  rowCount?: number | null;

  @Column({ name: 'checksum', type: 'varchar', length: 64, nullable: true })
  checksum?: string | null;

  @Column({ name: 'metadata', type: 'jsonb', default: () => `'{}'` })
  metadata!: Record<string, unknown>;

  @Column({ name: 'requested_by', type: 'uuid', nullable: true })
  requestedBy?: string | null;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'requested_by' })
  requestedByUser?: User | null;

  @Column({ name: 'started_at', type: 'timestamptz', nullable: true })
  startedAt?: Date | null;

  @Column({ name: 'completed_at', type: 'timestamptz', nullable: true })
  completedAt?: Date | null;

  @Column({ name: 'error_message', type: 'text', nullable: true })
  errorMessage?: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}

@Entity('model_artifacts')
@Index(['code', 'version'], { unique: true })
@Index(['status'])
export class ModelArtifact {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'code', type: 'varchar', length: 120 })
  code!: string;

  @Column({ name: 'name', type: 'varchar', length: 255 })
  name!: string;

  @Column({ name: 'version', type: 'varchar', length: 50 })
  version!: string;

  @Column({ name: 'description', type: 'text', nullable: true })
  description?: string | null;

  @Column({ name: 'dataset_snapshot_id', type: 'uuid', nullable: true })
  datasetSnapshotId?: string | null;

  @ManyToOne(() => DatasetSnapshot, { onDelete: 'SET NULL' })
  @JoinColumn({ name: 'dataset_snapshot_id' })
  datasetSnapshot?: DatasetSnapshot | null;

  @Column({ name: 'artifact_bucket', type: 'varchar', length: 255 })
  artifactBucket!: string;

  @Column({ name: 'artifact_key', type: 'text' })
  artifactKey!: string;

  @Column({ name: 'content_type', type: 'varchar', length: 120, nullable: true })
  contentType?: string | null;

  @Column({ name: 'checksum', type: 'varchar', length: 64, nullable: true })
  checksum?: string | null;

  @Column({ name: 'size_bytes', type: 'bigint', nullable: true })
  sizeBytes?: string | null;

  @Column({ name: 'status', type: 'varchar', length: 20, default: 'draft' })
  status!: ModelArtifactStatus;

  @Column({ name: 'metadata', type: 'jsonb', default: () => `'{}'` })
  metadata!: Record<string, unknown>;

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

@Entity('model_evaluations')
@Index(['modelArtifactId'])
@Index(['status'])
export class ModelEvaluation {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'model_artifact_id', type: 'uuid' })
  modelArtifactId!: string;

  @ManyToOne(() => ModelArtifact, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'model_artifact_id' })
  modelArtifact?: ModelArtifact;

  @Column({ name: 'dataset_snapshot_id', type: 'uuid', nullable: true })
  datasetSnapshotId?: string | null;

  @ManyToOne(() => DatasetSnapshot, { onDelete: 'SET NULL' })
  @JoinColumn({ name: 'dataset_snapshot_id' })
  datasetSnapshot?: DatasetSnapshot | null;

  @Column({ name: 'metrics', type: 'jsonb', default: () => `'{}'` })
  metrics!: Record<string, unknown>;

  @Column({ name: 'confusion_matrix', type: 'jsonb', default: () => `'{}'` })
  confusionMatrix!: Record<string, unknown>;

  @Column({ name: 'calibration_stats', type: 'jsonb', default: () => `'{}'` })
  calibrationStats!: Record<string, unknown>;

  @Column({ name: 'status', type: 'varchar', length: 20, default: 'completed' })
  status!: ModelEvaluationStatus;

  @Column({ name: 'metadata', type: 'jsonb', default: () => `'{}'` })
  metadata!: Record<string, unknown>;

  @Column({ name: 'created_by', type: 'uuid', nullable: true })
  createdBy?: string | null;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'created_by' })
  createdByUser?: User | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}

@Entity('model_training_jobs')
@Index(['status'])
@Index(['modelCode', 'modelVersion'])
export class ModelTrainingJob {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'dataset_snapshot_id', type: 'uuid' })
  datasetSnapshotId!: string;

  @ManyToOne(() => DatasetSnapshot, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'dataset_snapshot_id' })
  datasetSnapshot?: DatasetSnapshot;

  @Column({ name: 'model_code', type: 'varchar', length: 120 })
  modelCode!: string;

  @Column({ name: 'model_name', type: 'varchar', length: 255 })
  modelName!: string;

  @Column({ name: 'model_version', type: 'varchar', length: 50 })
  modelVersion!: string;

  @Column({ name: 'algorithm', type: 'varchar', length: 120 })
  algorithm!: string;

  @Column({ name: 'hyperparameters', type: 'jsonb', default: () => `'{}'` })
  hyperparameters!: Record<string, unknown>;

  @Column({ name: 'training_config', type: 'jsonb', default: () => `'{}'` })
  trainingConfig!: Record<string, unknown>;

  @Column({ name: 'metrics', type: 'jsonb', default: () => `'{}'` })
  metrics!: Record<string, unknown>;

  @Column({ name: 'status', type: 'varchar', length: 20, default: 'pending' })
  status!: ModelTrainingStatus;

  @Column({ name: 'model_artifact_id', type: 'uuid', nullable: true })
  modelArtifactId?: string | null;

  @ManyToOne(() => ModelArtifact, { onDelete: 'SET NULL' })
  @JoinColumn({ name: 'model_artifact_id' })
  modelArtifact?: ModelArtifact | null;

  @Column({ name: 'requested_by', type: 'uuid', nullable: true })
  requestedBy?: string | null;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'requested_by' })
  requestedByUser?: User | null;

  @Column({ name: 'started_at', type: 'timestamptz', nullable: true })
  startedAt?: Date | null;

  @Column({ name: 'completed_at', type: 'timestamptz', nullable: true })
  completedAt?: Date | null;

  @Column({ name: 'error_message', type: 'text', nullable: true })
  errorMessage?: string | null;

  @Column({ name: 'metadata', type: 'jsonb', default: () => `'{}'` })
  metadata!: Record<string, unknown>;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}

@Entity('model_deployments')
@Index(['modelArtifactId'])
@Index(['status'])
export class ModelDeployment {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'model_artifact_id', type: 'uuid' })
  modelArtifactId!: string;

  @ManyToOne(() => ModelArtifact, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'model_artifact_id' })
  modelArtifact?: ModelArtifact;

  @Column({ name: 'target_type', type: 'varchar', length: 120 })
  targetType!: string;

  @Column({ name: 'target_config', type: 'jsonb', default: () => `'{}'` })
  targetConfig!: Record<string, unknown>;

  @Column({ name: 'status', type: 'varchar', length: 20, default: 'pending_approval' })
  status!: ModelDeploymentStatus;

  @Column({ name: 'requested_by', type: 'uuid', nullable: true })
  requestedBy?: string | null;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'requested_by' })
  requestedByUser?: User | null;

  @Column({ name: 'approved_by', type: 'uuid', nullable: true })
  approvedBy?: string | null;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'approved_by' })
  approvedByUser?: User | null;

  @Column({ name: 'workflow_instance_id', type: 'uuid', nullable: true })
  workflowInstanceId?: string | null;

  @Column({ name: 'metadata', type: 'jsonb', default: () => `'{}'` })
  metadata!: Record<string, unknown>;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}
