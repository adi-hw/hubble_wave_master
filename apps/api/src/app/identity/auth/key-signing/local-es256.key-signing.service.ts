import {
  Injectable,
  Logger,
  NotFoundException,
  OnModuleInit,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { generateKeyPairSync, KeyObject, createPrivateKey, createPublicKey } from 'crypto';
import { promises as fsAsync, statSync, existsSync, mkdirSync } from 'fs';
import * as path from 'path';
import { SignJWT, importPKCS8, exportJWK } from 'jose';
import { KeyMetadata } from '@hubblewave/instance-db';
import {
  KeyMetadataView,
  KeySigningService,
  PublicJwk,
} from '@hubblewave/auth-guard';
import { generateKid } from '@hubblewave/auth-guard';

/**
 * Directory where local ES256 private keys live. Gitignored. The provider
 * refuses to start if any file under here is group/other-readable.
 */
const LOCAL_KEY_DIR = '.dev/keys';

/**
 * Octal `0600` — owner read/write only. Required for every file in
 * `LOCAL_KEY_DIR`. Any deviation is treated as a misconfiguration severe
 * enough to refuse startup (per canon §29.9).
 */
const REQUIRED_FILE_MODE = 0o600;

/**
 * Canon §29.9 — `LocalEs256KeySigningService`.
 *
 * Non-production-only ES256 signing provider. Stores the private key on
 * disk under `.dev/keys/{kid}.pem` (mode 0600). Produces the SAME JWT
 * format, claims, and `kid` lifecycle as the production AWS KMS provider —
 * the only difference is the custodian of the private key (canon §29.9).
 *
 * On startup:
 *   1. If an active key exists in `key_metadata` (and its `provider` is
 *      `local-es256`), load the matching `.pem` file. Fail fast if the
 *      file is missing or has wrong permissions.
 *   2. If no active key exists, mint one (PKCS#8 PEM → disk + SPKI PEM
 *      cached in `key_metadata.public_key_pem` for fast JWKS reads).
 *   3. If an active key exists but its `provider` is `aws-kms`, throw —
 *      environment mismatch (someone tried to flip JWT_KEY_PROVIDER
 *      without rotating).
 *
 * The in-memory `keyObjectByKid` map holds the parsed `KeyObject` for each
 * known kid. Local-only private keys are already in our address space, so
 * holding the parsed handle is not a fresh exposure — it just avoids
 * re-parsing the PEM on every sign call.
 */
@Injectable()
export class LocalEs256KeySigningService
  implements KeySigningService, OnModuleInit
{
  private readonly logger = new Logger('LocalEs256KeySigningService');
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

  // ──────────────────────────────────────────────────────────────────────
  // KeySigningService surface
  // ──────────────────────────────────────────────────────────────────────

  async sign(
    payload: Record<string, unknown>,
    header: { typ?: string } = {},
  ): Promise<string> {
    const active = await this.getActiveKey();
    const privateKey = this.privateKeyByKid.get(active.kid);
    if (!privateKey) {
      throw new Error(
        `LocalEs256KeySigningService: no in-memory private key for active kid '${active.kid}'. ` +
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
    // Lookup current active (if any) BEFORE inserting new pending key.
    const previousActive = await this.keyRepo.findOne({
      where: { state: 'active' },
    });

    const now = new Date();
    const kid = generateKid(now);

    // Mint new keypair.
    const { privateKeyPem, publicKeyPem, privateKeyObj, publicKeyObj } =
      this.mintKeypair();

    await this.persistKeyFile(kid, privateKeyPem);

    // Demote previous active → retiring AND insert new active in a single
    // transaction so the partial-unique-index "exactly one active" rule
    // never sees a window with zero or two actives.
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
        'LocalEs256KeySigningService: no active key in key_metadata. ' +
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

  // ──────────────────────────────────────────────────────────────────────
  // Bootstrap / lifecycle helpers
  // ──────────────────────────────────────────────────────────────────────

  /**
   * If an active row exists, load it from disk + verify; otherwise mint
   * the first key. See class-level docstring for the three branches.
   */
  private async bootstrap(): Promise<void> {
    const active = await this.keyRepo.findOne({ where: { state: 'active' } });

    if (!active) {
      this.logger.log('No active local-es256 key found; minting initial key');
      await this.rotateKey();
      return;
    }

    if (active.provider !== 'local-es256') {
      throw new Error(
        `LocalEs256KeySigningService refusing to start: active key '${active.kid}' has provider='${active.provider}'. ` +
          `Environment mismatch — JWT_KEY_PROVIDER was changed without rotating keys.`,
      );
    }

    // Active row exists; load disk + verify.
    await this.loadExistingKey(active.kid);

    // Also preload retiring keys so getPublicJwk responds fast.
    const retiring = await this.keyRepo.find({ where: { state: 'retiring' } });
    for (const k of retiring) {
      if (k.provider === 'local-es256') {
        try {
          await this.loadExistingKey(k.kid);
        } catch (err) {
          // Retiring key missing from disk is non-fatal — they can still
          // be served from `key_metadata.public_key_pem` for JWKS.
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
        `LocalEs256KeySigningService: active kid '${kid}' has no key file at '${filePath}'. ` +
          `Refusing to start. Either restore the file or rotate keys.`,
      );
    }
    this.assertFilePermissions(filePath);

    const pem = await fsAsync.readFile(filePath, 'utf8');
    const privateKey = (await importPKCS8(pem, 'ES256')) as KeyObject;
    this.privateKeyByKid.set(kid, privateKey);

    // Derive public key from private for the cache.
    const publicKey = createPublicKey(privateKey);
    this.publicKeyByKid.set(kid, publicKey);
  }

  // ──────────────────────────────────────────────────────────────────────
  // Cryptographic helpers
  // ──────────────────────────────────────────────────────────────────────

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
    // O_CREAT|O_WRONLY|O_EXCL + mode 0600 in one syscall — atomic, never
    // leaves a world-readable file even for a moment.
    const fd = await fsAsync.open(filePath, 'wx', REQUIRED_FILE_MODE);
    try {
      await fd.writeFile(pem, { encoding: 'utf8' });
    } finally {
      await fd.close();
    }
    // Belt-and-suspenders: some POSIX impls ignore mode in O_CREAT when
    // umask is set; force the exact mode here.
    await fsAsync.chmod(filePath, REQUIRED_FILE_MODE);
  }

  // ──────────────────────────────────────────────────────────────────────
  // Filesystem helpers
  // ──────────────────────────────────────────────────────────────────────

  private keyFilePath(kid: string): string {
    return path.join(process.cwd(), LOCAL_KEY_DIR, `${kid}.pem`);
  }

  private async ensureKeyDir(): Promise<void> {
    const dir = path.join(process.cwd(), LOCAL_KEY_DIR);
    if (!existsSync(dir)) {
      // 0700 = owner only. Even the directory shouldn't be group/other-readable.
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

  /**
   * Throws if `filePath` is group- or other-readable on POSIX systems.
   *
   * On Windows the file mode bits are not meaningful in the POSIX sense
   * (Node returns a stat with `mode & 0o777` typically equal to 0o666 or
   * 0o444 regardless of ACLs), so this check is skipped there. The local
   * provider is dev-only (canon §29.9) and Windows developers already get
   * the production-guard protection.
   */
  private assertFilePermissions(filePath: string): void {
    if (process.platform === 'win32') return;
    const st = statSync(filePath);
    const perms = st.mode & 0o777;
    if (perms & 0o077) {
      throw new Error(
        `LocalEs256KeySigningService refusing to start: ${filePath} has mode 0${perms.toString(8)} ` +
          `(group/other readable). Required: 0600. ` +
          `Fix: chmod 600 ${filePath}`,
      );
    }
  }

  // ──────────────────────────────────────────────────────────────────────
  // Misc
  // ──────────────────────────────────────────────────────────────────────

  private assertNotProduction(): void {
    if (process.env['NODE_ENV'] === 'production') {
      // Defense in depth — the module factory already throws. This catches
      // the case where someone bypasses the factory and instantiates the
      // class directly (e.g. in a test that misconfigures NODE_ENV).
      throw new Error(
        'LocalEs256KeySigningService refusing to start in production. ' +
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
