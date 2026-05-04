import { ExecutionContext, ForbiddenException, UnauthorizedException } from '@nestjs/common';
import type { Request } from 'express';
import { CollectionAccessGuard } from './collection-access.guard';
import type { AccessRuleService } from '../services/access-rule.service';

interface MakeRequestArgs {
  method?: string;
  url?: string;
  user?: Record<string, unknown> | null;
  collectionId?: string;
  routePath?: string;
}

const makeRequest = ({
  method = 'GET',
  url = '/collections',
  user = null,
  collectionId,
  routePath,
}: MakeRequestArgs): Request => {
  const params: Record<string, string> = {};
  if (collectionId) params.id = collectionId;
  return {
    method,
    url,
    path: url,
    route: routePath ? { path: routePath } : undefined,
    params,
    user,
  } as unknown as Request;
};

const makeContext = (request: Request): ExecutionContext =>
  ({
    switchToHttp: () => ({ getRequest: () => request }),
  }) as unknown as ExecutionContext;

const makeAccessService = (
  result: { allowed: boolean; reason?: string } = { allowed: true },
): AccessRuleService =>
  ({
    checkAccess: jest.fn().mockResolvedValue(result),
  }) as unknown as AccessRuleService;

describe('CollectionAccessGuard', () => {
  describe('authentication', () => {
    it('throws UnauthorizedException when request.user is missing', async () => {
      const guard = new CollectionAccessGuard(makeAccessService());
      const ctx = makeContext(makeRequest({ user: null }));
      await expect(guard.canActivate(ctx)).rejects.toBeInstanceOf(UnauthorizedException);
    });
  });

  describe('blanket bypass', () => {
    it('platform.bypass_authz grants access without consulting AccessRuleService', async () => {
      const accessService = makeAccessService();
      const guard = new CollectionAccessGuard(accessService);
      const ctx = makeContext(
        makeRequest({
          method: 'POST',
          collectionId: 'col-1',
          user: { id: 'u1', roles: [], permissions: ['platform.bypass_authz'] },
        }),
      );
      await expect(guard.canActivate(ctx)).resolves.toBe(true);
      expect((accessService as unknown as { checkAccess: jest.Mock }).checkAccess).not.toHaveBeenCalled();
    });

    it('system.admin permission also bypasses', async () => {
      const accessService = makeAccessService();
      const guard = new CollectionAccessGuard(accessService);
      const ctx = makeContext(
        makeRequest({
          method: 'DELETE',
          collectionId: 'col-1',
          user: { id: 'u1', roles: [], permissions: ['system.admin'] },
        }),
      );
      await expect(guard.canActivate(ctx)).resolves.toBe(true);
    });

    it('isAdmin flag (legacy snake_case) bypasses', async () => {
      const accessService = makeAccessService();
      const guard = new CollectionAccessGuard(accessService);
      const ctx = makeContext(
        makeRequest({
          method: 'POST',
          collectionId: 'col-1',
          user: { id: 'u1', is_admin: true, roles: [], permissions: [] },
        }),
      );
      await expect(guard.canActivate(ctx)).resolves.toBe(true);
    });
  });

  describe('per-operation slug acceptance', () => {
    it('GET allows collection.read', async () => {
      const guard = new CollectionAccessGuard(makeAccessService());
      const ctx = makeContext(
        makeRequest({
          method: 'GET',
          collectionId: 'col-1',
          user: { id: 'u1', roles: [], permissions: ['collection.read'] },
        }),
      );
      await expect(guard.canActivate(ctx)).resolves.toBe(true);
    });

    it('POST allows legacy collection.create slug', async () => {
      const guard = new CollectionAccessGuard(makeAccessService());
      const ctx = makeContext(
        makeRequest({
          method: 'POST',
          collectionId: 'col-1',
          user: { id: 'u1', roles: [], permissions: ['collection.create'] },
        }),
      );
      await expect(guard.canActivate(ctx)).resolves.toBe(true);
    });

    it('POST allows the per-feature metadata.collections.edit slug (ADR-12)', async () => {
      const guard = new CollectionAccessGuard(makeAccessService());
      const ctx = makeContext(
        makeRequest({
          method: 'POST',
          collectionId: 'col-1',
          user: { id: 'u1', roles: [], permissions: ['metadata.collections.edit'] },
        }),
      );
      await expect(guard.canActivate(ctx)).resolves.toBe(true);
    });

    it('PUT allows metadata.collections.edit and legacy collection.update', async () => {
      const guard1 = new CollectionAccessGuard(makeAccessService());
      const guard2 = new CollectionAccessGuard(makeAccessService());
      const ctx1 = makeContext(
        makeRequest({
          method: 'PUT',
          collectionId: 'col-1',
          user: { id: 'u1', roles: [], permissions: ['metadata.collections.edit'] },
        }),
      );
      const ctx2 = makeContext(
        makeRequest({
          method: 'PATCH',
          collectionId: 'col-1',
          user: { id: 'u1', roles: [], permissions: ['collection.update'] },
        }),
      );
      await expect(guard1.canActivate(ctx1)).resolves.toBe(true);
      await expect(guard2.canActivate(ctx2)).resolves.toBe(true);
    });

    it('DELETE requires collection.delete slug', async () => {
      const guard = new CollectionAccessGuard(makeAccessService());
      const ctx = makeContext(
        makeRequest({
          method: 'DELETE',
          collectionId: 'col-1',
          user: { id: 'u1', roles: [], permissions: ['collection.delete'] },
        }),
      );
      await expect(guard.canActivate(ctx)).resolves.toBe(true);
    });

    it('DELETE rejects users with only metadata.collections.edit', async () => {
      const guard = new CollectionAccessGuard(makeAccessService());
      const ctx = makeContext(
        makeRequest({
          method: 'DELETE',
          collectionId: 'col-1',
          user: { id: 'u1', roles: [], permissions: ['metadata.collections.edit'] },
        }),
      );
      await expect(guard.canActivate(ctx)).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('rejects when user has no acceptable slug for the operation', async () => {
      const guard = new CollectionAccessGuard(makeAccessService());
      const ctx = makeContext(
        makeRequest({
          method: 'POST',
          collectionId: 'col-1',
          user: { id: 'u1', roles: [], permissions: ['unrelated.permission'] },
        }),
      );
      await expect(guard.canActivate(ctx)).rejects.toBeInstanceOf(ForbiddenException);
    });
  });

  describe('collection.admin operation-agnostic semantics', () => {
    it('allows the operation gate but still consults AccessRuleService', async () => {
      const accessService = makeAccessService({ allowed: true });
      const guard = new CollectionAccessGuard(accessService);
      const ctx = makeContext(
        makeRequest({
          method: 'PUT',
          collectionId: 'col-1',
          user: { id: 'u1', roles: [], permissions: ['collection.admin'] },
        }),
      );
      await expect(guard.canActivate(ctx)).resolves.toBe(true);
      expect((accessService as unknown as { checkAccess: jest.Mock }).checkAccess).toHaveBeenCalled();
    });

    it('rejects when AccessRuleService denies even for collection.admin', async () => {
      const accessService = makeAccessService({ allowed: false, reason: 'Denied by ABAC' });
      const guard = new CollectionAccessGuard(accessService);
      const ctx = makeContext(
        makeRequest({
          method: 'PUT',
          collectionId: 'col-1',
          user: { id: 'u1', roles: [], permissions: ['collection.admin'] },
        }),
      );
      await expect(guard.canActivate(ctx)).rejects.toBeInstanceOf(ForbiddenException);
    });
  });

  describe('global (no collectionId) endpoints', () => {
    it('skips AccessRuleService when no collectionId is present', async () => {
      const accessService = makeAccessService();
      const guard = new CollectionAccessGuard(accessService);
      const ctx = makeContext(
        makeRequest({
          method: 'GET',
          user: { id: 'u1', roles: [], permissions: ['collection.read'] },
        }),
      );
      await expect(guard.canActivate(ctx)).resolves.toBe(true);
      expect((accessService as unknown as { checkAccess: jest.Mock }).checkAccess).not.toHaveBeenCalled();
    });

    it('still gates the global endpoint on the operation slug', async () => {
      const guard = new CollectionAccessGuard(makeAccessService());
      const ctx = makeContext(
        makeRequest({
          method: 'POST',
          user: { id: 'u1', roles: [], permissions: ['collection.read'] },
        }),
      );
      await expect(guard.canActivate(ctx)).rejects.toBeInstanceOf(ForbiddenException);
    });
  });

  describe('route-aware spreadsheet-write expansion (ADR-16)', () => {
    it('accepts metadata.collections.spreadsheet.write for the spreadsheet-audit endpoint', async () => {
      const guard = new CollectionAccessGuard(makeAccessService());
      const ctx = makeContext(
        makeRequest({
          method: 'POST',
          collectionId: 'col-1',
          url: '/collections/col-1/spreadsheet/audit-edit-mode-entry',
          routePath: '/collections/:id/spreadsheet/audit-edit-mode-entry',
          user: {
            id: 'u1',
            roles: [],
            permissions: ['metadata.collections.spreadsheet.write'],
          },
        }),
      );
      await expect(guard.canActivate(ctx)).resolves.toBe(true);
    });

    it('does NOT accept metadata.collections.spreadsheet.write for unrelated POST routes', async () => {
      const guard = new CollectionAccessGuard(makeAccessService());
      const ctx = makeContext(
        makeRequest({
          method: 'POST',
          collectionId: 'col-1',
          url: '/collections/col-1/publish',
          routePath: '/collections/:id/publish',
          user: {
            id: 'u1',
            roles: [],
            permissions: ['metadata.collections.spreadsheet.write'],
          },
        }),
      );
      await expect(guard.canActivate(ctx)).rejects.toBeInstanceOf(ForbiddenException);
    });
  });

  describe('per-collection access rules', () => {
    it('rejects when AccessRuleService.allowed is false', async () => {
      const accessService = makeAccessService({ allowed: false, reason: 'Row-level denial' });
      const guard = new CollectionAccessGuard(accessService);
      const ctx = makeContext(
        makeRequest({
          method: 'GET',
          collectionId: 'col-1',
          user: { id: 'u1', roles: [], permissions: ['collection.read'] },
        }),
      );
      await expect(guard.canActivate(ctx)).rejects.toThrow('Row-level denial');
    });

    it('attaches accessResult to the request when allowed', async () => {
      const accessService = makeAccessService({ allowed: true });
      const guard = new CollectionAccessGuard(accessService);
      const request = makeRequest({
        method: 'GET',
        collectionId: 'col-1',
        user: { id: 'u1', roles: [], permissions: ['collection.read'] },
      });
      const ctx = makeContext(request);
      await guard.canActivate(ctx);
      expect((request as unknown as { accessResult?: unknown }).accessResult).toBeDefined();
    });

    it('wraps unexpected errors as ForbiddenException', async () => {
      const accessService = {
        checkAccess: jest.fn().mockRejectedValue(new Error('DB unreachable')),
      } as unknown as AccessRuleService;
      const guard = new CollectionAccessGuard(accessService);
      const ctx = makeContext(
        makeRequest({
          method: 'GET',
          collectionId: 'col-1',
          user: { id: 'u1', roles: [], permissions: ['collection.read'] },
        }),
      );
      await expect(guard.canActivate(ctx)).rejects.toBeInstanceOf(ForbiddenException);
    });
  });
});
