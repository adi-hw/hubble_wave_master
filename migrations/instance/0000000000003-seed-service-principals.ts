import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Seed the single service principal that backs the present cross-process call
 * surface per canon §29.7 — the BullMQ background worker (`svc-worker`)
 * calling back into the API (`svc-api`).
 *
 * Founder direction (canon §29.7 PR-D, 2026-05-12): ONE row only. Do not
 * seed svc-api, svc-ava, svc-insights, svc-sync, etc. — those names appear
 * as documentation in canon §29.7 but no production code mints tokens for
 * them today. A row is added via migration when a real cross-process call
 * surface emerges.
 *
 * Idempotent: ON CONFLICT (service_id) DO NOTHING.
 *
 * down() throws — removing the svc-worker principal would break the BullMQ
 * worker's ability to authenticate against the API. Forward-only is required.
 */
export class SeedServicePrincipals0000000000003 implements MigrationInterface {
  // Timestamp sentinel 1000000000004 — no dependencies on other seeds;
  // placed after admin-policies to keep filenames and timestamps aligned.
  name = 'SeedServicePrincipals1000000000004';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      INSERT INTO public.service_principals
        (service_id, display_name, allowed_audiences, allowed_scopes,
         k8s_service_account, active)
      VALUES
        ('svc-worker',
         'BullMQ background worker',
         ARRAY['svc-api'],
         ARRAY['work_order:read', 'work_order:write', 'audit:write'],
         'system:serviceaccount:hubblewave-system:svc-worker-sa',
         true)
      ON CONFLICT (service_id) DO NOTHING;
    `);
  }

  public async down(): Promise<void> {
    throw new Error('Seed migration is forward-only');
  }
}
