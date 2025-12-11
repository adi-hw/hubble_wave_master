import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, ManyToOne, JoinColumn, Index } from 'typeorm';

@Entity('model_table')
@Index(['storageSchema', 'storageTable'], { unique: true })
export class ModelTable {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ unique: true })
  code!: string; // 'asset', 'work_order'

  @Column()
  label!: string; // 'Asset'

  @Column()
  category!: string; // 'platform', 'application'

  @Column({ name: 'storage_schema', default: () => 'current_schema()' })
  storageSchema!: string;

  @Column({ name: 'storage_table' })
  storageTable!: string; // 'app_asset'

  @Column({ name: 'extends_table_id', nullable: true })
  extendsTableId?: string;

  @ManyToOne(() => ModelTable)
  @JoinColumn({ name: 'extends_table_id' })
  extendsTable?: ModelTable;

  @Column('jsonb', { default: {} })
  flags: any;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;

  @Column({ name: 'deleted_at', type: 'timestamptz', nullable: true })
  deletedAt?: Date | null;
}
