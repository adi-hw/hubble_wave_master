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
  // 3. Admin flows through the §28 evaluator like every other role (Stream 2 PR5).
  //    Canon §28.6 — no silent admin bypass. The pre-W2 `if (ctx.isAdmin) return
  //    allow_all` short-circuit was retired. Admin authority now comes from the
  //    seeded admin policies (broad-allow CollectionAccessRule rows on system
  //    collections); the compiler turns each into an `in_collection` clause that
  //    matches the active search source. Behaviorally equivalent to the prior
  //    bypass for any search source covered by the seeded policies.
  // ==========================================================================

  it('admin flows through the §28 evaluator uniformly (no special-case branch)', async () => {
    // Simulate the seeded admin policy: an unconditional allow on the active
    // search source's collection, keyed on the admin's role. The compiler
    // produces `in_collection` for the collection → Typesense filter that
    // pre-filters to that collection's documents.
    collectionAccessRuleRepo.find.mockResolvedValue([
      makeRule({ roleId: 'role-alpha', conditions: null }),
    ]);
    stubLexicalResponse(10);

    await service.query({ q: 'pump', context: ctx(true) });

    // §28 evaluator IS consulted (no short-circuit). The pre-W2 assertion
    // `not.toHaveBeenCalled()` is inverted.
    expect(collectionAccessRuleRepo.find).toHaveBeenCalled();
    const callArgs = typesenseService.searchDocuments.mock.calls[0][0] as Record<string, unknown>;
    const filterBy = String(callArgs['filter_by'] || '');
    // Admin gets a real authz filter — `_collection_id:=` for the allowed
    // source — NOT the empty filter the short-circuit produced.
    expect(filterBy).toContain('_collection_id');
    expect(filterBy).toContain('col-uuid-aaa');
  });

  it('admin sees deny_all when no seeded policy matches (no implicit allow)', async () => {
    // Admin without any matching seeded policy gets the §28.3 level-3 default
    // deny like every other role — there is no implicit privilege. A misseeded
    // production environment would surface this as `__no_access__` rather than
    // as silent allow-all.
    collectionAccessRuleRepo.find.mockResolvedValue([]);
    stubLexicalResponse(0);

    await service.query({ q: 'pump', context: ctx(true) });

    expect(collectionAccessRuleRepo.find).toHaveBeenCalled();
    const callArgs = typesenseService.searchDocuments.mock.calls[0][0] as Record<string, unknown>;
    const filterBy = String(callArgs['filter_by'] || '');
    expect(filterBy).toContain('__no_access__');
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
