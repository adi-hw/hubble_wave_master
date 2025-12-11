import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, Index, ManyToOne, JoinColumn } from 'typeorm';
import { ModelTable } from './model-table.entity';

@Entity('form_definitions')
@Index(['slug'], { unique: true })
export class FormDefinition {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column()
  name!: string;

  @Column()
  slug!: string;

  @Column({ nullable: true })
  description?: string;

  @Column({ name: 'current_version', type: 'int', default: 1 })
  currentVersion!: number;

  @Column({ name: 'model_table_id', type: 'uuid', nullable: true })
  modelTableId?: string | null;

  @ManyToOne(() => ModelTable, { nullable: true })
  @JoinColumn({ name: 'model_table_id' })
  modelTable?: ModelTable | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;

  @Column({ name: 'deleted_at', type: 'timestamptz', nullable: true })
  deletedAt?: Date | null;
}
