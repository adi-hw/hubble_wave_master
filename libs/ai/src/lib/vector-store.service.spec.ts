/**
 * F073 (W1 task 9) regression — vector search now requires a principal
 * (RequestContext or SYSTEM sentinel) and supports a per-result
 * authzCheck callback for post-filter authorization. This spec
 * exercises only the principal + filter contract; the underlying SQL
 * query is mocked because the LLMService + DataSource setup needed for
 * a real call is heavyweight and unrelated to the security guarantee
 * under test.
 */

import {
  VectorStoreService,
  SearchResult,
  SYSTEM_VECTOR_SEARCH_CONTEXT,
} from './vector-store.service';
import type { UserRequestContext } from '@hubblewave/auth-guard';
import type { DataSource } from 'typeorm';

describe('VectorStoreService.search — F073 principal + authzCheck', () => {
  let svc: VectorStoreService;
  let llmServiceMock: { getEmbedding: jest.Mock };
  let configMock: { get: jest.Mock };
  let logMock: { log: jest.Mock; warn: jest.Mock; error: jest.Mock };

  function buildDataSourceMock(rows: Array<Partial<SearchResult> & Record<string, unknown>>): DataSource {
    return {
      query: jest.fn().mockResolvedValue(
        rows.map((r) => ({
          id: r.id ?? 'auto-id',
          source_type: r.sourceType ?? 'record',
          source_id: r.sourceId ?? 'auto-source',
          content: r.content ?? '',
          metadata: r.metadata ?? {},
          similarity: r.similarity ?? 0.9,
        })),
      ),
    } as unknown as DataSource;
  }

  function buildUserContext(userId: string): UserRequestContext {
    return {
      kind: 'user',
      userId,
      roles: [],
      permissions: [],
      isAdmin: false,
    };
  }

  beforeEach(() => {
    llmServiceMock = {
      getEmbedding: jest.fn().mockResolvedValue([0.1, 0.2, 0.3]),
    };
    configMock = { get: jest.fn().mockReturnValue(768) };
    logMock = { log: jest.fn(), warn: jest.fn(), error: jest.fn() };

    svc = new VectorStoreService(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      llmServiceMock as any,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      configMock as any,
    );
    // Replace the logger so we can assert audit-log entries.
    (svc as unknown as { logger: typeof logMock }).logger = logMock;
  });

  it('logs an audit entry attributing the search to a user principal', async () => {
    const ds = buildDataSourceMock([{ id: '1', sourceType: 'record', sourceId: 'A' }]);
    const ctx = buildUserContext('u-42');

    await svc.search(ds, 'find widgets', ctx);

    expect(logMock.log).toHaveBeenCalledWith(
      expect.stringMatching(/vector search by user:u-42 — query="find widgets"/),
    );
  });

  it('logs an audit entry for the SYSTEM principal', async () => {
    const ds = buildDataSourceMock([]);

    await svc.search(ds, 'reindex sweep', SYSTEM_VECTOR_SEARCH_CONTEXT);

    expect(logMock.log).toHaveBeenCalledWith(
      expect.stringMatching(/vector search by system/),
    );
  });

  it('warns when a user principal has no authzCheck (F073 visibility gap)', async () => {
    const ds = buildDataSourceMock([]);
    const ctx = buildUserContext('u-99');

    await svc.search(ds, 'q', ctx);

    expect(logMock.warn).toHaveBeenCalledWith(
      expect.stringMatching(/executed WITHOUT authzCheck \(F073 gap\)/),
    );
  });

  it('does NOT warn when SYSTEM principal has no authzCheck', async () => {
    const ds = buildDataSourceMock([]);

    await svc.search(ds, 'q', SYSTEM_VECTOR_SEARCH_CONTEXT);

    expect(logMock.warn).not.toHaveBeenCalled();
  });

  it('post-filters results using authzCheck — denied entries dropped', async () => {
    const ds = buildDataSourceMock([
      { id: '1', sourceType: 'record', sourceId: 'allow-A' },
      { id: '2', sourceType: 'record', sourceId: 'deny-B' },
      { id: '3', sourceType: 'record', sourceId: 'allow-C' },
      { id: '4', sourceType: 'record', sourceId: 'deny-D' },
    ]);
    const ctx = buildUserContext('u-1');
    const authzCheck = jest.fn(async (_sourceType: string, sourceId: string) => {
      return sourceId.startsWith('allow-');
    });

    const results = await svc.search(ds, 'q', ctx, { authzCheck });

    expect(authzCheck).toHaveBeenCalledTimes(4);
    expect(results.map((r) => r.sourceId)).toEqual(['allow-A', 'allow-C']);
    expect(logMock.log).toHaveBeenCalledWith(
      expect.stringMatching(/filter dropped 2\/4 result\(s\)/),
    );
  });

  it('treats authzCheck failures as DENY (fail-closed)', async () => {
    const ds = buildDataSourceMock([
      { id: '1', sourceType: 'record', sourceId: 'A' },
      { id: '2', sourceType: 'record', sourceId: 'B' },
    ]);
    const ctx = buildUserContext('u-1');
    const authzCheck = jest.fn(async (_sourceType: string, sourceId: string) => {
      if (sourceId === 'A') throw new Error('authz lookup failed');
      return true;
    });

    const results = await svc.search(ds, 'q', ctx, { authzCheck });

    // 'A' threw → treated as DENY. 'B' resolved true → kept.
    expect(results.map((r) => r.sourceId)).toEqual(['B']);
    expect(logMock.warn).toHaveBeenCalledWith(
      expect.stringMatching(/authzCheck threw for record\/A.*treating as DENY/),
    );
  });

  it('two users with different authz scopes see disjoint results from the same query', async () => {
    // The audit's headline scenario: user A indexes a chunk in
    // collection-α; user B (no read on α) issues a semantic query that
    // would match. With authzCheck wired, B's results MUST exclude
    // sourceId='alpha-doc'.
    const ds = buildDataSourceMock([
      { id: '1', sourceType: 'record', sourceId: 'alpha-doc' },
      { id: '2', sourceType: 'record', sourceId: 'beta-doc' },
    ]);

    const userA = buildUserContext('A');
    const userB = buildUserContext('B');

    // User A can see both collections.
    const checkA = jest.fn(async () => true);
    // User B can only see beta.
    const checkB = jest.fn(async (_t: string, id: string) => id !== 'alpha-doc');

    const resultsA = await svc.search(ds, 'q', userA, { authzCheck: checkA });
    const resultsB = await svc.search(ds, 'q', userB, { authzCheck: checkB });

    expect(resultsA.map((r) => r.sourceId)).toEqual(['alpha-doc', 'beta-doc']);
    expect(resultsB.map((r) => r.sourceId)).toEqual(['beta-doc']);
  });

  it('returns empty when LLM embedding generation fails', async () => {
    llmServiceMock.getEmbedding.mockResolvedValue([]);
    const ds = buildDataSourceMock([{ id: '1', sourceType: 'record', sourceId: 'A' }]);
    const ctx = buildUserContext('u-1');

    const results = await svc.search(ds, 'q', ctx);

    expect(results).toEqual([]);
    // Critical: even on the empty-embedding short-circuit, the audit
    // log MUST still capture the attempt. Otherwise an attacker could
    // probe whether their query embedded successfully without leaving
    // a trace.
    expect(logMock.log).toHaveBeenCalledWith(
      expect.stringMatching(/vector search by user:u-1/),
    );
  });
});
