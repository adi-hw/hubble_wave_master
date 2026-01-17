import { MigrationInterface, QueryRunner } from 'typeorm';

export class SearchEmbeddings1822000000000 implements MigrationInterface {
  name = 'SearchEmbeddings1822000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS vector`);
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS search_embeddings (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        source_type VARCHAR(120) NOT NULL,
        source_id VARCHAR(255) NOT NULL,
        chunk_index INTEGER NOT NULL,
        content TEXT NOT NULL,
        metadata JSONB DEFAULT '{}',
        embedding vector(768),
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW(),
        UNIQUE(source_type, source_id, chunk_index)
      )
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_search_embeddings_embedding
      ON search_embeddings
      USING hnsw (embedding vector_cosine_ops)
      WITH (m = 16, ef_construction = 64)
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_search_embeddings_source_type
      ON search_embeddings (source_type)
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_search_embeddings_source_id
      ON search_embeddings (source_id)
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_search_embeddings_metadata
      ON search_embeddings USING gin (metadata)
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS search_embeddings`);
  }
}
