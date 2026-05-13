import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DataSource } from 'typeorm';
import { UserRequestContext } from '@hubblewave/auth-guard';
import { LLMService } from './llm.service';

// Default vector dimension - nomic-embed-text produces 768
const DEFAULT_VECTOR_DIMENSION = 768;

export interface DocumentChunk {
  id: string;
  sourceType: 'knowledge_article' | 'catalog_item' | 'record' | 'comment' | 'attachment';
  sourceId: string;
  content: string;
  metadata: Record<string, unknown>;
  embedding?: number[];
  createdAt: Date;
  updatedAt: Date;
}

export interface SearchResult {
  id: string;
  sourceType: string;
  sourceId: string;
  content: string;
  metadata: Record<string, unknown>;
  similarity: number;
}

export interface VectorSearchOptions {
  limit?: number;
  threshold?: number;
  sourceTypes?: string[];
  metadata?: Record<string, unknown>;
  /**
   * F073 (W1 task 9): per-result authorization check. If provided, the
   * search post-filters results to those for which `authzCheck` returns
   * true. The audit's primary concern was that vector search returned
   * chunks from records the calling user could not read directly; the
   * post-filter closes that surface. W2 owns moving this from post-
   * filter to pre-filter at the SQL level (joining through
   * CollectionDefinition + buildCollectionRowLevelClause); until that
   * lands, the search-then-filter pattern is the safety contract.
   *
   * The check signature deliberately takes (sourceType, sourceId)
   * rather than the full SearchResult so the caller doesn't have to
   * inspect content/metadata when deciding access.
   */
  authzCheck?: (sourceType: string, sourceId: string) => Promise<boolean>;
}

/**
 * Identity for an "as system" caller — embedding workers, scheduled
 * indexers, and bootstrap paths that legitimately need to query the
 * vector store without a user context. The literal string is used as a
 * type-system marker so callers can't accidentally pass `null` or `{}`
 * to bypass the new RequestContext requirement on search().
 */
export const SYSTEM_VECTOR_SEARCH_CONTEXT = '__hw_system_vector_search__' as const;
export type VectorSearchPrincipal = UserRequestContext | typeof SYSTEM_VECTOR_SEARCH_CONTEXT;

@Injectable()
export class VectorStoreService {
  private readonly logger = new Logger(VectorStoreService.name);
  private vectorDimension: number;

  constructor(
    private llmService: LLMService,
    private configService: ConfigService
  ) {
    this.vectorDimension = this.configService.get<number>(
      'EMBEDDING_DIMENSIONS',
      DEFAULT_VECTOR_DIMENSION
    );
  }

