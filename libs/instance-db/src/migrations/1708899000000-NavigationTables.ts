import { MigrationInterface, QueryRunner } from "typeorm";

export class NavigationTables1708899000000 implements MigrationInterface {
    name = 'NavigationTables1708899000000';

    public async up(queryRunner: QueryRunner): Promise<void> {
        // Ensure uuid-ossp extension is enabled
        await queryRunner.query('CREATE EXTENSION IF NOT EXISTS "uuid-ossp"');

        // Update nav_profiles
        await queryRunner.query(`ALTER TABLE "nav_profiles" ADD "template_key" character varying(100)`);
        await queryRunner.query(`ALTER TABLE "nav_profiles" ADD "auto_assign_roles" text`);
        await queryRunner.query(`ALTER TABLE "nav_profiles" ADD "auto_assign_expression" text`);
        await queryRunner.query(`ALTER TABLE "nav_profiles" ADD "is_locked" boolean NOT NULL DEFAULT false`);

        // Create nav_nodes
        await queryRunner.query(`
            CREATE TABLE "nav_nodes" (
                "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
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
        // Indexes
        await queryRunner.query(`CREATE INDEX "IDX_nav_nodes_profile_id" ON "nav_nodes" ("profile_id")`);
        await queryRunner.query(`CREATE INDEX "IDX_nav_nodes_parent_id" ON "nav_nodes" ("parent_id")`);
        await queryRunner.query(`CREATE INDEX "IDX_nav_nodes_key" ON "nav_nodes" ("key")`);
        
        // Constraints
        await queryRunner.query(`
            ALTER TABLE "nav_nodes" 
            ADD CONSTRAINT "FK_nav_nodes_profile" 
            FOREIGN KEY ("profile_id") REFERENCES "nav_profiles"("id") ON DELETE CASCADE
        `);
        await queryRunner.query(`
            ALTER TABLE "nav_nodes" 
            ADD CONSTRAINT "FK_nav_nodes_parent" 
            FOREIGN KEY ("parent_id") REFERENCES "nav_nodes"("id") ON DELETE CASCADE
        `);

        // Create nav_patches
        await queryRunner.query(`
            CREATE TABLE "nav_patches" (
                "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
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
        await queryRunner.query(`CREATE INDEX "IDX_nav_patches_profile_id" ON "nav_patches" ("profile_id")`);
        
        await queryRunner.query(`
            ALTER TABLE "nav_patches" 
            ADD CONSTRAINT "FK_nav_patches_profile" 
            FOREIGN KEY ("profile_id") REFERENCES "nav_profiles"("id") ON DELETE CASCADE
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP TABLE "nav_patches"`);
        await queryRunner.query(`DROP TABLE "nav_nodes"`);
        await queryRunner.query(`ALTER TABLE "nav_profiles" DROP COLUMN "is_locked"`);
        await queryRunner.query(`ALTER TABLE "nav_profiles" DROP COLUMN "auto_assign_expression"`);
        await queryRunner.query(`ALTER TABLE "nav_profiles" DROP COLUMN "auto_assign_roles"`);
        await queryRunner.query(`ALTER TABLE "nav_profiles" DROP COLUMN "template_key"`);
    }
}
