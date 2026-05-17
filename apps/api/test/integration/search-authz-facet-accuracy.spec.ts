/**
 * Canon §28 / W2 Stream 4b Task 35 — search authz facet accuracy.
 *
 * Facet counts MUST be computed over the authorized corpus, not the
 * total corpus. Pre-Stream-2 facet implementations that post-filtered
 * results would silently leak the existence of unauthorized records:
 * a user with no access to a 95-record collection would still see
 * "Status: open (95)" in the facet sidebar — disclosure of count
 * alone is information disclosure.
 *
 * This spec verifies the canon-compliant behavior end-to-end on both
 * engines:
 *
 *   pgvector path: the authz WHERE clause is AND-combined with the
 *   facet GROUP BY query, so the engine reports counts of the
 *   pre-filtered corpus. The integration test runs a real SQL
 *   `SELECT status, COUNT(*) GROUP BY status WHERE <authz>` against
 *   the seeded data and verifies counts reflect only authorized rows.
 *
 *   Typesense path: the `filter_by` clause is passed alongside the
 *   `facet_by` parameter, so Typesense computes facet counts after
 *   applying the pre-filter. The integration test reproduces this
 *   semantic in-memory: apply `filter_by` first, then count by the
 *   facet field. The assertion is that the in-memory counts match
 *   what pgvector returns from the equivalent query.
 *
 * Seeded fixture (12 rows across 3 collections):
 *   ALPHA (readable): 4 rows — status: open / closed / open / closed
 *   BETA (default deny): 4 rows — status: open / open / closed / closed
 *   GAMMA (explicit deny): 4 rows — status: closed / closed / closed / closed
 *
 * Expected facet counts after authz pre-filter:
 *   status=open: 2 (both from ALPHA)
 *   status=closed: 2 (both from ALPHA)
 *
 * If post-filtering were in use, BETA/GAMMA rows would contribute to
 * the counts and we'd see open=4, closed=8 — directly disclosing the
 * existence of denied records.
 */

import { DataSource } from 'typeorm';
import {
  type CollectionAccessRuleData,
} from '@hubblewave/authorization';
import {
  compileSearchAuthz,
  emitPgvectorWhere,
  emitTypesenseFilterBy,
} from '@hubblewave/search-authz';
import { createTestDataSource } from '../helpers/test-database';

const ROLE_ID = 'role-aaaa-1111-4111-8111-111111111111';
const USER_ID = 'user-bbbb-2222-4222-8222-222222222222';

const COL_ALPHA = '11111111-1111-4111-8111-aaaaaaaaaaaa';
const COL_BETA = '22222222-2222-4222-8222-bbbbbbbbbbbb';
const COL_GAMMA = '33333333-3333-4333-8333-cccccccccccc';

/**
 * Same in-memory Typesense interpreter shape the corpus-accuracy spec
 * uses; duplicated here to keep each spec file self-contained (no
 * shared helper file — explicit per the "one test file per acceptance
 * claim" plan structure).
 */
function tsMatches(filterBy: string, doc: Record<string, unknown>): boolean {
  const expr = filterBy.trim();
  if (!expr) return true;
  return evaluate(expr, doc);
}

function evaluate(expr: string, doc: Record<string, unknown>): boolean {
  const stripped = stripOuterParens(expr.trim());
  const orParts = splitTopLevel(stripped, '||');
  if (orParts.length > 1) return orParts.some((p) => evaluate(p.trim(), doc));
  const andParts = splitTopLevel(stripped, '&&');
  if (andParts.length > 1) return andParts.every((p) => evaluate(p.trim(), doc));
  if (stripped.startsWith('!')) return !evaluate(stripped.slice(1).trim(), doc);
  const inMatch = /^([A-Za-z_][A-Za-z0-9_]*):=\[([^\]]*)\]$/.exec(stripped);
  if (inMatch) {
    const values = inMatch[2].split(',').map((v) => v.trim()).map(unquote);
    return values.includes(String(doc[inMatch[1]] ?? ''));
  }
  const neMatch = /^([A-Za-z_][A-Za-z0-9_]*):!=(.*)$/.exec(stripped);
  if (neMatch) return String(doc[neMatch[1]] ?? '') !== unquote(neMatch[2].trim());
  const eqMatch = /^([A-Za-z_][A-Za-z0-9_]*):=(.*)$/.exec(stripped);
  if (eqMatch) return String(doc[eqMatch[1]] ?? '') === unquote(eqMatch[2].trim());
  throw new Error(`tsMatches: unsupported filter_by fragment: ${stripped}`);
}

