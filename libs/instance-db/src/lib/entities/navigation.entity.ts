import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn, OneToMany, CreateDateColumn, UpdateDateColumn, Index } from 'typeorm';
import { NavProfile } from './settings.entity';

@Entity('nav_nodes')
@Index(['profileId'])
@Index(['parentId'])
@Index(['key'])
export class NavNode {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'profile_id', type: 'uuid' })
  profileId!: string;

  @ManyToOne(() => NavProfile, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'profile_id' })
  profile!: NavProfile;

  @Column()
  key!: string;

  @Column()
  label!: string;

  @Column({ nullable: true })
  icon?: string;

  @Column()
  type!: string;

  @Column({ name: 'module_key', nullable: true })
  moduleKey?: string;

  @Column({ nullable: true })
  url?: string;

  @Column({ name: 'parent_id', type: 'uuid', nullable: true })
  parentId?: string;

  @ManyToOne(() => NavNode, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'parent_id' })
  parent?: NavNode;

  @OneToMany(() => NavNode, (node) => node.parent)
  children!: NavNode[];

  @Column({ default: 0 })
  order!: number;

  @Column({ name: 'is_visible', default: true })
  isVisible!: boolean;

  @Column('jsonb', { nullable: true })
  visibility?: Record<string, unknown>;

  @Column('simple-array', { name: 'context_tags', nullable: true })
  contextTags?: string[];

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;
}

@Entity('nav_patches')
@Index(['profileId'])
export class NavPatch {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'profile_id', type: 'uuid' })
  profileId!: string;

  @ManyToOne(() => NavProfile, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'profile_id' })
  profile!: NavProfile;

  @Column()
  operation!: string;

  @Column({ name: 'target_node_key' })
  targetNodeKey!: string;

  @Column('jsonb', { nullable: true })
  payload?: Record<string, unknown>;

  @Column({ default: 0 })
  priority!: number;

  @Column({ nullable: true })
  description?: string;

  @Column({ name: 'is_active', default: true })
  isActive!: boolean;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;
}
