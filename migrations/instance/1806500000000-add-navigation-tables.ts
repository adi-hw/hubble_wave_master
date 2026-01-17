import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddNavigationTables1806500000000 implements MigrationInterface {
  name = 'AddNavigationTables1806500000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      'ALTER TABLE "nav_profiles" ADD COLUMN IF NOT EXISTS "template_key" character varying(100)'
    );
    await queryRunner.query(
      'ALTER TABLE "nav_profiles" ADD COLUMN IF NOT EXISTS "auto_assign_roles" text'
    );
    await queryRunner.query(
      'ALTER TABLE "nav_profiles" ADD COLUMN IF NOT EXISTS "auto_assign_expression" text'
    );
    await queryRunner.query(
      'ALTER TABLE "nav_profiles" ADD COLUMN IF NOT EXISTS "is_locked" boolean NOT NULL DEFAULT false'
    );

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "nav_nodes" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "profile_id" uuid NOT NULL,
        "key" character varying NOT NULL,
        "label" character varying NOT NULL,
        "icon" character varying,
        "type" character varying NOT NULL,
        "module_key" character varying,
        "url" character varying,
        "parent_id" uuid,
        "order" integer NOT NULL DEFAULT 0,
        "is_visible" boolean NOT NULL DEFAULT true,
        "visibility" jsonb,
        "context_tags" text,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_nav_nodes" PRIMARY KEY ("id")
      )
    `);

    await queryRunner.query(
      'CREATE INDEX IF NOT EXISTS "IDX_nav_nodes_profile_id" ON "nav_nodes" ("profile_id")'
    );
    await queryRunner.query(
      'CREATE INDEX IF NOT EXISTS "IDX_nav_nodes_parent_id" ON "nav_nodes" ("parent_id")'
    );
    await queryRunner.query(
      'CREATE INDEX IF NOT EXISTS "IDX_nav_nodes_key" ON "nav_nodes" ("key")'
    );

    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'FK_nav_nodes_profile') THEN
          ALTER TABLE "nav_nodes"
          ADD CONSTRAINT "FK_nav_nodes_profile"
          FOREIGN KEY ("profile_id") REFERENCES "nav_profiles"("id") ON DELETE CASCADE;
        END IF;
      END $$;
    `);

    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'FK_nav_nodes_parent') THEN
          ALTER TABLE "nav_nodes"
          ADD CONSTRAINT "FK_nav_nodes_parent"
          FOREIGN KEY ("parent_id") REFERENCES "nav_nodes"("id") ON DELETE CASCADE;
        END IF;
      END $$;
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "nav_patches" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "profile_id" uuid NOT NULL,
        "operation" character varying NOT NULL,
        "target_node_key" character varying NOT NULL,
        "payload" jsonb,
        "priority" integer NOT NULL DEFAULT 0,
        "description" character varying,
        "is_active" boolean NOT NULL DEFAULT true,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_nav_patches" PRIMARY KEY ("id")
      )
    `);

    await queryRunner.query(
      'CREATE INDEX IF NOT EXISTS "IDX_nav_patches_profile_id" ON "nav_patches" ("profile_id")'
    );

    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'FK_nav_patches_profile') THEN
          ALTER TABLE "nav_patches"
          ADD CONSTRAINT "FK_nav_patches_profile"
          FOREIGN KEY ("profile_id") REFERENCES "nav_profiles"("id") ON DELETE CASCADE;
        END IF;
      END $$;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      'ALTER TABLE "nav_patches" DROP CONSTRAINT IF EXISTS "FK_nav_patches_profile"'
    );
    await queryRunner.query(
      'ALTER TABLE "nav_nodes" DROP CONSTRAINT IF EXISTS "FK_nav_nodes_parent"'
    );
    await queryRunner.query(
      'ALTER TABLE "nav_nodes" DROP CONSTRAINT IF EXISTS "FK_nav_nodes_profile"'
    );
    await queryRunner.query('DROP TABLE IF EXISTS "nav_patches"');
    await queryRunner.query('DROP TABLE IF EXISTS "nav_nodes"');
    await queryRunner.query('ALTER TABLE "nav_profiles" DROP COLUMN IF EXISTS "is_locked"');
    await queryRunner.query(
      'ALTER TABLE "nav_profiles" DROP COLUMN IF EXISTS "auto_assign_expression"'
    );
    await queryRunner.query(
      'ALTER TABLE "nav_profiles" DROP COLUMN IF EXISTS "auto_assign_roles"'
    );
    await queryRunner.query('ALTER TABLE "nav_profiles" DROP COLUMN IF EXISTS "template_key"');
  }
}
