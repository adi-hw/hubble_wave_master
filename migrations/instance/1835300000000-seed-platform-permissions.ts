import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Seed platform permission slugs that controllers reference via
 * `@RequirePermission(...)` but were not present in either the
 * original admin seed (1817999999999) or the App Studio seed
 * (1834600000000). Without these rows the permissions table is missing
 * the referenced codes, so the runtime guard rejects every admin
 * request even though the admin role conceptually owns them.
 *
 * Two clusters are added here:
 *
 * 1. Singular collection/property slugs consumed by
 *    CollectionAccessGuard and the property controllers. These are
 *    the *operation-keyed* gates ADR-12 layered on top of the
 *    plural `collections.view|create|update|delete` slugs. The guard
 *    accepts either form; this migration ensures the singular form
 *    is grantable.
 *
 * 2. Operation-agnostic privilege slugs (`system.admin`,
 *    `collection.admin`, `ava.admin`, `workflow.run-as-system`) used
 *    by access interceptors and `runAs='system'` flow steps.
 *
 * Plus the two App Studio surfaces that landed after 1834600000000 —
 * Workspaces and Change Packages — whose `metadata.*.edit` slugs
 * weren't included in the earlier app-studio seed.
 *
 * All slugs are granted to the admin role idempotently so existing
 * admin users keep their full surface area without manual edits.
 */
export class SeedPlatformPermissions1835300000000 implements MigrationInterface {
  name = 'SeedPlatformPermissions1835300000000';

  private readonly permissions = [
    {
      slug: 'system.admin',
      name: 'System Administrator',
      description: 'Platform superuser. Bypasses every per-collection access rule.',
      category: 'admin',
      isDangerous: true,
    },
    {
      slug: 'collection.admin',
      name: 'Collection Administrator',
      description: 'Operation-agnostic gate for collection routes; still subject to per-collection access rules.',
      category: 'collections',
      isDangerous: true,
    },
    {
      slug: 'collection.read',
      name: 'Read Collections',
      description: 'Singular form of collections.view used by CollectionAccessGuard for GET requests.',
      category: 'collections',
      isDangerous: false,
    },
    {
      slug: 'collection.create',
      name: 'Create Collection Records',
      description: 'Singular form of collections.create used by CollectionAccessGuard for POST requests.',
      category: 'collections',
      isDangerous: false,
    },
    {
      slug: 'collection.update',
      name: 'Update Collection Records',
      description: 'Singular form of collections.update used by CollectionAccessGuard for PUT/PATCH requests.',
      category: 'collections',
      isDangerous: false,
    },
    {
      slug: 'collection.delete',
      name: 'Delete Collection Records',
      description: 'Singular form of collections.delete used by CollectionAccessGuard for DELETE requests.',
      category: 'collections',
      isDangerous: true,
    },
    {
      slug: 'property.read',
      name: 'Read Properties',
      description: 'Read property definitions on a Collection.',
      category: 'collections',
      isDangerous: false,
    },
    {
      slug: 'property.create',
      name: 'Create Properties',
      description: 'Add new property definitions to a Collection.',
      category: 'collections',
      isDangerous: false,
    },
    {
      slug: 'property.update',
      name: 'Update Properties',
      description: 'Modify property definitions on a Collection.',
      category: 'collections',
      isDangerous: false,
    },
    {
      slug: 'property.delete',
      name: 'Delete Properties',
      description: 'Remove property definitions from a Collection.',
      category: 'collections',
      isDangerous: true,
    },
    {
      slug: 'ava.admin',
      name: 'AVA Administrator',
      description: 'Manage AVA prompts, governance rules, and execution policies.',
      category: 'ava',
      isDangerous: true,
    },
    {
      slug: 'workflow.run-as-system',
      name: 'Run Workflow As System',
      description: 'Execute Process Flows under the system actor identity.',
      category: 'process-flows',
      isDangerous: true,
    },
    {
      slug: 'metadata.workspaces.edit',
      name: 'Edit Workspaces',
      description: 'Edit App Studio Workspace definitions.',
      category: 'metadata',
      isDangerous: false,
    },
    {
      slug: 'metadata.change-packages.edit',
      name: 'Edit Change Packages',
      description: 'Author and apply App Studio Change Packages.',
      category: 'metadata',
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
