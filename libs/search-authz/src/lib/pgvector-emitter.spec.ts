/**
 * pgvector WHERE-clause emitter unit tests.
 *
 * Verifies that every FilterAst node kind translates to the correct
 * parameterized SQL fragment and that all security invariants hold.
 *
 * Security focus: every test involving user-attribute values verifies that
 * the value appears only in `params[]` and never as a literal in the SQL
 * `clause` string. This is the primary defense-in-depth invariant for the
 * emitter (SQL injection at the authz boundary = privilege escalation).
 *
 * Canon refs: §9, §11, §28, Plan Fix 30 PR-3 / F136.
 */

import { emitPgvectorWhere } from './pgvector-emitter';
import type { FilterAst } from './ast';
import type { AttributeContext } from './typesense-emitter';

// ---------------------------------------------------------------------------
// Test helpers
// ---------------------------------------------------------------------------

function emit(
  ast: FilterAst,
  attrs: AttributeContext = {},
  startParam = 1,
) {
  return emitPgvectorWhere(ast, attrs, startParam);
}

const COL_ID = 'col-uuid-aaa';
const COL_ID_2 = 'col-uuid-bbb';

// ---------------------------------------------------------------------------
// Tests — one group per node kind, plus security assertions
// ---------------------------------------------------------------------------

