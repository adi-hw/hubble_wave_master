import { Entity, Column, PrimaryGeneratedColumn, ManyToOne, JoinColumn, CreateDateColumn, UpdateDateColumn, Unique } from 'typeorm';
import { NavProfile } from './nav-profile.entity';

@Entity('nav_profile_item')
@Unique(['profileId', 'code'])
export class NavProfileItem {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'profile_id', type: 'uuid' })
  profileId!: string;

  @ManyToOne(() => NavProfile)
  @JoinColumn({ name: 'profile_id' })
  profile!: NavProfile;

  @Column()
  code!: string;

  @Column({ nullable: true })
  label?: string;

  @Column({ nullable: true })
  section?: string;

  @Column({ name: 'sort_order', type: 'int', default: 999 })
  sortOrder!: number;

  @Column({ default: true })
  visible!: boolean;

  @Column({ default: false })
  pinned!: boolean;

  @Column({ nullable: true })
  icon?: string;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;

  @Column({ name: 'deleted_at', type: 'timestamptz', nullable: true })
  deletedAt?: Date | null;
}
