import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { RequestContext } from '@hubblewave/auth-guard';
import {
  AuthorizationService,
} from './authorization.service';
import { PolicyCompilerService } from './policy-compiler.service';
import { CollectionAccessRuleData, PropertyAccessRuleData, PropertyMeta } from './types';
import type { AccessAuditPort } from './audit-port';

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

describe('AuthorizationService — multi-rule field permissions (F024)', () => {
  // F024: a user matching multiple field-level rules should get the UNION of
  // permissions (any rule granting canRead → read allowed), not whichever
  // rule sorted first. Masking takes the LEAST-restrictive value across
  // matching rules (NONE < PARTIAL < FULL — user sees the most).

  const ROLE_GUEST = '55555555-5555-5555-5555-555555555555';
  const ROLE_MANAGER = '66666666-6666-6666-6666-666666666666';
  const FIELD_SALARY: PropertyMeta = { code: 'salary' };

  function buildFieldRule(overrides: Partial<PropertyAccessRuleData> = {}): PropertyAccessRuleData {
    return {
      id: 'field-rule',
      propertyId: 'salary',
      propertyCode: 'salary',
      collectionId: COLLECTION_ID,
      roleId: null,
      groupId: null,
      userId: null,
      canRead: true,
      canWrite: true,
      conditions: null,
      priority: 1,
      isActive: true,
      maskingStrategy: 'NONE',
      ...overrides,
    };
  }

  function buildMultiRoleContext(roles: string[]): RequestContext {
    return {
      userId: 'user-1',
      roles,
      permissions: [],
      isAdmin: false,
      attributes: { roleIds: roles },
    } as unknown as RequestContext;
  }

  it('canRead is true if ANY matching rule grants read (union)', async () => {
    const { service } = buildService({
      propertyRules: [
        buildFieldRule({ id: 'r-restrictive', roleId: ROLE_GUEST, priority: 1, canRead: false }),
        buildFieldRule({ id: 'r-permissive', roleId: ROLE_MANAGER, priority: 10, canRead: true }),
      ],
    });

    const [authorized] = await service.getAuthorizedFieldsForCollection(
      buildMultiRoleContext([ROLE_GUEST, ROLE_MANAGER]),
      COLLECTION_ID,
      [FIELD_SALARY],
    );

    expect(authorized.canRead).toBe(true);
  });

  it('canWrite is true if ANY matching rule grants write (union)', async () => {
    const { service } = buildService({
      propertyRules: [
        buildFieldRule({ id: 'r-readonly', roleId: ROLE_GUEST, priority: 1, canWrite: false }),
        buildFieldRule({ id: 'r-editor', roleId: ROLE_MANAGER, priority: 10, canWrite: true }),
      ],
    });

    const [authorized] = await service.getAuthorizedFieldsForCollection(
      buildMultiRoleContext([ROLE_GUEST, ROLE_MANAGER]),
      COLLECTION_ID,
      [FIELD_SALARY],
    );

    expect(authorized.canWrite).toBe(true);
  });

  it('maskingStrategy is LEAST-restrictive across matching rules (NONE wins over PARTIAL wins over FULL)', async () => {
    const { service } = buildService({
      propertyRules: [
        buildFieldRule({ id: 'r-full-mask', roleId: ROLE_GUEST, priority: 1, maskingStrategy: 'FULL' }),
        buildFieldRule({ id: 'r-partial-mask', roleId: ROLE_GUEST, priority: 2, maskingStrategy: 'PARTIAL' }),
        buildFieldRule({ id: 'r-no-mask', roleId: ROLE_MANAGER, priority: 10, maskingStrategy: 'NONE' }),
      ],
    });

    const [authorized] = await service.getAuthorizedFieldsForCollection(
      buildMultiRoleContext([ROLE_GUEST, ROLE_MANAGER]),
      COLLECTION_ID,
      [FIELD_SALARY],
    );

    expect(authorized.maskingStrategy).toBe('NONE');
  });

  it('non-matching rules are ignored even when present', async () => {
    const { service } = buildService({
      propertyRules: [
        // ROLE_GUEST grants nothing — user does not have this role.
        buildFieldRule({ id: 'r-irrelevant', roleId: ROLE_GUEST, canRead: false, canWrite: false, maskingStrategy: 'FULL' }),
        buildFieldRule({ id: 'r-applies', roleId: ROLE_MANAGER, canRead: true, canWrite: true, maskingStrategy: 'NONE' }),
      ],
    });

    const [authorized] = await service.getAuthorizedFieldsForCollection(
      buildMultiRoleContext([ROLE_MANAGER]),
      COLLECTION_ID,
      [FIELD_SALARY],
    );

    expect(authorized.canRead).toBe(true);
    expect(authorized.canWrite).toBe(true);
    expect(authorized.maskingStrategy).toBe('NONE');
  });

  it('falls back to default permissions when no rule matches', async () => {
    const { service } = buildService({
      propertyRules: [
        buildFieldRule({ id: 'r-other-role', roleId: ROLE_GUEST, canRead: false, canWrite: false }),
      ],
    });

    // User has neither ROLE_GUEST nor ROLE_MANAGER — no rules match.
    const [authorized] = await service.getAuthorizedFieldsForCollection(
      buildMultiRoleContext([ROLE_VIEWER]),
      COLLECTION_ID,
      [FIELD_SALARY],
    );

    // Current default — F005 will change this default to deny in a future PR.
    expect(authorized.canRead).toBe(true);
    expect(authorized.canWrite).toBe(true);
    expect(authorized.maskingStrategy).toBe('NONE');
  });
});

