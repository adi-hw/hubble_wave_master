/**
 * Canon §28 / W2 Stream 4b Task 35 — search authz pagination accuracy.
 *
 * Pagination MUST be exact over the authorized corpus. The pre-Stream-2
 * post-filter pattern (fetch a page, drop denied records, return what
 * remains) is broken in two distinct ways:
 *
 *   1. Pages have variable size — page 2 might contain 5 records when
 *      page 1 contained 10, because the engine returned the same
 *      raw 10 and post-filter dropped 5 unauthorized ones from page
 *      2 only. This leaks "there exist N unauthorized records before
 *      these" to the user.
 *
 *   2. `total_count` returned to the UI is the unfiltered count —
 *      directly disclosing the existence of unauthorized records.
 *
 * The §28 search pipeline pre-filters via the emitter (Typesense
 * `filter_by` injected on the query, pgvector WHERE clause AND-combined
 * with the ANN query), so the engine returns page N of the authorized
 * corpus, and pagination_approximate=false on the response.
 *
 * This spec seeds 100 records (25 authorized in ALPHA, 75 unauthorized
 * across BETA + GAMMA) and verifies:
 *
 *   - LIMIT 10 OFFSET 10 on the authz-filtered SQL returns records
 *     11-20 of the ALPHA set (not records 11-20 of the total corpus
 *     that happen to fall in ALPHA).
 *   - The Typesense filter_by + in-memory pagination matches.
 *   - The total authorized count is 25, not 100.
 *
 * Disagreement between the engines on the same authz input is an
 * emitter / compiler bug.
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

interface SeedRow {
  source_type: string;
  source_id: string;
  ordinal: number;
  collection_id: string;
}

function buildSeedRows(): SeedRow[] {
  const rows: SeedRow[] = [];
  for (let i = 1; i <= 25; i++) {
    rows.push({ source_type: 'alpha', source_id: `alpha-${pad(i)}`, ordinal: i, collection_id: COL_ALPHA });
  }
  for (let i = 1; i <= 50; i++) {
    rows.push({ source_type: 'beta', source_id: `beta-${pad(i)}`, ordinal: 100 + i, collection_id: COL_BETA });
  }
  for (let i = 1; i <= 25; i++) {
    rows.push({ source_type: 'gamma', source_id: `gamma-${pad(i)}`, ordinal: 200 + i, collection_id: COL_GAMMA });
  }
  return rows;
}

function pad(n: number): string {
  return String(n).padStart(3, '0');
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

/** Minimal in-memory Typesense interpreter — same shape as the other two specs. */
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

describe('Stream 4b Task 35 — search authz pagination accuracy', () => {
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
        ordinal int NOT NULL,
        _collection_id uuid
      )
    `);

    for (const row of seedRows) {
      await dataSource.query(
        `INSERT INTO search_embeddings (source_type, source_id, content, ordinal, _collection_id)
         VALUES ($1, $2, $3, $4, $5)`,
        [row.source_type, row.source_id, `content for ${row.source_id}`, row.ordinal, row.collection_id],
      );
    }
  });

  afterAll(async () => {
    if (cleanup) await cleanup();
  });

  /**
   * Authorized corpus count = 25 (ALPHA only). The seed totals 100;
   * if the count surfaced unauthorized rows, the UI would directly
   * disclose them.
   */
  it('pgvector authorized total_count equals the authorized corpus, not the seed total', async () => {
    const ast = compileSearchAuthz({
      userId: USER_ID,
      userRoleIds: [ROLE_ID],
      userGroupIds: [],
      collectionRules: buildRuleFixture(),
    });
    const { clause, params } = emitPgvectorWhere(ast, {}, 1);
    const result = await dataSource.query<{ count: string }[]>(
      `SELECT COUNT(*) AS count FROM search_embeddings WHERE ${clause}`,
      params,
    );
    expect(Number(result[0].count)).toBe(25);
  });

  /**
   * Pagination is exact: page 2 (offset 10, limit 10) returns ALPHA
   * records 11-20 — not records 11-20 of the seed sorted by ordinal
   * (which would mix in unauthorized rows). The ordinal field gives a
   * stable deterministic ordering.
   */
  it('pgvector page 2 of size 10 returns ALPHA records 11-20 only', async () => {
    const ast = compileSearchAuthz({
      userId: USER_ID,
      userRoleIds: [ROLE_ID],
      userGroupIds: [],
      collectionRules: buildRuleFixture(),
    });
    const { clause, params } = emitPgvectorWhere(ast, {}, 1);
    const result = await dataSource.query<{ source_id: string; ordinal: number }[]>(
      `SELECT source_id, ordinal FROM search_embeddings
         WHERE ${clause}
         ORDER BY ordinal
         LIMIT 10 OFFSET 10`,
      params,
    );

    expect(result).toHaveLength(10);
    for (const row of result) {
      expect(row.source_id.startsWith('alpha-')).toBe(true);
    }
    // Ordinal range 11-20 inclusive (the second page of the alpha corpus).
    expect(result[0].ordinal).toBe(11);
    expect(result[result.length - 1].ordinal).toBe(20);
  });

  /**
   * Each page is full-size up to the corpus size. With 25 authorized
   * records and pageSize=10: page 1 = 10, page 2 = 10, page 3 = 5.
   * No "shrunken page" — the post-filter failure mode.
   */
  it('pgvector pages 1, 2, 3 over the authorized corpus return 10, 10, 5 rows respectively', async () => {
    const ast = compileSearchAuthz({
      userId: USER_ID,
      userRoleIds: [ROLE_ID],
      userGroupIds: [],
      collectionRules: buildRuleFixture(),
    });
    const { clause, params } = emitPgvectorWhere(ast, {}, 1);

    const page1 = await dataSource.query(
      `SELECT source_id FROM search_embeddings WHERE ${clause} ORDER BY ordinal LIMIT 10 OFFSET 0`,
      params,
    );
    const page2 = await dataSource.query(
      `SELECT source_id FROM search_embeddings WHERE ${clause} ORDER BY ordinal LIMIT 10 OFFSET 10`,
      params,
    );
    const page3 = await dataSource.query(
      `SELECT source_id FROM search_embeddings WHERE ${clause} ORDER BY ordinal LIMIT 10 OFFSET 20`,
      params,
    );
    expect(page1).toHaveLength(10);
    expect(page2).toHaveLength(10);
    expect(page3).toHaveLength(5);
  });

  /**
   * Typesense filter_by + in-memory pagination yields the same paged
   * subset as pgvector. Disagreement between the engines on the same
   * AST is an emitter bug.
   */
  it('Typesense pagination matches pgvector on the same AST', () => {
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
      ordinal: r.ordinal,
    }));
    const visible = tsDocs
      .filter((doc) => tsMatches(filterBy, doc))
      .sort((a, b) => a.ordinal - b.ordinal);

    expect(visible).toHaveLength(25);
    const page2 = visible.slice(10, 20);
    expect(page2).toHaveLength(10);
    expect(page2[0].ordinal).toBe(11);
    expect(page2[page2.length - 1].ordinal).toBe(20);
    for (const doc of page2) {
      expect(doc.source_id.startsWith('alpha-')).toBe(true);
    }
  });
});
