import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn } from 'typeorm';

@Entity('model_field_type')
export class ModelFieldType {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ unique: true })
  code!: string; // 'string', 'integer', 'reference', 'choice', 'json'

  @Column()
  label!: string; // 'String', 'Integer', 'Reference'

  @Column()
  category!: string; // 'primitive', 'reference', 'choice', 'custom'

  @Column({ name: 'backend_type' })
  backendType!: string; // 'text', 'int', 'timestamp', 'jsonb'

  @Column({ name: 'ui_widget' })
  uiWidget!: string; // 'text', 'textarea', 'dropdown', 'datepicker'

  @Column('jsonb', { default: {} })
  validators: any;

  @Column('jsonb', { name: 'storage_config', default: {} })
  storageConfig: any;

  @Column('jsonb', { default: {} })
  flags: any;

  @Column({ name: 'is_builtin', type: 'boolean', default: true })
  isBuiltin!: boolean;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;

  @Column({ name: 'deleted_at', type: 'timestamptz', nullable: true })
  deletedAt?: Date | null;
}
