import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Seed Platform Collections
 *
 * This migration seeds all platform collections and their properties with the
 * correct ownership settings. This is the foundation of the governance model.
 *
 * OWNERSHIP LEVELS:
 *
 *   SYSTEM (owner = 'system')
 *   - Completely immutable, even by platform admins
 *   - Used for: audit_logs, schema_change_log, schema_sync_state
 *   - These tables are infrastructure and must never be modified
 *
 *   PLATFORM (owner = 'platform')
 *   - Base properties are immutable
 *   - Tenants CAN add custom properties with x_ prefix
 *   - Used for: users, roles, groups, permissions, etc.
 *   - Allows customization while protecting core functionality
 *
 *   CUSTOM (owner = 'custom')
 *   - Full tenant control (create, rename, delete)
 *   - Created by tenants through Studio
 *   - Not seeded here - created dynamically
 *
 * IMPORTANT:
 * - This migration should run AFTER the base collection_definitions table exists
 * - This migration should run AFTER the governance enhancement migration
 * - This uses INSERT ... ON CONFLICT to be idempotent (safe to re-run)
 */
export class SeedPlatformCollections1787000010002 implements MigrationInterface {
  name = 'SeedPlatformCollections1787000010002';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // =========================================================================
    // STEP 1: Seed Property Types (required for property_definitions FK)
    // =========================================================================

    await this.seedPropertyTypes(queryRunner);

    // =========================================================================
    // STEP 2: SYSTEM COLLECTIONS (Immutable Infrastructure)
    // =========================================================================

    await this.seedCollection(queryRunner, {
      code: 'audit_logs',
      name: 'Audit Log',
      pluralName: 'Audit Logs',
      description: 'Complete audit trail of all system activities for compliance and debugging.',
      icon: 'scroll-text',
      tableName: 'audit_logs',
      owner: 'system',
      category: 'system',
      isSystem: true,
      isExtensible: false,
      isAudited: false,
      enableAttachments: false,
    });

    await this.seedCollection(queryRunner, {
      code: 'schema_change_log',
      name: 'Schema Change Log',
      pluralName: 'Schema Change Logs',
      description: 'Audit trail of all schema modifications including DDL statements.',
      icon: 'file-diff',
      tableName: 'schema_change_log',
      owner: 'system',
      category: 'system',
      isSystem: true,
      isExtensible: false,
      isAudited: false,
      enableAttachments: false,
    });

    await this.seedCollection(queryRunner, {
      code: 'schema_sync_state',
      name: 'Schema Sync State',
      pluralName: 'Schema Sync States',
      description: 'Singleton table tracking schema synchronization status and drift detection.',
      icon: 'refresh-cw',
      tableName: 'schema_sync_state',
      owner: 'system',
      category: 'system',
      isSystem: true,
      isExtensible: false,
      isAudited: false,
      enableAttachments: false,
    });

    // =========================================================================
    // STEP 3: PLATFORM COLLECTIONS - Identity & Access
    // =========================================================================

    await this.seedCollection(queryRunner, {
      code: 'users',
      name: 'User',
      pluralName: 'Users',
      description: 'Platform users who can log in and interact with the system.',
      icon: 'user',
      tableName: 'users',
      owner: 'platform',
      category: 'identity',
      isSystem: false,
      isExtensible: true,
      isAudited: true,
      enableAttachments: true,
    });

    await this.seedCollection(queryRunner, {
      code: 'roles',
      name: 'Role',
      pluralName: 'Roles',
      description: 'Security roles that define sets of permissions.',
      icon: 'shield',
      tableName: 'roles',
      owner: 'platform',
      category: 'identity',
      isSystem: false,
      isExtensible: true,
      isAudited: true,
      enableAttachments: false,
    });

    await this.seedCollection(queryRunner, {
      code: 'groups',
      name: 'Group',
      pluralName: 'Groups',
      description: 'Groups of users for organizational structure and access control.',
      icon: 'users',
      tableName: 'groups',
      owner: 'platform',
      category: 'identity',
      isSystem: false,
      isExtensible: true,
      isAudited: true,
      enableAttachments: false,
    });

    await this.seedCollection(queryRunner, {
      code: 'permissions',
      name: 'Permission',
      pluralName: 'Permissions',
      description: 'Granular permissions that can be assigned to roles.',
      icon: 'key',
      tableName: 'permissions',
      owner: 'platform',
      category: 'identity',
      isSystem: false,
      isExtensible: false,
      isAudited: true,
      enableAttachments: false,
    });

    await this.seedCollection(queryRunner, {
      code: 'role_permissions',
      name: 'Role Permission',
      pluralName: 'Role Permissions',
      description: 'Junction table linking roles to their permissions.',
      icon: 'link',
      tableName: 'role_permissions',
      owner: 'platform',
      category: 'identity',
      isSystem: false,
      isExtensible: false,
      isAudited: false,
      enableAttachments: false,
    });

    await this.seedCollection(queryRunner, {
      code: 'user_roles',
      name: 'User Role',
      pluralName: 'User Roles',
      description: 'Junction table linking users to their roles.',
      icon: 'link',
      tableName: 'user_roles',
      owner: 'platform',
      category: 'identity',
      isSystem: false,
      isExtensible: false,
      isAudited: false,
      enableAttachments: false,
    });

    await this.seedCollection(queryRunner, {
      code: 'group_members',
      name: 'Group Member',
      pluralName: 'Group Members',
      description: 'Junction table linking users to their groups.',
      icon: 'link',
      tableName: 'group_members',
      owner: 'platform',
      category: 'identity',
      isSystem: false,
      isExtensible: false,
      isAudited: false,
      enableAttachments: false,
    });

    await this.seedCollection(queryRunner, {
      code: 'group_roles',
      name: 'Group Role',
      pluralName: 'Group Roles',
      description: 'Junction table linking groups to roles.',
      icon: 'link',
      tableName: 'group_roles',
      owner: 'platform',
      category: 'identity',
      isSystem: false,
      isExtensible: false,
      isAudited: false,
      enableAttachments: false,
    });

