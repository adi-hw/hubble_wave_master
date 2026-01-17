/**
 * Phase 3: Automation Tables Migration
 * HubbleWave Platform
 *
 * Creates tables for business rules, scheduled jobs, execution logs, and client scripts.
 */

import { MigrationInterface, QueryRunner } from 'typeorm';

export class Phase3AutomationTables1803000000000 implements MigrationInterface {
  name = 'Phase3AutomationTables1803000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // ─────────────────────────────────────────────────────────────────
    // Automation Rules Table
    // ─────────────────────────────────────────────────────────────────
    await queryRunner.query(`
      CREATE TABLE "automation_rules" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "name" varchar(128) NOT NULL,
        "description" text,
        "collection_id" uuid NOT NULL,
        "trigger_timing" varchar(16) NOT NULL,
        "trigger_operations" jsonb NOT NULL DEFAULT '["insert","update"]',
        "watch_properties" jsonb,
        "condition_type" varchar(16) NOT NULL DEFAULT 'always',
        "condition" jsonb,
        "condition_script" text,
        "action_type" varchar(16) NOT NULL DEFAULT 'no_code',
        "actions" jsonb,
        "script" text,
        "abort_on_error" boolean NOT NULL DEFAULT false,
        "execution_order" int NOT NULL DEFAULT 100,
        "is_active" boolean NOT NULL DEFAULT true,
        "is_system" boolean NOT NULL DEFAULT false,
        "consecutive_errors" int NOT NULL DEFAULT 0,
        "last_executed_at" timestamptz,
        "metadata" jsonb NOT NULL DEFAULT '{}',
        "created_by" uuid,
        "updated_by" uuid,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "pk_automation_rules" PRIMARY KEY ("id")
      )
    `);

    await queryRunner.query(`
      CREATE INDEX "idx_automation_rules_collection_active"
      ON "automation_rules" ("collection_id", "is_active")
    `);

    await queryRunner.query(`
      CREATE INDEX "idx_automation_rules_timing_active"
      ON "automation_rules" ("trigger_timing", "is_active")
    `);

    await queryRunner.query(`
      CREATE INDEX "idx_automation_rules_collection_id"
      ON "automation_rules" ("collection_id")
    `);

    // ─────────────────────────────────────────────────────────────────
    // Scheduled Jobs Table
    // ─────────────────────────────────────────────────────────────────
    await queryRunner.query(`
      CREATE TABLE "scheduled_jobs" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "name" varchar(128) NOT NULL,
        "description" text,
        "collection_id" uuid,
        "frequency" varchar(16) NOT NULL DEFAULT 'daily',
        "cron_expression" varchar(64),
        "timezone" varchar(64) NOT NULL DEFAULT 'UTC',
        "action_type" varchar(16) NOT NULL DEFAULT 'no_code',
        "actions" jsonb,
        "script" text,
        "query_filter" jsonb,
        "is_active" boolean NOT NULL DEFAULT true,
        "next_run_at" timestamptz,
        "last_run_at" timestamptz,
        "last_run_status" varchar(16),
        "consecutive_failures" int NOT NULL DEFAULT 0,
        "max_retries" int NOT NULL DEFAULT 3,
        "metadata" jsonb NOT NULL DEFAULT '{}',
        "created_by" uuid,
        "updated_by" uuid,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "pk_scheduled_jobs" PRIMARY KEY ("id")
      )
    `);

    await queryRunner.query(`
      CREATE INDEX "idx_scheduled_jobs_active_next_run"
      ON "scheduled_jobs" ("is_active", "next_run_at")
    `);

    // ─────────────────────────────────────────────────────────────────
    // Automation Execution Logs Table
    // ─────────────────────────────────────────────────────────────────
    await queryRunner.query(`
      CREATE TABLE "automation_execution_logs" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "automation_rule_id" uuid,
        "scheduled_job_id" uuid,
        "automation_type" varchar(16) NOT NULL,
        "automation_name" varchar(128) NOT NULL,
        "collection_id" uuid,
        "record_id" uuid,
        "trigger_event" varchar(32),
        "trigger_timing" varchar(16),
        "status" varchar(16) NOT NULL,
        "skipped_reason" text,
        "error_message" text,
        "error_stack" text,
        "input_data" jsonb,
        "output_data" jsonb,
        "actions_executed" jsonb,
        "triggered_by" uuid,
        "execution_depth" int NOT NULL DEFAULT 1,
        "duration_ms" int,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "pk_automation_execution_logs" PRIMARY KEY ("id"),
        CONSTRAINT "fk_execution_logs_automation_rule"
          FOREIGN KEY ("automation_rule_id")
          REFERENCES "automation_rules"("id")
          ON DELETE SET NULL
      )
    `);

    await queryRunner.query(`
      CREATE INDEX "idx_execution_logs_automation_created"
      ON "automation_execution_logs" ("automation_rule_id", "created_at")
    `);

    await queryRunner.query(`
      CREATE INDEX "idx_execution_logs_record_created"
      ON "automation_execution_logs" ("record_id", "created_at")
    `);

    await queryRunner.query(`
      CREATE INDEX "idx_execution_logs_status_created"
      ON "automation_execution_logs" ("status", "created_at")
    `);

    // ─────────────────────────────────────────────────────────────────
    // Client Scripts Table
    // ─────────────────────────────────────────────────────────────────
    await queryRunner.query(`
      CREATE TABLE "client_scripts" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "name" varchar(128) NOT NULL,
        "description" text,
        "collection_id" uuid NOT NULL,
        "form_id" uuid,
        "trigger" varchar(16) NOT NULL,
        "watch_property" varchar(64),
        "condition_type" varchar(16) NOT NULL DEFAULT 'always',
        "condition" jsonb,
        "actions" jsonb NOT NULL,
        "execution_order" int NOT NULL DEFAULT 100,
        "is_active" boolean NOT NULL DEFAULT true,
        "metadata" jsonb NOT NULL DEFAULT '{}',
        "created_by" uuid,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "pk_client_scripts" PRIMARY KEY ("id")
      )
    `);

    await queryRunner.query(`
      CREATE INDEX "idx_client_scripts_collection_active"
      ON "client_scripts" ("collection_id", "is_active")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "client_scripts"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "automation_execution_logs"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "scheduled_jobs"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "automation_rules"`);
  }
}
