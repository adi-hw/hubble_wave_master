import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  SearchIndexState,
  SearchSource,
  RuntimeAnomalyService,
} from '@hubblewave/instance-db';
import { mapToTypesenseDocument, IndexableDocument } from '@hubblewave/search-typesense';
import { SearchTypesenseService } from './search-typesense.service';
import { SearchEmbeddingService } from './search-embedding.service';
import { RecordEventPayload, SearchSourceConfig } from './search.types';

@Injectable()
export class SearchIndexingService {
  private readonly logger = new Logger(SearchIndexingService.name);

  constructor(
    @InjectRepository(SearchSource)
    private readonly sourceRepo: Repository<SearchSource>,
    @InjectRepository(SearchIndexState)
    private readonly indexStateRepo: Repository<SearchIndexState>,
    private readonly typesenseService: SearchTypesenseService,
    private readonly embeddingService: SearchEmbeddingService,
    private readonly runtimeAnomalyService: RuntimeAnomalyService,
  ) {}

  async handleRecordEvent(payload: RecordEventPayload): Promise<void> {
    const sources = await this.sourceRepo.find({
      where: { collectionCode: payload.collectionCode, isActive: true },
    });
    if (!sources.length) {
      return;
    }

    const indexer = this.typesenseService.getIndexer();
    const eventType = payload.eventType;

    for (const source of sources) {
      const documentId = this.buildDocumentId(source.code, payload.recordId);
      try {
        if (eventType === 'record.deleted') {
          await indexer.delete(documentId);
          await this.embeddingService.deleteEmbeddings(
            this.resolveSourceType(source),
            payload.recordId,
          );
          await this.updateIndexState(payload.collectionCode, 'idle', payload, {
            lastEventType: eventType,
            lastRecordId: payload.recordId,
          });
          continue;
        }

        const record = payload.record;
        if (!record) {
          this.logger.warn(`Search index update skipped for ${payload.collectionCode}:${payload.recordId} — record payload missing`);
          await this.runtimeAnomalyService.record({
            kind: 'search_index_record_payload_missing',
            serviceCode: 'svc-search',
            message: `Search index update skipped for ${payload.collectionCode}:${payload.recordId}: record payload missing in event`,
            collectionCode: payload.collectionCode,
            recordId: payload.recordId,
            context: { eventType: payload.eventType, sourceCode: source.code },
          });
          continue;
        }

        const mapped = this.mapRecordToDocument(source, record, payload.recordId);
        const aclFields = this.buildAclFields(source, record);
        await indexer.upsert({ ...mapToTypesenseDocument(mapped), ...aclFields });
        await this.embeddingService.upsertRecordEmbeddings({
          sourceType: this.resolveSourceType(source),
          sourceId: payload.recordId,
          text: this.buildEmbeddingText(mapped),
          metadata: {
            title: mapped.title,
            collectionCode: source.collectionCode,
            recordId: payload.recordId,
            tags: mapped.tags,
          },
          options: {
            chunkSize: this.resolveChunkSize(source),
            chunkOverlap: this.resolveChunkOverlap(source),
          },
        });
        await this.updateIndexState(payload.collectionCode, 'idle', payload, {
          lastEventType: eventType,
          lastRecordId: payload.recordId,
        });
      } catch (error) {
        await this.updateIndexState(payload.collectionCode, 'failed', payload, {
          lastEventType: eventType,
          lastRecordId: payload.recordId,
          error: (error as Error).message,
        });
        this.logger.warn(`Search index update failed for ${payload.collectionCode}:${payload.recordId}`);
        await this.runtimeAnomalyService.record({
          kind: 'search_index_update_failed',
          serviceCode: 'svc-search',
          message: `Search index update failed for ${payload.collectionCode}:${payload.recordId}: ${(error as Error).message}`,
          collectionCode: payload.collectionCode,
          recordId: payload.recordId,
          context: { eventType, sourceCode: source.code, errorMessage: (error as Error).message },
          error: error as Error,
        });
        throw error;
      }
    }
  }

  /**
   * Build the ACL field overlay for a Typesense document.
   *
   * Always includes `_collection_id` (from `source.config.collection_id`).
   * Also includes `_<attribute>` for every field listed in
   * `source.config.acl_attributes`, reading the raw value from `record`.
   *
   * Fields missing from the record are omitted rather than emitted as null —
   * Typesense optional fields handle the absence gracefully and the
   * attribute_match emitter treats a missing attribute as deny_all.
   */
  private buildAclFields(
    source: SearchSource,
    record: Record<string, unknown>,
  ): Record<string, unknown> {
    const config = (source.config || {}) as SearchSourceConfig;
    const fields: Record<string, unknown> = {};

    if (config.collection_id) {
      fields['_collection_id'] = config.collection_id;
    }

    const aclAttributes = config.acl_attributes;
    if (Array.isArray(aclAttributes)) {
      for (const attr of aclAttributes) {
        const value = record[attr];
        if (value !== undefined && value !== null) {
          fields[`_${attr}`] = value;
        }
      }
    }

    return fields;
  }

