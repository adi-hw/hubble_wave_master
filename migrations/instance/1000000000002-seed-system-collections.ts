import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Seed the default application and the three system collections.
 *
 * The default application (id: 9eb2e7bc-5bd1-400c-88ef-62fc1693848d,
 * code: 'default') is the required FK parent for every platform-owned
 * collection_definition. It must be seeded before any collection can be
 * inserted.
 *
 * System collections seeded:
 *   audit_logs        — complete audit trail (id: 1d7dcf98-...)
 *   schema_change_log — DDL modification audit trail (id: 1b27e1c5-...)
 *   schema_sync_state — schema synchronization state singleton (id: 38b4bb74-...)
 *
 * UUIDs are fixed at their canonical values so FK references in admin-policy
 * seeds and downstream migrations are stable across fresh installs.
 *
 * The secure_fields_by_default column is set to true for all system collections,
 * matching the baseline default (canon §1 Pre-W2 reshape). The admin policy
 * seed (0000000000002) grants the admin role wildcard field access on these
 * collections with masking_strategy=NONE, so admins see unmasked values.
 *
 * Idempotent: ON CONFLICT (code) DO NOTHING for applications; ON CONFLICT
 * (code) DO NOTHING for collection_definitions (unique index on code).
 *
 * down() throws — system collections are structural platform data; removing
 * them would cascade-delete access rules and break audit infrastructure.
 */
export class SeedSystemCollections1000000000002 implements MigrationInterface {
  // Filename, class suffix, and runtime name all share the `1000000000002`
  // sentinel. Runs immediately after seed-system-roles (1000000000001) so
  // system collections exist when seed-admin-policies (1000000000003)
  // resolves collection UUIDs by code.
  name = 'SeedSystemCollections1000000000002';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Seed the default application — required FK parent for all platform
    // collection_definitions. UUID is canonical; code has a unique index.
    await queryRunner.query(`
      INSERT INTO metadata.applications
        (id, code, name, source, status)
      VALUES
        ('9eb2e7bc-5bd1-400c-88ef-62fc1693848d', 'default', 'Default Application', 'custom', 'draft')
      ON CONFLICT (code) DO NOTHING;
    `);

    // System collections — canonical UUIDs from the live instance database.
    // admin-policy seed (0000000000002) resolves these by code, so the UUIDs
    // do not affect the policy seed, but fixing them ensures FK stability for
    // any future migration that references them by id.
    await queryRunner.query(`
      INSERT INTO metadata.collection_definitions
        (id, code, name, plural_name, description,
         table_name, owner_type, owner, is_system, is_active,
         secure_fields_by_default, default_access,
         enable_search, enable_attachments, enable_activity_log,
         is_audited, enable_versioning, is_extensible,
         icon, sync_status, source, status, application_id, metadata)
      VALUES
        ('1d7dcf98-837d-4c8b-863e-fadb49e147aa',
         'audit_logs',        'Audit Log',         'Audit Logs',
         'Complete audit trail of all system activities for compliance and debugging.',
         'audit_logs',        'system', 'custom', true, true,
         true, 'read',
         true, false, true,
         false, false, false,
         'scroll-text', 'synced', 'custom', 'draft',
         '9eb2e7bc-5bd1-400c-88ef-62fc1693848d', '{}'::jsonb),

        ('1b27e1c5-67f8-4440-a1a4-79148766a423',
         'schema_change_log', 'Schema Change Log', 'Schema Change Logs',
         'Audit trail of all schema modifications including DDL statements.',
         'schema_change_log', 'system', 'custom', true, true,
         true, 'read',
         true, false, true,
         false, false, false,
         'file-diff', 'synced', 'custom', 'draft',
         '9eb2e7bc-5bd1-400c-88ef-62fc1693848d', '{}'::jsonb),

        ('38b4bb74-34f9-4149-8c55-c166ffb08cf4',
         'schema_sync_state', 'Schema Sync State', 'Schema Sync States',
         'Singleton table tracking schema synchronization status and drift detection.',
         'schema_sync_state', 'system', 'custom', true, true,
         true, 'read',
         true, false, true,
         false, false, false,
         'refresh-cw', 'synced', 'custom', 'draft',
         '9eb2e7bc-5bd1-400c-88ef-62fc1693848d', '{}'::jsonb)
      ON CONFLICT (code) DO NOTHING;
    `);
  }

  public async down(): Promise<void> {
    throw new Error('Seed migration is forward-only');
  }
}
