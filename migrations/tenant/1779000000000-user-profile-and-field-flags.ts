import { MigrationInterface, QueryRunner } from 'typeorm';

export class UserProfileAndFieldFlags1779000000000 implements MigrationInterface {
  name = 'UserProfileAndFieldFlags1779000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS user_profile (
        id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        tenant_user_id uuid NOT NULL,
        display_name varchar(255) NOT NULL,
        email varchar(320) NOT NULL,
        phone_number varchar(50),
        locale varchar(20),
        time_zone varchar(50),
        title varchar(255),
        department varchar(255),
        preferences jsonb NOT NULL DEFAULT '{}'::jsonb,
        is_active boolean NOT NULL DEFAULT true,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT uq_user_profile_tenant_user UNIQUE (tenant_user_id)
      );
    `);

    await queryRunner.query(`
      ALTER TABLE model_field
        ADD COLUMN IF NOT EXISTS is_system boolean NOT NULL DEFAULT false,
        ADD COLUMN IF NOT EXISTS is_internal boolean NOT NULL DEFAULT false,
        ADD COLUMN IF NOT EXISTS show_in_forms boolean NOT NULL DEFAULT true,
        ADD COLUMN IF NOT EXISTS show_in_lists boolean NOT NULL DEFAULT true;
    `);

    // Mark obvious internal/system fields if present
    await queryRunner.query(`
      UPDATE model_field
      SET is_system = true,
          is_internal = true,
          show_in_forms = false,
          show_in_lists = false
      WHERE code = 'tenant_id';
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE model_field DROP COLUMN IF EXISTS is_system;`);
    await queryRunner.query(`ALTER TABLE model_field DROP COLUMN IF EXISTS is_internal;`);
    await queryRunner.query(`ALTER TABLE model_field DROP COLUMN IF EXISTS show_in_forms;`);
    await queryRunner.query(`ALTER TABLE model_field DROP COLUMN IF EXISTS show_in_lists;`);
    await queryRunner.query(`DROP TABLE IF EXISTS user_profile;`);
  }
}
