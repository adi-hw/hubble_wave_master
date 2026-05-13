import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Seed broad admin policies per canon §28.6 (Plan Fix 33).
 *
 * Replaces the silent `if (ctx.isAdmin) return true` bypass in the §28
 * evaluator with explicit access rules. The `admin` role gets
 * `can_read/can_create/can_update/can_delete = true` on every platform +
 * system collection, plus a wildcard `PropertyAccessRule` per collection
 * (`property_id IS NULL`, `wildcard_collection_id = <collection_id>`) that
 * grants `can_read = true` and `can_write = true` with masking strategy NONE.
 *
 * After this migration runs, the §28 evaluator handles admin users through
 * the normal rule-evaluation path — no special-casing in application code.
 * `ctx.isAdmin` may still be present on the RequestContext as a UI/audit hint,
 * but it does NOT drive the authorization decision any more.
 *
 * Idempotent: INSERT … ON CONFLICT DO NOTHING for every row. The `rule_key`
 * column carries `'seed:admin:<collection_code>'` for each collection rule and
 * `'seed:admin:wildcard:<collection_code>'` for each wildcard property rule.
 * The unique partial index on `(collection_id, rule_key)` from migration
 * 1820000000000-access-policy-metadata.ts prevents duplicates on re-run.
 *
 * Down: removes the seeded rows by rule_key. The bypass is NOT re-added on
 * rollback — operators who roll back this migration accept that admin loses
 * access until the policies are re-seeded. Forward-only is the recommended
 * path per canon §28.6.
 */
export class SeedAdminPolicies1931100000000 implements MigrationInterface {
  name = 'SeedAdminPolicies1931100000000';

  /**
   * Canonical list of system + platform collection codes covered by the seed.
   *
   * These correspond to the `code` values inserted by
   * `1787000010002-seed-platform-collections.ts` and their equivalents in
   * subsequent platform migrations. Custom (customer-defined) collections are
   * NOT listed here — customer packs own their own access policy rows.
   *
   * When a new system/platform collection is added to the platform, a follow-up
   * migration should insert a new rule_key row for the admin role rather than
   * modifying this list (which is already applied on existing instances).
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
    // Resolve the admin role id. The role is seeded by
    // 1817999999999-seed-admin-role.ts; this migration runs after it.
    const adminRoleRows = await queryRunner.query(
      `SELECT id FROM roles WHERE code = 'admin' AND is_system = true LIMIT 1`,
    );
    if (!adminRoleRows || adminRoleRows.length === 0) {
      throw new Error(
        'SeedAdminPolicies1931100000000: admin role (code=admin, is_system=true) not found. ' +
        'Ensure 1817999999999-seed-admin-role.ts ran before this migration.',
      );
    }
    const adminRoleId: string = adminRoleRows[0].id;

    for (const code of this.SYSTEM_COLLECTION_CODES) {
      // Resolve collection UUID. Collections are seeded by
      // 1787000010002-seed-platform-collections.ts and subsequent migrations.
      // If the collection row does not exist yet on this instance (e.g. it was
      // added in a later migration that has not run) we skip rather than fail,
      // so the migration stays idempotent across instance ages.
      const collectionRows = await queryRunner.query(
        `SELECT id FROM collection_definitions WHERE code = $1 LIMIT 1`,
        [code],
      );
      if (!collectionRows || collectionRows.length === 0) {
        continue;
      }
      const collectionId: string = collectionRows[0].id;
      const collRuleKey = `seed:admin:${code}`;
      const propRuleKey = `seed:admin:wildcard:${code}`;

      // -----------------------------------------------------------------------
      // CollectionAccessRule — grants canRead/canCreate/canUpdate/canDelete for
      // the admin role on this collection. effect='allow', no conditions (the
      // admin policy is unconditional — a conditional deny authored by an
      // operator later will override it per §28.4 rule 1).
      // -----------------------------------------------------------------------
      await queryRunner.query(
        `INSERT INTO collection_access_rules
           (id, collection_id, name, description, role_id, group_id, user_id,
            can_read, can_create, can_update, can_delete,
            conditions, priority, is_active, effect, rule_key, metadata,
            created_at, updated_at)
         VALUES
           (uuid_generate_v4(), $1, $2, $3, $4, NULL, NULL,
            true, true, true, true,
            NULL, 0, true, 'allow', $5, '{}'::jsonb,
            NOW(), NOW())
         ON CONFLICT DO NOTHING`,
        [
          collectionId,
          `Admin full access — ${code}`,
          `Seeded by Plan Fix 33 (canon §28.6). Grants the admin role unrestricted access to the ${code} collection.`,
          adminRoleId,
          collRuleKey,
        ],
      );

      // -----------------------------------------------------------------------
      // PropertyAccessRule (wildcard) — grants canRead/canWrite for the admin
      // role on ALL fields of this collection. property_id IS NULL signals a
      // wildcard rule per migration 1930200000000 (§28.2 levels 3-4).
      // masking_strategy = 'NONE' — admins see unmasked values.
      // -----------------------------------------------------------------------
      await queryRunner.query(
        `INSERT INTO property_access_rules
           (id, property_id, wildcard_collection_id, role_id, group_id, user_id,
            can_read, can_write, conditions, priority, is_active, effect,
            masking_strategy, rule_key, metadata,
            created_at, updated_at)
         VALUES
           (uuid_generate_v4(), NULL, $1, $2, NULL, NULL,
            true, true, NULL, 0, true, 'allow',
            'NONE', $3, '{}'::jsonb,
            NOW(), NOW())
         ON CONFLICT DO NOTHING`,
        [collectionId, adminRoleId, propRuleKey],
      );
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Remove the seeded collection rules.
    const collRuleKeys = this.SYSTEM_COLLECTION_CODES.map(c => `seed:admin:${c}`);
    await queryRunner.query(
      `DELETE FROM collection_access_rules WHERE rule_key = ANY($1::text[])`,
      [collRuleKeys],
    );

    // Remove the seeded wildcard property rules.
    const propRuleKeys = this.SYSTEM_COLLECTION_CODES.map(c => `seed:admin:wildcard:${c}`);
    await queryRunner.query(
      `DELETE FROM property_access_rules WHERE rule_key = ANY($1::text[])`,
      [propRuleKeys],
    );

    // The admin bypass in application code is NOT restored on down().
    // Operators who roll back this migration accept that admin users will
    // be denied by the §28 default-deny until policies are re-seeded.
    // Forward-only migration is the recommended path per canon §28.6.
  }
}
