import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, In, Repository } from 'typeorm';
import { AuthorizationService } from '@hubblewave/authorization';
import { RequestContext } from '@hubblewave/auth-guard';
import { AuditLog, CollectionDefinition, SearchExperience, SearchSource } from '@hubblewave/instance-db';
import { buildSearchParams, FacetConfig, FilterCondition } from '@hubblewave/search-typesense';
import { SearchEmbeddingService } from './search-embedding.service';
import { SearchTypesenseService } from './search-typesense.service';
import { SearchSourceConfig } from './search.types';

type SearchMode = 'lexical' | 'semantic' | 'hybrid';

type SearchHit = {
  score: number;
  document: Record<string, unknown>;
  highlights?: unknown;
};

export type SearchQueryRequest = {
  q: string;
  context: RequestContext;
  experienceCode?: string;
  sourceCodes?: string[];
  page?: number;
  perPage?: number;
  filters?: FilterCondition[];
  facets?: FacetConfig[];
  sortBy?: string;
  queryBy?: string[];
  mode?: SearchMode;
  semanticLimit?: number;
  semanticThreshold?: number;
};

@Injectable()
export class SearchQueryService {
  constructor(
    @InjectRepository(SearchExperience)
    private readonly experienceRepo: Repository<SearchExperience>,
    @InjectRepository(SearchSource)
    private readonly sourceRepo: Repository<SearchSource>,
    @InjectRepository(CollectionDefinition)
    private readonly collectionRepo: Repository<CollectionDefinition>,
    @InjectRepository(AuditLog)
    private readonly auditRepo: Repository<AuditLog>,
    private readonly dataSource: DataSource,
    private readonly authz: AuthorizationService,
    private readonly typesenseService: SearchTypesenseService,
    private readonly embeddingService: SearchEmbeddingService,
  ) {}

  async query(request: SearchQueryRequest) {
    const q = request.q?.trim();
    if (!q) {
      throw new BadRequestException('q is required');
    }

    const experience = request.experienceCode
      ? await this.experienceRepo.findOne({
          where: { code: request.experienceCode, isActive: true },
        })
      : null;
    if (request.experienceCode && !experience) {
      throw new NotFoundException(`Search experience ${request.experienceCode} not found`);
    }

    const experienceConfig = (experience?.config || {}) as Record<string, unknown>;
    const sourceCodes = this.resolveSourceCodes(request.sourceCodes, experienceConfig);
    const sources = await this.resolveSources(sourceCodes);
    if (!sources.length) {
      return {
        found: 0,
        out_of: 0,
        page: request.page || 1,
        hits: [],
        facet_counts: [],
      };
    }

    const sourceTypes = sources.map((source) => {
      const config = (source.config || {}) as SearchSourceConfig;
      return config.source_type || source.collectionCode;
    });

    const mode = this.resolveMode(request.mode, experienceConfig);
    const filters = this.mergeFilters(
      request.filters,
      experienceConfig['filters'] as FilterCondition[] | undefined,
      sourceTypes,
    );
    const facets =
      request.facets ||
      (experienceConfig['facets'] as FacetConfig[] | undefined) ||
      [];
    const queryBy =
      request.queryBy ||
      (experienceConfig['query_by'] as string[] | undefined) ||
      ['title', 'content', 'tags'];

    const { lexicalHits, lexicalTotal, response } = await this.runLexicalSearch({
      mode,
      q,
      queryBy,
      filters,
      facets,
      request,
    });

    const { semanticHits, semanticTotal } = await this.runSemanticSearch({
      mode,
      q,
      sourceTypes,
      request,
      experienceConfig,
    });

    const mergedHits = this.mergeHits({
      mode,
      lexicalHits,
      semanticHits,
      experienceConfig,
    });

    const trimmedHits = await this.trimUnauthorized(request.context, mergedHits, sources);
    const filteredCount = mergedHits.length - trimmedHits.length;
    const facetCounts = this.resolveFacetCounts(
      mode,
      facets,
      trimmedHits,
      filteredCount,
      response?.facet_counts || [],
    );
    const result = {
      found: trimmedHits.length,
      out_of: trimmedHits.length,
      page: response?.page || request.page || 1,
      hits: trimmedHits,
      facet_counts: facetCounts,
    };

    await this.auditSearch(request, sources, {
      total: mergedHits.length,
      filtered: filteredCount,
      lexicalTotal,
      semanticTotal,
      mode,
      semanticThreshold: request.semanticThreshold ?? this.resolveSemanticThreshold(experienceConfig),
    });
    return result;
  }

