import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { RequestContext } from '@hubblewave/auth-guard';
import {
  AuthorizationService,
} from './authorization.service';
import { PolicyCompilerService } from './policy-compiler.service';
import { CollectionAccessRuleData, PropertyAccessRuleData } from './types';

type CollectionAclRepoStub = {
  find: jest.Mock<Promise<CollectionAccessRuleData[]>, [unknown]>;
};

type PropertyAclRepoStub = {
  find: jest.Mock<Promise<PropertyAccessRuleData[]>, [unknown]>;
};

type CollectionDefinitionRepoStub = {
  findOne: jest.Mock<Promise<{ id: string } | null>, [unknown]>;
};

const COLLECTION_ID = '11111111-1111-1111-1111-111111111111';
const ROLE_VIEWER = '22222222-2222-2222-2222-222222222222';

function buildContext(overrides: Partial<RequestContext> = {}): RequestContext {
  return {
    userId: 'user-1',
    roles: [ROLE_VIEWER],
    permissions: [],
    isAdmin: false,
    attributes: { roleIds: [ROLE_VIEWER] },
    ...overrides,
  };
}

function buildReadRule(overrides: Partial<CollectionAccessRuleData> = {}): CollectionAccessRuleData {
  return {
    id: 'rule-1',
    collectionId: COLLECTION_ID,
    name: 'viewer-read',
    description: null,
    roleId: ROLE_VIEWER,
    groupId: null,
    userId: null,
    canRead: true,
    canCreate: false,
    canUpdate: false,
    canDelete: false,
    conditions: null,
    priority: 1,
    isActive: true,
    ...overrides,
  };
}

function buildService(opts: {
  collectionRules?: CollectionAccessRuleData[];
  propertyRules?: PropertyAccessRuleData[];
  tableNameToId?: Record<string, string>;
} = {}): {
  service: AuthorizationService;
  collectionAclRepo: CollectionAclRepoStub;
  propertyAclRepo: PropertyAclRepoStub;
  collectionDefinitionRepo: CollectionDefinitionRepoStub;
} {
  const collectionAclRepo: CollectionAclRepoStub = {
    find: jest.fn().mockResolvedValue(opts.collectionRules ?? []),
  };
  const propertyAclRepo: PropertyAclRepoStub = {
    find: jest.fn().mockResolvedValue(opts.propertyRules ?? []),
  };
  const collectionDefinitionRepo: CollectionDefinitionRepoStub = {
    findOne: jest.fn().mockImplementation(({ where }: { where: { tableName: string } }) => {
      const map = opts.tableNameToId ?? {};
      const id = map[where.tableName];
      return Promise.resolve(id ? { id } : null);
    }),
  };

  const policyCompiler = new PolicyCompilerService();
  const service = new AuthorizationService(
    collectionAclRepo,
    propertyAclRepo,
    null,
    null,
    policyCompiler,
    collectionDefinitionRepo,
  );

  return { service, collectionAclRepo, propertyAclRepo, collectionDefinitionRepo };
}