  private mapRecordToDocument(
    source: SearchSource,
    record: Record<string, unknown>,
    recordId: string,
  ): IndexableDocument {
    const config = (source.config || {}) as SearchSourceConfig;
    const title = this.pickString(record, config.title_field);
    const content = this.buildContent(record, config.content_fields);
    const tags = this.collectTags(record, config.tag_fields);

    return {
      id: this.buildDocumentId(source.code, recordId),
      sourceType: config.source_type || source.collectionCode,
      sourceId: recordId,
      title: title || undefined,
      content,
      tags: tags.length ? tags : undefined,
      createdAt: this.pickTimestamp(record, 'created_at', 'createdAt'),
      updatedAt: this.pickTimestamp(record, 'updated_at', 'updatedAt'),
    };
  }

  private buildEmbeddingText(document: IndexableDocument): string {
    const parts = [document.title, document.content].filter(Boolean) as string[];
    return parts.join('\n');
  }

  private resolveSourceType(source: SearchSource): string {
    const config = (source.config || {}) as SearchSourceConfig;
    return config.source_type || source.collectionCode;
  }

  private resolveChunkSize(source: SearchSource): number | undefined {
    const config = (source.config || {}) as SearchSourceConfig;
    return typeof config.chunk_size === 'number' ? config.chunk_size : undefined;
  }

  private resolveChunkOverlap(source: SearchSource): number | undefined {
    const config = (source.config || {}) as SearchSourceConfig;
    return typeof config.chunk_overlap === 'number' ? config.chunk_overlap : undefined;
  }

  private buildDocumentId(sourceCode: string, recordId: string): string {
    return `${sourceCode}:${recordId}`;
  }

  private buildContent(record: Record<string, unknown>, fields?: string[]): string {
    const resolved = Array.isArray(fields) && fields.length ? fields : this.defaultContentFields(record);
    const fragments = resolved
      .map((field) => this.pickString(record, field))
      .filter((value): value is string => Boolean(value && value.trim()));
    return fragments.join('\n');
  }

  private collectTags(record: Record<string, unknown>, fields?: string[]): string[] {
    if (!Array.isArray(fields) || !fields.length) {
      return [];
    }
    const tags: string[] = [];
    for (const field of fields) {
      const value = record[field];
      if (Array.isArray(value)) {
        for (const entry of value) {
          if (entry !== null && entry !== undefined) {
            tags.push(String(entry));
          }
        }
        continue;
      }
      if (value !== null && value !== undefined) {
        tags.push(String(value));
      }
    }
    return tags;
  }

  private pickString(record: Record<string, unknown>, field?: string): string | null {
    if (!field) {
      return null;
    }
    const value = record[field];
    if (value === null || value === undefined) {
      return null;
    }
    return String(value);
  }

  private pickTimestamp(
    record: Record<string, unknown>,
    snakeKey: string,
    camelKey: string,
  ): Date | number | undefined {
    const value = record[snakeKey] ?? record[camelKey];
    if (!value) {
      return undefined;
    }
    if (value instanceof Date) {
      return value;
    }
    if (typeof value === 'string' || typeof value === 'number') {
      const parsed = new Date(value);
      if (!Number.isNaN(parsed.getTime())) {
        return parsed;
      }
      return typeof value === 'number' ? value : undefined;
    }
    return undefined;
  }

  private defaultContentFields(record: Record<string, unknown>): string[] {
    return Object.keys(record).filter((key) => {
      const value = record[key];
      return typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean';
    });
  }

  private async updateIndexState(
    collectionCode: string,
    status: SearchIndexState['status'],
    payload: RecordEventPayload,
    stats: Record<string, unknown>,
  ): Promise<void> {
    let state = await this.indexStateRepo.findOne({ where: { collectionCode } });
    if (!state) {
      state = this.indexStateRepo.create({
        collectionCode,
        status,
        lastIndexedAt: new Date(payload.occurredAt),
        lastCursor: payload.recordId,
        stats: stats,
      });
    } else {
      state.status = status;
      state.lastIndexedAt = new Date(payload.occurredAt);
      state.lastCursor = payload.recordId;
      state.stats = {
        ...(state.stats || {}),
        ...stats,
      };
    }
    await this.indexStateRepo.save(state);
  }
}
