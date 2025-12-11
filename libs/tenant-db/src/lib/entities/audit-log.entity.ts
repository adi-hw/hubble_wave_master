import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, Index } from 'typeorm';

@Entity('audit_log')
export class AuditLog {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'table_name' })
  @Index()
  tableName!: string;

  @Column({ name: 'record_id' })
  @Index()
  recordId!: string;

  @Column()
  action!: 'CREATE' | 'UPDATE' | 'DELETE';

  @Column('jsonb', { nullable: true })
  diff: any;

  @Column({ name: 'performed_by', nullable: true })
  performedBy!: string;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;
}
