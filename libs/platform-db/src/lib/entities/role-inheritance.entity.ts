import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn, CreateDateColumn } from 'typeorm';
import { Role } from './role.entity';

@Entity('role_inheritance')
export class RoleInheritance {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'parent_role_id', type: 'uuid' })
  parentRoleId!: string;

  @ManyToOne(() => Role)
  @JoinColumn({ name: 'parent_role_id' })
  parentRole!: Role;

  @Column({ name: 'child_role_id', type: 'uuid' })
  childRoleId!: string;

  @ManyToOne(() => Role)
  @JoinColumn({ name: 'child_role_id' })
  childRole!: Role;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;
}
