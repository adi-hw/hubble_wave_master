/**
 * F146 — Dashboard widget authz filter + §10 transactional audit.
 *
 * Verifies the end-to-end behaviour committed by the Task 34 design:
 *   1. `DashboardsService.get()` walks the dashboard layout and drops
 *      every widget whose referenced collection the calling user
 *      cannot `read` per the §28 evaluator (canon §28.3 record-decision
 *      precedence; level-3 default deny for un-allowed collections).
 *   2. The widget filter is implemented by
 *      `AuthorizationService.filterDashboardLayout` (not inlined in
 *      DashboardsService) so the §28 evaluator is the single source
 *      of truth.
 *   3. When one or more widgets were dropped, the service writes
 *      EXACTLY ONE row into `audit_logs` with
 *      `action = 'dashboard.read.filtered'`, the dashboard id in
 *      `record_id`, and a structured `new_values` payload carrying
 *      `droppedWidgetCount` plus the per-widget provenance summary.
 *      The write is wrapped by `withAudit(dataSource, ...)` so canon
 *      §10 holds: audit row commits or rolls back atomically with
 *      whatever data writes share its transaction.
 *
 * The test uses a real Postgres datasource (per Task 34 hard
 * constraint: do not mock the DB). It seeds:
 *   - 5 CollectionDefinition rows.
 *   - 1 Role.
 *   - 2 CollectionAccessRule rows (allow `read` on collection #1 and
 *     collection #2 for the role; no rules on the other three — level-3
 *     default deny per canon §28.3 hides them).
 *   - 1 DashboardDefinition with 5 widgets across the 5 collections.
 *
 * After invoking `DashboardsService.get(principal, code)` once, the
 * returned layout MUST list exactly the two allowed widgets, and the
 * audit table MUST contain exactly one matching row.
 */

import { DataSource, Repository } from 'typeorm';
import {
  AuditLog,
  AuditLogSubscriber,
  CollectionAccessRule,
  CollectionDefinition,
  DashboardDefinition,
  instanceEntities,
} from '@hubblewave/instance-db';
import {
  AbacService,
  AuthorizationService,
  PolicyCompilerService,
} from '@hubblewave/authorization';
import { CollectionAclRepository } from '../../../../libs/authorization/src/lib/collection-acl.repository';
import type { UserRequestContext } from '@hubblewave/auth-guard';
import { DashboardsService } from '../../src/app/analytics/dashboards/dashboards.service';
import { createTestDataSource } from '../helpers/test-database';

const ROLE_ID = '99999999-9999-4999-8999-999999999999';
const USER_ID = '88888888-8888-4888-8888-888888888888';
const DASHBOARD_ID = '77777777-7777-4777-8777-777777777777';

// Five collection UUIDs — two readable (#1 + #2), three forbidden.
const COL_ALLOW_1 = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const COL_ALLOW_2 = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const COL_DENY_1  = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
const COL_DENY_2  = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd';
const COL_DENY_3  = 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee';

const PRINCIPAL: UserRequestContext = {
  kind: 'user',
  userId: USER_ID,
  roleIds: [ROLE_ID],
  roleCodes: ['operator'],
  permissionCodes: [],
  groupIds: [],
  isAdmin: false,
  securityStamp: 'stamp-test',
};