    // =========================================================================
    // STEP 4: PLATFORM COLLECTIONS - Schema Engine
    // =========================================================================

    await this.seedCollection(queryRunner, {
      code: 'collection_definitions',
      name: 'Collection',
      pluralName: 'Collections',
      description: 'Metadata definitions for data collections (tables).',
      icon: 'database',
      tableName: 'collection_definitions',
      owner: 'platform',
      category: 'schema',
      isSystem: false,
      isExtensible: true,
      isAudited: true,
      enableAttachments: false,
    });

    await this.seedCollection(queryRunner, {
      code: 'property_definitions',
      name: 'Property',
      pluralName: 'Properties',
      description: 'Metadata definitions for collection properties (columns).',
      icon: 'columns',
      tableName: 'property_definitions',
      owner: 'platform',
      category: 'schema',
      isSystem: false,
      isExtensible: true,
      isAudited: true,
      enableAttachments: false,
    });

    await this.seedCollection(queryRunner, {
      code: 'property_types',
      name: 'Property Type',
      pluralName: 'Property Types',
      description: 'Data types available for collection properties.',
      icon: 'type',
      tableName: 'property_types',
      owner: 'platform',
      category: 'schema',
      isSystem: false,
      isExtensible: false,
      isAudited: true,
      enableAttachments: false,
    });

    await this.seedCollection(queryRunner, {
      code: 'choice_lists',
      name: 'Choice List',
      pluralName: 'Choice Lists',
      description: 'Reusable lists of choices for dropdown properties.',
      icon: 'list',
      tableName: 'choice_lists',
      owner: 'platform',
      category: 'schema',
      isSystem: false,
      isExtensible: true,
      isAudited: true,
      enableAttachments: false,
    });

    await this.seedCollection(queryRunner, {
      code: 'choice_items',
      name: 'Choice Item',
      pluralName: 'Choice Items',
      description: 'Individual items within a choice list.',
      icon: 'check-square',
      tableName: 'choice_items',
      owner: 'platform',
      category: 'schema',
      isSystem: false,
      isExtensible: false,
      isAudited: true,
      enableAttachments: false,
    });

    // =========================================================================
    // STEP 5: PLATFORM COLLECTIONS - Access Control
    // =========================================================================

    await this.seedCollection(queryRunner, {
      code: 'collection_access_rules',
      name: 'Collection Access Rule',
      pluralName: 'Collection Access Rules',
      description: 'Row-level security rules for collections.',
      icon: 'shield-check',
      tableName: 'collection_access_rules',
      owner: 'platform',
      category: 'access',
      isSystem: false,
      isExtensible: false,
      isAudited: true,
      enableAttachments: false,
    });

    await this.seedCollection(queryRunner, {
      code: 'property_access_rules',
      name: 'Property Access Rule',
      pluralName: 'Property Access Rules',
      description: 'Field-level security rules for properties.',
      icon: 'shield-check',
      tableName: 'property_access_rules',
      owner: 'platform',
      category: 'access',
      isSystem: false,
      isExtensible: false,
      isAudited: true,
      enableAttachments: false,
    });

    await this.seedCollection(queryRunner, {
      code: 'access_conditions',
      name: 'Access Condition',
      pluralName: 'Access Conditions',
      description: 'Conditions for access rules.',
      icon: 'filter',
      tableName: 'access_conditions',
      owner: 'platform',
      category: 'access',
      isSystem: false,
      isExtensible: false,
      isAudited: true,
      enableAttachments: false,
    });

    await this.seedCollection(queryRunner, {
      code: 'access_condition_groups',
      name: 'Access Condition Group',
      pluralName: 'Access Condition Groups',
      description: 'Groups of access conditions with AND/OR logic.',
      icon: 'filter',
      tableName: 'access_condition_groups',
      owner: 'platform',
      category: 'access',
      isSystem: false,
      isExtensible: false,
      isAudited: true,
      enableAttachments: false,
    });

    // =========================================================================
    // STEP 6: PLATFORM COLLECTIONS - Settings & Configuration
    // =========================================================================

    await this.seedCollection(queryRunner, {
      code: 'user_preferences',
      name: 'User Preference',
      pluralName: 'User Preferences',
      description: 'Per-user settings like theme, density, and locale.',
      icon: 'settings',
      tableName: 'user_preferences',
      owner: 'platform',
      category: 'settings',
      isSystem: false,
      isExtensible: true,
      isAudited: false,
      enableAttachments: false,
    });

    await this.seedCollection(queryRunner, {
      code: 'instance_settings',
      name: 'Instance Setting',
      pluralName: 'Instance Settings',
      description: 'Instance-wide configuration settings.',
      icon: 'building',
      tableName: 'instance_settings',
      owner: 'platform',
      category: 'settings',
      isSystem: false,
      isExtensible: true,
      isAudited: true,
      enableAttachments: false,
    });

    await this.seedCollection(queryRunner, {
      code: 'theme_definitions',
      name: 'Theme',
      pluralName: 'Themes',
      description: 'Custom theme definitions for UI styling.',
      icon: 'palette',
      tableName: 'theme_definitions',
      owner: 'platform',
      category: 'settings',
      isSystem: false,
      isExtensible: true,
      isAudited: true,
      enableAttachments: false,
    });

    // =========================================================================
    // STEP 7: PLATFORM COLLECTIONS - Authentication
    // =========================================================================

    await this.seedCollection(queryRunner, {
      code: 'auth_settings',
      name: 'Auth Setting',
      pluralName: 'Auth Settings',
      description: 'Authentication configuration settings.',
      icon: 'lock',
      tableName: 'auth_settings',
      owner: 'platform',
      category: 'auth',
      isSystem: false,
      isExtensible: false,
      isAudited: true,
      enableAttachments: false,
    });

