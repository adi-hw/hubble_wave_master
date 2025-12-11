import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, Index, ManyToOne, JoinColumn } from 'typeorm';
import { PlatformScript } from './platform-script.entity';

@Entity('script_execution_log')
@Index(['scriptId'])
@Index(['tenantId', 'executedAt'])
export class ScriptExecutionLog {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'script_id', type: 'uuid' })
  scriptId!: string;

  @ManyToOne(() => PlatformScript)
  @JoinColumn({ name: 'script_id' })
  script?: PlatformScript;

  @Column({ name: 'tenant_id', type: 'uuid' })
  tenantId!: string;

  @Column({ name: 'execution_context', type: 'jsonb', nullable: true })
  executionContext?: Record<string, any>; // Input data

  @Column({ type: 'jsonb', nullable: true })
  result?: Record<string, any>; // Output data

  @Column({ name: 'error_message', type: 'text', nullable: true })
  errorMessage?: string;

  @Column({ name: 'error_stack', type: 'text', nullable: true })
  errorStack?: string;

  @Column({ name: 'execution_time_ms', type: 'int', nullable: true })
  executionTimeMs?: number;

  @CreateDateColumn({ name: 'executed_at', type: 'timestamptz' })
  executedAt!: Date;

  @Column({ name: 'executed_by', type: 'uuid', nullable: true })
  executedBy?: string;
}
