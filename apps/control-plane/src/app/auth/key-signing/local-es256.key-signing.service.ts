import {
  Injectable,
  Logger,
  NotFoundException,
  OnModuleInit,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  generateKeyPairSync,
  KeyObject,
  createPrivateKey,
  createPublicKey,
} from 'crypto';
import { promises as fsAsync, statSync, existsSync, mkdirSync } from 'fs';
import * as path from 'path';
import { SignJWT, importPKCS8, exportJWK } from 'jose';
import { KeyMetadata } from '@hubblewave/control-plane-db';
import {
  KeyMetadataView,
  KeySigningService,
  PublicJwk,
} from '@hubblewave/auth-guard';
import { generateKid } from '@hubblewave/auth-guard';

const LOCAL_KEY_DIR = '.dev/keys/control-plane';
const REQUIRED_FILE_MODE = 0o600;

/**
 * Canon §29.9 — control-plane `LocalEs256KeySigningService`.
 *
 * Mirrors `apps/api/src/app/identity/auth/key-signing/
 * local-es256.key-signing.service.ts` for the control plane:
 *   - Reads/writes `KeyMetadata` rows from the control-plane DB
 *     (`@hubblewave/control-plane-db`).
 *   - Persists private keys under `.dev/keys/control-plane/{kid}.pem`.
 *
 * Produces the SAME JWT format and `kid` lifecycle as the production
 * AWS KMS provider — only the custodian of the private key differs.
 */
