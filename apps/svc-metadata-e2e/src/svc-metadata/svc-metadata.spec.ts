import 'dotenv/config';
import axios from 'axios';
import { Client } from 'pg';
import * as argon2 from 'argon2';
import { v4 as uuidv4 } from 'uuid';
import { createServer } from 'http';
import { promises as fs } from 'fs';
import * as fsSync from 'fs';
import * as path from 'path';
import * as os from 'os';
import archiver = require('archiver');
import { sha256, signEd25519, toYaml, validatePackManifest } from '@hubblewave/packs';

const metadataBaseURL = process.env.METADATA_BASE_URL || 'http://localhost:3003';
const identityBaseURL = process.env.IDENTITY_BASE_URL || 'http://localhost:3001';
const adminEmail = process.env.E2E_ADMIN_EMAIL || 'e2e-admin@hubblewave.local';
const adminPassword = process.env.E2E_ADMIN_PASSWORD || 'e2e-admin-password';
const adminDisplayName = 'E2E Admin';
const packToken =
  process.env.PACK_INSTALL_TOKEN
  || process.env.INSTANCE_PACK_INSTALL_TOKEN
  || process.env.CONTROL_PLANE_INSTANCE_TOKEN;

async function withDbClient<T>(handler: (client: Client) => Promise<T>): Promise<T> {
  const client = new Client({
    host: process.env.DB_HOST || 'localhost',
    port: Number(process.env.DB_PORT || 5432),
    user: process.env.DB_USER || 'hubblewave',
    password: process.env.DB_PASSWORD || 'hubblewave',
    database: process.env.DB_NAME || 'hubblewave',
  });
  await client.connect();
  try {
    return await handler(client);
  } finally {
    await client.end();
  }
}

async function ensureAdminUser(): Promise<void> {
  await withDbClient(async (client) => {
    const roleCode = 'admin';
    const roleResult = await client.query('SELECT id FROM roles WHERE code = $1', [roleCode]);
    const roleId = roleResult.rows[0]?.id || uuidv4();

    if (roleResult.rows.length === 0) {
      await client.query(
        `INSERT INTO roles (id, code, name, description, is_system, is_active, created_at)
         VALUES ($1, $2, 'Administrator', 'Full Access', true, true, NOW())`,
        [roleId, roleCode]
      );
    }

    const passwordHash = await argon2.hash(adminPassword);
    const userResult = await client.query('SELECT id FROM users WHERE email = $1', [adminEmail]);
    const userId = userResult.rows[0]?.id || uuidv4();

    if (userResult.rows.length === 0) {
      await client.query(
        `INSERT INTO users (
           id, email, password_hash, status,
           display_name, first_name, last_name,
           email_verified, is_admin, failed_login_attempts, created_at, updated_at
         )
         VALUES ($1, $2, $3, 'active', $4, $5, $6, true, true, 0, NOW(), NOW())`,
        [userId, adminEmail, passwordHash, adminDisplayName, 'E2E', 'Admin']
      );
    } else {
      await client.query(
        `UPDATE users
         SET password_hash = $1,
             status = 'active',
             display_name = $2,
             first_name = $3,
             last_name = $4,
             email_verified = true,
             is_admin = true
         WHERE id = $5`,
        [passwordHash, adminDisplayName, 'E2E', 'Admin', userId]
      );
    }

    await client.query(
      `INSERT INTO user_roles (user_id, role_id, created_at)
       VALUES ($1, $2, NOW()) ON CONFLICT DO NOTHING`,
      [userId, roleId]
    );
  });
}

async function loginAdmin(): Promise<string> {
  const response = await axios.post(
    '/api/auth/login',
    { username: adminEmail, password: adminPassword },
    { baseURL: identityBaseURL }
  );
  if (!response.data?.accessToken) {
    throw new Error('Login failed to return access token');
  }
  return response.data.accessToken as string;
}