    await this.seedCollection(queryRunner, {
      code: 'auth_events',
      name: 'Auth Event',
      pluralName: 'Auth Events',
      description: 'Authentication event log (login, logout, failed attempts).',
      icon: 'log-in',
      tableName: 'auth_events',
      owner: 'platform',
      category: 'auth',
      isSystem: false,
      isExtensible: false,
      isAudited: false,
      enableAttachments: false,
    });

    await this.seedCollection(queryRunner, {
      code: 'password_policies',
      name: 'Password Policy',
      pluralName: 'Password Policies',
      description: 'Password strength and expiration rules.',
      icon: 'shield',
      tableName: 'password_policies',
      owner: 'platform',
      category: 'auth',
      isSystem: false,
      isExtensible: false,
      isAudited: true,
      enableAttachments: false,
    });

    await this.seedCollection(queryRunner, {
      code: 'sso_providers',
      name: 'SSO Provider',
      pluralName: 'SSO Providers',
      description: 'Single Sign-On provider configurations.',
      icon: 'external-link',
      tableName: 'sso_providers',
      owner: 'platform',
      category: 'auth',
      isSystem: false,
      isExtensible: true,
      isAudited: true,
      enableAttachments: false,
    });

    // =========================================================================
    // STEP 8: PLATFORM COLLECTIONS - Forms
    // =========================================================================

    await this.seedCollection(queryRunner, {
      code: 'form_definitions',
      name: 'Form',
      pluralName: 'Forms',
      description: 'Form layout definitions for collections.',
      icon: 'layout',
      tableName: 'form_definitions',
      owner: 'platform',
      category: 'forms',
      isSystem: false,
      isExtensible: true,
      isAudited: true,
      enableAttachments: false,
    });

    await this.seedCollection(queryRunner, {
      code: 'form_versions',
      name: 'Form Version',
      pluralName: 'Form Versions',
      description: 'Versioned snapshots of form definitions.',
      icon: 'history',
      tableName: 'form_versions',
      owner: 'platform',
      category: 'forms',
      isSystem: false,
      isExtensible: false,
      isAudited: true,
      enableAttachments: false,
    });

    // =========================================================================
    // STEP 9: PLATFORM COLLECTIONS - Navigation
    // =========================================================================

    await this.seedCollection(queryRunner, {
      code: 'nav_nodes',
      name: 'Navigation Node',
      pluralName: 'Navigation Nodes',
      description: 'Navigation menu structure nodes.',
      icon: 'navigation',
      tableName: 'nav_nodes',
      owner: 'platform',
      category: 'navigation',
      isSystem: false,
      isExtensible: true,
      isAudited: true,
      enableAttachments: false,
    });

    await this.seedCollection(queryRunner, {
      code: 'nav_profiles',
      name: 'Navigation Profile',
      pluralName: 'Navigation Profiles',
      description: 'Role-based navigation profiles.',
      icon: 'menu',
      tableName: 'nav_profiles',
      owner: 'platform',
      category: 'navigation',
      isSystem: false,
      isExtensible: true,
      isAudited: true,
      enableAttachments: false,
    });

    // =========================================================================
    // STEP 10: PLATFORM COLLECTIONS - Modules
    // =========================================================================

    await this.seedCollection(queryRunner, {
      code: 'modules',
      name: 'Module',
      pluralName: 'Modules',
      description: 'Platform modules/applications.',
      icon: 'package',
      tableName: 'modules',
      owner: 'platform',
      category: 'modules',
      isSystem: false,
      isExtensible: true,
      isAudited: true,
      enableAttachments: false,
    });

    await this.seedCollection(queryRunner, {
      code: 'module_security',
      name: 'Module Security',
      pluralName: 'Module Security Settings',
      description: 'Security configuration for modules.',
      icon: 'shield',
      tableName: 'module_security',
      owner: 'platform',
      category: 'modules',
      isSystem: false,
      isExtensible: false,
      isAudited: true,
      enableAttachments: false,
    });

    // =========================================================================
    // STEP 11: PLATFORM COLLECTIONS - AVA (AI Virtual Assistant)
    // =========================================================================

    await this.seedCollection(queryRunner, {
      code: 'ava_audit_trail',
      name: 'AVA Audit Trail',
      pluralName: 'AVA Audit Trails',
      description: 'Audit trail for AI assistant actions.',
      icon: 'bot',
      tableName: 'ava_audit_trail',
      owner: 'platform',
      category: 'ava',
      isSystem: false,
      isExtensible: false,
      isAudited: false,
      enableAttachments: false,
    });

    await this.seedCollection(queryRunner, {
      code: 'ava_permission_configs',
      name: 'AVA Permission Config',
      pluralName: 'AVA Permission Configs',
      description: 'Permission configuration for AI assistant.',
      icon: 'settings',
      tableName: 'ava_permission_configs',
      owner: 'platform',
      category: 'ava',
      isSystem: false,
      isExtensible: false,
      isAudited: true,
      enableAttachments: false,
    });

    await this.seedCollection(queryRunner, {
      code: 'ava_global_settings',
      name: 'AVA Global Settings',
      pluralName: 'AVA Global Settings',
      description: 'Global settings for AI assistant.',
      icon: 'settings',
      tableName: 'ava_global_settings',
      owner: 'platform',
      category: 'ava',
      isSystem: false,
      isExtensible: true,
      isAudited: true,
      enableAttachments: false,
    });

    await this.seedCollection(queryRunner, {
      code: 'ava_conversations',
      name: 'AVA Conversation',
      pluralName: 'AVA Conversations',
      description: 'AI assistant conversation history.',
      icon: 'message-circle',
      tableName: 'ava_conversations',
      owner: 'platform',
      category: 'ava',
      isSystem: false,
      isExtensible: false,
      isAudited: false,
      enableAttachments: false,
    });

    // =========================================================================
    // STEP 12: PLATFORM COLLECTIONS - Audit Logs
    // =========================================================================

