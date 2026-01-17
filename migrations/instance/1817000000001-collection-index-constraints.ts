import { MigrationInterface, QueryRunner } from 'typeorm';

export class CollectionIndexConstraints1817000000001 implements MigrationInterface {
  name = 'CollectionIndexConstraints1817000000001';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS collection_indexes (
        id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        collection_id uuid NOT NULL REFERENCES collection_definitions(id) ON DELETE CASCADE,
        code varchar(100) NOT NULL,
        name varchar(255) NOT NULL,
        index_type varchar(20) NOT NULL DEFAULT 'btree',
        columns text[] NOT NULL,
        is_unique boolean NOT NULL DEFAULT false,
        is_active boolean NOT NULL DEFAULT true,
        metadata jsonb NOT NULL DEFAULT '{}',
        created_by uuid,
        updated_by uuid,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT uq_collection_indexes UNIQUE (collection_id, code),
        CONSTRAINT chk_collection_index_type CHECK (index_type IN ('btree', 'gin', 'trigram', 'vector'))
      );
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS collection_constraints (
        id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        collection_id uuid NOT NULL REFERENCES collection_definitions(id) ON DELETE CASCADE,
        code varchar(100) NOT NULL,
        name varchar(255) NOT NULL,
        constraint_type varchar(20) NOT NULL,
        columns text[],
        expression text,
        is_active boolean NOT NULL DEFAULT true,
        metadata jsonb NOT NULL DEFAULT '{}',
        created_by uuid,
        updated_by uuid,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT uq_collection_constraints UNIQUE (collection_id, code),
        CONSTRAINT chk_collection_constraint_type CHECK (constraint_type IN ('unique', 'check')),
        CONSTRAINT chk_collection_constraint_definition CHECK (
          (constraint_type = 'unique' AND columns IS NOT NULL) OR
          (constraint_type = 'check' AND expression IS NOT NULL)
        )
      );
    `);

    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_collection_indexes_collection ON collection_indexes(collection_id);`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_collection_indexes_type ON collection_indexes(index_type);`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_collection_indexes_active ON collection_indexes(is_active);`);

    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_collection_constraints_collection ON collection_constraints(collection_id);`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_collection_constraints_type ON collection_constraints(constraint_type);`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_collection_constraints_active ON collection_constraints(is_active);`);

    await queryRunner.query(`
      ALTER TABLE collection_indexes
      ADD CONSTRAINT fk_collection_indexes_created_by
      FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
    `);
    await queryRunner.query(`
      ALTER TABLE collection_indexes
      ADD CONSTRAINT fk_collection_indexes_updated_by
      FOREIGN KEY (updated_by) REFERENCES users(id) ON DELETE SET NULL
    `);
    await queryRunner.query(`
      ALTER TABLE collection_constraints
      ADD CONSTRAINT fk_collection_constraints_created_by
      FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
    `);
    await queryRunner.query(`
      ALTER TABLE collection_constraints
      ADD CONSTRAINT fk_collection_constraints_updated_by
      FOREIGN KEY (updated_by) REFERENCES users(id) ON DELETE SET NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE collection_constraints DROP CONSTRAINT IF EXISTS fk_collection_constraints_updated_by`);
    await queryRunner.query(`ALTER TABLE collection_constraints DROP CONSTRAINT IF EXISTS fk_collection_constraints_created_by`);
    await queryRunner.query(`ALTER TABLE collection_indexes DROP CONSTRAINT IF EXISTS fk_collection_indexes_updated_by`);
    await queryRunner.query(`ALTER TABLE collection_indexes DROP CONSTRAINT IF EXISTS fk_collection_indexes_created_by`);

    await queryRunner.query(`DROP INDEX IF EXISTS idx_collection_constraints_active`);
    await queryRunner.query(`DROP INDEX IF EXISTS idx_collection_constraints_type`);
    await queryRunner.query(`DROP INDEX IF EXISTS idx_collection_constraints_collection`);
    await queryRunner.query(`DROP INDEX IF EXISTS idx_collection_indexes_active`);
    await queryRunner.query(`DROP INDEX IF EXISTS idx_collection_indexes_type`);
    await queryRunner.query(`DROP INDEX IF EXISTS idx_collection_indexes_collection`);

    await queryRunner.query(`DROP TABLE IF EXISTS collection_constraints`);
    await queryRunner.query(`DROP TABLE IF EXISTS collection_indexes`);
  }
}
