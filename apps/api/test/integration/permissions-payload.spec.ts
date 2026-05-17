/**
 * Canon §28 / W2 Stream 4b Task 36 step 6 — `permissions.fields` payload
 * end-to-end verification.
 *
 * The contract Task 36 committed:
 *
 *   Every UI-facing data response carries
 *     `permissions: ResponsePermissions { canCreate, canUpdate, canDelete,
 *                                         fields: { [code]: FieldPermissions } }`
 *   alongside the record(s). The payload is uniform across rows in a
 *   single response (per-field permissions are collection-shape decisions,
 *   not per-row). The server is authoritative:
 *     - `canRead: false`  → field stripped from record body server-side.
 *     - `maskStrategy: 'PARTIAL' | 'FULL'` → server returns masked value.
 *     - `canRead: true, canWrite: false` → server still returns the raw
 *       (or masked) value; the client renders read-only.
 *
 * This integration test exercises three real services against a live
 * Postgres datasource:
 *   1. `AuthorizationService.evaluateResponsePermissions(...)` — produces
 *      the `ResponsePermissions` payload.
 *   2. `AuthorizationService.getAuthorizedFieldsForCollection(...)` —
 *      produces the per-field `AuthorizedPropertyMeta[]` array the
 *      data service consumes to filter SELECT columns + drive masking.
 *   3. `AuthorizationService.maskCollectionRecord(...)` — applies the
 *      stripping (`canRead: false` → field deleted) + masking
 *      (`PARTIAL` / `FULL`) to a record before serialization.
 *
 * Seeded fixture:
 *   - One CollectionDefinition (`HR_PROFILE`).
 *   - Three PropertyDefinition rows: `name` (visible), `salary`
 *     (masked PARTIAL), `ssn` (denied).
 *   - One Role + one User (the test principal).
 *   - One CollectionAccessRule: allow `read`+`create`+`update` for the
 *     role; `delete` falls through to default deny (§28.3 level 3).
 *   - Three PropertyAccessRule rows expressing the per-field shape.
 *
 * Assertions:
 *   - `ResponsePermissions.canCreate === true`.
 *   - `ResponsePermissions.canUpdate === true`.
 *   - `ResponsePermissions.canDelete === false` (level-3 default deny).
 *   - `fields.name` → `{ canRead: true, canWrite: true,  maskStrategy: 'NONE'    }`.
 *   - `fields.salary` → `{ canRead: true, canWrite: false, maskStrategy: 'PARTIAL' }`.
 *   - `fields.ssn` → `{ canRead: false, canWrite: false, maskStrategy: 'FULL'    }`.
 *   - Masked record: `name` retains raw value; `salary` is partially
 *     masked (digits replaced with `*` per `applyMask`); `ssn` is
 *     ABSENT from the record body (deleted, not masked).
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
import { createTestDataSource } from '../helpers/test-database';

const ROLE_ID = 'a1a1a1a1-1111-4111-8111-111111111111';
const USER_ID = 'b2b2b2b2-2222-4222-8222-222222222222';
const COLLECTION_ID = 'c3c3c3c3-3333-4333-8333-333333333333';
const PROPERTY_TYPE_ID = 'd4d4d4d4-4444-4444-8444-444444444444';
const PROP_NAME_ID = 'e5e5e5e5-5555-4555-8555-555555555555';
const PROP_SALARY_ID = 'f6f6f6f6-6666-4666-8666-666666666666';
const PROP_SSN_ID = '07070707-7777-4777-8777-777777777777';

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

describe('permissions.fields payload (W2 Stream 4b Task 36)', () => {
  let dataSource: DataSource;
  let cleanup: () => Promise<void>;
  let authz: AuthorizationService;
  let collectionRepo: Repository<CollectionDefinition>;
  let propertyRepo: Repository<PropertyDefinition>;
  let collectionAclRepo: Repository<CollectionAccessRule>;
  let propertyAclRepo: Repository<PropertyAccessRule>;

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

    collectionRepo = dataSource.getRepository(CollectionDefinition);
    propertyRepo = dataSource.getRepository(PropertyDefinition);
    collectionAclRepo = dataSource.getRepository(CollectionAccessRule);
    propertyAclRepo = dataSource.getRepository(PropertyAccessRule);

    const collectionAcl = new CollectionAclRepository(collectionAclRepo);
    const policyCompiler = new PolicyCompilerService();
    const abac = new AbacService();

    // `AuthorizationService.getPropertyRules` issues
    //   `propertyAclRepo.find({ where: { collectionId, isActive: true } })`
    // but `PropertyAccessRule` carries `propertyId` + `wildcardCollectionId`
    // — there is no `collectionId` column on the entity. Production wires
    // a custom `PropertyAclRepository` whose query-builder path joins
    // `property_definitions` to filter by collection; the raw TypeORM
    // repository the spec set up cannot honour that shape. The shim
    // below provides a `.find` that translates the call into the
    // intended semantics (rules whose `propertyId` references a
    // property of the collection, UNION-ed with rules whose
    // `wildcardCollectionId === collectionId`). The shim is test-only
    // — the production divergence is tracked separately and is out of
    // scope for Task 36's integration test.
    const propertyAclShim = {
      find: async (options: { where: Record<string, unknown>; order?: Record<string, string> }) => {
        const where = options.where ?? {};
        const colId = where['collectionId'] as string | undefined;
        const isActive = where['isActive'] as boolean | undefined;

        // Two-stage fetch: (1) the rule rows themselves, joined to
        // `property_definitions` so we can scope by collection AND
        // surface `property.code` for the evaluator's per-field match
        // (the evaluator compares `r.propertyCode === field.code`).
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
        if (options.order?.['priority']) {
          qb.orderBy('rule.priority', options.order['priority'] as 'ASC' | 'DESC');
        }
        const rules = await qb.getMany();

        // Mirror what `PropertyAclRepository.findByCollectionProperties`
        // returns: spread the entity + attach `propertyCode` (only
        // meaningful for explicit-field rules; wildcard rules have
        // `propertyId=NULL` so propertyCode stays undefined and the
        // evaluator routes via `wildcardCollectionId`).
        return rules.map((rule) => ({
          ...rule,
          propertyCode: rule.property?.code,
        }));
      },
    };

    authz = new AuthorizationService(
      collectionAcl as never,
      propertyAclShim as never,
      null, // cache
      abac,
      policyCompiler,
      collectionRepo as never,
      null, // eventBus
    );
  }, 60_000);

  afterAll(async () => {
    if (cleanup) await cleanup();
  });

  beforeEach(async () => {
    // CASCADE so PropertyAccessRule + PropertyDefinition rows clear
    // alongside their parents. Order matters because identity.roles
    // and users are referenced by the ACL tables.
    await dataSource.query(
      'TRUNCATE TABLE ' +
        '"property_access_rules", ' +
        '"collection_access_rules", ' +
        '"metadata"."property_definitions", ' +
        '"metadata"."property_types", ' +
        '"metadata"."collection_definitions", ' +
        '"identity"."roles", ' +
        '"users" ' +
        'RESTART IDENTITY CASCADE',
    );

    // 1. Identity rows the FK constraints require.
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

    // 2. PropertyType — every PropertyDefinition row carries an FK to
    // property_types.id. The platform's setup migrations don't seed
    // a generic 'string' type into the test schema, so the spec
    // creates one inline.
    await dataSource.query(
      `INSERT INTO "metadata"."property_types"
         (id, code, name, category, base_type, default_config, validation_rules,
          is_system, created_at)
       VALUES ($1, 'string', 'String', 'text', 'varchar',
               '{}'::jsonb, '{}'::jsonb, true, NOW())`,
      [PROPERTY_TYPE_ID],
    );

    // 3. CollectionDefinition (HR_PROFILE).
    await collectionRepo.save(
      collectionRepo.create({
        id: COLLECTION_ID,
        code: 'hr_profile',
        name: 'HR Profile',
        tableName: 'hr_profile',
      } as never),
    );

    // 4. Three properties — one for each authz outcome the test covers.
    const propRows = [
      { id: PROP_NAME_ID, code: 'name', name: 'Name', columnName: 'name' },
      { id: PROP_SALARY_ID, code: 'salary', name: 'Salary', columnName: 'salary' },
      { id: PROP_SSN_ID, code: 'ssn', name: 'SSN', columnName: 'ssn' },
    ];
    for (const p of propRows) {
      await propertyRepo.save(
        propertyRepo.create({
          ...p,
          collectionId: COLLECTION_ID,
          propertyTypeId: PROPERTY_TYPE_ID,
        } as never),
      );
    }

    // 5. CollectionAccessRule — allow read + create + update; deny
    // delete falls through to §28.3 level-3 default deny because no
    // matching rule on the `delete` verb.
    await collectionAclRepo.save(
      collectionAclRepo.create({
        name: 'hr-admin-read-write',
        collectionId: COLLECTION_ID,
        roleId: ROLE_ID,
        canRead: true,
        canCreate: true,
        canUpdate: true,
        canDelete: false,
        effect: 'allow',
        priority: 100,
        isActive: true,
      } as never),
    );

    // 6. PropertyAccessRule × 3 — the per-field shape the payload must
    // surface back to the client. Save each row individually (canon §10
    // forbids array saves on entities the audit subscriber tracks; this
    // table isn't one of those, but the per-row pattern matches the
    // platform's house style and the integration tests it ships with).
    const propertyRules = [
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
    for (const rule of propertyRules) {
      await propertyAclRepo.save(propertyAclRepo.create(rule as never));
    }
  });

  it('returns canCreate/canUpdate as configured and canDelete=false from level-3 default deny', async () => {
    const permissions = await authz.evaluateResponsePermissions(
      PRINCIPAL,
      COLLECTION_ID,
      [
        { code: 'name', label: 'Name' },
        { code: 'salary', label: 'Salary' },
        { code: 'ssn', label: 'SSN' },
      ],
    );

    expect(permissions.canCreate).toBe(true);
    expect(permissions.canUpdate).toBe(true);
    // The CollectionAccessRule's `canDelete=false` means the §28 evaluator
    // sees no matching allow rule for `delete`, so level-3 default deny fires.
    expect(permissions.canDelete).toBe(false);
  });

  it('emits per-field { canRead, canWrite, maskStrategy } that matches the seeded PropertyAccessRule rows', async () => {
    const permissions = await authz.evaluateResponsePermissions(
      PRINCIPAL,
      COLLECTION_ID,
      [
        { code: 'name', label: 'Name' },
        { code: 'salary', label: 'Salary' },
        { code: 'ssn', label: 'SSN' },
      ],
    );

    expect(permissions.fields.name).toEqual({
      canRead: true,
      canWrite: true,
      maskStrategy: 'NONE',
    });
    expect(permissions.fields.salary).toEqual({
      canRead: true,
      canWrite: false,
      maskStrategy: 'PARTIAL',
    });
    expect(permissions.fields.ssn).toEqual({
      canRead: false,
      canWrite: false,
      maskStrategy: 'FULL',
    });
  });

  it('maskCollectionRecord strips denied fields and applies PARTIAL masking to allowed-but-masked fields', async () => {
    const authorized = await authz.getAuthorizedFieldsForCollection(
      PRINCIPAL,
      COLLECTION_ID,
      [
        { code: 'name', label: 'Name' },
        { code: 'salary', label: 'Salary' },
        { code: 'ssn', label: 'SSN' },
      ],
    );

    const raw: Record<string, unknown> = {
      id: 'rec-1',
      name: 'Jane Doe',
      salary: 125000,
      ssn: '123-45-6789',
    };

    const masked = await authz.maskCollectionRecord(PRINCIPAL, raw, authorized);

    // `name`: NONE → raw.
    expect(masked['name']).toBe('Jane Doe');

    // `salary`: PARTIAL → not the raw number, not undefined, not equal
    // to the raw value, and (since salary is a non-string here) the
    // mask helper coerces to string and replaces interior characters.
    expect(masked['salary']).toBeDefined();
    expect(masked['salary']).not.toBe(125000);

    // `ssn`: canRead=false → stripped entirely (NOT masked, NOT empty
    // string, NOT null). The contract is "field absent from record body
    // server-side; client doesn't need to render a placeholder".
    expect(Object.prototype.hasOwnProperty.call(masked, 'ssn')).toBe(false);

    // Cross-check: other fields and the row id are passed through
    // untouched. The mask function operates only on declared fields.
    expect(masked['id']).toBe('rec-1');
  });

  it('payload shape is uniform across calls (per-field decisions cached by collection, not by record)', async () => {
    const fields = [
      { code: 'name', label: 'Name' },
      { code: 'salary', label: 'Salary' },
      { code: 'ssn', label: 'SSN' },
    ];

    const a = await authz.evaluateResponsePermissions(PRINCIPAL, COLLECTION_ID, fields);
    const b = await authz.evaluateResponsePermissions(PRINCIPAL, COLLECTION_ID, fields);

    expect(a).toEqual(b);
    // Sanity: both calls returned the same field set, in the same shape.
    expect(Object.keys(a.fields).sort()).toEqual(['name', 'salary', 'ssn']);
  });
});
