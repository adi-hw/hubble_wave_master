import { Entity, Column, PrimaryGeneratedColumn, ManyToOne, JoinColumn, CreateDateColumn, UpdateDateColumn, Unique } from 'typeorm';
import { UserAccount } from './user-account.entity';

@Entity('mfa_methods')
@Unique(['userId', 'type', 'destination'])
export class MfaMethod {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'user_id', type: 'uuid' })
  userId!: string;

  @ManyToOne(() => UserAccount)
  @JoinColumn({ name: 'user_id' })
  user!: UserAccount;

  @Column()
  type!: string;

  @Column({ default: false })
  enabled!: boolean;

  @Column({ default: false })
  verified!: boolean;

  @Column({ nullable: true })
  secret?: string;

  @Column({ nullable: true })
  destination?: string;

  @Column({ name: 'recovery_codes', type: 'text', default: '' })
  recoveryCodes!: string;

  @Column({ name: 'last_used_at', type: 'timestamptz', nullable: true })
  lastUsedAt?: Date;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;

  @Column({ name: 'deleted_at', type: 'timestamptz', nullable: true })
  deletedAt?: Date | null;
}
