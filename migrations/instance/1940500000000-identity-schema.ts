import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * IdentitySchema1940500000000
 *
 * Plan Fix 24 / W9 Phase C — identity domain. Moves RBAC, sessions,
 * SSO/MFA, advanced auth, and identity-scoped settings (auth_settings,
 * auth_events, nav_profiles) out of public into a dedicated `identity`
 * schema.
 *
 * `users` stays in `public` — every other domain FKs into it, so
 * keeping it as a shared table simplifies cross-schema reachability.
 * `audit_logs` similarly stays in public (the withAudit helper writes
 * audit rows from every service).
 */
export class IdentitySchema1940500000000 implements MigrationInterface {
  name = 'IdentitySchema1940500000000';

  private readonly tables = [
    // role.entity.ts + permission.entity.ts + role-permission.entity.ts
    'roles',
    'permissions',
    'role_permissions',
    'user_roles',
    // group.entity.ts
    'groups',
    'group_members',
    'group_roles',
    // auth-config.entity.ts
    'password_policies',
    'ldap_configs',
    'sso_providers',
    // auth-tokens.entity.ts (NB: 'api_keys' here is the auth API key
    // table; the integration api_keys table moved to integrations
    // schema in the prior migration so the names no longer collide)
    'password_history',
    'password_reset_tokens',
    'email_verification_tokens',
    'refresh_tokens',
    'api_keys',
    'user_invitations',
    'mfa_methods',
    'saml_auth_states',
    'login_attempts',
    // advanced-auth.entity.ts
    'webauthn_credentials',
    'webauthn_challenges',
    'magic_link_tokens',
    'trusted_devices',
    'impersonation_sessions',
    'delegations',
    'behavioral_profiles',
    'security_alerts',
    // settings.entity.ts (identity-scoped subset)
    'auth_settings',
    'auth_events',
    'nav_profiles',
    'nav_profile_items',
  ];

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE SCHEMA IF NOT EXISTS "identity"`);

    for (const table of this.tables) {
      await queryRunner.query(`
        DO $$
        BEGIN
          IF EXISTS (
            SELECT 1 FROM information_schema.tables
             WHERE table_schema = 'public'
               AND table_name = '${table}'
          ) THEN
            EXECUTE 'ALTER TABLE public."${table}" SET SCHEMA identity';
          END IF;
        END $$;
      `);
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    for (const table of this.tables) {
      await queryRunner.query(`
        DO $$
        BEGIN
          IF EXISTS (
            SELECT 1 FROM information_schema.tables
             WHERE table_schema = 'identity'
               AND table_name = '${table}'
          ) THEN
            EXECUTE 'ALTER TABLE identity."${table}" SET SCHEMA public';
          END IF;
        END $$;
      `);
    }
    await queryRunner.query(`DROP SCHEMA IF EXISTS "identity" CASCADE`);
  }
}
