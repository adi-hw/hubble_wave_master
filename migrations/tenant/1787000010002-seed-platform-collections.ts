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
 *   - Used for: audit_log, schema_change_log, schema_sync_state
 *   - These tables are infrastructure and must never be modified
 * 
 *   PLATFORM (owner = 'platform')
 *   - Base properties are immutable
 *   - Tenants CAN add custom properties with x_ prefix
 *   - Used for: users, roles, teams, permissions, etc.
 *   - Allows customization while protecting core functionality
 * 
 *   CUSTOM (owner = 'custom')
 *   - Full tenant control (create, rename, delete)
 *   - Created by tenants through Studio
 *   - Not seeded here - created dynamically
 * 
 * IMPORTANT:
 * - This migration should run AFTER the base collection_definition table exists
 * - This migration should run AFTER the governance enhancement migration
 * - This uses INSERT ... ON CONFLICT to be idempotent (safe to re-run)
 */
export class SeedPlatformCollections1787000010002 implements MigrationInterface {
  name = 'SeedPlatformCollections1787000010002';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // ═══════════════════════════════════════════════════════════════════════
    // SYSTEM COLLECTIONS (Immutable Infrastructure)
    // ═══════════════════════════════════════════════════════════════════════

    await this.seedCollection(queryRunner, {
      code: 'audit_log',
      label: 'Audit Log',
      labelPlural: 'Audit Logs',
      description: 'Complete audit trail of all system activities for compliance and debugging.',
      icon: 'scroll-text',
      storageTable: 'audit_log',
      owner: 'system',
      category: 'system',
      isSystem: true,
      isExtensible: false,
      supportsHistory: false, // Audit logs don't track their own history
      supportsAttachments: false,
      supportsComments: false,
    });

    await this.seedCollection(queryRunner, {
      code: 'schema_change_log',
      label: 'Schema Change Log',
      labelPlural: 'Schema Change Logs',
      description: 'Audit trail of all schema modifications including DDL statements.',
      icon: 'file-diff',
      storageTable: 'schema_change_log',
      owner: 'system',
      category: 'system',
      isSystem: true,
      isExtensible: false,
      supportsHistory: false,
      supportsAttachments: false,
      supportsComments: false,
    });

    await this.seedCollection(queryRunner, {
      code: 'schema_sync_state',
      label: 'Schema Sync State',
      labelPlural: 'Schema Sync States',
      description: 'Singleton table tracking schema synchronization status and drift detection.',
      icon: 'refresh-cw',
      storageTable: 'schema_sync_state',
      owner: 'system',
      category: 'system',
      isSystem: true,
      isHidden: true, // Internal infrastructure, not shown in Studio
      isExtensible: false,
      supportsHistory: false,
      supportsAttachments: false,
      supportsComments: false,
    });

    // ═══════════════════════════════════════════════════════════════════════
    // PLATFORM COLLECTIONS - Identity & Access
    // ═══════════════════════════════════════════════════════════════════════

    await this.seedCollection(queryRunner, {
      code: 'users',
      label: 'User',
      labelPlural: 'Users',
      description: 'Platform users who can log in and interact with the system.',
      icon: 'user',
      storageTable: 'tenant_user',
      owner: 'platform',
      category: 'identity',
      isSystem: false,
      isExtensible: true,  // Tenants can add x_badge_number, x_department, etc.
      supportsHistory: true,
      supportsAttachments: true,
      supportsComments: true,
    });

    await this.seedCollection(queryRunner, {
      code: 'roles',
      label: 'Role',
      labelPlural: 'Roles',
      description: 'Security roles that define sets of permissions.',
      icon: 'shield',
      storageTable: 'tenant_role',
      owner: 'platform',
      category: 'identity',
      isSystem: false,
      isExtensible: true,
      supportsHistory: true,
      supportsAttachments: false,
      supportsComments: true,
    });

    await this.seedCollection(queryRunner, {
      code: 'teams',
      label: 'Team',
      labelPlural: 'Teams',
      description: 'Groups of users for organizational structure and access control.',
      icon: 'users',
      storageTable: 'tenant_group',
      owner: 'platform',
      category: 'identity',
      isSystem: false,
      isExtensible: true,
      supportsHistory: true,
      supportsAttachments: false,
      supportsComments: true,
    });

