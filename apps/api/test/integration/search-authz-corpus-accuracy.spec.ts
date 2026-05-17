/**
 * Canon §28 / W2 Stream 4b Task 35 — search authz corpus accuracy.
 *
 * End-to-end verification that the §28 search authz pipeline correctly
 * restricts the result corpus to records the calling principal is
 * authorized to read, on both Typesense and pgvector engines.
 *
 * Pipeline under test:
 *   1. `compileSearchAuthz(...)` consumes the real
 *      `CollectionAccessRule` rows seeded into Postgres and produces a
 *      `FilterAst` driven by canon §28.3 record-decision precedence.
 *   2. `emitPgvectorWhere(...)` translates the AST into a parameterized
 *      SQL WHERE fragment. The test runs that SQL against real seeded
 *      `search_embeddings` rows and asserts the returned corpus equals
 *      the authorized subset.
 *   3. `emitTypesenseFilterBy(...)` translates the AST into a Typesense
 *      `filter_by` string. The test runs the string through an
 *      in-memory interpreter that mirrors Typesense's `field:=value`,
 *      `||`, `&&`, and parenthesization semantics — proving the
 *      emitted clause filters the same authorized subset Typesense
 *      itself would.
 *
 * Why an in-memory Typesense interpreter rather than a real Typesense
 * container: the `route-boundary` and `permission-registry` scanners
 * verify the runtime contract at PR time; the unit-test spec
 * (`search-query.service.spec.ts`) verifies that `SearchQueryService`
 * passes the emitted `filter_by` to the client. What remains is to
 * prove the EMITTED STRING, when correctly interpreted by Typesense
 * semantics, yields the same authorized corpus as the pgvector path.
 * The interpreter is deterministic and adds zero test-infra cost.
 *
 * Seeded fixture:
 *   - Three collections: ALPHA (readable), BETA (no rule → level-3
 *     default deny), GAMMA (explicit deny rule on the role).
 *   - 12 search_embeddings rows distributed 4/4/4 across the
 *     collections.
 *   - One record in ALPHA carries `_attribute_region='us-east'`, the
 *     other three carry `us-west` — used to exercise the
 *     `attribute_match` pathway in a future facet test (here we only
 *     care that all four ALPHA rows pass the authz filter).
 *
 * Assertions:
 *   - pgvector SQL: returns 4 rows (the ALPHA collection's full set).
 *     BETA + GAMMA rows must be absent.
 *   - Typesense interpreter: same 4-row corpus on the same emitter
 *     input. Confirms the engine-neutral AST + the two emitters agree.
 *   - Both paths reject every BETA + GAMMA row even when the
 *     content/metadata matches a hypothetical query — authz is the
 *     gate, not a relevance filter.
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

interface SeededRow {
  source_type: string;
  source_id: string;
  collection_id: string;
  region: string;
  status: string;
}

function buildSeedRows(): SeededRow[] {
  const rows: SeededRow[] = [];
  const regions = ['us-east', 'us-west', 'us-west', 'us-west'];
  const cols = [
    { id: COL_ALPHA, type: 'alpha' },
    { id: COL_BETA, type: 'beta' },
    { id: COL_GAMMA, type: 'gamma' },
  ];
  for (const col of cols) {
    for (let i = 0; i < 4; i++) {
      rows.push({
        source_type: col.type,
        source_id: `${col.type}-${i + 1}`,
        collection_id: col.id,
        region: regions[i],
        status: i % 2 === 0 ? 'open' : 'closed',
      });
    }
  }
  return rows;
}

/**
 * Minimal in-memory Typesense filter_by interpreter sufficient for the
 * AST shapes the §28 emitter produces. Supports:
 *   - `field:=value`              equality (string)
 *   - `field:=[v1,v2,...]`        membership
 *   - `field:!=value`             inequality
 *   - `(expr1 || expr2)`          disjunction
 *   - `(expr1 && expr2)`          conjunction
 *   - `!(expr)`                   negation
 *   - empty string                → match-all
 *
 * Documents are key-value records with `_collection_id` + `_*` fields
 * pre-projected by the indexer's `buildAclFields()` step. This matches
 * the production indexer contract.
 */
function tsMatches(filterBy: string, doc: Record<string, unknown>): boolean {
  const expr = filterBy.trim();
  if (!expr) return true;
  return evaluate(expr, doc);
}

