import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { DashboardsService } from './dashboards.service';
import type { AuthorizationService } from '@hubblewave/authorization';
import type { CollectionOperation } from '@hubblewave/authorization';
import type { UserRequestContext } from '@hubblewave/auth-guard';
import type { CollectionDefinition, DashboardDefinition } from '@hubblewave/instance-db';

/**
 * F146 — per-widget collection access at dashboard read time.
 *
 * The dashboard-level scope check (canRead) gates whether the user sees
 * the dashboard at all. These tests focus on the secondary gate: even
 * once a dashboard is visible, widgets that reference collections the
 * user cannot read must be silently dropped from the returned layout.
 * Partial dashboards over broken dashboards; mirrors the metrics-layer
 * filter philosophy in metrics.service.ts.
 */

const PRINCIPAL: UserRequestContext = {
  userId: 'u-viewer',
  roles: ['operator'],
  permissions: [],
  isAdmin: false,
} as unknown as UserRequestContext;

const ADMIN: UserRequestContext = {
  userId: 'u-admin',
  roles: ['admin'],
  permissions: [],
  isAdmin: true,
} as unknown as UserRequestContext;

const COLLECTIONS: Record<string, CollectionDefinition> = {
  work_orders: { id: '11111111-1111-4111-8111-111111111111', code: 'work_orders' } as unknown as CollectionDefinition,
  incidents: { id: '22222222-2222-4222-8222-222222222222', code: 'incidents' } as unknown as CollectionDefinition,
  hr_payroll: { id: '33333333-3333-4333-8333-333333333333', code: 'hr_payroll' } as unknown as CollectionDefinition,
};

type MockSetup = {
  service: DashboardsService;
  dashboardRepo: any;
  collectionRepo: any;
  authz: jest.Mocked<Pick<AuthorizationService, 'canAccessCollection'>>;
};

const buildService = (options: {
  dashboard?: DashboardDefinition | null;
  dashboards?: DashboardDefinition[];
  allowedCollectionIds?: Set<string>;
}): MockSetup => {
  const allowed = options.allowedCollectionIds ?? new Set<string>();
  const authz = {
    canAccessCollection: jest.fn(
      async (_ctx: UserRequestContext, collectionId: string, _op: CollectionOperation) => allowed.has(collectionId),
    ),
  } as jest.Mocked<Pick<AuthorizationService, 'canAccessCollection'>>;

  const dashboardRepo = {
    findOne: jest.fn(async () => options.dashboard ?? null),
    find: jest.fn(async () => options.dashboards ?? []),
  };
  const auditRepo = {
    create: jest.fn(),
    save: jest.fn(),
  };
  const collectionRepo = {
    findOne: jest.fn(async ({ where }: { where: { code: string } }) => COLLECTIONS[where.code] ?? null),
  };

  const service = new DashboardsService(
    dashboardRepo as never,
    auditRepo as never,
    collectionRepo as never,
    authz as unknown as AuthorizationService,
  );

  return { service, dashboardRepo, collectionRepo, authz };
};

const makeDashboard = (overrides: Partial<DashboardDefinition>): DashboardDefinition => ({
  id: 'd-1',
  code: 'ops_overview',
  name: 'Ops Overview',
  description: 'Operations dashboard',
  scope: 'tenant',
  layout: {},
  metadata: {},
  isActive: true,
  createdBy: null,
  updatedBy: null,
  createdAt: new Date(),
  updatedAt: new Date(),
  ...overrides,
} as unknown as DashboardDefinition);