    await this.seedCollection(queryRunner, {
      code: 'permissions',
      label: 'Permission',
      labelPlural: 'Permissions',
      description: 'Granular permissions that can be assigned to roles.',
      icon: 'key',
      storageTable: 'permission_definition',
      owner: 'platform',
      category: 'identity',
      isSystem: false,
      isExtensible: false, // Permissions are system-defined
      supportsHistory: true,
      supportsAttachments: false,
      supportsComments: false,
    });

    await this.seedCollection(queryRunner, {
      code: 'role_permissions',
      label: 'Role Permission',
      labelPlural: 'Role Permissions',
      description: 'Junction table linking roles to their permissions.',
      icon: 'link',
      storageTable: 'role_permission',
      owner: 'platform',
      category: 'identity',
      isSystem: false,
      isHidden: true, // Junction table, managed through Role UI
      isExtensible: false,
      supportsHistory: false,
      supportsAttachments: false,
      supportsComments: false,
    });

    await this.seedCollection(queryRunner, {
      code: 'user_roles',
      label: 'User Role',
      labelPlural: 'User Roles',
      description: 'Junction table linking users to their roles.',
      icon: 'link',
      storageTable: 'user_role',
      owner: 'platform',
      category: 'identity',
      isSystem: false,
      isHidden: true,
      isExtensible: false,
      supportsHistory: false,
      supportsAttachments: false,
      supportsComments: false,
    });

    await this.seedCollection(queryRunner, {
      code: 'user_teams',
      label: 'User Team',
      labelPlural: 'User Teams',
      description: 'Junction table linking users to their teams.',
      icon: 'link',
      storageTable: 'user_group',
      owner: 'platform',
      category: 'identity',
      isSystem: false,
      isHidden: true,
      isExtensible: false,
      supportsHistory: false,
      supportsAttachments: false,
      supportsComments: false,
    });

    // ═══════════════════════════════════════════════════════════════════════
    // PLATFORM COLLECTIONS - Schema Engine
    // ═══════════════════════════════════════════════════════════════════════

    await this.seedCollection(queryRunner, {
      code: 'collections',
      label: 'Collection',
      labelPlural: 'Collections',
      description: 'Metadata definitions for data collections (tables).',
      icon: 'database',
      storageTable: 'collection_definition',
      owner: 'platform',
      category: 'schema',
      isSystem: false,
      isExtensible: true, // Can add x_custom_metadata
      supportsHistory: true,
      supportsAttachments: false,
      supportsComments: true,
    });

    await this.seedCollection(queryRunner, {
      code: 'properties',
      label: 'Property',
      labelPlural: 'Properties',
      description: 'Metadata definitions for collection properties (columns).',
      icon: 'columns',
      storageTable: 'property_definition',
      owner: 'platform',
      category: 'schema',
      isSystem: false,
      isExtensible: true,
      supportsHistory: true,
      supportsAttachments: false,
      supportsComments: true,
    });

    await this.seedCollection(queryRunner, {
      code: 'choice_lists',
      label: 'Choice List',
      labelPlural: 'Choice Lists',
      description: 'Reusable lists of choices for dropdown properties.',
      icon: 'list',
      storageTable: 'choice_list',
      owner: 'platform',
      category: 'schema',
      isSystem: false,
      isExtensible: true,
      supportsHistory: true,
      supportsAttachments: false,
      supportsComments: true,
    });

    // ═══════════════════════════════════════════════════════════════════════
    // PLATFORM COLLECTIONS - Access Control
    // ═══════════════════════════════════════════════════════════════════════

    await this.seedCollection(queryRunner, {
      code: 'collection_access_rules',
      label: 'Collection Access Rule',
      labelPlural: 'Collection Access Rules',
      description: 'Row-level security rules for collections.',
      icon: 'shield-check',
      storageTable: 'collection_access_rule',
      owner: 'platform',
      category: 'access',
      isSystem: false,
      isExtensible: false,
      supportsHistory: true,
      supportsAttachments: false,
      supportsComments: true,
    });

    await this.seedCollection(queryRunner, {
      code: 'property_access_rules',
      label: 'Property Access Rule',
      labelPlural: 'Property Access Rules',
      description: 'Field-level security rules for properties.',
      icon: 'shield-check',
      storageTable: 'property_access_rule',
      owner: 'platform',
      category: 'access',
      isSystem: false,
      isExtensible: false,
      supportsHistory: true,
      supportsAttachments: false,
      supportsComments: true,
    });

