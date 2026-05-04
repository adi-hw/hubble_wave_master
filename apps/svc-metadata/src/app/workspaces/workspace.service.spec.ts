import { BadRequestException, ConflictException } from '@nestjs/common';
import { WorkspaceService } from './workspace.service';
import type {
  PanelLayout,
  WorkspacePage,
  WorkspaceVariant,
  WorkspaceVariantScope,
} from '@hubblewave/instance-db';

const buildPage = (overrides: Partial<WorkspacePage> = {}): WorkspacePage =>
  ({
    id: 'p1',
    workspaceId: 'ws-1',
    code: 'home',
    name: 'Home',
    kind: 'home',
    position: 0,
    layout: [],
    source: 'custom',
    collectionId: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  }) as unknown as WorkspacePage;

const buildVariant = (
  scope: WorkspaceVariantScope,
  scopeRef: string | null,
  layout: PanelLayout[],
  priority = 100,
): WorkspaceVariant =>
  ({
    id: `v-${scope}-${scopeRef ?? 'all'}`,
    workspaceId: 'ws-1',
    pageId: 'p1',
    scope,
    scopeRef,
    priority,
    layout,
    createdAt: new Date(),
    updatedAt: new Date(),
  }) as unknown as WorkspaceVariant;

const layoutWithLabel = (label: string): PanelLayout[] => [
  {
    id: 'panel-1',
    panelCode: 'MetricsPanel',
    config: { collectionCode: 'work_orders', metric: 'count', _label: label },
    x: 0,
    y: 0,
    w: 4,
    h: 2,
  },
];

const buildService = (
  page: WorkspacePage,
  variants: WorkspaceVariant[],
): WorkspaceService => {
  // Mirror the TypeORM repo's `order: { priority: 'ASC' }` behaviour
  // so tie-breaking tests match production.
  const sortedVariants = [...variants].sort((a, b) => a.priority - b.priority);
  const pageRepo = {
    findOne: jest.fn().mockResolvedValue(page),
    save: jest.fn().mockImplementation((p) => Promise.resolve(p)),
    create: jest.fn().mockImplementation((p) => p),
    delete: jest.fn().mockResolvedValue(undefined),
  };
  const variantRepo = {
    find: jest.fn().mockResolvedValue(sortedVariants),
    findOne: jest.fn().mockResolvedValue(null),
    save: jest.fn().mockImplementation((v) => Promise.resolve(v)),
    create: jest.fn().mockImplementation((v) => v),
  };
  // upsertPage / deletePage call `this.get(workspaceId)` which runs a
  // joined query through the def repo. Stub the QB chain so the
  // service receives a workspace shell.
  const defRepo = {
    createQueryBuilder: jest.fn(() => ({
      leftJoinAndSelect: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      getOne: jest.fn().mockResolvedValue({ id: 'ws-1', pages: [page] }),
    })),
    findOne: jest.fn().mockResolvedValue({ id: 'ws-1', status: 'draft', isActive: false }),
    update: jest.fn().mockResolvedValue(undefined),
  };
  const collectionRepo = {};
  const dataSource = {};
  return new WorkspaceService(
    defRepo as never,
    pageRepo as never,
    variantRepo as never,
    collectionRepo as never,
    dataSource as never,
  );
};

