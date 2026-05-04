import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * AvaProposal1930000000000
 *
 * Adds the ava_proposal table that backs the canon §12 state machine
 * (Suggest → Preview → Approve → Execute → Audit). AVA emits proposals;
 * an operator (or a future auto-approval policy) advances them through
 * the lifecycle. Only proposals in the 'approved' state are eligible
 * for execution.
 */
export class AvaProposal1930000000000 implements MigrationInterface {
  name = 'AvaProposal1930000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_type WHERE typname = 'ava_proposal_state_enum'
        ) THEN
          CREATE TYPE "ava_proposal_state_enum" AS ENUM (
            'suggested', 'previewed', 'approved', 'rejected', 'executed', 'failed'
          );
        END IF;
      END
      $$;
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "ava_proposal" (
        "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        "kind" VARCHAR(100) NOT NULL,
        "payload" JSONB NOT NULL,
        "rationale" TEXT,
        "state" "ava_proposal_state_enum" NOT NULL,
        "actor_id" UUID,
        "preview_result" JSONB,
        "execution_result" JSONB,
        "rejection_reason" TEXT,
        "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        "updated_at" TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_ava_proposal_state_created_at"
        ON "ava_proposal" ("state", "created_at")
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_ava_proposal_actor_id_state"
        ON "ava_proposal" ("actor_id", "state")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_ava_proposal_actor_id_state"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_ava_proposal_state_created_at"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "ava_proposal"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "ava_proposal_state_enum"`);
  }
}
