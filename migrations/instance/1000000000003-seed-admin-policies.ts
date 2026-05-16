import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Seed broad admin access policies per canon §28.6 (Plan Fix 33).
 *
 * Grants the admin role unrestricted access to every platform system
 * collection via CollectionAccessRule rows (can_read/create/update/delete=true)
 * and a wildcard PropertyAccessRule per collection (masking_strategy=NONE).
 *
 * After this migration runs, the §28 evaluator handles admin users through
 * the normal rule-evaluation path — no if (ctx.isAdmin) return true bypass
 * in application code.
 *
 * Collection UUIDs are resolved dynamically from metadata.collection_definitions
 * by code so this seed works on fresh installs where the collections are also
 * freshly seeded (migration 0000000000004 must have run first — TypeORM
 * applies migrations in filename order).
 *
 * Idempotent: ON CONFLICT DO NOTHING on every INSERT. The rule_key index on
 * (collection_id, rule_key) prevents duplicate rows on re-run.
 *
 * down() throws — removing these policies would leave the admin role with no
 * access, which is a platform-breaking state. Forward-only is the only safe
 * path per canon §28.6.
 */
export class SeedAdminPolicies1000000000003 implements MigrationInterface {
  // Filename, class suffix, and runtime name all share the `1000000000003`
  // sentinel. Runs after seed-system-collections (1000000000002) so the
  // system collection rows exist when this seed resolves collection UUIDs
  // by code; FK-depends on the admin role UUID from seed-system-roles
  // (1000000000001).
  name = 'SeedAdminPolicies1000000000003';

  /**
   * Canonical list of platform + system collection codes covered by this seed.
   *
   * Mirrors the list in migration 1931100000000-seed-admin-policies.ts.
   * When a new system/platform collection is added, a follow-up migration
   * inserts its rule rather than modifying this list (which is already applied
   * on existing instances via the higher-timestamped migration).
   */
  private readonly SYSTEM_COLLECTION_CODES: readonly string[] = [
    // System (immutable infra)
    'audit_logs',
    'schema_change_log',
    'schema_sync_state',
    // Identity
    'users',
    'roles',
    'groups',
    'permissions',
    'role_permissions',
    'user_roles',
    'group_members',
    'group_roles',
    // Schema engine
    'collection_definitions',
    'property_definitions',
    'property_types',
    'choice_lists',
    'choice_items',
    // Access control
    'collection_access_rules',
    'property_access_rules',
    'access_conditions',
    'access_condition_groups',
    // Settings
    'user_preferences',
    'instance_settings',
    'theme_definitions',
    // Auth
    'auth_settings',
    'auth_events',
    'password_policies',
    'sso_providers',
    // Forms
    'form_definitions',
    'form_versions',
    // Navigation
    'nav_nodes',
    'nav_profiles',
    // Modules
    'modules',
    'module_security',
  ];

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Admin role UUID is fixed by migration 0000000000001-seed-system-roles.ts.
    const adminRoleId = '936009c6-677a-4740-a202-ea00f3fa93c6';

    for (const code of this.SYSTEM_COLLECTION_CODES) {
      // Resolve the collection UUID. Collections may not exist yet if the
      // platform ships a later migration that creates them — skip gracefully
      // so the seed stays idempotent across instance ages.
      const collectionRows: Array<{ id: string }> = await queryRunner.query(
        `SELECT id FROM metadata.collection_definitions WHERE code = $1 LIMIT 1`,
        [code],
      );
      if (!collectionRows || collectionRows.length === 0) {
        continue;
      }
      const collectionId = collectionRows[0].id;
      const collRuleKey = `seed:admin:${code}`;
      const propRuleKey = `seed:admin:wildcard:${code}`;

      // CollectionAccessRule — unconditional full access for the admin role.
      await queryRunner.query(
        `INSERT INTO collection_access_rules
           (id, collection_id, name, description, role_id, group_id, user_id,
            can_read, can_create, can_update, can_delete,
            conditions, priority, is_active, effect, rule_key, metadata)
         VALUES
           (uuid_generate_v4(), $1, $2, $3, $4, NULL, NULL,
            true, true, true, true,
            NULL, 0, true, 'allow', $5, '{}'::jsonb)
         ON CONFLICT DO NOTHING`,
        [
          collectionId,
          `Admin full access — ${code}`,
          `Seeded by 0000000000002 (canon §28.6). Grants the admin role unrestricted access to the ${code} collection.`,
          adminRoleId,
          collRuleKey,
        ],
      );

      // PropertyAccessRule (wildcard) — admin sees unmasked values on all fields.
      await queryRunner.query(
        `INSERT INTO property_access_rules
           (id, property_id, wildcard_collection_id, role_id, group_id, user_id,
            can_read, can_write, conditions, priority, is_active, effect,
            masking_strategy, rule_key, metadata)
         VALUES
           (uuid_generate_v4(), NULL, $1, $2, NULL, NULL,
            true, true, NULL, 0, true, 'allow',
            'NONE', $3, '{}'::jsonb)
         ON CONFLICT DO NOTHING`,
        [collectionId, adminRoleId, propRuleKey],
      );
    }
  }

  public async down(): Promise<void> {
    throw new Error('Seed migration is forward-only');
  }
}
