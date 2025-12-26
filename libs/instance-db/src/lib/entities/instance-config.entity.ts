import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn } from 'typeorm';

@Entity('instance_customizations')
export class InstanceCustomization {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column()
  configType!: string;

  @Column()
  resourceKey!: string;

  @Column({ type: 'jsonb', nullable: true })
  value?: any;

  @Column({ default: true })
  isActive!: boolean;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
  
  @Column({ nullable: true })
  createdBy?: string;
  
  @Column({ nullable: true })
  updatedBy?: string;
}

@Entity('config_change_history')
export class ConfigChangeHistory {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column()
  configType!: string;

  @Column({ nullable: true })
  code?: string;

  @Column()
  changeType!: string;

  @Column({ type: 'jsonb', nullable: true })
  details?: any;

  @Column({ nullable: true })
  userId?: string;

  @CreateDateColumn()
  changedAt!: Date;
}