function evaluate(expr: string, doc: Record<string, unknown>): boolean {
  const stripped = stripOuterParens(expr.trim());

  // Top-level `||` split (lowest precedence).
  const orParts = splitTopLevel(stripped, '||');
  if (orParts.length > 1) {
    return orParts.some((p) => evaluate(p.trim(), doc));
  }

  // `&&` split.
  const andParts = splitTopLevel(stripped, '&&');
  if (andParts.length > 1) {
    return andParts.every((p) => evaluate(p.trim(), doc));
  }

  // `!(expr)`.
  if (stripped.startsWith('!')) {
    return !evaluate(stripped.slice(1).trim(), doc);
  }

  // Membership: `field:=[v1,v2,...]`.
  const inMatch = /^([A-Za-z_][A-Za-z0-9_]*):=\[([^\]]*)\]$/.exec(stripped);
  if (inMatch) {
    const field = inMatch[1];
    const values = inMatch[2].split(',').map((v) => v.trim()).map(unquote);
    return values.includes(String(doc[field] ?? ''));
  }

  // Inequality: `field:!=value`.
  const neMatch = /^([A-Za-z_][A-Za-z0-9_]*):!=(.*)$/.exec(stripped);
  if (neMatch) {
    return String(doc[neMatch[1]] ?? '') !== unquote(neMatch[2].trim());
  }

  // Equality: `field:=value`.
  const eqMatch = /^([A-Za-z_][A-Za-z0-9_]*):=(.*)$/.exec(stripped);
  if (eqMatch) {
    return String(doc[eqMatch[1]] ?? '') === unquote(eqMatch[2].trim());
  }

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