  private resolveMode(requestMode: SearchMode | undefined, config: Record<string, unknown>): SearchMode {
    const configured = typeof config['mode'] === 'string' ? (config['mode'] as SearchMode) : undefined;
    const mode = requestMode || configured || 'lexical';
    return mode === 'semantic' || mode === 'hybrid' ? mode : 'lexical';
  }

  private async runLexicalSearch(params: {
    mode: SearchMode;
    q: string;
    queryBy: string[];
    filters: FilterCondition[];
    facets: FacetConfig[];
    request: SearchQueryRequest;
  }): Promise<{ lexicalHits: SearchHit[]; lexicalTotal: number; response?: { page: number; facet_counts?: unknown[] } }> {
    if (params.mode === 'semantic') {
      return { lexicalHits: [], lexicalTotal: 0 };
    }

    const searchParams = buildSearchParams({
      q: params.q,
      queryBy: this.uniqueList(params.queryBy),
      filters: params.filters,
      facets: params.facets,
      page: params.request.page,
      perPage: params.request.perPage,
      sortBy: params.request.sortBy,
    });

    const response = await this.typesenseService.searchDocuments(searchParams);
    const hits = (response.hits || []).map((hit) => ({
      score: hit.text_match,
      document: (hit.document || {}) as Record<string, unknown>,
      highlights: hit.highlights,
    }));

    return {
      lexicalHits: hits,
      lexicalTotal: hits.length,
      response,
    };
  }

  private async runSemanticSearch(params: {
    mode: SearchMode;
    q: string;
    sourceTypes: string[];
    request: SearchQueryRequest;
    experienceConfig: Record<string, unknown>;
  }): Promise<{ semanticHits: SearchHit[]; semanticTotal: number }> {
    if (params.mode === 'lexical') {
      return { semanticHits: [], semanticTotal: 0 };
    }

    const limit = this.coercePositive(params.request.semanticLimit, this.resolveSemanticLimit(params.experienceConfig));
    const threshold = this.coerceNonNegative(
      params.request.semanticThreshold,
      this.resolveSemanticThreshold(params.experienceConfig),
    );

    const results = await this.embeddingService.search({
      query: params.q,
      limit,
      threshold,
      sourceTypes: params.sourceTypes,
    });

    const hits = results.map((entry) => ({
      score: entry.similarity,
      document: {
        source_type: entry.sourceType,
        source_id: entry.sourceId,
        content: entry.content,
        ...(entry.metadata || {}),
      },
    }));

    return {
      semanticHits: hits,
      semanticTotal: hits.length,
    };
  }

  private mergeHits(params: {
    mode: SearchMode;
    lexicalHits: SearchHit[];
    semanticHits: SearchHit[];
    experienceConfig: Record<string, unknown>;
  }): SearchHit[] {
    if (params.mode === 'semantic') {
      return params.semanticHits;
    }
    if (params.mode === 'lexical') {
      return params.lexicalHits;
    }

    const { lexicalWeight, semanticWeight } = this.resolveHybridWeights(params.experienceConfig);
    const normalizedLexical = this.normalizeLexicalScores(params.lexicalHits);
    const merged = new Map<string, SearchHit & { combinedScore: number }>();

    for (const hit of normalizedLexical) {
      const key = this.buildSourceKey(hit.document);
      if (!key) {
        continue;
      }
      merged.set(key, {
        ...hit,
        combinedScore: hit.score * lexicalWeight,
      });
    }

    for (const hit of params.semanticHits) {
      const key = this.buildSourceKey(hit.document);
      if (!key) {
        continue;
      }
      const existing = merged.get(key);
      const semanticScore = hit.score * semanticWeight;
      if (existing) {
        merged.set(key, {
          ...existing,
          combinedScore: existing.combinedScore + semanticScore,
        });
      } else {
        merged.set(key, {
          ...hit,
          combinedScore: semanticScore,
        });
      }
    }

    return Array.from(merged.values())
      .sort((a, b) => {
        if (b.combinedScore !== a.combinedScore) {
          return b.combinedScore - a.combinedScore;
        }
        const aKey = this.buildSourceKey(a.document) || '';
        const bKey = this.buildSourceKey(b.document) || '';
        return aKey.localeCompare(bKey);
      })
      .map((entry) => ({
        score: entry.combinedScore,
        document: entry.document,
        highlights: entry.highlights,
      }));
  }

  private resolveSemanticLimit(config: Record<string, unknown>): number {
    const value = Number(config['semantic_limit'] ?? 50);
    return Number.isFinite(value) && value > 0 ? value : 50;
  }

