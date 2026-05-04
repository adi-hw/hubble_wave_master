import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Application } from './application.entity';
import { User } from './user.entity';

export type ChangePackageStatus = 'open' | 'complete' | 'applied';

/**
 * Plan §11.1 — a Change Package bundles a set of metadata changes
 * that a developer wants to ship from one instance to another.
 * Status lifecycle:
 *   - `open`     — actively being authored; new entries can be added
 *   - `complete` — frozen for export; entries can no longer change
 *   - `applied`  — successfully imported into a target instance
 *
 * **ADR-5 deviation note:** ChangePackage deliberately does NOT
 * carry a `<entity>_revisions` table or a `current_revision_id`
 * pointer. Its lifecycle is *transactional* (open → complete →
 * applied), not *editorial* (draft ↔ published ↔ deprecated). The
 * package's content (`changes` JSONB) is mutable while `status='open'`
 * and frozen at `status='complete'`; once applied, it is a historical
 * record. There is no draft/publish authoring loop to track in a
 * revision table. If a future requirement demands edit history of
 * the package itself (vs. the metadata it carries), an ADR amendment
 * captures the design.
 *
 * `changes` is JSONB so the schema can evolve per-artifact without
 * a migration. Each entry shapes as `MetadataChange`:
 *   { kind, code, beforeHash?, after, source: 'pack:<id>'|'custom' }
 * The `kind` discriminator names the metadata table the change
 * targets (collection / property / view / form / flow / automation
 * / decision / guidedProcess / workspace), so importers can dispatch
 * to the right service.
 */
export interface MetadataChange {
  kind:
    | 'collection'
    | 'property'
    | 'view'
    | 'form'
    | 'flow'
    | 'automation'
    | 'decision'
    | 'guidedProcess'
    | 'workspace';
  /** Stable code of the artifact (collection.code / view.code / …). */
  code: string;
  /** Hash of the artifact's prior payload, captured at addArtifact time
   *  so importers can detect drift between author intent and target
   *  state. Optional on first add (no prior version exists). */
  beforeHash?: string | null;
  /** Snapshot of the artifact's current shape at addArtifact time.
   *  This is what the importer applies on the target instance. */
  after: Record<string, unknown>;
  /** ADR-7 provenance recorded with the entry. Pack contents inherit
   *  the pack's `source = pack:<id>`; ad-hoc changes are `custom`. */
  source: string;
  /** ISO timestamp of when this change entered the package. */
  capturedAt: string;
}

@Entity('change_packages')
@Index(['applicationId'])
@Index(['status'])
@Index(['code'], { unique: true })
export class ChangePackage {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'varchar', length: 120 })
  code!: string;

  @Column({ type: 'varchar', length: 255 })
  name!: string;

  @Column({ type: 'text', nullable: true })
  description?: string | null;

  @Column({ name: 'application_id', type: 'uuid' })
  applicationId!: string;

  @ManyToOne(() => Application, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'application_id' })
  application?: Application;

  @Column({ type: 'varchar', length: 20, default: 'open' })
  status!: ChangePackageStatus;

  @Column({ type: 'jsonb', default: () => `'[]'::jsonb` })
  changes!: MetadataChange[];

  @Column({ name: 'completed_at', type: 'timestamptz', nullable: true })
  completedAt?: Date | null;

  @Column({ name: 'applied_at', type: 'timestamptz', nullable: true })
  appliedAt?: Date | null;

  /**
   * Source-instance fingerprint stamped at completion. Importers
   * surface it on the import preview so an operator can confirm
   * "this package came from instance X at version Y" before
   * applying.
   */
  @Column({ name: 'source_instance_id', type: 'varchar', length: 120, nullable: true })
  sourceInstanceId?: string | null;

  @Column({ name: 'created_by', type: 'uuid', nullable: true })
  createdBy?: string | null;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'created_by' })
  createdByUser?: User | null;

  @Column({ name: 'updated_by', type: 'uuid', nullable: true })
  updatedBy?: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}
