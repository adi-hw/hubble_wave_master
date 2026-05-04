import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Seed the `platform.bypass_authz` permission and the AVA proposal
 * lifecycle permission slugs.
 *
 * `platform.bypass_authz` is the canonical bypass slug consulted by
 * PermissionsGuard, JwtAuthGuard, and `extractContext()` to set
 * RequestContext.isAdmin. It replaces the prior hardcoded
 * `userRoles.includes('admin') || userRoles.includes('super_admin')`
 * check, which violated Canon §4 (no hardcoded business logic) and §9
 * (all data access flows through RBAC + ABAC; no shortcuts).
 *
 * The six `ava.proposal.*` slugs gate each transition of the §12
 * lifecycle (Suggest → Preview → Approve → Reject → Execute) on
 * AvaProposalController. Without these rows the controller's new
 * `@RequirePermission(...)` decorators would resolve to permission
 * codes that nothing has been granted.
 *
 * All slugs are granted to the seeded `admin` role idempotently, which
 * preserves existing admin behaviour: an admin keeps the bypass and
 * gains the explicit AVA proposal permissions in one step. If a
 * deployment also runs a `super_admin` role, operators can grant the
 * permission post-deploy through the role management UI; we do not
 * auto-create a role that wasn't seeded by an earlier migration.
 */
export class SeedBypassAndAvaProposalPermissions1940000000000 implements MigrationInterface {
  name = 'SeedBypassAndAvaProposalPermissions1940000000000';

  private readonly permissions = [
    {
      slug: 'platform.bypass_authz',
      name: 'Bypass Authorization Checks',
      description:
        'Holders skip per-route permission gates and per-collection access rules. ' +
        'Replaces the prior hardcoded admin / super_admin role bypass.',
      category: 'admin',
      isDangerous: true,
    },
    {
      slug: 'ava.proposal.suggest',
      name: 'Suggest AVA Proposals',
      description: 'Create new AVA proposals in the suggested state.',
      category: 'ava',
      isDangerous: false,
    },
    {
      slug: 'ava.proposal.read',
      name: 'Read AVA Proposals',
      description: 'Fetch AVA proposals by id.',
      category: 'ava',
      isDangerous: false,
    },
    {
      slug: 'ava.proposal.preview',
      name: 'Preview AVA Proposals',
      description: 'Transition a proposal from suggested to previewed by recording a dry-run result.',
      category: 'ava',
      isDangerous: false,
    },
    {
      slug: 'ava.proposal.approve',
      name: 'Approve AVA Proposals',
      description: 'Transition a previewed proposal to approved, authorising downstream execution.',
      category: 'ava',
      isDangerous: true,
    },
    {
      slug: 'ava.proposal.reject',
      name: 'Reject AVA Proposals',
      description: 'Reject a proposal in any non-terminal state with a reason.',
      category: 'ava',
      isDangerous: false,
    },
    {
      slug: 'ava.proposal.execute',
      name: 'Execute AVA Proposals',
      description: 'Close an approved proposal as executed (used for client-side mutations).',
      category: 'ava',
      isDangerous: true,
    },
  ];

  public async up(queryRunner: QueryRunner): Promise<void> {
    for (const perm of this.permissions) {
      await queryRunner.query(
        `INSERT INTO permissions (id, code, name, description, category, is_dangerous, is_system, created_at)
         VALUES (uuid_generate_v4(), $1, $2, $3, $4, $5, true, NOW())
         ON CONFLICT (code) DO NOTHING`,
        [perm.slug, perm.name, perm.description, perm.category, perm.isDangerous],
      );
    }

    const adminRole = await queryRunner.query(
      `SELECT id FROM roles WHERE code = 'admin' LIMIT 1`,
    );
    if (!adminRole || adminRole.length === 0) return;
    const adminRoleId = adminRole[0].id;

    for (const perm of this.permissions) {
      await queryRunner.query(
        `INSERT INTO role_permissions (id, role_id, permission_id, created_at)
         SELECT uuid_generate_v4(), $1, p.id, NOW()
           FROM permissions p
          WHERE p.code = $2
         ON CONFLICT DO NOTHING`,
        [adminRoleId, perm.slug],
      );
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const slugs = this.permissions.map((p) => p.slug);
    await queryRunner.query(
      `DELETE FROM role_permissions
        WHERE permission_id IN (SELECT id FROM permissions WHERE code = ANY($1::text[]))`,
      [slugs],
    );
    await queryRunner.query(
      `DELETE FROM permissions WHERE code = ANY($1::text[])`,
      [slugs],
    );
  }
}