describe('WorkspaceService.resolvePageLayout — Plan §7 hierarchy', () => {
  it('returns the page base layout when no variant matches', async () => {
    const page = buildPage({ layout: layoutWithLabel('base') });
    const svc = buildService(page, []);
    const layout = await svc.resolvePageLayout('ws-1', 'p1', { userId: 'u-1' });
    expect((layout[0].config as { _label: string })._label).toBe('base');
  });

  it('a system variant supersedes the base page layout', async () => {
    const page = buildPage({ layout: layoutWithLabel('base') });
    const variants = [buildVariant('system', null, layoutWithLabel('system'))];
    const svc = buildService(page, variants);
    const layout = await svc.resolvePageLayout('ws-1', 'p1', { userId: 'u-1' });
    expect((layout[0].config as { _label: string })._label).toBe('system');
  });

  it('an instance variant supersedes a system variant', async () => {
    const page = buildPage({ layout: layoutWithLabel('base') });
    const variants = [
      buildVariant('system', null, layoutWithLabel('system')),
      buildVariant('instance', null, layoutWithLabel('instance')),
    ];
    const svc = buildService(page, variants);
    const layout = await svc.resolvePageLayout('ws-1', 'p1', { userId: 'u-1' });
    expect((layout[0].config as { _label: string })._label).toBe('instance');
  });

  it('a role variant matching the user supersedes instance + system', async () => {
    const page = buildPage({ layout: layoutWithLabel('base') });
    const variants = [
      buildVariant('system', null, layoutWithLabel('system')),
      buildVariant('instance', null, layoutWithLabel('instance')),
      buildVariant('role', 'manager', layoutWithLabel('role:manager')),
    ];
    const svc = buildService(page, variants);
    const layout = await svc.resolvePageLayout('ws-1', 'p1', {
      userId: 'u-1',
      roles: ['manager'],
    });
    expect((layout[0].config as { _label: string })._label).toBe('role:manager');
  });

  it('a role variant the user lacks does NOT match — falls through to instance', async () => {
    const page = buildPage({ layout: layoutWithLabel('base') });
    const variants = [
      buildVariant('instance', null, layoutWithLabel('instance')),
      buildVariant('role', 'admin', layoutWithLabel('role:admin')),
    ];
    const svc = buildService(page, variants);
    const layout = await svc.resolvePageLayout('ws-1', 'p1', {
      userId: 'u-1',
      roles: ['viewer'],
    });
    expect((layout[0].config as { _label: string })._label).toBe('instance');
  });

  it('a personal variant for the user beats role/group/instance/system', async () => {
    const page = buildPage({ layout: layoutWithLabel('base') });
    const variants = [
      buildVariant('system', null, layoutWithLabel('system')),
      buildVariant('role', 'manager', layoutWithLabel('role:manager')),
      buildVariant('personal', 'u-7', layoutWithLabel('personal:u-7')),
    ];
    const svc = buildService(page, variants);
    const layout = await svc.resolvePageLayout('ws-1', 'p1', {
      userId: 'u-7',
      roles: ['manager'],
    });
    expect((layout[0].config as { _label: string })._label).toBe('personal:u-7');
  });

  it('within a scope, lower priority wins ties', async () => {
    const page = buildPage({ layout: layoutWithLabel('base') });
    const variants = [
      buildVariant('role', 'manager', layoutWithLabel('role:manager:p100'), 100),
      buildVariant('role', 'manager', layoutWithLabel('role:manager:p10'), 10),
    ];
    const svc = buildService(page, variants);
    const layout = await svc.resolvePageLayout('ws-1', 'p1', {
      userId: 'u-1',
      roles: ['manager'],
    });
    // Priority 10 wins (variants are pre-sorted ASC, first match returned).
    expect((layout[0].config as { _label: string })._label).toBe('role:manager:p10');
  });
});

describe('WorkspaceService.upsertPage — direct-edit policy', () => {
  it('rejects mutating a pack-shipped list page (ADR-7)', async () => {
    const page = buildPage({ id: 'p2', kind: 'list', source: 'pack:emergency-management' });
    const svc = buildService(page, []);
    await expect(
      svc.upsertPage('ws-1', 'p2', {
        code: 'list',
        name: 'Records',
        kind: 'list',
        layout: [],
      }),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('allows mutating a pack-shipped home page', async () => {
    const page = buildPage({ id: 'p3', kind: 'home', source: 'pack:emergency-management' });
    const svc = buildService(page, []);
    await expect(
      svc.upsertPage('ws-1', 'p3', {
        code: 'home',
        name: 'Home',
        kind: 'home',
        layout: [],
      }),
    ).resolves.toBeDefined();
  });

  it('rejects a layout that fails widget-contract validation', async () => {
    const page = buildPage({ id: 'p4', kind: 'home', source: 'custom' });
    const svc = buildService(page, []);
    await expect(
      svc.upsertPage('ws-1', 'p4', {
        code: 'home',
        name: 'Home',
        kind: 'home',
        layout: [
          {
            id: 'panel-bad',
            panelCode: 'NonExistentPanel',
            config: {},
            x: 0,
            y: 0,
            w: 4,
            h: 2,
          },
        ],
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});
