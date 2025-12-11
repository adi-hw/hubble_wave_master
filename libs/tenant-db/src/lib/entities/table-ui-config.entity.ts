import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn } from 'typeorm';

/**
 * Lightweight UI configuration overlay for database tables.
 * Instead of duplicating table definitions, we discover tables from information_schema
 * and store only UI-specific metadata here.
 */
@Entity('table_ui_config')
export class TableUiConfig {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'table_name', type: 'varchar', length: 100, unique: true })
  tableName!: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  label?: string;

  @Column({ name: 'plural_label', type: 'varchar', length: 255, nullable: true })
  pluralLabel?: string;

  @Column({ type: 'text', nullable: true })
  description?: string;

  @Column({ type: 'varchar', length: 50, nullable: true })
  icon?: string;

  @Column({ type: 'varchar', length: 20, nullable: true })
  color?: string;

  @Column({ type: 'varchar', length: 50, default: 'application' })
  category!: string;

  @Column({ name: 'is_hidden', type: 'boolean', default: false })
  isHidden!: boolean;

  @Column({ name: 'is_system', type: 'boolean', default: false })
  isSystem!: boolean;

  @Column({ name: 'show_in_nav', type: 'boolean', default: true })
  showInNav!: boolean;

  @Column({ name: 'show_in_search', type: 'boolean', default: true })
  showInSearch!: boolean;

  @Column({ name: 'default_sort_field', type: 'varchar', length: 100, nullable: true })
  defaultSortField?: string;

  @Column({ name: 'default_sort_direction', type: 'varchar', length: 10, default: 'asc' })
  defaultSortDirection!: string;

  @Column({ name: 'records_per_page', type: 'int', default: 25 })
  recordsPerPage!: number;

  @Column({ name: 'display_field', type: 'varchar', length: 100, nullable: true })
  displayField?: string;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;

  @Column({ name: 'created_by', type: 'uuid', nullable: true })
  createdBy?: string;

  @Column({ name: 'updated_by', type: 'uuid', nullable: true })
  updatedBy?: string;
}
