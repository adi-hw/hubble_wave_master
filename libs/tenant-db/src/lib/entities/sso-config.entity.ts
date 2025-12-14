import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

export type SSOProvider = 'saml' | 'oidc' | 'ldap' | 'azure_ad' | 'okta' | 'google';

export type SSOStatus = 'active' | 'inactive' | 'testing' | 'error';

/**
 * SSO Configuration for tenant
 * Supports SAML, OIDC, LDAP, and provider-specific integrations
 */
@Entity('sso_configs')
export class SSOConfig {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ length: 100 })
  @Index()
  name!: string;

  @Column({ type: 'varchar', length: 20 })
  provider!: SSOProvider;

  @Column({ type: 'varchar', length: 20, default: 'inactive' })
  status!: SSOStatus;

  @Column({ default: false })
  isDefault!: boolean;

  // SAML Configuration
  @Column({ type: 'text', nullable: true })
  samlEntityId?: string;

  @Column({ type: 'text', nullable: true })
  samlSsoUrl?: string;

  @Column({ type: 'text', nullable: true })
  samlSloUrl?: string;

  @Column({ type: 'text', nullable: true })
  samlCertificate?: string;

  @Column({ type: 'varchar', length: 20, nullable: true })
  samlSignatureAlgorithm?: string;

  @Column({ default: false })
  samlWantAssertionsSigned?: boolean;

  @Column({ default: false })
  samlWantResponsesSigned?: boolean;

  // OIDC Configuration
  @Column({ type: 'text', nullable: true })
  oidcIssuer?: string;

  @Column({ type: 'text', nullable: true })
  oidcClientId?: string;

  @Column({ type: 'text', nullable: true })
  oidcClientSecret?: string;

  @Column({ type: 'text', nullable: true })
  oidcAuthorizationUrl?: string;

  @Column({ type: 'text', nullable: true })
  oidcTokenUrl?: string;

  @Column({ type: 'text', nullable: true })
  oidcUserInfoUrl?: string;

  @Column({ type: 'simple-array', nullable: true })
  oidcScopes?: string[];

  // LDAP Configuration
  @Column({ type: 'text', nullable: true })
  ldapUrl?: string;

  @Column({ type: 'text', nullable: true })
  ldapBindDn?: string;

  @Column({ type: 'text', nullable: true })
  ldapBindPassword?: string;

  @Column({ type: 'text', nullable: true })
  ldapSearchBase?: string;

  @Column({ type: 'text', nullable: true })
  ldapSearchFilter?: string;

  @Column({ default: false })
  ldapUseTls?: boolean;

  // Attribute Mapping
  @Column({ type: 'jsonb', default: {} })
  attributeMapping!: {
    email?: string;
    firstName?: string;
    lastName?: string;
    displayName?: string;
    groups?: string;
    department?: string;
    title?: string;
    phone?: string;
    manager?: string;
    employeeId?: string;
  };

  // Group Mapping (SSO groups -> tenant roles/groups)
  @Column({ type: 'jsonb', default: [] })
  groupMappings!: Array<{
    ssoGroup: string;
    tenantRoleId?: string;
    tenantGroupId?: string;
  }>;

  // Auto-provisioning settings
  @Column({ default: true })
  autoProvisionUsers!: boolean;

  @Column({ default: false })
  autoDeactivateUsers!: boolean;

  @Column({ type: 'uuid', nullable: true })
  defaultRoleId?: string;

  @Column({ type: 'simple-array', nullable: true })
  defaultGroupIds?: string[];

  // Session settings
  @Column({ type: 'int', default: 3600 })
  sessionDurationSeconds!: number;

  @Column({ default: false })
  forceReauthentication!: boolean;

  // Domain restrictions
  @Column({ type: 'simple-array', nullable: true })
  allowedDomains?: string[];

  @Column({ type: 'simple-array', nullable: true })
  blockedDomains?: string[];

  // Audit and metadata
  @Column({ type: 'timestamp with time zone', nullable: true })
  lastUsedAt?: Date;

  @Column({ type: 'int', default: 0 })
  loginCount!: number;

  @Column({ type: 'text', nullable: true })
  lastError?: string;

  @Column({ type: 'timestamp with time zone', nullable: true })
  lastErrorAt?: Date;

  @CreateDateColumn({ type: 'timestamp with time zone' })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'timestamp with time zone' })
  updatedAt!: Date;

  @Column({ type: 'uuid', nullable: true })
  createdBy?: string;

  @Column({ type: 'uuid', nullable: true })
  updatedBy?: string;
}

/**
 * SSO Session tracking for auditing and single logout
 */
@Entity('sso_sessions')
@Index(['userId', 'isActive'])
@Index(['sessionId'])
export class SSOSession {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid' })
  @Index()
  ssoConfigId!: string;

  @Column({ type: 'uuid' })
  @Index()
  userId!: string;

  @Column({ type: 'text' })
  sessionId!: string;

  @Column({ type: 'text', nullable: true })
  nameId?: string;

  @Column({ type: 'text', nullable: true })
  nameIdFormat?: string;

  @Column({ type: 'jsonb', nullable: true })
  attributes?: Record<string, unknown>;

  @Column({ default: true })
  isActive!: boolean;

  @Column({ type: 'varchar', length: 45, nullable: true })
  ipAddress?: string;

  @Column({ type: 'text', nullable: true })
  userAgent?: string;

  @CreateDateColumn({ type: 'timestamp with time zone' })
  createdAt!: Date;

  @Column({ type: 'timestamp with time zone' })
  expiresAt!: Date;

  @Column({ type: 'timestamp with time zone', nullable: true })
  terminatedAt?: Date;

  @Column({ type: 'varchar', length: 50, nullable: true })
  terminationReason?: string;
}

/**
 * SSO Identity linking - maps external identities to tenant users
 */
@Entity('sso_identities')
@Index(['ssoConfigId', 'externalId'], { unique: true })
export class SSOIdentity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid' })
  @Index()
  ssoConfigId!: string;

  @Column({ type: 'uuid' })
  @Index()
  userId!: string;

  @Column({ type: 'text' })
  externalId!: string;

  @Column({ type: 'text', nullable: true })
  email?: string;

  @Column({ type: 'jsonb', nullable: true })
  profile?: {
    firstName?: string;
    lastName?: string;
    displayName?: string;
    groups?: string[];
    department?: string;
    title?: string;
  };

  @Column({ type: 'jsonb', nullable: true })
  rawAttributes?: Record<string, unknown>;

  @Column({ type: 'timestamp with time zone', nullable: true })
  lastLoginAt?: Date;

  @Column({ type: 'int', default: 0 })
  loginCount!: number;

  @CreateDateColumn({ type: 'timestamp with time zone' })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'timestamp with time zone' })
  updatedAt!: Date;
}
