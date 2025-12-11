import { Entity, Column, PrimaryGeneratedColumn, ManyToOne, JoinColumn, CreateDateColumn, UpdateDateColumn, Unique } from 'typeorm';
import { Tenant } from './tenant.entity';

@Entity('groups')
@Unique(['tenantId', 'slug'])
export class Group {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'tenant_id', type: 'uuid' })
  tenantId!: string;

  @ManyToOne(() => Tenant)
  @JoinColumn({ name: 'tenant_id' })
  tenant!: Tenant;

  @Column({ name: 'slug' })
  slug!: string;

  @Column({ name: 'name' })
  name!: string;

  @Column({ name: 'type', type: 'enum', enumName: 'group_type', default: 'CUSTOM' })
  type!: string;

  @Column({ nullable: true })
  description?: string;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}
