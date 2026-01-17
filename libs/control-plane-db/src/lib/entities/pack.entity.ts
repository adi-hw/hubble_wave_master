import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
  ManyToOne,
  OneToMany,
  JoinColumn,
} from 'typeorm';
import { ControlPlaneUser } from './control-plane-user.entity';

type JsonValue = string | number | boolean | null | JsonObject | JsonArray;
type JsonObject = { [key: string]: JsonValue };
type JsonArray = JsonValue[];

@Entity('pack_registry')
@Index(['code'], { unique: true })
@Index(['publisher'])
export class PackRegistry {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'varchar', length: 200, unique: true })
  code!: string;

  @Column({ type: 'varchar', length: 255 })
  name!: string;

  @Column({ type: 'text', nullable: true })
  description?: string | null;

  @Column({ type: 'varchar', length: 120 })
  publisher!: string;

  @Column({ type: 'varchar', length: 120, nullable: true })
  license?: string | null;

  @Column({ type: 'jsonb', default: () => `'{}'` })
  metadata!: Record<string, unknown>;

  @Column({ name: 'created_by', type: 'uuid', nullable: true })
  createdBy?: string | null;

  @ManyToOne(() => ControlPlaneUser, { nullable: true })
  @JoinColumn({ name: 'created_by' })
  createdByUser?: ControlPlaneUser | null;

  @Column({ name: 'updated_by', type: 'uuid', nullable: true })
  updatedBy?: string | null;

  @ManyToOne(() => ControlPlaneUser, { nullable: true })
  @JoinColumn({ name: 'updated_by' })
  updatedByUser?: ControlPlaneUser | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;

  @OneToMany(() => PackRelease, (release) => release.pack)
  releases?: PackRelease[];
}

@Entity('pack_releases')
@Index(['packId', 'releaseId'], { unique: true })
@Index(['releaseId'])
export class PackRelease {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'pack_id', type: 'uuid' })
  packId!: string;

  @ManyToOne(() => PackRegistry, (pack) => pack.releases, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'pack_id' })
  pack?: PackRegistry;

  @Column({ name: 'release_id', type: 'varchar', length: 50 })
  releaseId!: string;

  @Column({ name: 'manifest_revision', type: 'int', default: 1 })
  manifestRevision!: number;

  @Column({ type: 'jsonb' })
  manifest!: JsonObject;

  @Column({ type: 'jsonb', nullable: true })
  dependencies?: JsonArray | null;

  @Column({ type: 'jsonb', nullable: true })
  compatibility?: JsonObject | null;

  @Column({ type: 'jsonb' })
  assets!: JsonArray;

  @Column({ name: 'artifact_bucket', type: 'varchar', length: 255 })
  artifactBucket!: string;

  @Column({ name: 'artifact_key', type: 'varchar', length: 500 })
  artifactKey!: string;

  @Column({ name: 'artifact_sha256', type: 'varchar', length: 64 })
  artifactSha256!: string;

  @Column({ type: 'text' })
  signature!: string;

  @Column({ name: 'signature_key_id', type: 'varchar', length: 200 })
  signatureKeyId!: string;

  @Column({ name: 'is_active', type: 'boolean', default: true })
  isActive!: boolean;

  @Column({ name: 'is_installable_by_client', type: 'boolean', default: false })
  isInstallableByClient!: boolean;

  @Column({ name: 'created_by', type: 'uuid', nullable: true })
  createdBy?: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;
}
