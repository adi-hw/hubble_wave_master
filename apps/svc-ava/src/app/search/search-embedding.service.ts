import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DataSource } from 'typeorm';
import { LLMService } from '@hubblewave/ai';

export type SearchEmbeddingResult = {
  sourceType: string;
  sourceId: string;
  content: string;
  metadata: Record<string, unknown>;
  similarity: number;
};

type ChunkingOptions = {
  chunkSize?: number;
  chunkOverlap?: number;
  separator?: string;
};

@Injectable()
export class SearchEmbeddingService {
  private readonly logger = new Logger(SearchEmbeddingService.name);
  private readonly vectorDimension: number;

  constructor(
    private readonly dataSource: DataSource,
    private readonly llmService: LLMService,
    private readonly configService: ConfigService,
  ) {
    this.vectorDimension = this.configService.get<number>('EMBEDDING_DIMENSIONS', 768);
    this.logger.debug(`Embedding dimension set to ${this.vectorDimension}`);
  }

  async upsertRecordEmbeddings(params: {
    sourceType: string;
    sourceId: string;
    text: string;
    metadata: Record<string, unknown>;
    options?: ChunkingOptions;
  }): Promise<number> {
    const { sourceType, sourceId, text, metadata, options } = params;
    const normalized = text.trim();
    if (!normalized) {
      await this.deleteEmbeddings(sourceType, sourceId);
      return 0;
    }

    const chunks = this.chunkText(normalized, options);
    if (!chunks.length) {
      await this.deleteEmbeddings(sourceType, sourceId);
      return 0;
    }

    await this.deleteEmbeddings(sourceType, sourceId);

    const embeddings = await this.llmService.getEmbeddings(chunks);
    const rows = chunks.map((content, index) => {
      const embedding = this.normalizeEmbedding(embeddings[index] || []);
      return {
        content,
        embedding,
        index,
      };
    });

    for (const row of rows) {
      const embeddingStr = `[${row.embedding.join(',')}]`;
      await this.dataSource.query(
        `
        INSERT INTO search_embeddings
          (source_type, source_id, chunk_index, content, metadata, embedding, updated_at)
        VALUES ($1, $2, $3, $4, $5, $6::vector, NOW())
        ON CONFLICT (source_type, source_id, chunk_index)
        DO UPDATE SET
          content = EXCLUDED.content,
          metadata = EXCLUDED.metadata,
          embedding = EXCLUDED.embedding,
          updated_at = NOW()
        `,
        [
          sourceType,
          sourceId,
          row.index,
          row.content,
          JSON.stringify({
            ...metadata,
            chunkIndex: row.index,
            totalChunks: rows.length,
          }),
          embeddingStr,
        ],
      );
    }

    return rows.length;
  }

  async search(params: {
    query: string;
    limit?: number;
    threshold?: number;
    sourceTypes?: string[];
  }): Promise<SearchEmbeddingResult[]> {
    const { query, limit = 10, threshold = 0.65, sourceTypes } = params;
    const embedding = await this.llmService.getEmbedding(query);
    const embeddingStr = `[${embedding.join(',')}]`;

    let sql = `
      SELECT
        source_type,
        source_id,
        content,
        metadata,
        1 - (embedding <=> $1::vector) as similarity
      FROM search_embeddings
      WHERE 1 = 1
    `;
    const values: unknown[] = [embeddingStr];
    let index = 2;

    if (sourceTypes && sourceTypes.length) {
      sql += ` AND source_type = ANY($${index})`;
      values.push(sourceTypes);
      index += 1;
    }

    sql += `
      AND 1 - (embedding <=> $1::vector) >= $${index}
      ORDER BY embedding <=> $1::vector
      LIMIT $${index + 1}
    `;
    values.push(threshold, limit);

    const rows = await this.dataSource.query(sql, values);
    return rows.map((row: Record<string, unknown>) => ({
      sourceType: row['source_type'] as string,
      sourceId: row['source_id'] as string,
      content: row['content'] as string,
      metadata: (row['metadata'] as Record<string, unknown>) || {},
      similarity: Number(row['similarity'] || 0),
    }));
  }

  async deleteEmbeddings(sourceType: string, sourceId: string): Promise<void> {
    await this.dataSource.query(
      `DELETE FROM search_embeddings WHERE source_type = $1 AND source_id = $2`,
      [sourceType, sourceId],
    );
  }

  private chunkText(text: string, options: ChunkingOptions = {}): string[] {
    const { chunkSize = 500, chunkOverlap = 50, separator = '\n\n' } = options;
    const parts = text.split(separator).filter((part) => part.trim());
    const chunks: string[] = [];
    let current = '';

    for (const part of parts) {
      if (part.length > chunkSize) {
        if (current.trim()) {
          chunks.push(current.trim());
          current = '';
        }
        const sentences = part.match(/[^.!?]+[.!?]+/g) || [part];
        for (const sentence of sentences) {
          if (sentence.length > chunkSize) {
            const words = sentence.split(/\s+/);
            let wordChunk = '';
            for (const word of words) {
              if ((wordChunk + ' ' + word).length > chunkSize) {
                if (wordChunk) chunks.push(wordChunk.trim());
                wordChunk = word;
              } else {
                wordChunk += ` ${word}`;
              }
            }
            if (wordChunk.trim()) chunks.push(wordChunk.trim());
          } else if ((current + ' ' + sentence).length > chunkSize) {
            if (current.trim()) chunks.push(current.trim());
            current = sentence;
          } else {
            current += ` ${sentence}`;
          }
        }
      } else if ((current + separator + part).length > chunkSize) {
        if (current.trim()) chunks.push(current.trim());
        current = part;
      } else {
        current += current ? `${separator}${part}` : part;
      }
    }

    if (current.trim()) {
      chunks.push(current.trim());
    }

    if (chunkOverlap > 0 && chunks.length > 1) {
      return chunks.map((chunk, index) => {
        if (index === 0) return chunk;
        const overlapText = chunks[index - 1].slice(-chunkOverlap);
        return `${overlapText} ${chunk}`.trim();
      });
    }

    return chunks;
  }

  private normalizeEmbedding(embedding: number[]): number[] {
    if (embedding.length === this.vectorDimension) {
      return embedding;
    }
    if (embedding.length > this.vectorDimension) {
      this.logger.warn(`Embedding length ${embedding.length} exceeds ${this.vectorDimension}, truncating.`);
      return embedding.slice(0, this.vectorDimension);
    }
    if (embedding.length === 0) {
      return Array(this.vectorDimension).fill(0);
    }
    this.logger.warn(`Embedding length ${embedding.length} below ${this.vectorDimension}, padding.`);
    return embedding.concat(Array(this.vectorDimension - embedding.length).fill(0));
  }
}
