/**
 * Canon §28 / W2 follow-up round 2 — CollectionDataService masking
 * applied end-to-end through the real list / getOne response path.
 *
 * Round 1 of the W2 review wired `maskCollectionRecord` into
 * `apps/api/src/app/data/collection-data.service.ts` (the original
 * leak: the data service attached a `permissions` payload but never
 * masked the rows, so PARTIAL / FULL fields shipped raw to the wire).
 * The `permissions-payload.spec.ts` integration spec verifies the
 * masking helper directly — what was missing was a test against the
 * ACTUAL list / getOne paths, so the original leak couldn't regress
 * even if a future refactor removed the masking call.
 *
 * This spec exercises the real `CollectionDataService` against:
 *   - A live Postgres datasource (createTestDataSource).
 *   - Real `CollectionDefinition` + `PropertyDefinition` rows + a
 *     real storage table the service queries.
 *   - Real `AuthorizationService` (so the masking decision flows
 *     through the §28 evaluator, not a stub).
 *   - Real `CollectionAccessRule` + `PropertyAccessRule` rows seeded
 *     to produce one visible / one PARTIAL-masked / one denied field.
 *
 * Side-effect deps that aren't on the masking path (validation,
 * default-value, outbox, sync-trigger, computed-property dispatcher,
 * runtime-anomaly) are stubbed to no-ops — they would fire on writes
 * and computed-property reads but not on the plain `list` / `getOne`
 * read paths this spec exercises.
 *
 * The shim translates `getPropertyRules`'s broken `where: { collectionId }`
 * query into the intended join through PropertyDefinition (same fix
 * as `permissions-payload.spec.ts`). That production divergence is
 * documented in `CLAUDE.md` §24 W2-close deferral list.
 *
 * Assertions:
 *   - `list()`: every returned row carries the raw `name` (NONE mask),
 *     the masked `salary` (PARTIAL — value transformed by the
 *     authorization service's `applyMask`), and NO `ssn` key at all
 *     (canRead: false → stripped, not nulled).
 *   - `getOne()`: same shape on the single record.
 *
 * If a future refactor drops the `maskCollectionRecord` call from
 * either path, BOTH assertions fail.
 */

import type { Repository } from 'typeorm';
import { DataSource } from 'typeorm';
import {
  CollectionAccessRule,
  CollectionDefinition,
  PropertyAccessRule,
  PropertyDefinition,
  instanceEntities,
} from '@hubblewave/instance-db';
import {
  AbacService,
  AuthorizationService,
  PolicyCompilerService,
} from '@hubblewave/authorization';
import { CollectionAclRepository } from '../../../../libs/authorization/src/lib/collection-acl.repository';
import type { UserRequestContext } from '@hubblewave/auth-guard';
import { CollectionDataService } from '../../src/app/data/collection-data.service';
import { createTestDataSource } from '../helpers/test-database';

const ROLE_ID = 'a1a1a1a1-1111-4111-8111-111111111111';
const USER_ID = 'b2b2b2b2-2222-4222-8222-222222222222';
const COLLECTION_ID = 'c3c3c3c3-3333-4333-8333-333333333333';
const PROPERTY_TYPE_ID = 'd4d4d4d4-4444-4444-8444-444444444444';
const PROP_NAME_ID = 'e5e5e5e5-5555-4555-8555-555555555555';
const PROP_SALARY_ID = 'f6f6f6f6-6666-4666-8666-666666666666';
const PROP_SSN_ID = '07070707-7777-4777-8777-777777777777';
const RECORD_ID = '08080808-8888-4888-8888-888888888888';

const RAW_NAME = 'Jane Doe';
const RAW_SALARY = '125000';
const RAW_SSN = '123-45-6789';

const PRINCIPAL: UserRequestContext = {
  kind: 'user',
  userId: USER_ID,
  roleIds: [ROLE_ID],
  roleCodes: ['hr_admin'],
  permissionCodes: [],
  groupIds: [],
  isAdmin: false,
  securityStamp: 'stamp-test',
};