    await this.seedCollection(queryRunner, {
      code: 'access_audit_logs',
      name: 'Access Audit Log',
      pluralName: 'Access Audit Logs',
      description: 'Audit trail for access control changes.',
      icon: 'shield',
      tableName: 'access_audit_logs',
      owner: 'platform',
      category: 'audit',
      isSystem: false,
      isExtensible: false,
      isAudited: false,
      enableAttachments: false,
    });

    await this.seedCollection(queryRunner, {
      code: 'access_rule_audit_logs',
      name: 'Access Rule Audit Log',
      pluralName: 'Access Rule Audit Logs',
      description: 'Audit trail for access rule changes.',
      icon: 'shield',
      tableName: 'access_rule_audit_logs',
      owner: 'platform',
      category: 'audit',
      isSystem: false,
      isExtensible: false,
      isAudited: false,
      enableAttachments: false,
    });

    await this.seedCollection(queryRunner, {
      code: 'property_audit_logs',
      name: 'Property Audit Log',
      pluralName: 'Property Audit Logs',
      description: 'Audit trail for property value changes.',
      icon: 'file-text',
      tableName: 'property_audit_logs',
      owner: 'platform',
      category: 'audit',
      isSystem: false,
      isExtensible: false,
      isAudited: false,
      enableAttachments: false,
    });

    // =========================================================================
    // STEP 13: PLATFORM COLLECTIONS - Auth Tokens & Security
    // =========================================================================

    await this.seedCollection(queryRunner, {
      code: 'api_keys',
      name: 'API Key',
      pluralName: 'API Keys',
      description: 'API keys for programmatic access.',
      icon: 'key',
      tableName: 'api_keys',
      owner: 'platform',
      category: 'auth',
      isSystem: false,
      isExtensible: false,
      isAudited: true,
      enableAttachments: false,
    });

    await this.seedCollection(queryRunner, {
      code: 'refresh_tokens',
      name: 'Refresh Token',
      pluralName: 'Refresh Tokens',
      description: 'JWT refresh tokens for session management.',
      icon: 'refresh-cw',
      tableName: 'refresh_tokens',
      owner: 'platform',
      category: 'auth',
      isSystem: false,
      isExtensible: false,
      isAudited: false,
      enableAttachments: false,
    });

    await this.seedCollection(queryRunner, {
      code: 'password_reset_tokens',
      name: 'Password Reset Token',
      pluralName: 'Password Reset Tokens',
      description: 'Tokens for password reset requests.',
      icon: 'key',
      tableName: 'password_reset_tokens',
      owner: 'platform',
      category: 'auth',
      isSystem: false,
      isExtensible: false,
      isAudited: false,
      enableAttachments: false,
    });

    await this.seedCollection(queryRunner, {
      code: 'email_verification_tokens',
      name: 'Email Verification Token',
      pluralName: 'Email Verification Tokens',
      description: 'Tokens for email verification.',
      icon: 'mail',
      tableName: 'email_verification_tokens',
      owner: 'platform',
      category: 'auth',
      isSystem: false,
      isExtensible: false,
      isAudited: false,
      enableAttachments: false,
    });

    await this.seedCollection(queryRunner, {
      code: 'password_history',
      name: 'Password History',
      pluralName: 'Password History',
      description: 'Historical password hashes to prevent reuse.',
      icon: 'history',
      tableName: 'password_history',
      owner: 'platform',
      category: 'auth',
      isSystem: false,
      isExtensible: false,
      isAudited: false,
      enableAttachments: false,
    });

    await this.seedCollection(queryRunner, {
      code: 'mfa_methods',
      name: 'MFA Method',
      pluralName: 'MFA Methods',
      description: 'Multi-factor authentication methods for users.',
      icon: 'smartphone',
      tableName: 'mfa_methods',
      owner: 'platform',
      category: 'auth',
      isSystem: false,
      isExtensible: false,
      isAudited: true,
      enableAttachments: false,
    });

    await this.seedCollection(queryRunner, {
      code: 'user_invitations',
      name: 'User Invitation',
      pluralName: 'User Invitations',
      description: 'Pending user invitations.',
      icon: 'mail',
      tableName: 'user_invitations',
      owner: 'platform',
      category: 'auth',
      isSystem: false,
      isExtensible: false,
      isAudited: true,
      enableAttachments: false,
    });

    await this.seedCollection(queryRunner, {
      code: 'user_sessions',
      name: 'User Session',
      pluralName: 'User Sessions',
      description: 'Active user sessions.',
      icon: 'monitor',
      tableName: 'user_sessions',
      owner: 'platform',
      category: 'auth',
      isSystem: false,
      isExtensible: false,
      isAudited: false,
      enableAttachments: false,
    });

    await this.seedCollection(queryRunner, {
      code: 'ldap_configs',
      name: 'LDAP Config',
      pluralName: 'LDAP Configs',
      description: 'LDAP/Active Directory integration configurations.',
      icon: 'server',
      tableName: 'ldap_configs',
      owner: 'platform',
      category: 'auth',
      isSystem: false,
      isExtensible: true,
      isAudited: true,
      enableAttachments: false,
    });

    // =========================================================================
    // STEP 14: PLATFORM COLLECTIONS - Instance Configuration
    // =========================================================================

    await this.seedCollection(queryRunner, {
      code: 'instance_customizations',
      name: 'Instance Customization',
      pluralName: 'Instance Customizations',
      description: 'Instance-level UI and behavior customizations.',
      icon: 'sliders',
      tableName: 'instance_customizations',
      owner: 'platform',
      category: 'settings',
      isSystem: false,
      isExtensible: true,
      isAudited: true,
      enableAttachments: false,
    });

    await this.seedCollection(queryRunner, {
      code: 'instance_branding',
      name: 'Instance Branding',
      pluralName: 'Instance Branding',
      description: 'Logo, colors, and branding settings.',
      icon: 'image',
      tableName: 'instance_branding',
      owner: 'platform',
      category: 'settings',
      isSystem: false,
      isExtensible: true,
      isAudited: true,
      enableAttachments: true,
    });

