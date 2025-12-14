import { Injectable, Logger } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { VectorStoreService } from './vector-store.service';

export interface TextChunk {
  content: string;
  metadata?: Record<string, unknown>;
}

export interface ChunkingOptions {
  chunkSize?: number;
  chunkOverlap?: number;
  separator?: string;
}

export interface IndexingResult {
  sourceType: string;
  sourceId: string;
  chunksCreated: number;
  success: boolean;
  error?: string;
}

@Injectable()
export class EmbeddingService {
  private readonly logger = new Logger(EmbeddingService.name);

  constructor(private vectorStoreService: VectorStoreService) {}

  /**
   * Split text into chunks for embedding
   */
  chunkText(text: string, options: ChunkingOptions = {}): string[] {
    const {
      chunkSize = 500,
      chunkOverlap = 50,
      separator = '\n\n',
    } = options;

    // First, try to split by separator (paragraphs)
    const paragraphs = text.split(separator).filter((p) => p.trim());

    const chunks: string[] = [];
    let currentChunk = '';

    for (const paragraph of paragraphs) {
      // If paragraph itself is too long, split it further
      if (paragraph.length > chunkSize) {
        // Save current chunk if it has content
        if (currentChunk.trim()) {
          chunks.push(currentChunk.trim());
          currentChunk = '';
        }

        // Split long paragraph by sentences
        const sentences = paragraph.match(/[^.!?]+[.!?]+/g) || [paragraph];
        for (const sentence of sentences) {
          if (sentence.length > chunkSize) {
            // Split very long sentences by words
            const words = sentence.split(/\s+/);
            let wordChunk = '';
            for (const word of words) {
              if ((wordChunk + ' ' + word).length > chunkSize) {
                if (wordChunk) chunks.push(wordChunk.trim());
                wordChunk = word;
              } else {
                wordChunk += ' ' + word;
              }
            }
            if (wordChunk.trim()) chunks.push(wordChunk.trim());
          } else if ((currentChunk + ' ' + sentence).length > chunkSize) {
            if (currentChunk.trim()) chunks.push(currentChunk.trim());
            currentChunk = sentence;
          } else {
            currentChunk += ' ' + sentence;
          }
        }
      } else if ((currentChunk + separator + paragraph).length > chunkSize) {
        // Current chunk would exceed size, save it and start new
        if (currentChunk.trim()) {
          chunks.push(currentChunk.trim());
        }
        currentChunk = paragraph;
      } else {
        // Add to current chunk
        currentChunk += (currentChunk ? separator : '') + paragraph;
      }
    }

    // Don't forget the last chunk
    if (currentChunk.trim()) {
      chunks.push(currentChunk.trim());
    }

    // Add overlap between chunks for better context
    if (chunkOverlap > 0 && chunks.length > 1) {
      const overlappedChunks: string[] = [];
      for (let i = 0; i < chunks.length; i++) {
        let chunk = chunks[i];
        if (i > 0) {
          // Add overlap from previous chunk
          const prevChunk = chunks[i - 1];
          const overlapText = prevChunk.slice(-chunkOverlap);
          chunk = overlapText + ' ' + chunk;
        }
        overlappedChunks.push(chunk.trim());
      }
      return overlappedChunks;
    }

    return chunks;
  }