    // ═══════════════════════════════════════════════════════════════════════
    // PLATFORM COLLECTIONS - Automation
    // ═══════════════════════════════════════════════════════════════════════

    await this.seedCollection(queryRunner, {
      code: 'automations',
      label: 'Automation',
      labelPlural: 'Automations',
      description: 'Server-side automation rules triggered by data changes.',
      icon: 'zap',
      storageTable: 'automation_rule',
      owner: 'platform',
      category: 'automation',
      isSystem: false,
      isExtensible: true,
      supportsHistory: true,
      supportsAttachments: false,
      supportsComments: true,
    });

    await this.seedCollection(queryRunner, {
      code: 'display_rules',
      label: 'Display Rule',
      labelPlural: 'Display Rules',
      description: 'Client-side rules that control field visibility and behavior.',
      icon: 'eye',
      storageTable: 'display_rule',
      owner: 'platform',
      category: 'automation',
      isSystem: false,
      isExtensible: false,
      supportsHistory: true,
      supportsAttachments: false,
      supportsComments: true,
    });

    await this.seedCollection(queryRunner, {
      code: 'flows',
      label: 'Flow',
      labelPlural: 'Flows',
      description: 'Visual workflow definitions for multi-step processes.',
      icon: 'git-branch',
      storageTable: 'flow_definition',
      owner: 'platform',
      category: 'automation',
      isSystem: false,
      isExtensible: true,
      supportsHistory: true,
      supportsAttachments: false,
      supportsComments: true,
    });

    await this.seedCollection(queryRunner, {
      code: 'scheduled_jobs',
      label: 'Scheduled Job',
      labelPlural: 'Scheduled Jobs',
      description: 'Cron-based scheduled automation tasks.',
      icon: 'clock',
      storageTable: 'scheduled_job',
      owner: 'platform',
      category: 'automation',
      isSystem: false,
      isExtensible: true,
      supportsHistory: true,
      supportsAttachments: false,
      supportsComments: true,
    });

    // ═══════════════════════════════════════════════════════════════════════
    // PLATFORM COLLECTIONS - Views
    // ═══════════════════════════════════════════════════════════════════════

    await this.seedCollection(queryRunner, {
      code: 'views',
      label: 'View',
      labelPlural: 'Views',
      description: 'Saved view configurations for displaying collection data.',
      icon: 'layout',
      storageTable: 'view_definition',
      owner: 'platform',
      category: 'views',
      isSystem: false,
      isExtensible: true,
      supportsHistory: true,
      supportsAttachments: false,
      supportsComments: true,
    });

    await this.seedCollection(queryRunner, {
      code: 'user_view_preferences',
      label: 'User View Preference',
      labelPlural: 'User View Preferences',
      description: 'Per-user customizations of views.',
      icon: 'sliders',
      storageTable: 'user_view_preference',
      owner: 'platform',
      category: 'views',
      isSystem: false,
      isHidden: true, // Managed automatically
      isExtensible: false,
      supportsHistory: false,
      supportsAttachments: false,
      supportsComments: false,
    });

    // ═══════════════════════════════════════════════════════════════════════
    // PLATFORM COLLECTIONS - Notifications
    // ═══════════════════════════════════════════════════════════════════════

    await this.seedCollection(queryRunner, {
      code: 'notification_templates',
      label: 'Notification Template',
      labelPlural: 'Notification Templates',
      description: 'Templates for email, in-app, and push notifications.',
      icon: 'mail',
      storageTable: 'notification_template',
      owner: 'platform',
      category: 'notifications',
      isSystem: false,
      isExtensible: true,
      supportsHistory: true,
      supportsAttachments: true,
      supportsComments: true,
    });

    await this.seedCollection(queryRunner, {
      code: 'notification_rules',
      label: 'Notification Rule',
      labelPlural: 'Notification Rules',
      description: 'Rules that trigger notifications based on events.',
      icon: 'bell',
      storageTable: 'notification_rule',
      owner: 'platform',
      category: 'notifications',
      isSystem: false,
      isExtensible: false,
      supportsHistory: true,
      supportsAttachments: false,
      supportsComments: true,
    });

    await this.seedCollection(queryRunner, {
      code: 'notifications',
      label: 'Notification',
      labelPlural: 'Notifications',
      description: 'Delivered notification records.',
      icon: 'inbox',
      storageTable: 'notification_delivery',
      owner: 'platform',
      category: 'notifications',
      isSystem: false,
      isExtensible: false,
      supportsHistory: false,
      supportsAttachments: false,
      supportsComments: false,
    });

