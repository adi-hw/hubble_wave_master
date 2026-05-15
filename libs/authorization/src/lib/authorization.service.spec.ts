import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { UserRequestContext } from '@hubblewave/auth-guard';
import {
  AuthorizationService,
} from './authorization.service';
import { PolicyCompilerService } from './policy-compiler.service';
import { CollectionAccessRuleData, PropertyAccessRuleData, PropertyMeta } from './types';

type CollectionAclRepoStub = {
  find: jest.Mock<Promise<CollectionAccessRuleData[]>, [unknown]>;
};

type PropertyAclRepoStub = {
  find: jest.Mock<Promise<PropertyAccessRuleData[]>, [unknown]>;
};

type CollectionDefinitionRepoStub = {
  findOne: jest.Mock<Promise<{ id: string; secureFieldsByDefault?: boolean } | null>, [unknown]>;
};

const COLLECTION_ID = '11111111-1111-1111-1111-111111111111';
const ROLE_VIEWER = '22222222-2222-2222-2222-222222222222';

function buildContext(overrides: Partial<UserRequestContext> = {}): UserRequestContext {
  return {
    kind: 'user',
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
    // F006: default to `allow` so legacy tests preserve their pre-§28
    // semantics; deny rules override per-test.
    effect: 'allow',
    ...overrides,
  };
}

