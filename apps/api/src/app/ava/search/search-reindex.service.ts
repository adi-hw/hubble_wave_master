import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, In, Repository } from 'typeorm';
import {
  CollectionDefinition,
  InstanceEventOutbox,
  SearchIndexState,
  SearchSource,
} from '@hubblewave/instance-db';
import { SearchTypesenseService } from './search-typesense.service';

export type SearchReindexRequest = {
  sourceCodes?: string[];
  collectionCodes?: string[];
  batchSize?: number;
};

@Injectable()
export class SearchReindexService {
  constructor(
    private readonly dataSource: DataSource,
    @InjectRepository(SearchSource)
    private readonly sourceRepo: Repository<SearchSource>,
    @InjectRepository(CollectionDefinition)
    private readonly collectionRepo: Repository<CollectionDefinition>,
    @InjectRepository(InstanceEventOutbox)
    private readonly outboxRepo: Repository<InstanceEventOutbox>,
    @InjectRepository(SearchIndexState)
    private readonly indexStateRepo: Repository<SearchIndexState>,
    private readonly typesenseService: SearchTypesenseService,
  ) {}

  async reindex(request: SearchReindexRequest, actorId?: string) {
    await this.typesenseService.refreshSynonyms();
    const sources = await this.resolveSources(request);
    if (!sources.length) {
      throw new NotFoundException('No active search sources found');
    }

    const batchSize = this.normalizeBatchSize(request.batchSize);
    const grouped = this.groupSourcesByCollection(sources);
    let totalQueued = 0;

    for (const [collectionCode, sourceCodes] of grouped.entries()) {
      const collection = await this.collectionRepo.findOne({ where: { code: collectionCode } });
      if (!collection) {
        throw new NotFoundException(`Collection ${collectionCode} not found`);
      }
      const tableName = this.safeIdentifier(collection.tableName);
      if (!tableName) {
        throw new BadRequestException(`Invalid table name for ${collectionCode}`);
      }

      await this.upsertIndexState(collectionCode, 'running', {
        reindexSources: sourceCodes,
        queued: 0,
      });

      let offset = 0;
      while (true) {
        const rows = await this.dataSource.query(
          `SELECT * FROM "public"."${tableName}" ORDER BY id ASC OFFSET $1 LIMIT $2`,
          [offset, batchSize],
        );
        if (!rows.length) {
          break;
        }

        const occurredAt = new Date().toISOString();
        const entries = rows
          .map((row: Record<string, unknown>) => {
            const recordId = row.id ? String(row.id) : null;
            if (!recordId) {
              return null;
            }
            return this.outboxRepo.create({
              eventType: 'search.index',
              collectionCode,
              recordId,
              payload: {
                eventType: 'record.updated',
                collectionCode,
                recordId,
                record: row,
                previousRecord: null,
                changedProperties: Object.keys(row || {}),
                userId: actorId ?? null,
                metadata: { reindex: true },
                occurredAt,
              },
              status: 'pending',
              attempts: 0,
            });
          })
          .filter((entry: InstanceEventOutbox | null): entry is InstanceEventOutbox => !!entry);

        if (entries.length) {
          await this.outboxRepo.save(entries);
          totalQueued += entries.length;
          await this.upsertIndexState(collectionCode, 'running', {
            reindexSources: sourceCodes,
            queued: totalQueued,
            lastQueuedAt: occurredAt,
          });
        }

        offset += rows.length;
      }
    }

    return {
      queued: totalQueued,
      sources: sources.length,
      collections: grouped.size,
    };
  }

  private async resolveSources(request: SearchReindexRequest): Promise<SearchSource[]> {
    const filters: Record<string, unknown> = { isActive: true };
    if (request.sourceCodes?.length) {
      filters['code'] = In(request.sourceCodes);
    }
    if (request.collectionCodes?.length) {
      filters['collectionCode'] = In(request.collectionCodes);
    }
    return this.sourceRepo.find({ where: filters });
  }

  private groupSourcesByCollection(sources: SearchSource[]): Map<string, string[]> {
    const grouped = new Map<string, string[]>();
    for (const source of sources) {
      const existing = grouped.get(source.collectionCode) ?? [];
      existing.push(source.code);
      grouped.set(source.collectionCode, existing);
    }
    return grouped;
  }

  private normalizeBatchSize(batchSize?: number): number {
    const resolved = batchSize ?? 500;
    if (!Number.isFinite(resolved) || resolved <= 0) {
      return 500;
    }
    return Math.min(Math.max(resolved, 100), 2000);
  }

  private safeIdentifier(value: string): string | null {
    if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(value)) {
      return null;
    }
    return value;
  }

  private async upsertIndexState(
    collectionCode: string,
    status: SearchIndexState['status'],
    stats: Record<string, unknown>,
  ): Promise<void> {
    let state = await this.indexStateRepo.findOne({ where: { collectionCode } });
    if (!state) {
      state = this.indexStateRepo.create({
        collectionCode,
        status,
        lastIndexedAt: null,
        lastCursor: null,
        stats: stats,
      });
    } else {
      state.status = status;
      state.stats = {
        ...(state.stats || {}),
        ...stats,
      };
    }
    await this.indexStateRepo.save(state);
  }
}
