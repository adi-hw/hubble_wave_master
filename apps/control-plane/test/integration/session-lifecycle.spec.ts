/**
 * W2 Stream 1 PR5 — control-plane session lifecycle verification.
 *
 * The control-plane runs its own refresh-token rotation flow in
 * `apps/control-plane/src/app/auth/auth.service.ts` against
 * `public.refresh_tokens` (NOT `identity.refresh_tokens` — the control
 * plane has no `identity` schema; see canon §18). The control-plane
 * implementation predates `TokenIssuerService` and uses a simpler
 * single-row rotation model: each refresh row carries a `family`, a
 * `revoke_reason`, and a `replaced_by` pointer. Presenting an
 * already-revoked refresh token (in any family) triggers a wholesale
 * family revocation with `revoke_reason='reuse_detected'`.
 *
 * This file mirrors the F001 reuse-detection assertions from the
 * instance-plane spec but against the control-plane code path so both
 * planes' theft-detection invariants are independently proven against
 * a real Postgres.
 */

import { ConfigService } from '@nestjs/config';
import { UnauthorizedException } from '@nestjs/common';
import * as argon2 from 'argon2';
import { generateKeyPairSync, randomUUID } from 'crypto';
import { exportJWK, SignJWT } from 'jose';
import { DataSource } from 'typeorm';

import {
  ControlPlaneUser,
  RefreshToken,
  RevokedToken,
} from '@hubblewave/control-plane-db';
import type {
  KeySigningService,
  PublicJwk,
} from '@hubblewave/auth-guard';

import { AuthService } from '../../src/app/auth/auth.service';
import { createTestDataSource } from '../helpers/test-database';

async function buildKeySigner(
  kid = 'hwk_2026_05_16_cpsesln',
): Promise<KeySigningService> {
  const { privateKey, publicKey } = generateKeyPairSync('ec', {
    namedCurve: 'P-256',
  });
  const jwk = (await exportJWK(publicKey)) as Partial<PublicJwk>;
  const publicJwk: PublicJwk = {
    kty: 'EC',
    crv: 'P-256',
    x: jwk.x as string,
    y: jwk.y as string,
    kid,
    use: 'sig',
    alg: 'ES256',
  };
  return {
    sign: async (payload, header) =>
      new SignJWT(payload as Record<string, unknown>)
        .setProtectedHeader({
          alg: 'ES256',
          typ: header?.typ ?? 'JWT',
          kid,
        })
        .sign(privateKey),
    getPublicJwk: async () => publicJwk,
    rotateKey: jest.fn(),
    getActiveKey: async () => ({
      kid,
      provider: 'local-es256',
      kmsAlias: null,
      kmsArn: null,
      algorithm: 'ES256',
      state: 'active',
      publicKeyPem: '',
      instanceId: null,
      createdAt: new Date(),
      activatedAt: new Date(),
      retiringAt: null,
      retiredAt: null,
      compromisedAt: null,
    }),
    getVerifyingKeys: async () => [],
  };
}

function buildConfigService(): ConfigService {
  return {
    get: jest.fn(((_key: string) => undefined) as never),
  } as unknown as ConfigService;
}

