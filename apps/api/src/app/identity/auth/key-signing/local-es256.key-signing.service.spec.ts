import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { jwtVerify, importSPKI } from 'jose';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { KeyMetadata } from '@hubblewave/instance-db';
import { LocalEs256KeySigningService } from './local-es256.key-signing.service';

/**
 * In-memory KeyMetadata "repository" — implements just the surface the
 * service touches. Avoids a real Postgres in unit tests; the migration
 * itself is covered by instance-db's separate test suite.
 *
 * Behaviour notes:
 *   - `findOne({ where: { state: 'active' } })` returns the first row
 *     whose state matches, mirroring the partial-unique-index "one
 *     active" invariant.
 *   - The fake `manager.transaction` invokes the callback with a tx
 *     object whose `save()` writes directly to the rows array — good
 *     enough for unit tests that don't exercise rollback semantics.
 */
function makeInMemoryRepo(): {
  repo: any;
  rows: KeyMetadata[];
} {
  const rows: KeyMetadata[] = [];
  const repo: any = {
    rows,
    async findOne({ where }: { where: Partial<KeyMetadata> }) {
      return (
        rows.find((r) =>
          Object.entries(where).every(([k, v]) => (r as any)[k] === v),
        ) ?? null
      );
    },
    async find({ where }: { where: Partial<KeyMetadata> }) {
      return rows.filter((r) =>
        Object.entries(where).every(([k, v]) => (r as any)[k] === v),
      );
    },
    create(_entity: typeof KeyMetadata, partial: Partial<KeyMetadata>) {
      return Object.assign(new KeyMetadata(), partial);
    },
    createQueryBuilder() {
      let stateFilter: string[] = [];
      const builder: any = {
        where(clause: string, params: { states: string[] }) {
          if (clause.includes('IN')) stateFilter = params.states;
          return builder;
        },
        orderBy() {
          return builder;
        },
        async getMany() {
          return rows.filter((r) => stateFilter.includes(r.state));
        },
      };
      return builder;
    },
    manager: {
      async transaction(fn: (tx: any) => Promise<void>) {
        const tx = {
          create(_entity: typeof KeyMetadata, partial: Partial<KeyMetadata>) {
            return Object.assign(new KeyMetadata(), partial);
          },
          async save(row: KeyMetadata) {
            const existing = rows.find((r) => r.kid === row.kid);
            if (existing) {
              Object.assign(existing, row);
            } else {
              rows.push(row);
            }
            return row;
          },
        };
        await fn(tx);
      },
    },
  };
  return { repo, rows };
}

async function buildService(
  repo: any,
  cwd: string,
): Promise<LocalEs256KeySigningService> {
  const moduleRef: TestingModule = await Test.createTestingModule({
    providers: [
      LocalEs256KeySigningService,
      { provide: getRepositoryToken(KeyMetadata), useValue: repo },
    ],
  }).compile();
  // We don't call moduleRef.init() because we want to control bootstrap
  // ordering manually (some tests need to plant a row first).
  const svc = moduleRef.get(LocalEs256KeySigningService);
  // Override cwd so .dev/keys/ goes into the per-test tmp directory.
  // The override stays in place for the rest of the test (afterEach
  // restores process.cwd via cwdGuard.restore).
  cwdGuard.override(cwd);
  await svc.onModuleInit();
  return svc;
}

/**
 * Test-scoped process.cwd override. Each test that needs the override
 * calls `.override(dir)`; `afterEach` restores it.
 */
const cwdGuard = (() => {
  let original: typeof process.cwd | null = null;
  return {
    override(dir: string) {
      if (original === null) original = process.cwd;
      process.cwd = () => dir;
    },
    restore() {
      if (original) {
        process.cwd = original;
        original = null;
      }
    },
  };
})();

