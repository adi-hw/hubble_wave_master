import { Entity, Column, PrimaryGeneratedColumn, ManyToOne, JoinColumn, CreateDateColumn, UpdateDateColumn } from 'typeorm';
import { Tenant } from './tenant.entity';

@Entity('abac_policies')
export class AbacPolicy {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'tenant_id', type: 'uuid', nullable: true })
  tenantId!: string | null;

  @ManyToOne(() => Tenant)
  @JoinColumn({ name: 'tenant_id' })
  tenant!: Tenant;

  @Column()
  name!: string;

  @Column({ name: 'description', nullable: true })
  description?: string;

  @Column({ name: 'subject_filter', type: 'jsonb' })
  subjectFilter!: Record<string, unknown>;

  @Column({ name: 'resource_type', type: 'enum', enumName: 'policy_resource_type' })
  resourceType!: string;

  @Column()
  resource!: string;

  @Column({ type: 'enum', enumName: 'policy_action' })
  action!: string;

  @Column({ type: 'jsonb' })
  condition!: Record<string, unknown>;

  @Column({ type: 'enum', enumName: 'policy_effect' })
  effect!: string;

  @Column({ type: 'int', default: 100 })
  priority!: number;

  @Column({ name: 'is_enabled', type: 'boolean', default: true })
  isEnabled!: boolean;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}

export type AbacCondition = Record<string, unknown>;