describe('DashboardsService — F146 per-widget collection authz', () => {
  describe('get()', () => {
    it('returns layout unchanged when user has read access to every widget collection', async () => {
      const dashboard = makeDashboard({
        layout: {
          version: 1,
          widgets: [
            { id: 'w1', type: 'metric', drilldown: { collectionCode: 'work_orders' } },
            { id: 'w2', type: 'table', drilldown: { collectionCode: 'incidents' } },
          ],
        },
      });
      const { service, authz } = buildService({
        dashboard,
        allowedCollectionIds: new Set([COLLECTIONS.work_orders.id, COLLECTIONS.incidents.id]),
      });

      const result = await service.get(PRINCIPAL, 'ops_overview');

      const widgets = (result.layout as { widgets: Array<{ id: string }> }).widgets;
      expect(widgets.map((w) => w.id)).toEqual(['w1', 'w2']);
      expect(authz.canAccessCollection).toHaveBeenCalledTimes(2);
    });

    it('drops widgets whose referenced collection the user cannot read', async () => {
      const dashboard = makeDashboard({
        layout: {
          version: 1,
          widgets: [
            { id: 'w-ok', type: 'metric', drilldown: { collectionCode: 'work_orders' } },
            { id: 'w-secret', type: 'metric', drilldown: { collectionCode: 'hr_payroll' } },
            { id: 'w-also-ok', type: 'metric', drilldown: { collectionCode: 'incidents' } },
          ],
        },
      });
      const { service } = buildService({
        dashboard,
        allowedCollectionIds: new Set([COLLECTIONS.work_orders.id, COLLECTIONS.incidents.id]),
      });

      const result = await service.get(PRINCIPAL, 'ops_overview');

      const widgets = (result.layout as { widgets: Array<{ id: string }> }).widgets;
      expect(widgets.map((w) => w.id)).toEqual(['w-ok', 'w-also-ok']);
    });

    it('returns dashboard with empty widgets array when user can read none of the collections', async () => {
      const dashboard = makeDashboard({
        layout: {
          version: 1,
          widgets: [
            { id: 'w1', type: 'metric', drilldown: { collectionCode: 'hr_payroll' } },
            { id: 'w2', type: 'metric', drilldown: { collectionCode: 'hr_payroll' } },
          ],
        },
      });
      const { service } = buildService({
        dashboard,
        allowedCollectionIds: new Set(), // access to nothing
      });

      const result = await service.get(PRINCIPAL, 'ops_overview');

      expect(result).toBeDefined();
      expect(result.code).toBe('ops_overview');
      const widgets = (result.layout as { widgets: unknown[] }).widgets;
      expect(widgets).toEqual([]);
    });

    it('lets widgets with no collectionId / collectionCode pass through unchanged', async () => {
      const dashboard = makeDashboard({
        layout: {
          version: 1,
          widgets: [
            { id: 'w-text', type: 'metric', title: 'Welcome' },
            { id: 'w-ava', type: 'ava', title: 'AVA chat' },
            { id: 'w-data', type: 'metric', drilldown: { collectionCode: 'work_orders' } },
          ],
        },
      });
      const { service } = buildService({
        dashboard,
        allowedCollectionIds: new Set([COLLECTIONS.work_orders.id]),
      });

      const result = await service.get(PRINCIPAL, 'ops_overview');

      const widgets = (result.layout as { widgets: Array<{ id: string }> }).widgets;
      expect(widgets.map((w) => w.id)).toEqual(['w-text', 'w-ava', 'w-data']);
    });

    it('passes through layouts with no widgets array unchanged', async () => {
      const dashboard = makeDashboard({ layout: { version: 1, something: 'else' } });
      const { service, authz } = buildService({
        dashboard,
        allowedCollectionIds: new Set(),
      });

      const result = await service.get(PRINCIPAL, 'ops_overview');

      expect(result.layout).toEqual({ version: 1, something: 'else' });
      expect(authz.canAccessCollection).not.toHaveBeenCalled();
    });

    it('honours widget.collectionId UUID references directly', async () => {
      const dashboard = makeDashboard({
        layout: {
          version: 1,
          widgets: [
            { id: 'w-uuid-ok', collectionId: COLLECTIONS.work_orders.id },
            { id: 'w-uuid-denied', collectionId: COLLECTIONS.hr_payroll.id },
          ],
        },
      });
      const { service, collectionRepo } = buildService({
        dashboard,
        allowedCollectionIds: new Set([COLLECTIONS.work_orders.id]),
      });

      const result = await service.get(PRINCIPAL, 'ops_overview');

      const widgets = (result.layout as { widgets: Array<{ id: string }> }).widgets;
      expect(widgets.map((w) => w.id)).toEqual(['w-uuid-ok']);
      // collectionId path bypasses the code-resolution lookup.
      expect(collectionRepo.findOne).not.toHaveBeenCalled();
    });

    it('drops widgets whose collectionCode does not resolve to any collection (fail-closed)', async () => {
      const dashboard = makeDashboard({
        layout: {
          version: 1,
          widgets: [
            { id: 'w-unknown', drilldown: { collectionCode: 'collection_that_was_deleted' } },
            { id: 'w-ok', drilldown: { collectionCode: 'work_orders' } },
          ],
        },
      });
      const { service } = buildService({
        dashboard,
        allowedCollectionIds: new Set([COLLECTIONS.work_orders.id]),
      });

      const result = await service.get(PRINCIPAL, 'ops_overview');

      const widgets = (result.layout as { widgets: Array<{ id: string }> }).widgets;
      expect(widgets.map((w) => w.id)).toEqual(['w-ok']);
    });

    it('bypasses per-widget filtering for admins', async () => {
      const dashboard = makeDashboard({
        layout: {
          version: 1,
          widgets: [
            { id: 'w-hr', drilldown: { collectionCode: 'hr_payroll' } },
            { id: 'w-ops', drilldown: { collectionCode: 'work_orders' } },
          ],
        },
      });
      const { service, authz, collectionRepo } = buildService({
        dashboard,
        allowedCollectionIds: new Set(), // admin doesn't need allowlist
      });

      const result = await service.get(ADMIN, 'ops_overview');

      const widgets = (result.layout as { widgets: Array<{ id: string }> }).widgets;
      expect(widgets.map((w) => w.id)).toEqual(['w-hr', 'w-ops']);
      expect(authz.canAccessCollection).not.toHaveBeenCalled();
      expect(collectionRepo.findOne).not.toHaveBeenCalled();
    });

    it('still surfaces NotFoundException when dashboard does not exist', async () => {
      const { service } = buildService({ dashboard: null });
      await expect(service.get(PRINCIPAL, 'missing')).rejects.toThrow(NotFoundException);
    });

    it('still surfaces ForbiddenException when dashboard scope blocks the viewer', async () => {
      const dashboard = makeDashboard({
        scope: 'personal',
        createdBy: 'someone-else',
        layout: { widgets: [] },
      });
      const { service } = buildService({ dashboard });
      await expect(service.get(PRINCIPAL, 'ops_overview')).rejects.toThrow(ForbiddenException);
    });
  });

  describe('list()', () => {
    it('filters every dashboard layout in the returned list', async () => {
      const dashboards = [
        makeDashboard({
          code: 'd1',
          layout: {
            widgets: [
              { id: 'd1-ok', drilldown: { collectionCode: 'work_orders' } },
              { id: 'd1-deny', drilldown: { collectionCode: 'hr_payroll' } },
            ],
          },
        }),
        makeDashboard({
          code: 'd2',
          layout: {
            widgets: [
              { id: 'd2-deny', drilldown: { collectionCode: 'hr_payroll' } },
              { id: 'd2-ok', drilldown: { collectionCode: 'incidents' } },
            ],
          },
        }),
      ];
      const { service } = buildService({
        dashboards,
        allowedCollectionIds: new Set([COLLECTIONS.work_orders.id, COLLECTIONS.incidents.id]),
      });

      const result = await service.list(PRINCIPAL);

      const ids = result.map((d) => ({
        code: d.code,
        widgetIds: (d.layout as { widgets: Array<{ id: string }> }).widgets.map((w) => w.id),
      }));
      expect(ids).toEqual([
        { code: 'd1', widgetIds: ['d1-ok'] },
        { code: 'd2', widgetIds: ['d2-ok'] },
      ]);
    });

    it('returns dashboards with empty widget arrays when viewer cannot read any referenced collection', async () => {
      const dashboards = [
        makeDashboard({
          code: 'sensitive',
          layout: {
            widgets: [{ id: 'w', drilldown: { collectionCode: 'hr_payroll' } }],
          },
        }),
      ];
      const { service } = buildService({
        dashboards,
        allowedCollectionIds: new Set(),
      });

      const result = await service.list(PRINCIPAL);

      expect(result).toHaveLength(1);
      expect((result[0].layout as { widgets: unknown[] }).widgets).toEqual([]);
    });
  });
});