describe('Dashboards widget authz + audit (F146)', () => {
  let dataSource: DataSource;
  let cleanup: () => Promise<void>;
  let service: DashboardsService;
  let dashboardRepo: Repository<DashboardDefinition>;
  let collectionRepo: Repository<CollectionDefinition>;
  let collectionAclRepo: Repository<CollectionAccessRule>;
  let auditRepo: Repository<AuditLog>;

  beforeAll(async () => {
    // The full `instanceEntities` set is used here because the
    // entities the test directly touches (DashboardDefinition,
    // CollectionDefinition, CollectionAccessRule, AuditLog) transitively
    // reference Role, User, PropertyDefinition, etc. via @ManyToOne
    // decorators. TypeORM's `computeInverseProperties` pass fails if
    // any referenced entity is missing, so the simplest path is to
    // hand it the full graph. The schemas list covers every schema
    // any entity in that graph declares.
    const created = await createTestDataSource({
      entities: instanceEntities,
      subscribers: [AuditLogSubscriber],
      schemas: [
        'app_builder',
        'automation',
        'ava',
        'identity',
        'insights',
        'integrations',
        'metadata',
        'notify',
      ],
    });
    dataSource = created.dataSource;
    cleanup = created.cleanup;

    dashboardRepo = dataSource.getRepository(DashboardDefinition);
    collectionRepo = dataSource.getRepository(CollectionDefinition);
    collectionAclRepo = dataSource.getRepository(CollectionAccessRule);
    auditRepo = dataSource.getRepository(AuditLog);

    // Build the AuthorizationService against live repos. The ACL
    // repository class wraps the TypeORM repo and exposes the
    // findByCollectionAndUser fast-path the §28 evaluator prefers.
    // The property-acl repo is omitted: the widget filter only
    // consults the collection-level evaluator, and the
    // `propertyAclRepo` constructor argument is `@Optional()` so a
    // `null` value is safe.
    const collectionAcl = new CollectionAclRepository(collectionAclRepo);
    const policyCompiler = new PolicyCompilerService();
    const abac = new AbacService();
    const authz = new AuthorizationService(
      collectionAcl as never,
      null, // propertyAclRepo
      null, // cache
      abac,
      policyCompiler,
      collectionRepo as never,
      null, // eventBus
    );

    service = new DashboardsService(
      dashboardRepo,
      collectionRepo,
      authz,
      dataSource,
    );
  }, 60_000);

  afterAll(async () => {
    if (cleanup) await cleanup();
  });

  beforeEach(async () => {
    // Reset every table the test touches; CASCADE drops FK-linked
    // rows in one statement. Audit rows are dropped along with the
    // chain so every test case faces a fresh genesis. The roles table
    // is reset alongside the rule table because CollectionAccessRule
    // carries an FK to identity.roles via @ManyToOne, and the seed
    // step below inserts a single role row whose UUID the rules
    // reference.
    await dataSource.query(
      'TRUNCATE TABLE ' +
        '"audit_logs", ' +
        '"collection_access_rules", ' +
        '"insights"."dashboard_definitions", ' +
        '"metadata"."collection_definitions", ' +
        '"identity"."roles", ' +
        '"users" ' +
        'RESTART IDENTITY CASCADE',
    );

    // Seed the test role + user directly (raw SQL keeps the entity
    // graph out of the way — the live AuthorizationService only needs
    // the role row to exist for the FK; it never joins the table. The
    // user row is needed because `audit_logs.user_id` carries an FK
    // to `users.id`).
    await dataSource.query(
      `INSERT INTO "identity"."roles" (id, code, name, description, is_active)
       VALUES ($1, $2, $3, $4, true)`,
      [ROLE_ID, 'operator', 'Operator', 'Test viewer role'],
    );
    await dataSource.query(
      `INSERT INTO "users" (id, email, display_name, status)
       VALUES ($1, $2, $3, $4)`,
      [USER_ID, 'viewer@example.test', 'Test Viewer', 'active'],
    );

    // Seed: five collections. The "code" is what dashboard widgets cite
    // in their `drilldown.collectionCode` field; the id is what
    // CollectionAccessRule.collectionId references.
    const collections = [
      { id: COL_ALLOW_1, code: 'work_orders',    name: 'Work Order',     tableName: 'work_orders'    },
      { id: COL_ALLOW_2, code: 'incidents',      name: 'Incident',       tableName: 'incidents'      },
      { id: COL_DENY_1,  code: 'hr_payroll',     name: 'HR Payroll',     tableName: 'hr_payroll'     },
      { id: COL_DENY_2,  code: 'financials',     name: 'Financial',      tableName: 'financials'     },
      { id: COL_DENY_3,  code: 'audit_internal', name: 'Internal Audit', tableName: 'audit_internal' },
    ];
    for (const c of collections) {
      await collectionRepo.save(collectionRepo.create(c as never));
    }

    // Seed: two allow rules — operator role can READ #1 and #2. The
    // remaining three collections have NO rule, so canon §28.3 level-3
    // (default deny) fires on them.
    const rules = [
      { name: 'operator-read-work-orders', collectionId: COL_ALLOW_1, roleId: ROLE_ID,
        canRead: true, canCreate: false, canUpdate: false, canDelete: false,
        effect: 'allow', priority: 100, isActive: true },
      { name: 'operator-read-incidents',   collectionId: COL_ALLOW_2, roleId: ROLE_ID,
        canRead: true, canCreate: false, canUpdate: false, canDelete: false,
        effect: 'allow', priority: 100, isActive: true },
    ];
    for (const r of rules) {
      await collectionAclRepo.save(collectionAclRepo.create(r as never));
    }

    // Seed: dashboard with 5 widgets, one per collection.
    await dashboardRepo.save(
      dashboardRepo.create({
        id: DASHBOARD_ID,
        code: 'ops_overview',
        name: 'Operations Overview',
        description: 'Mixed-collection dashboard for F146 test',
        scope: 'tenant',
        isActive: true,
        layout: {
          version: 1,
          widgets: [
            { id: 'w-work-orders', type: 'metric', drilldown: { collectionCode: 'work_orders'    } },
            { id: 'w-incidents',   type: 'table',  drilldown: { collectionCode: 'incidents'      } },
            { id: 'w-hr-payroll',  type: 'metric', drilldown: { collectionCode: 'hr_payroll'     } },
            { id: 'w-financials',  type: 'metric', drilldown: { collectionCode: 'financials'     } },
            { id: 'w-audit',       type: 'metric', drilldown: { collectionCode: 'audit_internal' } },
          ],
        },
        metadata: {},
      } as never),
    );
  });

  it('returns only the two readable widgets and writes exactly one §10 audit row', async () => {
    const result = await service.get(PRINCIPAL, 'ops_overview');

    // (a) Layout assertion: only the two collections with allow rules
    // survive; the other three are silently dropped.
    const widgets = (result.layout as { widgets: Array<{ id: string }> }).widgets;
    expect(widgets.map((w) => w.id).sort()).toEqual(['w-incidents', 'w-work-orders']);

    // (b) Audit assertion: exactly one row written for this dashboard
    // read, with the dashboard.read.filtered action and the structured
    // drop summary in new_values.
    const auditRows = await auditRepo.find({
      where: { recordId: DASHBOARD_ID, action: 'dashboard.read.filtered' },
    });
    expect(auditRows).toHaveLength(1);

    const row = auditRows[0];
    expect(row.userId).toBe(USER_ID);
    expect(row.collectionCode).toBe('dashboard_definition');

    const payload = row.newValues as {
      dashboardCode: string;
      droppedWidgetCount: number;
      droppedWidgets: Array<{ widgetId: string; collectionId: string | null; reason: string }>;
    };
    expect(payload.dashboardCode).toBe('ops_overview');
    expect(payload.droppedWidgetCount).toBe(3);
    expect(payload.droppedWidgets.map((d) => d.widgetId).sort()).toEqual([
      'w-audit',
      'w-financials',
      'w-hr-payroll',
    ]);

    // (c) Each drop carries the collection id it targeted plus a
    // provenance reason sourced from the §28.7 fallback chain.
    const collectionIds = payload.droppedWidgets.map((d) => d.collectionId).sort();
    expect(collectionIds).toEqual([COL_DENY_1, COL_DENY_2, COL_DENY_3].sort());
    for (const drop of payload.droppedWidgets) {
      expect(typeof drop.reason).toBe('string');
      expect(drop.reason.length).toBeGreaterThan(0);
    }
  });

  it('writes no audit row when every widget passes the filter', async () => {
    // Add allow rules covering the remaining three collections so the
    // viewer can see everything; the dashboard layout returns intact and
    // the audit table stays empty.
    const allowAll = [
      { name: 'operator-read-hr',     collectionId: COL_DENY_1, roleId: ROLE_ID,
        canRead: true, canCreate: false, canUpdate: false, canDelete: false,
        effect: 'allow', priority: 100, isActive: true },
      { name: 'operator-read-fin',    collectionId: COL_DENY_2, roleId: ROLE_ID,
        canRead: true, canCreate: false, canUpdate: false, canDelete: false,
        effect: 'allow', priority: 100, isActive: true },
      { name: 'operator-read-audit',  collectionId: COL_DENY_3, roleId: ROLE_ID,
        canRead: true, canCreate: false, canUpdate: false, canDelete: false,
        effect: 'allow', priority: 100, isActive: true },
    ];
    for (const r of allowAll) {
      await collectionAclRepo.save(collectionAclRepo.create(r as never));
    }

    const result = await service.get(PRINCIPAL, 'ops_overview');
    const widgets = (result.layout as { widgets: Array<{ id: string }> }).widgets;
    expect(widgets).toHaveLength(5);

    const auditRows = await auditRepo.find({
      where: { recordId: DASHBOARD_ID, action: 'dashboard.read.filtered' },
    });
    expect(auditRows).toHaveLength(0);
  });
});