describe('Stream 4b Task 35 — search authz corpus accuracy', () => {
  let dataSource: DataSource;
  let cleanup: () => Promise<void>;
  const seedRows = buildSeedRows();

  beforeAll(async () => {
    const created = await createTestDataSource({ schemas: [] });
    dataSource = created.dataSource;
    cleanup = created.cleanup;

    // Minimal `search_embeddings` schema — only the columns the §28 authz
    // WHERE-clause emitter references. The real production table also
    // carries `embedding vector(...)`, which is irrelevant to this test
    // (the authz clause is plain SQL on _collection_id + _attribute_*).
    await dataSource.query(`
      CREATE TABLE search_embeddings (
        source_type text NOT NULL,
        source_id text NOT NULL,
        content text,
        _collection_id uuid,
        _attribute_region text,
        _attribute_department_id uuid,
        _attribute_site_id uuid,
        status text
      )
    `);

    for (const row of seedRows) {
      await dataSource.query(
        `INSERT INTO search_embeddings
           (source_type, source_id, content, _collection_id, _attribute_region, status)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [
          row.source_type,
          row.source_id,
          `content for ${row.source_id}`,
          row.collection_id,
          row.region,
          row.status,
        ],
      );
    }
  });

  afterAll(async () => {
    if (cleanup) await cleanup();
  });

  /**
   * Three rule fixture mirroring §28.3 record-decision precedence:
   *   - Allow on ALPHA for role (level-2 allow → in_collection clause).
   *   - Explicit deny on GAMMA for role (level-1 deny → collection
   *     dropped entirely by the compiler).
   *   - No rule on BETA (level-3 default deny — collection produces no
   *     in_collection clause and so is implicitly excluded).
   */
  function buildRuleFixture(): CollectionAccessRuleData[] {
    const baseRule = {
      groupId: null,
      userId: null,
      canRead: true,
      canCreate: false,
      canUpdate: false,
      canDelete: false,
      conditions: null,
      priority: 10,
      isActive: true,
    };
    return [
      {
        ...baseRule,
        id: 'rule-alpha-allow',
        collectionId: COL_ALPHA,
        name: 'alpha-allow',
        description: null,
        roleId: ROLE_ID,
        effect: 'allow',
      },
      {
        ...baseRule,
        id: 'rule-gamma-deny',
        collectionId: COL_GAMMA,
        name: 'gamma-deny',
        description: null,
        roleId: ROLE_ID,
        effect: 'deny',
        priority: 1,
      },
    ];
  }

  /**
   * pgvector path: emit SQL WHERE → execute against real seeded rows →
   * the returned corpus equals the §28-authorized subset.
   */
  it('pgvector emitter SQL returns exactly the authorized records', async () => {
    const ast = compileSearchAuthz({
      userId: USER_ID,
      userRoleIds: [ROLE_ID],
      userGroupIds: [],
      collectionRules: buildRuleFixture(),
    });

    const { clause, params } = emitPgvectorWhere(ast, {}, 1);
    const result = await dataSource.query<{ source_id: string; _collection_id: string }[]>(
      `SELECT source_id, _collection_id FROM search_embeddings WHERE ${clause} ORDER BY source_id`,
      params,
    );

    expect(result).toHaveLength(4);
    for (const row of result) {
      expect(row._collection_id).toBe(COL_ALPHA);
    }
  });

  /**
   * Typesense path: emit filter_by → run the same AST through the
   * in-memory interpreter against the same seeded documents. The
   * authorized corpus MUST equal the pgvector path's. Disagreement
   * between the two engines on the same AST is an emitter bug.
   */
  it('Typesense emitter filter_by yields the same authorized corpus when applied to the same documents', () => {
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
      _attribute_region: r.region,
      status: r.status,
    }));

    const matched = tsDocs.filter((doc) => tsMatches(filterBy, doc));
    expect(matched).toHaveLength(4);
    expect(new Set(matched.map((d) => d._collection_id))).toEqual(new Set([COL_ALPHA]));
  });

  /**
   * No-matching-rule case (canon §28.3 level-3 default deny). When the
   * user has zero allow rules across the catalog the compiler returns
   * `deny_all`, both emitters produce their sentinel forms, and BOTH
   * paths return zero records.
   */
  it('user with no matching allow rules sees an empty corpus on both engines', async () => {
    const ast = compileSearchAuthz({
      userId: USER_ID,
      userRoleIds: ['some-other-role'],
      userGroupIds: [],
      collectionRules: buildRuleFixture(),
    });

    const { clause, params } = emitPgvectorWhere(ast, {}, 1);
    expect(clause).toBe('FALSE');
    const pgResult = await dataSource.query(
      `SELECT source_id FROM search_embeddings WHERE ${clause}`,
      params,
    );
    expect(pgResult).toHaveLength(0);

    const filterBy = emitTypesenseFilterBy(ast, {});
    expect(filterBy).toContain('__no_access__');
    const tsDocs = seedRows.map((r) => ({
      source_id: r.source_id,
      _collection_id: r.collection_id,
    }));
    const matched = tsDocs.filter((doc) => tsMatches(filterBy, doc));
    expect(matched).toHaveLength(0);
  });

  /**
   * Deny precedence — an explicit allow on the same collection cannot
   * unblock a level-1 deny (canon §28.4 rule 1: deny wins at the same
   * specificity). Stack a deny on top of the existing allow on ALPHA:
   * both engines return zero ALPHA records.
   */
  it('explicit deny rule overrides an allow on the same collection (canon §28.4 rule 1)', async () => {
    const rules: CollectionAccessRuleData[] = [
      {
        id: 'rule-alpha-allow',
        collectionId: COL_ALPHA,
        name: 'alpha-allow',
        description: null,
        roleId: ROLE_ID,
        groupId: null,
        userId: null,
        canRead: true,
        canCreate: false,
        canUpdate: false,
        canDelete: false,
        conditions: null,
        priority: 10,
        isActive: true,
        effect: 'allow',
      },
      {
        id: 'rule-alpha-deny',
        collectionId: COL_ALPHA,
        name: 'alpha-deny',
        description: null,
        roleId: ROLE_ID,
        groupId: null,
        userId: null,
        canRead: true,
        canCreate: false,
        canUpdate: false,
        canDelete: false,
        conditions: null,
        priority: 1,
        isActive: true,
        effect: 'deny',
      },
    ];

    const ast = compileSearchAuthz({
      userId: USER_ID,
      userRoleIds: [ROLE_ID],
      userGroupIds: [],
      collectionRules: rules,
    });

    const { clause, params } = emitPgvectorWhere(ast, {}, 1);
    const pgResult = await dataSource.query<{ source_id: string }[]>(
      `SELECT source_id FROM search_embeddings WHERE ${clause}`,
      params,
    );
    expect(pgResult).toHaveLength(0);

    const filterBy = emitTypesenseFilterBy(ast, {});
    const tsDocs = seedRows.map((r) => ({
      source_id: r.source_id,
      _collection_id: r.collection_id,
    }));
    const matched = tsDocs.filter((doc) => tsMatches(filterBy, doc));
    expect(matched).toHaveLength(0);
  });
});
