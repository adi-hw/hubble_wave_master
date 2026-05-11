import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { AuthorizationService } from '@hubblewave/authorization';
import { RequestContext } from '@hubblewave/auth-guard';
import {
  AuditLog,
  CollectionDefinition,
  SearchExperience,
  SearchSource,
} from '@hubblewave/instance-db';
import { SearchEmbeddingService } from './search-embedding.service';
import { SearchTypesenseService } from './search-typesense.service';
import { SearchQueryService } from './search-query.service';

// F136-minimal: response-shape regression suite. Verifies the AVA
// search endpoint does NOT leak authz-filtered counts through `out_of`
// or facet aggregates, and surfaces the pagination-approximation flag
// when trimming occurred. The full pre-filter fix (push authz into
// Typesense/vector queries) is tracked as F136-full.
//
// Every collaborator is mocked — these tests exercise response shaping,
// not real search.

describe('SearchQueryService — F136 count-leak fix', () => {
  let service: SearchQueryService;
  let experienceRepo: { findOne: jest.Mock };
  let sourceRepo: { find: jest.Mock };
  let collectionRepo: { findOne: jest.Mock };
  let auditRepo: { create: jest.Mock; save: jest.Mock };
  let authz: {
    ensureCollectionAccess: jest.Mock;
    buildCollectionRowLevelClause: jest.Mock;
  };
  let typesenseService: { searchDocuments: jest.Mock };
  let embeddingService: { search: jest.Mock };
  let dataSourceQB: {
    select: jest.Mock;
    from: jest.Mock;
    where: jest.Mock;
    andWhere: jest.Mock;
    getRawMany: jest.Mock;
  };
  // The set of source-ids the row-level scan returns. Mutate per-test
  // to simulate "user can read N of M corpus rows".
  let allowedSourceIds: string[];

  const ctx = (): RequestContext => ({
    userId: 'user-1',
    roles: ['member'],
    permissions: [],
    isAdmin: false,
  });

  beforeEach(async () => {
    allowedSourceIds = [];

    experienceRepo = { findOne: jest.fn().mockResolvedValue(null) };

    sourceRepo = {
      find: jest.fn().mockResolvedValue([
        {
          code: 'work_orders',
          collectionCode: 'work_order',
          isActive: true,
          config: { source_type: 'work_order' },
        } as Partial<SearchSource>,
      ] as SearchSource[]),
    };

    collectionRepo = {
      findOne: jest.fn().mockResolvedValue({
        id: 'coll-1',
        code: 'work_order',
        tableName: 'work_orders',
      }),
    };

    auditRepo = {
      create: jest.fn((entry) => entry),
      save: jest.fn().mockResolvedValue(undefined),
    };

    authz = {
      ensureCollectionAccess: jest.fn().mockResolvedValue(undefined),
      buildCollectionRowLevelClause: jest
        .fn()
        .mockResolvedValue({ clauses: [], params: {} }),
    };

    typesenseService = {
      searchDocuments: jest.fn(),
    };

    embeddingService = { search: jest.fn().mockResolvedValue([]) };

    dataSourceQB = {
      select: jest.fn().mockReturnThis(),
      from: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      getRawMany: jest.fn(async () => allowedSourceIds.map((id) => ({ id }))),
    };

    const dataSource = {
      createQueryBuilder: jest.fn(() => dataSourceQB),
    } as unknown as DataSource;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SearchQueryService,
        { provide: getRepositoryToken(SearchExperience), useValue: experienceRepo },
        { provide: getRepositoryToken(SearchSource), useValue: sourceRepo },
        { provide: getRepositoryToken(CollectionDefinition), useValue: collectionRepo },
        { provide: getRepositoryToken(AuditLog), useValue: auditRepo },
        { provide: DataSource, useValue: dataSource },
        { provide: AuthorizationService, useValue: authz },
        { provide: SearchTypesenseService, useValue: typesenseService },
        { provide: SearchEmbeddingService, useValue: embeddingService },
      ],
    }).compile();

    service = module.get<SearchQueryService>(SearchQueryService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  // Helper: simulate a Typesense response containing N hits where each
  // hit's source_id is "doc-i". `corpusTotal` is what Typesense would
  // report as `found` / `out_of` for the full corpus — the leak vector.
  const stubLexicalCorpus = (visibleOnPage: number, facetCorpusValue: number) => {
    const hits = Array.from({ length: visibleOnPage }, (_, i) => ({
      text_match: 1000 - i,
      document: { source_type: 'work_order', source_id: `doc-${i}`, status: 'open' },
      highlights: [],
    }));
    typesenseService.searchDocuments.mockResolvedValue({
      hits,
      found: facetCorpusValue,
      out_of: facetCorpusValue,
      page: 1,
      facet_counts: [
        {
          field_name: 'status',
          counts: [{ value: 'open', count: facetCorpusValue }],
        },
      ],
    });
  };

  // ==========================================================================
  // 1. out_of must not leak the unfiltered corpus count
  // ==========================================================================

  it('collapses out_of to the post-trim count when the user can read few of many', async () => {
    // Corpus has 100 matches; the current page returns 20 hits but the
    // user is only authorized to read 5 of them.
    stubLexicalCorpus(20, 100);
    allowedSourceIds = ['doc-0', 'doc-1', 'doc-2', 'doc-3', 'doc-4'];

    const result = await service.query({ q: 'pump', context: ctx() });

    expect(result.found).toBe(5);
    // The leak vector: out_of must NEVER reflect the 100-document corpus.
    expect(result.out_of).toBeLessThanOrEqual(5);
    expect(result.out_of).toBe(result.found);
  });

  // ==========================================================================
  // 2. Facet counts must not leak the unfiltered corpus aggregates
  // ==========================================================================

  it('rebuilds facet counts from trimmed hits even when current page trimmed zero', async () => {
    // The current page happens to be entirely authorized (no trim on
    // THIS page), but Typesense's facet_counts reflect the full corpus
    // (which includes unauthorized records on other pages). The fix
    // forces facets to be recomputed from the page-local trimmed hits
    // so the corpus-wide aggregate is never exposed.
    stubLexicalCorpus(3, 100);
    allowedSourceIds = ['doc-0', 'doc-1', 'doc-2'];

    const result = await service.query({
      q: 'pump',
      context: ctx(),
      facets: [{ field: 'status' }],
    });

    expect(result.found).toBe(3);
    const statusFacet = (result.facet_counts as Array<{
      field_name: string;
      counts: Array<{ value: string; count: number }>;
    }>).find((f) => f.field_name === 'status');
    expect(statusFacet).toBeDefined();
    const openCount = statusFacet!.counts.find((c) => c.value === 'open');
    // The leak vector: openCount must not be the corpus-wide 100.
    expect(openCount!.count).toBeLessThanOrEqual(3);
  });

  // ==========================================================================
  // 3. pagination_approximate flag is true when any rows were trimmed
  // ==========================================================================

  it('sets pagination_approximate=true when trimming dropped at least one row', async () => {
    stubLexicalCorpus(10, 100);
    allowedSourceIds = ['doc-0', 'doc-1']; // 8 of 10 trimmed

    const result = await service.query({ q: 'pump', context: ctx() });

    expect(result.pagination_approximate).toBe(true);
  });

  // ==========================================================================
  // 4. No needless change when trimUnauthorized drops zero rows
  // ==========================================================================

  it('leaves out_of equal to found and pagination_approximate=false when no trim', async () => {
    stubLexicalCorpus(7, 7);
    allowedSourceIds = ['doc-0', 'doc-1', 'doc-2', 'doc-3', 'doc-4', 'doc-5', 'doc-6'];

    const result = await service.query({ q: 'pump', context: ctx() });

    expect(result.found).toBe(7);
    expect(result.out_of).toBe(7);
    expect(result.pagination_approximate).toBe(false);
  });
});
