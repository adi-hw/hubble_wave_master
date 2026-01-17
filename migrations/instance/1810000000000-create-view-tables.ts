import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateViewTables1810000000000 implements MigrationInterface {
  name = 'CreateViewTables1810000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Create view_definitions table
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "view_definitions" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "collection_id" uuid NOT NULL,
        "code" varchar(100) NOT NULL,
        "name" varchar(255) NOT NULL,
        "description" text,
        "scope" varchar(20) NOT NULL DEFAULT 'personal',
        "target_principal_id" uuid,
        "is_default" boolean NOT NULL DEFAULT false,
        "is_active" boolean NOT NULL DEFAULT true,
        "config" jsonb NOT NULL DEFAULT '{}',
        "created_by" uuid,
        "updated_by" uuid,
        "deleted_at" timestamptz,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "PK_view_definitions" PRIMARY KEY ("id"),
        CONSTRAINT "FK_view_definitions_collection" FOREIGN KEY ("collection_id")
          REFERENCES "collection_definitions"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_view_definitions_created_by" FOREIGN KEY ("created_by")
          REFERENCES "users"("id") ON DELETE SET NULL,
        CONSTRAINT "FK_view_definitions_updated_by" FOREIGN KEY ("updated_by")
          REFERENCES "users"("id") ON DELETE SET NULL
      )
    `);

    // Create indexes
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_view_definitions_collection_id" ON "view_definitions" ("collection_id")`);
    await queryRunner.query(`CREATE UNIQUE INDEX IF NOT EXISTS "IDX_view_definitions_code" ON "view_definitions" ("code") WHERE "deleted_at" IS NULL`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_view_definitions_scope" ON "view_definitions" ("scope")`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_view_definitions_is_default" ON "view_definitions" ("is_default")`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_view_definitions_created_by" ON "view_definitions" ("created_by")`);

    // Create view_columns table
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "view_columns" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "view_id" uuid NOT NULL,
        "property_code" varchar(100) NOT NULL,
        "position" integer NOT NULL DEFAULT 0,
        "is_visible" boolean NOT NULL DEFAULT true,
        "width" varchar(50),
        "config" jsonb NOT NULL DEFAULT '{}',
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "PK_view_columns" PRIMARY KEY ("id"),
        CONSTRAINT "FK_view_columns_view" FOREIGN KEY ("view_id")
          REFERENCES "view_definitions"("id") ON DELETE CASCADE,
        CONSTRAINT "UQ_view_columns_view_property" UNIQUE ("view_id", "property_code")
      )
    `);

    // Create indexes
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_view_columns_view_id" ON "view_columns" ("view_id")`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_view_columns_position" ON "view_columns" ("position")`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "view_columns"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "view_definitions"`);
  }
}