    await this.seedCollection(queryRunner, {
      code: 'config_change_history',
      name: 'Config Change History',
      pluralName: 'Config Change History',
      description: 'History of configuration changes.',
      icon: 'history',
      tableName: 'config_change_history',
      owner: 'platform',
      category: 'settings',
      isSystem: false,
      isExtensible: false,
      isAudited: false,
      enableAttachments: false,
    });

    await this.seedCollection(queryRunner, {
      code: 'user_theme_preferences',
      name: 'User Theme Preference',
      pluralName: 'User Theme Preferences',
      description: 'Per-user theme customizations.',
      icon: 'palette',
      tableName: 'user_theme_preferences',
      owner: 'platform',
      category: 'settings',
      isSystem: false,
      isExtensible: false,
      isAudited: false,
      enableAttachments: false,
    });

    // =========================================================================
    // STEP 15: PLATFORM COLLECTIONS - Navigation Extended
    // =========================================================================

    await this.seedCollection(queryRunner, {
      code: 'nav_profile_items',
      name: 'Navigation Profile Item',
      pluralName: 'Navigation Profile Items',
      description: 'Items within navigation profiles.',
      icon: 'list',
      tableName: 'nav_profile_items',
      owner: 'platform',
      category: 'navigation',
      isSystem: false,
      isExtensible: false,
      isAudited: true,
      enableAttachments: false,
    });

    await this.seedCollection(queryRunner, {
      code: 'nav_patches',
      name: 'Navigation Patch',
      pluralName: 'Navigation Patches',
      description: 'Patches/overrides for navigation structure.',
      icon: 'edit',
      tableName: 'nav_patches',
      owner: 'platform',
      category: 'navigation',
      isSystem: false,
      isExtensible: false,
      isAudited: true,
      enableAttachments: false,
    });

    // =========================================================================
    // STEP 16: PLATFORM COLLECTIONS - AI/Vector Search
    // =========================================================================

    await this.seedCollection(queryRunner, {
      code: 'document_chunks',
      name: 'Document Chunk',
      pluralName: 'Document Chunks',
      description: 'Chunked documents for vector search and RAG.',
      icon: 'file-text',
      tableName: 'document_chunks',
      owner: 'platform',
      category: 'ai',
      isSystem: false,
      isExtensible: false,
      isAudited: false,
      enableAttachments: false,
    });

    // =========================================================================
    // STEP 17: Seed properties for core collections
    // =========================================================================

    await this.seedUserProperties(queryRunner);
    await this.seedRoleProperties(queryRunner);
    await this.seedGroupProperties(queryRunner);
    await this.seedPermissionProperties(queryRunner);
    await this.seedCollectionDefinitionProperties(queryRunner);
    await this.seedPropertyDefinitionProperties(queryRunner);

    // Log completion
    console.log('Platform collections seeded successfully');
    console.log('   - System collections: 3');
    console.log('   - Platform collections: 53 (covering all 56 backend tables)');
    console.log('   - Properties seeded for core collections');
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Delete properties first (foreign key constraint)
    await queryRunner.query(`
      DELETE FROM property_definitions
      WHERE collection_id IN (
        SELECT id FROM collection_definitions WHERE owner IN ('system', 'platform')
      )
    `);

    // Delete seeded collections
    await queryRunner.query(`
      DELETE FROM collection_definitions
      WHERE owner IN ('system', 'platform')
    `);

    // Delete property types (they are marked as is_system = true)
    await queryRunner.query(`DELETE FROM property_types WHERE is_system = true`);

    console.log('Platform collections removed');
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // Property Types Seeding
  // ═══════════════════════════════════════════════════════════════════════════

