import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, Unique } from 'typeorm';

/**
 * Lightweight UI configuration overlay for database columns.
 * Instead of duplicating field definitions, we discover columns from information_schema
 * and store only UI-specific metadata here.
 */
@Entity('field_ui_config')
@Unique(['tableName', 'columnName'])
export class FieldUiConfig {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'table_name', type: 'varchar', length: 100 })
  tableName!: string;

  @Column({ name: 'column_name', type: 'varchar', length: 100 })
  columnName!: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  label?: string;

  @Column({ type: 'text', nullable: true })
  description?: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  placeholder?: string;

  @Column({ name: 'help_text', type: 'text', nullable: true })
  helpText?: string;

  @Column({ name: 'show_in_list', type: 'boolean', default: true })
  showInList!: boolean;

  @Column({ name: 'show_in_form', type: 'boolean', default: true })
  showInForm!: boolean;

  @Column({ name: 'show_in_detail', type: 'boolean', default: true })
  showInDetail!: boolean;

  @Column({ name: 'is_hidden', type: 'boolean', default: false })
  isHidden!: boolean;

  @Column({ name: 'display_order', type: 'int', default: 0 })
  displayOrder!: number;

  @Column({ name: 'form_section', type: 'varchar', length: 100, nullable: true })
  formSection?: string;

  @Column({ name: 'form_width', type: 'varchar', length: 20, default: 'full' })
  formWidth!: string;

  @Column({ name: 'validation_message', type: 'text', nullable: true })
  validationMessage?: string;

  @Column({ name: 'reference_table', type: 'varchar', length: 100, nullable: true })
  referenceTable?: string;

  @Column({ name: 'reference_display_field', type: 'varchar', length: 100, nullable: true })
  referenceDisplayField?: string;

  @Column({ type: 'jsonb', nullable: true })
  choices?: Array<{ value: string; label: string }>;

  @Column({ name: 'format_pattern', type: 'varchar', length: 100, nullable: true })
  formatPattern?: string;

  @Column({ type: 'varchar', length: 20, nullable: true })
  prefix?: string;

  @Column({ type: 'varchar', length: 20, nullable: true })
  suffix?: string;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;

  @Column({ name: 'created_by', type: 'uuid', nullable: true })
  createdBy?: string;

  @Column({ name: 'updated_by', type: 'uuid', nullable: true })
  updatedBy?: string;
}