  /**
   * Index a knowledge article for RAG
   */
  async indexKnowledgeArticle(
    dataSource: DataSource,
    article: {
      id: string;
      title: string;
      content: string;
      summary?: string;
      categoryId?: string;
      tags?: string[];
    }
  ): Promise<IndexingResult> {
    try {
      // Delete existing chunks for this article
      await this.vectorStoreService.deleteBySource(
        dataSource,
        'knowledge_article',
        article.id
      );

      // Prepare full text with title for better context
      const fullText = `${article.title}\n\n${article.content}`;
      const chunks = this.chunkText(fullText);

      // Create document chunks
      const documents = chunks.map((content, index) => ({
        tenantId: '', // Will be set by the data source context
        sourceType: 'knowledge_article' as const,
        sourceId: article.id,
        content,
        metadata: {
          title: article.title,
          summary: article.summary,
          categoryId: article.categoryId,
          tags: article.tags,
          chunkIndex: index,
          totalChunks: chunks.length,
        },
      }));

      await this.vectorStoreService.upsertDocuments(dataSource, documents);

      this.logger.log(
        `Indexed knowledge article ${article.id} with ${chunks.length} chunks`
      );

      return {
        sourceType: 'knowledge_article',
        sourceId: article.id,
        chunksCreated: chunks.length,
        success: true,
      };
    } catch (error) {
      this.logger.error(`Failed to index knowledge article ${article.id}`, error);
      return {
        sourceType: 'knowledge_article',
        sourceId: article.id,
        chunksCreated: 0,
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Index a catalog item for RAG
   */
  async indexCatalogItem(
    dataSource: DataSource,
    item: {
      id: string;
      label: string;
      shortDescription: string;
      description?: string;
      categoryId?: string;
      categoryLabel?: string;
    }
  ): Promise<IndexingResult> {
    try {
      await this.vectorStoreService.deleteBySource(
        dataSource,
        'catalog_item',
        item.id
      );

      const fullText = [
        item.label,
        item.shortDescription,
        item.description,
      ]
        .filter(Boolean)
        .join('\n\n');

      const chunks = this.chunkText(fullText);

      const documents = chunks.map((content, index) => ({
        tenantId: '',
        sourceType: 'catalog_item' as const,
        sourceId: item.id,
        content,
        metadata: {
          label: item.label,
          shortDescription: item.shortDescription,
          categoryId: item.categoryId,
          categoryLabel: item.categoryLabel,
          chunkIndex: index,
          totalChunks: chunks.length,
        },
      }));

      await this.vectorStoreService.upsertDocuments(dataSource, documents);

      return {
        sourceType: 'catalog_item',
        sourceId: item.id,
        chunksCreated: chunks.length,
        success: true,
      };
    } catch (error) {
      return {
        sourceType: 'catalog_item',
        sourceId: item.id,
        chunksCreated: 0,
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Index a generic record from any collection
   */
  async indexRecord(
    dataSource: DataSource,
    record: {
      collectionName: string;
      id: string;
      displayValue: string;
      searchableFields: Record<string, string>;
    }
  ): Promise<IndexingResult> {
    try {
      const sourceId = `${record.collectionName}:${record.id}`;
      await this.vectorStoreService.deleteBySource(dataSource, 'record', sourceId);

      // Combine searchable fields into text
      const textParts = [record.displayValue];
      for (const [field, value] of Object.entries(record.searchableFields)) {
        if (value) {
          textParts.push(`${field}: ${value}`);
        }
      }
      const fullText = textParts.join('\n');

      const chunks = this.chunkText(fullText, { chunkSize: 300 });

      const documents = chunks.map((content, index) => ({
        tenantId: '',
        sourceType: 'record' as const,
        sourceId,
        content,
        metadata: {
          collectionName: record.collectionName,
          recordId: record.id,
          displayValue: record.displayValue,
          chunkIndex: index,
          totalChunks: chunks.length,
        },
      }));

      await this.vectorStoreService.upsertDocuments(dataSource, documents);

      return {
        sourceType: 'record',
        sourceId,
        chunksCreated: chunks.length,
        success: true,
      };
    } catch (error) {
      return {
        sourceType: 'record',
        sourceId: `${record.collectionName}:${record.id}`,
        chunksCreated: 0,
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Remove a document from the index
   */
  async removeFromIndex(
    dataSource: DataSource,
    sourceType: string,
    sourceId: string
  ): Promise<void> {
    await this.vectorStoreService.deleteBySource(dataSource, sourceType, sourceId);
    this.logger.log(`Removed ${sourceType}:${sourceId} from index`);
  }
}