describe('Control-plane session lifecycle integration (W2 Stream 1 PR5)', () => {
  let dataSource: DataSource;
  let cleanup: () => Promise<void>;
  let authService: AuthService;
  let user: ControlPlaneUser;
  const password = 'CorrectHorseBattery42!';

  beforeAll(async () => {
    const setup = await createTestDataSource({
      entities: [ControlPlaneUser, RefreshToken, RevokedToken],
    });
    dataSource = setup.dataSource;
    cleanup = setup.cleanup;

    const keySigning = await buildKeySigner();
    authService = new AuthService(
      dataSource.getRepository(ControlPlaneUser),
      dataSource.getRepository(RevokedToken),
      dataSource.getRepository(RefreshToken),
      keySigning,
      buildConfigService(),
    );

    // Seed a real control-plane user. The login flow uses
    // `validateUser` which hashes-and-compares — the seed row must
    // carry a valid Argon2id hash so the test exercises the production
    // login code path, not a back-door.
    const passwordHash = await argon2.hash(password, {
      type: argon2.argon2id,
      memoryCost: 65536,
      timeCost: 3,
      parallelism: 4,
      hashLength: 32,
    });
    user = await dataSource.getRepository(ControlPlaneUser).save({
      email: `cp-sess-${Date.now()}@hubblewave.local`,
      displayName: 'Session Lifecycle Tester',
      firstName: 'Session',
      lastName: 'Tester',
      passwordHash,
      role: 'admin',
      status: 'active',
      mfaEnabled: false,
      failedLoginAttempts: 0,
      passwordChangedAt: new Date(),
    });
  }, 60_000);

  afterAll(async () => {
    if (cleanup) await cleanup();
  });

  describe('F001 — refresh-token reuse detection (control plane)', () => {
    it('replays an already-rotated refresh token: family revoked, 401 raised', async () => {
      // Step 1: login mints an initial access+refresh pair. The
      // refresh row is recorded in public.refresh_tokens with a fresh
      // `family` UUID and `revoked_at IS NULL`.
      const loginResult = await authService.login(
        { email: user.email, password },
        '127.0.0.1',
        'Jest Test',
      );
      expect(loginResult.refreshToken).toBeTruthy();
      expect(loginResult.accessToken).toBeTruthy();

      const initialRefresh = loginResult.refreshToken;

      // Step 2: rotate the initial refresh token. Per the control-plane
      // implementation in `AuthService.refresh`, this revokes the
      // original row with `revoke_reason='rotated'`, links it to a
      // freshly-issued successor under the same family, and returns the
      // new access+refresh pair.
      const rotated = await authService.refresh(initialRefresh, {
        ipAddress: '127.0.0.1',
        userAgent: 'Jest Test',
      });
      expect(rotated.refreshToken).toBeTruthy();
      expect(rotated.refreshToken).not.toBe(initialRefresh);

      // Step 3: replay the original (now-revoked) refresh token. This is
      // the theft signal — the production code path revokes the entire
      // family with `revoke_reason='reuse_detected'` and raises a 401
      // with the canon-required reuse-detected message. We assert both.
      let caughtErr: unknown = null;
      try {
        await authService.refresh(initialRefresh, {
          ipAddress: '203.0.113.7',
          userAgent: 'curl/7.85',
        });
      } catch (err) {
        caughtErr = err;
      }
      expect(caughtErr).toBeInstanceOf(UnauthorizedException);
      // Control-plane message differs from the instance-plane bland
      // message — the control-plane is an admin-only surface where
      // making the theft signal explicit in the response body is the
      // accepted trade-off (operators must see this). See
      // `apps/control-plane/src/app/auth/auth.service.ts:309`.
      expect((caughtErr as Error).message).toMatch(/reuse/i);

      // Step 4: every row in the family is now revoked with the
      // canonical 'reuse_detected' reason. This is the integrity check
      // that proves the theft-response actually killed the session
      // server-side; the response status is a cooperating signal but
      // not the source of truth.
      const familyRows = await dataSource.getRepository(RefreshToken).find({
        where: { userId: user.id },
        order: { issuedAt: 'ASC' },
      });
      expect(familyRows.length).toBeGreaterThanOrEqual(2);

      // The rotated successor MUST also be revoked under reuse_detected
      // — replays must invalidate descendants. The original row's
      // revoke reason is 'rotated' (set on the prior happy-path
      // rotation), but the family-wide revoke from reuse detection
      // updates only rows where `revoked_at IS NULL` — that is the
      // successor.
      const successorRow = familyRows.find(
        (r) => r.tokenHash !== familyRows[0].tokenHash,
      );
      expect(successorRow?.revokedAt).toBeInstanceOf(Date);
      expect(successorRow?.revokeReason).toBe('reuse_detected');

      // Step 5: subsequent rotate attempts against any token in the
      // killed family must continue to fail. We try the successor
      // (which is now revoked) and expect the bland "invalid" path —
      // the canonical 401 surface for a revoked refresh token in the
      // control-plane implementation.
      await expect(
        authService.refresh(rotated.refreshToken, {
          ipAddress: '127.0.0.1',
          userAgent: 'Jest Test',
        }),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('rotate with an unknown refresh token: 401 with no family side effects', async () => {
      const beforeFamilies = await dataSource
        .getRepository(RefreshToken)
        .count();

      await expect(
        authService.refresh('never-existed-' + randomUUID(), {
          ipAddress: '127.0.0.1',
          userAgent: 'Jest Test',
        }),
      ).rejects.toThrow(UnauthorizedException);

      // No new rows; no row mutations. Unknown tokens are a probe and
      // must not be loud — same posture as the instance plane.
      const afterFamilies = await dataSource
        .getRepository(RefreshToken)
        .count();
      expect(afterFamilies).toBe(beforeFamilies);
    });
  });
});