function stripOuterParens(s: string): string {
  let cur = s;
  while (cur.startsWith('(') && cur.endsWith(')') && matchedOuterParens(cur)) {
    cur = cur.slice(1, -1).trim();
  }
  return cur;
}

function matchedOuterParens(s: string): boolean {
  let depth = 0;
  for (let i = 0; i < s.length; i++) {
    if (s[i] === '(') depth++;
    if (s[i] === ')') depth--;
    if (depth === 0 && i < s.length - 1) return false;
  }
  return depth === 0;
}

function splitTopLevel(s: string, sep: '&&' | '||'): string[] {
  const out: string[] = [];
  let depth = 0;
  let last = 0;
  for (let i = 0; i < s.length - 1; i++) {
    if (s[i] === '(') depth++;
    else if (s[i] === ')') depth--;
    else if (depth === 0 && s[i] === sep[0] && s[i + 1] === sep[1]) {
      out.push(s.slice(last, i));
      i += 1;
      last = i + 1;
    }
  }
  out.push(s.slice(last));
  return out;
}

function unquote(value: string): string {
  if (
    (value.startsWith('"') && value.endsWith('"')) ||
    (value.startsWith("'") && value.endsWith("'"))
  ) {
    return value.slice(1, -1);
  }
  return value;
}

interface SeedRow {
  source_type: string;
  source_id: string;
  collection_id: string;
  status: string;
}

function buildSeedRows(): SeedRow[] {
  return [
    // ALPHA — readable (status mix 50/50)
    { source_type: 'alpha', source_id: 'alpha-1', collection_id: COL_ALPHA, status: 'open' },
    { source_type: 'alpha', source_id: 'alpha-2', collection_id: COL_ALPHA, status: 'closed' },
    { source_type: 'alpha', source_id: 'alpha-3', collection_id: COL_ALPHA, status: 'open' },
    { source_type: 'alpha', source_id: 'alpha-4', collection_id: COL_ALPHA, status: 'closed' },
    // BETA — default deny (mostly open — would skew counts if leaked)
    { source_type: 'beta', source_id: 'beta-1', collection_id: COL_BETA, status: 'open' },
    { source_type: 'beta', source_id: 'beta-2', collection_id: COL_BETA, status: 'open' },
    { source_type: 'beta', source_id: 'beta-3', collection_id: COL_BETA, status: 'closed' },
    { source_type: 'beta', source_id: 'beta-4', collection_id: COL_BETA, status: 'closed' },
    // GAMMA — explicit deny (all closed — would distort facet view if leaked)
    { source_type: 'gamma', source_id: 'gamma-1', collection_id: COL_GAMMA, status: 'closed' },
    { source_type: 'gamma', source_id: 'gamma-2', collection_id: COL_GAMMA, status: 'closed' },
    { source_type: 'gamma', source_id: 'gamma-3', collection_id: COL_GAMMA, status: 'closed' },
    { source_type: 'gamma', source_id: 'gamma-4', collection_id: COL_GAMMA, status: 'closed' },
  ];
}

function buildRuleFixture(): CollectionAccessRuleData[] {
  const base = {
    groupId: null,
    userId: null,
    canRead: true,
    canCreate: false,
    canUpdate: false,
    canDelete: false,
    conditions: null,
    priority: 10,
    isActive: true,
    description: null,
  };
  return [
    {
      ...base,
      id: 'rule-alpha-allow',
      collectionId: COL_ALPHA,
      name: 'alpha-allow',
      roleId: ROLE_ID,
      effect: 'allow',
    },
    {
      ...base,
      id: 'rule-gamma-deny',
      collectionId: COL_GAMMA,
      name: 'gamma-deny',
      roleId: ROLE_ID,
      effect: 'deny',
      priority: 1,
    },
  ];
}

