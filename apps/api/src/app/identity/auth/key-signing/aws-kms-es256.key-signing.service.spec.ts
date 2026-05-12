import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import {
  createSign,
  createPublicKey,
  generateKeyPairSync,
} from 'crypto';
import {
  CreateAliasCommand,
  CreateKeyCommand,
  DescribeKeyCommand,
  GetPublicKeyCommand,
  KMSClient,
  SignCommand,
} from '@aws-sdk/client-kms';
import { KeyMetadata } from '@hubblewave/instance-db';
import { AwsKmsEs256KeySigningService } from './aws-kms-es256.key-signing.service';

/**
 * The KMS provider is exercised against a fake KMSClient that returns
 * deterministic responses for CreateKeyCommand, CreateAliasCommand,
 * GetPublicKeyCommand, SignCommand, and DescribeKeyCommand. To make
 * `sign()` produce a verifiable signature we keep a real P-256 keypair
 * inside the fake client and sign with it locally.
 */
class FakeKmsClient {
  // Test scenarios populate this map keyed by KMS key id (== arn here).
  readonly keysByArn = new Map<
    string,
    { privateKey: ReturnType<typeof generateKeyPairSync>['privateKey']; spkiDer: Buffer; arn: string }
  >();
  readonly aliases = new Map<string, string>(); // alias -> arn
  readonly sendCalls: Array<{ name: string; input: Record<string, unknown> }> = [];
  private nextArnIdx = 1;

  async send(cmd: unknown): Promise<unknown> {
    const c = cmd as unknown as {
      constructor: { name: string };
      input?: Record<string, unknown>;
    };
    const input = (c.input ?? {}) as Record<string, unknown>;
    this.sendCalls.push({ name: c.constructor.name, input });

    if (cmd instanceof CreateKeyCommand) {
      const { privateKey, publicKey } = generateKeyPairSync('ec', {
        namedCurve: 'P-256',
      });
      const spkiDer = publicKey.export({ format: 'der', type: 'spki' }) as Buffer;
      const arn = `arn:aws:kms:us-east-1:111111111111:key/${this.nextArnIdx++}`;
      this.keysByArn.set(arn, { privateKey, spkiDer, arn });
      return { KeyMetadata: { Arn: arn, KeyId: arn } };
    }
    if (cmd instanceof CreateAliasCommand) {
      this.aliases.set(
        input['AliasName'] as string,
        input['TargetKeyId'] as string,
      );
      return {};
    }
    if (cmd instanceof GetPublicKeyCommand) {
      const k = this.keysByArn.get(input['KeyId'] as string);
      if (!k) throw new Error(`fake KMS: no key for ${input['KeyId']}`);
      return { PublicKey: new Uint8Array(k.spkiDer) };
    }
    if (cmd instanceof SignCommand) {
      const arn = (input['KeyId'] as string) ?? '';
      const k = this.keysByArn.get(arn);
      if (!k) throw new Error(`fake KMS: no key for ${arn}`);
      const message = input['Message'] as Buffer;
      const signer = createSign('SHA256');
      signer.update(message);
      signer.end();
      const der = signer.sign(k.privateKey);
      return { Signature: new Uint8Array(der) };
    }
    if (cmd instanceof DescribeKeyCommand) {
      const arn = input['KeyId'] as string;
      if (!this.keysByArn.has(arn) && !this.aliases.has(arn)) {
        throw new Error(`fake KMS: no key for ${arn}`);
      }
      return { KeyMetadata: { Arn: arn } };
    }
    throw new Error(`fake KMS: unhandled command ${c.constructor.name}`);
  }
}

