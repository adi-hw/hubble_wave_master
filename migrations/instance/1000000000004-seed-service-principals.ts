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
export class SeedServicePrincipals1000000000004 implements MigrationInterface {
  // Filename, class suffix, and runtime name all share the `1000000000004`
  // sentinel. No FK dependencies on other seeds; placed after admin-policies
  // (1000000000003) for filename-order coherence with the runtime sort.
  name = 'SeedServicePrincipals1000000000004';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Scope vocabulary: canon §29.7 binds service-token scopes to
    // capability codes from `PERMISSION_REGISTRY`. The pre-W2-followup
    // shape (`work_order:read` / `work_order:write` / `audit:write`)
    // is retired because (a) `work_order` is a customer-namespaced
    // collection code, not a platform capability, and (b) `audit:write`
    // doesn't exist in the registry (audit writes are a side-effect
    // of operations, not a separately-gateable verb).
    //
    // The svc-worker's actual call surface today is empty — canon §29.7
    // explicitly notes "the worker doesn't currently make HTTP
    // callbacks to apps/api" — so the scope list is aspirational
    // wiring for the canon §29.7 contract. The codes below are valid
    // PERMISSION_REGISTRY entries that cover the worker's expected
    // future call sites (automation execution, audit reads,
    // notification dispatch); adjust the array when a real cross-
    // process surface emerges and tighten or widen accordingly.
    await queryRunner.query(`
      INSERT INTO public.service_principals
        (service_id, display_name, allowed_audiences, allowed_scopes,
         k8s_service_account, active)
      VALUES
        ('svc-worker',
         'BullMQ background worker',
         ARRAY['svc-api'],
         ARRAY['metadata:flow:manage', 'audit:read', 'notifications:send:invoke'],
         'system:serviceaccount:hubblewave-system:svc-worker-sa',
         true)
      ON CONFLICT (service_id) DO NOTHING;
    `);
  }

  public async down(): Promise<void> {
    throw new Error('Seed migration is forward-only');
  }
}
