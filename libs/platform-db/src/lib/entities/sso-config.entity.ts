import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
  Unique,
} from 'typeorm';
import { Tenant } from './tenant.entity';
import { UserAccount } from './user-account.entity';

export type SsoProviderType = 'saml' | 'oidc' | 'oauth2';

@Entity('sso_configs')
@Index(['tenantId'])
@Index(['provider'])
@Unique(['tenantId', 'provider', 'name'])
export class SsoConfig {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'tenant_id', type: 'uuid', nullable: true })
  tenantId?: string | null;

  @ManyToOne(() => Tenant, { nullable: true })
  @JoinColumn({ name: 'tenant_id' })
  tenant?: Tenant | null;

  @Column({ type: 'varchar', length: 50 })
  provider!: SsoProviderType;

  @Column({ type: 'varchar', length: 100 })
  name!: string;

  @Column({ type: 'boolean', default: false })
  enabled!: boolean;

  // SAML fields
  @Column({ name: 'entity_id', type: 'varchar', length: 500, nullable: true })
  entityId?: string | null;

  @Column({ name: 'sso_url', type: 'varchar', length: 500, nullable: true })
  ssoUrl?: string | null;

  @Column({ name: 'slo_url', type: 'varchar', length: 500, nullable: true })
  sloUrl?: string | null;

  @Column({ type: 'text', nullable: true })
  certificate?: string | null;

  @Column({ name: 'sp_entity_id', type: 'varchar', length: 500, nullable: true })
  spEntityId?: string | null;

  @Column({ name: 'sp_acs_url', type: 'varchar', length: 500, nullable: true })
  spAcsUrl?: string | null;

  // OIDC/OAuth fields
  @Column({ name: 'client_id', type: 'varchar', length: 255, nullable: true })
  clientId?: string | null;

  @Column({ name: 'client_secret_encrypted', type: 'text', nullable: true })
  clientSecretEncrypted?: string | null;

  @Column({ name: 'authorization_url', type: 'varchar', length: 500, nullable: true })
  authorizationUrl?: string | null;

  @Column({ name: 'token_url', type: 'varchar', length: 500, nullable: true })
  tokenUrl?: string | null;

  @Column({ name: 'userinfo_url', type: 'varchar', length: 500, nullable: true })
  userinfoUrl?: string | null;

  @Column({ name: 'jwks_url', type: 'varchar', length: 500, nullable: true })
  jwksUrl?: string | null;

  @Column({ type: 'varchar', length: 255, default: 'openid profile email' })
  scopes!: string;

  // Attribute mapping (maps IdP attributes to local fields)
  @Column({ name: 'attribute_mapping', type: 'jsonb', default: () => `'{"email": "email", "display_name": "name", "first_name": "given_name", "last_name": "family_name"}'` })
  attributeMapping!: Record<string, string>;

  // JIT (Just-In-Time) provisioning settings
  @Column({ name: 'jit_enabled', type: 'boolean', default: false })
  jitEnabled!: boolean;

  @Column({ name: 'jit_default_roles', type: 'jsonb', default: () => `'[]'` })
  jitDefaultRoles!: string[];

  @Column({ name: 'jit_group_mapping', type: 'jsonb', default: () => `'{}'` })
  jitGroupMapping!: Record<string, string>;

  @Column({ name: 'jit_update_profile', type: 'boolean', default: true })
  jitUpdateProfile!: boolean;

  // UI customization
  @Column({ name: 'button_text', type: 'varchar', length: 100, nullable: true })
  buttonText?: string | null;

  @Column({ name: 'button_icon_url', type: 'varchar', length: 500, nullable: true })
  buttonIconUrl?: string | null;

  @Column({ name: 'display_order', type: 'int', default: 0 })
  displayOrder!: number;

  // Additional settings
  @Column({ name: 'allowed_domains', type: 'jsonb', default: () => `'[]'` })
  allowedDomains!: string[];

  @Column({ name: 'logout_redirect_url', type: 'varchar', length: 500, nullable: true })
  logoutRedirectUrl?: string | null;

  // Audit
  @Column({ name: 'created_by', type: 'uuid', nullable: true })
  createdBy?: string | null;

  @ManyToOne(() => UserAccount, { nullable: true })
  @JoinColumn({ name: 'created_by' })
  createdByUser?: UserAccount | null;

  @Column({ name: 'updated_by', type: 'uuid', nullable: true })
  updatedBy?: string | null;

  @ManyToOne(() => UserAccount, { nullable: true })
  @JoinColumn({ name: 'updated_by' })
  updatedByUser?: UserAccount | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;

  @Column({ name: 'deleted_at', type: 'timestamptz', nullable: true })
  deletedAt?: Date | null;
}
