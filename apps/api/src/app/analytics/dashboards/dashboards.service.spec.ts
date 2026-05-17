import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { DashboardsService } from './dashboards.service';
import { AuthorizationService, FILTER_UNRESOLVED } from '@hubblewave/authorization';
import type { UserRequestContext } from '@hubblewave/auth-guard';
import type { CollectionDefinition, DashboardDefinition } from '@hubblewave/instance-db';

/**
 * F146 — per-widget collection access at dashboard read time.
 *
 * The dashboard-level scope check (canRead) gates whether the user
 * sees the dashboard at all. The widget-level filter lives in
 * `AuthorizationService.filterDashboardLayout`; these tests exercise
 * the integration between DashboardsService and that filter (the
 * service decides what to do with the drop summary — write a §10
 * audit row when widgets were filtered, leave it alone when none
 * were).
 *
 * Pure widget-walker semantics (recursion, pass-through, fail-closed)
 * are covered by the AuthorizationService spec.
 */

const PRINCIPAL: UserRequestContext = {
  kind: 'user',
  userId: 'u-viewer',
  roleIds: [],
  roleCodes: ['operator'],
  permissionCodes: [],
  groupIds: [],
  isAdmin: false,
  securityStamp: 'stamp-1',
};

const ADMIN: UserRequestContext = {
  kind: 'user',
  userId: 'u-admin',
  roleIds: [],
  roleCodes: ['admin'],
  permissionCodes: [],
  groupIds: [],
  isAdmin: true,
  securityStamp: 'stamp-admin',
};

const COLLECTIONS: Record<string, CollectionDefinition> = {
  work_orders: { id: '11111111-1111-4111-8111-111111111111', code: 'work_orders' } as unknown as CollectionDefinition,
  incidents: { id: '22222222-2222-4222-8222-222222222222', code: 'incidents' } as unknown as CollectionDefinition,
  hr_payroll: { id: '33333333-3333-4333-8333-333333333333', code: 'hr_payroll' } as unknown as CollectionDefinition,
};

type MockSetup = {
  service: DashboardsService;
  dashboardRepo: { findOne: jest.Mock; find: jest.Mock };
  collectionRepo: { findOne: jest.Mock };
  authz: {
    filterDashboardLayout: jest.Mock;
  };
  txnCalls: { count: number };
};

/**
 * Build a DashboardsService instance with mocks for every constructor
 * dependency. The `AuthorizationService.filterDashboardLayout` mock
 * delegates to the SAME widget-walking logic the real method runs
 * (composed inline) so the integration tests can assert end-to-end
 * behaviour without spinning up TypeORM.
 *
 * `allowedCollectionIds` controls which collection UUIDs the
 * inlined evaluator answers `allowed=true` for; everything else
 * resolves to a deny with a synthetic provenance reason.
 */