  private resolveSemanticThreshold(config: Record<string, unknown>): number {
    const value = Number(config['semantic_threshold'] ?? 0.65);
    return Number.isFinite(value) && value >= 0 ? value : 0.65;
  }

  private resolveHybridWeights(config: Record<string, unknown>): { lexicalWeight: number; semanticWeight: number } {
    const weights = (config['hybrid_weights'] || {}) as Record<string, unknown>;
    const lexical = this.coerceNumber(weights['lexical'], 0.6);
    const semantic = this.coerceNumber(weights['semantic'], 0.4);
    const total = lexical + semantic;
    if (total <= 0) {
      return { lexicalWeight: 0.6, semanticWeight: 0.4 };
    }
    return {
      lexicalWeight: lexical / total,
      semanticWeight: semantic / total,
    };
  }

  private coerceNumber(value: unknown, fallback: number): number {
    const num = typeof value === 'number' ? value : Number(value);
    return Number.isFinite(num) ? num : fallback;
  }

  private coercePositive(value: number | undefined, fallback: number): number {
    if (typeof value === 'number' && Number.isFinite(value) && value > 0) {
      return value;
    }
    return fallback;
  }

  private coerceNonNegative(value: number | undefined, fallback: number): number {
    if (typeof value === 'number' && Number.isFinite(value) && value >= 0) {
      return value;
    }
    return fallback;
  }

  private normalizeLexicalScores(hits: SearchHit[]): SearchHit[] {
    const maxScore = hits.reduce((max, hit) => (hit.score > max ? hit.score : max), 0);
    if (maxScore <= 0) {
      return hits.map((hit) => ({ ...hit, score: 0 }));
    }
    return hits.map((hit) => ({
      ...hit,
      score: hit.score / maxScore,
    }));
  }

  private buildSourceKey(document: Record<string, unknown>): string | null {
    const sourceType = String(document['source_type'] || '');
    const sourceId = String(document['source_id'] || '');
    if (!sourceType || !sourceId) {
      return null;
    }
    return `${sourceType}:${sourceId}`;
  }

  private resolveFacetCounts(
    mode: SearchMode,
    facets: FacetConfig[],
    hits: SearchHit[],
    filteredCount: number,
    typesenseFacetCounts: unknown[],
  ) {
    if (!facets.length) {
      return [];
    }
    if (mode === 'lexical' && filteredCount === 0) {
      return typesenseFacetCounts;
    }
    return this.buildFacetCounts(hits, facets);
  }

  private resolveSourceCodes(
    requestSources: string[] | undefined,
    experienceConfig: Record<string, unknown>,
  ): string[] | undefined {
    if (requestSources && requestSources.length) {
      return requestSources;
    }
    const configSources = experienceConfig['sources'];
    if (Array.isArray(configSources)) {
      return configSources.map(String);
    }
    return undefined;
  }

  private async resolveSources(sourceCodes?: string[]): Promise<SearchSource[]> {
    if (!sourceCodes || !sourceCodes.length) {
      return this.sourceRepo.find({ where: { isActive: true } });
    }
    return this.sourceRepo.find({ where: { code: In(sourceCodes), isActive: true } });
  }

  private async trimUnauthorized(
    context: RequestContext,
    hits: SearchHit[],
    sources: SearchSource[],
  ) {
    if (!hits.length) {
      return hits;
    }

    const sourceTypeMap = new Map<string, string>();
    for (const source of sources) {
      const config = (source.config || {}) as SearchSourceConfig;
      const sourceType = config.source_type || source.collectionCode;
      if (!sourceTypeMap.has(sourceType)) {
        sourceTypeMap.set(sourceType, source.collectionCode);
      }
    }

    const grouped = new Map<string, SearchHit[]>();
    for (const hit of hits) {
      const sourceType = String(hit.document['source_type'] || '');
      if (!sourceTypeMap.has(sourceType)) {
        continue;
      }
      const list = grouped.get(sourceType) ?? [];
      list.push(hit);
      grouped.set(sourceType, list);
    }

    const allowedIds = new Set<string>();
    for (const [sourceType, groupHits] of grouped.entries()) {
      const collectionCode = sourceTypeMap.get(sourceType);
      if (!collectionCode) {
        continue;
      }
      const collection = await this.collectionRepo.findOne({ where: { code: collectionCode } });
      if (!collection) {
        continue;
      }

      try {
        await this.authz.ensureTableAccess(context, collection.tableName, 'read');
      } catch {
        continue;
      }

      const ids = groupHits
        .map((hit) => String(hit.document['source_id'] || ''))
        .filter(Boolean);
      if (!ids.length) {
        continue;
      }

      const schemaName = this.ensureSafeIdentifier('public');
      const tableName = this.ensureSafeIdentifier(collection.tableName);
      const qb = this.dataSource
        .createQueryBuilder()
        .select('t.id', 'id')
        .from(`${schemaName}.${tableName}`, 't')
        .where('t."id" = ANY(:ids)', { ids });

      const rowLevel = await this.authz.buildRowLevelClause(context, collection.tableName, 'read', 't');
      if (rowLevel.clauses.length > 0) {
        rowLevel.clauses.forEach((clause, index) => {
          qb.andWhere(clause, this.prefixParams(rowLevel.params, `rls_${index}_`));
        });
      }

      const rows = await qb.getRawMany<{ id: string }>();
      rows.forEach((row) => allowedIds.add(String(row.id)));
    }

    return hits.filter((hit) => {
      const sourceType = String(hit.document['source_type'] || '');
      if (!sourceTypeMap.has(sourceType)) {
        return false;
      }
      const sourceId = String(hit.document['source_id'] || '');
      return allowedIds.has(sourceId);
    });
  }

