import { MigrationInterface, QueryRunner } from "typeorm";

export class CreateTenantBusinessSchema1765300007000 implements MigrationInterface {
    name = 'CreateTenantBusinessSchema1765300007000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS "uuid-ossp"`);

        // Core data objects
        await queryRunner.query(`
          CREATE TABLE IF NOT EXISTS "data_objects" (
            "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
            "tableName" character varying NOT NULL,
            "attributes" jsonb NOT NULL DEFAULT '{}'::jsonb,
            "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
            "updatedAt" TIMESTAMP NOT NULL DEFAULT now()
          )
        `);
        await queryRunner.query(`CREATE INDEX IF NOT EXISTS "idx_data_objects_table" ON "data_objects" ("tableName")`);

        // Modules
        await queryRunner.query(`
          CREATE TABLE IF NOT EXISTS "modules" (
            "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
            "name" character varying NOT NULL,
            "slug" character varying NOT NULL,
            "description" character varying,
            "route" character varying,
            "icon" character varying,
            "category" character varying,
            "sortOrder" integer NOT NULL DEFAULT 0,
            "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
            "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
            CONSTRAINT "uq_modules_slug" UNIQUE ("slug")
          )
        `);

        // Forms
        await queryRunner.query(`
          CREATE TABLE IF NOT EXISTS "form_definitions" (
            "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
            "name" character varying NOT NULL,
            "slug" character varying NOT NULL,
            "description" character varying,
            "currentVersion" integer NOT NULL DEFAULT 1,
            "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
            "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
            CONSTRAINT "uq_form_definitions_slug" UNIQUE ("slug")
          )
        `);
        await queryRunner.query(`
          CREATE TABLE IF NOT EXISTS "form_versions" (
            "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
            "formId" uuid NOT NULL,
            "version" integer NOT NULL,
            "schema" jsonb NOT NULL DEFAULT '{}'::jsonb,
            "status" character varying NOT NULL DEFAULT 'draft',
            "createdBy" character varying,
            "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
            "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
            CONSTRAINT "FK_form_versions_form" FOREIGN KEY ("formId") REFERENCES "form_definitions"("id") ON DELETE CASCADE
          )
        `);

        // Workflows
        await queryRunner.query(`
          CREATE TABLE IF NOT EXISTS "workflow_definitions" (
            "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
            "name" character varying NOT NULL,
            "slug" character varying NOT NULL,
            "description" character varying,
            "triggerType" character varying NOT NULL DEFAULT 'manual',
            "triggerConfig" jsonb NOT NULL DEFAULT '{}'::jsonb,
            "steps" jsonb NOT NULL DEFAULT '[]'::jsonb,
            "status" character varying NOT NULL DEFAULT 'active',
            "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
            "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
            CONSTRAINT "uq_workflow_definitions_slug" UNIQUE ("slug")
          )
        `);
        await queryRunner.query(`
          CREATE TABLE IF NOT EXISTS "workflow_runs" (
            "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
            "workflowId" uuid NOT NULL,
            "status" character varying NOT NULL DEFAULT 'queued',
            "input" jsonb,
            "output" jsonb,
            "error" character varying,
            "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
            "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
            "startedAt" TIMESTAMP WITH TIME ZONE,
            "finishedAt" TIMESTAMP WITH TIME ZONE,
            CONSTRAINT "FK_workflow_runs_workflow" FOREIGN KEY ("workflowId") REFERENCES "workflow_definitions"("id") ON DELETE CASCADE
          )
        `);

        // Model metadata
        await queryRunner.query(`
          CREATE TABLE IF NOT EXISTS "model_field_type" (
            "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
            "code" character varying NOT NULL,
            "label" character varying NOT NULL,
            "category" character varying NOT NULL,
            "backend_type" character varying NOT NULL,
            "ui_widget" character varying NOT NULL,
            "validators" jsonb NOT NULL DEFAULT '{}'::jsonb,
            "storage_config" jsonb NOT NULL DEFAULT '{}'::jsonb,
            "flags" jsonb NOT NULL DEFAULT '{}'::jsonb,
            "created_at" TIMESTAMP NOT NULL DEFAULT now(),
            "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
            CONSTRAINT "UQ_model_field_type_code" UNIQUE ("code")
          )
        `);

