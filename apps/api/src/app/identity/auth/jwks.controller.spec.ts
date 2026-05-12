import { Test } from '@nestjs/testing';
import {
  KEY_SIGNING_SERVICE,
  KeyMetadataView,
  KeySigningService,
  PublicJwk,
} from '@hubblewave/auth-guard';
import { JwksController } from './jwks.controller';

/**
 * The JWKS controller is a thin renderer over the KeySigningService —
 * its only logic is "list verifying keys, ask the signing service for
 * each JWK, return them in a `{ keys: [...] }` envelope". Tests focus
 * on the rendering contract; the underlying state-filtering is a
 * property of the signing service's `getVerifyingKeys` (covered there).
 */

function row(
  kid: string,
  state: KeyMetadataView['state'],
): KeyMetadataView {
  return {
    kid,
    provider: 'local-es256',
    algorithm: 'ES256',
    state,
    publicKeyPem: '---',
    createdAt: new Date(),
    activatedAt: null,
    retiringAt: null,
    retiredAt: null,
    compromisedAt: null,
    instanceId: null,
    kmsAlias: null,
    kmsArn: null,
  };
}

function jwk(kid: string): PublicJwk {
  return {
    kty: 'EC',
    crv: 'P-256',
    x: 'fakeX' + kid,
    y: 'fakeY' + kid,
    kid,
    use: 'sig',
    alg: 'ES256',
  };
}

describe('JwksController', () => {
  it('returns active + retiring keys in a { keys: [...] } envelope', async () => {
    const fakeService: KeySigningService = {
      async sign() {
        return '';
      },
      async getPublicJwk(kid: string) {
        return jwk(kid);
      },
      async rotateKey() {
        throw new Error('unused');
      },
      async getActiveKey() {
        return row('hwk_2026_05_11_aaaaaaaa', 'active');
      },
      async getVerifyingKeys() {
        return [
          row('hwk_2026_05_11_aaaaaaaa', 'active'),
          row('hwk_2026_05_01_bbbbbbbb', 'retiring'),
        ];
      },
    };

    const moduleRef = await Test.createTestingModule({
      controllers: [JwksController],
      providers: [{ provide: KEY_SIGNING_SERVICE, useValue: fakeService }],
    }).compile();
    const controller = moduleRef.get(JwksController);
    const result = await controller.getJwks();
    expect(result.keys).toHaveLength(2);
    expect(result.keys.map((k) => k.kid).sort()).toEqual([
      'hwk_2026_05_01_bbbbbbbb',
      'hwk_2026_05_11_aaaaaaaa',
    ]);
  });

  it('returns an empty list when no verifying keys exist (no active yet, edge case)', async () => {
    const fakeService: KeySigningService = {
      async sign() {
        return '';
      },
      async getPublicJwk() {
        throw new Error('unused');
      },
      async rotateKey() {
        throw new Error('unused');
      },
      async getActiveKey() {
        throw new Error('unused');
      },
      async getVerifyingKeys() {
        return [];
      },
    };

    const moduleRef = await Test.createTestingModule({
      controllers: [JwksController],
      providers: [{ provide: KEY_SIGNING_SERVICE, useValue: fakeService }],
    }).compile();
    const controller = moduleRef.get(JwksController);
    const result = await controller.getJwks();
    expect(result.keys).toEqual([]);
  });

  it('only requests JWKs for keys returned by getVerifyingKeys (does not leak retired/pending)', async () => {
    const getPublicJwk = jest.fn(async (kid: string) => jwk(kid));
    const fakeService: KeySigningService = {
      async sign() {
        return '';
      },
      getPublicJwk,
      async rotateKey() {
        throw new Error('unused');
      },
      async getActiveKey() {
        return row('hwk_2026_05_11_aaaaaaaa', 'active');
      },
      async getVerifyingKeys() {
        // Service contract guarantees only active + retiring here.
        return [row('hwk_2026_05_11_aaaaaaaa', 'active')];
      },
    };

    const moduleRef = await Test.createTestingModule({
      controllers: [JwksController],
      providers: [{ provide: KEY_SIGNING_SERVICE, useValue: fakeService }],
    }).compile();
    const controller = moduleRef.get(JwksController);
    const result = await controller.getJwks();
    expect(getPublicJwk).toHaveBeenCalledTimes(1);
    expect(getPublicJwk).toHaveBeenCalledWith('hwk_2026_05_11_aaaaaaaa');
    expect(result.keys[0].kid).toBe('hwk_2026_05_11_aaaaaaaa');
  });

  it('shape conforms to RFC 7517 — every entry has kty/crv/x/y/kid/use/alg', async () => {
    const fakeService: KeySigningService = {
      async sign() {
        return '';
      },
      async getPublicJwk(kid: string) {
        return jwk(kid);
      },
      async rotateKey() {
        throw new Error('unused');
      },
      async getActiveKey() {
        return row('hwk_2026_05_11_aaaaaaaa', 'active');
      },
      async getVerifyingKeys() {
        return [row('hwk_2026_05_11_aaaaaaaa', 'active')];
      },
    };

    const moduleRef = await Test.createTestingModule({
      controllers: [JwksController],
      providers: [{ provide: KEY_SIGNING_SERVICE, useValue: fakeService }],
    }).compile();
    const controller = moduleRef.get(JwksController);
    const result = await controller.getJwks();
    const k = result.keys[0];
    expect(k.kty).toBe('EC');
    expect(k.crv).toBe('P-256');
    expect(k.use).toBe('sig');
    expect(k.alg).toBe('ES256');
    expect(k.kid).toBe('hwk_2026_05_11_aaaaaaaa');
    expect(k.x).toBeTruthy();
    expect(k.y).toBeTruthy();
  });
});