    // ═══════════════════════════════════════════════════════════════════════
    // PLATFORM COLLECTIONS - Events
    // ═══════════════════════════════════════════════════════════════════════

    await this.seedCollection(queryRunner, {
      code: 'events',
      label: 'Event Definition',
      labelPlural: 'Event Definitions',
      description: 'Custom event types that can be raised and subscribed to.',
      icon: 'radio',
      storageTable: 'event_definition',
      owner: 'platform',
      category: 'events',
      isSystem: false,
      isExtensible: true,
      supportsHistory: true,
      supportsAttachments: false,
      supportsComments: true,
    });

    await this.seedCollection(queryRunner, {
      code: 'event_log',
      label: 'Event Log',
      labelPlural: 'Event Logs',
      description: 'Log of all raised events for debugging and replay.',
      icon: 'activity',
      storageTable: 'event_log',
      owner: 'platform',
      category: 'events',
      isSystem: false,
      isExtensible: false,
      supportsHistory: false,
      supportsAttachments: false,
      supportsComments: false,
    });

    // ═══════════════════════════════════════════════════════════════════════
    // PLATFORM COLLECTIONS - Integrations
    // ═══════════════════════════════════════════════════════════════════════

    await this.seedCollection(queryRunner, {
      code: 'connections',
      label: 'Connection',
      labelPlural: 'Connections',
      description: 'External system connection configurations.',
      icon: 'plug',
      storageTable: 'connection_definition',
      owner: 'platform',
      category: 'integrations',
      isSystem: false,
      isExtensible: true,
      supportsHistory: true,
      supportsAttachments: false,
      supportsComments: true,
    });

    // ═══════════════════════════════════════════════════════════════════════
    // PLATFORM COLLECTIONS - Settings & Preferences
    // ═══════════════════════════════════════════════════════════════════════

    await this.seedCollection(queryRunner, {
      code: 'user_preferences',
      label: 'User Preference',
      labelPlural: 'User Preferences',
      description: 'Per-user settings like theme, density, and locale.',
      icon: 'settings',
      storageTable: 'user_preference',
      owner: 'platform',
      category: 'settings',
      isSystem: false,
      isHidden: true,
      isExtensible: true, // Can add x_custom_prefs
      supportsHistory: false,
      supportsAttachments: false,
      supportsComments: false,
    });

    await this.seedCollection(queryRunner, {
      code: 'workspace_settings',
      label: 'Workspace Setting',
      labelPlural: 'Workspace Settings',
      description: 'Tenant-wide configuration settings.',
      icon: 'building',
      storageTable: 'tenant_setting',
      owner: 'platform',
      category: 'settings',
      isSystem: false,
      isExtensible: true,
      supportsHistory: true,
      supportsAttachments: false,
      supportsComments: false,
    });

    // ═══════════════════════════════════════════════════════════════════════
    // PLATFORM COLLECTIONS - Commitments (SLA/OLA)
    // ═══════════════════════════════════════════════════════════════════════

    await this.seedCollection(queryRunner, {
      code: 'commitments',
      label: 'Commitment',
      labelPlural: 'Commitments',
      description: 'SLA/OLA definitions with response and resolution targets.',
      icon: 'timer',
      storageTable: 'commitment_definition',
      owner: 'platform',
      category: 'commitments',
      isSystem: false,
      isExtensible: true,
      supportsHistory: true,
      supportsAttachments: false,
      supportsComments: true,
    });

    await this.seedCollection(queryRunner, {
      code: 'business_schedules',
      label: 'Business Schedule',
      labelPlural: 'Business Schedules',
      description: 'Work hour definitions for SLA calculations.',
      icon: 'calendar',
      storageTable: 'business_schedule',
      owner: 'platform',
      category: 'commitments',
      isSystem: false,
      isExtensible: false,
      supportsHistory: true,
      supportsAttachments: false,
      supportsComments: true,
    });

    await this.seedCollection(queryRunner, {
      code: 'holidays',
      label: 'Holiday',
      labelPlural: 'Holidays',
      description: 'Holiday calendar for SLA pause calculations.',
      icon: 'gift',
      storageTable: 'holiday_calendar',
      owner: 'platform',
      category: 'commitments',
      isSystem: false,
      isExtensible: false,
      supportsHistory: true,
      supportsAttachments: false,
      supportsComments: false,
    });

