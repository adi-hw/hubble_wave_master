import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { UserRequestContext } from '@hubblewave/auth-guard';
import {
  AuditLog,
  CollectionAccessRule,
  SearchExperience,
  SearchSource,
} from '@hubblewave/instance-db';
import { buildSearchParams, FacetConfig, FilterCondition } from '@hubblewave/search-typesense';
import {
  compileSearchAuthz,
  emitTypesenseFilterBy,
} from '@hubblewave/search-authz';
import type { FilterAst } from '@hubblewave/search-authz';
import type { CollectionAccessRuleData } from '@hubblewave/authorization';
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
  context: UserRequestContext;
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
    @InjectRepository(AuditLog)
    private readonly auditRepo: Repository<AuditLog>,
    @InjectRepository(CollectionAccessRule)
    private readonly collectionAccessRuleRepo: Repository<CollectionAccessRule>,
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
        pagination_approximate: false,
      };
    }

    const sourceTypes = sources.map((source) => {
      const config = (source.config || {}) as SearchSourceConfig;
      return config.source_type || source.collectionCode;
    });

    const mode = this.resolveMode(request.mode, experienceConfig);

    // Build the authz pre-filter AST. The compiler translates §28
    // CollectionAccessRules into an engine-neutral FilterAst that is then
    // rendered by engine-specific emitters:
    //   - Typesense: emitTypesenseFilterBy → filter_by string (lexical path)
    //   - pgvector: emitPgvectorWhere → parameterized SQL WHERE (semantic path)
    // This replaces the per-hit post-filter loop (F136).
    const authzResult = await this.buildAuthzAst(request.context, sources);
    const authzFilterBy = authzResult.filterBy;

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
      authzFilterBy,
      request,
    });

    const { semanticHits, semanticTotal } = await this.runSemanticSearch({
      mode,
      q,
      sourceTypes,
      request,
      experienceConfig,
      authzAst: authzResult.ast,
      authzAttrs: authzResult.userAttrs,
    });

    const mergedHits = this.mergeHits({
      mode,
      lexicalHits,
      semanticHits,
      experienceConfig,
    });

    const facetCounts = this.resolveFacetCounts(mode, facets, mergedHits, response);
    const result = {
      found: mergedHits.length,
      out_of: mergedHits.length,
      page: response?.page || request.page || 1,
      hits: mergedHits,
      facet_counts: facetCounts,
      pagination_approximate: false,
    };

    await this.auditSearch(request, sources, {
      total: mergedHits.length,
      filtered: 0,
      lexicalTotal,
      semanticTotal,
      mode,
      semanticThreshold: request.semanticThreshold ?? this.resolveSemanticThreshold(experienceConfig),
    });
    return result;
  }

  /**
   * Compile the §28 record-visibility AST for the active user across all
   * collections covered by the active sources, and return:
   *
   *   - `ast`       — engine-neutral FilterAst (passed to pgvector emitter)
   *   - `filterBy`  — Typesense filter_by string (lexical path)
   *   - `userAttrs` — ABAC attribute context (passed to both emitters)
   *
   * Both emitters (Typesense + pgvector) consume the same AST compiled here.
   * The AST is produced once per request — not once per engine.
   *
   * Canon §28.6 (W2 Stream 2 PR5): admin users flow through the §28 evaluator
   * uniformly with every other role. Admin authority comes from the
   * `1931100000000-seed-admin-policies.ts` migration (broad-allow
   * `CollectionAccessRule` rows for the admin role on every system collection).
   * The compiler converts each unconditional allow into `in_collection` and
   * OR-combines them, producing an effective allow-all over the configured
   * search sources without any special-case branch.
   *
   * The pre-Stream-2-PR5 `if (ctx.isAdmin) return allow_all` short-circuit was
   * retired to keep the §28 evaluator the single source of truth across
   * collection, field, and search surfaces (matches the Plan Fix 33 retirement
   * in AuthorizationService.canAccessCollection).
   */
  private async buildAuthzAst(
    context: UserRequestContext,
    sources: SearchSource[],
  ): Promise<{
    ast: FilterAst;
    filterBy: string;
    userAttrs: Record<string, string | number | boolean | null>;
  }> {
    const allowAll: FilterAst = { kind: 'allow_all' };
    const collectionIds = this.resolveCollectionIds(sources);
    if (!collectionIds.length) {
      // No collection-keyed sources → no §28 collection-rule lookup
      // possible. The non-collection-keyed search surfaces (knowledge
      // base, AVA suggestions, etc.) carry their own authz; the
      // collection-id pre-filter does not apply.
      return { ast: allowAll, filterBy: '', userAttrs: this.buildAttributeContext(context) };
    }

    const rules = await this.collectionAccessRuleRepo.find({
      where: { collectionId: In(collectionIds), isActive: true },
      order: { priority: 'ASC' },
    });

    const ruleData: CollectionAccessRuleData[] = rules.map((r) => ({
      id: r.id,
      collectionId: r.collectionId,
      name: r.name,
      description: r.description ?? null,
      roleId: r.roleId ?? null,
      groupId: r.groupId ?? null,
      userId: r.userId ?? null,
      canRead: r.canRead,
      canCreate: r.canCreate,
      canUpdate: r.canUpdate,
      canDelete: r.canDelete,
      conditions: r.conditions as CollectionAccessRuleData['conditions'] ?? null,
      priority: r.priority,
      isActive: r.isActive,
      effect: (r.effect as 'allow' | 'deny') ?? 'allow',
    }));

    const ast = compileSearchAuthz({
      userId: context.userId,
      userRoleIds: context.roleIds,
      userGroupIds: [],
      collectionRules: ruleData,
    });

    const userAttrs = this.buildAttributeContext(context);
    const filterBy = emitTypesenseFilterBy(ast, userAttrs);
    return { ast, filterBy, userAttrs };
  }

  /**
   * Build the ABAC attribute context from the active UserRequestContext.
   * These values are substituted into `attribute_match` AST nodes at query time.
   */
  private buildAttributeContext(context: UserRequestContext): Record<string, string | number | boolean | null> {
    return {
      userId: context.userId,
    };
  }

  /**
   * Resolve the collection UUIDs covered by the active search sources.
   * Uses `config.collection_id` when set on the source.
   */
  private resolveCollectionIds(sources: SearchSource[]): string[] {
    const ids = new Set<string>();
    for (const source of sources) {
      const config = (source.config || {}) as SearchSourceConfig;
      if (config.collection_id) {
        ids.add(config.collection_id);
      }
    }
    return [...ids];
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
    authzFilterBy: string;
    request: SearchQueryRequest;
  }): Promise<{ lexicalHits: SearchHit[]; lexicalTotal: number; response?: { page: number; found?: number; facet_counts?: unknown[] } }> {
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

    // Inject the authz pre-filter into the Typesense filter_by param.
    // Typesense combines multiple filter_by strings with && when passed
    // as separate params; here we build the combined string directly.
    const existingFilter = searchParams.filter_by;
    const combinedFilter = this.combineFilters(existingFilter, params.authzFilterBy);

    const response = await this.typesenseService.searchDocuments({
      ...searchParams,
      filter_by: combinedFilter,
    });
    const hits = ((response.hits || []) as Array<{
      text_match?: number;
      document?: Record<string, unknown>;
      highlights?: unknown;
    }>).map((hit) => ({
      score: hit.text_match ?? 0,
      document: (hit.document || {}) as Record<string, unknown>,
      highlights: hit.highlights,
    }));

    return {
      lexicalHits: hits,
      lexicalTotal: hits.length,
      response,
    };
  }

  /**
   * Combine an existing filter_by string from buildSearchParams with the
   * authz pre-filter. When both are present they are AND-combined. When
   * the authz filter is empty (allow_all) the existing filter is preserved.
   */
  private combineFilters(
    existingFilter: string | undefined,
    authzFilter: string,
  ): string | undefined {
    if (!authzFilter) {
      return existingFilter;
    }
    if (!existingFilter) {
      return authzFilter;
    }
    return `(${existingFilter}) && (${authzFilter})`;
  }

  private async runSemanticSearch(params: {
    mode: SearchMode;
    q: string;
    sourceTypes: string[];
    request: SearchQueryRequest;
    experienceConfig: Record<string, unknown>;
    /**
     * §28 pre-filter AST for the pgvector path. When provided the emitter
     * translates the AST into a parameterized SQL WHERE clause that is
     * AND-combined into the cosine-similarity query before ranking runs.
     * This replaces any post-fetch authzCheck loop on the vector path.
     */
    authzAst?: FilterAst;
    authzAttrs?: Record<string, string | number | boolean | null>;
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
      authzAst: params.authzAst,
      authzAttrs: params.authzAttrs ?? {},
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
    response?: { facet_counts?: unknown[] },
  ) {
    if (!facets.length) {
      return [];
    }
    if (mode === 'lexical' && response?.facet_counts?.length) {
      // The authz pre-filter is injected into the Typesense query, so
      // facet_counts from the engine already reflect only authorized records.
      // Return the engine's facet counts directly — they are corpus-accurate.
      return response.facet_counts;
    }
    // Semantic / hybrid: compute facets from the merged hit set (page-local).
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
}
