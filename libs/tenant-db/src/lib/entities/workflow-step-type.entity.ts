import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, Index } from 'typeorm';

export type StepCategory = 'control' | 'action' | 'integration' | 'approval' | 'notification';
export type HandlerType = 'builtin' | 'script' | 'http' | 'plugin';

@Entity('workflow_step_type')
@Index(['code'], { unique: true })
@Index(['category', 'isActive'])
export class WorkflowStepType {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'varchar', length: 50 })
  code!: string;

  @Column({ type: 'varchar', length: 100 })
  name!: string;

  @Column({ type: 'text', nullable: true })
  description?: string;

  @Column({ type: 'varchar', length: 50 })
  category!: StepCategory;

  @Column({ name: 'config_schema', type: 'jsonb' })
  configSchema!: Record<string, any>; // JSON Schema for step configuration

  @Column({ name: 'input_schema', type: 'jsonb', nullable: true })
  inputSchema?: Record<string, any>;

  @Column({ name: 'output_schema', type: 'jsonb', nullable: true })
  outputSchema?: Record<string, any>;

  @Column({ name: 'handler_type', type: 'varchar', length: 30 })
  handlerType!: HandlerType;

  @Column({ name: 'handler_reference', type: 'varchar', length: 255, nullable: true })
  handlerReference?: string; // Script ID, HTTP endpoint, or plugin identifier

  @Column({ type: 'varchar', length: 50, nullable: true })
  icon?: string;

  @Column({ type: 'varchar', length: 20, nullable: true })
  color?: string;

  @Column({ name: 'is_builtin', type: 'boolean', default: false })
  isBuiltin!: boolean;

  @Column({ name: 'is_active', type: 'boolean', default: true })
  isActive!: boolean;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}
