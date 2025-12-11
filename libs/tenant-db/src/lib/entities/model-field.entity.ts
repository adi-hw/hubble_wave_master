import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, ManyToOne, JoinColumn, Unique, Index } from 'typeorm';
import { ModelTable } from './model-table.entity';
import { ModelFieldType } from './model-field-type.entity';

@Entity('model_field')
@Unique(['tableId', 'code'])
export class ModelField {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'table_id' })
  @Index()
  tableId!: string;

  @ManyToOne(() => ModelTable)
  @JoinColumn({ name: 'table_id' })
  table!: ModelTable;

  @Column({ name: 'field_type_id' })
  fieldTypeId!: string;

  @ManyToOne(() => ModelFieldType)
  @JoinColumn({ name: 'field_type_id' })
  fieldType!: ModelFieldType;

  @Column()
  code!: string; // 'serial_number', 'status'

  @Column()
  label!: string;

  @Column({ default: true })
  nullable!: boolean;

  @Column({ name: 'is_unique', default: false })
  isUnique!: boolean;

  @Column({ name: 'default_value', nullable: true })
  defaultValue?: string;

  @Column({ name: 'storage_path' })
  storagePath!: string; // 'column:serial_number' or 'json:custom_data.u_modality'

  @Column('jsonb', { default: {} })
  config: any;

  @Column({ name: 'display_order', default: 0 })
  displayOrder!: number;

  // Legacy DBs may not have this column; mark select false to avoid query errors when missing.
  @Column({ name: 'is_system', type: 'boolean', default: false, nullable: true, select: false })
  isSystem?: boolean;

  @Column({ name: 'is_internal', type: 'boolean', default: false })
  isInternal!: boolean;

  @Column({ name: 'show_in_forms', type: 'boolean', default: true })
  showInForms!: boolean;

  @Column({ name: 'show_in_lists', type: 'boolean', default: true })
  showInLists!: boolean;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;

  @Column({ name: 'deleted_at', type: 'timestamptz', nullable: true })
  deletedAt?: Date | null;
}
