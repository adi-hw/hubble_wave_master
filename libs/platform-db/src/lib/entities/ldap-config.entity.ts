import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Tenant } from './tenant.entity';

@Entity('auth_ldap_config')
export class LdapConfig {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'tenant_id', type: 'uuid', nullable: true })
  tenantId!: string | null;

  @ManyToOne(() => Tenant)
  @JoinColumn({ name: 'tenant_id' })
  tenant!: Tenant;

  @Column({ default: false })
  enabled!: boolean;

  @Column()
  name!: string;

  @Column()
  host!: string;

  @Column({ name: 'bind_dn' })
  bindDn!: string;

  @Column({ name: 'bind_password' })
  bindPassword!: string;

  @Column({ name: 'user_base_dn' })
  userBaseDn!: string;

  @Column({ name: 'user_filter', default: '(uid={username})' })
  userFilter!: string;

  @Column({ name: 'map_username_attr', default: 'uid' })
  mapUsernameAttr!: string;

  @Column({ name: 'map_email_attr', default: 'mail' })
  mapEmailAttr!: string;

  @Column({ name: 'map_display_name_attr', default: 'cn' })
  mapDisplayNameAttr!: string;

  @Column({ name: 'timeout_ms', default: 5000 })
  timeoutMs!: number;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;

  @Column({ name: 'deleted_at', type: 'timestamptz', nullable: true })
  deletedAt?: Date | null;
}
