import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, ManyToOne, JoinColumn, Index } from 'typeorm';
import { CollectionDefinition } from './collection-definition.entity';
import { User } from './user.entity';

/**
 * Stored form layout configuration including sections and fields.
 */
export interface StoredFormLayout {
  type: 'single-column' | 'two-column' | 'responsive-grid';
  tabs?: FormTab[];
  sections?: FormLayoutSection[];
  gridConfig?: {
    columns?: number;
    gap?: string;
  };
}

export interface FormTab {
  id: string;
  label: string;
  sections: FormLayoutSection[];
}

export interface FormLayoutSection {
  id: string;
  title: string;
  collapsible?: boolean;
  defaultCollapsed?: boolean;
  fields: FormLayoutField[];
  layout?: 'vertical' | 'horizontal' | 'grid';
}

export interface FormLayoutField {
  id: string;
  propertyCode: string;
  width?: 'full' | 'half' | 'third' | 'quarter';
  hidden?: boolean;
  readonly?: boolean;
}

/**
 * Lifecycle status for the form definition itself (ADR-5). Mirrors the
 * collection / property / application pattern.
 */
export type FormDefinitionStatus = 'draft' | 'published' | 'deprecated';
export type FormVersionStatus = 'draft' | 'published';

@Entity({ name: 'form_definitions', schema: 'metadata' })
@Index(['collectionId'])
@Index(['applicationId'])
@Index(['status'])
export class FormDefinition {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column()
  name!: string;

  @Column({ name: 'collection_id', type: 'uuid' })
  collectionId!: string;

  @ManyToOne(() => CollectionDefinition)
  @JoinColumn({ name: 'collection_id' })
  collection?: CollectionDefinition;

  /**
   * Application this form belongs to (ADR-6). Backfilled from the
   * parent collection during slice C2.
   */
  @Column({ name: 'application_id', type: 'uuid', nullable: true })
  applicationId?: string | null;

  @Column({ default: false })
  isDefault!: boolean;

  @Column({ type: 'jsonb', nullable: true })
  layout?: StoredFormLayout | null;

  // ─────────────────────────────────────────────────────────────────
  // Lifecycle (ADR-5)
  // ─────────────────────────────────────────────────────────────────

  @Column({ type: 'varchar', length: 20, default: 'draft' })
  status!: FormDefinitionStatus;

  /** The version the form currently advertises as canonical. */
  @Column({ name: 'current_version_id', type: 'uuid', nullable: true })
  currentVersionId?: string | null;

  @Column({ name: 'published_at', type: 'timestamptz', nullable: true })
  publishedAt?: Date | null;

  /** ADR-7 provenance. See CollectionDefinition.source. */
  @Column({ name: 'source', type: 'varchar', length: 120, default: 'custom' })
  source!: string;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}

@Entity({ name: 'form_versions', schema: 'metadata' })
@Index(['formId'])
@Index(['status'])
export class FormVersion {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'form_id', type: 'uuid' })
  formId!: string;

  @ManyToOne(() => FormDefinition)
  @JoinColumn({ name: 'form_id' })
  form?: FormDefinition;

  @Column()
  version!: number;

  @Column({ type: 'jsonb' })
  layout!: StoredFormLayout;

  // ─────────────────────────────────────────────────────────────────
  // Lifecycle (ADR-5)
  // ─────────────────────────────────────────────────────────────────

  @Column({ type: 'varchar', length: 20, default: 'draft' })
  status!: FormVersionStatus;

  @Column({ name: 'published_by', type: 'uuid', nullable: true })
  publishedBy?: string | null;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'published_by' })
  publishedByUser?: User | null;

  @Column({ name: 'published_at', type: 'timestamptz', nullable: true })
  publishedAt?: Date | null;

  @CreateDateColumn()
  createdAt!: Date;
}
