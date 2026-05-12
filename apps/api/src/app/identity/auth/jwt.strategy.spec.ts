import { UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Repository } from 'typeorm';
import { User } from '@hubblewave/instance-db';
import { KeySigningService, PublicJwk } from '@hubblewave/auth-guard';
import { JwtPayload } from '@hubblewave/shared-types';
import { JwtStrategy } from './jwt.strategy';
import { PermissionResolverService } from '../roles/permission-resolver.service';

/**
 * Coverage for the canon §29.6 token-version check + canon §29.3 issuer
 * prefix check in `JwtStrategy.validate()`. The passport
 * `secretOrKeyProvider` callback is exercised separately by integration
 * tests; here we focus on the post-signature-verification gates.
 */

function buildUserRepo(user: Partial<User> | null) {
  return {
    findOne: jest.fn(async () => user),
  } as unknown as Repository<User>;
}

function buildPermResolver(roleCodes: string[], permissions: string[]) {
  return {
    getUserPermissions: jest.fn(async () => ({
      userId: 'u-1',
      permissions: new Set(permissions),
      permissionDetails: new Map(),
      roleIds: [],
      roles: roleCodes.map((code) => ({ code }) as { code: string }),
      computedAt: new Date(),
      expiresAt: new Date(),
    })),
  } as unknown as PermissionResolverService;
}

function buildKeySigning(): KeySigningService {
  return {
    sign: jest.fn(),
    getPublicJwk: jest.fn(async () => ({}) as PublicJwk),
    rotateKey: jest.fn(),
    getActiveKey: jest.fn(),
    getVerifyingKeys: jest.fn(),
  };
}

function buildConfig(overrides: Record<string, unknown> = {}): ConfigService {
  const values: Record<string, unknown> = {
    JWT_AUDIENCE: 'hubblewave-instance',
    ...overrides,
  };
  return {
    get: jest.fn((key: string) => values[key]),
  } as unknown as ConfigService;
}

/**
 * Build a JwtStrategy without invoking the passport constructor's
 * secretOrKeyProvider logic. We swap out the constructor for direct
 * construction of `validate()`-only behavior by inspecting the
 * downstream effects.
 *
 * Strategy: invoke `validate(payload)` directly with the synthetic
 * payload, which is what passport-jwt does after the
 * secretOrKeyProvider succeeds.
 */
function buildStrategy(
  user: Partial<User> | null,
  roleCodes: string[] = [],
  permissions: string[] = [],
): JwtStrategy {
  const config = buildConfig();
  const repo = buildUserRepo(user);
  const perms = buildPermResolver(roleCodes, permissions);
  const keySigning = buildKeySigning();
  return new JwtStrategy(config, repo, perms, keySigning);
}

describe('JwtStrategy (canon §29 PR-B)', () => {
  describe('canon §29.3 — issuer prefix check', () => {
    it('rejects when iss does not start with hubblewave-', async () => {
      const strategy = buildStrategy({
        id: 'u-1',
        status: 'active',
        securityStamp: 'stamp-1',
      } as Partial<User>);
      const payload: JwtPayload = {
        sub: 'user:u-1',
        username: 'u',
        roles: [],
        permissions: [],
        iss: 'evil-issuer-x',
      };
      await expect(strategy.validate(payload)).rejects.toMatchObject({
        message: 'Invalid token issuer',
      });
    });

    it('accepts an iss with the hubblewave- prefix', async () => {
      const strategy = buildStrategy({
        id: 'u-1',
        status: 'active',
        securityStamp: 'stamp-1',
      } as Partial<User>, ['user']);
      const payload: JwtPayload = {
        sub: 'user:u-1',
        username: 'u',
        roles: [],
        permissions: [],
        iss: 'hubblewave-some-instance',
      };
      const result = await strategy.validate(payload);
      expect(result.userId).toBe('u-1');
    });
  });

  describe('sub claim parsing', () => {
    it('strips the "user:" prefix per canon §29.3', async () => {
      const strategy = buildStrategy({
        id: 'u-99',
        status: 'active',
        securityStamp: 'stamp',
      } as Partial<User>);
      const result = await strategy.validate({
        sub: 'user:u-99',
        username: 'u',
        roles: [],
        permissions: [],
        iss: 'hubblewave-inst',
      });
      expect(result.userId).toBe('u-99');
    });

    it('accepts a bare user id for fixtures that have not migrated', async () => {
      const strategy = buildStrategy({
        id: 'u-bare',
        status: 'active',
        securityStamp: 'stamp',
      } as Partial<User>);
      const result = await strategy.validate({
        sub: 'u-bare',
        username: 'u',
        roles: [],
        permissions: [],
        iss: 'hubblewave-inst',
      });
      expect(result.userId).toBe('u-bare');
    });
  });

  describe('user lifecycle', () => {
    it('rejects when the user does not exist', async () => {
      const strategy = buildStrategy(null);
      await expect(
        strategy.validate({
          sub: 'user:ghost',
          username: 'u',
          roles: [],
          permissions: [],
          iss: 'hubblewave-inst',
        }),
      ).rejects.toMatchObject({ message: 'User not found' });
    });

    it('rejects when the user is not active', async () => {
      const strategy = buildStrategy({
        id: 'u-1',
        status: 'suspended',
        securityStamp: 'stamp',
      } as Partial<User>);
      await expect(
        strategy.validate({
          sub: 'user:u-1',
          username: 'u',
          roles: [],
          permissions: [],
          iss: 'hubblewave-inst',
        }),
      ).rejects.toMatchObject({ message: 'User is inactive' });
    });
  });

  describe('canon §29.6 — token_version freshness', () => {
    it('rejects with "Token version stale" when token_version differs from securityStamp', async () => {
      const strategy = buildStrategy({
        id: 'u-1',
        status: 'active',
        securityStamp: 'stamp-NEW',
      } as Partial<User>);
      const payload = {
        sub: 'user:u-1',
        username: 'u',
        roles: [],
        permissions: [],
        iss: 'hubblewave-inst',
        token_version: 'stamp-OLD',
      } as JwtPayload & { token_version: string };
      await expect(strategy.validate(payload)).rejects.toMatchObject({
        message: 'Token version stale',
      });
    });

    it('accepts when token_version matches the live securityStamp', async () => {
      const strategy = buildStrategy(
        {
          id: 'u-1',
          status: 'active',
          securityStamp: 'stamp-MATCH',
        } as Partial<User>,
        ['user'],
        ['records.read'],
      );
      const payload = {
        sub: 'user:u-1',
        username: 'u',
        roles: [],
        permissions: [],
        iss: 'hubblewave-inst',
        token_version: 'stamp-MATCH',
      } as JwtPayload & { token_version: string };
      const result = await strategy.validate(payload);
      expect(result.userId).toBe('u-1');
      expect(result.roles).toEqual(['user']);
      expect(result.permissions).toEqual(['records.read']);
    });

    it('accepts when token_version is absent (fixtures that pre-date PR-B)', async () => {
      const strategy = buildStrategy(
        {
          id: 'u-1',
          status: 'active',
          securityStamp: 'stamp',
        } as Partial<User>,
        ['user'],
      );
      const result = await strategy.validate({
        sub: 'user:u-1',
        username: 'u',
        roles: [],
        permissions: [],
        iss: 'hubblewave-inst',
      });
      expect(result.userId).toBe('u-1');
    });
  });
});

// Reference so unused-import lint stays clean.
void UnauthorizedException;