describe('AuthorizationService — admin bypass audit (F021)', () => {
  // F021 (canon §10): every admin bypass in AuthorizationService MUST emit
  // an audit row. The port is OPTIONAL — when unbound the lib falls back to
  // silent bypass (preserves the "lib usable outside apps/api" property).

  function buildAdminContext(): RequestContext {
    return {
      userId: 'admin-1',
      roles: ['role-admin'],
      permissions: [],
      isAdmin: true,
      attributes: { roleIds: ['role-admin'] },
    } as unknown as RequestContext;
  }

  function buildServiceWithAudit(audit: AccessAuditPort | null): AuthorizationService {
    const policyCompiler = new PolicyCompilerService();
    const collectionAclRepo: CollectionAclRepoStub = {
      find: jest.fn().mockResolvedValue([]),
    };
    const propertyAclRepo: PropertyAclRepoStub = {
      find: jest.fn().mockResolvedValue([]),
    };
    return new AuthorizationService(
      collectionAclRepo,
      propertyAclRepo,
      null,
      null,
      policyCompiler,
      null,
      audit,
    );
  }

  it('canAccessCollection admin bypass calls the port', async () => {
    const port: AccessAuditPort = { logAdminBypass: jest.fn() };
    const service = buildServiceWithAudit(port);

    const allowed = await service.canAccessCollection(buildAdminContext(), COLLECTION_ID, 'read');

    expect(allowed).toBe(true);
    expect(port.logAdminBypass).toHaveBeenCalledTimes(1);
    expect(port.logAdminBypass).toHaveBeenCalledWith(expect.objectContaining({
      userId: 'admin-1',
      resource: COLLECTION_ID,
      action: 'read',
    }));
  });

  it('canAccessCollectionRecord admin bypass calls the port with recordId in context', async () => {
    const port: AccessAuditPort = { logAdminBypass: jest.fn() };
    const service = buildServiceWithAudit(port);

    const allowed = await service.canAccessCollectionRecord(
      buildAdminContext(),
      COLLECTION_ID,
      'update',
      { id: 'rec-42', name: 'x' },
    );

    expect(allowed).toBe(true);
    expect(port.logAdminBypass).toHaveBeenCalledTimes(1);
    expect(port.logAdminBypass).toHaveBeenCalledWith(expect.objectContaining({
      userId: 'admin-1',
      resource: COLLECTION_ID,
      action: 'update',
      context: expect.objectContaining({ recordId: 'rec-42' }),
    }));
  });

  it('getAuthorizedFieldsForCollection admin bypass calls the port with fields:read action', async () => {
    const port: AccessAuditPort = { logAdminBypass: jest.fn() };
    const service = buildServiceWithAudit(port);

    await service.getAuthorizedFieldsForCollection(
      buildAdminContext(),
      COLLECTION_ID,
      [{ code: 'name' }],
    );

    expect(port.logAdminBypass).toHaveBeenCalledTimes(1);
    expect(port.logAdminBypass).toHaveBeenCalledWith(expect.objectContaining({
      userId: 'admin-1',
      resource: COLLECTION_ID,
      action: 'fields:read',
    }));
  });

  it('buildCollectionRowLevelClause admin bypass calls the port with row-clause action', async () => {
    const port: AccessAuditPort = { logAdminBypass: jest.fn() };
    const service = buildServiceWithAudit(port);

    await service.buildCollectionRowLevelClause(buildAdminContext(), COLLECTION_ID, 'read', 't');

    expect(port.logAdminBypass).toHaveBeenCalledWith(expect.objectContaining({
      userId: 'admin-1',
      resource: COLLECTION_ID,
      action: 'read:row-clause',
    }));
  });

  it('non-admin path does NOT call the port', async () => {
    const port: AccessAuditPort = { logAdminBypass: jest.fn() };
    const service = buildServiceWithAudit(port);

    await service.canAccessCollection(buildContext(), COLLECTION_ID, 'read');

    expect(port.logAdminBypass).not.toHaveBeenCalled();
  });

  it('port not bound: bypass still works (no port required)', async () => {
    const service = buildServiceWithAudit(null);
    const allowed = await service.canAccessCollection(buildAdminContext(), COLLECTION_ID, 'read');
    expect(allowed).toBe(true);
  });

  it('port write failure does NOT crash the bypass path', async () => {
    const port: AccessAuditPort = {
      logAdminBypass: jest.fn(() => {
        throw new Error('audit DB down');
      }),
    };
    const service = buildServiceWithAudit(port);

    const allowed = await service.canAccessCollection(buildAdminContext(), COLLECTION_ID, 'read');

    expect(allowed).toBe(true);
    expect(port.logAdminBypass).toHaveBeenCalledTimes(1);
  });
});