describe('emitPgvectorWhere', () => {
  // -------------------------------------------------------------------------
  // allow_all
  // -------------------------------------------------------------------------

  it('1: allow_all → clause is TRUE, params empty', () => {
    const { clause, params } = emit({ kind: 'allow_all' });
    expect(clause).toBe('TRUE');
    expect(params).toHaveLength(0);
  });

  it('2: allow_all → nextParamIndex equals startParamIndex (no params consumed)', () => {
    const { nextParamIndex } = emit({ kind: 'allow_all' }, {}, 5);
    expect(nextParamIndex).toBe(5);
  });

  // -------------------------------------------------------------------------
  // deny_all
  // -------------------------------------------------------------------------

  it('3: deny_all → clause is FALSE, params empty', () => {
    const { clause, params } = emit({ kind: 'deny_all' });
    expect(clause).toBe('FALSE');
    expect(params).toHaveLength(0);
  });

  it('4: deny_all → nextParamIndex equals startParamIndex', () => {
    const { nextParamIndex } = emit({ kind: 'deny_all' }, {}, 3);
    expect(nextParamIndex).toBe(3);
  });

  // -------------------------------------------------------------------------
  // in_collection
  // -------------------------------------------------------------------------

  it('5: in_collection → uses parameterized placeholder (no literal UUID in clause)', () => {
    const { clause, params } = emit({ kind: 'in_collection', collectionId: COL_ID });
    expect(clause).toBe('_collection_id = $1');
    expect(params).toEqual([COL_ID]);
  });

  it('6: in_collection with startParam=3 → uses $3 placeholder', () => {
    const { clause, params, nextParamIndex } = emit(
      { kind: 'in_collection', collectionId: COL_ID },
      {},
      3,
    );
    expect(clause).toBe('_collection_id = $3');
    expect(params).toEqual([COL_ID]);
    expect(nextParamIndex).toBe(4);
  });

  // -------------------------------------------------------------------------
  // eq
  // -------------------------------------------------------------------------

  it('7: eq with string value → field = $N with value in params', () => {
    const { clause, params } = emit({ kind: 'eq', field: 'status', value: 'open' });
    expect(clause).toBe('status = $1');
    expect(params).toEqual(['open']);
    // The literal string 'open' must not appear in the clause.
    expect(clause).not.toContain('open');
  });

  it('8: eq with numeric value → field = $N', () => {
    const { clause, params } = emit({ kind: 'eq', field: 'priority', value: 42 });
    expect(clause).toBe('priority = $1');
    expect(params).toEqual([42]);
    expect(clause).not.toContain('42');
  });

  it('9: eq with boolean value → field = $N', () => {
    const { clause, params } = emit({ kind: 'eq', field: 'is_active', value: true });
    expect(clause).toBe('is_active = $1');
    expect(params).toEqual([true]);
  });

  it('10: eq with null value → field IS NULL (no params consumed)', () => {
    const { clause, params, nextParamIndex } = emit(
      { kind: 'eq', field: 'deleted_at', value: null },
    );
    expect(clause).toBe('deleted_at IS NULL');
    expect(params).toHaveLength(0);
    expect(nextParamIndex).toBe(1);
  });

  // -------------------------------------------------------------------------
  // in
  // -------------------------------------------------------------------------

  it('11: in with multiple values → field IN ($1, $2, $3) with values in params', () => {
    const { clause, params } = emit(
      { kind: 'in', field: 'region', values: ['north', 'east', 'west'] },
    );
    expect(clause).toBe('region IN ($1, $2, $3)');
    expect(params).toEqual(['north', 'east', 'west']);
    // No literal value should appear in the clause.
    expect(clause).not.toContain('north');
    expect(clause).not.toContain('east');
    expect(clause).not.toContain('west');
  });

  it('12: in with empty values list → FALSE (no rows match)', () => {
    const { clause, params } = emit({ kind: 'in', field: 'region', values: [] });
    expect(clause).toBe('FALSE');
    expect(params).toHaveLength(0);
  });

  // -------------------------------------------------------------------------
  // attribute_match — ABAC substitution (security critical)
  // -------------------------------------------------------------------------

  it('13: attribute_match with present string attribute → _attribute_field = $N', () => {
    const attrs: AttributeContext = { region: 'us-east' };
    const { clause, params } = emit(
      { kind: 'attribute_match', field: 'region', userAttribute: 'region' },
      attrs,
    );
    expect(clause).toBe('_attribute_region = $1');
    expect(params).toEqual(['us-east']);
    // SECURITY: the attribute value must not appear in the clause string.
    expect(clause).not.toContain('us-east');
  });

  it('14: attribute_match with present numeric attribute → _attribute_field = $N', () => {
    const attrs: AttributeContext = { departmentId: 42 };
    const { clause, params } = emit(
      { kind: 'attribute_match', field: 'department_id', userAttribute: 'departmentId' },
      attrs,
    );
    expect(clause).toBe('_attribute_department_id = $1');
    expect(params).toEqual([42]);
    expect(clause).not.toContain('42');
  });

  it('15: attribute_match with missing attribute → FALSE (deny)', () => {
    const { clause, params } = emit(
      { kind: 'attribute_match', field: 'region', userAttribute: 'region' },
      {}, // no `region` in context
    );
    expect(clause).toBe('FALSE');
    expect(params).toHaveLength(0);
  });

  it('16: attribute_match with null attribute value → FALSE (deny)', () => {
    const attrs: AttributeContext = { region: null };
    const { clause, params } = emit(
      { kind: 'attribute_match', field: 'region', userAttribute: 'region' },
      attrs,
    );
    expect(clause).toBe('FALSE');
    expect(params).toHaveLength(0);
  });

  // -------------------------------------------------------------------------
  // SECURITY: SQL injection guard — the primary invariant of this emitter
  // -------------------------------------------------------------------------

  it('17: malicious attribute value is bound as a param, never interpolated into clause', () => {
    const maliciousValue = "1; DROP TABLE users; --";
    const attrs: AttributeContext = { region: maliciousValue };
    const { clause, params } = emit(
      { kind: 'attribute_match', field: 'region', userAttribute: 'region' },
      attrs,
    );
    // The malicious string must NOT appear anywhere in the clause string.
    expect(clause).not.toContain(maliciousValue);
    expect(clause).not.toContain('DROP');
    expect(clause).not.toContain('--');
    // The value must appear in the params array (as a literal bind value).
    expect(params).toContain(maliciousValue);
    // The clause should be a clean parameterized expression.
    expect(clause).toBe('_attribute_region = $1');
  });

  it('18: malicious collection ID in in_collection is bound as param, not interpolated', () => {
    const maliciousId = "'; DELETE FROM search_embeddings; --";
    const { clause, params } = emit({ kind: 'in_collection', collectionId: maliciousId });
    expect(clause).not.toContain(maliciousId);
    expect(clause).not.toContain('DELETE');
    expect(clause).toBe('_collection_id = $1');
    expect(params).toContain(maliciousId);
  });

  it('19: malicious eq value is bound as param, not interpolated', () => {
    const maliciousValue = "' OR 1=1; --";
    const { clause, params } = emit({ kind: 'eq', field: 'status', value: maliciousValue });
    expect(clause).not.toContain(maliciousValue);
    expect(clause).not.toContain('OR 1=1');
    expect(clause).toBe('status = $1');
    expect(params).toContain(maliciousValue);
  });

  // -------------------------------------------------------------------------
  // not
  // -------------------------------------------------------------------------

  it('20: not wraps inner clause in NOT (...)', () => {
    const { clause, params } = emit({
      kind: 'not',
      clause: { kind: 'eq', field: 'status', value: 'archived' },
    });
    expect(clause).toBe('NOT (status = $1)');
    expect(params).toEqual(['archived']);
  });

  it('21: not(allow_all) → FALSE', () => {
    const { clause, params } = emit({ kind: 'not', clause: { kind: 'allow_all' } });
    expect(clause).toBe('FALSE');
    expect(params).toHaveLength(0);
  });

  it('22: not(deny_all) → TRUE', () => {
    const { clause, params } = emit({ kind: 'not', clause: { kind: 'deny_all' } });
    expect(clause).toBe('TRUE');
    expect(params).toHaveLength(0);
  });

  // -------------------------------------------------------------------------
  // and
  // -------------------------------------------------------------------------

  it('23: and of two clauses → (c1) AND (c2) with params in order', () => {
    const ast: FilterAst = {
      kind: 'and',
      clauses: [
        { kind: 'in_collection', collectionId: COL_ID },
        { kind: 'eq', field: 'status', value: 'open' },
      ],
    };
    const { clause, params, nextParamIndex } = emit(ast);
    expect(clause).toContain('AND');
    expect(clause).toContain('_collection_id = $1');
    expect(clause).toContain('status = $2');
    expect(params).toEqual([COL_ID, 'open']);
    expect(nextParamIndex).toBe(3);
  });

  it('24: and with allow_all child collapses the child', () => {
    const ast: FilterAst = {
      kind: 'and',
      clauses: [
        { kind: 'allow_all' },
        { kind: 'eq', field: 'status', value: 'open' },
      ],
    };
    const { clause, params } = emit(ast);
    // The allow_all child disappears; only the eq clause remains.
    expect(clause).toBe('status = $1');
    expect(params).toEqual(['open']);
    expect(clause).not.toContain('AND');
    expect(clause).not.toContain('TRUE');
  });

  it('25: and with a deny_all child → FALSE (short-circuit)', () => {
    const ast: FilterAst = {
      kind: 'and',
      clauses: [
        { kind: 'in_collection', collectionId: COL_ID },
        { kind: 'deny_all' },
      ],
    };
    const { clause } = emit(ast);
    expect(clause).toBe('FALSE');
  });

  it('26: empty and → TRUE', () => {
    const { clause, params } = emit({ kind: 'and', clauses: [] });
    expect(clause).toBe('TRUE');
    expect(params).toHaveLength(0);
  });

  // -------------------------------------------------------------------------
  // or
  // -------------------------------------------------------------------------

  it('27: or of two in_collection clauses → (c1) OR (c2)', () => {
    const ast: FilterAst = {
      kind: 'or',
      clauses: [
        { kind: 'in_collection', collectionId: COL_ID },
        { kind: 'in_collection', collectionId: COL_ID_2 },
      ],
    };
    const { clause, params } = emit(ast);
    expect(clause).toContain('OR');
    expect(params).toContain(COL_ID);
    expect(params).toContain(COL_ID_2);
    expect(clause).not.toContain(COL_ID);
    expect(clause).not.toContain(COL_ID_2);
  });

  it('28: empty or → FALSE (no permitted clauses)', () => {
    const { clause, params } = emit({ kind: 'or', clauses: [] });
    expect(clause).toBe('FALSE');
    expect(params).toHaveLength(0);
  });

  it('29: or with allow_all child → TRUE (short-circuits)', () => {
    const ast: FilterAst = {
      kind: 'or',
      clauses: [{ kind: 'deny_all' }, { kind: 'allow_all' }],
    };
    const { clause } = emit(ast);
    expect(clause).toBe('TRUE');
  });

  it('30: or where all children are deny_all → FALSE', () => {
    const ast: FilterAst = {
      kind: 'or',
      clauses: [{ kind: 'deny_all' }, { kind: 'deny_all' }],
    };
    const { clause } = emit(ast);
    expect(clause).toBe('FALSE');
  });

  // -------------------------------------------------------------------------
  // Parameter ordering — critical for correct bind mapping
  // -------------------------------------------------------------------------

  it('31: nested and-inside-or params are in DFS left-to-right order', () => {
    const ast: FilterAst = {
      kind: 'or',
      clauses: [
        {
          kind: 'and',
          clauses: [
            { kind: 'in_collection', collectionId: COL_ID },
            { kind: 'eq', field: 'status', value: 'open' },
          ],
        },
        { kind: 'in_collection', collectionId: COL_ID_2 },
      ],
    };
    const { clause, params, nextParamIndex } = emit(ast);
    // DFS order: COL_ID first (in_collection), then 'open' (eq), then COL_ID_2.
    expect(params).toEqual([COL_ID, 'open', COL_ID_2]);
    expect(nextParamIndex).toBe(4);
    expect(clause).toContain('$1');
    expect(clause).toContain('$2');
    expect(clause).toContain('$3');
  });

  it('32: startParamIndex shifts all $N values by the offset', () => {
    const ast: FilterAst = {
      kind: 'and',
      clauses: [
        { kind: 'in_collection', collectionId: COL_ID },
        { kind: 'eq', field: 'status', value: 'active' },
      ],
    };
    const { clause, params, nextParamIndex } = emit(ast, {}, 4);
    expect(clause).toContain('$4');
    expect(clause).toContain('$5');
    expect(params).toEqual([COL_ID, 'active']);
    expect(nextParamIndex).toBe(6);
  });

  // -------------------------------------------------------------------------
  // Real-world ABAC pattern
  // -------------------------------------------------------------------------

  it('33: in_collection AND attribute_match — the common ABAC pre-filter shape', () => {
    const ast: FilterAst = {
      kind: 'and',
      clauses: [
        { kind: 'in_collection', collectionId: COL_ID },
        { kind: 'attribute_match', field: 'region', userAttribute: 'region' },
      ],
    };
    const { clause, params } = emit(ast, { region: 'apac' });
    expect(clause).toContain('_collection_id = $1');
    expect(clause).toContain('_attribute_region = $2');
    expect(clause).toContain('AND');
    expect(params).toEqual([COL_ID, 'apac']);
    // SECURITY: the attribute value must not appear in the SQL clause.
    expect(clause).not.toContain('apac');
  });
});
