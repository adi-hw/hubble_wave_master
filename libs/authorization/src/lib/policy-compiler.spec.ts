import { PolicyCompilerService } from './policy-compiler.service';
import { AbacService } from './abac.service';
import type { AccessConditionData, UserAccessContext } from './types';
import type { LeafPredicate, OrPredicate, SafePredicate } from './abac.service';

const userContext: UserAccessContext = {
  userId: 'user-1',
  email: 'user-1@example.com',
  roleIds: ['role-a'],
  roleNames: ['Admin'],
  groupIds: ['group-a'],
  teamIds: [],
  siteIds: [],
  isAdmin: false,
};

const isLeaf = (p: SafePredicate): p is LeafPredicate => p.kind === 'leaf';
const isOr = (p: SafePredicate): p is OrPredicate => p.kind === 'or';

describe('PolicyCompilerService', () => {
  let compiler: PolicyCompilerService;

  beforeEach(() => {
    compiler = new PolicyCompilerService();
  });

  describe('single-branch OR', () => {
    it('flattens to the inner branch (existing behavior preserved)', () => {
      const condition: AccessConditionData = {
        or: [
          { property: 'owner_id', operator: 'equals', value: '@currentUser' },
        ],
      };

      const predicates = compiler.compile(condition, userContext);

      expect(predicates).toHaveLength(1);
      expect(isLeaf(predicates[0])).toBe(true);
      const leaf = predicates[0] as LeafPredicate;
      expect(leaf.field).toBe('owner_id');
      expect(leaf.operator).toBe('eq');
      expect(leaf.contextRef).toBe('userId');
    });
  });

  describe('multi-branch OR', () => {
    it('produces a top-level OR predicate with two branches of leaves', () => {
      const condition: AccessConditionData = {
        or: [
          { property: 'owner_id', operator: 'equals', value: '@currentUser' },
          { property: 'site_id', operator: 'equals', value: 'site-42' },
        ],
      };

      const predicates = compiler.compile(condition, userContext);

      expect(predicates).toHaveLength(1);
      expect(isOr(predicates[0])).toBe(true);
      const or = predicates[0] as OrPredicate;
      expect(or.branches).toHaveLength(2);

      const branch0 = or.branches[0];
      expect(branch0).toHaveLength(1);
      expect(isLeaf(branch0[0])).toBe(true);
      expect((branch0[0] as LeafPredicate).field).toBe('owner_id');
      expect((branch0[0] as LeafPredicate).contextRef).toBe('userId');

      const branch1 = or.branches[1];
      expect(branch1).toHaveLength(1);
      expect(isLeaf(branch1[0])).toBe(true);
      expect((branch1[0] as LeafPredicate).field).toBe('site_id');
      expect((branch1[0] as LeafPredicate).value).toBe('site-42');
    });
  });

  describe('empty branch protection', () => {
    it('throws when an OR branch compiles to no predicates', () => {
      const condition: AccessConditionData = {
        or: [
          { property: 'owner_id', operator: 'equals', value: 'u1' },
          // This branch has no property/operator/and/or content -> compiles to []
          {},
        ],
      };

      expect(() => compiler.compile(condition, userContext)).toThrow(
        /refusing to fail-open/,
      );
    });
  });

  describe('nested OR-of-AND', () => {
    it('packs a multi-leaf AND branch into a single OR branch entry', () => {
      const condition: AccessConditionData = {
        or: [
          {
            and: [
              { property: 'site_id', operator: 'equals', value: 'site-1' },
              { property: 'department_id', operator: 'equals', value: 'dept-1' },
            ],
          },
          { property: 'owner_id', operator: 'equals', value: '@currentUser' },
        ],
      };

      const predicates = compiler.compile(condition, userContext);

      expect(predicates).toHaveLength(1);
      expect(isOr(predicates[0])).toBe(true);
      const or = predicates[0] as OrPredicate;
      expect(or.branches).toHaveLength(2);

      // Branch 0: AND of two leaves
      expect(or.branches[0]).toHaveLength(2);
      expect(isLeaf(or.branches[0][0])).toBe(true);
      expect(isLeaf(or.branches[0][1])).toBe(true);
      expect((or.branches[0][0] as LeafPredicate).field).toBe('site_id');
      expect((or.branches[0][1] as LeafPredicate).field).toBe('department_id');

      // Branch 1: single leaf
      expect(or.branches[1]).toHaveLength(1);
      expect(isLeaf(or.branches[1][0])).toBe(true);
      expect((or.branches[1][0] as LeafPredicate).field).toBe('owner_id');
      expect((or.branches[1][0] as LeafPredicate).contextRef).toBe('userId');
    });
  });

  describe('AND-of-OR', () => {
    it('produces a leaf next to an OR predicate at the top level', () => {
      const condition: AccessConditionData = {
        and: [
          {
            or: [
              { property: 'site_id', operator: 'equals', value: 'site-1' },
              { property: 'site_id', operator: 'equals', value: 'site-2' },
            ],
          },
          { property: 'status', operator: 'equals', value: 'active' },
        ],
      };

      const predicates = compiler.compile(condition, userContext);

      expect(predicates).toHaveLength(2);

      // First entry: the OR (because and-children are pushed in order)
      expect(isOr(predicates[0])).toBe(true);
      const or = predicates[0] as OrPredicate;
      expect(or.branches).toHaveLength(2);
      expect((or.branches[0][0] as LeafPredicate).field).toBe('site_id');
      expect((or.branches[0][0] as LeafPredicate).value).toBe('site-1');
      expect((or.branches[1][0] as LeafPredicate).field).toBe('site_id');
      expect((or.branches[1][0] as LeafPredicate).value).toBe('site-2');

      // Second entry: the trailing leaf
      expect(isLeaf(predicates[1])).toBe(true);
      const leaf = predicates[1] as LeafPredicate;
      expect(leaf.field).toBe('status');
      expect(leaf.value).toBe('active');
    });
  });

  describe('SQL rendering via AbacService', () => {
    let abac: AbacService;

    beforeEach(() => {
      abac = new AbacService();
    });

    it('renders a multi-branch OR as a parenthesized disjunction', () => {
      const condition: AccessConditionData = {
        or: [
          { property: 'owner_id', operator: 'equals', value: '@currentUser' },
          { property: 'site_id', operator: 'equals', value: 'site-42' },
        ],
      };

      const predicates = compiler.compile(condition, userContext);
      const { clauses, params } = abac.buildPredicateClause(predicates, {
        userId: 'user-1',
        roles: ['role-a'],
      });

      expect(clauses).toHaveLength(1);
      expect(clauses[0]).toBe('(t."owner_id" = :rls_0 OR t."site_id" = :rls_1)');
      expect(params).toEqual({ rls_0: 'user-1', rls_1: 'site-42' });
    });

    it('renders an OR-of-AND as parenthesized AND branches joined by OR', () => {
      const condition: AccessConditionData = {
        or: [
          {
            and: [
              { property: 'site_id', operator: 'equals', value: 'site-1' },
              { property: 'department_id', operator: 'equals', value: 'dept-1' },
            ],
          },
          { property: 'owner_id', operator: 'equals', value: '@currentUser' },
        ],
      };

      const predicates = compiler.compile(condition, userContext);
      const { clauses, params } = abac.buildPredicateClause(predicates, {
        userId: 'user-1',
        roles: ['role-a'],
      });

      expect(clauses).toHaveLength(1);
      expect(clauses[0]).toBe(
        '((t."site_id" = :rls_0 AND t."department_id" = :rls_1) OR t."owner_id" = :rls_2)',
      );
      expect(params).toEqual({
        rls_0: 'site-1',
        rls_1: 'dept-1',
        rls_2: 'user-1',
      });
    });
  });
});
