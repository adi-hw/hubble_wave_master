import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { CollectionDefinition } from './collection-definition.entity';
import { User } from './user.entity';

export type DependentReviewStatus = 'needs_review' | 'acknowledged' | 'dismissed';
export type DependentReviewChangeKind = 'added' | 'modified' | 'removed';
export type DependentReviewClassification = 'structural' | 'breaking';

/**
 * Persisted ADR-17 review queue entry. One row per dependent artifact
 * affected by a non-cosmetic property change at publish time. Rows
 * stay until an admin acknowledges (problem reviewed and either
 * already fixed or accepted) or dismisses (false positive) them.
 *
 * Cosmetic changes never enter the queue — the analyzer registry is
 * bypassed for cosmetic-only publishes by PublishImpactService, so
 * there are no rows to persist.
 */
@Entity({ name: 'dependent_review_queue', schema: 'metadata' })
@Index(['collectionId', 'status'])
@Index(['status', 'createdAt'])
@Index(['entityType', 'entityId'])
export class DependentReviewQueueEntry {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'collection_id', type: 'uuid' })
  collectionId!: string;

  @ManyToOne(() => CollectionDefinition, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'collection_id' })
  collection?: CollectionDefinition;

  @Column({ name: 'collection_code', type: 'varchar', length: 120 })
  collectionCode!: string;

  @Column({ name: 'property_code', type: 'varchar', length: 120 })
  propertyCode!: string;

  /** Null for `removed` entries — the property row no longer exists. */
  @Column({ name: 'property_id', type: 'uuid', nullable: true })
  propertyId?: string | null;

  @Column({ name: 'change_kind', type: 'varchar', length: 16 })
  changeKind!: DependentReviewChangeKind;

  @Column({ name: 'classification', type: 'varchar', length: 16 })
  classification!: DependentReviewClassification;

  /** 'view' | 'form' | 'process_flow' | 'automation_rule' (extensible). */
  @Column({ name: 'entity_type', type: 'varchar', length: 32 })
  entityType!: string;

  @Column({ name: 'entity_id', type: 'uuid' })
  entityId!: string;

  @Column({ name: 'entity_label', type: 'varchar', length: 255 })
  entityLabel!: string;

  /** Optional Studio route admins can follow to fix the dependent. */
  @Column({ name: 'href', type: 'text', nullable: true })
  href?: string | null;

  @Column({ name: 'reason', type: 'text' })
  reason!: string;

  @Column({ name: 'status', type: 'varchar', length: 20, default: 'needs_review' })
  status!: DependentReviewStatus;

  @Column({ name: 'created_by', type: 'uuid', nullable: true })
  createdBy?: string | null;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'created_by' })
  createdByUser?: User | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @Column({ name: 'resolved_by', type: 'uuid', nullable: true })
  resolvedBy?: string | null;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'resolved_by' })
  resolvedByUser?: User | null;

  @Column({ name: 'resolved_at', type: 'timestamptz', nullable: true })
  resolvedAt?: Date | null;

  @Column({ name: 'resolution_note', type: 'text', nullable: true })
  resolutionNote?: string | null;
}