function buildService(opts: {
  collectionRules?: CollectionAccessRuleData[];
  propertyRules?: PropertyAccessRuleData[];
  tableNameToId?: Record<string, string>;
  // F005: per-collection-id flags. Keyed by collectionId UUID; values
  // are the row's `secureFieldsByDefault` setting. Absence is treated
  // as "no row exists" (lookup returns null → evaluator defaults to
  // false → legacy default-allow). Explicit `false` is treated as
  // "row exists, opt-out".
  collectionFlags?: Record<string, { secureFieldsByDefault: boolean }>;
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
    findOne: jest.fn().mockImplementation(
      ({ where }: { where: { tableName?: string; id?: string } }) => {
        // tableName lookup (deprecated *Table wrappers)
        if (typeof where.tableName === 'string') {
          const map = opts.tableNameToId ?? {};
          const id = map[where.tableName];
          return Promise.resolve(id ? { id } : null);
        }
        // id lookup (F005 — secureFieldsByDefault flag check)
        if (typeof where.id === 'string') {
          const flags = opts.collectionFlags ?? {};
          const row = flags[where.id];
          if (!row) {
            return Promise.resolve(null);
          }
          return Promise.resolve({
            id: where.id,
            secureFieldsByDefault: row.secureFieldsByDefault,
          });
        }
        return Promise.resolve(null);
      },
    ),
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

  it('canon §28.6 (Plan Fix 33): admin with seeded policy rule is allowed via the §28 evaluator', async () => {
    // The bypass is gone. Admin access is granted by explicit CollectionAccessRule rows
    // seeded at instance provision time (migration 1931100000000-seed-admin-policies.ts).
    // In this test we simulate that by providing an allow rule keyed to the admin role id.
    const ADMIN_ROLE_ID = 'role-admin';
    const adminRule = buildReadRule({
      roleId: ADMIN_ROLE_ID,
      canRead: true,
      canCreate: true,
      canUpdate: true,
      canDelete: true,
    });
    const { service, collectionAclRepo } = buildService({ collectionRules: [adminRule] });

    const allowed = await service.canAccessCollection(
      buildContext({ isAdmin: true, attributes: { roleIds: [ADMIN_ROLE_ID] } }),
      COLLECTION_ID,
      'read',
    );

    expect(allowed).toBe(true);
    // The evaluator was invoked — no short-circuit bypass.
    expect(collectionAclRepo.find).toHaveBeenCalled();
  });

  it('canon §28.6 (Plan Fix 33): admin WITHOUT seeded policies is denied — bypass is gone', async () => {
    // Regression guard: verifies the bypass was actually removed.
    // An admin user with isAdmin=true but no matching rule in the repo is denied.
    const { service, collectionAclRepo } = buildService({ collectionRules: [] });

    const denied = await service.canAccessCollection(
      buildContext({ isAdmin: true }),
      COLLECTION_ID,
      'read',
    );

    expect(denied).toBe(false);
    // The repo was queried — the evaluator ran, found no rules, and applied default deny.
    expect(collectionAclRepo.find).toHaveBeenCalled();
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

  // Plan Fix 33 / canon §28.6 retired the admin short-circuit: admin role
  // now goes through the §28 evaluator like every other role, with broad
  // allow rules seeded by 1931100000000-seed-admin-policies.ts. Unknown
  // tables therefore throw NotFoundException for admins too — the old
  // "bypass tableName resolution entirely" guarantee is gone by design.
  it('admins still throw NotFoundException for unknown tableName (no §28.6 short-circuit)', async () => {
    const { service, collectionDefinitionRepo } = buildService({ tableNameToId: {} });

    await expect(
      service.ensureTableAccess(buildContext({ isAdmin: true }), 'mystery_table', 'read'),
    ).rejects.toBeInstanceOf(NotFoundException);

    expect(collectionDefinitionRepo.findOne).toHaveBeenCalled();
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

  function buildMultiRuleContext(): UserRequestContext {
    return {
      userId: 'user-1',
      roles: [ROLE_VIEWER, ROLE_ANALYST],
      permissions: [],
      isAdmin: false,
      attributes: {
        roleIds: [ROLE_VIEWER, ROLE_ANALYST],
        groupIds: [TEAM_ALPHA],
      },
    } as unknown as UserRequestContext;
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

describe('AuthorizationService — multi-rule field permissions (F024 + canon §28.5)', () => {
  // F024: a user matching multiple field-level rules should get the UNION of
  // permissions (any rule granting canRead → read allowed), not whichever
  // rule sorted first.
  //
  // Canon §28.5 (F006 amendment) inverts the masking-direction half of F024:
  // masking now takes the MOST-restrictive value across matching rules
  // (NONE < PARTIAL < FULL — user sees the LEAST data, enforcing HIPAA
  // minimum-necessary at the field level). The canRead/canWrite union
  // behaviour is unchanged.

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
      // F006: default to `allow`; deny rules override per-test.
      effect: 'allow',
      ...overrides,
    };
  }

  function buildMultiRoleContext(roles: string[]): UserRequestContext {
    return {
      userId: 'user-1',
      roles,
      permissions: [],
      isAdmin: false,
      attributes: { roleIds: roles },
    } as unknown as UserRequestContext;
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

  it('maskingStrategy is MOST-restrictive across matching rules (FULL wins over PARTIAL wins over NONE) — canon §28.5', async () => {
    // Canon §28.5 inverts the pre-§28 F024 behaviour: roles compose
    // conjunctively, so a user with three matching allow rules at
    // NONE/PARTIAL/FULL severities sees the FULL mask. This enforces
    // HIPAA's "minimum necessary" principle at the field level — the
    // more restrictive role's intent must hold.
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

    expect(authorized.maskingStrategy).toBe('FULL');
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

  it('falls back to LEGACY default permissions when no rule matches and secureFieldsByDefault=false', async () => {
    // This test is the F024 default-allow fallback path. After F005
    // (canon §28.2 level 7), default-allow is the LEGACY behaviour
    // preserved only when the collection's `secureFieldsByDefault`
    // flag is false. The default-deny case is covered in the
    // "secureFieldsByDefault flag" describe block below.
    const { service } = buildService({
      propertyRules: [
        buildFieldRule({ id: 'r-other-role', roleId: ROLE_GUEST, canRead: false, canWrite: false }),
      ],
    });

    // User has neither ROLE_GUEST nor ROLE_MANAGER — no rules match.
    // The default CollectionDefinitionRepoStub returns null for unknown
    // ids, which the evaluator treats as "no flag opt-in" → legacy
    // default-allow.
    const [authorized] = await service.getAuthorizedFieldsForCollection(
      buildMultiRoleContext([ROLE_VIEWER]),
      COLLECTION_ID,
      [FIELD_SALARY],
    );

    // Legacy default — NOT canon §28.2 level 7. Default-deny is the
    // §28-aligned behaviour, opted into per-collection via the flag.
    expect(authorized.canRead).toBe(true);
    expect(authorized.canWrite).toBe(true);
    expect(authorized.maskingStrategy).toBe('NONE');
  });
});

describe('AuthorizationService — admin via seeded policies (canon §28.6 / Plan Fix 33)', () => {
  // Canon §28.6: the silent `if (ctx.isAdmin) return true` bypass has been
  // retired. Admin access is now granted by explicit CollectionAccessRule and
  // PropertyAccessRule rows seeded at instance provision time
  // (migration 1931100000000-seed-admin-policies.ts). This suite verifies
  // that the §28 evaluator handles admin users correctly through the normal
  // rule-evaluation path.

  const ADMIN_ROLE_ID = 'admin-role-uuid';

  function buildAdminContext(): UserRequestContext {
    return {
      kind: 'user',
      userId: 'admin-1',
      roles: [ADMIN_ROLE_ID],
      permissions: [],
      isAdmin: true,
      attributes: { roleIds: [ADMIN_ROLE_ID] },
    } as unknown as UserRequestContext;
  }

  function buildAdminCollectionRule(
    overrides: Partial<CollectionAccessRuleData> = {},
  ): CollectionAccessRuleData {
    return {
      id: 'admin-rule-1',
      collectionId: COLLECTION_ID,
      name: 'Admin full access',
      description: null,
      roleId: ADMIN_ROLE_ID,
      groupId: null,
      userId: null,
      canRead: true,
      canCreate: true,
      canUpdate: true,
      canDelete: true,
      conditions: null,
      priority: 0,
      isActive: true,
      effect: 'allow',
      ...overrides,
    };
  }

  it('admin with seeded collection rule is allowed via the §28 evaluator (collection read)', async () => {
    const { service } = buildService({ collectionRules: [buildAdminCollectionRule()] });

    const allowed = await service.canAccessCollection(buildAdminContext(), COLLECTION_ID, 'read');

    expect(allowed).toBe(true);
  });

  it('admin with seeded collection rule is allowed for all operations', async () => {
    const { service } = buildService({ collectionRules: [buildAdminCollectionRule()] });
    const ctx = buildAdminContext();

    expect(await service.canAccessCollection(ctx, COLLECTION_ID, 'create')).toBe(true);
    expect(await service.canAccessCollection(ctx, COLLECTION_ID, 'update')).toBe(true);
    expect(await service.canAccessCollection(ctx, COLLECTION_ID, 'delete')).toBe(true);
  });

  it('admin WITHOUT seeded policies is denied — no bypass remains', async () => {
    // Regression guard: with no matching rule, default deny fires.
    const { service } = buildService({ collectionRules: [] });

    const denied = await service.canAccessCollection(buildAdminContext(), COLLECTION_ID, 'read');

    expect(denied).toBe(false);
  });

  it('admin with seeded collection rule can access a specific record', async () => {
    const { service } = buildService({ collectionRules: [buildAdminCollectionRule()] });

    const allowed = await service.canAccessCollectionRecord(
      buildAdminContext(),
      COLLECTION_ID,
      'update',
      { id: 'rec-42', name: 'x' },
    );

    expect(allowed).toBe(true);
  });

  it('admin with seeded wildcard property rule sees all fields canRead=true, canWrite=true, masking=NONE', async () => {
    const wildcardPropRule: PropertyAccessRuleData = {
      id: 'admin-prop-rule-1',
      propertyId: null,
      wildcardCollectionId: COLLECTION_ID,
      roleId: ADMIN_ROLE_ID,
      groupId: null,
      userId: null,
      canRead: true,
      canWrite: true,
      conditions: null,
      priority: 0,
      isActive: true,
      effect: 'allow',
      maskingStrategy: 'NONE',
    };
    const { service } = buildService({ propertyRules: [wildcardPropRule] });

    const [authorized] = await service.getAuthorizedFieldsForCollection(
      buildAdminContext(),
      COLLECTION_ID,
      [{ code: 'sensitive_field' }],
    );

    expect(authorized.canRead).toBe(true);
    expect(authorized.canWrite).toBe(true);
    expect(authorized.maskingStrategy).toBe('NONE');
  });

  it('admin row-level clause is empty when seeded rule is unconditional (conditions=null)', async () => {
    const { service } = buildService({ collectionRules: [buildAdminCollectionRule()] });

    const clause = await service.buildCollectionRowLevelClause(
      buildAdminContext(),
      COLLECTION_ID,
      'read',
      't',
    );

    // Unconditional allow → no row predicates → empty WHERE clause.
    expect(clause.clauses).toHaveLength(0);
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
    } as unknown as UserRequestContext;

    await service.canAccessCollection(ctx, COLLECTION_ID, 'read');

    expect(repo.findByCollectionAndUser).toHaveBeenCalledWith(
      COLLECTION_ID,
      'user-1',
      [ROLE_VIEWER],
      expect.arrayContaining(['group-a', 'team-b']),
    );
  });

  // ── W6.D / F047 — groupCache in UserRequestContext ─────────────────────────

  it('W6.D: uses groupCache.get(userId) over attributes.groupIds when both are present', async () => {
    const repo = buildSqlFilteredRepo([]);
    const policyCompiler = new PolicyCompilerService();
    const service = new AuthorizationService(
      repo,
      { find: jest.fn().mockResolvedValue([]) },
      null,
      null,
      policyCompiler,
      null,
    );

    const groupCache = new Map<string, string[]>([
      ['user-1', ['grp-from-cache']],
    ]);

    const ctx = {
      kind: 'user',
      userId: 'user-1',
      roles: [ROLE_VIEWER],
      permissions: [],
      isAdmin: false,
      attributes: {
        roleIds: [ROLE_VIEWER],
        groupIds: ['grp-from-attributes'],  // should be ignored
      },
      groupCache,
    } as unknown as UserRequestContext;

    await service.canAccessCollection(ctx, COLLECTION_ID, 'read');

    // groupCache wins: only the cache value is passed to the repo
    expect(repo.findByCollectionAndUser).toHaveBeenCalledWith(
      COLLECTION_ID,
      'user-1',
      [ROLE_VIEWER],
      expect.arrayContaining(['grp-from-cache']),
    );
    expect(repo.findByCollectionAndUser).not.toHaveBeenCalledWith(
      COLLECTION_ID,
      'user-1',
      [ROLE_VIEWER],
      expect.arrayContaining(['grp-from-attributes']),
    );
  });

  it('W6.D: falls back to attributes.groupIds when groupCache has no entry for the user', async () => {
    const repo = buildSqlFilteredRepo([]);
    const policyCompiler = new PolicyCompilerService();
    const service = new AuthorizationService(
      repo,
      { find: jest.fn().mockResolvedValue([]) },
      null,
      null,
      policyCompiler,
      null,
    );

    const groupCache = new Map<string, string[]>(); // empty — no entry for user-1

    const ctx = {
      kind: 'user',
      userId: 'user-1',
      roles: [ROLE_VIEWER],
      permissions: [],
      isAdmin: false,
      attributes: {
        roleIds: [ROLE_VIEWER],
        groupIds: ['grp-from-attributes'],
      },
      groupCache,
    } as unknown as UserRequestContext;

    await service.canAccessCollection(ctx, COLLECTION_ID, 'read');

    expect(repo.findByCollectionAndUser).toHaveBeenCalledWith(
      COLLECTION_ID,
      'user-1',
      [ROLE_VIEWER],
      expect.arrayContaining(['grp-from-attributes']),
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

describe('AuthorizationService — collection deny rules (F006, canon §28.3/§28.4)', () => {
  // F006 + canon §28.4 rule 1: a deny rule at the collection level wins
  // outright against co-matching allows. Conditional denies scope to the
  // records their conditions match; unconditional denies block the whole
  // collection.

  const ROLE_RESTRICTED = '77777777-7777-7777-7777-777777777777';

  it('user matching only a deny rule is denied collection access (canon §28.4 rule 4 — missing allow = deny)', async () => {
    const { service } = buildService({
      collectionRules: [
        buildReadRule({
          id: 'rule-deny-only',
          effect: 'deny',
          roleId: ROLE_VIEWER,
          conditions: null,
        }),
      ],
    });

    const allowed = await service.canAccessCollection(buildContext(), COLLECTION_ID, 'read');

    expect(allowed).toBe(false);
  });

  it('deny wins when both allow and deny match (canon §28.4 rule 1)', async () => {
    const { service } = buildService({
      collectionRules: [
        buildReadRule({ id: 'rule-allow', effect: 'allow', roleId: ROLE_VIEWER }),
        buildReadRule({
          id: 'rule-deny',
          effect: 'deny',
          roleId: ROLE_VIEWER,
          conditions: null,
        }),
      ],
    });

    const allowed = await service.canAccessCollection(buildContext(), COLLECTION_ID, 'read');

    expect(allowed).toBe(false);
  });

  it('two matching allows still grant access (existing F003 UNION behaviour preserved)', async () => {
    const { service } = buildService({
      collectionRules: [
        buildReadRule({ id: 'rule-a', effect: 'allow', roleId: ROLE_VIEWER }),
        buildReadRule({ id: 'rule-b', effect: 'allow', roleId: ROLE_VIEWER }),
      ],
    });

    const allowed = await service.canAccessCollection(buildContext(), COLLECTION_ID, 'read');

    expect(allowed).toBe(true);
  });

  it('conditional deny does NOT block the collection-level operation check', async () => {
    // A deny with row-conditions can only carve out specific records;
    // canAccessCollection answers the operation-level question and
    // ignores conditional denies (they're applied per-record).
    const { service } = buildService({
      collectionRules: [
        buildReadRule({ id: 'rule-allow', effect: 'allow', roleId: ROLE_VIEWER }),
        buildReadRule({
          id: 'rule-cond-deny',
          effect: 'deny',
          roleId: ROLE_VIEWER,
          conditions: { property: 'classification', operator: 'equals', value: 'secret' },
        }),
      ],
    });

    const allowed = await service.canAccessCollection(buildContext(), COLLECTION_ID, 'read');

    expect(allowed).toBe(true);
  });

  it('canAccessCollectionRecord denies a record matching a conditional deny', async () => {
    const { service } = buildService({
      collectionRules: [
        buildReadRule({ id: 'rule-allow', effect: 'allow', roleId: ROLE_VIEWER }),
        buildReadRule({
          id: 'rule-cond-deny',
          effect: 'deny',
          roleId: ROLE_VIEWER,
          conditions: { property: 'classification', operator: 'equals', value: 'secret' },
        }),
      ],
    });

    const denied = await service.canAccessCollectionRecord(
      buildContext(),
      COLLECTION_ID,
      'read',
      { id: 'rec-1', classification: 'secret' },
    );
    const allowed = await service.canAccessCollectionRecord(
      buildContext(),
      COLLECTION_ID,
      'read',
      { id: 'rec-2', classification: 'public' },
    );

    expect(denied).toBe(false);
    expect(allowed).toBe(true);
  });

  it('unconditional deny without conditions denies the whole collection regardless of allow', async () => {
    const { service } = buildService({
      collectionRules: [
        buildReadRule({ id: 'rule-allow', effect: 'allow', roleId: ROLE_VIEWER }),
        buildReadRule({
          id: 'rule-uncond-deny',
          effect: 'deny',
          roleId: ROLE_RESTRICTED,
          conditions: null,
        }),
      ],
    });

    const ctx = buildContext({
      roles: [ROLE_VIEWER, ROLE_RESTRICTED],
      attributes: { roleIds: [ROLE_VIEWER, ROLE_RESTRICTED] },
    });
    const allowed = await service.canAccessCollection(ctx, COLLECTION_ID, 'read');

    expect(allowed).toBe(false);
  });

  it('getSafeRowLevelPredicatesForCollection composes (allow_or) AND NOT (deny_or)', async () => {
    const { service } = buildService({
      collectionRules: [
        buildReadRule({
          id: 'rule-allow-own',
          effect: 'allow',
          roleId: ROLE_VIEWER,
          conditions: { property: 'owner_id', operator: 'equals', value: '@currentUser' },
        }),
        buildReadRule({
          id: 'rule-deny-classified',
          effect: 'deny',
          roleId: ROLE_VIEWER,
          conditions: { property: 'classification', operator: 'equals', value: 'secret' },
        }),
      ],
    });

    const predicates = await service.getSafeRowLevelPredicatesForCollection(
      buildContext(),
      COLLECTION_ID,
      'read',
    );

    // Two top-level predicates: the allow leaf (single rule, flat), and a `not`
    // wrapping the deny's leaf. The renderer ANDs them.
    expect(predicates).toHaveLength(2);
    expect(predicates.find((p) => p.kind === 'not')).toBeDefined();
  });

  it('buildCollectionRowLevelClause emits both ALLOW and NOT branches when allow+deny rules match', async () => {
    const { service } = buildService({
      collectionRules: [
        buildReadRule({
          id: 'rule-allow-own',
          effect: 'allow',
          roleId: ROLE_VIEWER,
          conditions: { property: 'owner_id', operator: 'equals', value: '@currentUser' },
        }),
        buildReadRule({
          id: 'rule-deny-classified',
          effect: 'deny',
          roleId: ROLE_VIEWER,
          conditions: { property: 'classification', operator: 'equals', value: 'secret' },
        }),
      ],
    });

    const { clauses } = await service.buildCollectionRowLevelClause(
      buildContext(),
      COLLECTION_ID,
      'read',
      't',
    );

    // Caller AND's these clauses together — `(owner_id = X) AND NOT (classification = Y)`.
    const joined = clauses.join(' AND ');
    expect(joined).toContain('owner_id');
    expect(joined).toMatch(/NOT \(.*classification.*\)/);
  });

  it('unconditional allow + conditional deny: caller still sees a NOT clause carving out denied rows', async () => {
    const { service } = buildService({
      collectionRules: [
        buildReadRule({
          id: 'rule-allow-all',
          effect: 'allow',
          roleId: ROLE_VIEWER,
          conditions: null, // unconditional allow
        }),
        buildReadRule({
          id: 'rule-deny-cond',
          effect: 'deny',
          roleId: ROLE_VIEWER,
          conditions: { property: 'classification', operator: 'equals', value: 'secret' },
        }),
      ],
    });

    const predicates = await service.getSafeRowLevelPredicatesForCollection(
      buildContext(),
      COLLECTION_ID,
      'read',
    );

    // Allow lane contributes nothing (unconditional); deny lane emits the NOT.
    expect(predicates).toHaveLength(1);
    expect(predicates[0].kind).toBe('not');
  });

  it('two conditional deny rules combine as `NOT (or)` inside the WHERE clause', async () => {
    const { service } = buildService({
      collectionRules: [
        buildReadRule({
          id: 'rule-allow-all',
          effect: 'allow',
          roleId: ROLE_VIEWER,
          conditions: null,
        }),
        buildReadRule({
          id: 'rule-deny-a',
          effect: 'deny',
          roleId: ROLE_VIEWER,
          conditions: { property: 'classification', operator: 'equals', value: 'secret' },
        }),
        buildReadRule({
          id: 'rule-deny-b',
          effect: 'deny',
          roleId: ROLE_VIEWER,
          conditions: { property: 'status', operator: 'equals', value: 'archived' },
        }),
      ],
    });

    const { clauses } = await service.buildCollectionRowLevelClause(
      buildContext(),
      COLLECTION_ID,
      'read',
      't',
    );

    const joined = clauses.join(' AND ');
    // The NOT wraps an OR over the two deny rule conditions.
    expect(joined).toMatch(/NOT \(.*OR.*\)/);
    expect(joined).toContain('classification');
    expect(joined).toContain('status');
  });
});

describe('AuthorizationService — field deny rules (F006, canon §28.2)', () => {
  // F006 + canon §28.2 level 1: a deny rule at the field level forces
  // canRead=false, canWrite=false, maskingStrategy='FULL' regardless of
  // co-matching allow rules.

  const ROLE_DENIED = '88888888-8888-8888-8888-888888888888';
  const ROLE_VIEWER_F = '99999999-9999-9999-9999-999999999999';
  const FIELD_SSN: PropertyMeta = { code: 'ssn' };

  function buildFieldRuleSsn(overrides: Partial<PropertyAccessRuleData> = {}): PropertyAccessRuleData {
    return {
      id: 'rule-ssn',
      propertyId: 'ssn',
      propertyCode: 'ssn',
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
      effect: 'allow',
      ...overrides,
    };
  }

  function buildCtx(roles: string[]): UserRequestContext {
    return {
      userId: 'user-1',
      roles,
      permissions: [],
      isAdmin: false,
      attributes: { roleIds: roles },
    } as unknown as UserRequestContext;
  }

  it('field-explicit deny forces canRead=false, canWrite=false, maskingStrategy=FULL', async () => {
    const { service } = buildService({
      propertyRules: [
        buildFieldRuleSsn({ id: 'r-deny', effect: 'deny', roleId: ROLE_DENIED }),
      ],
    });

    const [authorized] = await service.getAuthorizedFieldsForCollection(
      buildCtx([ROLE_DENIED]),
      COLLECTION_ID,
      [FIELD_SSN],
    );

    expect(authorized.canRead).toBe(false);
    expect(authorized.canWrite).toBe(false);
    expect(authorized.maskingStrategy).toBe('FULL');
  });

  it('field-explicit deny wins over a co-matching allow (canon §28.4 rule 1)', async () => {
    const { service } = buildService({
      propertyRules: [
        buildFieldRuleSsn({
          id: 'r-allow',
          effect: 'allow',
          roleId: ROLE_VIEWER_F,
          canRead: true,
          canWrite: true,
          maskingStrategy: 'NONE',
        }),
        buildFieldRuleSsn({
          id: 'r-deny',
          effect: 'deny',
          roleId: ROLE_DENIED,
        }),
      ],
    });

    const [authorized] = await service.getAuthorizedFieldsForCollection(
      buildCtx([ROLE_VIEWER_F, ROLE_DENIED]),
      COLLECTION_ID,
      [FIELD_SSN],
    );

    expect(authorized.canRead).toBe(false);
    expect(authorized.canWrite).toBe(false);
    expect(authorized.maskingStrategy).toBe('FULL');
  });

  it('allow-only on the field preserves existing F024 UNION behaviour', async () => {
    const { service } = buildService({
      propertyRules: [
        buildFieldRuleSsn({ id: 'r-a', effect: 'allow', roleId: ROLE_VIEWER_F, canRead: true, canWrite: false, maskingStrategy: 'PARTIAL' }),
        buildFieldRuleSsn({ id: 'r-b', effect: 'allow', roleId: ROLE_VIEWER_F, canRead: false, canWrite: true, maskingStrategy: 'NONE' }),
      ],
    });

    const [authorized] = await service.getAuthorizedFieldsForCollection(
      buildCtx([ROLE_VIEWER_F]),
      COLLECTION_ID,
      [FIELD_SSN],
    );

    // Union of grants: canRead=true (from r-a), canWrite=true (from r-b).
    // Most-restrictive mask (canon §28.5): PARTIAL beats NONE.
    expect(authorized.canRead).toBe(true);
    expect(authorized.canWrite).toBe(true);
    expect(authorized.maskingStrategy).toBe('PARTIAL');
  });

  it('non-matching deny rule does NOT affect a field (deny scoped by principal)', async () => {
    const { service } = buildService({
      propertyRules: [
        buildFieldRuleSsn({ id: 'r-deny-other-role', effect: 'deny', roleId: ROLE_DENIED }),
        buildFieldRuleSsn({ id: 'r-allow', effect: 'allow', roleId: ROLE_VIEWER_F, canRead: true, canWrite: true, maskingStrategy: 'NONE' }),
      ],
    });

    // User does NOT have ROLE_DENIED — the deny rule is irrelevant.
    const [authorized] = await service.getAuthorizedFieldsForCollection(
      buildCtx([ROLE_VIEWER_F]),
      COLLECTION_ID,
      [FIELD_SSN],
    );

    expect(authorized.canRead).toBe(true);
    expect(authorized.canWrite).toBe(true);
    expect(authorized.maskingStrategy).toBe('NONE');
  });
});

describe('AuthorizationService — masking direction (canon §28.5)', () => {
  // Canon §28.5 inverts the pre-§28 F024 helper: when multiple allow
  // rules grant access to a field with different masking strategies, the
  // MOST-restrictive strategy wins (FULL > PARTIAL > NONE).

  const ROLE_M_A = '11111111-aaaa-aaaa-aaaa-111111111111';
  const ROLE_M_B = '22222222-bbbb-bbbb-bbbb-222222222222';
  const FIELD_SSN_M: PropertyMeta = { code: 'ssn' };

  function buildField(overrides: Partial<PropertyAccessRuleData> = {}): PropertyAccessRuleData {
    return {
      id: 'rule-ssn-m',
      propertyId: 'ssn',
      propertyCode: 'ssn',
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
      effect: 'allow',
      ...overrides,
    };
  }

  function buildCtxM(roles: string[]): UserRequestContext {
    return {
      userId: 'user-1',
      roles,
      permissions: [],
      isAdmin: false,
      attributes: { roleIds: roles },
    } as unknown as UserRequestContext;
  }

  it('three rules NONE+PARTIAL+FULL → result is FULL (was NONE under F024)', async () => {
    const { service } = buildService({
      propertyRules: [
        buildField({ id: 'r1', roleId: ROLE_M_A, maskingStrategy: 'NONE' }),
        buildField({ id: 'r2', roleId: ROLE_M_A, maskingStrategy: 'PARTIAL' }),
        buildField({ id: 'r3', roleId: ROLE_M_B, maskingStrategy: 'FULL' }),
      ],
    });

    const [authorized] = await service.getAuthorizedFieldsForCollection(
      buildCtxM([ROLE_M_A, ROLE_M_B]),
      COLLECTION_ID,
      [FIELD_SSN_M],
    );

    expect(authorized.maskingStrategy).toBe('FULL');
  });

  it('two rules PARTIAL+NONE → result is PARTIAL (was NONE under F024)', async () => {
    const { service } = buildService({
      propertyRules: [
        buildField({ id: 'r1', roleId: ROLE_M_A, maskingStrategy: 'PARTIAL' }),
        buildField({ id: 'r2', roleId: ROLE_M_B, maskingStrategy: 'NONE' }),
      ],
    });

    const [authorized] = await service.getAuthorizedFieldsForCollection(
      buildCtxM([ROLE_M_A, ROLE_M_B]),
      COLLECTION_ID,
      [FIELD_SSN_M],
    );

    expect(authorized.maskingStrategy).toBe('PARTIAL');
  });

  it('single rule PARTIAL → still PARTIAL (no change in single-rule case)', async () => {
    const { service } = buildService({
      propertyRules: [buildField({ id: 'r1', roleId: ROLE_M_A, maskingStrategy: 'PARTIAL' })],
    });

    const [authorized] = await service.getAuthorizedFieldsForCollection(
      buildCtxM([ROLE_M_A]),
      COLLECTION_ID,
      [FIELD_SSN_M],
    );

    expect(authorized.maskingStrategy).toBe('PARTIAL');
  });
});

describe('AuthorizationService — wildcard field rules (§28.2 levels 3-4)', () => {
  // Canon §28.2 levels 3-4: a wildcard field rule (propertyId IS NULL,
  // wildcardCollectionId = the collection) applies to EVERY field of
  // that collection. The evaluator walks 1→7 and the first matching
  // level decides:
  //   1. Explicit-field deny
  //   2. Explicit-field allow (UNION; most-restrictive masking)
  //   3. Wildcard deny
  //   4. Wildcard allow (UNION; most-restrictive masking)
  //   5/6. Collection-level fallback (preserved until F005)
  //
  // §28.4 rule 2: specificity ranks beat effect — an explicit allow at
  // level 2 fires BEFORE a wildcard deny at level 3 (and a wildcard
  // allow at level 4 fires AFTER an explicit deny at level 1). The
  // wildcard layer never overrides explicit field rules, regardless of
  // which is allow vs deny.

  const ROLE_W_WILDCARD = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
  const ROLE_W_EXPLICIT = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';
  const ROLE_W_OTHER = 'cccccccc-cccc-cccc-cccc-cccccccccccc';
  const FIELD_W_SALARY: PropertyMeta = { code: 'salary' };
  const OTHER_COLLECTION_ID = '99999999-9999-9999-9999-999999999999';

  function buildExplicitFieldRule(overrides: Partial<PropertyAccessRuleData> = {}): PropertyAccessRuleData {
    return {
      id: 'rule-explicit',
      propertyId: 'salary',
      propertyCode: 'salary',
      collectionId: COLLECTION_ID,
      wildcardCollectionId: null,
      roleId: null,
      groupId: null,
      userId: null,
      canRead: true,
      canWrite: true,
      conditions: null,
      priority: 1,
      isActive: true,
      maskingStrategy: 'NONE',
      effect: 'allow',
      ...overrides,
    };
  }

  function buildWildcardRule(overrides: Partial<PropertyAccessRuleData> = {}): PropertyAccessRuleData {
    return {
      id: 'rule-wildcard',
      propertyId: null,
      propertyCode: undefined,
      collectionId: COLLECTION_ID,
      wildcardCollectionId: COLLECTION_ID,
      roleId: null,
      groupId: null,
      userId: null,
      canRead: true,
      canWrite: true,
      conditions: null,
      priority: 1,
      isActive: true,
      maskingStrategy: 'NONE',
      effect: 'allow',
      ...overrides,
    };
  }

  function buildCtxW(roles: string[]): UserRequestContext {
    return {
      userId: 'user-1',
      roles,
      permissions: [],
      isAdmin: false,
      attributes: { roleIds: roles },
    } as unknown as UserRequestContext;
  }

  it('1. wildcard allow only → field gets the wildcard allow (level 4 fires)', async () => {
    const { service } = buildService({
      propertyRules: [
        buildWildcardRule({
          id: 'r-wc-allow',
          effect: 'allow',
          roleId: ROLE_W_WILDCARD,
          canRead: true,
          canWrite: true,
          maskingStrategy: 'NONE',
        }),
      ],
    });

    const [authorized] = await service.getAuthorizedFieldsForCollection(
      buildCtxW([ROLE_W_WILDCARD]),
      COLLECTION_ID,
      [FIELD_W_SALARY],
    );

    expect(authorized.canRead).toBe(true);
    expect(authorized.canWrite).toBe(true);
    expect(authorized.maskingStrategy).toBe('NONE');
  });

  it('2. wildcard deny only → field denied (level 3 fires)', async () => {
    const { service } = buildService({
      propertyRules: [
        buildWildcardRule({
          id: 'r-wc-deny',
          effect: 'deny',
          roleId: ROLE_W_WILDCARD,
        }),
      ],
    });

    const [authorized] = await service.getAuthorizedFieldsForCollection(
      buildCtxW([ROLE_W_WILDCARD]),
      COLLECTION_ID,
      [FIELD_W_SALARY],
    );

    expect(authorized.canRead).toBe(false);
    expect(authorized.canWrite).toBe(false);
    expect(authorized.maskingStrategy).toBe('FULL');
  });

  it('3. wildcard allow + explicit field allow → explicit wins (level 2 fires)', async () => {
    // Level 2 (explicit allow) fires before level 4 (wildcard allow).
    // The explicit rule's grant + masking define the outcome; the
    // wildcard rule is never consulted.
    const { service } = buildService({
      propertyRules: [
        buildExplicitFieldRule({
          id: 'r-ex-allow',
          effect: 'allow',
          roleId: ROLE_W_EXPLICIT,
          canRead: true,
          canWrite: false,
          maskingStrategy: 'NONE',
        }),
        buildWildcardRule({
          id: 'r-wc-allow',
          effect: 'allow',
          roleId: ROLE_W_WILDCARD,
          canRead: true,
          canWrite: true,
          maskingStrategy: 'PARTIAL',
        }),
      ],
    });

    const [authorized] = await service.getAuthorizedFieldsForCollection(
      buildCtxW([ROLE_W_EXPLICIT, ROLE_W_WILDCARD]),
      COLLECTION_ID,
      [FIELD_W_SALARY],
    );

    // Explicit allow defines the outcome — write=false from explicit
    // rule, mask=NONE from explicit rule. The wildcard's grants do NOT
    // compose into the explicit decision (the levels are evaluated
    // independently; first match wins).
    expect(authorized.canRead).toBe(true);
    expect(authorized.canWrite).toBe(false);
    expect(authorized.maskingStrategy).toBe('NONE');
  });

  it('4. wildcard allow + explicit field deny → explicit deny wins (level 1 fires before level 4)', async () => {
    const { service } = buildService({
      propertyRules: [
        buildExplicitFieldRule({
          id: 'r-ex-deny',
          effect: 'deny',
          roleId: ROLE_W_EXPLICIT,
        }),
        buildWildcardRule({
          id: 'r-wc-allow',
          effect: 'allow',
          roleId: ROLE_W_WILDCARD,
          canRead: true,
          canWrite: true,
          maskingStrategy: 'NONE',
        }),
      ],
    });

    const [authorized] = await service.getAuthorizedFieldsForCollection(
      buildCtxW([ROLE_W_EXPLICIT, ROLE_W_WILDCARD]),
      COLLECTION_ID,
      [FIELD_W_SALARY],
    );

    expect(authorized.canRead).toBe(false);
    expect(authorized.canWrite).toBe(false);
    expect(authorized.maskingStrategy).toBe('FULL');
  });

  it('5. wildcard deny + explicit field allow → explicit allow wins (§28.4 specificity beats effect)', async () => {
    // §28.4 rule 2: specificity ranks beat effect. An explicit allow at
    // level 2 fires BEFORE a wildcard deny at level 3. Wildcards never
    // override explicit field rules regardless of which is allow vs deny.
    const { service } = buildService({
      propertyRules: [
        buildExplicitFieldRule({
          id: 'r-ex-allow',
          effect: 'allow',
          roleId: ROLE_W_EXPLICIT,
          canRead: true,
          canWrite: true,
          maskingStrategy: 'NONE',
        }),
        buildWildcardRule({
          id: 'r-wc-deny',
          effect: 'deny',
          roleId: ROLE_W_WILDCARD,
        }),
      ],
    });

    const [authorized] = await service.getAuthorizedFieldsForCollection(
      buildCtxW([ROLE_W_EXPLICIT, ROLE_W_WILDCARD]),
      COLLECTION_ID,
      [FIELD_W_SALARY],
    );

    expect(authorized.canRead).toBe(true);
    expect(authorized.canWrite).toBe(true);
    expect(authorized.maskingStrategy).toBe('NONE');
  });

  it('6. two wildcard rules: allow + deny → deny wins (level 3 fires before level 4)', async () => {
    // Within the wildcard layer, level 3 (deny) is checked before level
    // 4 (allow). Same precedence pattern as the explicit layer.
    const { service } = buildService({
      propertyRules: [
        buildWildcardRule({
          id: 'r-wc-allow',
          effect: 'allow',
          roleId: ROLE_W_WILDCARD,
          canRead: true,
          canWrite: true,
          maskingStrategy: 'NONE',
        }),
        buildWildcardRule({
          id: 'r-wc-deny',
          effect: 'deny',
          roleId: ROLE_W_OTHER,
        }),
      ],
    });

    // User has BOTH roles; deny wins.
    const [authorized] = await service.getAuthorizedFieldsForCollection(
      buildCtxW([ROLE_W_WILDCARD, ROLE_W_OTHER]),
      COLLECTION_ID,
      [FIELD_W_SALARY],
    );

    expect(authorized.canRead).toBe(false);
    expect(authorized.canWrite).toBe(false);
    expect(authorized.maskingStrategy).toBe('FULL');
  });

  it('7. wildcard allow PARTIAL + explicit field allow NONE → explicit wins with NONE (level 2 fires)', async () => {
    // Explicit allow (level 2) defines the outcome — the wildcard's
    // more-restrictive PARTIAL masking is irrelevant because the levels
    // are evaluated independently.
    const { service } = buildService({
      propertyRules: [
        buildExplicitFieldRule({
          id: 'r-ex-allow',
          effect: 'allow',
          roleId: ROLE_W_EXPLICIT,
          canRead: true,
          canWrite: true,
          maskingStrategy: 'NONE',
        }),
        buildWildcardRule({
          id: 'r-wc-allow',
          effect: 'allow',
          roleId: ROLE_W_WILDCARD,
          canRead: true,
          canWrite: true,
          maskingStrategy: 'PARTIAL',
        }),
      ],
    });

    const [authorized] = await service.getAuthorizedFieldsForCollection(
      buildCtxW([ROLE_W_EXPLICIT, ROLE_W_WILDCARD]),
      COLLECTION_ID,
      [FIELD_W_SALARY],
    );

    expect(authorized.canRead).toBe(true);
    expect(authorized.canWrite).toBe(true);
    expect(authorized.maskingStrategy).toBe('NONE');
  });

  it('8. wildcard allow PARTIAL only → field allowed with PARTIAL mask (level 4 fires; masking from the wildcard)', async () => {
    const { service } = buildService({
      propertyRules: [
        buildWildcardRule({
          id: 'r-wc-allow',
          effect: 'allow',
          roleId: ROLE_W_WILDCARD,
          canRead: true,
          canWrite: true,
          maskingStrategy: 'PARTIAL',
        }),
      ],
    });

    const [authorized] = await service.getAuthorizedFieldsForCollection(
      buildCtxW([ROLE_W_WILDCARD]),
      COLLECTION_ID,
      [FIELD_W_SALARY],
    );

    expect(authorized.canRead).toBe(true);
    expect(authorized.canWrite).toBe(true);
    expect(authorized.maskingStrategy).toBe('PARTIAL');
  });

  it('9. two wildcard allows with different masks (PARTIAL + FULL) → most-restrictive (FULL) per §28.5', async () => {
    const { service } = buildService({
      propertyRules: [
        buildWildcardRule({
          id: 'r-wc-partial',
          effect: 'allow',
          roleId: ROLE_W_WILDCARD,
          canRead: true,
          canWrite: true,
          maskingStrategy: 'PARTIAL',
        }),
        buildWildcardRule({
          id: 'r-wc-full',
          effect: 'allow',
          roleId: ROLE_W_OTHER,
          canRead: true,
          canWrite: true,
          maskingStrategy: 'FULL',
        }),
      ],
    });

    const [authorized] = await service.getAuthorizedFieldsForCollection(
      buildCtxW([ROLE_W_WILDCARD, ROLE_W_OTHER]),
      COLLECTION_ID,
      [FIELD_W_SALARY],
    );

    // Canon §28.5: most-restrictive masking wins — FULL beats PARTIAL.
    // Read/write are UNION true.
    expect(authorized.canRead).toBe(true);
    expect(authorized.canWrite).toBe(true);
    expect(authorized.maskingStrategy).toBe('FULL');
  });

  it('10. wildcard rule for a DIFFERENT collection → does not apply to fields of THIS collection', async () => {
    // The repository pre-filters by collectionId, but we belt-and-
    // suspenders in the evaluator: a wildcard rule whose
    // wildcardCollectionId !== this collection is silently irrelevant.
    // Without the evaluator-side filter, a misbehaving stub repo could
    // leak cross-collection wildcards into the field decision.
    const { service } = buildService({
      propertyRules: [
        buildWildcardRule({
          id: 'r-wc-other-coll',
          effect: 'deny',
          roleId: ROLE_W_WILDCARD,
          // Wildcard scoped to a DIFFERENT collection.
          wildcardCollectionId: OTHER_COLLECTION_ID,
        }),
      ],
    });

    const [authorized] = await service.getAuthorizedFieldsForCollection(
      buildCtxW([ROLE_W_WILDCARD]),
      COLLECTION_ID,
      [FIELD_W_SALARY],
    );

    // Cross-collection wildcard is irrelevant — level 3 misses, level
    // 4 misses, fall through to the default-allow path.
    expect(authorized.canRead).toBe(true);
    expect(authorized.canWrite).toBe(true);
    expect(authorized.maskingStrategy).toBe('NONE');
  });
});

describe('AuthorizationService — secureFieldsByDefault flag (F005, §28.2 level 7)', () => {
  // F005 / canon §28.2 level 7: per-collection default-deny flag on
  // CollectionDefinition. When `secureFieldsByDefault=true`, a field
  // that no explicit (levels 1-2) or wildcard (levels 3-4) rule matched
  // resolves to canRead=false, canWrite=false, mask='FULL'. When false
  // (DB default), the evaluator preserves the legacy default-allow
  // behaviour to keep existing customer packs working on rollout.
  //
  // The flag is per-collection — not per-tenant — so it works
  // unchanged in single-tenant and pooled (RLS) deployment modes
  // (canon §5 SOFTEN).

  const ROLE_F005 = 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee';
  const ROLE_F005_OTHER = 'ffffffff-ffff-ffff-ffff-ffffffffffff';
  const FIELD_NOTES: PropertyMeta = { code: 'notes' };

  function buildFieldRuleNotes(overrides: Partial<PropertyAccessRuleData> = {}): PropertyAccessRuleData {
    return {
      id: 'rule-notes',
      propertyId: 'notes',
      propertyCode: 'notes',
      collectionId: COLLECTION_ID,
      wildcardCollectionId: null,
      roleId: null,
      groupId: null,
      userId: null,
      canRead: true,
      canWrite: true,
      conditions: null,
      priority: 1,
      isActive: true,
      maskingStrategy: 'NONE',
      effect: 'allow',
      ...overrides,
    };
  }

  function buildWildcardRuleNotes(overrides: Partial<PropertyAccessRuleData> = {}): PropertyAccessRuleData {
    return {
      id: 'rule-wc-notes',
      propertyId: null,
      propertyCode: undefined,
      collectionId: COLLECTION_ID,
      wildcardCollectionId: COLLECTION_ID,
      roleId: null,
      groupId: null,
      userId: null,
      canRead: true,
      canWrite: true,
      conditions: null,
      priority: 1,
      isActive: true,
      maskingStrategy: 'NONE',
      effect: 'allow',
      ...overrides,
    };
  }

  function buildCtxF(roles: string[]): UserRequestContext {
    return {
      userId: 'user-1',
      roles,
      permissions: [],
      isAdmin: false,
      attributes: { roleIds: roles },
    } as unknown as UserRequestContext;
  }

  it('1. secureFieldsByDefault=false, no field rules → legacy default-allow preserved', async () => {
    // Existing collections on rollout: flag is `false` so the evaluator
    // returns canRead=true, canWrite=!isSystem, mask='NONE' just as it
    // did before F005.
    const { service } = buildService({
      collectionFlags: {
        [COLLECTION_ID]: { secureFieldsByDefault: false },
      },
    });

    const [authorized] = await service.getAuthorizedFieldsForCollection(
      buildCtxF([ROLE_F005]),
      COLLECTION_ID,
      [FIELD_NOTES],
    );

    expect(authorized.canRead).toBe(true);
    expect(authorized.canWrite).toBe(true);
    expect(authorized.maskingStrategy).toBe('NONE');
  });

  it('2. secureFieldsByDefault=true, no field rules → canon §28.2 level 7 default-deny', async () => {
    // The opt-in path: customer flips the flag on this collection and
    // a field with no matching rule resolves to canRead=false,
    // canWrite=false, mask='FULL' — the canon §28.4 "missing policy =
    // deny" behaviour.
    const { service } = buildService({
      collectionFlags: {
        [COLLECTION_ID]: { secureFieldsByDefault: true },
      },
    });

    const [authorized] = await service.getAuthorizedFieldsForCollection(
      buildCtxF([ROLE_F005]),
      COLLECTION_ID,
      [FIELD_NOTES],
    );

    expect(authorized.canRead).toBe(false);
    expect(authorized.canWrite).toBe(false);
    expect(authorized.maskingStrategy).toBe('FULL');
  });

  it('3. secureFieldsByDefault=true + explicit field allow rule → allow wins (level 2 fires before level 7)', async () => {
    // §28.2: levels are walked 1→7 and the first match decides. An
    // explicit allow at level 2 fires BEFORE the level-7 default-deny
    // — the flag only affects the no-rule-matched fallback.
    const { service } = buildService({
      collectionFlags: {
        [COLLECTION_ID]: { secureFieldsByDefault: true },
      },
      propertyRules: [
        buildFieldRuleNotes({
          id: 'r-allow-explicit',
          effect: 'allow',
          roleId: ROLE_F005,
          canRead: true,
          canWrite: true,
          maskingStrategy: 'NONE',
        }),
      ],
    });

    const [authorized] = await service.getAuthorizedFieldsForCollection(
      buildCtxF([ROLE_F005]),
      COLLECTION_ID,
      [FIELD_NOTES],
    );

    expect(authorized.canRead).toBe(true);
    expect(authorized.canWrite).toBe(true);
    expect(authorized.maskingStrategy).toBe('NONE');
  });

  it('4. secureFieldsByDefault=true + wildcard allow rule → allow wins (level 4 fires before level 7)', async () => {
    // Wildcards (levels 3-4) fire before the default-deny fallback at
    // level 7. A wildcard allow on the collection still grants access
    // even when the flag is on.
    const { service } = buildService({
      collectionFlags: {
        [COLLECTION_ID]: { secureFieldsByDefault: true },
      },
      propertyRules: [
        buildWildcardRuleNotes({
          id: 'r-allow-wildcard',
          effect: 'allow',
          roleId: ROLE_F005,
          canRead: true,
          canWrite: true,
          maskingStrategy: 'NONE',
        }),
      ],
    });

    const [authorized] = await service.getAuthorizedFieldsForCollection(
      buildCtxF([ROLE_F005]),
      COLLECTION_ID,
      [FIELD_NOTES],
    );

    expect(authorized.canRead).toBe(true);
    expect(authorized.canWrite).toBe(true);
    expect(authorized.maskingStrategy).toBe('NONE');
  });

  it('5. secureFieldsByDefault=true + explicit field deny rule → deny applies (level 1 fires)', async () => {
    // Explicit deny at level 1 already produces the same canRead=false,
    // canWrite=false, mask='FULL' outcome as level-7 default-deny.
    // Verify the path is taken from level 1 (rule-matched), not level
    // 7 (no-rule-matched), so behaviour is consistent whether or not
    // the flag is set.
    const { service } = buildService({
      collectionFlags: {
        [COLLECTION_ID]: { secureFieldsByDefault: true },
      },
      propertyRules: [
        buildFieldRuleNotes({
          id: 'r-deny-explicit',
          effect: 'deny',
          roleId: ROLE_F005,
        }),
      ],
    });

    const [authorized] = await service.getAuthorizedFieldsForCollection(
      buildCtxF([ROLE_F005]),
      COLLECTION_ID,
      [FIELD_NOTES],
    );

    expect(authorized.canRead).toBe(false);
    expect(authorized.canWrite).toBe(false);
    expect(authorized.maskingStrategy).toBe('FULL');
  });

  it('6. collectionDefinitionRepo returns null → defaults to false (legacy default-allow), no exception', async () => {
    // Defensive: a collection_definitions row may not yet exist (test
    // fixtures, partially-seeded environments). The lookup helper
    // returns null, the evaluator treats null as "no flag opt-in",
    // and default-allow is preserved. Failing closed here would break
    // every collection that hasn't yet had a definition row written.
    const { service } = buildService({
      // Intentionally empty — no row for COLLECTION_ID.
      collectionFlags: {},
    });

    await expect(
      service.getAuthorizedFieldsForCollection(
        buildCtxF([ROLE_F005]),
        COLLECTION_ID,
        [FIELD_NOTES],
      ),
    ).resolves.toBeDefined();

    const [authorized] = await service.getAuthorizedFieldsForCollection(
      buildCtxF([ROLE_F005]),
      COLLECTION_ID,
      [FIELD_NOTES],
    );

    expect(authorized.canRead).toBe(true);
    expect(authorized.canWrite).toBe(true);
    expect(authorized.maskingStrategy).toBe('NONE');
  });

  it('7. collectionDefinitionRepo is null (no repo wired) → defaults to false, no exception', async () => {
    // Test-stub context: AuthorizationService is constructed without a
    // CollectionDefinition repo. The lookup helper short-circuits to
    // null and the evaluator falls through to default-allow without
    // hitting the missing repo.
    const policyCompiler = new PolicyCompilerService();
    const propertyAclRepo: PropertyAclRepoStub = {
      find: jest.fn().mockResolvedValue([]),
    };
    const service = new AuthorizationService(
      { find: jest.fn().mockResolvedValue([]) },
      propertyAclRepo,
      null,
      null,
      policyCompiler,
      null, // intentionally no CollectionDefinition repo
    );

    const [authorized] = await service.getAuthorizedFieldsForCollection(
      buildCtxF([ROLE_F005]),
      COLLECTION_ID,
      [FIELD_NOTES],
    );

    expect(authorized.canRead).toBe(true);
    expect(authorized.canWrite).toBe(true);
    expect(authorized.maskingStrategy).toBe('NONE');
  });

  it('8a. flag is cached under auth:collection-flag:{id} after first lookup', async () => {
    // Cache hit on second call: the lookup helper writes to
    // `auth:collection-flag:{collectionId}` on first read and returns
    // the cached value on subsequent reads within CACHE_TTL.
    const cacheStore = new Map<string, unknown>();
    const cache = {
      get: jest.fn(async (k: string) => cacheStore.get(k)),
      set: jest.fn(async (k: string, v: unknown) => {
        cacheStore.set(k, v);
        return undefined;
      }),
      del: jest.fn(async (k: string) => {
        cacheStore.delete(k);
        return true;
      }),
    };

    const collectionDefinitionRepo: CollectionDefinitionRepoStub = {
      findOne: jest.fn().mockImplementation(({ where }: { where: { id?: string } }) => {
        if (where.id === COLLECTION_ID) {
          return Promise.resolve({ id: COLLECTION_ID, secureFieldsByDefault: true });
        }
        return Promise.resolve(null);
      }),
    };

    const policyCompiler = new PolicyCompilerService();
    const service = new AuthorizationService(
      { find: jest.fn().mockResolvedValue([]) },
      { find: jest.fn().mockResolvedValue([]) },
      cache as unknown as ConstructorParameters<typeof AuthorizationService>[2],
      null,
      policyCompiler,
      collectionDefinitionRepo,
    );

    // First call: misses cache, calls repo, sets cache.
    const [first] = await service.getAuthorizedFieldsForCollection(
      buildCtxF([ROLE_F005]),
      COLLECTION_ID,
      [FIELD_NOTES],
    );
    expect(first.canRead).toBe(false);
    expect(collectionDefinitionRepo.findOne).toHaveBeenCalledTimes(1);
    expect(cache.set).toHaveBeenCalledWith(
      'auth:collection-flag:' + COLLECTION_ID,
      { secureFieldsByDefault: true },
      expect.any(Number),
    );

    // Second call: hits cache, repo not called again.
    const [second] = await service.getAuthorizedFieldsForCollection(
      buildCtxF([ROLE_F005]),
      COLLECTION_ID,
      [FIELD_NOTES],
    );
    expect(second.canRead).toBe(false);
    expect(collectionDefinitionRepo.findOne).toHaveBeenCalledTimes(1);
  });

  it('8b. clearing the cache key surfaces the new flag value on next lookup', async () => {
    // Flag flip + manual cache invalidation: simulate an admin
    // toggling secureFieldsByDefault from false to true. The F025
    // rule-cache invalidation port does NOT cover collection_definition
    // writes (canon §13 + F005 brief: TTL expiry is the canonical
    // path), but operators / tests can `cache.del('auth:collection-
    // flag:{id}')` to force-refresh. Verify that mechanic works.
    const cacheStore = new Map<string, unknown>();
    const cache = {
      get: jest.fn(async (k: string) => cacheStore.get(k)),
      set: jest.fn(async (k: string, v: unknown) => {
        cacheStore.set(k, v);
        return undefined;
      }),
      del: jest.fn(async (k: string) => {
        cacheStore.delete(k);
        return true;
      }),
    };

    let currentFlag = false;
    const collectionDefinitionRepo: CollectionDefinitionRepoStub = {
      findOne: jest.fn().mockImplementation(({ where }: { where: { id?: string } }) => {
        if (where.id === COLLECTION_ID) {
          return Promise.resolve({ id: COLLECTION_ID, secureFieldsByDefault: currentFlag });
        }
        return Promise.resolve(null);
      }),
    };

    const policyCompiler = new PolicyCompilerService();
    const service = new AuthorizationService(
      { find: jest.fn().mockResolvedValue([]) },
      { find: jest.fn().mockResolvedValue([]) },
      cache as unknown as ConstructorParameters<typeof AuthorizationService>[2],
      null,
      policyCompiler,
      collectionDefinitionRepo,
    );

    // First lookup: flag=false → default-allow.
    const [first] = await service.getAuthorizedFieldsForCollection(
      buildCtxF([ROLE_F005_OTHER]),
      COLLECTION_ID,
      [FIELD_NOTES],
    );
    expect(first.canRead).toBe(true);

    // Flip the flag in the "database" and invalidate the cache key.
    currentFlag = true;
    await cache.del('auth:collection-flag:' + COLLECTION_ID);

    // Second lookup: cache miss → re-reads the flag, now true.
    const [second] = await service.getAuthorizedFieldsForCollection(
      buildCtxF([ROLE_F005_OTHER]),
      COLLECTION_ID,
      [FIELD_NOTES],
    );
    expect(second.canRead).toBe(false);
    expect(second.canWrite).toBe(false);
    expect(second.maskingStrategy).toBe('FULL');
  });

  it('9. canon §28.6 (Plan Fix 33): admin with seeded wildcard property rule overrides secureFieldsByDefault=true', async () => {
    // The bypass is gone. Admin access to fields comes from the seeded
    // wildcard PropertyAccessRule. When that rule is present, it fires at
    // §28.2 level 3-4 (wildcard allow) before the secureFieldsByDefault
    // default-deny flag (level 7) is reached, so admins still see all fields.
    const ADMIN_ROLE_ID_F = 'role-admin';
    const wildcardAdminRule: PropertyAccessRuleData = {
      id: 'admin-wildcard-1',
      propertyId: null,
      wildcardCollectionId: COLLECTION_ID,
      roleId: ADMIN_ROLE_ID_F,
      groupId: null,
      userId: null,
      canRead: true,
      canWrite: true,
      conditions: null,
      priority: 0,
      isActive: true,
      effect: 'allow',
      maskingStrategy: 'NONE',
    };
    const { service, collectionDefinitionRepo } = buildService({
      propertyRules: [wildcardAdminRule],
      collectionFlags: {
        [COLLECTION_ID]: { secureFieldsByDefault: true },
      },
    });

    const adminCtx: UserRequestContext = {
      kind: 'user',
      userId: 'admin-1',
      roles: [ADMIN_ROLE_ID_F],
      permissions: [],
      isAdmin: true,
      attributes: { roleIds: [ADMIN_ROLE_ID_F] },
    };
    const [adminAuthorized] = await service.getAuthorizedFieldsForCollection(
      adminCtx,
      COLLECTION_ID,
      [FIELD_NOTES],
    );
    expect(adminAuthorized.canRead).toBe(true);
    expect(adminAuthorized.canWrite).toBe(true);
    expect(adminAuthorized.maskingStrategy).toBe('NONE');
    // The flag lookup now DOES fire — admin goes through the evaluator.
    expect(collectionDefinitionRepo.findOne).toHaveBeenCalled();
  });

  it('10. isSystem field with secureFieldsByDefault=false retains its legacy canWrite=false default', async () => {
    // Regression guard: the legacy default-allow path computed
    // canWrite as !field.isSystem. The F005 path preserves that when
    // the flag is false.
    const { service } = buildService({
      collectionFlags: {
        [COLLECTION_ID]: { secureFieldsByDefault: false },
      },
    });

    const [authorized] = await service.getAuthorizedFieldsForCollection(
      buildCtxF([ROLE_F005]),
      COLLECTION_ID,
      [{ code: 'system_field', isSystem: true } as PropertyMeta],
    );

    expect(authorized.canRead).toBe(true);
    // isSystem=true → canWrite=false even in default-allow mode.
    expect(authorized.canWrite).toBe(false);
    expect(authorized.maskingStrategy).toBe('NONE');
  });
});

describe('AuthorizationService — explainability (§28.7)', () => {
  // Canon §28.7: every authorization decision MUST be able to produce its
  // provenance. The tests below cover both `explainCollectionAccess` and
  // `explainFieldAccess` across the level-1..level-7 matrix the
  // implementation surfaces.

  const COLLECTION_ID_E = '11111111-1111-1111-1111-111111111111';
  const ROLE_E = '22222222-2222-2222-2222-222222222222';
  const ROLE_E_OTHER = '33333333-3333-3333-3333-333333333333';
  const RULE_ID_1 = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
  const RULE_ID_2 = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';
  const RULE_ID_3 = 'cccccccc-cccc-cccc-cccc-cccccccccccc';
  const FIELD_E: PropertyMeta = { code: 'phi_field' };

  function buildCtxE(overrides: Partial<UserRequestContext> = {}): UserRequestContext {
    return {
      kind: 'user',
      userId: 'user-1',
      roles: [ROLE_E],
      permissions: [],
      isAdmin: false,
      attributes: { roleIds: [ROLE_E] },
      ...overrides,
    };
  }

  function buildCollRule(overrides: Partial<CollectionAccessRuleData> = {}): CollectionAccessRuleData {
    return {
      id: RULE_ID_1,
      collectionId: COLLECTION_ID_E,
      name: 'r',
      description: null,
      roleId: ROLE_E,
      groupId: null,
      userId: null,
      canRead: true,
      canCreate: false,
      canUpdate: false,
      canDelete: false,
      conditions: null,
      priority: 1,
      isActive: true,
      effect: 'allow',
      ...overrides,
    };
  }

  function buildExplicitFieldRule(overrides: Partial<PropertyAccessRuleData> = {}): PropertyAccessRuleData {
    return {
      id: RULE_ID_1,
      propertyId: 'phi_field',
      propertyCode: 'phi_field',
      collectionId: COLLECTION_ID_E,
      wildcardCollectionId: null,
      roleId: ROLE_E,
      groupId: null,
      userId: null,
      canRead: true,
      canWrite: true,
      conditions: null,
      priority: 1,
      isActive: true,
      maskingStrategy: 'NONE',
      effect: 'allow',
      ...overrides,
    };
  }

  function buildWildcardFieldRule(overrides: Partial<PropertyAccessRuleData> = {}): PropertyAccessRuleData {
    return {
      id: RULE_ID_2,
      propertyId: null,
      propertyCode: undefined,
      collectionId: COLLECTION_ID_E,
      wildcardCollectionId: COLLECTION_ID_E,
      roleId: ROLE_E,
      groupId: null,
      userId: null,
      canRead: true,
      canWrite: true,
      conditions: null,
      priority: 1,
      isActive: true,
      maskingStrategy: 'NONE',
      effect: 'allow',
      ...overrides,
    };
  }

  describe('explainCollectionAccess', () => {
    it('1. matching allow rule → matchedLevel=2, matchedRuleId=<rule>, matchedPrincipal=<role>', async () => {
      const { service } = buildService({
        collectionRules: [
          buildCollRule({ id: RULE_ID_1, roleId: ROLE_E, canRead: true, effect: 'allow' }),
        ],
      });

      const prov = await service.explainCollectionAccess(
        buildCtxE(),
        COLLECTION_ID_E,
        'read',
      );

      expect(prov.effect).toBe('allow');
      expect(prov.matchedLevel).toBe(2);
      expect(prov.matchedRuleId).toBe(RULE_ID_1);
      expect(prov.matchedPrincipal).toBe(ROLE_E);
      expect(prov.fallbackChain).toEqual([
        'level-1: no match',
        `level-2: allow matched (rule: ${RULE_ID_1})`,
      ]);
    });

    it('2. matching deny rule → matchedLevel=1, matchedRuleId=<rule>, matchedPrincipal=<role>', async () => {
      const { service } = buildService({
        collectionRules: [
          buildCollRule({ id: RULE_ID_1, roleId: ROLE_E, canRead: true, effect: 'deny' }),
        ],
      });

      const prov = await service.explainCollectionAccess(
        buildCtxE(),
        COLLECTION_ID_E,
        'read',
      );

      expect(prov.effect).toBe('deny');
      expect(prov.matchedLevel).toBe(1);
      expect(prov.matchedRuleId).toBe(RULE_ID_1);
      expect(prov.matchedPrincipal).toBe(ROLE_E);
      expect(prov.fallbackChain).toEqual([
        `level-1: deny matched (rule: ${RULE_ID_1})`,
      ]);
    });

    it('3. no matching rule → matchedLevel=3, matchedRuleId=null, full fallback chain', async () => {
      // Rules exist but target a different role; the principal won't match.
      const { service } = buildService({
        collectionRules: [
          buildCollRule({ id: RULE_ID_1, roleId: ROLE_E_OTHER, canRead: true }),
        ],
      });

      const prov = await service.explainCollectionAccess(
        buildCtxE(),
        COLLECTION_ID_E,
        'read',
      );

      expect(prov.effect).toBe('deny');
      expect(prov.matchedLevel).toBe(3);
      expect(prov.matchedRuleId).toBeNull();
      expect(prov.matchedPrincipal).toBeNull();
      expect(prov.fallbackChain).toEqual([
        'level-1: no match',
        'level-2: no match',
        'level-3: default deny',
      ]);
    });

    it('4. multiple allow rules → first-by-priority wins matchedRuleId; chain shows single level-2 match', async () => {
      // Both rules grant read; the repo orders ASC by priority so RULE_ID_1
      // (priority=1) wins attribution over RULE_ID_2 (priority=2). The
      // fallback chain captures the matching level only once — the
      // evaluator returns on first hit.
      const { service } = buildService({
        collectionRules: [
          buildCollRule({ id: RULE_ID_1, roleId: ROLE_E, canRead: true, priority: 1 }),
          buildCollRule({ id: RULE_ID_2, roleId: ROLE_E, canRead: true, priority: 2 }),
        ],
      });

      const prov = await service.explainCollectionAccess(
        buildCtxE(),
        COLLECTION_ID_E,
        'read',
      );

      expect(prov.effect).toBe('allow');
      expect(prov.matchedLevel).toBe(2);
      expect(prov.matchedRuleId).toBe(RULE_ID_1);
      expect(prov.fallbackChain).toEqual([
        'level-1: no match',
        `level-2: allow matched (rule: ${RULE_ID_1})`,
      ]);
    });
  });

  describe('explainFieldAccess', () => {
    it('5. explicit field allow (mask=NONE) → matchedLevel=2, effect=allow, mask=NONE', async () => {
      const { service } = buildService({
        propertyRules: [
          buildExplicitFieldRule({
            id: RULE_ID_1,
            roleId: ROLE_E,
            canRead: true,
            canWrite: true,
            maskingStrategy: 'NONE',
            effect: 'allow',
          }),
        ],
      });

      const prov = await service.explainFieldAccess(buildCtxE(), COLLECTION_ID_E, FIELD_E);

      expect(prov.effect).toBe('allow');
      expect(prov.matchedLevel).toBe(2);
      expect(prov.matchedRuleId).toBe(RULE_ID_1);
      expect(prov.matchedPrincipal).toBe(ROLE_E);
      expect(prov.maskingStrategy).toBe('NONE');
      expect(prov.fallbackChain).toContain('level-1: no match');
      expect(prov.fallbackChain).toContain(`level-2: allow matched (rule: ${RULE_ID_1})`);
    });

    it('6. explicit field allow with PARTIAL mask → effect=mask, maskingStrategy=PARTIAL', async () => {
      const { service } = buildService({
        propertyRules: [
          buildExplicitFieldRule({
            id: RULE_ID_1,
            roleId: ROLE_E,
            canRead: true,
            maskingStrategy: 'PARTIAL',
            effect: 'allow',
          }),
        ],
      });

      const prov = await service.explainFieldAccess(buildCtxE(), COLLECTION_ID_E, FIELD_E);

      expect(prov.effect).toBe('mask');
      expect(prov.matchedLevel).toBe(2);
      expect(prov.matchedRuleId).toBe(RULE_ID_1);
      expect(prov.maskingStrategy).toBe('PARTIAL');
    });

    it('7. wildcard field deny → matchedLevel=3, effect=deny, maskingStrategy=FULL', async () => {
      const { service } = buildService({
        propertyRules: [
          buildWildcardFieldRule({
            id: RULE_ID_2,
            roleId: ROLE_E,
            effect: 'deny',
          }),
        ],
      });

      const prov = await service.explainFieldAccess(buildCtxE(), COLLECTION_ID_E, FIELD_E);

      expect(prov.effect).toBe('deny');
      expect(prov.matchedLevel).toBe(3);
      expect(prov.matchedRuleId).toBe(RULE_ID_2);
      expect(prov.matchedPrincipal).toBe(ROLE_E);
      expect(prov.maskingStrategy).toBe('FULL');
      expect(prov.fallbackChain).toEqual([
        'level-1: no match',
        'level-2: no match',
        `level-3: deny matched (rule: ${RULE_ID_2})`,
      ]);
    });

    it('8. no rule + secureFieldsByDefault=true → matchedLevel=7, effect=deny, all 4 explicit/wildcard "no match" + level-7', async () => {
      const { service } = buildService({
        collectionFlags: { [COLLECTION_ID_E]: { secureFieldsByDefault: true } },
      });

      const prov = await service.explainFieldAccess(buildCtxE(), COLLECTION_ID_E, FIELD_E);

      expect(prov.effect).toBe('deny');
      expect(prov.matchedLevel).toBe(7);
      expect(prov.matchedRuleId).toBeNull();
      expect(prov.matchedPrincipal).toBeNull();
      expect(prov.maskingStrategy).toBe('FULL');
      expect(prov.fallbackChain).toEqual([
        'level-1: no match',
        'level-2: no match',
        'level-3: no match',
        'level-4: no match',
        'level-7: default deny (secureFieldsByDefault=true)',
      ]);
    });

    it('9. no rule + secureFieldsByDefault=false → matchedLevel=7, effect=allow, fallback notes legacy default-allow', async () => {
      const { service } = buildService({
        collectionFlags: { [COLLECTION_ID_E]: { secureFieldsByDefault: false } },
      });

      const prov = await service.explainFieldAccess(buildCtxE(), COLLECTION_ID_E, FIELD_E);

      expect(prov.effect).toBe('allow');
      expect(prov.matchedLevel).toBe(7);
      expect(prov.matchedRuleId).toBeNull();
      expect(prov.maskingStrategy).toBe('NONE');
      expect(prov.fallbackChain).toEqual([
        'level-1: no match',
        'level-2: no match',
        'level-3: no match',
        'level-4: no match',
        'level-7: default allow (legacy default; F005-pending)',
      ]);
    });

    it('10. two matching allow rules with different masks → matchedRuleId reflects which mask won §28.5', async () => {
      // RULE_ID_1 grants NONE; RULE_ID_3 grants PARTIAL. §28.5 takes the
      // MOST-restrictive mask → PARTIAL wins, attribution goes to
      // RULE_ID_3 because its mask is what the user actually sees.
      const { service } = buildService({
        propertyRules: [
          buildExplicitFieldRule({
            id: RULE_ID_1,
            roleId: ROLE_E,
            canRead: true,
            canWrite: true,
            maskingStrategy: 'NONE',
            effect: 'allow',
            priority: 1,
          }),
          buildExplicitFieldRule({
            id: RULE_ID_3,
            roleId: ROLE_E,
            canRead: true,
            canWrite: true,
            maskingStrategy: 'PARTIAL',
            effect: 'allow',
            priority: 2,
          }),
        ],
      });

      const prov = await service.explainFieldAccess(buildCtxE(), COLLECTION_ID_E, FIELD_E);

      expect(prov.effect).toBe('mask');
      expect(prov.matchedLevel).toBe(2);
      // PARTIAL beat NONE → RULE_ID_3 wins attribution.
      expect(prov.matchedRuleId).toBe(RULE_ID_3);
      expect(prov.maskingStrategy).toBe('PARTIAL');
    });

    it('11. most-restrictive masking provenance: fallback chain shows level-2 matched with the winning rule', async () => {
      // Two allow rules both grant access; one drops mask to FULL.
      // Provenance attributes to the FULL rule and effect is `deny`
      // because mask=FULL collapses to a deny outcome.
      const { service } = buildService({
        propertyRules: [
          buildExplicitFieldRule({
            id: RULE_ID_1,
            roleId: ROLE_E,
            maskingStrategy: 'PARTIAL',
            effect: 'allow',
            priority: 1,
          }),
          buildExplicitFieldRule({
            id: RULE_ID_3,
            roleId: ROLE_E,
            maskingStrategy: 'FULL',
            effect: 'allow',
            priority: 2,
          }),
        ],
      });

      const prov = await service.explainFieldAccess(buildCtxE(), COLLECTION_ID_E, FIELD_E);

      expect(prov.effect).toBe('deny'); // FULL mask collapses to deny effect
      expect(prov.matchedLevel).toBe(2);
      expect(prov.matchedRuleId).toBe(RULE_ID_3);
      expect(prov.maskingStrategy).toBe('FULL');
      expect(prov.fallbackChain).toEqual([
        'level-1: no match',
        `level-2: allow matched (rule: ${RULE_ID_3})`,
      ]);
    });
  });
});
