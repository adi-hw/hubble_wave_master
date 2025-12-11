import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn, Index, CreateDateColumn, UpdateDateColumn } from 'typeorm';
import { ModelTable } from './model-table.entity';

@Entity('model_form_layout')
export class ModelFormLayout {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'table_id' })
  @Index()
  tableId!: string;

  @ManyToOne(() => ModelTable)
  @JoinColumn({ name: 'table_id' })
  table!: ModelTable;

  @Column()
  name!: string;

  @Column('jsonb')
  layout: any; // { tabs: [{ label: string, sections: [{ label: string, columns: [{ fields: string[] }] }] }] }

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;

  @Column({ name: 'deleted_at', type: 'timestamptz', nullable: true })
  deletedAt?: Date | null;
}
