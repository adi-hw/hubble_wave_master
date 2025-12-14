import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { CollectionDefinition } from './collection-definition.entity';
import { PropertyDefinition } from './property-definition.entity';

export type RelationshipType = 'one_to_one' | 'one_to_many' | 'many_to_one' | 'many_to_many';

@Entity('collection_relationships')
@Index(['sourceCollectionId'])
@Index(['targetCollectionId'])
@Index(['sourceCollectionId', 'sourcePropertyId'], { unique: true })
export class CollectionRelationship {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  /** Source collection */
  @Column({ name: 'source_collection_id', type: 'uuid' })
  sourceCollectionId!: string;

  @ManyToOne(() => CollectionDefinition, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'source_collection_id' })
  sourceCollection?: CollectionDefinition;

  /** Target collection */
  @Column({ name: 'target_collection_id', type: 'uuid' })
  targetCollectionId!: string;

  @ManyToOne(() => CollectionDefinition, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'target_collection_id' })
  targetCollection?: CollectionDefinition;

  /** Source property that holds the reference */
  @Column({ name: 'source_property_id', type: 'uuid' })
  sourcePropertyId!: string;

  @ManyToOne(() => PropertyDefinition, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'source_property_id' })
  sourceProperty?: PropertyDefinition;

  /** Type of relationship */
  @Column({ name: 'relationship_type', type: 'varchar', length: 20 })
  relationshipType!: RelationshipType;

  /** Delete target records when source is deleted */
  @Column({ name: 'cascade_delete', type: 'boolean', default: false })
  cascadeDelete!: boolean;

  /** Update target records when source is updated */
  @Column({ name: 'cascade_update', type: 'boolean', default: false })
  cascadeUpdate!: boolean;

  /** Inverse property on target collection (for bidirectional) */
  @Column({ name: 'inverse_property_id', type: 'uuid', nullable: true })
  inversePropertyId?: string | null;

  @ManyToOne(() => PropertyDefinition, { nullable: true })
  @JoinColumn({ name: 'inverse_property_id' })
  inverseProperty?: PropertyDefinition | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;
}
