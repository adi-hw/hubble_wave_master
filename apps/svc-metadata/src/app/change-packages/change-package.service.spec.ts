import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { ChangePackageService } from './change-package.service';
import type { ChangePackage, MetadataChange } from '@hubblewave/instance-db';
import {
  Application,
  AutomationRule,
  ChangePackage as ChangePackageEntity,
  ChoiceList,
  CollectionDefinition,
  DecisionInput,
  DecisionRow,
  DecisionTable,
  FormDefinition,
  GuidedProcessActivity,
  GuidedProcessDefinition,
  GuidedProcessStage,
  ProcessFlowDefinition,
  PropertyDefinition,
  PropertyType,
  ViewDefinition,
  ViewDefinitionRevision,
  ViewVariant,
  WorkspaceDefinition,
  WorkspacePage,
} from '@hubblewave/instance-db';

const buildPackage = (overrides: Partial<ChangePackage> = {}): ChangePackage =>
  ({
    id: 'cp-1',
    code: 'release-2026-q2',
    name: '2026 Q2',
    description: null,
    applicationId: 'app-1',
    status: 'open',
    changes: [],
    completedAt: null,
    appliedAt: null,
    sourceInstanceId: null,
    createdBy: null,
    updatedBy: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  }) as unknown as ChangePackage;

type RepoStub = {
  findOne: jest.Mock;
  find: jest.Mock;
  create: jest.Mock;
  save: jest.Mock;
  update: jest.Mock;
  delete: jest.Mock;
  createQueryBuilder: jest.Mock;
};

const makeRepo = (overrides: Partial<RepoStub> = {}): RepoStub => ({
  findOne: jest.fn().mockResolvedValue(null),
  find: jest.fn().mockResolvedValue([]),
  create: jest.fn().mockImplementation((p) => ({ ...(p ?? {}) })),
  save: jest.fn().mockImplementation((p) => Promise.resolve({ ...(p ?? {}) })),
  update: jest.fn().mockResolvedValue(undefined),
  delete: jest.fn().mockResolvedValue(undefined),
  createQueryBuilder: jest.fn(() => ({
    orderBy: jest.fn().mockReturnThis(),
    andWhere: jest.fn().mockReturnThis(),
    getMany: jest.fn().mockResolvedValue([]),
  })),
  ...overrides,
});

type EntityKey = unknown;

const ENTITY_BY_NAME: Record<string, EntityKey> = {
  ChangePackage: ChangePackageEntity,
  Application,
  CollectionDefinition,
  PropertyDefinition,
  PropertyType,
  ChoiceList,
  ViewDefinition,
  ViewDefinitionRevision,
  ViewVariant,
  FormDefinition,
  ProcessFlowDefinition,
  AutomationRule,
  DecisionTable,
  DecisionInput,
  DecisionRow,
  GuidedProcessDefinition,
  GuidedProcessStage,
  GuidedProcessActivity,
  WorkspaceDefinition,
  WorkspacePage,
};

const buildService = (config: {
  pkg?: ChangePackage | null;
  packageRepo?: RepoStub;
  repos?: Partial<Record<string, RepoStub>>;
}) => {
  const packageRepo: RepoStub =
    config.packageRepo ??
    makeRepo({
      findOne: jest.fn().mockResolvedValue(config.pkg ?? null),
    });

  const repoMap = new Map<EntityKey, RepoStub>();
  if (config.repos) {
    for (const [name, repo] of Object.entries(config.repos)) {
      const entity = ENTITY_BY_NAME[name];
      if (entity && repo) repoMap.set(entity, repo);
    }
  }
  const ensureRepo = (key: EntityKey): RepoStub => {
    if (!repoMap.has(key)) repoMap.set(key, makeRepo());
    return repoMap.get(key)!;
  };

  const manager = {
    getRepository: (entity: EntityKey) => ensureRepo(entity),
  };

  const dataSource = {
    manager,
    transaction: jest.fn(async (cb: (m: typeof manager) => unknown) => cb(manager)),
  };

  return {
    service: new ChangePackageService(packageRepo as never, dataSource as never),
    packageRepo,
    repos: repoMap,
    dataSource,
    getRepo: (name: string): RepoStub => {
      const entity = ENTITY_BY_NAME[name];
      if (!entity) throw new Error(`Unknown entity in test: ${name}`);
      return ensureRepo(entity);
    },
  };
};