    // ═══════════════════════════════════════════════════════════════════════
    // Now seed the properties for key collections
    // ═══════════════════════════════════════════════════════════════════════

    await this.seedUserProperties(queryRunner);
    await this.seedRoleProperties(queryRunner);
    await this.seedTeamProperties(queryRunner);
    await this.seedCollectionProperties(queryRunner);
    await this.seedPropertyProperties(queryRunner);

    // Log completion
    console.log('✅ Platform collections seeded successfully');
    console.log('   - System collections: 3');
    console.log('   - Platform collections: 28');
    console.log('   - Properties seeded for: users, roles, teams, collections, properties');
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Delete properties first (foreign key constraint)
    await queryRunner.query(`
      DELETE FROM property_definition 
      WHERE collection_id IN (
        SELECT id FROM collection_definition WHERE owner IN ('system', 'platform')
      )
    `);

    // Delete seeded collections
    await queryRunner.query(`
      DELETE FROM collection_definition 
      WHERE owner IN ('system', 'platform')
    `);

    console.log('✅ Platform collections removed');
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // Helper Methods
  // ═══════════════════════════════════════════════════════════════════════════

  private async seedCollection(
    queryRunner: QueryRunner,
    data: {
      code: string;
      label: string;
      labelPlural: string;
      description: string;
      icon: string;
      storageTable: string;
      owner: 'system' | 'platform';
      category: string;
      isSystem: boolean;
      isHidden?: boolean;
      isExtensible: boolean;
      supportsHistory: boolean;
      supportsAttachments: boolean;
      supportsComments: boolean;
    },
  ): Promise<void> {
    await queryRunner.query(`
      INSERT INTO collection_definition (
        code, label, label_plural, description, icon,
        storage_table, storage_schema, owner, category,
        is_system, is_hidden, is_extensible, is_locked,
        supports_history, supports_attachments, supports_comments,
        sync_status, created_at, updated_at
      ) VALUES (
        $1, $2, $3, $4, $5,
        $6, 'public', $7::schema_owner, $8,
        $9, $10, $11, true,
        $12, $13, $14,
        'synced', NOW(), NOW()
      )
      ON CONFLICT (code) DO UPDATE SET
        label = EXCLUDED.label,
        label_plural = EXCLUDED.label_plural,
        description = EXCLUDED.description,
        icon = EXCLUDED.icon,
        owner = EXCLUDED.owner,
        category = EXCLUDED.category,
        is_system = EXCLUDED.is_system,
        is_hidden = EXCLUDED.is_hidden,
        is_extensible = EXCLUDED.is_extensible,
        updated_at = NOW()
    `, [
      data.code,
      data.label,
      data.labelPlural,
      data.description,
      data.icon,
      data.storageTable,
      data.owner,
      data.category,
      data.isSystem,
      data.isHidden ?? false,
      data.isExtensible,
      data.supportsHistory,
      data.supportsAttachments,
      data.supportsComments,
    ]);
  }

  private async seedProperty(
    queryRunner: QueryRunner,
    collectionCode: string,
    data: {
      code: string;
      label: string;
      description?: string;
      dataType: string;
      uiWidget?: string;
      storageColumn: string;
      storageType: string;
      isRequired?: boolean;
      isUnique?: boolean;
      displayOrder: number;
      showInGrid?: boolean;
      showInDetail?: boolean;
    },
  ): Promise<void> {
    await queryRunner.query(`
      INSERT INTO property_definition (
        collection_id, code, label, description,
        data_type, ui_widget, storage_column, storage_type,
        is_required, is_unique, is_system,
        owner, sync_status, is_locked,
        display_order, show_in_grid, show_in_detail, show_in_create,
        created_at, updated_at
      )
      SELECT
        c.id,
        $2, $3, $4,
        $5, $6, $7, $8,
        $9, $10, true,
        c.owner, 'synced', true,
        $11, $12, $13, true,
        NOW(), NOW()
      FROM collection_definition c
      WHERE c.code = $1
      ON CONFLICT (collection_id, code) DO UPDATE SET
        label = EXCLUDED.label,
        description = EXCLUDED.description,
        ui_widget = EXCLUDED.ui_widget,
        display_order = EXCLUDED.display_order,
        show_in_grid = EXCLUDED.show_in_grid,
        show_in_detail = EXCLUDED.show_in_detail,
        updated_at = NOW()
    `, [
      collectionCode,
      data.code,
      data.label,
      data.description ?? null,
      data.dataType,
      data.uiWidget ?? this.getDefaultWidget(data.dataType),
      data.storageColumn,
      data.storageType,
      data.isRequired ?? false,
      data.isUnique ?? false,
      data.displayOrder,
      data.showInGrid ?? true,
      data.showInDetail ?? true,
    ]);
  }

