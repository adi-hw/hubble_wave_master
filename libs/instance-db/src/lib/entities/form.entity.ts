import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, ManyToOne, JoinColumn, Index } from 'typeorm';
import { CollectionDefinition } from './collection-definition.entity';

@Entity('form_definitions')
@Index(['collectionId'])
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

  @Column({ default: false })
  isDefault!: boolean;

  @Column({ type: 'jsonb', nullable: true })
  layout?: any | null;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}

@Entity('form_versions')
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
  layout!: any;

  @CreateDateColumn()
  createdAt!: Date;
}
