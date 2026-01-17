import { MigrationInterface, QueryRunner } from 'typeorm';

export class AvaRegistry1823000000000 implements MigrationInterface {
  name = 'AvaRegistry1823000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS ava_tools (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        code VARCHAR(120) NOT NULL UNIQUE,
        name VARCHAR(255) NOT NULL,
        description TEXT,
        input_schema JSONB DEFAULT '{}',
        output_schema JSONB DEFAULT '{}',
        permission_requirements JSONB DEFAULT '{}',
        approval_policy VARCHAR(30) DEFAULT 'always',
        metadata JSONB DEFAULT '{}',
        is_active BOOLEAN DEFAULT TRUE,
        created_by UUID,
        updated_by UUID,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS ava_topics (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        code VARCHAR(120) NOT NULL UNIQUE,
        name VARCHAR(255) NOT NULL,
        description TEXT,
        routing_rules JSONB DEFAULT '{}',
        response_formats JSONB DEFAULT '{}',
        metadata JSONB DEFAULT '{}',
        is_active BOOLEAN DEFAULT TRUE,
        created_by UUID,
        updated_by UUID,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS ava_cards (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        code VARCHAR(120) NOT NULL UNIQUE,
        name VARCHAR(255) NOT NULL,
        description TEXT,
        layout JSONB DEFAULT '{}',
        action_bindings JSONB DEFAULT '{}',
        metadata JSONB DEFAULT '{}',
        is_active BOOLEAN DEFAULT TRUE,
        created_by UUID,
        updated_by UUID,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS ava_prompt_policies (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        code VARCHAR(120) NOT NULL UNIQUE,
        name VARCHAR(255) NOT NULL,
        description TEXT,
        policy JSONB DEFAULT '{}',
        metadata JSONB DEFAULT '{}',
        is_active BOOLEAN DEFAULT TRUE,
        created_by UUID,
        updated_by UUID,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS ava_prompt_policies`);
    await queryRunner.query(`DROP TABLE IF EXISTS ava_cards`);
    await queryRunner.query(`DROP TABLE IF EXISTS ava_topics`);
    await queryRunner.query(`DROP TABLE IF EXISTS ava_tools`);
  }
}