describe('LocalEs256KeySigningService', () => {
  let tmpDir: string;
  let originalEnv: string | undefined;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'hw-keys-test-'));
    originalEnv = process.env['NODE_ENV'];
    process.env['NODE_ENV'] = 'test';
  });

  afterEach(() => {
    if (originalEnv === undefined) {
      delete process.env['NODE_ENV'];
    } else {
      process.env['NODE_ENV'] = originalEnv;
    }
    cwdGuard.restore();
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('mints an initial active key when none exists and creates .dev/keys file', async () => {
    const { repo, rows } = makeInMemoryRepo();
    const svc = await buildService(repo, tmpDir);

    expect(rows.length).toBe(1);
    expect(rows[0].state).toBe('active');
    expect(rows[0].provider).toBe('local-es256');
    expect(rows[0].kid).toMatch(/^hwk_\d{4}_\d{2}_\d{2}_[0-9a-f]{8}$/);

    const filePath = path.join(tmpDir, '.dev', 'keys', `${rows[0].kid}.pem`);
    expect(fs.existsSync(filePath)).toBe(true);

    // sign() should produce a valid 3-segment JWS.
    const jws = await svc.sign({ sub: 'user:1', aud: 'test', exp: 9999999999 });
    expect(jws.split('.').length).toBe(3);
  });

  it('round-trips: sign() output verifies against getPublicJwk() public key', async () => {
    const { repo, rows } = makeInMemoryRepo();
    const svc = await buildService(repo, tmpDir);

    const jws = await svc.sign({ sub: 'user:1', aud: 'test', iss: 'hw' });
    const jwk = await svc.getPublicJwk(rows[0].kid);
    // Reconstruct an SPKI from the JWK via importSPKI is not possible
    // (no SPKI-from-JWK helper); use jwtVerify with the JWK via
    // jose.importJWK. Cast to a structural-record because jose's JWK
    // type allows arbitrary string keys while ours is narrower.
    const { importJWK } = await import('jose');
    const key = await importJWK({ ...jwk } as Record<string, unknown> as any, 'ES256');
    const { payload, protectedHeader } = await jwtVerify(jws, key);
    expect(protectedHeader.alg).toBe('ES256');
    expect(protectedHeader.kid).toBe(rows[0].kid);
    expect(payload.sub).toBe('user:1');
  });

  it('getPublicJwk returns canon-shape JWK (kty/crv/kid/use/alg)', async () => {
    const { repo, rows } = makeInMemoryRepo();
    const svc = await buildService(repo, tmpDir);
    const jwk = await svc.getPublicJwk(rows[0].kid);
    expect(jwk.kty).toBe('EC');
    expect(jwk.crv).toBe('P-256');
    expect(jwk.use).toBe('sig');
    expect(jwk.alg).toBe('ES256');
    expect(jwk.kid).toBe(rows[0].kid);
    expect(jwk.x).toBeTruthy();
    expect(jwk.y).toBeTruthy();
  });

  it('rotateKey() creates new active and demotes previous to retiring', async () => {
    const { repo, rows } = makeInMemoryRepo();
    const svc = await buildService(repo, tmpDir);
    const initialKid = rows[0].kid;

    const rotated = await svc.rotateKey();
    expect(rotated.state).toBe('active');
    expect(rotated.kid).not.toBe(initialKid);

    const previous = rows.find((r) => r.kid === initialKid);
    expect(previous?.state).toBe('retiring');
    expect(previous?.retiringAt).toBeInstanceOf(Date);

    // Exactly one active.
    expect(rows.filter((r) => r.state === 'active').length).toBe(1);
  });

  it('getVerifyingKeys returns active + retiring; excludes retired/pending/compromised', async () => {
    const { repo, rows } = makeInMemoryRepo();
    const svc = await buildService(repo, tmpDir);

    // Plant rows: one pending, one retired, one compromised. Plus the
    // bootstrapped active.
    rows.push(
      Object.assign(new KeyMetadata(), {
        kid: 'hwk_2025_01_01_aaaaaaaa',
        provider: 'local-es256',
        algorithm: 'ES256',
        state: 'retired',
        publicKeyPem: '---',
        createdAt: new Date(),
      }),
      Object.assign(new KeyMetadata(), {
        kid: 'hwk_2025_01_02_bbbbbbbb',
        provider: 'local-es256',
        algorithm: 'ES256',
        state: 'pending',
        publicKeyPem: '---',
        createdAt: new Date(),
      }),
      Object.assign(new KeyMetadata(), {
        kid: 'hwk_2025_01_03_cccccccc',
        provider: 'local-es256',
        algorithm: 'ES256',
        state: 'compromised',
        publicKeyPem: '---',
        createdAt: new Date(),
      }),
    );

    await svc.rotateKey();

    const verifying = await svc.getVerifyingKeys();
    const states = verifying.map((k) => k.state).sort();
    expect(states).toEqual(['active', 'retiring']);
  });

  it('throws when getPublicJwk is called for a compromised kid', async () => {
    const { repo, rows } = makeInMemoryRepo();
    const svc = await buildService(repo, tmpDir);
    rows.push(
      Object.assign(new KeyMetadata(), {
        kid: 'hwk_2025_01_03_cccccccc',
        provider: 'local-es256',
        algorithm: 'ES256',
        state: 'compromised',
        publicKeyPem: '---',
        createdAt: new Date(),
      }),
    );
    await expect(svc.getPublicJwk('hwk_2025_01_03_cccccccc')).rejects.toThrow(
      /compromised/,
    );
  });

  it('refuses to start if existing .dev/keys file is group/other-readable (POSIX only)', async () => {
    if (process.platform === 'win32') {
      // The provider deliberately skips the POSIX-mode check on Windows
      // (see assertFilePermissions docstring). Cover the skip in a
      // separate assertion rather than failing on Windows.
      return;
    }
    const { repo, rows } = makeInMemoryRepo();
    // First bootstrap to create a real file.
    await buildService(repo, tmpDir);
    const kid = rows[0].kid;
    const filePath = path.join(tmpDir, '.dev', 'keys', `${kid}.pem`);

    // Now corrupt the mode and re-construct the service.
    fs.chmodSync(filePath, 0o644);

    // Build a fresh service against the same repo + dir.
    const moduleRef = await Test.createTestingModule({
      providers: [
        LocalEs256KeySigningService,
        { provide: getRepositoryToken(KeyMetadata), useValue: repo },
      ],
    }).compile();
    const fresh = moduleRef.get(LocalEs256KeySigningService);
    // cwd is still pointed at tmpDir from buildService(). The provider
    // re-checks all file permissions on bootstrap.
    await expect(fresh.onModuleInit()).rejects.toThrow(/group\/other readable/);
  });

  it('refuses to start when active key has provider mismatch', async () => {
    const { repo, rows } = makeInMemoryRepo();

    // Plant an aws-kms active row before bootstrap fires.
    rows.push(
      Object.assign(new KeyMetadata(), {
        kid: 'hwk_2025_01_01_dddddddd',
        provider: 'aws-kms',
        algorithm: 'ES256',
        state: 'active',
        publicKeyPem: '-----BEGIN PUBLIC KEY-----\nfake\n-----END PUBLIC KEY-----',
        createdAt: new Date(),
        activatedAt: new Date(),
      }),
    );

    const moduleRef = await Test.createTestingModule({
      providers: [
        LocalEs256KeySigningService,
        { provide: getRepositoryToken(KeyMetadata), useValue: repo },
      ],
    }).compile();
    const svc = moduleRef.get(LocalEs256KeySigningService);
    cwdGuard.override(tmpDir);
    await expect(svc.onModuleInit()).rejects.toThrow(
      /Environment mismatch|aws-kms/,
    );
  });

  it('refuses to start in production (NODE_ENV=production)', async () => {
    const { repo } = makeInMemoryRepo();
    process.env['NODE_ENV'] = 'production';

    const moduleRef = await Test.createTestingModule({
      providers: [
        LocalEs256KeySigningService,
        { provide: getRepositoryToken(KeyMetadata), useValue: repo },
      ],
    }).compile();
    const svc = moduleRef.get(LocalEs256KeySigningService);
    cwdGuard.override(tmpDir);
    await expect(svc.onModuleInit()).rejects.toThrow(/production/);
  });

  it('emits a valid ES256 signed JWT verifiable with importSPKI', async () => {
    const { repo, rows } = makeInMemoryRepo();
    const svc = await buildService(repo, tmpDir);
    const jws = await svc.sign({ sub: 'user:1' });
    const publicKey = await importSPKI(rows[0].publicKeyPem, 'ES256');
    const { protectedHeader } = await jwtVerify(jws, publicKey);
    expect(protectedHeader.alg).toBe('ES256');
    expect(protectedHeader.typ).toBe('JWT');
  });
});
