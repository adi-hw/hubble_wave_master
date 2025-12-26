import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  DeleteDateColumn,
} from 'typeorm';

@Entity('password_policies')
export class PasswordPolicy {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ default: 8 })
  minLength!: number;

  @Column({ default: false })
  requireUppercase!: boolean;

  @Column({ default: false })
  requireLowercase!: boolean;

  @Column({ default: false })
  requireNumbers!: boolean;

  @Column({ default: false })
  requireSpecialChars!: boolean;

  @Column({ default: 90 })
  expirationDays!: number;

  @Column({ default: 5 })
  historyCount!: number;

  @Column({ default: 3 })
  maxAttempts!: number;

  @Column({ default: 30 })
  lockoutMinutes!: number;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}

@Entity('ldap_configs')
export class LdapConfig {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column()
  host!: string;

  @Column({ default: 389 })
  port!: number;

  @Column({ default: false })
  secure!: boolean;

  @Column({ nullable: true })
  bindDn?: string;

  @Column({ nullable: true })
  bindPassword?: string;

  @Column()
  searchBase!: string;

  @Column()
  userSearchFilter!: string;

  @Column({ default: 'uid' })
  usernameAttribute!: string;

  @Column({ default: 'mail' })
  emailAttribute!: string;

  @Column({ default: 'cn' })
  fullNameAttribute!: string;

  @Column({ default: false })
  enabled!: boolean;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}

@Entity('sso_providers')
export class SsoProvider {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column()
  name!: string;

  @Column({ unique: true })
  slug!: string;

  @Column({ type: 'text', nullable: true })
  description?: string;

  @Column()
  type!: 'oidc' | 'saml';

  // OIDC fields
  @Column({ nullable: true })
  issuer?: string;

  @Column({ name: 'client_id', nullable: true })
  clientId?: string;

  @Column({ name: 'client_secret', nullable: true })
  clientSecret?: string;

  @Column({ name: 'authorization_url', nullable: true })
  authorizationUrl?: string;

  @Column({ name: 'token_url', nullable: true })
  tokenUrl?: string;

  @Column({ name: 'user_info_url', nullable: true })
  userInfoUrl?: string;

  @Column({ name: 'jwks_url', nullable: true })
  jwksUrl?: string;

  @Column({ nullable: true })
  scopes?: string;

  // SAML fields
  @Column({ name: 'entity_id', nullable: true })
  entityId?: string;

  @Column({ name: 'sso_url', nullable: true })
  ssoUrl?: string;

  @Column({ name: 'slo_url', nullable: true })
  sloUrl?: string;

  @Column({ type: 'text', nullable: true })
  certificate?: string;

  // JIT Provisioning
  @Column({ name: 'jit_enabled', default: false })
  jitEnabled!: boolean;

  @Column({ name: 'jit_default_roles', type: 'jsonb', nullable: true })
  jitDefaultRoles?: string[];

  @Column({ name: 'jit_group_mapping', type: 'jsonb', nullable: true })
  jitGroupMapping?: Record<string, string>;

  @Column({ name: 'jit_update_profile', default: true })
  jitUpdateProfile!: boolean;

  // Attribute mapping
  @Column({ name: 'attribute_mapping', type: 'jsonb', nullable: true })
  attributeMapping?: Record<string, string>;

  // UI customization
  @Column({ name: 'button_text', nullable: true })
  buttonText?: string;

  @Column({ name: 'button_icon_url', nullable: true })
  buttonIconUrl?: string;

  @Column({ name: 'display_order', default: 0 })
  displayOrder!: number;

  // Domain restrictions
  @Column({ name: 'allowed_domains', type: 'jsonb', nullable: true })
  allowedDomains?: string[];

  @Column({ name: 'logout_redirect_url', nullable: true })
  logoutRedirectUrl?: string;

  @Column({ default: false })
  enabled!: boolean;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;

  @DeleteDateColumn({ name: 'deleted_at' })
  deletedAt?: Date;
}