async function buildPackArtifact(packCode: string, releaseId: string, collectionCode: string) {
  const privateKey = process.env.PACK_SIGNING_PRIVATE_KEY;
  if (!privateKey) {
    throw new Error('PACK_SIGNING_PRIVATE_KEY is required for pack build');
  }

  const stageRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'hw-pack-e2e-'));
  const assetPath = 'assets/metadata/collections.yaml';
  const assetFullPath = path.join(stageRoot, assetPath);

  const payload = {
    collections: [
      {
        code: collectionCode,
        name: `E2E ${collectionCode}`,
        plural_name: `E2E ${collectionCode}s`,
        table_name: `u_${collectionCode}`,
        description: 'E2E pack collection',
        properties: [
          {
            code: 'name',
            name: 'Name',
            type: 'text',
            column_name: 'name',
            is_required: true,
          },
        ],
      },
    ],
  };

  await fs.mkdir(path.dirname(assetFullPath), { recursive: true });
  await fs.writeFile(assetFullPath, `${toYaml(payload)}\n`, 'utf8');

  const assetBuffer = await fs.readFile(assetFullPath);
  const assetSha = sha256(assetBuffer);

  const manifestCandidate = {
    manifest: 'hubblewave.pack',
    manifest_revision: 1,
    pack: {
      code: packCode,
      name: 'E2E Pack',
      release_id: releaseId,
      publisher: 'hubblewave',
      description: 'E2E pack test',
      license: 'internal',
    },
    compatibility: {
      platform_min_release_id: '20260101.001',
      platform_max_release_id: '20261231.999',
    },
    assets: [
      {
        type: 'metadata',
        path: assetPath,
        sha256: assetSha,
      },
    ],
    install: {
      lock_key: 'packs.install',
      apply_order: ['metadata'],
    },
    signing: {
      algorithm: 'ed25519',
      public_key_id: 'hw-pack-signing-primary',
    },
  };

  const validatedManifest = validatePackManifest(manifestCandidate);
  const manifestOutput: Record<string, unknown> = {
    manifest: validatedManifest.manifest,
    manifest_revision: validatedManifest.manifest_revision,
    pack: validatedManifest.pack,
    compatibility: validatedManifest.compatibility,
    assets: validatedManifest.assets,
    install: validatedManifest.install,
    signing: validatedManifest.signing,
  };

  const checksumsContent = `${assetSha} ${assetPath}\n`;
  const signature = signEd25519(Buffer.from(checksumsContent, 'utf8'), privateKey);

  await fs.writeFile(path.join(stageRoot, 'manifest.yaml'), `${toYaml(manifestOutput)}\n`, 'utf8');
  await fs.mkdir(path.join(stageRoot, 'checksums'), { recursive: true });
  await fs.mkdir(path.join(stageRoot, 'signatures'), { recursive: true });
  await fs.writeFile(path.join(stageRoot, 'checksums', 'assets.sha256'), checksumsContent, 'utf8');
  await fs.writeFile(path.join(stageRoot, 'signatures', 'pack.sig'), `${signature}\n`, 'utf8');

  const outputFile = path.join(os.tmpdir(), `${packCode}-${releaseId}.zip`);

  await new Promise<void>((resolve, reject) => {
    const output = fsSync.createWriteStream(outputFile);
    const archive = archiver('zip', { zlib: { level: 9 } });

    output.on('close', () => resolve());
    output.on('error', reject);
    archive.on('error', reject);
    archive.on('warning', reject);

    archive.pipe(output);
    archive.directory(stageRoot, 'pack');
    archive.finalize().catch(reject);
  });

  return {
    artifactPath: outputFile,
    manifest: manifestOutput,
    cleanup: async () => {
      await fs.rm(stageRoot, { recursive: true, force: true });
      await fs.rm(outputFile, { force: true });
    },
  };
}

async function serveArtifact(filePath: string) {
  const server = createServer((req, res) => {
    if (req.url !== '/pack.zip') {
      res.statusCode = 404;
      res.end();
      return;
    }
    res.statusCode = 200;
    res.setHeader('Content-Type', 'application/zip');
    fsSync.createReadStream(filePath).pipe(res);
  });

  await new Promise<void>((resolve) => server.listen(0, resolve));
  const address = server.address();
  if (!address || typeof address === 'string') {
    throw new Error('Failed to start artifact server');
  }

  return {
    url: `http://127.0.0.1:${address.port}/pack.zip`,
    close: () => new Promise<void>((resolve) => server.close(() => resolve())),
  };
}

describe('svc-metadata /api/health', () => {
  it('returns ok', async () => {
    const res = await axios.get('/api/health', { baseURL: metadataBaseURL });
    expect(res.status).toBe(200);
    expect(res.data).toMatchObject({
      status: 'ok',
      service: 'svc-metadata',
      dependencies: {},
    });
    expect(res.data.timestamp).toEqual(expect.any(String));
  });
});

