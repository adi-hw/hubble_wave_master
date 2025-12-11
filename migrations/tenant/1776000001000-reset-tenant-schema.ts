import { MigrationInterface, QueryRunner } from "typeorm";

export class ResetTenantSchema1776000001000 implements MigrationInterface {
    name = 'ResetTenantSchema1776000001000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP TABLE IF EXISTS audit_log CASCADE`);
        await queryRunner.query(`DROP TABLE IF EXISTS model_form_layout CASCADE`);
        await queryRunner.query(`DROP TABLE IF EXISTS model_field CASCADE`);
        await queryRunner.query(`DROP TABLE IF EXISTS model_table CASCADE`);
        await queryRunner.query(`DROP TABLE IF EXISTS model_field_type CASCADE`);
        await queryRunner.query(`DROP TABLE IF EXISTS workflow_runs CASCADE`);
        await queryRunner.query(`DROP TABLE IF EXISTS workflow_definitions CASCADE`);
        await queryRunner.query(`DROP TABLE IF EXISTS form_versions CASCADE`);
        await queryRunner.query(`DROP TABLE IF EXISTS form_definitions CASCADE`);
        await queryRunner.query(`DROP TABLE IF EXISTS modules CASCADE`);
        await queryRunner.query(`DROP TABLE IF EXISTS data_objects CASCADE`);
        await queryRunner.query(`DROP TABLE IF EXISTS app_asset CASCADE`);

        await queryRunner.query(`
          CREATE TABLE modules (
            id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
            name text NOT NULL,
            slug text NOT NULL UNIQUE,
            description text,
            route text,
            icon text,
            category text,
            sort_order integer NOT NULL DEFAULT 0,
            created_at timestamptz NOT NULL DEFAULT now(),
            updated_at timestamptz NOT NULL DEFAULT now(),
            deleted_at timestamptz
          )
        `);

        await queryRunner.query(`
          CREATE TABLE form_definitions (
            id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
            name text NOT NULL,
            slug text NOT NULL UNIQUE,
            description text,
            current_version integer NOT NULL DEFAULT 1,
            created_at timestamptz NOT NULL DEFAULT now(),
            updated_at timestamptz NOT NULL DEFAULT now(),
            deleted_at timestamptz
          )
        `);

        await queryRunner.query(`
          CREATE TABLE form_versions (
            id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
            form_id uuid NOT NULL REFERENCES form_definitions(id) ON DELETE CASCADE,
            version integer NOT NULL,
            schema jsonb NOT NULL DEFAULT '{}',
            status text NOT NULL DEFAULT 'draft',
            created_by text,
            created_at timestamptz NOT NULL DEFAULT now(),
            updated_at timestamptz NOT NULL DEFAULT now()
          )
        `);

        await queryRunner.query(`
          CREATE TABLE workflow_definitions (
            id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
            name text NOT NULL,
            slug text NOT NULL UNIQUE,
            description text,
            trigger_type text NOT NULL DEFAULT 'manual',
            trigger_config jsonb NOT NULL DEFAULT '{}',
            steps jsonb NOT NULL DEFAULT '[]',
            status text NOT NULL DEFAULT 'active',
            created_at timestamptz NOT NULL DEFAULT now(),
            updated_at timestamptz NOT NULL DEFAULT now(),
            deleted_at timestamptz
          )
        `);

        await queryRunner.query(`
          CREATE TABLE workflow_runs (
            id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
            workflow_id uuid NOT NULL REFERENCES workflow_definitions(id) ON DELETE CASCADE,
            status text NOT NULL DEFAULT 'queued',
            input jsonb,
            output jsonb,
            error text,
            created_at timestamptz NOT NULL DEFAULT now(),
            updated_at timestamptz NOT NULL DEFAULT now(),
            started_at timestamptz,
            finished_at timestamptz
          )
        `);

        await queryRunner.query(`
          CREATE TABLE model_field_type (
            id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
            code text NOT NULL UNIQUE,
            label text NOT NULL,
            category text NOT NULL,
            backend_type text NOT NULL,
            ui_widget text NOT NULL,
            validators jsonb NOT NULL DEFAULT '{}',
            storage_config jsonb NOT NULL DEFAULT '{}',
            flags jsonb NOT NULL DEFAULT '{}',
            created_at timestamptz NOT NULL DEFAULT now(),
            updated_at timestamptz NOT NULL DEFAULT now(),
            deleted_at timestamptz
          )
        `);

