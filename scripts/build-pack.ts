import 'dotenv/config';
import { promises as fs } from 'fs';
import * as fsSync from 'fs';
import * as path from 'path';
import * as os from 'os';
import archiver = require('archiver');
import { parseYaml, toYaml, validatePackManifest, sha256, signEd25519 } from '../libs/packs/src';

type AssetInput = {
  type?: unknown;
  path?: unknown;
};

type BuildOptions = {
  sourceDir: string;
  outputPath?: string;
  privateKey: string;
};

function parseArgs(argv: string[]): Record<string, string> {
  const args: Record<string, string> = {};
  for (let i = 2; i < argv.length; i += 1) {
    const raw = argv[i];
    if (!raw.startsWith('--')) {
      continue;
    }
    const key = raw.slice(2);
    const value = argv[i + 1];
    if (!value || value.startsWith('--')) {
      args[key] = '';
      continue;
    }
    args[key] = value;
    i += 1;
  }
  return args;
}

function assertSafeAssetPath(assetPath: string): void {
  if (path.isAbsolute(assetPath)) {
    throw new Error(`Asset path must be relative: ${assetPath}`);
  }
  if (assetPath.includes('\\')) {
    throw new Error(`Asset path must use forward slashes: ${assetPath}`);
  }
  const normalized = path.posix.normalize(assetPath);
  if (normalized.startsWith('..') || normalized.includes('/../')) {
    throw new Error(`Asset path must not traverse directories: ${assetPath}`);
  }
}

function sanitizeFileName(value: string): string {
  return value.replace(/[^a-zA-Z0-9._-]+/g, '_');
}

async function loadPrivateKey(args: Record<string, string>): Promise<string> {
  const keyPath = args['private-key-file'];
  if (keyPath) {
    return fs.readFile(path.resolve(keyPath), 'utf8');
  }

  const raw = args['private-key'] || process.env.PACK_SIGNING_PRIVATE_KEY;
  if (!raw) {
    throw new Error('PACK_SIGNING_PRIVATE_KEY or --private-key is required');
  }
  const resolvedPath = path.resolve(raw);
  if (fsSync.existsSync(resolvedPath)) {
    return fs.readFile(resolvedPath, 'utf8');
  }
  return raw;
}

function resolveOutputPath(basePath: string | undefined, code: string, releaseId: string): string {
  const sanitized = `${sanitizeFileName(code)}-${sanitizeFileName(releaseId)}.zip`;
  if (!basePath) {
    return path.join(process.cwd(), 'dist', 'packs', sanitized);
  }
  const resolved = path.resolve(basePath);
  if (resolved.toLowerCase().endsWith('.zip')) {
    return resolved;
  }
  return path.join(resolved, sanitized);
}

async function buildPack(options: BuildOptions): Promise<string> {
  const manifestPath = path.join(options.sourceDir, 'manifest.yaml');
  const manifestRaw = await fs.readFile(manifestPath, 'utf8');
  const parsed = parseYaml(manifestRaw);
  if (!parsed || typeof parsed !== 'object') {
    throw new Error('Manifest must be a YAML object');
  }

  const assetsInput = (parsed as Record<string, unknown>)['assets'];
  if (!Array.isArray(assetsInput)) {
    throw new Error('Manifest assets must be an array');
  }

  const updatedAssets = await Promise.all(
    assetsInput.map(async (asset, index) => {
      const record = asset as AssetInput;
      if (typeof record.path !== 'string' || typeof record.type !== 'string') {
        throw new Error(`Asset at index ${index} must include type and path`);
      }
      assertSafeAssetPath(record.path);
      const assetFile = path.join(options.sourceDir, record.path);
      const data = await fs.readFile(assetFile);
      return {
        type: record.type,
        path: record.path,
        sha256: sha256(data),
      };
    })
  );

  const manifestCandidate = {
    ...parsed,
    assets: updatedAssets,
  } as Record<string, unknown>;

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
  if (validatedManifest.dependencies && validatedManifest.dependencies.length > 0) {
    manifestOutput.dependencies = validatedManifest.dependencies;
  }

  const checksumsLines = validatedManifest.assets.map(
    (asset) => `${asset.sha256} ${asset.path}`
  );
  const checksumsContent = `${checksumsLines.join('\n')}\n`;
  const signature = signEd25519(Buffer.from(checksumsContent, 'utf8'), options.privateKey);

  const stageRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'hw-pack-'));
  try {
    for (const asset of validatedManifest.assets) {
      const sourceFile = path.join(options.sourceDir, asset.path);
      const targetFile = path.join(stageRoot, asset.path);
      await fs.mkdir(path.dirname(targetFile), { recursive: true });
      await fs.copyFile(sourceFile, targetFile);
    }

    await fs.writeFile(path.join(stageRoot, 'manifest.yaml'), `${toYaml(manifestOutput)}\n`, 'utf8');
    await fs.mkdir(path.join(stageRoot, 'checksums'), { recursive: true });
    await fs.mkdir(path.join(stageRoot, 'signatures'), { recursive: true });
    await fs.writeFile(path.join(stageRoot, 'checksums', 'assets.sha256'), checksumsContent, 'utf8');
    await fs.writeFile(path.join(stageRoot, 'signatures', 'pack.sig'), `${signature}\n`, 'utf8');

    const outputFile = resolveOutputPath(
      options.outputPath,
      validatedManifest.pack.code,
      validatedManifest.pack.release_id
    );
    await fs.mkdir(path.dirname(outputFile), { recursive: true });

    await new Promise<void>((resolve, reject) => {
      const output = fsSync.createWriteStream(outputFile);
      const archive = archiver('zip', { zlib: { level: 9 } });

      output.on('close', () => resolve());
      output.on('error', (err) => reject(err));
      archive.on('warning', (err) => reject(err));
      archive.on('error', (err) => reject(err));

      archive.pipe(output);
      archive.directory(stageRoot, 'pack');
      archive.finalize().catch(reject);
    });

    return outputFile;
  } finally {
    await fs.rm(stageRoot, { recursive: true, force: true });
  }
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv);
  const sourceDir = args.source;
  if (!sourceDir) {
    throw new Error('Usage: build-pack --source <pack-root> [--output <path>] [--private-key <key>|--private-key-file <path>]');
  }

  const privateKey = await loadPrivateKey(args);
  const outputFile = await buildPack({
    sourceDir: path.resolve(sourceDir),
    outputPath: args.output,
    privateKey,
  });

  console.log(`Pack artifact created: ${outputFile}`);
}

main().catch((error) => {
  console.error('Pack build failed:', error instanceof Error ? error.message : error);
  process.exit(1);
});
