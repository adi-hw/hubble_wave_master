import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, ManyToOne, JoinColumn, Unique } from 'typeorm';
import { FormDefinition } from './form-definition.entity';

@Entity('form_versions')
@Unique(['formId', 'version'])
export class FormVersion {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'form_id', type: 'uuid' })
  formId!: string;

  @ManyToOne(() => FormDefinition)
  @JoinColumn({ name: 'form_id' })
  form!: FormDefinition;

  @Column({ name: 'version', type: 'int' })
  version!: number;

  @Column({ type: 'jsonb', default: {} })
  schema!: any;

  @Column({ type: 'varchar', default: 'draft' })
  status!: 'draft' | 'published' | 'archived';

  @Column({ name: 'created_by', nullable: true })
  createdBy?: string;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}
