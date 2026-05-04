import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Phase 1 §6.6 — seed App Studio per-feature permission slugs (ADR-12).
 *
 * The coarse-grained `collection.read|create|update|delete` slugs
 * remain in place; these new slugs are finer-grained surface-specific
 * permissions used by the App Studio's tabbed builders.
 * CollectionAccessGuard accepts either form (coarse-grained OR
 * per-feature) for the corresponding operation.
 *
 * All slugs are granted to the admin role (idempotent) so existing
 * admin users keep their full surface area without manual role
 * editing.
 */
export class SeedAppStudioPermissions1834600000000 implements MigrationInterface {
  name = 'SeedAppStudioPermissions1834600000000';

  private readonly permissions = [
    {
      slug: 'metadata.collections.edit',
      name: 'Edit Collections',
      description: 'Edit collection schema in App Studio',
      category: 'metadata',
      isDangerous: false,
    },
    {
      slug: 'metadata.properties.edit',
      name: 'Edit Properties',
      description: 'Edit property definitions on a Collection',
      category: 'metadata',
      isDangerous: false,
    },
    {
      slug: 'metadata.forms.edit',
      name: 'Edit Forms',
      description: 'Edit Record Form layouts',
      category: 'metadata',
      isDangerous: false,
    },
    {
      slug: 'metadata.policies.edit',
      name: 'Edit Policies and Rules',
      description: 'Edit access rules, Display Rules, and Automation Rules',
      category: 'metadata',
      isDangerous: false,
    },
    {
      slug: 'metadata.choices.edit',
      name: 'Edit Choice Lists',
      description: 'Edit choice list definitions used by choice/multi_choice properties',
      category: 'metadata',
      isDangerous: false,
    },
    {
      slug: 'metadata.flows.edit',
      name: 'Edit Flows',
      description: 'Edit Process Flow definitions',
      category: 'metadata',
      isDangerous: false,
    },
    {
      slug: 'metadata.collections.spreadsheet.write',
      name: 'Write Spreadsheet (ADR-16)',
      description:
        'Enter the Records sub-tab edit mode under the Data tab. Logged via access-audit on entry.',
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
