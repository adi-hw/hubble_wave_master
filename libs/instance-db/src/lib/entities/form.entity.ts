import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, ManyToOne, JoinColumn, Index } from 'typeorm';
import { CollectionDefinition } from './collection-definition.entity';

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
  layout?: StoredFormLayout | null;

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
  layout!: StoredFormLayout;

  @CreateDateColumn()
  createdAt!: Date;
}
