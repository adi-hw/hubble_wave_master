/**
 * AclProjection unit tests — verifies that `extractRequiredAttributes`
 * correctly walks a FilterAst and collects every `attribute_match.field`
 * referenced by the tree.
 *
 * Canon refs: §9, §28, Plan Fix 30 PR-2 / F136.
 */

import { extractRequiredAttributes } from './acl-projection';
import type { FilterAst } from './ast';

describe('extractRequiredAttributes', () => {
  // 1. allow_all → no attributes
  it('returns empty array for allow_all', () => {
    expect(extractRequiredAttributes({ kind: 'allow_all' })).toEqual([]);
  });

  // 2. deny_all → no attributes
  it('returns empty array for deny_all', () => {
    expect(extractRequiredAttributes({ kind: 'deny_all' })).toEqual([]);
  });

  // 3. in_collection → no attributes
  it('returns empty array for in_collection', () => {
    expect(extractRequiredAttributes({ kind: 'in_collection', collectionId: 'col-aaa' })).toEqual([]);
  });

  // 4. eq → no attributes
  it('returns empty array for eq', () => {
    expect(extractRequiredAttributes({ kind: 'eq', field: 'status', value: 'open' })).toEqual([]);
  });

  // 5. in → no attributes
  it('returns empty array for in', () => {
    expect(extractRequiredAttributes({ kind: 'in', field: 'region', values: ['north', 'east'] })).toEqual([]);
  });

  // 6. single attribute_match → returns the field name
  it('returns the field from a single attribute_match node', () => {
    const ast: FilterAst = { kind: 'attribute_match', field: 'region', userAttribute: 'region' };
    expect(extractRequiredAttributes(ast)).toEqual(['region']);
  });

  // 7. not wrapping an attribute_match → field is collected
  it('collects attribute from not(attribute_match)', () => {
    const ast: FilterAst = {
      kind: 'not',
      clause: { kind: 'attribute_match', field: 'department_id', userAttribute: 'departmentId' },
    };
    expect(extractRequiredAttributes(ast)).toEqual(['department_id']);
  });

  // 8. and with multiple attribute_match children
  it('collects all fields from and(attribute_match, attribute_match)', () => {
    const ast: FilterAst = {
      kind: 'and',
      clauses: [
        { kind: 'attribute_match', field: 'region', userAttribute: 'region' },
        { kind: 'attribute_match', field: 'department_id', userAttribute: 'departmentId' },
      ],
    };
    const result = extractRequiredAttributes(ast);
    expect(result).toContain('region');
    expect(result).toContain('department_id');
    expect(result).toHaveLength(2);
  });

  // 9. or with mixed node kinds
  it('collects attribute_match fields nested inside or', () => {
    const ast: FilterAst = {
      kind: 'or',
      clauses: [
        { kind: 'in_collection', collectionId: 'col-aaa' },
        { kind: 'attribute_match', field: 'site_id', userAttribute: 'siteId' },
      ],
    };
    expect(extractRequiredAttributes(ast)).toEqual(['site_id']);
  });

  // 10. duplicate attribute_match fields are deduplicated
  it('deduplicates repeated attribute_match field names', () => {
    const ast: FilterAst = {
      kind: 'or',
      clauses: [
        { kind: 'attribute_match', field: 'region', userAttribute: 'region' },
        { kind: 'attribute_match', field: 'region', userAttribute: 'region' },
      ],
    };
    expect(extractRequiredAttributes(ast)).toEqual(['region']);
  });

  // 11. deeply nested tree
  it('collects fields from a deeply nested and/or/not/attribute_match tree', () => {
    const ast: FilterAst = {
      kind: 'and',
      clauses: [
        { kind: 'in_collection', collectionId: 'col-aaa' },
        {
          kind: 'or',
          clauses: [
            { kind: 'attribute_match', field: 'region', userAttribute: 'region' },
            {
              kind: 'not',
              clause: { kind: 'attribute_match', field: 'archived', userAttribute: 'isArchived' },
            },
          ],
        },
      ],
    };
    const result = extractRequiredAttributes(ast);
    expect(result).toContain('region');
    expect(result).toContain('archived');
    expect(result).toHaveLength(2);
  });

  // 12. result is sorted alphabetically for determinism
  it('returns fields in alphabetical order', () => {
    const ast: FilterAst = {
      kind: 'and',
      clauses: [
        { kind: 'attribute_match', field: 'zone', userAttribute: 'zone' },
        { kind: 'attribute_match', field: 'alpha', userAttribute: 'alpha' },
        { kind: 'attribute_match', field: 'meso', userAttribute: 'meso' },
      ],
    };
    expect(extractRequiredAttributes(ast)).toEqual(['alpha', 'meso', 'zone']);
  });
});
