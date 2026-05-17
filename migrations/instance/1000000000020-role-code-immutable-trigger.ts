import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Role.code immutability trigger (W2 Stream 1 PR5 / canon §28.6).
 *
 * Role codes (`identity.roles.code`) are the stable identifiers RBAC seed
 * migrations, `@Roles('admin')` decorators, and operator runbooks all key
 * against. If an operator (or a buggy code path) renames an admin role
 * from `admin` to `administrator`, every `@Roles('admin')` guard quietly
 * stops matching and the bearer keeps their access token's stale
 * `roleCodes` claim until it expires — a silent authorization regression.
 *
 * Canon §28.6 (admin policy seeded by code) and the seed migrations
 * `1000000000001-seed-system-roles.ts` + `1000000000003-seed-admin-
 * policies.ts` both treat the code column as a primary join key. Renaming
 * is therefore architecturally forbidden — the entity-level `update:
 * false` is the soft block this PR also lands, and this trigger is the
 * authoritative DB-level block that catches every code path (raw SQL,
 * psql sessions, third-party tooling) the entity guard misses.
 *
 * The trigger fires BEFORE UPDATE OF code on identity.roles. If the new
 * value differs from the old (IS DISTINCT FROM handles NULL → value and
 * value → NULL correctly), it raises an exception with the canonical
 * message `role code immutable`. UPDATEs that leave code untouched (the
 * common case — `updated_at` bumps, display-name edits, hierarchy
 * tweaks) pass through unaffected because Postgres re-evaluates the
 * column-list trigger only when the listed column is actually updated.
 *
 * Forward-only down(): dropping the trigger after rows have been altered
 * downstream of it would weaken the auditability contract retroactively.
 * If a future canon amendment relaxes this (e.g. a controlled migration
 * path), it should land as a new forward migration that owns the
 * relaxation, not as a `DROP TRIGGER` against a deployed instance.
 */
export class RoleCodeImmutableTrigger1000000000020
  implements MigrationInterface
{
  name = 'RoleCodeImmutableTrigger1000000000020';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE OR REPLACE FUNCTION identity.role_code_immutable()
        RETURNS TRIGGER
        LANGUAGE plpgsql
      AS $$
      BEGIN
        IF OLD.code IS DISTINCT FROM NEW.code THEN
          RAISE EXCEPTION 'role code immutable';
        END IF;
        RETURN NEW;
      END;
      $$;
    `);

    await queryRunner.query(`
      CREATE TRIGGER tg_role_code_immutable
        BEFORE UPDATE OF code ON identity.roles
        FOR EACH ROW
        EXECUTE FUNCTION identity.role_code_immutable();
    `);
  }

  public async down(): Promise<void> {
    throw new Error(
      'Forward-only migration; role code immutability is an architectural ' +
        'invariant per canon §28.6 + the role-seed migrations and cannot be ' +
        'safely dropped on a live customer instance.',
    );
  }
}