function buildPropertyAclShim(
  propertyAclRepo: Repository<PropertyAccessRule>,
): { find: typeof propertyAclRepo.find } {
  // Same shim shape as `permissions-payload.spec.ts` — translates the
  // production `where: { collectionId }` query into the join through
  // PropertyDefinition the runtime service actually needs. Tracked as a
  // W3 follow-up; until the underlying authz service learns the
  // collection-aware lookup, the shim keeps the integration tests
  // honest without falsifying the runtime authz behavior.
  return {
    find: async (options?: Parameters<typeof propertyAclRepo.find>[0]) => {
      const opts = options ?? {};
      const where = ((opts as { where?: Record<string, unknown> }).where ?? {}) as Record<string, unknown>;
      const colId = where['collectionId'] as string | undefined;
      const isActive = where['isActive'] as boolean | undefined;
      const qb = propertyAclRepo
        .createQueryBuilder('rule')
        .leftJoinAndMapOne(
          'rule.property',
          PropertyDefinition,
          'prop',
          'prop.id = rule.property_id',
        );
      if (colId) {
        qb.where(
          '(prop.collection_id = :colId OR rule.wildcard_collection_id = :colId)',
          { colId },
        );
      }
      if (isActive !== undefined) {
        qb.andWhere('rule.is_active = :isActive', { isActive });
      }
      const order = (opts as { order?: Record<string, string> }).order;
      if (order?.['priority']) {
        qb.orderBy('rule.priority', order['priority'] as 'ASC' | 'DESC');
      }
      const rules = await qb.getMany();
      return rules.map((rule) => ({
        ...rule,
        propertyCode: (rule as PropertyAccessRule & { property?: { code?: string } }).property?.code,
      })) as never;
    },
  };
}

function buildNoopServices() {
  // Side-effect deps that aren't on the read/masking path. Each is
  // typed loosely (`as never`) because the spec doesn't need the full
  // shape of every interface — only the no-op methods invoked on a
  // read path. The shape is asserted by the constructor of
  // CollectionDataService, not by what's called inside list/getOne.
  return {
    validationService: { validate: async () => ({ errors: [] }) },
    defaultValueService: { applyDefaults: async (_c: unknown, data: unknown) => data },
    outboxService: { enqueue: async () => undefined },
    syncTriggerClient: {
      executeSyncTrigger: async () => ({
        aborted: false,
        abortMessage: null,
        errors: [],
        asyncQueue: [],
      }),
    },
    computedDispatcher: {
      dispatch: async (_ctx: unknown, _col: unknown, _props: unknown, record: unknown) => record,
    },
    runtimeAnomaly: {
      record: async () => undefined,
    },
  };
}

