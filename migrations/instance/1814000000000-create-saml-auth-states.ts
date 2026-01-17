import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Create SAML Auth States Table
 *
 * Stores SAML relay state for SSO callbacks.
 * Required for multi-instance deployments and service restarts.
 */
export class CreateSamlAuthStates1814000000000 implements MigrationInterface {
  name = 'CreateSamlAuthStates1814000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS saml_auth_states (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        provider_id UUID NOT NULL,
        relay_state VARCHAR(255) UNIQUE NOT NULL,
        redirect_uri VARCHAR(2048) NOT NULL,
        expires_at TIMESTAMPTZ NOT NULL,
        consumed_at TIMESTAMPTZ,
        created_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);

    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS idx_saml_auth_states_relay_state ON saml_auth_states(relay_state)
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_saml_auth_states_expires_at ON saml_auth_states(expires_at)
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS saml_auth_states`);
  }
}
