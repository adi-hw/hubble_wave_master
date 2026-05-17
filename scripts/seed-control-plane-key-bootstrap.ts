import 'dotenv/config';
import { DataSource, EntitySchema } from 'typeorm';
import {
  generateKeyPairSync,
  createPrivateKey,
  createPublicKey,
  randomBytes,
} from 'crypto';
import { promises as fsAsync, existsSync, mkdirSync } from 'fs';
import * as path from 'path';

/**
 * Bootstrap the control-plane ES256 signing keypair without booting the
 * full Nest application (canon §29.9 + W2 Stream 1 PR3).
 *
 * Mirrors what `ControlPlaneLocalEs256KeySigningService.onModuleInit()`
 * does on app boot, but as a stand-alone CLI for first-install / CI /
 * forensic restore. Idempotent: if a `state='active'` row already exists
 * in `key_metadata` and its disk file is present, the script is a no-op.
 *
 * Production deployments do NOT use this script. KMS keys are provisioned
 * via IaC; the production startup path calls `rotateKey()` on first run
 * if no active row exists. This script refuses to run when
 * `NODE_ENV === 'production'`.
 *
 * Note on imports: this script runs under `tsx` from the repo root and
 * does NOT resolve the `@hubblewave/*` path mappings. The `KeyMetadata`
 * shape is therefore defined inline via `EntitySchema` matching the
 * canon §29.2 migration; the runtime services use the proper entity
 * class via path mapping. Same posture as `scripts/seed-admin-user.ts`.
 */

const LOCAL_KEY_DIR = '.dev/keys/control-plane';
const REQUIRED_FILE_MODE = 0o600;

interface KeyMetadataRow {
  kid: string;
  provider: 'aws-kms' | 'local-es256';
  kmsAlias: string | null;
  kmsArn: string | null;
  algorithm: 'ES256';
  state: 'pending' | 'active' | 'retiring' | 'retired' | 'compromised';
  publicKeyPem: string;
  instanceId: string | null;
  createdAt: Date;
  activatedAt: Date | null;
  retiringAt: Date | null;
  retiredAt: Date | null;
  compromisedAt: Date | null;
}

const KeyMetadataSchema = new EntitySchema<KeyMetadataRow>({
  name: 'KeyMetadata',
  tableName: 'key_metadata',
  columns: {
    kid: { type: 'text', primary: true },
    provider: { type: 'text' },
    kmsAlias: { type: 'text', name: 'kms_alias', nullable: true },
    kmsArn: { type: 'text', name: 'kms_arn', nullable: true },
    algorithm: { type: 'text', default: 'ES256' },
    state: { type: 'text' },
    publicKeyPem: { type: 'text', name: 'public_key_pem' },
    instanceId: { type: 'uuid', name: 'instance_id', nullable: true },
    createdAt: { type: 'timestamptz', name: 'created_at' },
    activatedAt: { type: 'timestamptz', name: 'activated_at', nullable: true },
    retiringAt: { type: 'timestamptz', name: 'retiring_at', nullable: true },
    retiredAt: { type: 'timestamptz', name: 'retired_at', nullable: true },
    compromisedAt: { type: 'timestamptz', name: 'compromised_at', nullable: true },
  },
});

function generateKid(now: Date = new Date()): string {
  const yyyy = now.getUTCFullYear();
  const mm = String(now.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(now.getUTCDate()).padStart(2, '0');
  const entropy = randomBytes(4).toString('hex');
  return `hwk_${yyyy}_${mm}_${dd}_${entropy}`;
}

function requireEnv(key: string): string {
  const value = process.env[key];
  if (!value) {
    throw new Error(`${key} must be set before bootstrapping control-plane keys`);
  }
  return value;
}

async function bootstrap() {
  if (process.env.NODE_ENV === 'production') {
    throw new Error(
      'seed-control-plane-key-bootstrap.ts refuses to run in production. ' +
        'Production keys live in AWS KMS and are provisioned via IaC (canon §29.9).',
    );
  }

  const dbPassword = requireEnv('CONTROL_PLANE_DB_PASSWORD');
  const dataSource = new DataSource({
    type: 'postgres',
    host:
      process.env.DIRECT_CONTROL_PLANE_DB_HOST ||
      process.env.CONTROL_PLANE_DB_HOST ||
      'localhost',
    port: parseInt(
      process.env.DIRECT_CONTROL_PLANE_DB_PORT ||
        process.env.CONTROL_PLANE_DB_PORT ||
        '5432',
      10,
    ),
    username: process.env.CONTROL_PLANE_DB_USER || 'hubblewave',
    password: dbPassword,
    database:
      process.env.CONTROL_PLANE_DB_NAME || 'hubblewave_control_plane',
    entities: [KeyMetadataSchema],
    synchronize: false,
  });

  await dataSource.initialize();

  try {
    const repo = dataSource.getRepository<KeyMetadataRow>(KeyMetadataSchema);
    const existing = await repo.findOne({ where: { state: 'active' } });

    const dir = path.join(process.cwd(), LOCAL_KEY_DIR);
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true, mode: 0o700 });
    }

    if (existing) {
      if (existing.provider !== 'local-es256') {
        throw new Error(
          `Refusing to bootstrap: an active key '${existing.kid}' already exists with provider='${existing.provider}'. ` +
            `Rotate or delete it before running this script.`,
        );
      }
      const filePath = path.join(dir, `${existing.kid}.pem`);
      if (existsSync(filePath)) {
        console.log(
          `Active control-plane key '${existing.kid}' already present at ${filePath} — nothing to do.`,
        );
        return;
      }
      throw new Error(
        `key_metadata row exists for kid '${existing.kid}' but the disk file at ${filePath} is missing. ` +
          `Refusing to silently overwrite the DB row. Either restore the file from a backup or ` +
          `manually mark the row state='retired' and rerun.`,
      );
    }

    const kid = generateKid(new Date());
    const { privateKey, publicKey } = generateKeyPairSync('ec', {
      namedCurve: 'P-256',
      privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
      publicKeyEncoding: { type: 'spki', format: 'pem' },
    });
    // Sanity round-trip — confirms the key material is parseable in the
    // exact shape the runtime provider expects before we persist anything.
    createPrivateKey({ key: privateKey, format: 'pem' });
    createPublicKey({ key: publicKey, format: 'pem' });

    const filePath = path.join(dir, `${kid}.pem`);
    const fd = await fsAsync.open(filePath, 'wx', REQUIRED_FILE_MODE);
    try {
      await fd.writeFile(privateKey, { encoding: 'utf8' });
    } finally {
      await fd.close();
    }
    await fsAsync.chmod(filePath, REQUIRED_FILE_MODE);

    const now = new Date();
    await repo.save({
      kid,
      provider: 'local-es256',
      kmsAlias: null,
      kmsArn: null,
      algorithm: 'ES256',
      state: 'active',
      publicKeyPem: publicKey,
      instanceId: null,
      createdAt: now,
      activatedAt: now,
      retiringAt: null,
      retiredAt: null,
      compromisedAt: null,
    });

    console.log(`Bootstrapped control-plane ES256 key: kid='${kid}'`);
    console.log(`  private key: ${filePath} (mode 0600)`);
  } finally {
    await dataSource.destroy();
  }
}

bootstrap().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
