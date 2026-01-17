import { MigrationInterface, QueryRunner } from 'typeorm';

export class FixViewDefinitionsUniqueConstraint1816000000000 implements MigrationInterface {
  name = 'FixViewDefinitionsUniqueConstraint1816000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Drop the old unique index on just 'code'
    await queryRunner.query(`
      DROP INDEX IF EXISTS "IDX_view_definitions_code"
    `);

    // Create new unique index on (collection_id, code) to allow same code in different collections
    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "IDX_view_definitions_collection_code"
      ON "view_definitions" ("collection_id", "code")
      WHERE "deleted_at" IS NULL
    `);

    console.log('Fixed view_definitions unique constraint to be scoped per collection');
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Drop the new index
    await queryRunner.query(`
      DROP INDEX IF EXISTS "IDX_view_definitions_collection_code"
    `);

    // Restore the old index
    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "IDX_view_definitions_code"
      ON "view_definitions" ("code")
      WHERE "deleted_at" IS NULL
    `);
  }
}