describe('svc-metadata schema deploy', () => {
  jest.setTimeout(30000);

  let accessToken: string;

  beforeAll(async () => {
    await ensureAdminUser();
    accessToken = await loginAdmin();
  });

  it('deploys schema for published metadata and converges plan', async () => {
    const client = axios.create({
      baseURL: metadataBaseURL,
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    const codeSuffix = Date.now().toString(36);
    const collectionCode = `e2e_schema_${codeSuffix}`;
    const storageTable = `u_${collectionCode}`;

    const collectionRes = await client.post('/api/collections', {
      code: collectionCode,
      label: `E2E Schema ${codeSuffix}`,
      labelPlural: `E2E Schemas ${codeSuffix}`,
      description: 'E2E schema deployment test collection',
      storageTable,
      category: 'E2E',
      createStorage: false,
      storageSchema: 'public',
    });

    const collectionId = collectionRes.data.id as string;
    expect(collectionId).toEqual(expect.any(String));

    const propertyTypes = await client.get('/api/collections/property-types');
    const propertyType =
      propertyTypes.data.find((type: { code: string }) => type.code === 'text') ||
      propertyTypes.data[0];
    expect(propertyType?.id).toBeTruthy();

    await client.post(`/api/collections/${collectionId}/properties`, {
      code: 'name',
      name: 'Name',
      propertyTypeId: propertyType.id,
      columnName: 'name',
      isRequired: true,
    });

    await client.post(`/api/collections/${collectionId}/publish`);

    const planRes = await client.get('/api/schema/plan', {
      params: { collectionCodes: collectionCode },
    });

    expect(planRes.data.operations.length).toBeGreaterThan(0);
    const operationTypes = planRes.data.operations.map((op: { type: string }) => op.type);
    expect(operationTypes).toEqual(expect.arrayContaining(['create_table', 'add_column']));

    await client.post('/api/schema/deploy', { collectionCodes: [collectionCode] });

    const planAfterDeploy = await client.get('/api/schema/plan', {
      params: { collectionCodes: collectionCode },
    });

    expect(planAfterDeploy.data.operations).toEqual([]);
  });
});

describe('svc-metadata pack install and rollback', () => {
  jest.setTimeout(45000);

  it('installs and rolls back a pack deterministically', async () => {
    if (!packToken) {
      throw new Error('Pack install token is not configured');
    }

    const packCode = `e2e.pack.${Date.now().toString(36)}`;
    const releaseId = '20260109.001';
    const collectionCode = `e2e_pack_${Date.now().toString(36)}`;

    const artifact = await buildPackArtifact(packCode, releaseId, collectionCode);
    const server = await serveArtifact(artifact.artifactPath);

    try {
      const client = axios.create({
        baseURL: metadataBaseURL,
        headers: { Authorization: `Bearer ${packToken}` },
      });

      const installResponse = await client.post('/api/packs/install', {
        packCode,
        releaseId,
        manifest: artifact.manifest,
        artifactUrl: server.url,
      });
      expect(installResponse.data?.releaseRecord?.status).toBe('applied');

      const releasesAfterInstall = await client.get('/api/packs/releases', {
        params: { packCode },
      });
      const appliedRecord = releasesAfterInstall.data.find(
        (record: { status?: string }) => record.status === 'applied'
      );
      expect(appliedRecord).toBeTruthy();

      const rollbackResponse = await client.post('/api/packs/rollback', {
        packCode,
        releaseId,
      });
      expect(rollbackResponse.data?.releaseRecord?.status).toBe('applied');

      const releasesAfterRollback = await client.get('/api/packs/releases', {
        params: { packCode },
      });
      const rolledBack = releasesAfterRollback.data.find(
        (record: { status?: string }) => record.status === 'rolled_back'
      );
      expect(rolledBack).toBeTruthy();

      const rollbackRecord = releasesAfterRollback.data.find(
        (record: { rollbackOfReleaseId?: string }) => record.rollbackOfReleaseId === rolledBack.id
      );
      expect(rollbackRecord?.status).toBe('applied');

      const collectionRow = await withDbClient(async (db) => {
        const result = await db.query(
          `SELECT is_active, metadata->>'status' AS status
           FROM collection_definitions
           WHERE code = $1`,
          [collectionCode]
        );
        return result.rows[0];
      });

      expect(collectionRow).toBeTruthy();
      expect(collectionRow.is_active).toBe(false);
      expect(collectionRow.status).toBe('deprecated');
    } finally {
      await server.close();
      await artifact.cleanup();
    }
  });
});
