import { MigrationInterface, QueryRunner } from 'typeorm';

export class ViewModel1818000000000 implements MigrationInterface {
  name = 'ViewModel1818000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "view_columns"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "view_definitions"`);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "view_definitions" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "code" varchar(120) NOT NULL,
        "name" varchar(255) NOT NULL,
        "description" text,
        "kind" varchar(20) NOT NULL,
        "target_collection_code" varchar(120),
        "metadata" jsonb NOT NULL DEFAULT '{}',
        "is_active" boolean NOT NULL DEFAULT true,
        "created_by" uuid,
        "updated_by" uuid,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "PK_view_definitions" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_view_definitions_code" UNIQUE ("code"),
        CONSTRAINT "FK_view_definitions_created_by" FOREIGN KEY ("created_by")
          REFERENCES "users"("id") ON DELETE SET NULL,
        CONSTRAINT "FK_view_definitions_updated_by" FOREIGN KEY ("updated_by")
          REFERENCES "users"("id") ON DELETE SET NULL
      )
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_view_definitions_kind"
      ON "view_definitions" ("kind")
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_view_definitions_target_collection"
      ON "view_definitions" ("target_collection_code")
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_view_definitions_active"
      ON "view_definitions" ("is_active")
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "view_definition_revisions" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "view_definition_id" uuid NOT NULL,
        "revision" integer NOT NULL,
        "status" varchar(20) NOT NULL,
        "layout" jsonb NOT NULL DEFAULT '{}',
        "widget_bindings" jsonb NOT NULL DEFAULT '{}',
        "actions" jsonb NOT NULL DEFAULT '{}',
        "created_by" uuid,
        "published_by" uuid,
        "published_at" timestamptz,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "PK_view_definition_revisions" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_view_definition_revision" UNIQUE ("view_definition_id", "revision"),
        CONSTRAINT "FK_view_definition_revisions_definition" FOREIGN KEY ("view_definition_id")
          REFERENCES "view_definitions"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_view_definition_revisions_created_by" FOREIGN KEY ("created_by")
          REFERENCES "users"("id") ON DELETE SET NULL,
        CONSTRAINT "FK_view_definition_revisions_published_by" FOREIGN KEY ("published_by")
          REFERENCES "users"("id") ON DELETE SET NULL
      )
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_view_definition_revisions_definition"
      ON "view_definition_revisions" ("view_definition_id")
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_view_definition_revisions_status"
      ON "view_definition_revisions" ("status")
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "view_variants" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "view_definition_id" uuid NOT NULL,
        "scope" varchar(20) NOT NULL,
        "scope_key" varchar(120),
        "priority" integer NOT NULL DEFAULT 100,
        "is_active" boolean NOT NULL DEFAULT true,
        "created_by" uuid,
        "updated_by" uuid,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "PK_view_variants" PRIMARY KEY ("id"),
        CONSTRAINT "FK_view_variants_definition" FOREIGN KEY ("view_definition_id")
          REFERENCES "view_definitions"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_view_variants_created_by" FOREIGN KEY ("created_by")
          REFERENCES "users"("id") ON DELETE SET NULL,
        CONSTRAINT "FK_view_variants_updated_by" FOREIGN KEY ("updated_by")
          REFERENCES "users"("id") ON DELETE SET NULL
      )
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_view_variants_definition"
      ON "view_variants" ("view_definition_id")
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_view_variants_scope"
      ON "view_variants" ("scope")
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_view_variants_scope_key"
      ON "view_variants" ("scope_key")
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "widget_catalog" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "code" varchar(120) NOT NULL,
        "name" varchar(255) NOT NULL,
        "kind" varchar(50) NOT NULL,
        "contract" jsonb NOT NULL DEFAULT '{}',
        "is_active" boolean NOT NULL DEFAULT true,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "PK_widget_catalog" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_widget_catalog_code" UNIQUE ("code")
      )
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "widget_catalog"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "view_variants"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "view_definition_revisions"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "view_definitions"`);

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

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_view_definitions_collection_id"
      ON "view_definitions" ("collection_id")
    `);
    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "IDX_view_definitions_code"
      ON "view_definitions" ("code")
      WHERE "deleted_at" IS NULL
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_view_definitions_scope"
      ON "view_definitions" ("scope")
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_view_definitions_is_default"
      ON "view_definitions" ("is_default")
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_view_definitions_created_by"
      ON "view_definitions" ("created_by")
    `);

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

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_view_columns_view_id"
      ON "view_columns" ("view_id")
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_view_columns_position"
      ON "view_columns" ("position")
    `);
  }
}
