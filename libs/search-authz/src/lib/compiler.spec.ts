/**
 * Compiler unit tests — verifies that §28 collection access rules are
 * translated into the correct engine-neutral FilterAst.
 *
 * Canon refs: §28.3 (record-decision precedence), §28.4 (deny wins),
 * Plan Fix 30 / F136.
 */

import type { CollectionAccessRuleData } from '@hubblewave/authorization';
import { compileSearchAuthz } from './compiler';
import type { FilterAst } from './ast';

// ---------------------------------------------------------------------------
// Shared test fixtures
// ---------------------------------------------------------------------------

const USER_ID = 'user-aaa';
const ROLE_ID_A = 'role-aaa';
const ROLE_ID_B = 'role-bbb';
const GROUP_ID_A = 'group-aaa';
const GROUP_ID_B = 'group-bbb';

const COL_ALPHA = 'col-alpha-uuid';
const COL_BETA = 'col-beta-uuid';
const COL_GAMMA = 'col-gamma-uuid';

function makeRule(
  overrides: Partial<CollectionAccessRuleData> & { collectionId: string },
): CollectionAccessRuleData {
  return {
    id: `rule-${Math.random().toString(36).slice(2)}`,
    name: 'test rule',
    description: null,
    roleId: null,
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
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('compileSearchAuthz', () => {
  // 1. Empty rules list → deny_all
  it('returns deny_all when collectionRules is empty', () => {
    const ast = compileSearchAuthz({
      userId: USER_ID,
      userRoleIds: [ROLE_ID_A],
      userGroupIds: [],
      collectionRules: [],
    });
    expect(ast).toEqual<FilterAst>({ kind: 'deny_all' });
  });

  // 2. No rules match the user's identity → deny_all
  it('returns deny_all when no rule matches the user', () => {
    const rule = makeRule({
      collectionId: COL_ALPHA,
      roleId: 'role-stranger',
    });
    const ast = compileSearchAuthz({
      userId: USER_ID,
      userRoleIds: [],
      userGroupIds: [],
      collectionRules: [rule],
    });
    expect(ast).toEqual<FilterAst>({ kind: 'deny_all' });
  });

  // 3. Single collection with allow rule (no row-condition) → in_collection
  it('returns in_collection for a simple unconditional allow rule', () => {
    const rule = makeRule({ collectionId: COL_ALPHA, roleId: ROLE_ID_A });
    const ast = compileSearchAuthz({
      userId: USER_ID,
      userRoleIds: [ROLE_ID_A],
      userGroupIds: [],
      collectionRules: [rule],
    });
    expect(ast).toEqual<FilterAst>({ kind: 'in_collection', collectionId: COL_ALPHA });
  });

  // 4. Single collection with unconditional deny rule → deny_all
  it('returns deny_all when a deny rule covers the collection unconditionally', () => {
    const denyRule = makeRule({ collectionId: COL_ALPHA, roleId: ROLE_ID_A, effect: 'deny' });
    const ast = compileSearchAuthz({
      userId: USER_ID,
      userRoleIds: [ROLE_ID_A],
      userGroupIds: [],
      collectionRules: [denyRule],
    });
    expect(ast).toEqual<FilterAst>({ kind: 'deny_all' });
  });

  // 5. Allow rule + row-condition { property: 'assigned_to', operator: 'equals',
  //    value: '@currentUser' } → attribute_match
  it('emits attribute_match for an equals/@currentUser row-condition', () => {
    const rule = makeRule({
      collectionId: COL_ALPHA,
      roleId: ROLE_ID_A,
      conditions: { property: 'assigned_to', operator: 'equals', value: '@currentUser' },
    });
    const ast = compileSearchAuthz({
      userId: USER_ID,
      userRoleIds: [ROLE_ID_A],
      userGroupIds: [],
      collectionRules: [rule],
    });
    expect(ast).toEqual<FilterAst>({
      kind: 'attribute_match',
      field: 'assigned_to',
      userAttribute: 'userId',
    });
  });

  // 6. Allow rule + literal equals condition → eq AST node
  it('emits eq for a literal equals row-condition', () => {
    const rule = makeRule({
      collectionId: COL_ALPHA,
      userId: USER_ID,
      conditions: { property: 'status', operator: 'equals', value: 'active' },
    });
    const ast = compileSearchAuthz({
      userId: USER_ID,
      userRoleIds: [],
      userGroupIds: [],
      collectionRules: [rule],
    });
    expect(ast).toEqual<FilterAst>({ kind: 'eq', field: 'status', value: 'active' });
  });

  // 7. Allow rule + IN condition → in AST node
  it('emits in for a literal in row-condition', () => {
    const rule = makeRule({
      collectionId: COL_ALPHA,
      userId: USER_ID,
      conditions: {
        property: 'region',
        operator: 'in',
        value: ['north', 'east'],
      },
    });
    const ast = compileSearchAuthz({
      userId: USER_ID,
      userRoleIds: [],
      userGroupIds: [],
      collectionRules: [rule],
    });
    expect(ast).toEqual<FilterAst>({
      kind: 'in',
      field: 'region',
      values: ['north', 'east'],
    });
  });

  // 8. Multiple collections, all unconditional allows → or of in_collection clauses
  it('combines multiple allowed collections with or', () => {
    const rules = [
      makeRule({ collectionId: COL_ALPHA, roleId: ROLE_ID_A }),
      makeRule({ collectionId: COL_BETA, roleId: ROLE_ID_A }),
    ];
    const ast = compileSearchAuthz({
      userId: USER_ID,
      userRoleIds: [ROLE_ID_A],
      userGroupIds: [],
      collectionRules: rules,
    });
    expect(ast.kind).toBe('or');
    const orAst = ast as Extract<FilterAst, { kind: 'or' }>;
    expect(orAst.clauses).toHaveLength(2);
    expect(orAst.clauses).toContainEqual<FilterAst>({
      kind: 'in_collection',
      collectionId: COL_ALPHA,
    });
    expect(orAst.clauses).toContainEqual<FilterAst>({
      kind: 'in_collection',
      collectionId: COL_BETA,
    });
  });

  // 9. Deny rule on one collection, allow on another → only allowed collection emitted
  it('excludes a denied collection while including an allowed one', () => {
    const rules = [
      makeRule({ collectionId: COL_ALPHA, roleId: ROLE_ID_A, effect: 'deny' }),
      makeRule({ collectionId: COL_BETA, roleId: ROLE_ID_A }),
    ];
    const ast = compileSearchAuthz({
      userId: USER_ID,
      userRoleIds: [ROLE_ID_A],
      userGroupIds: [],
      collectionRules: rules,
    });
    expect(ast).toEqual<FilterAst>({ kind: 'in_collection', collectionId: COL_BETA });
  });

  // 10. User in multiple roles, rules from each → union of effective allows
  it('unions allows from multiple roles', () => {
    const rules = [
      makeRule({ collectionId: COL_ALPHA, roleId: ROLE_ID_A }),
      makeRule({ collectionId: COL_BETA, roleId: ROLE_ID_B }),
      makeRule({ collectionId: COL_GAMMA, roleId: 'role-unrelated' }),
    ];
    const ast = compileSearchAuthz({
      userId: USER_ID,
      userRoleIds: [ROLE_ID_A, ROLE_ID_B],
      userGroupIds: [],
      collectionRules: rules,
    });
    expect(ast.kind).toBe('or');
    const orAst = ast as Extract<FilterAst, { kind: 'or' }>;
    const collectionIds = orAst.clauses
      .filter((c): c is Extract<FilterAst, { kind: 'in_collection' }> => c.kind === 'in_collection')
      .map((c) => c.collectionId);
    expect(collectionIds).toContain(COL_ALPHA);
    expect(collectionIds).toContain(COL_BETA);
    expect(collectionIds).not.toContain(COL_GAMMA);
  });

  // 11. User in multiple groups, rules from each → union of effective allows
  it('unions allows from multiple group memberships', () => {
    const rules = [
      makeRule({ collectionId: COL_ALPHA, groupId: GROUP_ID_A }),
      makeRule({ collectionId: COL_BETA, groupId: GROUP_ID_B }),
    ];
    const ast = compileSearchAuthz({
      userId: USER_ID,
      userRoleIds: [],
      userGroupIds: [GROUP_ID_A, GROUP_ID_B],
      collectionRules: rules,
    });
    expect(ast.kind).toBe('or');
    const orAst = ast as Extract<FilterAst, { kind: 'or' }>;
    expect(orAst.clauses).toHaveLength(2);
    expect(orAst.clauses).toContainEqual<FilterAst>({
      kind: 'in_collection',
      collectionId: COL_ALPHA,
    });
    expect(orAst.clauses).toContainEqual<FilterAst>({
      kind: 'in_collection',
      collectionId: COL_BETA,
    });
  });

  // 12. ABAC predicate referencing a user attribute other than userId → attribute_match
  it('emits attribute_match for an @currentUser.region ABAC predicate', () => {
    const rule = makeRule({
      collectionId: COL_ALPHA,
      roleId: ROLE_ID_A,
      conditions: { property: 'region', operator: 'equals', value: '@currentUser.region' },
    });
    const ast = compileSearchAuthz({
      userId: USER_ID,
      userRoleIds: [ROLE_ID_A],
      userGroupIds: [],
      collectionRules: [rule],
    });
    expect(ast).toEqual<FilterAst>({
      kind: 'attribute_match',
      field: 'region',
      userAttribute: 'region',
    });
  });

  // 13. Row-condition with unsupported operator → degrade to in_collection
  it('degrades to in_collection when row-condition uses an unsupported operator', () => {
    const rule = makeRule({
      collectionId: COL_ALPHA,
      roleId: ROLE_ID_A,
      // 'starts_with' is not in the supported AST vocabulary
      conditions: { property: 'name', operator: 'starts_with', value: 'HW-' },
    });
    const ast = compileSearchAuthz({
      userId: USER_ID,
      userRoleIds: [ROLE_ID_A],
      userGroupIds: [],
      collectionRules: [rule],
    });
    expect(ast).toEqual<FilterAst>({ kind: 'in_collection', collectionId: COL_ALPHA });
  });

  // 14. Collection-level deny + field-level allow on same collection → record-decision denies
  //     (§28.1: record visibility gates field evaluation; §28.3 level 1 deny wins)
  it('respects §28.3 level 1: deny rule excludes collection even when allow also matches', () => {
    const denyRule = makeRule({
      collectionId: COL_ALPHA,
      roleId: ROLE_ID_A,
      effect: 'deny',
      canRead: true,
    });
    // An allow rule on the same collection (different role) that would have opened it.
    const allowRule = makeRule({
      collectionId: COL_ALPHA,
      roleId: ROLE_ID_B,
      effect: 'allow',
      canRead: true,
    });
    const ast = compileSearchAuthz({
      userId: USER_ID,
      // User holds BOTH roles — §28.3 level 1 deny on ROLE_ID_A must still win.
      userRoleIds: [ROLE_ID_A, ROLE_ID_B],
      userGroupIds: [],
      collectionRules: [denyRule, allowRule],
    });
    // The unconditional deny at level 1 must exclude the collection entirely.
    expect(ast).toEqual<FilterAst>({ kind: 'deny_all' });
  });

  // 15. Public (no-principal) allow rule → matches every user
  it('matches a public allow rule (no principal fields) for any user', () => {
    const rule = makeRule({
      collectionId: COL_ALPHA,
      // No roleId, groupId, or userId — public rule
    });
    const ast = compileSearchAuthz({
      userId: 'anyone',
      userRoleIds: [],
      userGroupIds: [],
      collectionRules: [rule],
    });
    expect(ast).toEqual<FilterAst>({ kind: 'in_collection', collectionId: COL_ALPHA });
  });
});
