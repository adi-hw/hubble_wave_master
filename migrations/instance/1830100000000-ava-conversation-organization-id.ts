import { MigrationInterface, QueryRunner } from 'typeorm';

export class AvaConversationOrganizationId1830100000000 implements MigrationInterface {
  name = 'AvaConversationOrganizationId1830100000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "ava_conversations"
        ADD COLUMN IF NOT EXISTS "organization_id" varchar(128)
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_ava_conversations_organization_id"
        ON "ava_conversations" ("organization_id")
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_ava_conversations_user_org"
        ON "ava_conversations" ("user_id", "organization_id")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_ava_conversations_user_org"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_ava_conversations_organization_id"`);
    await queryRunner.query(`
      ALTER TABLE "ava_conversations"
        DROP COLUMN IF EXISTS "organization_id"
    `);
  }
}