function makeInMemoryRepo() {
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
    create(_e: typeof KeyMetadata, partial: Partial<KeyMetadata>) {
      return Object.assign(new KeyMetadata(), partial);
    },
    createQueryBuilder() {
      let stateFilter: string[] = [];
      const builder: any = {
        where(_c: string, params: { states: string[] }) {
          stateFilter = params.states;
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
          create(_e: typeof KeyMetadata, partial: Partial<KeyMetadata>) {
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
  kms: FakeKmsClient,
): Promise<AwsKmsEs256KeySigningService> {
  const moduleRef = await Test.createTestingModule({
    providers: [
      {
        provide: AwsKmsEs256KeySigningService,
        useFactory: () =>
          new AwsKmsEs256KeySigningService(repo, kms as unknown as KMSClient),
      },
      { provide: getRepositoryToken(KeyMetadata), useValue: repo },
    ],
  }).compile();
  const svc = moduleRef.get(AwsKmsEs256KeySigningService);
  await svc.onModuleInit();
  return svc;
}

describe('AwsKmsEs256KeySigningService', () => {
  let kms: FakeKmsClient;
  beforeEach(() => {
    kms = new FakeKmsClient();
  });

  it('rotateKey() calls CreateKey, CreateAlias, GetPublicKey in order', async () => {
    const { repo, rows } = makeInMemoryRepo();
    await buildService(repo, kms);

    const names = kms.sendCalls.map((c) => c.name);
    expect(names[0]).toBe('CreateKeyCommand');
    expect(names[1]).toBe('CreateAliasCommand');
    expect(names[2]).toBe('GetPublicKeyCommand');
    expect(rows.length).toBe(1);
    expect(rows[0].state).toBe('active');
    expect(rows[0].provider).toBe('aws-kms');
    expect(rows[0].kmsArn).toMatch(/^arn:aws:kms:/);
    expect(rows[0].kmsAlias).toContain(rows[0].kid);
  });

  it('CreateKeyCommand uses ECC_NIST_P256 / SIGN_VERIFY', async () => {
    const { repo } = makeInMemoryRepo();
    await buildService(repo, kms);
    const createKey = kms.sendCalls.find((c) => c.name === 'CreateKeyCommand')!;
    expect(createKey.input['KeySpec']).toBe('ECC_NIST_P256');
    expect(createKey.input['KeyUsage']).toBe('SIGN_VERIFY');
  });

  it('sign() calls KMS Sign with RAW message + ECDSA_SHA_256', async () => {
    const { repo, rows } = makeInMemoryRepo();
    const svc = await buildService(repo, kms);
    kms.sendCalls.length = 0; // reset to inspect sign-only

    const jws = await svc.sign({ sub: 'user:1' });
    expect(jws.split('.').length).toBe(3);

    const signCall = kms.sendCalls.find((c) => c.name === 'SignCommand')!;
    expect(signCall.input['SigningAlgorithm']).toBe('ECDSA_SHA_256');
    expect(signCall.input['MessageType']).toBe('RAW');
    expect(signCall.input['KeyId']).toBe(rows[0].kmsArn);
  });

  it('sign() output is verifiable with the SPKI public key stored at creation', async () => {
    const { repo, rows } = makeInMemoryRepo();
    const svc = await buildService(repo, kms);
    const jws = await svc.sign({ sub: 'user:1', iss: 'hw' });

    // Reconstruct the public key from SPKI PEM and verify.
    const publicKey = createPublicKey({ key: rows[0].publicKeyPem, format: 'pem' });
    const { jwtVerify, importJWK, exportJWK } = await import('jose');
    const jwk = (await exportJWK(publicKey)) as Record<string, unknown>;
    jwk['alg'] = 'ES256';
    const verifyingKey = await importJWK(jwk as any, 'ES256');
    const { protectedHeader, payload } = await jwtVerify(jws, verifyingKey);
    expect(protectedHeader.alg).toBe('ES256');
    expect(protectedHeader.kid).toBe(rows[0].kid);
    expect(payload.sub).toBe('user:1');
  });

  it('getPublicJwk converts SPKI DER to canon JWK', async () => {
    const { repo, rows } = makeInMemoryRepo();
    const svc = await buildService(repo, kms);
    const jwk = await svc.getPublicJwk(rows[0].kid);
    expect(jwk.kty).toBe('EC');
    expect(jwk.crv).toBe('P-256');
    expect(jwk.alg).toBe('ES256');
    expect(jwk.use).toBe('sig');
    expect(jwk.kid).toBe(rows[0].kid);
  });

  it('rotateKey demotes previous active to retiring and mints new active', async () => {
    const { repo, rows } = makeInMemoryRepo();
    const svc = await buildService(repo, kms);
    const firstKid = rows[0].kid;
    await svc.rotateKey();
    expect(rows.length).toBe(2);
    expect(rows.find((r) => r.kid === firstKid)?.state).toBe('retiring');
    expect(rows.filter((r) => r.state === 'active').length).toBe(1);
  });

  it('bootstrap with existing active key only calls DescribeKey (no CreateKey)', async () => {
    const { repo, rows } = makeInMemoryRepo();
    // First bootstrap to seed an active KMS key.
    await buildService(repo, kms);
    expect(rows[0].state).toBe('active');

    // Now construct a fresh service against the SAME kms + repo. It
    // should not re-create — it should DescribeKey.
    kms.sendCalls.length = 0;
    const second = new AwsKmsEs256KeySigningService(
      repo,
      kms as unknown as KMSClient,
    );
    await second.onModuleInit();

    const names = kms.sendCalls.map((c) => c.name);
    expect(names).toEqual(['DescribeKeyCommand']);
  });

  it('refuses to start when active key has provider=local-es256 (mismatch)', async () => {
    const { repo, rows } = makeInMemoryRepo();
    rows.push(
      Object.assign(new KeyMetadata(), {
        kid: 'hwk_2026_01_01_aaaaaaaa',
        provider: 'local-es256',
        algorithm: 'ES256',
        state: 'active',
        publicKeyPem: '---',
        createdAt: new Date(),
        activatedAt: new Date(),
      }),
    );

    const svc = new AwsKmsEs256KeySigningService(
      repo,
      kms as unknown as KMSClient,
    );
    await expect(svc.onModuleInit()).rejects.toThrow(
      /Environment mismatch|local-es256/,
    );
  });
});