@Injectable()
export class LocalEs256KeySigningService
  implements KeySigningService, OnModuleInit
{
  private readonly logger = new Logger('ControlPlaneLocalEs256KeySigningService');
  private readonly privateKeyByKid = new Map<string, KeyObject>();
  private readonly publicKeyByKid = new Map<string, KeyObject>();

  constructor(
    @InjectRepository(KeyMetadata)
    private readonly keyRepo: Repository<KeyMetadata>,
  ) {}

  async onModuleInit(): Promise<void> {
    this.assertNotProduction();
    await this.ensureKeyDir();
    await this.assertDirectoryPermissions();
    await this.bootstrap();
  }

  async sign(
    payload: Record<string, unknown>,
    header: { typ?: string } = {},
  ): Promise<string> {
    const active = await this.getActiveKey();
    const privateKey = this.privateKeyByKid.get(active.kid);
    if (!privateKey) {
      throw new Error(
        `ControlPlaneLocalEs256KeySigningService: no in-memory private key for active kid '${active.kid}'. ` +
          `Bootstrap did not complete or the active kid changed under us.`,
      );
    }

    const jws = await new SignJWT(payload)
      .setProtectedHeader({
        alg: 'ES256',
        typ: header.typ ?? 'JWT',
        kid: active.kid,
      })
      .sign(privateKey);
    return jws;
  }

  async getPublicJwk(kid: string): Promise<PublicJwk> {
    const row = await this.keyRepo.findOne({ where: { kid } });
    if (!row) {
      throw new NotFoundException(`Unknown kid: ${kid}`);
    }
    if (row.state !== 'active' && row.state !== 'retiring') {
      throw new NotFoundException(
        `kid ${kid} is in state '${row.state}'; only active/retiring keys are publishable`,
      );
    }
    const pub =
      this.publicKeyByKid.get(kid) ??
      createPublicKey({ key: row.publicKeyPem, format: 'pem' });
    this.publicKeyByKid.set(kid, pub);
    const jwk = (await exportJWK(pub)) as Partial<PublicJwk>;
    return {
      kty: 'EC',
      crv: 'P-256',
      x: jwk.x as string,
      y: jwk.y as string,
      kid,
      use: 'sig',
      alg: 'ES256',
    };
  }

  async rotateKey(): Promise<KeyMetadataView> {
    const previousActive = await this.keyRepo.findOne({
      where: { state: 'active' },
    });

    const now = new Date();
    const kid = generateKid(now);

    const { privateKeyPem, publicKeyPem, privateKeyObj, publicKeyObj } =
      this.mintKeypair();

    await this.persistKeyFile(kid, privateKeyPem);

    await this.keyRepo.manager.transaction(async (tx) => {
      if (previousActive) {
        previousActive.state = 'retiring';
        previousActive.retiringAt = now;
        await tx.save(previousActive);
      }
      const row = tx.create(KeyMetadata, {
        kid,
        provider: 'local-es256' as const,
        kmsAlias: null,
        kmsArn: null,
        algorithm: 'ES256' as const,
        state: 'active' as const,
        publicKeyPem,
        instanceId: null,
        createdAt: now,
        activatedAt: now,
      });
      await tx.save(row);
    });

    this.privateKeyByKid.set(kid, privateKeyObj);
    this.publicKeyByKid.set(kid, publicKeyObj);

    this.logger.log(
      `Rotated active local-es256 key: new kid='${kid}'${previousActive ? `, retired='${previousActive.kid}'` : ''}`,
    );

    return await this.getActiveKey();
  }

  async getActiveKey(): Promise<KeyMetadataView> {
    const row = await this.keyRepo.findOne({ where: { state: 'active' } });
    if (!row) {
      throw new Error(
        'ControlPlaneLocalEs256KeySigningService: no active key in key_metadata. ' +
          'Bootstrap should have created one — this indicates a DB-level inconsistency.',
      );
    }
    return this.toView(row);
  }

  async getVerifyingKeys(): Promise<KeyMetadataView[]> {
    const rows = await this.keyRepo
      .createQueryBuilder('k')
      .where('k.state IN (:...states)', { states: ['active', 'retiring'] })
      .orderBy('k.activated_at', 'DESC', 'NULLS LAST')
      .getMany();
    return rows.map((r) => this.toView(r));
  }

  private async bootstrap(): Promise<void> {
    const active = await this.keyRepo.findOne({ where: { state: 'active' } });

    if (!active) {
      this.logger.log('No active local-es256 key found; minting initial key');
      await this.rotateKey();
      return;
    }

    if (active.provider !== 'local-es256') {
      throw new Error(
        `ControlPlaneLocalEs256KeySigningService refusing to start: active key '${active.kid}' has provider='${active.provider}'. ` +
          `Environment mismatch — JWT_KEY_PROVIDER was changed without rotating keys.`,
      );
    }

    await this.loadExistingKey(active.kid);

    const retiring = await this.keyRepo.find({ where: { state: 'retiring' } });
    for (const k of retiring) {
      if (k.provider === 'local-es256') {
        try {
          await this.loadExistingKey(k.kid);
        } catch (err) {
          this.logger.warn(
            `Retiring kid '${k.kid}' disk file unavailable: ${(err as Error).message}. ` +
              `JWKS will still publish the cached public key.`,
          );
        }
      }
    }
  }

  private async loadExistingKey(kid: string): Promise<void> {
    const filePath = this.keyFilePath(kid);
    if (!existsSync(filePath)) {
      throw new Error(
        `ControlPlaneLocalEs256KeySigningService: active kid '${kid}' has no key file at '${filePath}'. ` +
          `Refusing to start. Either restore the file or rotate keys.`,
      );
    }
    this.assertFilePermissions(filePath);

    const pem = await fsAsync.readFile(filePath, 'utf8');
    const privateKey = (await importPKCS8(pem, 'ES256')) as KeyObject;
    this.privateKeyByKid.set(kid, privateKey);

    const publicKey = createPublicKey(privateKey);
    this.publicKeyByKid.set(kid, publicKey);
  }

  private mintKeypair(): {
    privateKeyPem: string;
    publicKeyPem: string;
    privateKeyObj: KeyObject;
    publicKeyObj: KeyObject;
  } {
    const { privateKey, publicKey } = generateKeyPairSync('ec', {
      namedCurve: 'P-256',
      privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
      publicKeyEncoding: { type: 'spki', format: 'pem' },
    });
    const privateKeyObj = createPrivateKey({ key: privateKey, format: 'pem' });
    const publicKeyObj = createPublicKey({ key: publicKey, format: 'pem' });
    return {
      privateKeyPem: privateKey,
      publicKeyPem: publicKey,
      privateKeyObj,
      publicKeyObj,
    };
  }

  private async persistKeyFile(kid: string, pem: string): Promise<void> {
    const filePath = this.keyFilePath(kid);
    const fd = await fsAsync.open(filePath, 'wx', REQUIRED_FILE_MODE);
    try {
      await fd.writeFile(pem, { encoding: 'utf8' });
    } finally {
      await fd.close();
    }
    await fsAsync.chmod(filePath, REQUIRED_FILE_MODE);
  }

  private keyFilePath(kid: string): string {
    return path.join(process.cwd(), LOCAL_KEY_DIR, `${kid}.pem`);
  }

  private async ensureKeyDir(): Promise<void> {
    const dir = path.join(process.cwd(), LOCAL_KEY_DIR);
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true, mode: 0o700 });
    }
  }

  private async assertDirectoryPermissions(): Promise<void> {
    const dir = path.join(process.cwd(), LOCAL_KEY_DIR);
    if (!existsSync(dir)) return;
    const entries = await fsAsync.readdir(dir);
    for (const name of entries) {
      const full = path.join(dir, name);
      this.assertFilePermissions(full);
    }
  }

  private assertFilePermissions(filePath: string): void {
    if (process.platform === 'win32') return;
    const st = statSync(filePath);
    const perms = st.mode & 0o777;
    if (perms & 0o077) {
      throw new Error(
        `ControlPlaneLocalEs256KeySigningService refusing to start: ${filePath} has mode 0${perms.toString(8)} ` +
          `(group/other readable). Required: 0600. ` +
          `Fix: chmod 600 ${filePath}`,
      );
    }
  }

  private assertNotProduction(): void {
    if (process.env['NODE_ENV'] === 'production') {
      throw new Error(
        'ControlPlaneLocalEs256KeySigningService refusing to start in production. ' +
          'Production requires aws-kms — see canon §29.9.',
      );
    }
  }

  private toView(row: KeyMetadata): KeyMetadataView {
    return {
      kid: row.kid,
      provider: row.provider,
      kmsAlias: row.kmsAlias ?? null,
      kmsArn: row.kmsArn ?? null,
      algorithm: row.algorithm,
      state: row.state,
      publicKeyPem: row.publicKeyPem,
      instanceId: row.instanceId ?? null,
      createdAt: row.createdAt,
      activatedAt: row.activatedAt ?? null,
      retiringAt: row.retiringAt ?? null,
      retiredAt: row.retiredAt ?? null,
      compromisedAt: row.compromisedAt ?? null,
    };
  }
}
