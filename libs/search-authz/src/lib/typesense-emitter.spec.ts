/**
 * Typesense filter_by emitter unit tests.
 *
 * Verifies that every FilterAst node kind translates to the correct
 * Typesense filter_by syntax and that all edge cases are handled safely.
 *
 * Canon refs: §9, §11, §28, Plan Fix 30 PR-2 / F136.
 */

import { emitTypesenseFilterBy, AttributeContext } from './typesense-emitter';
import type { FilterAst } from './ast';

// ---------------------------------------------------------------------------
// Test helpers
// ---------------------------------------------------------------------------

function emit(ast: FilterAst, attrs: AttributeContext = {}): string {
  return emitTypesenseFilterBy(ast, attrs);
}

const COL_ID = 'col-uuid-aaa';
const COL_ID_2 = 'col-uuid-bbb';

// ---------------------------------------------------------------------------
// Tests — one group per node kind, plus edge-case group
// ---------------------------------------------------------------------------

describe('emitTypesenseFilterBy', () => {
  // -------------------------------------------------------------------------
  // allow_all
  // -------------------------------------------------------------------------

  it('1: allow_all → empty string (no filter = unrestricted)', () => {
    expect(emit({ kind: 'allow_all' })).toBe('');
  });

  // -------------------------------------------------------------------------
  // deny_all
  // -------------------------------------------------------------------------

  it('2: deny_all → no-match sentinel clause', () => {
    const result = emit({ kind: 'deny_all' });
    // Must be a non-empty string that cannot match any real document.
    expect(result).toBeTruthy();
    expect(result).toContain('_collection_id:=');
    expect(result).toContain('__no_access__');
  });

  // -------------------------------------------------------------------------
  // in_collection
  // -------------------------------------------------------------------------

  it('3: in_collection → _collection_id:="<id>"', () => {
    const result = emit({ kind: 'in_collection', collectionId: COL_ID });
    expect(result).toBe(`_collection_id:="${COL_ID}"`);
  });

  // -------------------------------------------------------------------------
  // eq
  // -------------------------------------------------------------------------

  it('4: eq with string value → field:="value"', () => {
    const result = emit({ kind: 'eq', field: 'status', value: 'open' });
    expect(result).toBe('status:="open"');
  });

  it('5: eq with numeric value → field:=42', () => {
    const result = emit({ kind: 'eq', field: 'priority', value: 42 });
    expect(result).toBe('priority:=42');
  });

  it('6: eq with boolean value → field:=true', () => {
    const result = emit({ kind: 'eq', field: 'is_active', value: true });
    expect(result).toBe('is_active:=true');
  });

  // -------------------------------------------------------------------------
  // in
  // -------------------------------------------------------------------------

  it('7: in with multiple string values → field:=["a","b","c"]', () => {
    const result = emit({ kind: 'in', field: 'region', values: ['north', 'east', 'west'] });
    expect(result).toBe('region:=["north","east","west"]');
  });

  it('8: in with empty values list → deny sentinel (empty IN matches nothing)', () => {
    const result = emit({ kind: 'in', field: 'region', values: [] });
    expect(result).toContain('__no_access__');
  });

  it('9: in with mixed numeric/string values', () => {
    const result = emit({ kind: 'in', field: 'tier', values: [1, 2, 3] });
    expect(result).toBe('tier:=[1,2,3]');
  });

  // -------------------------------------------------------------------------
  // attribute_match — ABAC substitution
  // -------------------------------------------------------------------------

  it('10: attribute_match with present string attribute → _field:="value"', () => {
    const attrs: AttributeContext = { region: 'us-east' };
    const result = emit(
      { kind: 'attribute_match', field: 'region', userAttribute: 'region' },
      attrs,
    );
    expect(result).toBe('_region:="us-east"');
  });

  it('11: attribute_match with present numeric attribute → _field:=42', () => {
    const attrs: AttributeContext = { departmentId: 42 };
    const result = emit(
      { kind: 'attribute_match', field: 'department_id', userAttribute: 'departmentId' },
      attrs,
    );
    expect(result).toBe('_department_id:=42');
  });

  it('12: attribute_match with missing attribute → deny sentinel', () => {
    const result = emit(
      { kind: 'attribute_match', field: 'region', userAttribute: 'region' },
      {}, // no `region` in context
    );
    expect(result).toContain('__no_access__');
  });

  it('13: attribute_match with null attribute value → deny sentinel', () => {
    const attrs: AttributeContext = { region: null };
    const result = emit(
      { kind: 'attribute_match', field: 'region', userAttribute: 'region' },
      attrs,
    );
    expect(result).toContain('__no_access__');
  });

  // -------------------------------------------------------------------------
  // not
  // -------------------------------------------------------------------------

  it('14: not wraps inner clause in !()', () => {
    const result = emit({
      kind: 'not',
      clause: { kind: 'eq', field: 'status', value: 'archived' },
    });
    expect(result).toBe('!(status:="archived")');
  });

  it('15: not(allow_all) → deny sentinel', () => {
    const result = emit({ kind: 'not', clause: { kind: 'allow_all' } });
    expect(result).toContain('__no_access__');
  });

  it('16: not(deny_all) → empty string (no filter)', () => {
    const result = emit({ kind: 'not', clause: { kind: 'deny_all' } });
    expect(result).toBe('');
  });

  // -------------------------------------------------------------------------
  // and
  // -------------------------------------------------------------------------

  it('17: and of two simple clauses → (c1) && (c2)', () => {
    const ast: FilterAst = {
      kind: 'and',
      clauses: [
        { kind: 'in_collection', collectionId: COL_ID },
        { kind: 'eq', field: 'status', value: 'open' },
      ],
    };
    const result = emit(ast);
    expect(result).toContain('&&');
    expect(result).toContain(`_collection_id:="${COL_ID}"`);
    expect(result).toContain('status:="open"');
  });

  it('18: and with a single non-trivial child → emits the child directly (no wrapping)', () => {
    const ast: FilterAst = {
      kind: 'and',
      clauses: [{ kind: 'eq', field: 'status', value: 'open' }],
    };
    expect(emit(ast)).toBe('status:="open"');
  });

  it('19: and with empty clauses list → empty string (allow_all)', () => {
    expect(emit({ kind: 'and', clauses: [] })).toBe('');
  });

  it('20: and with a deny_all child → deny sentinel short-circuits the and', () => {
    const ast: FilterAst = {
      kind: 'and',
      clauses: [
        { kind: 'in_collection', collectionId: COL_ID },
        { kind: 'deny_all' },
      ],
    };
    const result = emit(ast);
    expect(result).toContain('__no_access__');
    // The collection clause should NOT appear (deny short-circuits).
    expect(result).not.toContain(COL_ID);
  });

  it('21: and with an allow_all child collapses it (allow_all contributes no constraint)', () => {
    const ast: FilterAst = {
      kind: 'and',
      clauses: [
        { kind: 'allow_all' },
        { kind: 'eq', field: 'status', value: 'open' },
      ],
    };
    // The allow_all child disappears; only the eq clause remains.
    expect(emit(ast)).toBe('status:="open"');
  });

  // -------------------------------------------------------------------------
  // or
  // -------------------------------------------------------------------------

  it('22: or of two in_collection clauses → (c1) || (c2)', () => {
    const ast: FilterAst = {
      kind: 'or',
      clauses: [
        { kind: 'in_collection', collectionId: COL_ID },
        { kind: 'in_collection', collectionId: COL_ID_2 },
      ],
    };
    const result = emit(ast);
    expect(result).toContain('||');
    expect(result).toContain(`_collection_id:="${COL_ID}"`);
    expect(result).toContain(`_collection_id:="${COL_ID_2}"`);
  });

  it('23: or with empty clauses list → deny sentinel', () => {
    const result = emit({ kind: 'or', clauses: [] });
    expect(result).toContain('__no_access__');
  });

  it('24: or with an allow_all child short-circuits to empty string', () => {
    const ast: FilterAst = {
      kind: 'or',
      clauses: [
        { kind: 'deny_all' },
        { kind: 'allow_all' },
      ],
    };
    expect(emit(ast)).toBe('');
  });

  it('25: or where all children are deny_all → deny sentinel', () => {
    const ast: FilterAst = {
      kind: 'or',
      clauses: [{ kind: 'deny_all' }, { kind: 'deny_all' }],
    };
    const result = emit(ast);
    expect(result).toContain('__no_access__');
  });

  // -------------------------------------------------------------------------
  // String escaping
  // -------------------------------------------------------------------------

  it('26: string values with double-quotes are escaped', () => {
    const result = emit({ kind: 'eq', field: 'name', value: 'say "hello"' });
    expect(result).toBe('name:="say \\"hello\\""');
  });

  it('27: string values with backslashes are escaped', () => {
    const result = emit({ kind: 'eq', field: 'path', value: 'C:\\Users' });
    expect(result).toBe('path:="C:\\\\Users"');
  });

  // -------------------------------------------------------------------------
  // Nested structures
  // -------------------------------------------------------------------------

  it('28: nested and-inside-or produces correct parenthesisation', () => {
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
    const result = emit(ast);
    expect(result).toContain('||');
    expect(result).toContain('&&');
  });

  it('29: real-world ABAC pattern: in_collection AND attribute_match', () => {
    const ast: FilterAst = {
      kind: 'and',
      clauses: [
        { kind: 'in_collection', collectionId: COL_ID },
        { kind: 'attribute_match', field: 'region', userAttribute: 'region' },
      ],
    };
    const result = emit(ast, { region: 'apac' });
    expect(result).toContain(`_collection_id:="${COL_ID}"`);
    expect(result).toContain('_region:="apac"');
    expect(result).toContain('&&');
  });
});
