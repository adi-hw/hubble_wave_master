import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn } from 'typeorm';

@Entity('tenants')
export class Tenant {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'varchar', unique: true, nullable: true })
  slug!: string | null;

  @Column({ type: 'varchar', nullable: true })
  name!: string | null;

  @Column({ type: 'enum', enumName: 'tenant_status', default: 'ACTIVE' })
  status!: string;

  @Column({ name: 'db_host', nullable: true })
  dbHost?: string;

  @Column({ name: 'db_port', type: 'int', nullable: true })
  dbPort?: number;

  @Column({ name: 'db_name', nullable: true })
  dbName?: string;

  @Column({ name: 'db_user', nullable: true })
  dbUser?: string;

  @Column({ name: 'db_password_enc', type: 'text', nullable: true })
  dbPasswordEnc?: string;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}