describe('AuthorizationService — collection-id API', () => {
  it('canAccessCollection grants access when a matching rule exists', async () => {
    const { service, collectionAclRepo } = buildService({
      collectionRules: [buildReadRule()],
    });

    const allowed = await service.canAccessCollection(buildContext(), COLLECTION_ID, 'read');

    expect(allowed).toBe(true);
    expect(collectionAclRepo.find).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ collectionId: COLLECTION_ID }) }),
    );
  });

  it('canAccessCollection denies access when no rule matches the operation', async () => {
    const { service } = buildService({
      collectionRules: [buildReadRule({ canRead: false })],
    });

    const allowed = await service.canAccessCollection(buildContext(), COLLECTION_ID, 'read');

    expect(allowed).toBe(false);
  });

  it('ensureCollectionAccess throws ForbiddenException when access denied', async () => {
    const { service } = buildService({ collectionRules: [] });

    await expect(
      service.ensureCollectionAccess(buildContext(), COLLECTION_ID, 'read'),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('admins bypass collection-level checks', async () => {
    const { service, collectionAclRepo } = buildService();

    const allowed = await service.canAccessCollection(
      buildContext({ isAdmin: true }),
      COLLECTION_ID,
      'read',
    );

    expect(allowed).toBe(true);
    expect(collectionAclRepo.find).not.toHaveBeenCalled();
  });
});

describe('AuthorizationService — table-name wrappers (deprecated)', () => {
  it('canAccessTable resolves tableName -> collectionId and reuses canAccessCollection', async () => {
    const { service, collectionDefinitionRepo, collectionAclRepo } = buildService({
      collectionRules: [buildReadRule()],
      tableNameToId: { incidents: COLLECTION_ID },
    });

    const allowed = await service.canAccessTable(buildContext(), 'incidents', 'read');

    expect(allowed).toBe(true);
    expect(collectionDefinitionRepo.findOne).toHaveBeenCalledWith({ where: { tableName: 'incidents' } });
    expect(collectionAclRepo.find).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ collectionId: COLLECTION_ID }) }),
    );
  });

  it('canAccessTable throws NotFoundException for an unknown tableName (no fail-open)', async () => {
    const { service, collectionAclRepo } = buildService({
      collectionRules: [buildReadRule()],
      tableNameToId: {}, // no mapping at all
    });

    await expect(
      service.canAccessTable(buildContext(), 'mystery_table', 'read'),
    ).rejects.toBeInstanceOf(NotFoundException);

    // We never queried the ACL repo because resolution failed up front.
    expect(collectionAclRepo.find).not.toHaveBeenCalled();
  });

  it('ensureTableAccess throws NotFoundException for an unknown tableName', async () => {
    const { service } = buildService({ tableNameToId: {} });

    await expect(
      service.ensureTableAccess(buildContext(), 'mystery_table', 'read'),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('renaming a table breaks the OLD name (throws) but the new name continues to enforce rules', async () => {
    const { service } = buildService({
      collectionRules: [buildReadRule()],
      tableNameToId: { incidents_v2: COLLECTION_ID }, // simulated rename
    });

    // Old name no longer resolves — must throw, never silently grant.
    await expect(
      service.canAccessTable(buildContext(), 'incidents', 'read'),
    ).rejects.toBeInstanceOf(NotFoundException);

    // New name resolves and rule enforcement continues.
    await expect(service.canAccessTable(buildContext(), 'incidents_v2', 'read')).resolves.toBe(true);
  });

  it('getSafeRowLevelPredicates throws NotFoundException for an unknown tableName (no fail-open)', async () => {
    const { service } = buildService({ tableNameToId: {} });

    await expect(
      service.getSafeRowLevelPredicates(buildContext(), 'mystery_table', 'read'),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('buildRowLevelClause throws NotFoundException for an unknown tableName (no fail-open)', async () => {
    const { service } = buildService({ tableNameToId: {} });

    await expect(
      service.buildRowLevelClause(buildContext(), 'mystery_table', 'read'),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('admins bypass tableName resolution entirely (no DB lookup, no throw)', async () => {
    const { service, collectionDefinitionRepo } = buildService({ tableNameToId: {} });

    await expect(
      service.ensureTableAccess(buildContext({ isAdmin: true }), 'mystery_table', 'read'),
    ).resolves.toBeUndefined();

    expect(collectionDefinitionRepo.findOne).not.toHaveBeenCalled();
  });
});

describe('AuthorizationService — resolution failure modes', () => {
  it('throws NotFoundException when no CollectionDefinition repo is configured', async () => {
    const policyCompiler = new PolicyCompilerService();
    const service = new AuthorizationService(
      { find: jest.fn().mockResolvedValue([]) },
      { find: jest.fn().mockResolvedValue([]) },
      null,
      null,
      policyCompiler,
      null, // intentionally no repo
    );

    await expect(
      service.canAccessTable(buildContext(), 'incidents', 'read'),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('throws NotFoundException when an empty tableName is supplied', async () => {
    const { service } = buildService();

    await expect(
      service.canAccessTable(buildContext(), '', 'read'),
    ).rejects.toBeInstanceOf(NotFoundException);
  });
});

describe('AuthorizationService — multi-rule row-level predicates (F003)', () => {
  // F003: a user matching multiple row-level rules should see the UNION of
  // records each rule grants, not the intersection. Predicates WITHIN one
  // rule's conditions are still AND'd; predicates ACROSS rules are OR'd.

  const ROLE_ANALYST = '33333333-3333-3333-3333-333333333333';
  const TEAM_ALPHA = '44444444-4444-4444-4444-444444444444';

  function buildMultiRuleContext(): RequestContext {
    return {
      userId: 'user-1',
      roles: [ROLE_VIEWER, ROLE_ANALYST],
      permissions: [],
      isAdmin: false,
      attributes: {
        roleIds: [ROLE_VIEWER, ROLE_ANALYST],
        groupIds: [TEAM_ALPHA],
      },
    } as unknown as RequestContext;
  }

  it('returns flat predicates when exactly one rule matches (single-rule AND semantic)', async () => {
    const { service } = buildService({
      collectionRules: [
        buildReadRule({
          conditions: { property: 'owner_id', operator: 'equals', value: '@currentUser' },
        }),
      ],
    });

    const predicates = await service.getSafeRowLevelPredicatesForCollection(
      buildMultiRuleContext(),
      COLLECTION_ID,
      'read',
    );

    expect(predicates).toHaveLength(1);
    expect(predicates[0].kind).toBe('leaf');
  });

  it('wraps multi-rule predicates in a single or-branch (F003)', async () => {
    const { service } = buildService({
      collectionRules: [
        buildReadRule({
          id: 'rule-own',
          roleId: ROLE_VIEWER,
          conditions: { property: 'owner_id', operator: 'equals', value: '@currentUser' },
        }),
        buildReadRule({
          id: 'rule-team',
          roleId: ROLE_ANALYST,
          conditions: { property: 'team_id', operator: 'in', value: '@teams' },
        }),
      ],
    });

    const predicates = await service.getSafeRowLevelPredicatesForCollection(
      buildMultiRuleContext(),
      COLLECTION_ID,
      'read',
    );

    expect(predicates).toHaveLength(1);
    expect(predicates[0].kind).toBe('or');
    if (predicates[0].kind === 'or') {
      expect(predicates[0].branches).toHaveLength(2);
    }
  });

  it('emits SQL with OR between branches, not AND, end-to-end (F003)', async () => {
    const { service } = buildService({
      collectionRules: [
        buildReadRule({
          id: 'rule-own',
          roleId: ROLE_VIEWER,
          conditions: { property: 'owner_id', operator: 'equals', value: '@currentUser' },
        }),
        buildReadRule({
          id: 'rule-team',
          roleId: ROLE_ANALYST,
          conditions: { property: 'team_id', operator: 'in', value: '@teams' },
        }),
      ],
    });

    const { clauses } = await service.buildCollectionRowLevelClause(
      buildMultiRuleContext(),
      COLLECTION_ID,
      'read',
      't',
    );

    expect(clauses).toHaveLength(1);
    expect(clauses[0]).toMatch(/\bOR\b/);
    // The outer clause must be an OR, not an AND, of the two rules' branches.
    // (Inner AND within a single branch's multi-property condition would still
    // be valid; this assertion just guards against the top-level being AND.)
    expect(clauses[0]).toContain('owner_id');
    expect(clauses[0]).toContain('team_id');
  });

  it('returns [] when any matched rule grants unconditionally', async () => {
    const { service } = buildService({
      collectionRules: [
        buildReadRule({
          id: 'rule-restrictive',
          roleId: ROLE_VIEWER,
          conditions: { property: 'owner_id', operator: 'equals', value: '@currentUser' },
        }),
        buildReadRule({
          id: 'rule-unconditional',
          roleId: ROLE_ANALYST,
          conditions: null,
        }),
      ],
    });

    const predicates = await service.getSafeRowLevelPredicatesForCollection(
      buildMultiRuleContext(),
      COLLECTION_ID,
      'read',
    );

    expect(predicates).toEqual([]);
  });
});
