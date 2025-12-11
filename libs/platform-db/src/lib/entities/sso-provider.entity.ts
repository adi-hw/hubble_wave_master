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

@Entity('auth_sso_provider')
export class SsoProvider {
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

  @Column({ default: 'OIDC' })
  type!: string;

  @Column({ name: 'issuer_url' })
  issuerUrl!: string;

  @Column({ name: 'client_id' })
  clientId!: string;

  @Column({ name: 'client_secret' })
  clientSecret!: string;

  @Column({ name: 'redirect_uri' })
  redirectUri!: string;

  @Column({ name: 'map_username_claim', default: 'preferred_username' })
  mapUsernameClaim!: string;

  @Column({ name: 'map_email_claim', default: 'email' })
  mapEmailClaim!: string;

  @Column({ name: 'map_display_name_claim', default: 'name' })
  mapDisplayNameClaim!: string;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;

  @Column({ name: 'deleted_at', type: 'timestamptz', nullable: true })
  deletedAt?: Date | null;
}