const buildService = (options: {
  dashboard?: DashboardDefinition | null;
  dashboards?: DashboardDefinition[];
  allowedCollectionIds?: Set<string>;
}): MockSetup => {
  const allowed = options.allowedCollectionIds ?? new Set<string>();

  // Inline the widget-walking logic so the spec exercises the
  // contract DashboardsService relies on (the function returns a
  // filtered layout + drop summary) without depending on the
  // real AuthorizationService DI graph.
  const authz = {
    filterDashboardLayout: jest.fn(
      async (
        layout: Record<string, unknown> | null | undefined,
        _principal: UserRequestContext,
        resolveCollectionId: (
          widget: Record<string, unknown>,
        ) => Promise<string | null | typeof FILTER_UNRESOLVED>,
      ) => {
        if (!layout || typeof layout !== 'object') {
          return { layout: {}, droppedWidgetCount: 0, droppedWidgets: [] };
        }
        const widgetsRaw = (layout as { widgets?: unknown }).widgets;
        if (!Array.isArray(widgetsRaw)) {
          return { layout: { ...layout }, droppedWidgetCount: 0, droppedWidgets: [] };
        }
        const dropped: Array<{ widgetId: string; collectionId: string | null; reason: string }> = [];
        const kept: unknown[] = [];
        for (const widget of widgetsRaw) {
          if (!widget || typeof widget !== 'object') {
            kept.push(widget);
            continue;
          }
          const w = widget as Record<string, unknown>;
          const widgetId = typeof w.id === 'string' ? w.id : '<unknown>';
          const resolved = await resolveCollectionId(w);
          if (resolved === null) {
            kept.push(widget);
            continue;
          }
          if (resolved === FILTER_UNRESOLVED) {
            dropped.push({
              widgetId,
              collectionId: null,
              reason: 'collection reference does not resolve',
            });
            continue;
          }
          if (allowed.has(resolved)) {
            kept.push(widget);
          } else {
            dropped.push({
              widgetId,
              collectionId: resolved,
              reason: 'level-3: default deny',
            });
          }
        }
        return {
          layout: { ...layout, widgets: kept },
          droppedWidgetCount: dropped.length,
          droppedWidgets: dropped,
        };
      },
    ),
  };

  const dashboardRepo = {
    findOne: jest.fn(async () => options.dashboard ?? null),
    find: jest.fn(async () => options.dashboards ?? []),
  };
  const collectionRepo = {
    findOne: jest.fn(async ({ where }: { where: { code: string } }) => COLLECTIONS[where.code] ?? null),
  };

  // The service uses `withAudit(dataSource, fn)`. The mock dataSource
  // gives `withAudit` a transaction method that just invokes the
  // callback with an EntityManager-shaped object; the helper's audit
  // flush then runs against `mgr.getRepository(AuditLog).save(entry)`.
  // We satisfy that path with stub repos so unit tests assert without
  // a real DB.
  const txnCalls = { count: 0 };
  const dataSource = {
    transaction: jest.fn(async (cb: (mgr: unknown) => Promise<unknown>) => {
      txnCalls.count += 1;
      const mgr = {
        getRepository: () => ({
          create: jest.fn((entry: unknown) => entry),
          save: jest.fn(async (entry: unknown) => entry),
        }),
      };
      return cb(mgr);
    }),
  };

  const service = new DashboardsService(
    dashboardRepo as never,
    collectionRepo as never,
    authz as unknown as AuthorizationService,
    dataSource as never,
  );

  return { service, dashboardRepo, collectionRepo, authz, txnCalls };
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
      const { service, authz, txnCalls } = buildService({
        dashboard,
        allowedCollectionIds: new Set([COLLECTIONS.work_orders.id, COLLECTIONS.incidents.id]),
      });

      const result = await service.get(PRINCIPAL, 'ops_overview');

      const widgets = (result.layout as { widgets: Array<{ id: string }> }).widgets;
      expect(widgets.map((w) => w.id)).toEqual(['w1', 'w2']);
      expect(authz.filterDashboardLayout).toHaveBeenCalledTimes(1);
      // No drops → no audit transaction.
      expect(txnCalls.count).toBe(0);
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
      const { service, txnCalls } = buildService({
        dashboard,
        allowedCollectionIds: new Set([COLLECTIONS.work_orders.id, COLLECTIONS.incidents.id]),
      });

      const result = await service.get(PRINCIPAL, 'ops_overview');

      const widgets = (result.layout as { widgets: Array<{ id: string }> }).widgets;
      expect(widgets.map((w) => w.id)).toEqual(['w-ok', 'w-also-ok']);
      // Drops → exactly one §10 audit transaction.
      expect(txnCalls.count).toBe(1);
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
      const { service, authz, txnCalls } = buildService({
        dashboard,
        allowedCollectionIds: new Set(),
      });

      const result = await service.get(PRINCIPAL, 'ops_overview');

      // The filter copies the layout; field equality is enough.
      expect(result.layout).toMatchObject({ version: 1, something: 'else' });
      expect(authz.filterDashboardLayout).toHaveBeenCalledTimes(1);
      expect(txnCalls.count).toBe(0);
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

    it('admins flow through the same evaluator; seed admin policies grant access', async () => {
      // Canon §28.6 (Plan Fix 33): admins do not bypass the evaluator;
      // they match because the seeded admin policy grants access. We
      // simulate that here by including the HR collection in the
      // allowed set for the admin principal.
      const dashboard = makeDashboard({
        layout: {
          version: 1,
          widgets: [
            { id: 'w-hr', drilldown: { collectionCode: 'hr_payroll' } },
            { id: 'w-ops', drilldown: { collectionCode: 'work_orders' } },
          ],
        },
      });
      const { service, authz } = buildService({
        dashboard,
        allowedCollectionIds: new Set([
          COLLECTIONS.hr_payroll.id,
          COLLECTIONS.work_orders.id,
        ]),
      });

      const result = await service.get(ADMIN, 'ops_overview');

      const widgets = (result.layout as { widgets: Array<{ id: string }> }).widgets;
      expect(widgets.map((w) => w.id)).toEqual(['w-hr', 'w-ops']);
      // The filter is called like any other principal — no special branch.
      expect(authz.filterDashboardLayout).toHaveBeenCalledTimes(1);
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
      const { service, txnCalls } = buildService({
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
      // Two dashboards, both produced drops → two §10 audit transactions.
      expect(txnCalls.count).toBe(2);
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