describe('Stream 4b Task 35 — search authz facet accuracy', () => {
  let dataSource: DataSource;
  let cleanup: () => Promise<void>;
  const seedRows = buildSeedRows();

  beforeAll(async () => {
    const created = await createTestDataSource({ schemas: [] });
    dataSource = created.dataSource;
    cleanup = created.cleanup;

    await dataSource.query(`
      CREATE TABLE search_embeddings (
        source_type text NOT NULL,
        source_id text NOT NULL,
        content text,
        _collection_id uuid,
        status text
      )
    `);

    for (const row of seedRows) {
      await dataSource.query(
        `INSERT INTO search_embeddings (source_type, source_id, content, _collection_id, status)
         VALUES ($1, $2, $3, $4, $5)`,
        [row.source_type, row.source_id, `content for ${row.source_id}`, row.collection_id, row.status],
      );
    }
  });

  afterAll(async () => {
    if (cleanup) await cleanup();
  });

  /**
   * Verify that the unauthorized counts WOULD distort the facet view
   * if the authz pre-filter weren't applied. This is the failure mode
   * the rest of the spec proves does not happen.
   */
  it('unfiltered count would leak unauthorized rows (sanity check)', async () => {
    const result = await dataSource.query<{ status: string; count: string }[]>(
      `SELECT status, COUNT(*) AS count FROM search_embeddings GROUP BY status ORDER BY status`,
    );
    const byStatus = Object.fromEntries(result.map((r) => [r.status, Number(r.count)]));
    expect(byStatus['open']).toBe(4); // 2 ALPHA + 2 BETA — leakage if reported to user
    expect(byStatus['closed']).toBe(8); // 2 ALPHA + 2 BETA + 4 GAMMA — same
  });

  /**
   * pgvector facet path: SQL GROUP BY over the authz pre-filtered
   * corpus. The engine never sees unauthorized rows so the facet
   * counts cannot leak them.
   */
  it('pgvector facet count matches the authorized corpus, not the total corpus', async () => {
    const ast = compileSearchAuthz({
      userId: USER_ID,
      userRoleIds: [ROLE_ID],
      userGroupIds: [],
      collectionRules: buildRuleFixture(),
    });
    const { clause, params } = emitPgvectorWhere(ast, {}, 1);

    const result = await dataSource.query<{ status: string; count: string }[]>(
      `SELECT status, COUNT(*) AS count
         FROM search_embeddings
         WHERE ${clause}
         GROUP BY status
         ORDER BY status`,
      params,
    );

    const byStatus = Object.fromEntries(result.map((r) => [r.status, Number(r.count)]));
    expect(byStatus['open']).toBe(2);
    expect(byStatus['closed']).toBe(2);
    // 'unspecified' from BETA/GAMMA must NOT appear.
    expect(Object.keys(byStatus).sort()).toEqual(['closed', 'open']);
  });

  /**
   * Typesense facet path: the same AST → emitTypesenseFilterBy → apply
   * to documents in-memory → group by `status`. The expected counts
   * MUST equal the pgvector path's. The two engines must agree on the
   * authorized facet view.
   */
  it('Typesense filter_by + in-memory facet counts match pgvector', () => {
    const ast = compileSearchAuthz({
      userId: USER_ID,
      userRoleIds: [ROLE_ID],
      userGroupIds: [],
      collectionRules: buildRuleFixture(),
    });
    const filterBy = emitTypesenseFilterBy(ast, {});

    const tsDocs = seedRows.map((r) => ({
      source_id: r.source_id,
      _collection_id: r.collection_id,
      status: r.status,
    }));
    const visible = tsDocs.filter((doc) => tsMatches(filterBy, doc));
    const byStatus = visible.reduce<Record<string, number>>((acc, d) => {
      const k = String(d.status);
      acc[k] = (acc[k] ?? 0) + 1;
      return acc;
    }, {});
    expect(byStatus['open']).toBe(2);
    expect(byStatus['closed']).toBe(2);
    expect(Object.keys(byStatus).sort()).toEqual(['closed', 'open']);
  });

  /**
   * User with zero allow rules sees an empty facet on both engines.
   * The compiler returns `deny_all`, both emitters emit their
   * sentinel form, and a `GROUP BY` over the WHERE-clause returns
   * zero rows. No leakage of facet keys.
   */
  it('user with no allow rules sees an empty facet on both engines', async () => {
    const ast = compileSearchAuthz({
      userId: USER_ID,
      userRoleIds: ['some-other-role'],
      userGroupIds: [],
      collectionRules: buildRuleFixture(),
    });

    const { clause, params } = emitPgvectorWhere(ast, {}, 1);
    const result = await dataSource.query(
      `SELECT status, COUNT(*) FROM search_embeddings WHERE ${clause} GROUP BY status`,
      params,
    );
    expect(result).toHaveLength(0);

    const filterBy = emitTypesenseFilterBy(ast, {});
    const tsDocs = seedRows.map((r) => ({ status: r.status, _collection_id: r.collection_id }));
    const visible = tsDocs.filter((doc) => tsMatches(filterBy, doc));
    expect(visible).toHaveLength(0);
  });
});