        await queryRunner.query(`
          CREATE TABLE IF NOT EXISTS "model_table" (
            "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
            "code" character varying NOT NULL,
            "label" character varying NOT NULL,
            "category" character varying NOT NULL,
            "storage_schema" character varying NOT NULL DEFAULT 'public',
            "storage_table" character varying NOT NULL,
            "extends_table_id" uuid,
            "flags" jsonb NOT NULL DEFAULT '{}'::jsonb,
            "created_at" TIMESTAMP NOT NULL DEFAULT now(),
            "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
            CONSTRAINT "UQ_model_table_code" UNIQUE ("code"),
            CONSTRAINT "FK_model_table_extends" FOREIGN KEY ("extends_table_id") REFERENCES "model_table"("id")
          )
        `);

        await queryRunner.query(`
          CREATE TABLE IF NOT EXISTS "model_field" (
            "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
            "table_id" uuid NOT NULL,
            "field_type_id" uuid NOT NULL,
            "code" character varying NOT NULL,
            "label" character varying NOT NULL,
            "nullable" boolean NOT NULL DEFAULT true,
            "is_unique" boolean NOT NULL DEFAULT false,
            "default_value" text,
            "storage_path" text NOT NULL,
            "config" jsonb NOT NULL DEFAULT '{}'::jsonb,
            "display_order" integer NOT NULL DEFAULT 0,
            "created_at" TIMESTAMP NOT NULL DEFAULT now(),
            "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
            CONSTRAINT "UQ_model_field_table_code" UNIQUE ("table_id", "code"),
            CONSTRAINT "FK_model_field_table" FOREIGN KEY ("table_id") REFERENCES "model_table"("id") ON DELETE CASCADE,
            CONSTRAINT "FK_model_field_type" FOREIGN KEY ("field_type_id") REFERENCES "model_field_type"("id")
          )
        `);

        await queryRunner.query(`
          CREATE TABLE IF NOT EXISTS "model_form_layout" (
            "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
            "tableId" uuid NOT NULL,
            "name" character varying NOT NULL,
            "layout" jsonb NOT NULL,
            CONSTRAINT "UQ_model_form_layout_table_name" UNIQUE ("tableId", "name"),
            CONSTRAINT "FK_model_form_layout_table" FOREIGN KEY ("tableId") REFERENCES "model_table"("id") ON DELETE CASCADE
          )
        `);
        await queryRunner.query(`CREATE INDEX IF NOT EXISTS "idx_model_form_layout_table" ON "model_form_layout" ("tableId")`);

        // Audit log
        await queryRunner.query(`
          CREATE TABLE IF NOT EXISTS "audit_log" (
            "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
            "tableName" character varying NOT NULL,
            "recordId" character varying NOT NULL,
            "action" character varying NOT NULL,
            "diff" jsonb,
            "performedBy" character varying,
            "timestamp" TIMESTAMP NOT NULL DEFAULT now()
          )
        `);
        await queryRunner.query(`CREATE INDEX IF NOT EXISTS "idx_audit_log_table" ON "audit_log" ("tableName")`);
        await queryRunner.query(`CREATE INDEX IF NOT EXISTS "idx_audit_log_record" ON "audit_log" ("recordId")`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP INDEX IF EXISTS "idx_audit_log_record"`);
        await queryRunner.query(`DROP INDEX IF EXISTS "idx_audit_log_table"`);
        await queryRunner.query(`DROP TABLE IF EXISTS "audit_log"`);

        await queryRunner.query(`DROP INDEX IF EXISTS "idx_model_form_layout_table"`);
        await queryRunner.query(`DROP TABLE IF EXISTS "model_form_layout"`);
        await queryRunner.query(`DROP TABLE IF EXISTS "model_field"`);
        await queryRunner.query(`DROP TABLE IF EXISTS "model_table"`);
        await queryRunner.query(`DROP TABLE IF EXISTS "model_field_type"`);

        await queryRunner.query(`DROP TABLE IF EXISTS "workflow_runs"`);
        await queryRunner.query(`DROP TABLE IF EXISTS "workflow_definitions"`);

        await queryRunner.query(`DROP TABLE IF EXISTS "form_versions"`);
        await queryRunner.query(`DROP TABLE IF EXISTS "form_definitions"`);

        await queryRunner.query(`DROP TABLE IF EXISTS "modules"`);

        await queryRunner.query(`DROP INDEX IF EXISTS "idx_data_objects_table"`);
        await queryRunner.query(`DROP TABLE IF EXISTS "data_objects"`);
    }
}