describe('AuthorizationService — SQL principal-filter pushdown (F023)', () => {
  // F023: when the repo implements findByCollectionAndUser, the service
  // pushes the principal filter into SQL. Test stubs that only implement
  // find() fall back to per-collection fetch + JS filter.

  function buildSqlFilteredRepo(rules: CollectionAccessRuleData[]) {
    return {
      find: jest.fn().mockResolvedValue(rules),
      findByCollectionAndUser: jest.fn().mockResolvedValue(rules),
    };
  }

  it('uses findByCollectionAndUser when the repo provides it', async () => {
    const repo = buildSqlFilteredRepo([buildReadRule()]);
    const policyCompiler = new PolicyCompilerService();
    const service = new AuthorizationService(
      repo,
      { find: jest.fn().mockResolvedValue([]) },
      null,
      null,
      policyCompiler,
      null,
      null,
    );

    await service.canAccessCollection(buildContext(), COLLECTION_ID, 'read');

    expect(repo.findByCollectionAndUser).toHaveBeenCalledTimes(1);
    expect(repo.findByCollectionAndUser).toHaveBeenCalledWith(
      COLLECTION_ID,
      'user-1',
      [ROLE_VIEWER],
      [],
    );
    expect(repo.find).not.toHaveBeenCalled();
  });

  it('falls back to find when the repo lacks findByCollectionAndUser (stub compat)', async () => {
    const stubRepo = { find: jest.fn().mockResolvedValue([buildReadRule()]) };
    const policyCompiler = new PolicyCompilerService();
    const service = new AuthorizationService(
      stubRepo,
      { find: jest.fn().mockResolvedValue([]) },
      null,
      null,
      policyCompiler,
      null,
      null,
    );

    await service.canAccessCollection(buildContext(), COLLECTION_ID, 'read');

    expect(stubRepo.find).toHaveBeenCalledTimes(1);
  });

  it('passes groupIds + teamIds combined to the SQL filter', async () => {
    const repo = buildSqlFilteredRepo([]);
    const policyCompiler = new PolicyCompilerService();
    const service = new AuthorizationService(
      repo,
      { find: jest.fn().mockResolvedValue([]) },
      null,
      null,
      policyCompiler,
      null,
      null,
    );

    const ctx = {
      userId: 'user-1',
      roles: [ROLE_VIEWER],
      permissions: [],
      isAdmin: false,
      attributes: {
        roleIds: [ROLE_VIEWER],
        groupIds: ['group-a'],
        teamIds: ['team-b'],
      },
    } as unknown as RequestContext;

    await service.canAccessCollection(ctx, COLLECTION_ID, 'read');

    expect(repo.findByCollectionAndUser).toHaveBeenCalledWith(
      COLLECTION_ID,
      'user-1',
      [ROLE_VIEWER],
      expect.arrayContaining(['group-a', 'team-b']),
    );
  });
});