  private async auditSearch(
    request: SearchQueryRequest,
    sources: SearchSource[],
    stats: {
      total: number;
      filtered: number;
      lexicalTotal: number;
      semanticTotal: number;
      mode: SearchMode;
      semanticThreshold: number;
    },
  ): Promise<void> {
    const payload = {
      q: request.q,
      experienceCode: request.experienceCode || null,
      sourceCodes: request.sourceCodes || sources.map((source) => source.code),
      page: request.page || 1,
      perPage: request.perPage || null,
      mode: stats.mode,
      total: stats.total,
      filtered: stats.filtered,
      lexicalTotal: stats.lexicalTotal,
      semanticTotal: stats.semanticTotal,
      semanticThreshold: stats.semanticThreshold,
    };
    const entry = this.auditRepo.create({
      userId: request.context.userId || null,
      action: 'search.query',
      collectionCode: 'search',
      newValues: payload,
    });
    await this.auditRepo.save(entry);
  }

  private mergeFilters(
    requestFilters: FilterCondition[] | undefined,
    experienceFilters: FilterCondition[] | undefined,
    sourceTypes: string[],
  ): FilterCondition[] {
    const merged: FilterCondition[] = [];
    if (experienceFilters?.length) {
      merged.push(...experienceFilters);
    }
    if (requestFilters?.length) {
      merged.push(...requestFilters);
    }
    if (sourceTypes.length) {
      merged.push({ field: 'source_type', operator: 'in', value: sourceTypes });
    }
    return merged;
  }

  private uniqueList(values: string[]): string[] {
    const seen = new Set<string>();
    const output: string[] = [];
    for (const value of values) {
      const trimmed = value.trim();
      if (!trimmed || seen.has(trimmed)) {
        continue;
      }
      seen.add(trimmed);
      output.push(trimmed);
    }
    return output;
  }

  private buildFacetCounts(
    hits: Array<{ score: number; document: Record<string, unknown> }>,
    facets: FacetConfig[],
  ) {
    const results: Array<{
      field_name: string;
      counts: Array<{ value: string; count: number }>;
    }> = [];

    for (const facet of facets) {
      const field = facet.field;
      const counts = new Map<string, number>();
      for (const hit of hits) {
        const value = hit.document[field];
        if (Array.isArray(value)) {
          for (const entry of value) {
            if (entry === null || entry === undefined) {
              continue;
            }
            const key = String(entry);
            counts.set(key, (counts.get(key) || 0) + 1);
          }
          continue;
        }
        if (value === null || value === undefined) {
          continue;
        }
        const key = String(value);
        counts.set(key, (counts.get(key) || 0) + 1);
      }

      const countsArray = Array.from(counts.entries())
        .map(([value, count]) => ({ value, count }))
        .sort((a, b) => b.count - a.count);

      results.push({ field_name: field, counts: countsArray });
    }

    return results;
  }

  private ensureSafeIdentifier(value: string): string {
    if (!value || !/^[A-Za-z_][A-Za-z0-9_]*$/.test(value)) {
      throw new BadRequestException(`Invalid identifier: ${value}`);
    }
    return value;
  }

  private prefixParams(params: Record<string, unknown>, prefix: string): Record<string, unknown> {
    const result: Record<string, unknown> = {};
    for (const key of Object.keys(params)) {
      result[`${prefix}${key}`] = params[key];
    }
    return result;
  }
}