  private async seedPropertyTypes(queryRunner: QueryRunner): Promise<void> {
    const propertyTypes = [
      // Text types
      { code: 'text', name: 'Text', category: 'text', baseType: 'string', widget: 'text-input', icon: 'type' },
      { code: 'long_text', name: 'Long Text', category: 'text', baseType: 'string', widget: 'textarea', icon: 'align-left' },
      { code: 'rich_text', name: 'Rich Text', category: 'text', baseType: 'string', widget: 'rich-text', icon: 'edit-3' },
      { code: 'email', name: 'Email', category: 'text', baseType: 'string', widget: 'email-input', icon: 'mail' },
      { code: 'url', name: 'URL', category: 'text', baseType: 'string', widget: 'url-input', icon: 'link' },
      { code: 'phone', name: 'Phone', category: 'text', baseType: 'string', widget: 'phone-input', icon: 'phone' },

      // Number types
      { code: 'integer', name: 'Integer', category: 'number', baseType: 'number', widget: 'number-input', icon: 'hash' },
      { code: 'decimal', name: 'Decimal', category: 'number', baseType: 'number', widget: 'number-input', icon: 'percent' },
      { code: 'currency', name: 'Currency', category: 'number', baseType: 'number', widget: 'currency-input', icon: 'dollar-sign' },
      { code: 'percentage', name: 'Percentage', category: 'number', baseType: 'number', widget: 'percentage-input', icon: 'percent' },

      // Date/Time types
      { code: 'date', name: 'Date', category: 'datetime', baseType: 'date', widget: 'date-picker', icon: 'calendar' },
      { code: 'datetime', name: 'Date & Time', category: 'datetime', baseType: 'datetime', widget: 'datetime-picker', icon: 'clock' },
      { code: 'time', name: 'Time', category: 'datetime', baseType: 'time', widget: 'time-picker', icon: 'clock' },
      { code: 'duration', name: 'Duration', category: 'datetime', baseType: 'number', widget: 'duration-input', icon: 'hourglass' },

      // Boolean
      { code: 'boolean', name: 'Yes/No', category: 'boolean', baseType: 'boolean', widget: 'toggle', icon: 'toggle-left' },

      // Choice types
      { code: 'choice', name: 'Choice', category: 'choice', baseType: 'string', widget: 'select', icon: 'list' },
      { code: 'multi_choice', name: 'Multi-Choice', category: 'choice', baseType: 'array', widget: 'multi-select', icon: 'check-square' },

      // Reference types
      { code: 'reference', name: 'Reference', category: 'reference', baseType: 'uuid', widget: 'reference-picker', icon: 'link-2' },
      { code: 'multi_reference', name: 'Multi-Reference', category: 'reference', baseType: 'array', widget: 'multi-reference-picker', icon: 'link-2' },
      { code: 'user', name: 'User', category: 'reference', baseType: 'uuid', widget: 'user-picker', icon: 'user' },
      { code: 'group', name: 'Group', category: 'reference', baseType: 'uuid', widget: 'group-picker', icon: 'users' },

      // Special types
      { code: 'uuid', name: 'UUID', category: 'system', baseType: 'uuid', widget: 'text-input', icon: 'key' },
      { code: 'json', name: 'JSON', category: 'system', baseType: 'object', widget: 'json-editor', icon: 'code' },
      { code: 'attachment', name: 'Attachment', category: 'file', baseType: 'object', widget: 'file-upload', icon: 'paperclip' },
      { code: 'image', name: 'Image', category: 'file', baseType: 'object', widget: 'image-upload', icon: 'image' },
    ];

    for (const pt of propertyTypes) {
      await queryRunner.query(`
        INSERT INTO property_types (
          id, code, name, category,
          base_type, default_widget, icon,
          is_system, default_config, validation_rules,
          created_at
        ) VALUES (
          gen_random_uuid(), $1, $2, $3,
          $4, $5, $6,
          true, '{}'::jsonb, '{}'::jsonb,
          NOW()
        )
        ON CONFLICT (code) DO UPDATE SET
          name = EXCLUDED.name,
          category = EXCLUDED.category,
          base_type = EXCLUDED.base_type,
          default_widget = EXCLUDED.default_widget,
          icon = EXCLUDED.icon
      `, [
        pt.code,
        pt.name,
        pt.category,
        pt.baseType,
        pt.widget,
        pt.icon,
      ]);
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // Helper Methods
  // ═══════════════════════════════════════════════════════════════════════════

  private async seedCollection(
    queryRunner: QueryRunner,
    data: {
      code: string;
      name: string;
      pluralName: string;
      description: string;
      icon: string;
      tableName: string;
      owner: 'system' | 'platform';
      category: string;
      isSystem: boolean;
      isExtensible: boolean;
      isAudited: boolean;
      enableAttachments: boolean;
    },
  ): Promise<void> {
    await queryRunner.query(`
      INSERT INTO collection_definitions (
        code, name, plural_name, description, icon,
        table_name, owner_type, category,
        is_system, is_extensible, is_locked, is_audited,
        enable_attachments, enable_activity_log, enable_search,
        sync_status, is_active,
        created_at, updated_at
      ) VALUES (
        $1, $2, $3, $4, $5,
        $6, $7, $8,
        $9, $10, true, $11,
        $12, true, true,
        'synced', true,
        NOW(), NOW()
      )
      ON CONFLICT (code) DO UPDATE SET
        name = EXCLUDED.name,
        plural_name = EXCLUDED.plural_name,
        description = EXCLUDED.description,
        icon = EXCLUDED.icon,
        owner_type = EXCLUDED.owner_type,
        category = EXCLUDED.category,
        is_system = EXCLUDED.is_system,
        is_extensible = EXCLUDED.is_extensible,
        is_audited = EXCLUDED.is_audited,
        enable_attachments = EXCLUDED.enable_attachments,
        updated_at = NOW()
    `, [
      data.code,
      data.name,
      data.pluralName,
      data.description,
      data.icon,
      data.tableName,
      data.owner,
      data.category,
      data.isSystem,
      data.isExtensible,
      data.isAudited,
      data.enableAttachments,
    ]);
  }

  private async seedProperty(
    queryRunner: QueryRunner,
    collectionCode: string,
    data: {
      code: string;
      name: string;
      description?: string;
      propertyTypeCode: string;
      columnName: string;
      isRequired?: boolean;
      isUnique?: boolean;
      isIndexed?: boolean;
      position: number;
      isVisible?: boolean;
      isReadonly?: boolean;
      isSearchable?: boolean;
      isSortable?: boolean;
      isFilterable?: boolean;
    },
  ): Promise<void> {
    await queryRunner.query(`
      INSERT INTO property_definitions (
        collection_id, code, name, description,
        property_type_id, column_name,
        is_required, is_unique, is_indexed,
        position, is_visible, is_readonly,
        is_searchable, is_sortable, is_filterable,
        owner, sync_status, is_locked, is_system,
        is_active,
        created_at, updated_at
      )
      SELECT
        c.id,
        $2, $3, $4,
        pt.id, $6,
        $7, $8, $9,
        $10, $11, $12,
        $13, $14, $15,
        c.owner, 'synced', true, true,
        true,
        NOW(), NOW()
      FROM collection_definitions c
      CROSS JOIN property_types pt
      WHERE c.code = $1 AND pt.code = $5
      ON CONFLICT (collection_id, code) DO UPDATE SET
        name = EXCLUDED.name,
        description = EXCLUDED.description,
        position = EXCLUDED.position,
        is_visible = EXCLUDED.is_visible,
        is_searchable = EXCLUDED.is_searchable,
        is_sortable = EXCLUDED.is_sortable,
        is_filterable = EXCLUDED.is_filterable,
        updated_at = NOW()
    `, [
      collectionCode,
      data.code,
      data.name,
      data.description ?? null,
      data.propertyTypeCode,
      data.columnName,
      data.isRequired ?? false,
      data.isUnique ?? false,
      data.isIndexed ?? false,
      data.position,
      data.isVisible ?? true,
      data.isReadonly ?? false,
      data.isSearchable ?? false,
      data.isSortable ?? true,
      data.isFilterable ?? true,
    ]);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // Property Definitions for Core Collections
  // ═══════════════════════════════════════════════════════════════════════════

  private async seedUserProperties(queryRunner: QueryRunner): Promise<void> {
    const properties = [
      { code: 'id', name: 'ID', propertyTypeCode: 'uuid', columnName: 'id', isRequired: true, isUnique: true, position: 0, isVisible: false },
      { code: 'email', name: 'Email', propertyTypeCode: 'email', columnName: 'email', isRequired: true, isUnique: true, position: 1, isSearchable: true },
      { code: 'username', name: 'Username', propertyTypeCode: 'text', columnName: 'username', isRequired: true, isUnique: true, position: 2, isSearchable: true },
      { code: 'first_name', name: 'First Name', propertyTypeCode: 'text', columnName: 'first_name', position: 3, isSearchable: true },
      { code: 'last_name', name: 'Last Name', propertyTypeCode: 'text', columnName: 'last_name', position: 4, isSearchable: true },
      { code: 'display_name', name: 'Display Name', propertyTypeCode: 'text', columnName: 'display_name', position: 5, isSearchable: true },
      { code: 'avatar_url', name: 'Avatar', propertyTypeCode: 'url', columnName: 'avatar_url', position: 6, isVisible: false },
      { code: 'phone', name: 'Phone', propertyTypeCode: 'phone', columnName: 'phone', position: 7 },
      { code: 'timezone', name: 'Timezone', propertyTypeCode: 'text', columnName: 'timezone', position: 8, isVisible: false },
      { code: 'locale', name: 'Locale', propertyTypeCode: 'text', columnName: 'locale', position: 9, isVisible: false },
      { code: 'status', name: 'Status', propertyTypeCode: 'choice', columnName: 'status', isRequired: true, position: 10, description: 'active, inactive, invited, suspended' },
      { code: 'last_login_at', name: 'Last Login', propertyTypeCode: 'datetime', columnName: 'last_login_at', position: 11, isReadonly: true },
      { code: 'is_active', name: 'Active', propertyTypeCode: 'boolean', columnName: 'is_active', position: 12 },
      { code: 'created_at', name: 'Created', propertyTypeCode: 'datetime', columnName: 'created_at', position: 98, isVisible: false, isReadonly: true },
      { code: 'updated_at', name: 'Updated', propertyTypeCode: 'datetime', columnName: 'updated_at', position: 99, isVisible: false, isReadonly: true },
    ];

    for (const prop of properties) {
      await this.seedProperty(queryRunner, 'users', prop);
    }
  }

  private async seedRoleProperties(queryRunner: QueryRunner): Promise<void> {
    const properties = [
      { code: 'id', name: 'ID', propertyTypeCode: 'uuid', columnName: 'id', isRequired: true, isUnique: true, position: 0, isVisible: false },
      { code: 'code', name: 'Code', propertyTypeCode: 'text', columnName: 'code', isRequired: true, isUnique: true, position: 1, isSearchable: true },
      { code: 'name', name: 'Name', propertyTypeCode: 'text', columnName: 'name', isRequired: true, position: 2, isSearchable: true },
      { code: 'description', name: 'Description', propertyTypeCode: 'long_text', columnName: 'description', position: 3 },
      { code: 'scope', name: 'Scope', propertyTypeCode: 'choice', columnName: 'scope', isRequired: true, position: 4, description: 'global, module, collection' },
      { code: 'is_system', name: 'System Role', propertyTypeCode: 'boolean', columnName: 'is_system', position: 5, isReadonly: true },
      { code: 'is_active', name: 'Active', propertyTypeCode: 'boolean', columnName: 'is_active', position: 6 },
      { code: 'created_at', name: 'Created', propertyTypeCode: 'datetime', columnName: 'created_at', position: 98, isVisible: false, isReadonly: true },
      { code: 'updated_at', name: 'Updated', propertyTypeCode: 'datetime', columnName: 'updated_at', position: 99, isVisible: false, isReadonly: true },
    ];

    for (const prop of properties) {
      await this.seedProperty(queryRunner, 'roles', prop);
    }
  }

  private async seedGroupProperties(queryRunner: QueryRunner): Promise<void> {
    const properties = [
      { code: 'id', name: 'ID', propertyTypeCode: 'uuid', columnName: 'id', isRequired: true, isUnique: true, position: 0, isVisible: false },
      { code: 'code', name: 'Code', propertyTypeCode: 'text', columnName: 'code', isRequired: true, isUnique: true, position: 1, isSearchable: true },
      { code: 'name', name: 'Name', propertyTypeCode: 'text', columnName: 'name', isRequired: true, position: 2, isSearchable: true },
      { code: 'description', name: 'Description', propertyTypeCode: 'long_text', columnName: 'description', position: 3 },
      { code: 'type', name: 'Type', propertyTypeCode: 'choice', columnName: 'type', isRequired: true, position: 4, description: 'team, department, security' },
      { code: 'parent_id', name: 'Parent Group', propertyTypeCode: 'reference', columnName: 'parent_id', position: 5 },
      { code: 'is_active', name: 'Active', propertyTypeCode: 'boolean', columnName: 'is_active', position: 6 },
      { code: 'created_at', name: 'Created', propertyTypeCode: 'datetime', columnName: 'created_at', position: 98, isVisible: false, isReadonly: true },
      { code: 'updated_at', name: 'Updated', propertyTypeCode: 'datetime', columnName: 'updated_at', position: 99, isVisible: false, isReadonly: true },
    ];

    for (const prop of properties) {
      await this.seedProperty(queryRunner, 'groups', prop);
    }
  }

  private async seedPermissionProperties(queryRunner: QueryRunner): Promise<void> {
    const properties = [
      { code: 'id', name: 'ID', propertyTypeCode: 'uuid', columnName: 'id', isRequired: true, isUnique: true, position: 0, isVisible: false },
      { code: 'code', name: 'Code', propertyTypeCode: 'text', columnName: 'code', isRequired: true, isUnique: true, position: 1, isSearchable: true },
      { code: 'name', name: 'Name', propertyTypeCode: 'text', columnName: 'name', isRequired: true, position: 2, isSearchable: true },
      { code: 'description', name: 'Description', propertyTypeCode: 'long_text', columnName: 'description', position: 3 },
      { code: 'category', name: 'Category', propertyTypeCode: 'text', columnName: 'category', position: 4 },
      { code: 'resource_type', name: 'Resource Type', propertyTypeCode: 'choice', columnName: 'resource_type', position: 5 },
      { code: 'action', name: 'Action', propertyTypeCode: 'choice', columnName: 'action', position: 6, description: 'create, read, update, delete, admin' },
      { code: 'is_system', name: 'System Permission', propertyTypeCode: 'boolean', columnName: 'is_system', position: 7, isReadonly: true },
      { code: 'created_at', name: 'Created', propertyTypeCode: 'datetime', columnName: 'created_at', position: 98, isVisible: false, isReadonly: true },
    ];

    for (const prop of properties) {
      await this.seedProperty(queryRunner, 'permissions', prop);
    }
  }

  private async seedCollectionDefinitionProperties(queryRunner: QueryRunner): Promise<void> {
    const properties = [
      { code: 'id', name: 'ID', propertyTypeCode: 'uuid', columnName: 'id', isRequired: true, isUnique: true, position: 0, isVisible: false },
      { code: 'code', name: 'Code', propertyTypeCode: 'text', columnName: 'code', isRequired: true, isUnique: true, position: 1, isSearchable: true },
      { code: 'name', name: 'Name', propertyTypeCode: 'text', columnName: 'name', isRequired: true, position: 2, isSearchable: true },
      { code: 'plural_name', name: 'Plural Name', propertyTypeCode: 'text', columnName: 'plural_name', position: 3 },
      { code: 'description', name: 'Description', propertyTypeCode: 'long_text', columnName: 'description', position: 4 },
      { code: 'icon', name: 'Icon', propertyTypeCode: 'text', columnName: 'icon', position: 5 },
      { code: 'color', name: 'Color', propertyTypeCode: 'text', columnName: 'color', position: 6, isVisible: false },
      { code: 'table_name', name: 'Table Name', propertyTypeCode: 'text', columnName: 'table_name', isRequired: true, position: 7, isReadonly: true },
      { code: 'owner', name: 'Owner', propertyTypeCode: 'choice', columnName: 'owner', position: 8, isReadonly: true, description: 'system, platform, custom' },
      { code: 'category', name: 'Category', propertyTypeCode: 'text', columnName: 'category', position: 9 },
      { code: 'is_extensible', name: 'Extensible', propertyTypeCode: 'boolean', columnName: 'is_extensible', position: 10 },
      { code: 'is_system', name: 'System', propertyTypeCode: 'boolean', columnName: 'is_system', position: 11, isReadonly: true },
      { code: 'is_active', name: 'Active', propertyTypeCode: 'boolean', columnName: 'is_active', position: 12 },
      { code: 'sync_status', name: 'Sync Status', propertyTypeCode: 'choice', columnName: 'sync_status', position: 13, isReadonly: true },
      { code: 'created_at', name: 'Created', propertyTypeCode: 'datetime', columnName: 'created_at', position: 98, isVisible: false, isReadonly: true },
      { code: 'updated_at', name: 'Updated', propertyTypeCode: 'datetime', columnName: 'updated_at', position: 99, isVisible: false, isReadonly: true },
    ];

    for (const prop of properties) {
      await this.seedProperty(queryRunner, 'collection_definitions', prop);
    }
  }

  private async seedPropertyDefinitionProperties(queryRunner: QueryRunner): Promise<void> {
    const properties = [
      { code: 'id', name: 'ID', propertyTypeCode: 'uuid', columnName: 'id', isRequired: true, isUnique: true, position: 0, isVisible: false },
      { code: 'collection_id', name: 'Collection', propertyTypeCode: 'reference', columnName: 'collection_id', isRequired: true, position: 1 },
      { code: 'code', name: 'Code', propertyTypeCode: 'text', columnName: 'code', isRequired: true, position: 2, isSearchable: true },
      { code: 'name', name: 'Name', propertyTypeCode: 'text', columnName: 'name', isRequired: true, position: 3, isSearchable: true },
      { code: 'description', name: 'Description', propertyTypeCode: 'long_text', columnName: 'description', position: 4 },
      { code: 'property_type_id', name: 'Property Type', propertyTypeCode: 'reference', columnName: 'property_type_id', isRequired: true, position: 5 },
      { code: 'column_name', name: 'Column Name', propertyTypeCode: 'text', columnName: 'column_name', isRequired: true, position: 6, isReadonly: true },
      { code: 'is_required', name: 'Required', propertyTypeCode: 'boolean', columnName: 'is_required', position: 7 },
      { code: 'is_unique', name: 'Unique', propertyTypeCode: 'boolean', columnName: 'is_unique', position: 8 },
      { code: 'is_indexed', name: 'Indexed', propertyTypeCode: 'boolean', columnName: 'is_indexed', position: 9 },
      { code: 'owner', name: 'Owner', propertyTypeCode: 'choice', columnName: 'owner', position: 10, isReadonly: true },
      { code: 'position', name: 'Position', propertyTypeCode: 'integer', columnName: 'position', position: 11 },
      { code: 'is_visible', name: 'Visible', propertyTypeCode: 'boolean', columnName: 'is_visible', position: 12 },
      { code: 'is_readonly', name: 'Read Only', propertyTypeCode: 'boolean', columnName: 'is_readonly', position: 13 },
      { code: 'created_at', name: 'Created', propertyTypeCode: 'datetime', columnName: 'created_at', position: 98, isVisible: false, isReadonly: true },
      { code: 'updated_at', name: 'Updated', propertyTypeCode: 'datetime', columnName: 'updated_at', position: 99, isVisible: false, isReadonly: true },
    ];

    for (const prop of properties) {
      await this.seedProperty(queryRunner, 'property_definitions', prop);
    }
  }
}