describe('AuthorizationService — cache invalidation (F025)', () => {
  // F025: AuthorizationService implements AccessRuleCacheInvalidationPort.
  // The TypeORM subscriber publishes here whenever a CollectionAccessRule
  // or PropertyAccessRule is written. Both methods must clear the
  // matching cache key(s), tolerate stores that don't enumerate keys
  // (memory fallback), and swallow errors (the write that triggered the
  // invalidation has already committed — propagating would orphan the
  // cache without fixing it).
  //
  // The cache stub here exposes only `get`/`set`/`del`, optionally `store`
  // (legacy v4 surface) or `stores` (v5/v7 Keyv surface). Each test wires
  // exactly what it asserts on.

  type DelMock = jest.Mock<Promise<boolean>, [string]>;

  interface CacheStub {
    get: jest.Mock;
    set: jest.Mock;
    del: DelMock;
    store?: {
      keys?: jest.Mock<Promise<string[]>, []>;
    };
    stores?: Array<{
      iterator?: () => AsyncIterableIterator<[string, unknown]>;
    }>;
  }

  function buildCache(overrides: Partial<CacheStub> = {}): CacheStub {
    return {
      get: jest.fn(),
      set: jest.fn(),
      del: jest.fn().mockResolvedValue(true),
      ...overrides,
    };
  }

  function buildServiceWithCache(cache: CacheStub | null): AuthorizationService {
    const policyCompiler = new PolicyCompilerService();
    return new AuthorizationService(
      { find: jest.fn().mockResolvedValue([]) },
      { find: jest.fn().mockResolvedValue([]) },
      // Cast through unknown — Cache from cache-manager is a fully-formed
      // interface and we only exercise the small subset the invalidation
      // path touches (`del`, optional `store.keys`, optional `stores[].iterator`).
      cache as unknown as ConstructorParameters<typeof AuthorizationService>[2],
      null,
      policyCompiler,
      null,
      null,
    );
  }

  /**
   * Build an async iterator over the provided keys, matching the
   * Keyv-style `[key, value]` tuple shape that `cache.stores[0].iterator()`
   * yields in cache-manager v5/v7.
   */
  function keyIterator(keys: string[]): () => AsyncIterableIterator<[string, unknown]> {
    return () => {
      let i = 0;
      const iter: AsyncIterableIterator<[string, unknown]> = {
        async next() {
          if (i >= keys.length) {
            return { value: undefined as unknown as [string, unknown], done: true };
          }
          const key = keys[i++];
          return { value: [key, null] as [string, unknown], done: false };
        },
        [Symbol.asyncIterator](): AsyncIterableIterator<[string, unknown]> {
          return iter;
        },
      };
      return iter;
    };
  }

  it('invalidateCollectionRules clears the exact unfiltered key', async () => {
    const cache = buildCache();
    const service = buildServiceWithCache(cache);

    await service.invalidateCollectionRules({
      collectionId: 'coll-1',
      operation: 'insert',
    });

    expect(cache.del).toHaveBeenCalledWith('auth:collection-rules:coll-1');
  });

  it('invalidateCollectionRules clears per-user variants via legacy store.keys()', async () => {
    const cache = buildCache({
      store: {
        keys: jest.fn().mockResolvedValue([
          'auth:collection-rules:coll-1:userhash-A',
          'auth:collection-rules:coll-1:userhash-B',
          'auth:collection-rules:other:userhash-Z', // different collection — must NOT be cleared
          'other:irrelevant',
        ]),
      },
    });
    const service = buildServiceWithCache(cache);

    await service.invalidateCollectionRules({
      collectionId: 'coll-1',
      operation: 'update',
    });

    expect(cache.del).toHaveBeenCalledWith('auth:collection-rules:coll-1');
    expect(cache.del).toHaveBeenCalledWith('auth:collection-rules:coll-1:userhash-A');
    expect(cache.del).toHaveBeenCalledWith('auth:collection-rules:coll-1:userhash-B');
    expect(cache.del).not.toHaveBeenCalledWith('auth:collection-rules:other:userhash-Z');
    expect(cache.del).not.toHaveBeenCalledWith('other:irrelevant');
  });

  it('invalidateCollectionRules clears per-user variants via v5/v7 stores[].iterator()', async () => {
    const cache = buildCache({
      stores: [
        {
          iterator: keyIterator([
            'auth:collection-rules:coll-2:userhash-1',
            'auth:collection-rules:coll-2:userhash-2',
            'auth:collection-rules:zzz:userhash-3',
          ]),
        },
      ],
    });
    const service = buildServiceWithCache(cache);

    await service.invalidateCollectionRules({
      collectionId: 'coll-2',
      operation: 'remove',
    });

    expect(cache.del).toHaveBeenCalledWith('auth:collection-rules:coll-2');
    expect(cache.del).toHaveBeenCalledWith('auth:collection-rules:coll-2:userhash-1');
    expect(cache.del).toHaveBeenCalledWith('auth:collection-rules:coll-2:userhash-2');
    expect(cache.del).not.toHaveBeenCalledWith('auth:collection-rules:zzz:userhash-3');
  });

  it('memory-store fallback: when keys() and iterator() are both absent, only the exact key is deleted', async () => {
    const cache = buildCache(); // no store.keys, no stores
    const service = buildServiceWithCache(cache);

    await service.invalidateCollectionRules({
      collectionId: 'coll-3',
      operation: 'insert',
    });

    // Per-user keys would expire via TTL — exact key is the load-bearing op.
    expect(cache.del).toHaveBeenCalledTimes(1);
    expect(cache.del).toHaveBeenCalledWith('auth:collection-rules:coll-3');
  });

  it('invalidatePropertyRules clears the per-collection property-rule key', async () => {
    const cache = buildCache();
    const service = buildServiceWithCache(cache);

    await service.invalidatePropertyRules({
      collectionId: 'coll-4',
      operation: 'update',
      propertyId: 'prop-X',
    });

    expect(cache.del).toHaveBeenCalledWith('auth:property-rules:coll-4');
    // Property invalidation does not currently use per-user variants.
    expect(cache.del).toHaveBeenCalledTimes(1);
  });

  it('invalidatePropertyRules without collectionId logs and is a no-op (defensive)', async () => {
    const cache = buildCache();
    const service = buildServiceWithCache(cache);

    await service.invalidatePropertyRules({
      collectionId: '',
      operation: 'insert',
      propertyId: 'prop-Y',
    });

    expect(cache.del).not.toHaveBeenCalled();
  });

  it('cache.del errors during invalidateCollectionRules are caught (no throw)', async () => {
    const cache = buildCache({
      del: jest.fn().mockRejectedValue(new Error('redis down')) as DelMock,
    });
    const service = buildServiceWithCache(cache);

    await expect(
      service.invalidateCollectionRules({
        collectionId: 'coll-err',
        operation: 'insert',
      }),
    ).resolves.toBeUndefined();
  });

  it('cache.del errors during invalidatePropertyRules are caught (no throw)', async () => {
    const cache = buildCache({
      del: jest.fn().mockRejectedValue(new Error('redis down')) as DelMock,
    });
    const service = buildServiceWithCache(cache);

    await expect(
      service.invalidatePropertyRules({
        collectionId: 'coll-err',
        operation: 'remove',
      }),
    ).resolves.toBeUndefined();
  });

  it('iterator() throwing degrades gracefully — exact key still cleared', async () => {
    const cache = buildCache({
      stores: [
        {
          iterator: () => {
            throw new Error('iterator unavailable');
          },
        },
      ],
    });
    const service = buildServiceWithCache(cache);

    await service.invalidateCollectionRules({
      collectionId: 'coll-iter-fail',
      operation: 'insert',
    });

    expect(cache.del).toHaveBeenCalledWith('auth:collection-rules:coll-iter-fail');
  });

  it('store.keys() throwing degrades gracefully — exact key still cleared', async () => {
    const cache = buildCache({
      store: {
        keys: jest.fn().mockRejectedValue(new Error('keys() broken')),
      },
    });
    const service = buildServiceWithCache(cache);

    await service.invalidateCollectionRules({
      collectionId: 'coll-keys-fail',
      operation: 'update',
    });

    expect(cache.del).toHaveBeenCalledWith('auth:collection-rules:coll-keys-fail');
  });

  it('no cache wired: both methods are no-ops without throwing', async () => {
    const service = buildServiceWithCache(null);

    await expect(
      service.invalidateCollectionRules({ collectionId: 'c', operation: 'insert' }),
    ).resolves.toBeUndefined();
    await expect(
      service.invalidatePropertyRules({ collectionId: 'c', operation: 'remove' }),
    ).resolves.toBeUndefined();
  });
});
