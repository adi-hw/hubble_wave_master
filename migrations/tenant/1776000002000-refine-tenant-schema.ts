import { MigrationInterface, QueryRunner } from "typeorm";

export class RefineTenantSchema1776000002000 implements MigrationInterface {
    name = 'RefineTenantSchema1776000002000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        // data_objects: tie to model_table for structured linkage
        await queryRunner.query(`ALTER TABLE data_objects ADD COLUMN IF NOT EXISTS table_id uuid`);
        await queryRunner.query(`UPDATE data_objects SET table_id = (SELECT id FROM model_table WHERE code = data_objects.table_name LIMIT 1) WHERE table_id IS NULL`);
        await queryRunner.query(`ALTER TABLE data_objects ALTER COLUMN table_id SET NOT NULL`);
        await queryRunner.query(`ALTER TABLE data_objects ADD CONSTRAINT fk_data_objects_table FOREIGN KEY (table_id) REFERENCES model_table(id) ON DELETE CASCADE`);
        await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_data_objects_table_id ON data_objects(table_id)`);

        // modules: ensure unique name for consistency
        await queryRunner.query(`CREATE UNIQUE INDEX IF NOT EXISTS uq_modules_name ON modules(name)`);

        // form_versions: unique per form/version and status constraint
        await queryRunner.query(`ALTER TABLE form_versions ADD CONSTRAINT uq_form_versions UNIQUE (form_id, version)`);
        await queryRunner.query(`ALTER TABLE form_versions ADD CONSTRAINT chk_form_versions_status CHECK (status IN ('draft','published','archived'))`);

        // form_definitions: optional link to model_table
        await queryRunner.query(`ALTER TABLE form_definitions ADD COLUMN IF NOT EXISTS model_table_id uuid REFERENCES model_table(id)`);

        // workflow_definitions: stricter enums and audit columns
        await queryRunner.query(`ALTER TABLE workflow_definitions ADD COLUMN IF NOT EXISTS created_by uuid`);
        await queryRunner.query(`ALTER TABLE workflow_definitions ADD COLUMN IF NOT EXISTS updated_by uuid`);
        await queryRunner.query(`ALTER TABLE workflow_definitions ADD CONSTRAINT chk_workflow_definitions_trigger CHECK (trigger_type IN ('manual','event','schedule'))`);
        await queryRunner.query(`ALTER TABLE workflow_definitions ADD CONSTRAINT chk_workflow_definitions_status CHECK (status IN ('active','inactive'))`);

        // workflow_runs: correlation id + useful index
        await queryRunner.query(`ALTER TABLE workflow_runs ADD COLUMN IF NOT EXISTS correlation_id text`);
        await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_workflow_runs_workflow_created ON workflow_runs(workflow_id, created_at DESC)`);

        // model_field_type: builtin flag
        await queryRunner.query(`ALTER TABLE model_field_type ADD COLUMN IF NOT EXISTS is_builtin boolean NOT NULL DEFAULT true`);

        // model_table: storage uniqueness and better default schema
        await queryRunner.query(`ALTER TABLE model_table ALTER COLUMN storage_schema DROP DEFAULT`);
        await queryRunner.query(`ALTER TABLE model_table ALTER COLUMN storage_schema SET DEFAULT current_schema()`);
        await queryRunner.query(`CREATE UNIQUE INDEX IF NOT EXISTS uq_model_table_storage ON model_table(storage_schema, storage_table)`);

        // model_field: index for lookups
        await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_model_field_table ON model_field(table_id)`);

        // audit_log: composite index for query efficiency
        await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_audit_log_table_record_time ON audit_log(table_name, record_id, created_at DESC)`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP INDEX IF EXISTS idx_audit_log_table_record_time`);
        await queryRunner.query(`DROP INDEX IF EXISTS idx_model_field_table`);
        await queryRunner.query(`DROP INDEX IF EXISTS uq_model_table_storage`);
        await queryRunner.query(`ALTER TABLE model_table ALTER COLUMN storage_schema DROP DEFAULT`);
        await queryRunner.query(`ALTER TABLE model_table ALTER COLUMN storage_schema SET DEFAULT 'public'`);
        await queryRunner.query(`ALTER TABLE model_field_type DROP COLUMN IF EXISTS is_builtin`);
        await queryRunner.query(`DROP INDEX IF EXISTS idx_workflow_runs_workflow_created`);
        await queryRunner.query(`ALTER TABLE workflow_runs DROP COLUMN IF EXISTS correlation_id`);
        await queryRunner.query(`ALTER TABLE workflow_definitions DROP CONSTRAINT IF EXISTS chk_workflow_definitions_status`);
        await queryRunner.query(`ALTER TABLE workflow_definitions DROP CONSTRAINT IF EXISTS chk_workflow_definitions_trigger`);
        await queryRunner.query(`ALTER TABLE workflow_definitions DROP COLUMN IF EXISTS updated_by`);
        await queryRunner.query(`ALTER TABLE workflow_definitions DROP COLUMN IF EXISTS created_by`);
        await queryRunner.query(`ALTER TABLE form_definitions DROP COLUMN IF EXISTS model_table_id`);
        await queryRunner.query(`ALTER TABLE form_versions DROP CONSTRAINT IF EXISTS chk_form_versions_status`);
        await queryRunner.query(`ALTER TABLE form_versions DROP CONSTRAINT IF EXISTS uq_form_versions`);
        await queryRunner.query(`DROP INDEX IF EXISTS uq_modules_name`);
        await queryRunner.query(`DROP INDEX IF EXISTS idx_data_objects_table_id`);
        await queryRunner.query(`ALTER TABLE data_objects DROP CONSTRAINT IF EXISTS fk_data_objects_table`);
        await queryRunner.query(`ALTER TABLE data_objects DROP COLUMN IF EXISTS table_id`);
    }
}
