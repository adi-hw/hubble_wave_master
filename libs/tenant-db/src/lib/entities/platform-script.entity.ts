import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, Index } from 'typeorm';

export type ScriptType = 'client_script' | 'server_script' | 'business_rule' | 'ui_action' | 'scheduled_job';
export type ExecutionContext = 'form_load' | 'form_save' | 'field_change' | 'api_call' | 'scheduled' | 'list_load' | 'before_insert' | 'after_insert' | 'before_update' | 'after_update' | 'before_delete' | 'after_delete';
export type ScriptSource = 'platform' | 'module' | 'tenant';

@Entity('platform_script')
@Index(['tenantId', 'code'], { unique: true })
@Index(['targetTable', 'isActive'])
@Index(['scriptType', 'isActive'])
export class PlatformScript {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'tenant_id', type: 'uuid', nullable: true })
  tenantId?: string; // NULL for platform scripts

  @Column({ type: 'varchar', length: 100 })
  code!: string;

  @Column({ type: 'varchar', length: 255 })
  name!: string;

  @Column({ type: 'text', nullable: true })
  description?: string;

  @Column({ name: 'script_type', type: 'varchar', length: 30 })
  scriptType!: ScriptType;

  @Column({ name: 'execution_context', type: 'varchar', length: 30 })
  executionContext!: ExecutionContext;

  @Column({ name: 'target_table', type: 'varchar', length: 100, nullable: true })
  targetTable?: string;

  @Column({ name: 'target_field', type: 'varchar', length: 100, nullable: true })
  targetField?: string;

  @Column({ name: 'script_content', type: 'text' })
  scriptContent!: string;

  @Column({ name: 'script_language', type: 'varchar', length: 20, default: 'javascript' })
  scriptLanguage!: 'javascript' | 'typescript';

  @Column({ name: 'execution_order', type: 'int', default: 100 })
  executionOrder!: number;

  @Column({ name: 'is_async', type: 'boolean', default: false })
  isAsync!: boolean;

  @Column({ name: 'timeout_ms', type: 'int', default: 5000 })
  timeoutMs!: number;

  @Column({ name: 'condition_expression', type: 'jsonb', nullable: true })
  conditionExpression?: Record<string, any>;

  @Column({ type: 'varchar', length: 20, default: 'tenant' })
  source!: ScriptSource;

  @Column({ name: 'platform_version', type: 'varchar', length: 20, nullable: true })
  platformVersion?: string;

  @Column({ name: 'is_active', type: 'boolean', default: true })
  isActive!: boolean;

  @Column({ name: 'is_system', type: 'boolean', default: false })
  isSystem!: boolean;

  @Column({ name: 'created_by', type: 'uuid', nullable: true })
  createdBy?: string;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @Column({ name: 'updated_by', type: 'uuid', nullable: true })
  updatedBy?: string;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}
