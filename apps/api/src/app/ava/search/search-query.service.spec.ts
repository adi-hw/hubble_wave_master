import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { UserRequestContext } from '@hubblewave/auth-guard';
import {
  AuditLog,
  CollectionAccessRule,
  SearchExperience,
  SearchSource,
} from '@hubblewave/instance-db';
import { SearchEmbeddingService } from './search-embedding.service';
import { SearchTypesenseService } from './search-typesense.service';
import { SearchQueryService } from './search-query.service';

// F136 PR-2: Typesense pre-filter integration suite.
//
// Verifies that the authz pre-filter is wired into every Typesense search,
// that pagination counts are derived from engine-returned hits (not a
// post-filter trim), and that the response shape is stable and correct.
//
// All collaborators are mocked — these are unit tests that assert the
// filter_by string injected into the Typesense client.

describe('SearchQueryService — F136 PR-2 pre-filter', () => {
  let service: SearchQueryService;
  let experienceRepo: { findOne: jest.Mock };
  let sourceRepo: { find: jest.Mock };
  let auditRepo: { create: jest.Mock; save: jest.Mock };
  let collectionAccessRuleRepo: { find: jest.Mock };
  let typesenseService: { searchDocuments: jest.Mock };
  let embeddingService: { search: jest.Mock };

  const ctx = (isAdmin = false): UserRequestContext => ({
    kind: 'user',
    userId: 'user-1',
    roleIds: ['role-alpha'],
    roleCodes: ['role-alpha'],
    permissionCodes: [],
    groupIds: [],
    securityStamp: 'stamp-test',
    isAdmin,
  });

  const workOrderSource = {
    code: 'work_orders',
    collectionCode: 'work_order',
    isActive: true,
    config: {
      source_type: 'work_order',
      collection_id: 'col-uuid-aaa',
    },
  } as unknown as SearchSource;

  const makeRule = (overrides: Partial<{
    id: string;
    collectionId: string;
    name: string;
    description: null;
    roleId: string | null;
    groupId: string | null;
    userId: string | null;
    canRead: boolean;
    canCreate: boolean;
    canUpdate: boolean;
    canDelete: boolean;
    conditions: null;
    priority: number;
    isActive: boolean;
    effect: 'allow' | 'deny';
  }>) => ({
    id: `rule-${Math.random().toString(36).slice(2)}`,
    collectionId: 'col-uuid-aaa',
    name: 'test',
    description: null,
    roleId: 'role-alpha',
    groupId: null,
    userId: null,
    canRead: true,
    canCreate: false,
    canUpdate: false,
    canDelete: false,
    conditions: null,
    priority: 10,
    isActive: true,
    effect: 'allow' as const,
    ...overrides,
  });

  const stubLexicalResponse = (hitCount: number) => {
    const hits = Array.from({ length: hitCount }, (_, i) => ({
      text_match: 1000 - i,
      document: { source_type: 'work_order', source_id: `doc-${i}`, status: 'open' },
      highlights: [],
    }));
    typesenseService.searchDocuments.mockResolvedValue({
      hits,
      found: hitCount,
      out_of: hitCount,
      page: 1,
      facet_counts: [
        {
          field_name: 'status',
          counts: [{ value: 'open', count: hitCount }],
        },
      ],
    });
  };

  beforeEach(async () => {
    experienceRepo = { findOne: jest.fn().mockResolvedValue(null) };

    sourceRepo = {
      find: jest.fn().mockResolvedValue([workOrderSource]),
    };

    auditRepo = {
      create: jest.fn((entry) => entry),
      save: jest.fn().mockResolvedValue(undefined),
    };

    collectionAccessRuleRepo = {
      find: jest.fn().mockResolvedValue([makeRule({})]),
    };

    typesenseService = { searchDocuments: jest.fn() };
    embeddingService = { search: jest.fn().mockResolvedValue([]) };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SearchQueryService,
        { provide: getRepositoryToken(SearchExperience), useValue: experienceRepo },
        { provide: getRepositoryToken(SearchSource), useValue: sourceRepo },
        { provide: getRepositoryToken(AuditLog), useValue: auditRepo },
        { provide: getRepositoryToken(CollectionAccessRule), useValue: collectionAccessRuleRepo },
        { provide: SearchTypesenseService, useValue: typesenseService },
        { provide: SearchEmbeddingService, useValue: embeddingService },
      ],
    }).compile();

    service = module.get<SearchQueryService>(SearchQueryService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  // ==========================================================================
  // 1. filter_by is passed to Typesense for a user with a matching allow rule
  // ==========================================================================

  it('passes an authz filter_by clause to the Typesense client', async () => {
    stubLexicalResponse(5);

    await service.query({ q: 'pump', context: ctx() });

    expect(typesenseService.searchDocuments).toHaveBeenCalledTimes(1);
    const callArgs = typesenseService.searchDocuments.mock.calls[0][0] as Record<string, unknown>;
    expect(typeof callArgs['filter_by']).toBe('string');
    const filterBy = callArgs['filter_by'] as string;
    // The authz filter must reference the collection id.
    expect(filterBy).toContain('col-uuid-aaa');
  });

  // ==========================================================================
  // 2. When authz compiles to deny_all, the Typesense call still runs but
  //    receives the no-match sentinel filter.
  // ==========================================================================

  it('passes deny sentinel when no matching allow rules exist for the user', async () => {
    // Rule targets a different role — the compiler sees no matching rule.
    collectionAccessRuleRepo.find.mockResolvedValue([
      makeRule({ roleId: 'role-stranger' }),
    ]);
    stubLexicalResponse(0);

    await service.query({ q: 'pump', context: ctx() });

    const callArgs = typesenseService.searchDocuments.mock.calls[0][0] as Record<string, unknown>;
    const filterBy = callArgs['filter_by'] as string;
    expect(filterBy).toContain('__no_access__');
  });

  // ==========================================================================
  // 3. Admin bypasses the authz pre-filter (empty filter_by from authz layer)
  // ==========================================================================

  it('skips authz pre-filter for admin users', async () => {
    stubLexicalResponse(10);

    await service.query({ q: 'pump', context: ctx(true) });

    expect(collectionAccessRuleRepo.find).not.toHaveBeenCalled();
    const callArgs = typesenseService.searchDocuments.mock.calls[0][0] as Record<string, unknown>;
    // filter_by may contain the source_type filter but NOT a collection-id authz filter.
    const filterBy = String(callArgs['filter_by'] || '');
    expect(filterBy).not.toContain('_collection_id');
  });

  // ==========================================================================
  // 4. out_of == found (pagination is exact — no post-filter approximation)
  // ==========================================================================

  it('out_of equals found (pre-filter makes pagination exact)', async () => {
    stubLexicalResponse(7);

    const result = await service.query({ q: 'pump', context: ctx() });

    expect(result.found).toBe(7);
    expect(result.out_of).toBe(result.found);
    expect(result.pagination_approximate).toBe(false);
  });

  // ==========================================================================
  // 5. Facet counts come from the engine (not rebuilt from hits) in lexical mode
  // ==========================================================================

  it('returns engine facet_counts directly in lexical mode (corpus-accurate)', async () => {
    stubLexicalResponse(5);

    const result = await service.query({
      q: 'pump',
      context: ctx(),
      facets: [{ field: 'status' }],
    });

    const facetCounts = result.facet_counts as Array<{
      field_name: string;
      counts: Array<{ value: string; count: number }>;
    }>;
    const statusFacet = facetCounts.find((f) => f.field_name === 'status');
    expect(statusFacet).toBeDefined();
    // Engine reports 5 (the corpus count after pre-filter) — should be passed through.
    const openCount = statusFacet!.counts.find((c) => c.value === 'open');
    expect(openCount?.count).toBe(5);
  });

  // ==========================================================================
  // 6. No sources → early return without calling Typesense
  // ==========================================================================

  it('returns empty result without calling Typesense when no sources exist', async () => {
    sourceRepo.find.mockResolvedValue([]);

    const result = await service.query({ q: 'pump', context: ctx() });

    expect(result.found).toBe(0);
    expect(typesenseService.searchDocuments).not.toHaveBeenCalled();
  });

  // ==========================================================================
  // 7. Source without collection_id skips the authz pre-filter rule fetch
  // ==========================================================================

  it('skips rule fetch when source has no collection_id configured', async () => {
    sourceRepo.find.mockResolvedValue([
      {
        code: 'work_orders',
        collectionCode: 'work_order',
        isActive: true,
        config: { source_type: 'work_order' }, // no collection_id
      } as unknown as SearchSource,
    ]);
    stubLexicalResponse(3);

    await service.query({ q: 'pump', context: ctx() });

    // find is not called when collectionIds list is empty.
    expect(collectionAccessRuleRepo.find).not.toHaveBeenCalled();
  });

  // ==========================================================================
  // 8. Existing request filters are AND-combined with the authz filter
  // ==========================================================================

  it('AND-combines existing filters with the authz pre-filter', async () => {
    stubLexicalResponse(3);

    await service.query({
      q: 'pump',
      context: ctx(),
      filters: [{ field: 'status', operator: 'eq', value: 'open' }],
    });

    const callArgs = typesenseService.searchDocuments.mock.calls[0][0] as Record<string, unknown>;
    const filterBy = callArgs['filter_by'] as string;
    // Both the user filter and authz filter must appear.
    expect(filterBy).toContain('status');
    expect(filterBy).toContain('col-uuid-aaa');
  });

  // ==========================================================================
  // 9. Multiple allowed collections compile to an OR of in_collection clauses
  // ==========================================================================

  it('compiles multiple allowed collections to an OR filter', async () => {
    sourceRepo.find.mockResolvedValue([
      {
        code: 'work_orders',
        collectionCode: 'work_order',
        isActive: true,
        config: { source_type: 'work_order', collection_id: 'col-uuid-aaa' },
      } as unknown as SearchSource,
      {
        code: 'assets',
        collectionCode: 'asset',
        isActive: true,
        config: { source_type: 'asset', collection_id: 'col-uuid-bbb' },
      } as unknown as SearchSource,
    ]);
    collectionAccessRuleRepo.find.mockResolvedValue([
      makeRule({ collectionId: 'col-uuid-aaa' }),
      makeRule({ collectionId: 'col-uuid-bbb' }),
    ]);
    stubLexicalResponse(4);

    await service.query({ q: 'pump', context: ctx() });

    const callArgs = typesenseService.searchDocuments.mock.calls[0][0] as Record<string, unknown>;
    const filterBy = callArgs['filter_by'] as string;
    expect(filterBy).toContain('col-uuid-aaa');
    expect(filterBy).toContain('col-uuid-bbb');
    expect(filterBy).toContain('||');
  });
});