  /**
   * Initialize pgvector extension and create vector table for an instance
   */
  async initializeVectorStore(dataSource: DataSource): Promise<void> {
    const queryRunner = dataSource.createQueryRunner();

    try {
      await queryRunner.connect();

      // Enable pgvector extension
      await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS vector`);

      // Create document chunks table with vector column
      await queryRunner.query(`
        CREATE TABLE IF NOT EXISTS document_chunks (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          source_type VARCHAR(50) NOT NULL,
          source_id VARCHAR(255) NOT NULL,
          content TEXT NOT NULL,
          metadata JSONB DEFAULT '{}',
          embedding vector(${this.vectorDimension}),
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          UNIQUE(source_type, source_id, content)
        )
      `);

      // Create index for vector similarity search using HNSW (faster for large datasets)
      await queryRunner.query(`
        CREATE INDEX IF NOT EXISTS idx_document_chunks_embedding
        ON document_chunks
        USING hnsw (embedding vector_cosine_ops)
        WITH (m = 16, ef_construction = 64)
      `);

      // Create indexes for filtering
      await queryRunner.query(`
        CREATE INDEX IF NOT EXISTS idx_document_chunks_source_type
        ON document_chunks (source_type)
      `);

      await queryRunner.query(`
        CREATE INDEX IF NOT EXISTS idx_document_chunks_source_id
        ON document_chunks (source_id)
      `);

      await queryRunner.query(`
        CREATE INDEX IF NOT EXISTS idx_document_chunks_metadata
        ON document_chunks USING gin (metadata)
      `);

      this.logger.log('Instance vector store initialized successfully');
    } catch (error) {
      this.logger.error('Failed to initialize vector store', error);
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  /**
   * Add or update a document chunk with its embedding
   */
  async upsertDocument(
    dataSource: DataSource,
    chunk: Omit<DocumentChunk, 'id' | 'embedding' | 'createdAt' | 'updatedAt'>
  ): Promise<string> {
    // Generate embedding for the content
    const embedding = await this.llmService.getEmbedding(chunk.content);
    const embeddingStr = `[${embedding.join(',')}]`;

    const result = await dataSource.query(
      `
      INSERT INTO document_chunks (source_type, source_id, content, metadata, embedding)
      VALUES ($1, $2, $3, $4, $5::vector)
      ON CONFLICT (source_type, source_id, content)
      DO UPDATE SET
        metadata = EXCLUDED.metadata,
        embedding = EXCLUDED.embedding,
        updated_at = NOW()
      RETURNING id
      `,
      [
        chunk.sourceType,
        chunk.sourceId,
        chunk.content,
        JSON.stringify(chunk.metadata),
        embeddingStr,
      ]
    );

    return result[0].id;
  }

  /**
   * Add multiple document chunks with embeddings (batch operation)
   */
  async upsertDocuments(
    dataSource: DataSource,
    chunks: Omit<DocumentChunk, 'id' | 'embedding' | 'createdAt' | 'updatedAt'>[]
  ): Promise<string[]> {
    const ids: string[] = [];

    // Process in batches - vLLM supports native batch embeddings
    const batchSize = 32;
    for (let i = 0; i < chunks.length; i += batchSize) {
      const batch = chunks.slice(i, i + batchSize);

      // Get batch embeddings
      const contents = batch.map((c) => c.content);
      const embeddings = await this.llmService.getEmbeddings(contents);

      // Insert all chunks in the batch
      for (let j = 0; j < batch.length; j++) {
        const chunk = batch[j];
        const embedding = embeddings[j];
        const embeddingStr = `[${embedding.join(',')}]`;

        const result = await dataSource.query(
          `
          INSERT INTO document_chunks (source_type, source_id, content, metadata, embedding)
          VALUES ($1, $2, $3, $4, $5::vector)
          ON CONFLICT (source_type, source_id, content)
          DO UPDATE SET
            metadata = EXCLUDED.metadata,
            embedding = EXCLUDED.embedding,
            updated_at = NOW()
          RETURNING id
          `,
          [
            chunk.sourceType,
            chunk.sourceId,
            chunk.content,
            JSON.stringify(chunk.metadata),
            embeddingStr,
          ]
        );
        ids.push(result[0].id);
      }
    }

    return ids;
  }

  /**
   * Perform similarity search using vector embeddings.
   *
   * F073 (W1 task 9): `principal` is REQUIRED. Callers must either
   * supply a RequestContext (the user identity that initiated the
   * search) or the SYSTEM_VECTOR_SEARCH_CONTEXT sentinel for legitimate
   * "as system" callers (embedding workers, indexers). The change is
   * non-default-bypassable — TypeScript forces every call site to make
   * an explicit choice. Every search emits an audit log line tagged
   * with the principal so post-incident analysis can attribute leaks.
   *
   * If `options.authzCheck` is provided, results are post-filtered to
   * those for which the check returns true. Without a check, results
   * are returned as-is — and a debug log records that the caller did
   * not provide an authz filter (so we can find unprotected paths).
   * The "no check" branch is acceptable for SYSTEM_VECTOR_SEARCH_CONTEXT
   * (system callers can see everything) but is a SHOULD-FIX gap when
   * the principal is a real user; W2 wires the chat path's check.
   */
  async search(
    dataSource: DataSource,
    query: string,
    principal: VectorSearchPrincipal,
    options: VectorSearchOptions = {}
  ): Promise<SearchResult[]> {
    const { limit = 10, threshold = 0.7, sourceTypes, metadata } = options;

    // Audit log every search with attribution. The query text is
    // truncated for log compactness; full query is in the request log.
    const principalDesc =
      principal === SYSTEM_VECTOR_SEARCH_CONTEXT
        ? 'system'
        : `user:${principal.userId}`;
    this.logger.log(
      `vector search by ${principalDesc} — query="${query.slice(0, 80)}", limit=${limit}, threshold=${threshold}`,
    );

    if (principal !== SYSTEM_VECTOR_SEARCH_CONTEXT && !options.authzCheck) {
      // Not a hard fail (W1 ratchet — would break the world). Log so
      // operators can grep for the gap and W2 can prioritise wiring
      // authzCheck on the remaining caller paths.
      this.logger.warn(
        `vector search by ${principalDesc} executed WITHOUT authzCheck (F073 gap). ` +
          `Add an authzCheck to the call site at the chat / RAG layer. ` +
          `Until then, this search may return chunks from sources the user cannot read directly.`,
      );
    }

    // Generate embedding for the query
    const queryEmbedding = await this.llmService.getEmbedding(query);

    // If embedding generation failed (empty array), skip vector search
    if (!queryEmbedding || queryEmbedding.length === 0) {
      return [];
    }

    const embeddingStr = `[${queryEmbedding.join(',')}]`;

    // Build the query with optional filters
    let sql = `
      SELECT
        id,
        source_type,
        source_id,
        content,
        metadata,
        1 - (embedding <=> $1::vector) as similarity
      FROM document_chunks
      WHERE 1 = 1
    `;
    const params: unknown[] = [embeddingStr];
    let paramIndex = 2;

    // Filter by source types
    if (sourceTypes && sourceTypes.length > 0) {
      sql += ` AND source_type = ANY($${paramIndex})`;
      params.push(sourceTypes);
      paramIndex++;
    }

    // Filter by metadata (JSONB containment)
    if (metadata && Object.keys(metadata).length > 0) {
      sql += ` AND metadata @> $${paramIndex}`;
      params.push(JSON.stringify(metadata));
      paramIndex++;
    }

    // Filter by similarity threshold and order by similarity
    sql += `
      AND 1 - (embedding <=> $1::vector) >= $${paramIndex}
      ORDER BY embedding <=> $1::vector
      LIMIT $${paramIndex + 1}
    `;
    params.push(threshold, limit);

    const results = await dataSource.query(sql, params);
    const mapped: SearchResult[] = results.map((row: Record<string, unknown>) => ({
      id: row['id'] as string,
      sourceType: row['source_type'] as string,
      sourceId: row['source_id'] as string,
      content: row['content'] as string,
      metadata: row['metadata'] as Record<string, unknown>,
      similarity: row['similarity'] as number,
    }));

    // F073 post-filter. authzCheck runs in parallel — for typical
    // limit≤10 the round-trip cost is one batch of N permission
    // queries, which the caller's authz layer can amortize via its
    // own caching.
    if (options.authzCheck) {
      const decisions = await Promise.all(
        mapped.map((r) =>
          options.authzCheck!(r.sourceType, r.sourceId).catch((err) => {
            this.logger.warn(
              `authzCheck threw for ${r.sourceType}/${r.sourceId}: ${(err as Error).message}; treating as DENY`,
            );
            return false;
          }),
        ),
      );
      const filtered = mapped.filter((_, i) => decisions[i]);
      const dropped = mapped.length - filtered.length;
      if (dropped > 0) {
        this.logger.log(
          `vector search filter dropped ${dropped}/${mapped.length} result(s) for ${principalDesc} (F073)`,
        );
      }
      return filtered;
    }
    return mapped;
  }

  /**
   * Delete document chunks by source
   */
  async deleteBySource(
    dataSource: DataSource,
    sourceType: string,
    sourceId: string
  ): Promise<number> {
    const result = await dataSource.query(
      `DELETE FROM document_chunks WHERE source_type = $1 AND source_id = $2`,
      [sourceType, sourceId]
    );
    return result[1] || 0;
  }

  /**
   * Delete all document chunks for a specific source type
   */
  async deleteBySourceType(
    dataSource: DataSource,
    sourceType: string
  ): Promise<number> {
    const result = await dataSource.query(
      `DELETE FROM document_chunks WHERE source_type = $1`,
      [sourceType]
    );
    return result[1] || 0;
  }

  /**
   * Get document count by source type
   */
  async getDocumentCounts(
    dataSource: DataSource
  ): Promise<Record<string, number>> {
    const results = await dataSource.query(`
      SELECT source_type, COUNT(*) as count
      FROM document_chunks
      GROUP BY source_type
    `);

    const counts: Record<string, number> = {};
    for (const row of results) {
      counts[row.source_type] = parseInt(row.count, 10);
    }
    return counts;
  }
}
