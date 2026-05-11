import { ExecutionContext, Logger, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { JwtAuthGuard } from './jwt.guard';
import { IdentityResolverPort } from './identity-resolver.port';
import { JwtRevocationPort } from './jwt-revocation.port';
import { IS_PUBLIC_KEY } from './public.decorator';

/**
 * Test harness for {@link JwtAuthGuard}. Covers all three audit findings:
 *   F016 — audience + issuer validation
 *   F013 — fresh roles/permissions/status from the resolver port
 *   F002 — revocation port short-circuits otherwise-valid tokens
 *
 * The guard is constructed manually rather than via Nest DI so each test
 * can vary which ports are bound; this mirrors the production wiring
 * where ports are `@Optional()` so light-weight test fixtures can omit
 * them.
 */

interface BuiltContext {
  ctx: ExecutionContext;
  request: Record<string, unknown>;
}

function buildContext(opts: {
  isPublic?: boolean;
  authHeader?: string | undefined;
}): BuiltContext {
  const request: Record<string, unknown> = {
    headers: opts.authHeader ? { authorization: opts.authHeader } : {},
  };
  const ctx = {
    getHandler: () => undefined,
    getClass: () => undefined,
    switchToHttp: () => ({ getRequest: () => request }),
  } as unknown as ExecutionContext;
  return { ctx, request };
}

function buildReflector(isPublic: boolean): Reflector {
  const r = new Reflector();
  jest
    .spyOn(r, 'getAllAndOverride')
    .mockImplementation((key: unknown) => (key === IS_PUBLIC_KEY ? isPublic : undefined));
  return r;
}

function buildJwtService(verifyResult: unknown, throwOnVerify = false): JwtService {
  // JwtService is a class; we only need a subset of its surface, so a
  // minimal mock object cast to JwtService keeps the test cheap.
  const verify = jest.fn(() => {
    if (throwOnVerify) {
      throw new Error('invalid signature');
    }
    return verifyResult;
  });
  return { verify } as unknown as JwtService;
}

const silentLogger: Logger = {
  log: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
  debug: jest.fn(),
  verbose: jest.fn(),
} as unknown as Logger;

const ORIGINAL_ENV = { ...process.env };

describe('JwtAuthGuard', () => {
  beforeEach(() => {
    process.env = { ...ORIGINAL_ENV, JWT_SECRET: 'test-secret' };
    jest.clearAllMocks();
  });

  afterAll(() => {
    process.env = ORIGINAL_ENV;
  });

  describe('public route short-circuit', () => {
    it('returns true without verifying when @Public() is set', async () => {
      const { ctx } = buildContext({ isPublic: true });
      const jwt = buildJwtService({});
      const guard = new JwtAuthGuard(jwt, silentLogger, buildReflector(true));

      await expect(guard.canActivate(ctx)).resolves.toBe(true);
      expect((jwt as unknown as { verify: jest.Mock }).verify).not.toHaveBeenCalled();
    });
  });

  describe('header parsing', () => {
    it('rejects when the Authorization header is missing', async () => {
      const { ctx } = buildContext({ authHeader: undefined });
      const guard = new JwtAuthGuard(buildJwtService({}), silentLogger, buildReflector(false));

      await expect(guard.canActivate(ctx)).rejects.toBeInstanceOf(UnauthorizedException);
    });

    it('rejects when the Authorization header does not start with Bearer', async () => {
      const { ctx } = buildContext({ authHeader: 'Basic abc' });
      const guard = new JwtAuthGuard(buildJwtService({}), silentLogger, buildReflector(false));

      await expect(guard.canActivate(ctx)).rejects.toBeInstanceOf(UnauthorizedException);
    });
  });

  describe('F016: audience + issuer validation', () => {
    it('passes audience and issuer verify options to jwtService.verify', async () => {
      const { ctx } = buildContext({ authHeader: 'Bearer abc.def.ghi' });
      const jwt = buildJwtService({ sub: 'u-1', roles: ['user'] });
      process.env['JWT_AUDIENCE'] = 'hubblewave-instance';
      process.env['JWT_ISSUER'] = 'hubblewave-identity';

      const guard = new JwtAuthGuard(jwt, silentLogger, buildReflector(false));
      await guard.canActivate(ctx);

      expect((jwt as unknown as { verify: jest.Mock }).verify).toHaveBeenCalledWith(
        'abc.def.ghi',
        expect.objectContaining({
          secret: 'test-secret',
          audience: 'hubblewave-instance',
          issuer: 'hubblewave-identity',
          clockTolerance: 30,
        }),
      );
    });

    it('rejects a token whose verify throws (wrong audience / issuer / signature)', async () => {
      const { ctx } = buildContext({ authHeader: 'Bearer bad.token' });
      const jwt = buildJwtService(null, /* throwOnVerify */ true);
      const guard = new JwtAuthGuard(jwt, silentLogger, buildReflector(false));

      await expect(guard.canActivate(ctx)).rejects.toBeInstanceOf(UnauthorizedException);
    });

    it('falls back to canonical defaults when JWT_AUDIENCE / JWT_ISSUER are unset', async () => {
      delete process.env['JWT_AUDIENCE'];
      delete process.env['JWT_ISSUER'];

      const { ctx } = buildContext({ authHeader: 'Bearer abc' });
      const jwt = buildJwtService({ sub: 'u-1', roles: ['user'] });
      const guard = new JwtAuthGuard(jwt, silentLogger, buildReflector(false));

      await guard.canActivate(ctx);
      expect((jwt as unknown as { verify: jest.Mock }).verify).toHaveBeenCalledWith(
        'abc',
        expect.objectContaining({
          audience: 'hubblewave-instance',
          issuer: 'hubblewave-identity',
        }),
      );
    });
  });

  describe('F013: fresh identity resolution via IdentityResolverPort', () => {
    it('uses the resolver port output for roles/permissions/isAdmin, not the JWT payload', async () => {
      const { ctx, request } = buildContext({ authHeader: 'Bearer t' });
      // JWT carries stale claims — "manager" no longer applies to this
      // user. The fresh DB state lists only "user".
      const jwt = buildJwtService({
        sub: 'u-1',
        roles: ['manager'],
        permissions: ['records.delete'],
        is_admin: false,
      });
      const resolver: IdentityResolverPort = {
        resolveIdentity: jest.fn().mockResolvedValue({
          userId: 'u-1',
          roles: ['user'],
          permissions: ['records.read'],
          isAdmin: false,
          status: 'active',
        }),
      };
      const guard = new JwtAuthGuard(jwt, silentLogger, buildReflector(false), resolver);

      await expect(guard.canActivate(ctx)).resolves.toBe(true);
      expect(resolver.resolveIdentity).toHaveBeenCalledWith('u-1');
      const userCtx = request['user'] as { roles: string[]; permissions: string[]; isAdmin: boolean };
      expect(userCtx.roles).toEqual(['user']);
      expect(userCtx.permissions).toEqual(['records.read']);
      expect(userCtx.isAdmin).toBe(false);
    });

    it('rejects when the resolver port returns null (user deleted since token was issued)', async () => {
      const { ctx } = buildContext({ authHeader: 'Bearer t' });
      const jwt = buildJwtService({ sub: 'ghost', roles: ['user'] });
      const resolver: IdentityResolverPort = {
        resolveIdentity: jest.fn().mockResolvedValue(null),
      };
      const guard = new JwtAuthGuard(jwt, silentLogger, buildReflector(false), resolver);

      await expect(guard.canActivate(ctx)).rejects.toMatchObject({
        message: 'User not found',
      });
    });

    it('rejects when the resolver port reports a non-active status', async () => {
      const { ctx } = buildContext({ authHeader: 'Bearer t' });
      const jwt = buildJwtService({ sub: 'u-1', roles: ['user'] });
      const resolver: IdentityResolverPort = {
        resolveIdentity: jest.fn().mockResolvedValue({
          userId: 'u-1',
          roles: ['user'],
          permissions: [],
          isAdmin: false,
          status: 'suspended',
        }),
      };
      const guard = new JwtAuthGuard(jwt, silentLogger, buildReflector(false), resolver);

      await expect(guard.canActivate(ctx)).rejects.toMatchObject({
        message: 'User is inactive',
      });
    });

    it('falls back to JWT payload when no resolver port is bound (backward compat for test fixtures)', async () => {
      const { ctx, request } = buildContext({ authHeader: 'Bearer t' });
      const jwt = buildJwtService({
        sub: 'u-1',
        roles: ['admin'],
        permissions: ['perm.a'],
        is_admin: true,
      });
      const guard = new JwtAuthGuard(jwt, silentLogger, buildReflector(false));

      await expect(guard.canActivate(ctx)).resolves.toBe(true);
      const userCtx = request['user'] as { roles: string[]; permissions: string[]; isAdmin: boolean };
      expect(userCtx.roles).toEqual(['admin']);
      expect(userCtx.permissions).toEqual(['perm.a']);
      expect(userCtx.isAdmin).toBe(true);
    });
  });

  describe('F002: revocation via JwtRevocationPort', () => {
    it('rejects when the revocation port reports the session as revoked', async () => {
      const { ctx } = buildContext({ authHeader: 'Bearer t' });
      const jwt = buildJwtService({
        sub: 'u-1',
        roles: ['user'],
        session_id: 'sess-xyz',
        iat: 1700000000,
      });
      const resolver: IdentityResolverPort = {
        resolveIdentity: jest.fn().mockResolvedValue({
          userId: 'u-1',
          roles: ['user'],
          permissions: [],
          isAdmin: false,
          status: 'active',
        }),
      };
      const revocation: JwtRevocationPort = {
        isRevoked: jest.fn().mockResolvedValue(true),
      };
      const guard = new JwtAuthGuard(
        jwt,
        silentLogger,
        buildReflector(false),
        resolver,
        revocation,
      );

      await expect(guard.canActivate(ctx)).rejects.toMatchObject({
        message: 'Token revoked',
      });
      expect(revocation.isRevoked).toHaveBeenCalledWith({
        userId: 'u-1',
        sessionId: 'sess-xyz',
        jti: undefined,
        iat: 1700000000,
      });
    });

    it('accepts when the revocation port reports the token as live', async () => {
      const { ctx, request } = buildContext({ authHeader: 'Bearer t' });
      const jwt = buildJwtService({
        sub: 'u-1',
        roles: ['user'],
        session_id: 'sess-live',
        iat: 1700000000,
      });
      const resolver: IdentityResolverPort = {
        resolveIdentity: jest.fn().mockResolvedValue({
          userId: 'u-1',
          roles: ['user'],
          permissions: [],
          isAdmin: false,
          status: 'active',
        }),
      };
      const revocation: JwtRevocationPort = {
        isRevoked: jest.fn().mockResolvedValue(false),
      };
      const guard = new JwtAuthGuard(
        jwt,
        silentLogger,
        buildReflector(false),
        resolver,
        revocation,
      );

      await expect(guard.canActivate(ctx)).resolves.toBe(true);
      expect((request['user'] as { sessionId?: string }).sessionId).toBe('sess-live');
    });

    it('skips the revocation check entirely when no port is bound (backward compat)', async () => {
      const { ctx } = buildContext({ authHeader: 'Bearer t' });
      const jwt = buildJwtService({ sub: 'u-1', roles: ['user'] });
      // No resolver or revocation port — minimal fixture composition.
      const guard = new JwtAuthGuard(jwt, silentLogger, buildReflector(false));

      await expect(guard.canActivate(ctx)).resolves.toBe(true);
    });

    it('runs identity resolution before revocation so a deleted user reads as such (ordering)', async () => {
      const { ctx } = buildContext({ authHeader: 'Bearer t' });
      const jwt = buildJwtService({
        sub: 'ghost',
        roles: ['user'],
        session_id: 'sess-xyz',
      });
      const resolver: IdentityResolverPort = {
        resolveIdentity: jest.fn().mockResolvedValue(null),
      };
      const revocation: JwtRevocationPort = {
        isRevoked: jest.fn().mockResolvedValue(true),
      };
      const guard = new JwtAuthGuard(
        jwt,
        silentLogger,
        buildReflector(false),
        resolver,
        revocation,
      );

      await expect(guard.canActivate(ctx)).rejects.toMatchObject({
        message: 'User not found',
      });
      // Revocation must not be queried for a non-existent user — that
      // surface would otherwise leak a "user exists" signal.
      expect(revocation.isRevoked).not.toHaveBeenCalled();
    });
  });

  describe('payload sanity', () => {
    it('rejects an empty sub claim', async () => {
      const { ctx } = buildContext({ authHeader: 'Bearer t' });
      const jwt = buildJwtService({ sub: '', roles: [] });
      const guard = new JwtAuthGuard(jwt, silentLogger, buildReflector(false));

      await expect(guard.canActivate(ctx)).rejects.toMatchObject({
        message: 'Invalid token',
      });
    });
  });
});
