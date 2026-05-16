import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Seed the two structural platform roles.
 *
 *   admin         — bootstrap operator / platform administrator. Receives broad
 *                   CollectionAccessRule + wildcard PropertyAccessRule grants
 *                   on every system collection via seed-admin-policies (the
 *                   next migration). Per canon §28.6 (Plan Fix 33), the §28
 *                   evaluator handles admin uniformly — no `if (ctx.isAdmin)
 *                   return true` bypass in application code.
 *
 *   platform_user — baseline authorization role for any authenticated platform
 *                   member. `is_default = true`; new users receive this role
 *                   on first sign-in. Distinguished from the auth-state label
 *                   `@AuthenticatedOnly()` (which only checks JWT validity)
 *                   because platform_user is an assignable `user_roles` row
 *                   that Stream 2 grants registry-backed permissions to.
 *
 * Application personas (`auditor`, `manager`, `technician`, `viewer`) are
 * NOT seeded here. They imply persona models the platform has not built; they
 * ship with the wave that introduces those personas, not with the structural
 * baseline.
 *
 * `identity.platform_permissions` and `identity.role_permissions` are NOT
 * touched in this migration. Per W2 spec §2.3, the `PERMISSION_REGISTRY`
 * TypeScript constant at `libs/permission-registry/src/lib/registry.ts` is
 * the single source of truth for those tables, materialized by
 * `scripts/seed-permission-registry-sync.ts` in Stream 2 PR3. Admin authority
 * during the Pre-W2 → Stream 2 window lives entirely in CollectionAccessRule +
 * PropertyAccessRule (see migration 1000000000003-seed-admin-policies).
 *
 * UUIDs are fixed so downstream migrations (admin policies, future seeds) can
 * FK-reference these roles deterministically.
 *
 * Idempotent: ON CONFLICT (code) DO NOTHING. Re-running this migration on an
 * existing DB is a no-op.
 *
 * down() throws — roles are foundational structural data; removing them would
 * cascade-delete access rules and user assignments. Forward-only.
 */
export class SeedSystemRoles1000000000001 implements MigrationInterface {
  // Filename, class suffix, and runtime name all share the same 1e12 sentinel.
  // TypeORM sorts by parseInt(name.substr(-13), 10) — `1000000000001` follows
  // the baseline (`1000000000000`) and precedes seed-system-collections
  // (`1000000000002`), which is the FK-dependency-correct application order.
  name = 'SeedSystemRoles1000000000001';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      INSERT INTO identity.roles
        (id, code, name, description, is_system, is_active, is_default,
         scope, hierarchy_level, weight, metadata)
      VALUES
        ('936009c6-677a-4740-a202-ea00f3fa93c6',
         'admin',         'Administrator',
         'Bootstrap operator / platform administrator',
         true,  true, false, 'global', 0, 0, '{}'),
        ('b9c54a3e-7d2f-4f8a-9c5e-8f1a2b3c4d5e',
         'platform_user', 'Platform User',
         'Baseline authenticated platform member',
         true,  true, true,  'global', 0, 0, '{}')
      ON CONFLICT (code) DO NOTHING;
    `);
  }

  public async down(): Promise<void> {
    throw new Error('Seed migration is forward-only');
  }
}