        await queryRunner.query(`
          CREATE TABLE model_table (
            id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
            code text NOT NULL UNIQUE,
            label text NOT NULL,
            category text NOT NULL,
            storage_schema text NOT NULL DEFAULT 'public',
            storage_table text NOT NULL,
            extends_table_id uuid REFERENCES model_table(id),
            flags jsonb NOT NULL DEFAULT '{}',
            created_at timestamptz NOT NULL DEFAULT now(),
            updated_at timestamptz NOT NULL DEFAULT now(),
            deleted_at timestamptz
          )
        `);

        await queryRunner.query(`
          CREATE TABLE model_field (
            id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
            table_id uuid NOT NULL REFERENCES model_table(id) ON DELETE CASCADE,
            field_type_id uuid NOT NULL REFERENCES model_field_type(id),
            code text NOT NULL,
            label text NOT NULL,
            nullable boolean NOT NULL DEFAULT true,
            is_unique boolean NOT NULL DEFAULT false,
            default_value text,
            storage_path text NOT NULL,
            config jsonb NOT NULL DEFAULT '{}',
            display_order integer NOT NULL DEFAULT 0,
            created_at timestamptz NOT NULL DEFAULT now(),
            updated_at timestamptz NOT NULL DEFAULT now(),
            deleted_at timestamptz,
            CONSTRAINT uq_model_field UNIQUE (table_id, code)
          )
        `);

        await queryRunner.query(`
          CREATE TABLE model_form_layout (
            id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
            table_id uuid NOT NULL REFERENCES model_table(id) ON DELETE CASCADE,
            name text NOT NULL,
            layout jsonb NOT NULL,
            created_at timestamptz NOT NULL DEFAULT now(),
            updated_at timestamptz NOT NULL DEFAULT now(),
            deleted_at timestamptz,
            CONSTRAINT uq_model_form_layout UNIQUE (table_id, name)
          )
        `);
        await queryRunner.query(`CREATE INDEX idx_model_form_layout_table ON model_form_layout(table_id)`);

        await queryRunner.query(`
          CREATE TABLE audit_log (
            id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
            table_name text NOT NULL,
            record_id text NOT NULL,
            action text NOT NULL,
            diff jsonb,
            performed_by text,
            created_at timestamptz NOT NULL DEFAULT now()
          )
        `);
        await queryRunner.query(`CREATE INDEX idx_audit_log_table ON audit_log(table_name)`);
        await queryRunner.query(`CREATE INDEX idx_audit_log_record ON audit_log(record_id)`);

        await queryRunner.query(`
          CREATE TABLE data_objects (
            id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
            table_name text NOT NULL,
            attributes jsonb NOT NULL DEFAULT '{}',
            created_at timestamptz NOT NULL DEFAULT now(),
            updated_at timestamptz NOT NULL DEFAULT now(),
            deleted_at timestamptz
          )
        `);
        await queryRunner.query(`CREATE INDEX idx_data_objects_table ON data_objects(table_name)`);

        await queryRunner.query(`
          CREATE TABLE app_asset (
            id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
            serial_number text,
            status text,
            custom_data jsonb NOT NULL DEFAULT '{}',
            created_at timestamptz NOT NULL DEFAULT now(),
            updated_at timestamptz NOT NULL DEFAULT now(),
            deleted_at timestamptz
          )
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP TABLE IF EXISTS app_asset`);
        await queryRunner.query(`DROP TABLE IF EXISTS data_objects`);
        await queryRunner.query(`DROP TABLE IF EXISTS audit_log`);
        await queryRunner.query(`DROP TABLE IF EXISTS model_form_layout`);
        await queryRunner.query(`DROP TABLE IF EXISTS model_field`);
        await queryRunner.query(`DROP TABLE IF EXISTS model_table`);
        await queryRunner.query(`DROP TABLE IF EXISTS model_field_type`);
        await queryRunner.query(`DROP TABLE IF EXISTS workflow_runs`);
        await queryRunner.query(`DROP TABLE IF EXISTS workflow_definitions`);
        await queryRunner.query(`DROP TABLE IF EXISTS form_versions`);
        await queryRunner.query(`DROP TABLE IF EXISTS form_definitions`);
        await queryRunner.query(`DROP TABLE IF EXISTS modules`);
    }

}
