import { MigrationInterface, QueryRunner } from 'typeorm';

export class NavigationModel1818000001000 implements MigrationInterface {
  name = 'NavigationModel1818000001000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "navigation_modules" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "code" varchar(120) NOT NULL,
        "name" varchar(255) NOT NULL,
        "description" text,
        "metadata" jsonb NOT NULL DEFAULT '{}',
        "is_active" boolean NOT NULL DEFAULT true,
        "created_by" uuid,
        "updated_by" uuid,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "PK_navigation_modules" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_navigation_modules_code" UNIQUE ("code"),
        CONSTRAINT "FK_navigation_modules_created_by" FOREIGN KEY ("created_by")
          REFERENCES "users"("id") ON DELETE SET NULL,
        CONSTRAINT "FK_navigation_modules_updated_by" FOREIGN KEY ("updated_by")
          REFERENCES "users"("id") ON DELETE SET NULL
      )
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "navigation_module_revisions" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "navigation_module_id" uuid NOT NULL,
        "revision" integer NOT NULL,
        "status" varchar(20) NOT NULL,
        "layout" jsonb NOT NULL DEFAULT '{}',
        "created_by" uuid,
        "published_by" uuid,
        "published_at" timestamptz,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "PK_navigation_module_revisions" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_navigation_module_revision" UNIQUE ("navigation_module_id", "revision"),
        CONSTRAINT "FK_navigation_module_revisions_definition" FOREIGN KEY ("navigation_module_id")
          REFERENCES "navigation_modules"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_navigation_module_revisions_created_by" FOREIGN KEY ("created_by")
          REFERENCES "users"("id") ON DELETE SET NULL,
        CONSTRAINT "FK_navigation_module_revisions_published_by" FOREIGN KEY ("published_by")
          REFERENCES "users"("id") ON DELETE SET NULL
      )
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "navigation_variants" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "navigation_module_id" uuid NOT NULL,
        "scope" varchar(20) NOT NULL,
        "scope_key" varchar(120),
        "priority" integer NOT NULL DEFAULT 100,
        "is_active" boolean NOT NULL DEFAULT true,
        "created_by" uuid,
        "updated_by" uuid,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "PK_navigation_variants" PRIMARY KEY ("id"),
        CONSTRAINT "FK_navigation_variants_definition" FOREIGN KEY ("navigation_module_id")
          REFERENCES "navigation_modules"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_navigation_variants_created_by" FOREIGN KEY ("created_by")
          REFERENCES "users"("id") ON DELETE SET NULL,
        CONSTRAINT "FK_navigation_variants_updated_by" FOREIGN KEY ("updated_by")
          REFERENCES "users"("id") ON DELETE SET NULL
      )
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_navigation_module_revisions_definition"
      ON "navigation_module_revisions" ("navigation_module_id")
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_navigation_module_revisions_status"
      ON "navigation_module_revisions" ("status")
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_navigation_variants_definition"
      ON "navigation_variants" ("navigation_module_id")
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_navigation_variants_scope"
      ON "navigation_variants" ("scope")
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_navigation_variants_scope_key"
      ON "navigation_variants" ("scope_key")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "navigation_variants"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "navigation_module_revisions"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "navigation_modules"`);
  }
}