describe('ChangePackageService — Phase 6 §11.3 verification gate', () => {
  it('captures a collection artifact with hashed snapshot + provenance source AND cascades properties', async () => {
    const collection = {
      id: 'col-1',
      code: 'work_orders',
      name: 'Work Orders',
      source: 'pack:emergency-management',
    };
    const properties = [
      { id: 'prop-1', collectionId: 'col-1', code: 'name', position: 1, source: 'pack:emergency-management' },
      { id: 'prop-2', collectionId: 'col-1', code: 'priority', position: 2, source: 'pack:emergency-management' },
    ];
    const pkg = buildPackage();
    const collectionRepo = makeRepo({ findOne: jest.fn().mockResolvedValue(collection) });
    const propertyRepo = makeRepo({ find: jest.fn().mockResolvedValue(properties) });
    const { service, packageRepo } = buildService({
      pkg,
      repos: { CollectionDefinition: collectionRepo, PropertyDefinition: propertyRepo },
    });

    await service.addArtifact('cp-1', { kind: 'collection', code: 'work_orders' });

    expect(packageRepo.update).toHaveBeenCalled();
    const updated = packageRepo.update.mock.calls[0][1] as { changes: MetadataChange[] };
    expect(updated.changes).toHaveLength(1);
    expect(updated.changes[0].kind).toBe('collection');
    expect(updated.changes[0].source).toBe('pack:emergency-management');
    expect(updated.changes[0].beforeHash).toMatch(/^fnv:/);
    const after = updated.changes[0].after as { code: string; properties: { code: string }[] };
    expect(after.code).toBe('work_orders');
    expect(after.properties).toHaveLength(2);
    expect(after.properties.map((p) => p.code)).toEqual(['name', 'priority']);
  });

  it('rejects adding artifacts to a complete package', async () => {
    const pkg = buildPackage({ status: 'complete' });
    const collectionRepo = makeRepo({ findOne: jest.fn().mockResolvedValue({ id: 'col-1', code: 'x' }) });
    const { service } = buildService({ pkg, repos: { CollectionDefinition: collectionRepo } });
    await expect(
      service.addArtifact('cp-1', { kind: 'collection', code: 'x' }),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('replaces a duplicate artifact entry rather than appending a second copy', async () => {
    const collection = { id: 'col-1', code: 'work_orders', source: 'custom' };
    const pkg = buildPackage({
      changes: [
        {
          kind: 'collection',
          code: 'work_orders',
          beforeHash: 'fnv:old',
          after: { stale: true },
          source: 'custom',
          capturedAt: new Date(0).toISOString(),
        },
      ],
    });
    const collectionRepo = makeRepo({ findOne: jest.fn().mockResolvedValue(collection) });
    const { service, packageRepo } = buildService({ pkg, repos: { CollectionDefinition: collectionRepo } });

    await service.addArtifact('cp-1', { kind: 'collection', code: 'work_orders' });
    const next = (packageRepo.update.mock.calls[0][1] as { changes: MetadataChange[] }).changes;
    expect(next).toHaveLength(1);
    expect((next[0].after as { stale?: boolean }).stale).toBeUndefined();
  });

  it('exportJson round-trips the package shape (code / name / changes / sourceInstanceId)', async () => {
    const pkg = buildPackage({
      changes: [
        {
          kind: 'collection',
          code: 'tickets',
          beforeHash: 'fnv:abc',
          after: { code: 'tickets', name: 'Tickets' },
          source: 'pack:base',
          capturedAt: '2026-04-29T00:00:00Z',
        },
      ],
      sourceInstanceId: 'instance-staging',
    });
    const { service } = buildService({ pkg });
    const exported = await service.exportJson('cp-1');
    expect(exported.code).toBe('release-2026-q2');
    expect(exported.changes).toHaveLength(1);
    expect(exported.changes[0].after).toEqual({ code: 'tickets', name: 'Tickets' });
    expect(exported.sourceInstanceId).toBe('instance-staging');
    expect(exported.exportedAt).toMatch(/T.+Z$/);
  });

  it('importPackage rejects a code already present in the target instance', async () => {
    const existing = buildPackage({ code: 'release-2026-q2' });
    const packageRepo = makeRepo({ findOne: jest.fn().mockResolvedValue(existing) });
    const { service } = buildService({ packageRepo });
    await expect(
      service.importPackage({
        applicationId: 'app-1',
        payload: {
          code: 'release-2026-q2',
          name: '2026 Q2',
          applicationId: 'app-source',
          status: 'complete',
          changes: [],
        },
      }),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('importPackage applies each artifact AND stamps applied + appliedAt only after every apply succeeds', async () => {
    const viewRepo = makeRepo();
    const collectionRepo = makeRepo();
    const propertyRepo = makeRepo();
    const txPackageRepo = makeRepo({
      create: jest.fn().mockImplementation((p) => p),
      save: jest.fn().mockImplementation((p) => Promise.resolve(p)),
    });
    const { service, packageRepo, dataSource } = buildService({
      pkg: null,
      repos: {
        ChangePackage: txPackageRepo,
        ViewDefinition: viewRepo,
        CollectionDefinition: collectionRepo,
        PropertyDefinition: propertyRepo,
      },
    });
    (packageRepo.findOne as jest.Mock).mockResolvedValue(null);

    await service.importPackage({
      applicationId: 'app-target',
      payload: {
        code: 'fresh-package',
        name: 'Fresh',
        applicationId: 'app-source',
        status: 'complete',
        changes: [
          {
            kind: 'view',
            code: 'work_orders.list',
            beforeHash: null,
            after: { code: 'work_orders.list', name: 'Work Orders List' },
            source: 'custom',
            capturedAt: '2026-04-29T00:00:00Z',
          },
          {
            kind: 'collection',
            code: 'work_orders',
            beforeHash: null,
            after: {
              code: 'work_orders',
              name: 'Work Orders',
              properties: [{ code: 'name', source: 'custom' }],
            },
            source: 'custom',
            capturedAt: '2026-04-29T00:00:00Z',
          },
        ],
        sourceInstanceId: 'instance-prod',
      },
    });

    expect(dataSource.transaction).toHaveBeenCalled();
    expect(viewRepo.save).toHaveBeenCalled();
    expect(collectionRepo.save).toHaveBeenCalled();
    expect(propertyRepo.save).toHaveBeenCalled();
    const created = txPackageRepo.create.mock.calls[0][0];
    expect(created.status).toBe('applied');
    expect(created.appliedAt).toBeInstanceOf(Date);
    expect(created.applicationId).toBe('app-target');
    expect(created.changes).toHaveLength(2);
  });

  it('importPackage rolls back when one apply fails — package is NOT marked applied', async () => {
    const viewRepo = makeRepo({
      save: jest.fn().mockRejectedValue(new Error('view save blew up')),
    });
    const txPackageRepo = makeRepo();
    const { service, packageRepo } = buildService({
      pkg: null,
      repos: { ChangePackage: txPackageRepo, ViewDefinition: viewRepo },
    });
    (packageRepo.findOne as jest.Mock).mockResolvedValue(null);

    await expect(
      service.importPackage({
        applicationId: 'app-target',
        payload: {
          code: 'doomed-package',
          name: 'Doomed',
          applicationId: 'app-source',
          status: 'complete',
          changes: [
            {
              kind: 'view',
              code: 'broken.view',
              beforeHash: null,
              after: { code: 'broken.view' },
              source: 'custom',
              capturedAt: '2026-04-29T00:00:00Z',
            },
          ],
        },
      }),
    ).rejects.toThrow('view save blew up');

    expect(txPackageRepo.save).not.toHaveBeenCalled();
  });

  it('importPackage refuses to overwrite a target row whose source mismatches the change', async () => {
    const viewRepo = makeRepo({
      findOne: jest.fn().mockResolvedValue({ code: 'tickets.list', source: 'pack:base' }),
    });
    const { service, packageRepo } = buildService({
      pkg: null,
      repos: { ViewDefinition: viewRepo },
    });
    (packageRepo.findOne as jest.Mock).mockResolvedValue(null);

    await expect(
      service.importPackage({
        applicationId: 'app-target',
        payload: {
          code: 'mismatched',
          name: 'Mismatched',
          applicationId: 'app-source',
          status: 'complete',
          changes: [
            {
              kind: 'view',
              code: 'tickets.list',
              beforeHash: null,
              after: { code: 'tickets.list' },
              source: 'custom',
              capturedAt: '2026-04-29T00:00:00Z',
            },
          ],
        },
      }),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('importPackage rejects unknown artifact kinds rather than silently marking applied', async () => {
    const txPackageRepo = makeRepo();
    const { service, packageRepo } = buildService({
      pkg: null,
      repos: { ChangePackage: txPackageRepo },
    });
    (packageRepo.findOne as jest.Mock).mockResolvedValue(null);

    await expect(
      service.importPackage({
        applicationId: 'app-target',
        payload: {
          code: 'mystery',
          name: 'Mystery',
          applicationId: 'app-source',
          status: 'complete',
          changes: [
            {
              kind: 'unknown' as MetadataChange['kind'],
              code: 'x',
              beforeHash: null,
              after: {},
              source: 'custom',
              capturedAt: '2026-04-29T00:00:00Z',
            },
          ],
        },
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(txPackageRepo.save).not.toHaveBeenCalled();
  });

  it('addArtifact for an unknown collection throws NotFoundException', async () => {
    const pkg = buildPackage();
    const collectionRepo = makeRepo({ findOne: jest.fn().mockResolvedValue(null) });
    const { service } = buildService({ pkg, repos: { CollectionDefinition: collectionRepo } });
    await expect(
      service.addArtifact('cp-1', { kind: 'collection', code: 'ghost' }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('captures a workspace artifact with cascading pages AND replaces page collectionId with collectionCode', async () => {
    const ws = { id: 'ws-1', code: 'ops_console', source: 'custom' };
    const pages = [
      { id: 'pg-1', workspaceId: 'ws-1', code: 'home', kind: 'home', position: 0, collectionId: null },
      {
        id: 'pg-2',
        workspaceId: 'ws-1',
        code: 'tickets_list',
        kind: 'list',
        position: 1,
        collectionId: 'col-tickets-source',
      },
    ];
    const pkg = buildPackage();
    const wsRepo = makeRepo({ findOne: jest.fn().mockResolvedValue(ws) });
    const pageRepo = makeRepo({ find: jest.fn().mockResolvedValue(pages) });
    // Workspace capture queries CollectionDefinition by id for each page's collectionId
    const collectionRepo = makeRepo({
      findOne: jest.fn().mockImplementation((opts: { where?: { id?: string } }) => {
        if (opts.where?.id === 'col-tickets-source') {
          return Promise.resolve({ id: 'col-tickets-source', code: 'tickets' });
        }
        return Promise.resolve(null);
      }),
    });
    const { service, packageRepo } = buildService({
      pkg,
      repos: {
        WorkspaceDefinition: wsRepo,
        WorkspacePage: pageRepo,
        CollectionDefinition: collectionRepo,
      },
    });

    await service.addArtifact('cp-1', { kind: 'workspace', code: 'ops_console' });
    const change = (packageRepo.update.mock.calls[0][1] as { changes: MetadataChange[] }).changes[0];
    const after = change.after as {
      code: string;
      pages: Array<{ code: string; collectionCode: string | null; collectionId?: string }>;
    };
    expect(after.code).toBe('ops_console');
    expect(after.pages.map((p) => p.code)).toEqual(['home', 'tickets_list']);
    expect(after.pages[0].collectionCode).toBeNull();
    expect(after.pages[1].collectionCode).toBe('tickets');
    // Source-instance UUIDs are stripped
    expect(after.pages[0].collectionId).toBeUndefined();
    expect(after.pages[1].collectionId).toBeUndefined();
  });

  it('workspace apply resolves page collectionCode to target collectionId', async () => {
    const wsRepo = makeRepo({
      findOne: jest.fn().mockResolvedValue(null),
      save: jest.fn().mockImplementation((p) => Promise.resolve({ ...p, id: 'ws-target' })),
    });
    const pageRepo = makeRepo();
    // Target instance: tickets collection has a different uuid
    const collectionRepo = makeRepo({
      findOne: jest.fn().mockImplementation((opts: { where?: { code?: string; id?: string } }) => {
        if (opts.where?.code === 'tickets')
          return Promise.resolve({ id: 'col-tickets-target', code: 'tickets' });
        return Promise.resolve(null);
      }),
    });
    const txPackageRepo = makeRepo();
    const { service, packageRepo } = buildService({
      pkg: null,
      repos: {
        ChangePackage: txPackageRepo,
        WorkspaceDefinition: wsRepo,
        WorkspacePage: pageRepo,
        CollectionDefinition: collectionRepo,
      },
    });
    (packageRepo.findOne as jest.Mock).mockResolvedValue(null);

    await service.importPackage({
      applicationId: 'app-target',
      payload: {
        code: 'ws-pkg',
        name: 'WS',
        applicationId: 'app-source',
        status: 'complete',
        changes: [
          {
            kind: 'workspace',
            code: 'ops_console',
            beforeHash: null,
            after: {
              code: 'ops_console',
              name: 'Ops',
              pages: [
                { code: 'home', kind: 'home', position: 0, collectionCode: null },
                { code: 'tickets_list', kind: 'list', position: 1, collectionCode: 'tickets' },
              ],
            },
            source: 'custom',
            capturedAt: '2026-04-29T00:00:00Z',
          },
        ],
      },
    });

    expect(pageRepo.save).toHaveBeenCalledTimes(2);
    const homePage = pageRepo.save.mock.calls[0][0];
    const ticketsPage = pageRepo.save.mock.calls[1][0];
    expect(homePage.workspaceId).toBe('ws-target');
    expect(homePage.collectionId).toBeNull();
    expect(ticketsPage.workspaceId).toBe('ws-target');
    expect(ticketsPage.collectionId).toBe('col-tickets-target');
  });

  it('view apply strips source publishedBy and restamps it with the importing user', async () => {
    const viewRepo = makeRepo({
      findOne: jest.fn().mockResolvedValue(null),
      save: jest.fn().mockImplementation((p) => Promise.resolve({ ...p, id: 'view-target' })),
    });
    const revRepo = makeRepo({ findOne: jest.fn().mockResolvedValue(null) });
    const txPackageRepo = makeRepo();
    const { service, packageRepo } = buildService({
      pkg: null,
      repos: {
        ChangePackage: txPackageRepo,
        ViewDefinition: viewRepo,
        ViewDefinitionRevision: revRepo,
      },
    });
    (packageRepo.findOne as jest.Mock).mockResolvedValue(null);

    await service.importPackage(
      {
        applicationId: 'app-target',
        payload: {
          code: 'view-pkg',
          name: 'View',
          applicationId: 'app-source',
          status: 'complete',
          changes: [
            {
              kind: 'view',
              code: 'work_orders.list',
              beforeHash: null,
              after: {
                code: 'work_orders.list',
                name: 'WO list',
                kind: 'list',
                revisions: [
                  {
                    revision: 1,
                    status: 'published',
                    layout: { rows: 1 },
                    publishedBy: 'source-user-uuid',
                    publishedAt: '2026-01-01T00:00:00Z',
                  },
                ],
                variants: [],
              },
              source: 'custom',
              capturedAt: '2026-04-29T00:00:00Z',
            },
          ],
        },
      },
      'importer-user-id',
    );

    expect(revRepo.save).toHaveBeenCalledTimes(1);
    const savedRev = revRepo.save.mock.calls[0][0];
    expect(savedRev.publishedBy).toBe('importer-user-id');
    expect(savedRev.publishedAt).toBeInstanceOf(Date);
    // Confirm the stale source UUID is gone
    expect(savedRev.publishedBy).not.toBe('source-user-uuid');
  });

  it('exportJson includes the source applicationCode for the importer target picker', async () => {
    const pkg = buildPackage({ applicationId: 'app-source-uuid' });
    const appRepo = makeRepo({
      findOne: jest.fn().mockResolvedValue({ id: 'app-source-uuid', code: 'wo_management' }),
    });
    const { service } = buildService({ pkg, repos: { Application: appRepo } });
    const exported = await service.exportJson('cp-1');
    expect(exported.applicationCode).toBe('wo_management');
  });

  it('captures property artifact via composite "<collection>.<property>" code', async () => {
    const collection = { id: 'col-1', code: 'work_orders', source: 'custom' };
    const property = { id: 'prop-1', collectionId: 'col-1', code: 'priority', source: 'custom' };
    const pkg = buildPackage();
    const collectionRepo = makeRepo({ findOne: jest.fn().mockResolvedValue(collection) });
    const propertyRepo = makeRepo({ findOne: jest.fn().mockResolvedValue(property) });
    const { service, packageRepo } = buildService({
      pkg,
      repos: { CollectionDefinition: collectionRepo, PropertyDefinition: propertyRepo },
    });

    await service.addArtifact('cp-1', { kind: 'property', code: 'work_orders.priority' });
    const change = (packageRepo.update.mock.calls[0][1] as { changes: MetadataChange[] }).changes[0];
    expect(change.kind).toBe('property');
    expect(change.code).toBe('work_orders.priority');
    expect((change.after as { collectionCode: string }).collectionCode).toBe('work_orders');
  });

  // ─────────────── Phase 6.2 cross-instance portability ──────────────────

  it('property capture replaces source-instance FK ids with stable codes', async () => {
    const collection = { id: 'col-1', code: 'work_orders', source: 'custom' };
    const property = {
      id: 'prop-1',
      collectionId: 'col-1',
      code: 'assignee',
      source: 'custom',
      applicationId: 'app-uuid-source',
      propertyTypeId: 'pt-uuid-source',
      referenceCollectionId: 'ref-uuid-source',
      choiceListId: null,
    };
    const pkg = buildPackage();
    const collectionRepo = makeRepo({ findOne: jest.fn().mockResolvedValue(collection) });
    const propertyRepo = makeRepo({ findOne: jest.fn().mockResolvedValue(property) });
    const appRepo = makeRepo({
      findOne: jest.fn().mockResolvedValue({ id: 'app-uuid-source', code: 'wo_management' }),
    });
    const propertyTypeRepo = makeRepo({
      findOne: jest.fn().mockResolvedValue({ id: 'pt-uuid-source', code: 'reference' }),
    });
    // Reference collection lookup: codeOf calls CollectionDefinition.findOne by id
    const refCollectionLookups = {
      'col-1': { id: 'col-1', code: 'work_orders' },
      'ref-uuid-source': { id: 'ref-uuid-source', code: 'users' },
    };
    collectionRepo.findOne = jest.fn().mockImplementation((opts: { where?: { id?: string; code?: string } }) => {
      if (opts.where?.code) return Promise.resolve(collection);
      if (opts.where?.id) return Promise.resolve((refCollectionLookups as Record<string, unknown>)[opts.where.id] ?? null);
      return Promise.resolve(null);
    });

    const { service, packageRepo } = buildService({
      pkg,
      repos: {
        CollectionDefinition: collectionRepo,
        PropertyDefinition: propertyRepo,
        Application: appRepo,
        PropertyType: propertyTypeRepo,
      },
    });

    await service.addArtifact('cp-1', { kind: 'property', code: 'work_orders.assignee' });
    const change = (packageRepo.update.mock.calls[0][1] as { changes: MetadataChange[] }).changes[0];
    const after = change.after as Record<string, unknown>;
    expect(after.applicationCode).toBe('wo_management');
    expect(after.propertyTypeCode).toBe('reference');
    expect(after.referenceCollectionCode).toBe('users');
    expect(after.choiceListCode).toBeNull();
    expect(after.applicationId).toBeUndefined();
    expect(after.propertyTypeId).toBeUndefined();
    expect(after.referenceCollectionId).toBeUndefined();
    expect(after.choiceListId).toBeUndefined();
  });

  it('property apply resolves stable codes back to target-instance ids', async () => {
    // Target instance: application "wo_management" exists with a different uuid
    const collectionRepo = makeRepo({
      findOne: jest.fn().mockImplementation((opts: { where?: { id?: string; code?: string } }) => {
        if (opts.where?.code === 'work_orders')
          return Promise.resolve({ id: 'col-target-1', code: 'work_orders' });
        if (opts.where?.code === 'users')
          return Promise.resolve({ id: 'ref-target', code: 'users' });
        return Promise.resolve(null);
      }),
    });
    const propertyRepo = makeRepo();
    const appRepo = makeRepo({
      findOne: jest.fn().mockResolvedValue({ id: 'app-target', code: 'wo_management' }),
    });
    const propertyTypeRepo = makeRepo({
      findOne: jest.fn().mockResolvedValue({ id: 'pt-target', code: 'reference' }),
    });
    const txPackageRepo = makeRepo();
    const { service, packageRepo } = buildService({
      pkg: null,
      repos: {
        ChangePackage: txPackageRepo,
        CollectionDefinition: collectionRepo,
        PropertyDefinition: propertyRepo,
        Application: appRepo,
        PropertyType: propertyTypeRepo,
      },
    });
    (packageRepo.findOne as jest.Mock).mockResolvedValue(null);

    await service.importPackage({
      applicationId: 'app-target-1',
      payload: {
        code: 'fresh',
        name: 'Fresh',
        applicationId: 'app-source',
        status: 'complete',
        changes: [
          {
            kind: 'property',
            code: 'work_orders.assignee',
            beforeHash: null,
            after: {
              code: 'assignee',
              collectionCode: 'work_orders',
              applicationCode: 'wo_management',
              propertyTypeCode: 'reference',
              referenceCollectionCode: 'users',
              choiceListCode: null,
            },
            source: 'custom',
            capturedAt: '2026-04-29T00:00:00Z',
          },
        ],
      },
    });

    expect(propertyRepo.save).toHaveBeenCalled();
    const saved = propertyRepo.save.mock.calls[0][0];
    expect(saved.applicationId).toBe('app-target');
    expect(saved.propertyTypeId).toBe('pt-target');
    expect(saved.referenceCollectionId).toBe('ref-target');
    expect(saved.choiceListId).toBeNull();
    expect(saved.collectionId).toBe('col-target-1');
    // Stable codes are stripped before the row hits the repo
    expect(saved.applicationCode).toBeUndefined();
    expect(saved.propertyTypeCode).toBeUndefined();
    expect(saved.referenceCollectionCode).toBeUndefined();
  });

  it('property apply throws NotFoundException when propertyTypeCode does not exist on target', async () => {
    const collectionRepo = makeRepo({
      findOne: jest.fn().mockResolvedValue({ id: 'col-target-1', code: 'work_orders' }),
    });
    const appRepo = makeRepo({
      findOne: jest.fn().mockResolvedValue({ id: 'app-target', code: 'app_x' }),
    });
    const propertyTypeRepo = makeRepo({ findOne: jest.fn().mockResolvedValue(null) });
    const txPackageRepo = makeRepo();
    const { service, packageRepo } = buildService({
      pkg: null,
      repos: {
        ChangePackage: txPackageRepo,
        CollectionDefinition: collectionRepo,
        Application: appRepo,
        PropertyType: propertyTypeRepo,
      },
    });
    (packageRepo.findOne as jest.Mock).mockResolvedValue(null);

    await expect(
      service.importPackage({
        applicationId: 'app-target-1',
        payload: {
          code: 'fresh',
          name: 'Fresh',
          applicationId: 'app-source',
          status: 'complete',
          changes: [
            {
              kind: 'property',
              code: 'work_orders.priority',
              beforeHash: null,
              after: {
                code: 'priority',
                collectionCode: 'work_orders',
                applicationCode: 'app_x',
                propertyTypeCode: 'made_up_type',
              },
              source: 'custom',
              capturedAt: '2026-04-29T00:00:00Z',
            },
          ],
        },
      }),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(txPackageRepo.save).not.toHaveBeenCalled();
  });

  it('view capture cascades revisions and variants', async () => {
    const view = { id: 'view-1', code: 'work_orders.list', source: 'custom' };
    const revisions = [
      {
        id: 'rev-1',
        definitionId: 'view-1',
        revision: 1,
        status: 'published',
        layout: { rows: 1 },
      },
    ];
    const variants = [
      { id: 'var-1', definitionId: 'view-1', scope: 'role', scopeKey: 'admin', priority: 100 },
    ];
    const pkg = buildPackage();
    const viewRepo = makeRepo({ findOne: jest.fn().mockResolvedValue(view) });
    const revRepo = makeRepo({ find: jest.fn().mockResolvedValue(revisions) });
    const variantRepo = makeRepo({ find: jest.fn().mockResolvedValue(variants) });
    const { service, packageRepo } = buildService({
      pkg,
      repos: {
        ViewDefinition: viewRepo,
        ViewDefinitionRevision: revRepo,
        ViewVariant: variantRepo,
      },
    });

    await service.addArtifact('cp-1', { kind: 'view', code: 'work_orders.list' });
    const change = (packageRepo.update.mock.calls[0][1] as { changes: MetadataChange[] }).changes[0];
    const after = change.after as {
      revisions: Array<{ revision: number; status: string }>;
      variants: Array<{ scope: string; scopeKey: string }>;
    };
    expect(after.revisions).toHaveLength(1);
    expect(after.revisions[0].revision).toBe(1);
    expect(after.revisions[0].status).toBe('published');
    expect(after.variants).toHaveLength(1);
    expect(after.variants[0].scope).toBe('role');
  });

  it('view apply upserts revisions and variants under the imported definition', async () => {
    // Fresh import — definition does not yet exist on target
    const viewRepo = makeRepo({
      findOne: jest.fn().mockResolvedValue(null),
      save: jest.fn().mockImplementation((p) => Promise.resolve({ ...p, id: 'view-target-id' })),
    });
    const revRepo = makeRepo({ findOne: jest.fn().mockResolvedValue(null) });
    const variantRepo = makeRepo({ findOne: jest.fn().mockResolvedValue(null) });
    const txPackageRepo = makeRepo();
    const { service, packageRepo } = buildService({
      pkg: null,
      repos: {
        ChangePackage: txPackageRepo,
        ViewDefinition: viewRepo,
        ViewDefinitionRevision: revRepo,
        ViewVariant: variantRepo,
      },
    });
    (packageRepo.findOne as jest.Mock).mockResolvedValue(null);

    await service.importPackage({
      applicationId: 'app-target',
      payload: {
        code: 'with-revs',
        name: 'WithRevs',
        applicationId: 'app-source',
        status: 'complete',
        changes: [
          {
            kind: 'view',
            code: 'work_orders.list',
            beforeHash: null,
            after: {
              code: 'work_orders.list',
              name: 'WO list',
              kind: 'list',
              revisions: [
                { revision: 1, status: 'published', layout: { rows: 1 } },
                { revision: 2, status: 'draft', layout: { rows: 2 } },
              ],
              variants: [{ scope: 'role', scopeKey: 'admin', priority: 100 }],
            },
            source: 'custom',
            capturedAt: '2026-04-29T00:00:00Z',
          },
        ],
      },
    });

    // Definition saved
    expect(viewRepo.save).toHaveBeenCalled();
    // Both revisions saved under the new view's id
    expect(revRepo.save).toHaveBeenCalledTimes(2);
    expect(revRepo.save.mock.calls[0][0].definitionId).toBe('view-target-id');
    expect(revRepo.save.mock.calls[1][0].definitionId).toBe('view-target-id');
    // Variant saved
    expect(variantRepo.save).toHaveBeenCalled();
    expect(variantRepo.save.mock.calls[0][0].definitionId).toBe('view-target-id');
  });

  it('decision capture cascades inputs + rows AND rewrites conditions[].inputId to inputPosition', async () => {
    const dec = { id: 'dec-1', code: 'priority_matrix', source: 'custom', collectionId: null };
    const inputs = [
      { id: 'in-1', tableId: 'dec-1', name: 'severity', position: 1, inputType: 'string' },
      { id: 'in-2', tableId: 'dec-1', name: 'impact', position: 2, inputType: 'string' },
    ];
    const rows = [
      {
        id: 'r-1',
        tableId: 'dec-1',
        position: 1,
        conditions: [
          { inputId: 'in-1', operator: 'equals', value: 'high' },
          { inputId: 'in-2', operator: 'equals', value: 'wide' },
        ],
        answerLiteral: { priority: 'P1' },
      },
    ];
    const pkg = buildPackage();
    const decRepo = makeRepo({ findOne: jest.fn().mockResolvedValue(dec) });
    const inputRepo = makeRepo({ find: jest.fn().mockResolvedValue(inputs) });
    const rowRepo = makeRepo({ find: jest.fn().mockResolvedValue(rows) });
    const { service, packageRepo } = buildService({
      pkg,
      repos: {
        DecisionTable: decRepo,
        DecisionInput: inputRepo,
        DecisionRow: rowRepo,
      },
    });

    await service.addArtifact('cp-1', { kind: 'decision', code: 'priority_matrix' });
    const change = (packageRepo.update.mock.calls[0][1] as { changes: MetadataChange[] }).changes[0];
    const after = change.after as {
      inputs: Array<{ name: string; position: number }>;
      rows: Array<{ conditions: Array<{ inputPosition: number; inputId?: string }> }>;
    };
    expect(after.inputs.map((i) => i.name)).toEqual(['severity', 'impact']);
    expect(after.rows[0].conditions).toHaveLength(2);
    expect(after.rows[0].conditions[0].inputPosition).toBe(1);
    expect(after.rows[0].conditions[1].inputPosition).toBe(2);
    // Source-instance UUIDs are removed
    expect(after.rows[0].conditions[0].inputId).toBeUndefined();
  });

  it('decision apply rewrites conditions[].inputPosition back to target-instance input ids', async () => {
    const decRepo = makeRepo({
      findOne: jest.fn().mockResolvedValue(null),
      save: jest.fn().mockImplementation((p) => Promise.resolve({ ...p, id: 'dec-target' })),
    });
    let inputCounter = 0;
    const inputRepo = makeRepo({
      save: jest.fn().mockImplementation((p) => {
        const id = `in-target-${++inputCounter}`;
        return Promise.resolve({ ...p, id });
      }),
    });
    const rowRepo = makeRepo();
    const txPackageRepo = makeRepo();
    const { service, packageRepo } = buildService({
      pkg: null,
      repos: {
        ChangePackage: txPackageRepo,
        DecisionTable: decRepo,
        DecisionInput: inputRepo,
        DecisionRow: rowRepo,
      },
    });
    (packageRepo.findOne as jest.Mock).mockResolvedValue(null);

    await service.importPackage({
      applicationId: 'app-target',
      payload: {
        code: 'dec-pkg',
        name: 'Dec',
        applicationId: 'app-source',
        status: 'complete',
        changes: [
          {
            kind: 'decision',
            code: 'priority_matrix',
            beforeHash: null,
            after: {
              code: 'priority_matrix',
              name: 'Priority Matrix',
              hitPolicy: 'first_match',
              inputs: [
                { name: 'severity', position: 1, inputType: 'string' },
                { name: 'impact', position: 2, inputType: 'string' },
              ],
              rows: [
                {
                  position: 1,
                  conditions: [
                    { inputPosition: 1, operator: 'equals', value: 'high' },
                    { inputPosition: 2, operator: 'equals', value: 'wide' },
                  ],
                  answerLiteral: { priority: 'P1' },
                },
              ],
            },
            source: 'custom',
            capturedAt: '2026-04-29T00:00:00Z',
          },
        ],
      },
    });

    expect(rowRepo.save).toHaveBeenCalledTimes(1);
    const savedRow = rowRepo.save.mock.calls[0][0];
    expect(savedRow.conditions).toHaveLength(2);
    expect(savedRow.conditions[0].inputId).toBe('in-target-1');
    expect(savedRow.conditions[1].inputId).toBe('in-target-2');
    // inputPosition is dropped from the persisted condition
    expect(savedRow.conditions[0].inputPosition).toBeUndefined();
  });

  it('guided process capture cascades stages AND activities', async () => {
    const gp = { id: 'gp-1', code: 'wo_intake', source: 'custom' };
    const stages = [
      { id: 'st-1', processId: 'gp-1', name: 'Triage', position: 1 },
      { id: 'st-2', processId: 'gp-1', name: 'Assign', position: 2 },
    ];
    const activitiesByStage: Record<string, unknown[]> = {
      'st-1': [{ id: 'a-1', stageId: 'st-1', name: 'Set priority', position: 1, kind: 'manual_task' }],
      'st-2': [
        { id: 'a-2', stageId: 'st-2', name: 'Notify', position: 1, kind: 'flow', processFlowCode: 'notify_assignee' },
      ],
    };
    const pkg = buildPackage();
    const gpRepo = makeRepo({ findOne: jest.fn().mockResolvedValue(gp) });
    const stageRepo = makeRepo({ find: jest.fn().mockResolvedValue(stages) });
    const activityRepo = makeRepo({
      find: jest.fn().mockImplementation((opts: { where?: { stageId?: string } }) => {
        const sid = opts.where?.stageId;
        return Promise.resolve(sid && activitiesByStage[sid] ? activitiesByStage[sid] : []);
      }),
    });
    const { service, packageRepo } = buildService({
      pkg,
      repos: {
        GuidedProcessDefinition: gpRepo,
        GuidedProcessStage: stageRepo,
        GuidedProcessActivity: activityRepo,
      },
    });

    await service.addArtifact('cp-1', { kind: 'guidedProcess', code: 'wo_intake' });
    const change = (packageRepo.update.mock.calls[0][1] as { changes: MetadataChange[] }).changes[0];
    const after = change.after as {
      stages: Array<{ name: string; activities: Array<{ name: string; kind: string }> }>;
    };
    expect(after.stages.map((s) => s.name)).toEqual(['Triage', 'Assign']);
    expect(after.stages[0].activities.map((a) => a.name)).toEqual(['Set priority']);
    expect(after.stages[1].activities[0].kind).toBe('flow');
  });

  it('guided process apply replaces stages and activities under target id', async () => {
    const gpRepo = makeRepo({
      findOne: jest.fn().mockResolvedValue(null),
      save: jest.fn().mockImplementation((p) => Promise.resolve({ ...p, id: 'gp-target' })),
    });
    let stageCounter = 0;
    const stageRepo = makeRepo({
      save: jest.fn().mockImplementation((p) => Promise.resolve({ ...p, id: `st-target-${++stageCounter}` })),
    });
    const activityRepo = makeRepo();
    const collectionRepo = makeRepo({
      findOne: jest.fn().mockResolvedValue({ id: 'col-target', code: 'work_orders' }),
    });
    const appRepo = makeRepo({
      findOne: jest.fn().mockResolvedValue({ id: 'app-target', code: 'wo_app' }),
    });
    const txPackageRepo = makeRepo();
    const { service, packageRepo } = buildService({
      pkg: null,
      repos: {
        ChangePackage: txPackageRepo,
        GuidedProcessDefinition: gpRepo,
        GuidedProcessStage: stageRepo,
        GuidedProcessActivity: activityRepo,
        CollectionDefinition: collectionRepo,
        Application: appRepo,
      },
    });
    (packageRepo.findOne as jest.Mock).mockResolvedValue(null);

    await service.importPackage({
      applicationId: 'app-target',
      payload: {
        code: 'gp-pkg',
        name: 'GP',
        applicationId: 'app-source',
        status: 'complete',
        changes: [
          {
            kind: 'guidedProcess',
            code: 'wo_intake',
            beforeHash: null,
            after: {
              code: 'wo_intake',
              name: 'WO Intake',
              applicationCode: 'wo_app',
              collectionCode: 'work_orders',
              stages: [
                {
                  name: 'Triage',
                  position: 1,
                  activities: [{ name: 'Set priority', position: 1, kind: 'manual_task' }],
                },
                {
                  name: 'Assign',
                  position: 2,
                  activities: [{ name: 'Notify', position: 1, kind: 'flow', processFlowCode: 'notify_assignee' }],
                },
              ],
            },
            source: 'custom',
            capturedAt: '2026-04-29T00:00:00Z',
          },
        ],
      },
    });

    expect(stageRepo.save).toHaveBeenCalledTimes(2);
    expect(activityRepo.save).toHaveBeenCalledTimes(2);
    expect(stageRepo.save.mock.calls[0][0].processId).toBe('gp-target');
    expect(activityRepo.save.mock.calls[0][0].stageId).toBe('st-target-1');
    expect(activityRepo.save.mock.calls[1][0].stageId).toBe('st-target-2');
    // Top-level FK codes resolved
    const savedGp = gpRepo.save.mock.calls[0][0];
    expect(savedGp.applicationId).toBe('app-target');
    expect(savedGp.collectionId).toBe('col-target');
  });
});