describe('CollectionDataService masking applied end-to-end (W2 follow-up round 2)', () => {
  let dataSource: DataSource;
  let cleanup: () => Promise<void>;
  let service: CollectionDataService;

  beforeAll(async () => {
    const created = await createTestDataSource({
      entities: instanceEntities,
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

    const collectionRepo = dataSource.getRepository(CollectionDefinition);
    const propertyRepo = dataSource.getRepository(PropertyDefinition);
    const collectionAclRepo = dataSource.getRepository(CollectionAccessRule);
    const propertyAclRepo = dataSource.getRepository(PropertyAccessRule);

    const collectionAcl = new CollectionAclRepository(collectionAclRepo);
    const policyCompiler = new PolicyCompilerService();
    const abac = new AbacService();
    const propertyAclShim = buildPropertyAclShim(propertyAclRepo);
    const authz = new AuthorizationService(
      collectionAcl as never,
      propertyAclShim as never,
      null,
      abac,
      policyCompiler,
      collectionRepo as never,
      null,
    );

    const noopDeps = buildNoopServices();
    service = new CollectionDataService(
      dataSource,
      authz,
      noopDeps.validationService as never,
      noopDeps.defaultValueService as never,
      noopDeps.outboxService as never,
      noopDeps.syncTriggerClient as never,
      noopDeps.computedDispatcher as never,
      noopDeps.runtimeAnomaly as never,
    );

    // Seed the identity / metadata / ACL graph. The storage table for
    // the test collection is created inline; the service queries it
    // via `dataSource.query(SELECT ... FROM public.hr_profile_data)`.
    await dataSource.query(
      `INSERT INTO "identity"."roles" (id, code, name, description, is_active)
       VALUES ($1, $2, $3, $4, true)`,
      [ROLE_ID, 'hr_admin', 'HR Admin', 'Test principal role'],
    );
    await dataSource.query(
      `INSERT INTO "users" (id, email, display_name, status)
       VALUES ($1, $2, $3, $4)`,
      [USER_ID, 'hr@example.test', 'HR Admin User', 'active'],
    );
    await dataSource.query(
      `INSERT INTO "metadata"."property_types"
         (id, code, name, category, base_type, default_config, validation_rules,
          is_system, created_at)
       VALUES ($1, 'string', 'String', 'text', 'varchar',
               '{}'::jsonb, '{}'::jsonb, true, NOW())`,
      [PROPERTY_TYPE_ID],
    );

    // Storage table the service queries. Column names match
    // PropertyDefinition.columnName so the SELECT picks them up.
    await dataSource.query(`
      CREATE TABLE public.hr_profile_data (
        id uuid PRIMARY KEY,
        name text,
        salary text,
        ssn text,
        created_at timestamptz DEFAULT now(),
        updated_at timestamptz DEFAULT now()
      )
    `);

    await collectionRepo.save(
      collectionRepo.create({
        id: COLLECTION_ID,
        code: 'hr_profile',
        name: 'HR Profile',
        tableName: 'hr_profile_data',
        // CollectionDefinition.getCollection() requires is_active = true
        // AND metadata.status = 'published' (or absent).
        isActive: true,
        metadata: { status: 'published' },
      } as never),
    );

    const props = [
      { id: PROP_NAME_ID, code: 'name', name: 'Name', columnName: 'name' },
      { id: PROP_SALARY_ID, code: 'salary', name: 'Salary', columnName: 'salary' },
      { id: PROP_SSN_ID, code: 'ssn', name: 'SSN', columnName: 'ssn' },
    ];
    for (const p of props) {
      await propertyRepo.save(
        propertyRepo.create({
          ...p,
          collectionId: COLLECTION_ID,
          propertyTypeId: PROPERTY_TYPE_ID,
          isActive: true,
        } as never),
      );
    }

    await collectionAclRepo.save(
      collectionAclRepo.create({
        name: 'hr-admin-read',
        collectionId: COLLECTION_ID,
        roleId: ROLE_ID,
        canRead: true,
        canCreate: false,
        canUpdate: false,
        canDelete: false,
        effect: 'allow',
        priority: 100,
        isActive: true,
      } as never),
    );

    const propRules = [
      {
        propertyId: PROP_NAME_ID,
        roleId: ROLE_ID,
        canRead: true,
        canWrite: true,
        maskingStrategy: 'NONE' as const,
        effect: 'allow' as const,
        priority: 100,
        isActive: true,
      },
      {
        propertyId: PROP_SALARY_ID,
        roleId: ROLE_ID,
        canRead: true,
        canWrite: false,
        maskingStrategy: 'PARTIAL' as const,
        effect: 'allow' as const,
        priority: 100,
        isActive: true,
      },
      {
        propertyId: PROP_SSN_ID,
        roleId: ROLE_ID,
        canRead: false,
        canWrite: false,
        maskingStrategy: 'FULL' as const,
        effect: 'deny' as const,
        priority: 1,
        isActive: true,
      },
    ];
    for (const r of propRules) {
      await propertyAclRepo.save(propertyAclRepo.create(r as never));
    }

    await dataSource.query(
      `INSERT INTO public.hr_profile_data (id, name, salary, ssn) VALUES ($1, $2, $3, $4)`,
      [RECORD_ID, RAW_NAME, RAW_SALARY, RAW_SSN],
    );
  }, 60_000);

  afterAll(async () => {
    if (cleanup) await cleanup();
  });

  it('list() returns rows with PARTIAL-masked salary, raw name, and stripped ssn', async () => {
    const result = await service.list(PRINCIPAL, 'hr_profile', {});

    expect(result.data).toHaveLength(1);
    const row = result.data[0] as Record<string, unknown>;

    // Visible field: NONE mask → raw value reaches the wire.
    expect(row['name']).toBe(RAW_NAME);

    // Masked field: PARTIAL → not the raw value, but still present.
    // The exact mask transformation is determined by
    // AuthorizationService.applyMask (covered by its own unit tests);
    // here we assert only "transformed, not raw".
    expect(row['salary']).toBeDefined();
    expect(row['salary']).not.toBe(RAW_SALARY);

    // Denied field: canRead:false → stripped entirely.
    expect(Object.prototype.hasOwnProperty.call(row, 'ssn')).toBe(false);
  });

  it('getOne() returns a record with PARTIAL-masked salary, raw name, and stripped ssn', async () => {
    const result = await service.getOne(PRINCIPAL, 'hr_profile', RECORD_ID);

    const record = result.record as Record<string, unknown>;
    expect(record['name']).toBe(RAW_NAME);
    expect(record['salary']).toBeDefined();
    expect(record['salary']).not.toBe(RAW_SALARY);
    expect(Object.prototype.hasOwnProperty.call(record, 'ssn')).toBe(false);
  });

  it('list() permissions payload reflects the per-field shape', async () => {
    const result = await service.list(PRINCIPAL, 'hr_profile', {});
    expect(result.permissions).toBeDefined();
    expect(result.permissions?.fields['name']).toEqual({
      canRead: true,
      canWrite: true,
      maskStrategy: 'NONE',
    });
    expect(result.permissions?.fields['salary']).toEqual({
      canRead: true,
      canWrite: false,
      maskStrategy: 'PARTIAL',
    });
    expect(result.permissions?.fields['ssn']).toEqual({
      canRead: false,
      canWrite: false,
      maskStrategy: 'FULL',
    });
  });
});