  private getDefaultWidget(dataType: string): string {
    const map: Record<string, string> = {
      'text': 'text-input',
      'long_text': 'textarea',
      'email': 'email-input',
      'phone': 'phone-input',
      'url': 'url-input',
      'number': 'number-input',
      'integer': 'number-input',
      'boolean': 'toggle',
      'date': 'date-picker',
      'datetime': 'datetime-picker',
      'reference': 'reference-picker',
      'choice': 'select',
      'multi_choice': 'multi-select',
      'json': 'json-editor',
      'uuid': 'text-input',
    };
    return map[dataType] || 'text-input';
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // Property Definitions for Core Collections
  // ═══════════════════════════════════════════════════════════════════════════

  private async seedUserProperties(queryRunner: QueryRunner): Promise<void> {
    const properties = [
      { code: 'id', label: 'ID', dataType: 'uuid', storageColumn: 'id', storageType: 'uuid', isRequired: true, isUnique: true, displayOrder: 0, showInGrid: false },
      { code: 'email', label: 'Email', dataType: 'email', storageColumn: 'email', storageType: 'varchar', isRequired: true, isUnique: true, displayOrder: 1 },
      { code: 'first_name', label: 'First Name', dataType: 'text', storageColumn: 'first_name', storageType: 'varchar', isRequired: true, displayOrder: 2 },
      { code: 'last_name', label: 'Last Name', dataType: 'text', storageColumn: 'last_name', storageType: 'varchar', isRequired: true, displayOrder: 3 },
      { code: 'display_name', label: 'Display Name', dataType: 'text', storageColumn: 'display_name', storageType: 'varchar', displayOrder: 4, description: 'Computed or custom display name' },
      { code: 'avatar_url', label: 'Avatar', dataType: 'url', uiWidget: 'avatar', storageColumn: 'avatar_url', storageType: 'varchar', displayOrder: 5, showInGrid: false },
      { code: 'phone', label: 'Phone', dataType: 'phone', storageColumn: 'phone', storageType: 'varchar', displayOrder: 6, showInGrid: false },
      { code: 'timezone', label: 'Timezone', dataType: 'choice', storageColumn: 'timezone', storageType: 'varchar', displayOrder: 7, showInGrid: false },
      { code: 'locale', label: 'Locale', dataType: 'choice', storageColumn: 'locale', storageType: 'varchar', displayOrder: 8, showInGrid: false },
      { code: 'status', label: 'Status', dataType: 'choice', storageColumn: 'status', storageType: 'varchar', isRequired: true, displayOrder: 9, description: 'active, inactive, invited, suspended' },
      { code: 'last_login_at', label: 'Last Login', dataType: 'datetime', storageColumn: 'last_login_at', storageType: 'timestamptz', displayOrder: 10, showInDetail: true },
      { code: 'created_at', label: 'Created', dataType: 'datetime', storageColumn: 'created_at', storageType: 'timestamptz', displayOrder: 98, showInGrid: false },
      { code: 'updated_at', label: 'Updated', dataType: 'datetime', storageColumn: 'updated_at', storageType: 'timestamptz', displayOrder: 99, showInGrid: false },
    ];

    for (const prop of properties) {
      await this.seedProperty(queryRunner, 'users', prop);
    }
  }

  private async seedRoleProperties(queryRunner: QueryRunner): Promise<void> {
    const properties = [
      { code: 'id', label: 'ID', dataType: 'uuid', storageColumn: 'id', storageType: 'uuid', isRequired: true, isUnique: true, displayOrder: 0, showInGrid: false },
      { code: 'code', label: 'Code', dataType: 'text', storageColumn: 'code', storageType: 'varchar', isRequired: true, isUnique: true, displayOrder: 1, description: 'Internal identifier' },
      { code: 'name', label: 'Name', dataType: 'text', storageColumn: 'name', storageType: 'varchar', isRequired: true, displayOrder: 2 },
      { code: 'description', label: 'Description', dataType: 'long_text', storageColumn: 'description', storageType: 'text', displayOrder: 3, showInGrid: false },
      { code: 'parent_role_id', label: 'Inherits From', dataType: 'reference', uiWidget: 'reference-picker', storageColumn: 'parent_role_id', storageType: 'uuid', displayOrder: 4, description: 'Parent role for permission inheritance' },
      { code: 'is_system', label: 'System Role', dataType: 'boolean', storageColumn: 'is_system', storageType: 'boolean', displayOrder: 5, description: 'System roles cannot be deleted' },
      { code: 'is_active', label: 'Active', dataType: 'boolean', storageColumn: 'is_active', storageType: 'boolean', displayOrder: 6 },
      { code: 'created_at', label: 'Created', dataType: 'datetime', storageColumn: 'created_at', storageType: 'timestamptz', displayOrder: 98, showInGrid: false },
      { code: 'updated_at', label: 'Updated', dataType: 'datetime', storageColumn: 'updated_at', storageType: 'timestamptz', displayOrder: 99, showInGrid: false },
    ];

    for (const prop of properties) {
      await this.seedProperty(queryRunner, 'roles', prop);
    }
  }

  private async seedTeamProperties(queryRunner: QueryRunner): Promise<void> {
    const properties = [
      { code: 'id', label: 'ID', dataType: 'uuid', storageColumn: 'id', storageType: 'uuid', isRequired: true, isUnique: true, displayOrder: 0, showInGrid: false },
      { code: 'code', label: 'Code', dataType: 'text', storageColumn: 'code', storageType: 'varchar', isRequired: true, isUnique: true, displayOrder: 1 },
      { code: 'name', label: 'Name', dataType: 'text', storageColumn: 'name', storageType: 'varchar', isRequired: true, displayOrder: 2 },
      { code: 'description', label: 'Description', dataType: 'long_text', storageColumn: 'description', storageType: 'text', displayOrder: 3, showInGrid: false },
      { code: 'parent_team_id', label: 'Parent Team', dataType: 'reference', uiWidget: 'reference-picker', storageColumn: 'parent_group_id', storageType: 'uuid', displayOrder: 4, description: 'For hierarchical team structures' },
      { code: 'manager_id', label: 'Manager', dataType: 'reference', uiWidget: 'user-picker', storageColumn: 'manager_id', storageType: 'uuid', displayOrder: 5 },
      { code: 'email', label: 'Team Email', dataType: 'email', storageColumn: 'email', storageType: 'varchar', displayOrder: 6, showInGrid: false },
      { code: 'is_active', label: 'Active', dataType: 'boolean', storageColumn: 'is_active', storageType: 'boolean', displayOrder: 7 },
      { code: 'created_at', label: 'Created', dataType: 'datetime', storageColumn: 'created_at', storageType: 'timestamptz', displayOrder: 98, showInGrid: false },
      { code: 'updated_at', label: 'Updated', dataType: 'datetime', storageColumn: 'updated_at', storageType: 'timestamptz', displayOrder: 99, showInGrid: false },
    ];

    for (const prop of properties) {
      await this.seedProperty(queryRunner, 'teams', prop);
    }
  }

  private async seedCollectionProperties(queryRunner: QueryRunner): Promise<void> {
    const properties = [
      { code: 'id', label: 'ID', dataType: 'uuid', storageColumn: 'id', storageType: 'uuid', isRequired: true, isUnique: true, displayOrder: 0, showInGrid: false },
      { code: 'code', label: 'Code', dataType: 'text', storageColumn: 'code', storageType: 'varchar', isRequired: true, isUnique: true, displayOrder: 1, description: 'Internal identifier (snake_case)' },
      { code: 'label', label: 'Label', dataType: 'text', storageColumn: 'label', storageType: 'varchar', isRequired: true, displayOrder: 2 },
      { code: 'label_plural', label: 'Plural Label', dataType: 'text', storageColumn: 'label_plural', storageType: 'varchar', displayOrder: 3 },
      { code: 'description', label: 'Description', dataType: 'long_text', storageColumn: 'description', storageType: 'text', displayOrder: 4, showInGrid: false },
      { code: 'icon', label: 'Icon', dataType: 'text', uiWidget: 'icon-picker', storageColumn: 'icon', storageType: 'varchar', displayOrder: 5 },
      { code: 'color', label: 'Color', dataType: 'text', uiWidget: 'color-picker', storageColumn: 'color', storageType: 'varchar', displayOrder: 6, showInGrid: false },
      { code: 'storage_table', label: 'Storage Table', dataType: 'text', storageColumn: 'storage_table', storageType: 'varchar', isRequired: true, displayOrder: 7, showInGrid: false },
      { code: 'owner', label: 'Owner', dataType: 'choice', storageColumn: 'owner', storageType: 'varchar', displayOrder: 8, description: 'system, platform, or custom' },
      { code: 'category', label: 'Category', dataType: 'text', storageColumn: 'category', storageType: 'varchar', displayOrder: 9 },
      { code: 'is_extensible', label: 'Extensible', dataType: 'boolean', storageColumn: 'is_extensible', storageType: 'boolean', displayOrder: 10, showInGrid: false },
      { code: 'is_system', label: 'System', dataType: 'boolean', storageColumn: 'is_system', storageType: 'boolean', displayOrder: 11 },
      { code: 'sync_status', label: 'Sync Status', dataType: 'choice', storageColumn: 'sync_status', storageType: 'varchar', displayOrder: 12 },
      { code: 'created_at', label: 'Created', dataType: 'datetime', storageColumn: 'created_at', storageType: 'timestamptz', displayOrder: 98, showInGrid: false },
      { code: 'updated_at', label: 'Updated', dataType: 'datetime', storageColumn: 'updated_at', storageType: 'timestamptz', displayOrder: 99, showInGrid: false },
    ];

    for (const prop of properties) {
      await this.seedProperty(queryRunner, 'collections', prop);
    }
  }

  private async seedPropertyProperties(queryRunner: QueryRunner): Promise<void> {
    const properties = [
      { code: 'id', label: 'ID', dataType: 'uuid', storageColumn: 'id', storageType: 'uuid', isRequired: true, isUnique: true, displayOrder: 0, showInGrid: false },
      { code: 'collection_id', label: 'Collection', dataType: 'reference', uiWidget: 'reference-picker', storageColumn: 'collection_id', storageType: 'uuid', isRequired: true, displayOrder: 1 },
      { code: 'code', label: 'Code', dataType: 'text', storageColumn: 'code', storageType: 'varchar', isRequired: true, displayOrder: 2, description: 'Internal identifier (snake_case)' },
      { code: 'label', label: 'Label', dataType: 'text', storageColumn: 'label', storageType: 'varchar', isRequired: true, displayOrder: 3 },
      { code: 'description', label: 'Description', dataType: 'long_text', storageColumn: 'description', storageType: 'text', displayOrder: 4, showInGrid: false },
      { code: 'data_type', label: 'Data Type', dataType: 'choice', storageColumn: 'data_type', storageType: 'varchar', isRequired: true, displayOrder: 5 },
      { code: 'ui_widget', label: 'UI Widget', dataType: 'choice', storageColumn: 'ui_widget', storageType: 'varchar', displayOrder: 6 },
      { code: 'storage_column', label: 'Storage Column', dataType: 'text', storageColumn: 'storage_column', storageType: 'varchar', displayOrder: 7, showInGrid: false },
      { code: 'is_required', label: 'Required', dataType: 'boolean', storageColumn: 'is_required', storageType: 'boolean', displayOrder: 8 },
      { code: 'is_unique', label: 'Unique', dataType: 'boolean', storageColumn: 'is_unique', storageType: 'boolean', displayOrder: 9, showInGrid: false },
      { code: 'owner', label: 'Owner', dataType: 'choice', storageColumn: 'owner', storageType: 'varchar', displayOrder: 10 },
      { code: 'display_order', label: 'Display Order', dataType: 'integer', storageColumn: 'display_order', storageType: 'integer', displayOrder: 11, showInGrid: false },
      { code: 'show_in_grid', label: 'Show in Grid', dataType: 'boolean', storageColumn: 'show_in_grid', storageType: 'boolean', displayOrder: 12, showInGrid: false },
      { code: 'show_in_detail', label: 'Show in Detail', dataType: 'boolean', storageColumn: 'show_in_detail', storageType: 'boolean', displayOrder: 13, showInGrid: false },
      { code: 'created_at', label: 'Created', dataType: 'datetime', storageColumn: 'created_at', storageType: 'timestamptz', displayOrder: 98, showInGrid: false },
      { code: 'updated_at', label: 'Updated', dataType: 'datetime', storageColumn: 'updated_at', storageType: 'timestamptz', displayOrder: 99, showInGrid: false },
    ];

    for (const prop of properties) {
      await this.seedProperty(queryRunner, 'properties', prop);
    }
  }
}
