/**
 * Canon §28 / W2 Stream 3 PR-final — runtime defense tests for
 * `PermissionsGuard` after the warn-and-allow retirement.
 *
 * The route-boundary-coverage scanner is the primary gate: every
 * handler under `apps/api/src` and `apps/control-plane/src` must
 * carry a primary boundary decorator. If a handler somehow reaches
 * the guard at runtime without one (a dynamic module registration
 * the scanner can't see at PR time, or a controller added without
 * running CI), the guard fails closed instead of passing the request
 * through.
 *
 * Expected behavior:
 *   - Production (no env flag): throw 403 with the canon §28 minimal
 *     shape and emit `handler_missing_boundary` via the audit port.
 *   - Test / local dev (`HW_LOUD_AUTH_MISCONFIG=true`): throw 500 so
 *     the misconfiguration short-circuits a "works on my machine"
 *     rollout before the scanner can catch it.
 *
 * The guard's permission-required happy path (registered code, user
 * has it / lacks it) is covered by the W2 Stream 2 PR6 integration
 * tests that exercise the audit row emission. This spec narrowly
 * verifies the warn-and-allow retirement landed correctly.
 */
import {
  ForbiddenException,
  InternalServerErrorException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { ExecutionContext } from '@nestjs/common';
import { PermissionsGuard } from './permissions.guard';
import { PERMISSIONS_KEY } from './permissions.decorator';
import { IS_PUBLIC_KEY, IS_AUTHENTICATED_ONLY_KEY } from './public.decorator';
import type {
  AccessAuditPort,
  SecurityAuditEvent,
} from './audit-port';

interface FakeRequest {
  user?: { userId?: string; permissionCodes?: string[] };
  context?: unknown;
  route?: { path?: string };
  url?: string;
  method?: string;
}

class HandlerStub {
  list(): void { /* no-op */ }
}

function buildExecCtx(request: FakeRequest): ExecutionContext {
  const handler = HandlerStub.prototype.list;
  return {
    getHandler: () => handler,
    getClass: () => HandlerStub,
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

function buildGuard(opts: {
  metadataMap: Map<string, unknown>;
  port?: AccessAuditPort;
}): { guard: PermissionsGuard; audit: SecurityAuditEvent[] } {
  const reflector = {
    getAllAndOverride: <T>(key: string): T | undefined =>
      opts.metadataMap.get(key) as T | undefined,
  } as unknown as Reflector;
  const captured: SecurityAuditEvent[] = [];
  const port: AccessAuditPort =
    opts.port ?? {
      logAdminBypass: () => undefined,
      logSecurityEvent: (event) => captured.push(event),
      logAccessDenied: () => undefined,
    };
  const guard = new PermissionsGuard(reflector, port);
  return { guard, audit: captured };
}

describe('PermissionsGuard — unannotated handler runtime defense', () => {
  const ORIGINAL_LOUD = process.env['HW_LOUD_AUTH_MISCONFIG'];

  afterEach(() => {
    if (ORIGINAL_LOUD === undefined) {
      delete process.env['HW_LOUD_AUTH_MISCONFIG'];
    } else {
      process.env['HW_LOUD_AUTH_MISCONFIG'] = ORIGINAL_LOUD;
    }
  });

  it('throws ForbiddenException with the canon §28 minimal shape when no boundary is declared (production default)', () => {
    delete process.env['HW_LOUD_AUTH_MISCONFIG'];
    const { guard } = buildGuard({
      metadataMap: new Map(), // No @Public, no @AuthenticatedOnly, no @RequirePermission.
    });

    const ctx = buildExecCtx({
      user: { userId: 'user-1' },
      route: { path: '/some/route' },
      method: 'GET',
    });

    try {
      guard.canActivate(ctx);
      fail('expected ForbiddenException');
    } catch (err) {
      expect(err).toBeInstanceOf(ForbiddenException);
      const response = (err as ForbiddenException).getResponse() as Record<string, unknown>;
      expect(response).toEqual({
        statusCode: 403,
        message: 'Permission denied',
        code: 'PERMISSION_DENIED',
      });
    }
  });

  it('throws InternalServerErrorException when HW_LOUD_AUTH_MISCONFIG=true', () => {
    process.env['HW_LOUD_AUTH_MISCONFIG'] = 'true';
    const { guard } = buildGuard({ metadataMap: new Map() });
    const ctx = buildExecCtx({ user: { userId: 'user-1' } });

    expect(() => guard.canActivate(ctx)).toThrow(InternalServerErrorException);
  });

  it('emits a handler_missing_boundary security audit event when a port is bound', () => {
    delete process.env['HW_LOUD_AUTH_MISCONFIG'];
    const { guard, audit } = buildGuard({ metadataMap: new Map() });
    const ctx = buildExecCtx({
      user: { userId: 'user-42' },
      route: { path: '/admin/secret' },
      method: 'POST',
    });

    expect(() => guard.canActivate(ctx)).toThrow(ForbiddenException);
    expect(audit).toHaveLength(1);
    expect(audit[0].kind).toBe('handler_missing_boundary');
    expect(audit[0].severity).toBe('high');
    expect(audit[0].userId).toBe('user-42');
    expect(audit[0].context?.['handler']).toBe('HandlerStub.list');
    expect(audit[0].context?.['route']).toBe('/admin/secret');
    expect(audit[0].context?.['method']).toBe('POST');
  });

  it('still passes through when @Roles is declared (auxiliary RolesGuard decision)', () => {
    delete process.env['HW_LOUD_AUTH_MISCONFIG'];
    const metadataMap = new Map<string, unknown>();
    metadataMap.set('roles', ['admin']);
    const { guard, audit } = buildGuard({ metadataMap });
    const ctx = buildExecCtx({ user: { userId: 'user-1' } });

    expect(guard.canActivate(ctx)).toBe(true);
    expect(audit).toHaveLength(0);
  });

  it('still treats @Public() as opt-out (independent of the unannotated path)', () => {
    delete process.env['HW_LOUD_AUTH_MISCONFIG'];
    const metadataMap = new Map<string, unknown>();
    metadataMap.set(IS_PUBLIC_KEY, true);
    const { guard } = buildGuard({ metadataMap });

    expect(guard.canActivate(buildExecCtx({}))).toBe(true);
  });

  it('still treats @AuthenticatedOnly as the authenticated-identity primary', () => {
    delete process.env['HW_LOUD_AUTH_MISCONFIG'];
    const metadataMap = new Map<string, unknown>();
    metadataMap.set(IS_AUTHENTICATED_ONLY_KEY, true);
    const { guard } = buildGuard({ metadataMap });

    const ctx = buildExecCtx({ user: { userId: 'user-1' } });
    expect(guard.canActivate(ctx)).toBe(true);
  });

  it('preserves the @RequirePermission strict path: caller without the code is denied', () => {
    delete process.env['HW_LOUD_AUTH_MISCONFIG'];
    const metadataMap = new Map<string, unknown>();
    metadataMap.set(PERMISSIONS_KEY, ['audit:read']);
    const { guard } = buildGuard({ metadataMap });
    const ctx = buildExecCtx({
      user: { userId: 'user-1', permissionCodes: ['identity:user:read'] },
    });

    expect(() => guard.canActivate(ctx)).toThrow(ForbiddenException);
  });

  it('preserves the @RequirePermission strict path: caller with the code is allowed', () => {
    delete process.env['HW_LOUD_AUTH_MISCONFIG'];
    const metadataMap = new Map<string, unknown>();
    metadataMap.set(PERMISSIONS_KEY, ['audit:read']);
    const { guard } = buildGuard({ metadataMap });
    const ctx = buildExecCtx({
      user: { userId: 'user-1', permissionCodes: ['audit:read'] },
    });

    expect(guard.canActivate(ctx)).toBe(true);
  });
});
