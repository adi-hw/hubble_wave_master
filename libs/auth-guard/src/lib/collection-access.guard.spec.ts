import {
  ForbiddenException,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { ExecutionContext } from '@nestjs/common';
import { CollectionAccessGuard } from './collection-access.guard';
import {
  REQUIRE_COLLECTION_ACCESS_KEY,
  type RequireCollectionAccessOptions,
} from './require-collection-access.decorator';
import type { CollectionAccessEvaluator } from './collection-access.port';
import type { CollectionIdResolverPort } from './collection-id-resolver.port';
import type {
  ServiceRequestContext,
  UserRequestContext,
} from './request-context.interface';

const COLLECTION_ID = '11111111-1111-1111-1111-111111111111';
const COLLECTION_CODE = 'work_orders';
const RECORD_ID = '22222222-2222-2222-2222-222222222222';

function buildUserContext(): UserRequestContext {
  return {
    kind: 'user',
    userId: 'user-1',
    roleIds: ['role-1'],
    roleCodes: ['member'],
    permissionCodes: [],
    groupIds: [],
    isAdmin: false,
    securityStamp: 'stamp-1',
    sessionId: 'session-1',
    bearerToken: 'fake.jwt.token',
  };
}

function buildServiceContext(): ServiceRequestContext {
  return {
    kind: 'service',
    serviceId: 'svc-worker',
    instanceId: 'inst-1',
    scopes: ['data:record:read'],
    audience: 'svc-api',
    bearerToken: 'fake.svc.token',
  };
}

interface FakeRequest {
  context?: unknown;
  params?: Record<string, unknown>;
  query?: Record<string, unknown>;
  body?: Record<string, unknown>;
  rowConditions?: unknown[];
}

function buildExecCtx(request: FakeRequest): ExecutionContext {
  return {
    getHandler: () => () => undefined,
    getClass: () => class Dummy {},
    switchToHttp: () => ({
      getRequest: () => request,
      getResponse: () => undefined,
      getNext: () => undefined,
    }),
    getType: () => 'http',
    getArgs: () => [],
    getArgByIndex: () => undefined,
    switchToRpc: () => ({}) as never,
    switchToWs: () => ({}) as never,
  } as unknown as ExecutionContext;
}

function buildGuard(
  metadata: RequireCollectionAccessOptions | undefined,
  options: {
    evaluator?: CollectionAccessEvaluator;
    resolver?: CollectionIdResolverPort;
  } = {},
) {
  const reflector = new Reflector();
  jest.spyOn(reflector, 'getAllAndOverride').mockImplementation((key) => {
    if (key === REQUIRE_COLLECTION_ACCESS_KEY) return metadata;
    return undefined;
  });
  return new CollectionAccessGuard(reflector, options.evaluator, options.resolver);
}

function mockEvaluator(
  overrides: Partial<CollectionAccessEvaluator> = {},
): CollectionAccessEvaluator {
  return {
    canAccessCollection: jest.fn().mockResolvedValue(true),
    canAccessCollectionRecord: jest.fn().mockResolvedValue(true),
    getSafeRowLevelPredicatesForCollection: jest.fn().mockResolvedValue([]),
    ...overrides,
  };
}

describe('CollectionAccessGuard (canon §28)', () => {
  it('is a no-op when no @RequireCollectionAccess metadata is present', async () => {
    const evaluator = mockEvaluator();
    const guard = buildGuard(undefined, { evaluator });
    const request: FakeRequest = { context: buildUserContext() };
    const ctx = buildExecCtx(request);
    await expect(guard.canActivate(ctx)).resolves.toBe(true);
    expect(evaluator.canAccessCollection).not.toHaveBeenCalled();
  });

  it('allows + attaches row predicates for list paths (no record target)', async () => {
    const predicates: unknown[] = [
      { field: 'owner_id', op: 'eq', value: 'user-1' },
    ];
    const evaluator = mockEvaluator({
      canAccessCollection: jest.fn().mockResolvedValue(true),
      getSafeRowLevelPredicatesForCollection: jest
        .fn()
        .mockResolvedValue(predicates),
    });
    const guard = buildGuard(
      {
        verb: 'read',
        collection: { from: 'param', name: 'collectionId', kind: 'id' },
      },
      { evaluator },
    );
    const request: FakeRequest = {
      context: buildUserContext(),
      params: { collectionId: COLLECTION_ID },
    };
    const ctx = buildExecCtx(request);
    await expect(guard.canActivate(ctx)).resolves.toBe(true);
    expect(evaluator.canAccessCollection).toHaveBeenCalledWith(
      expect.objectContaining({ kind: 'user', userId: 'user-1' }),
      COLLECTION_ID,
      'read',
    );
    expect(request.rowConditions).toEqual(predicates);
  });

  it('throws ForbiddenException with the canon §28 minimal shape on collection deny', async () => {
    const evaluator = mockEvaluator({
      canAccessCollection: jest.fn().mockResolvedValue(false),
    });
    const guard = buildGuard(
      {
        verb: 'read',
        collection: { from: 'param', name: 'collectionId', kind: 'id' },
      },
      { evaluator },
    );
    const request: FakeRequest = {
      context: buildUserContext(),
      params: { collectionId: COLLECTION_ID },
    };
    const ctx = buildExecCtx(request);
    await expect(guard.canActivate(ctx)).rejects.toMatchObject({
      status: 403,
      response: {
        statusCode: 403,
        message: 'Permission denied',
        code: 'PERMISSION_DENIED',
      },
    });
    expect(
      evaluator.getSafeRowLevelPredicatesForCollection,
    ).not.toHaveBeenCalled();
    expect(request.rowConditions).toBeUndefined();
  });

  it('performs the record-level check when record target is set', async () => {
    const evaluator = mockEvaluator({
      canAccessCollection: jest.fn().mockResolvedValue(true),
      canAccessCollectionRecord: jest.fn().mockResolvedValue(true),
    });
    const guard = buildGuard(
      {
        verb: 'update',
        collection: { from: 'param', name: 'collectionId', kind: 'id' },
        record: { from: 'param', name: 'recordId' },
      },
      { evaluator },
    );
    const request: FakeRequest = {
      context: buildUserContext(),
      params: { collectionId: COLLECTION_ID, recordId: RECORD_ID },
    };
    const ctx = buildExecCtx(request);
    await expect(guard.canActivate(ctx)).resolves.toBe(true);
    expect(evaluator.canAccessCollectionRecord).toHaveBeenCalledWith(
      expect.any(Object),
      COLLECTION_ID,
      RECORD_ID,
      'update',
    );
    // Row predicates are skipped when a record target is present.
    expect(
      evaluator.getSafeRowLevelPredicatesForCollection,
    ).not.toHaveBeenCalled();
    expect(request.rowConditions).toBeUndefined();
  });

  it('throws 403 on record-level deny even when collection-level allowed', async () => {
    const evaluator = mockEvaluator({
      canAccessCollection: jest.fn().mockResolvedValue(true),
      canAccessCollectionRecord: jest.fn().mockResolvedValue(false),
    });
    const guard = buildGuard(
      {
        verb: 'update',
        collection: { from: 'param', name: 'collectionId', kind: 'id' },
        record: { from: 'param', name: 'recordId' },
      },
      { evaluator },
    );
    const request: FakeRequest = {
      context: buildUserContext(),
      params: { collectionId: COLLECTION_ID, recordId: RECORD_ID },
    };
    const ctx = buildExecCtx(request);
    await expect(guard.canActivate(ctx)).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });

  it('throws 500 when the collection identifier is missing on the request', async () => {
    const evaluator = mockEvaluator();
    const guard = buildGuard(
      {
        verb: 'read',
        collection: { from: 'param', name: 'collectionId', kind: 'id' },
      },
      { evaluator },
    );
    const request: FakeRequest = { context: buildUserContext(), params: {} };
    const ctx = buildExecCtx(request);
    await expect(guard.canActivate(ctx)).rejects.toBeInstanceOf(
      InternalServerErrorException,
    );
  });

  it('throws 500 when kind:"code" fires without a bound resolver', async () => {
    const evaluator = mockEvaluator();
    const guard = buildGuard(
      {
        verb: 'read',
        collection: { from: 'param', name: 'collection', kind: 'code' },
      },
      { evaluator /* no resolver bound */ },
    );
    const request: FakeRequest = {
      context: buildUserContext(),
      params: { collection: COLLECTION_CODE },
    };
    const ctx = buildExecCtx(request);
    await expect(guard.canActivate(ctx)).rejects.toBeInstanceOf(
      InternalServerErrorException,
    );
  });

  it('throws 404 when kind:"code" resolver returns null', async () => {
    const evaluator = mockEvaluator();
    const resolver: CollectionIdResolverPort = {
      resolveByCode: jest.fn().mockResolvedValue(null),
    };
    const guard = buildGuard(
      {
        verb: 'read',
        collection: { from: 'param', name: 'collection', kind: 'code' },
      },
      { evaluator, resolver },
    );
    const request: FakeRequest = {
      context: buildUserContext(),
      params: { collection: 'no_such_collection' },
    };
    const ctx = buildExecCtx(request);
    await expect(guard.canActivate(ctx)).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('resolves kind:"code" by calling the resolver and using the returned UUID', async () => {
    const evaluator = mockEvaluator({
      canAccessCollection: jest.fn().mockResolvedValue(true),
    });
    const resolver: CollectionIdResolverPort = {
      resolveByCode: jest.fn().mockResolvedValue(COLLECTION_ID),
    };
    const guard = buildGuard(
      {
        verb: 'read',
        collection: { from: 'param', name: 'collection', kind: 'code' },
      },
      { evaluator, resolver },
    );
    const request: FakeRequest = {
      context: buildUserContext(),
      params: { collection: COLLECTION_CODE },
    };
    const ctx = buildExecCtx(request);
    await expect(guard.canActivate(ctx)).resolves.toBe(true);
    expect(resolver.resolveByCode).toHaveBeenCalledWith(COLLECTION_CODE);
    expect(evaluator.canAccessCollection).toHaveBeenCalledWith(
      expect.any(Object),
      COLLECTION_ID,
      'read',
    );
  });

  it('reads collection identifier from query when from:"query"', async () => {
    const evaluator = mockEvaluator({
      canAccessCollection: jest.fn().mockResolvedValue(true),
    });
    const guard = buildGuard(
      {
        verb: 'read',
        collection: { from: 'query', name: 'collectionId', kind: 'id' },
      },
      { evaluator },
    );
    const request: FakeRequest = {
      context: buildUserContext(),
      query: { collectionId: COLLECTION_ID },
    };
    const ctx = buildExecCtx(request);
    await expect(guard.canActivate(ctx)).resolves.toBe(true);
    expect(evaluator.canAccessCollection).toHaveBeenCalledWith(
      expect.any(Object),
      COLLECTION_ID,
      'read',
    );
  });

  it('reads collection identifier from body when from:"body"', async () => {
    const evaluator = mockEvaluator({
      canAccessCollection: jest.fn().mockResolvedValue(true),
    });
    const guard = buildGuard(
      {
        verb: 'create',
        collection: { from: 'body', name: 'collectionId', kind: 'id' },
      },
      { evaluator },
    );
    const request: FakeRequest = {
      context: buildUserContext(),
      body: { collectionId: COLLECTION_ID },
    };
    const ctx = buildExecCtx(request);
    await expect(guard.canActivate(ctx)).resolves.toBe(true);
  });

  it('uses a fixed collection identifier when from:"fixed"', async () => {
    const evaluator = mockEvaluator({
      canAccessCollection: jest.fn().mockResolvedValue(true),
    });
    const guard = buildGuard(
      {
        verb: 'read',
        collection: { from: 'fixed', name: COLLECTION_ID, kind: 'id' },
      },
      { evaluator },
    );
    const request: FakeRequest = { context: buildUserContext() };
    const ctx = buildExecCtx(request);
    await expect(guard.canActivate(ctx)).resolves.toBe(true);
    expect(evaluator.canAccessCollection).toHaveBeenCalledWith(
      expect.any(Object),
      COLLECTION_ID,
      'read',
    );
  });

  it('bypasses the §28 evaluator for service-token contexts', async () => {
    const evaluator = mockEvaluator();
    const guard = buildGuard(
      {
        verb: 'read',
        collection: { from: 'param', name: 'collectionId', kind: 'id' },
      },
      { evaluator },
    );
    const request: FakeRequest = {
      context: buildServiceContext(),
      params: { collectionId: COLLECTION_ID },
    };
    const ctx = buildExecCtx(request);
    await expect(guard.canActivate(ctx)).resolves.toBe(true);
    // Service tokens are scope-gated at the JwtAuthGuard layer; the
    // §28 evaluator is user-only.
    expect(evaluator.canAccessCollection).not.toHaveBeenCalled();
  });

  it('throws 500 when JwtAuthGuard did not populate request.context', async () => {
    const evaluator = mockEvaluator();
    const guard = buildGuard(
      {
        verb: 'read',
        collection: { from: 'param', name: 'collectionId', kind: 'id' },
      },
      { evaluator },
    );
    const request: FakeRequest = {
      params: { collectionId: COLLECTION_ID },
      // no context / user
    };
    const ctx = buildExecCtx(request);
    await expect(guard.canActivate(ctx)).rejects.toBeInstanceOf(
      InternalServerErrorException,
    );
  });

  it('throws 500 when metadata is set but no evaluator is bound', async () => {
    const guard = buildGuard({
      verb: 'read',
      collection: { from: 'param', name: 'collectionId', kind: 'id' },
    });
    const request: FakeRequest = {
      context: buildUserContext(),
      params: { collectionId: COLLECTION_ID },
    };
    const ctx = buildExecCtx(request);
    await expect(guard.canActivate(ctx)).rejects.toBeInstanceOf(
      InternalServerErrorException,
    );
  });

  it('throws 500 when the record identifier is missing for a record-targeted route', async () => {
    const evaluator = mockEvaluator({
      canAccessCollection: jest.fn().mockResolvedValue(true),
    });
    const guard = buildGuard(
      {
        verb: 'update',
        collection: { from: 'param', name: 'collectionId', kind: 'id' },
        record: { from: 'param', name: 'recordId' },
      },
      { evaluator },
    );
    const request: FakeRequest = {
      context: buildUserContext(),
      params: { collectionId: COLLECTION_ID /* no recordId */ },
    };
    const ctx = buildExecCtx(request);
    await expect(guard.canActivate(ctx)).rejects.toBeInstanceOf(
      InternalServerErrorException,
    );
  });
});
