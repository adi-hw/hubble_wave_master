import {
  BadRequestException,
  Injectable,
  NotFoundException,
  ConflictException,
  Logger,
  Inject,
  OnModuleInit,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DeepPartial, Repository } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import { StorageClient, STORAGE_CLIENT } from '@hubblewave/storage';
import { PackRegistry, PackRelease, Instance } from '@hubblewave/control-plane-db';
import { parseYaml, validatePackManifest, verifyEd25519, sha256 } from '@hubblewave/packs';
import * as unzipper from 'unzipper';
import { AuditService } from '../audit/audit.service';
import {
  PackInstallDto,
  PackInstallStatusDto,
  PackRegisterDto,
  PackRollbackDto,
  PackUploadUrlDto,
} from './packs.dto';

const RELEASE_ID_PATTERN = /^\d{8}\.\d{3,}$/;

type PackManifest = ReturnType<typeof validatePackManifest>;

type PackArtifact = {
  manifest: PackManifest;
  checksums: Map<string, string>;
  signature: string;
  artifactSha256: string;
};

@Injectable()
export class PacksService implements OnModuleInit {
  private readonly logger = new Logger(PacksService.name);
  private readonly bucketName: string;

  constructor(
    @InjectRepository(PackRegistry)
    private readonly packRepo: Repository<PackRegistry>,
    @InjectRepository(PackRelease)
    private readonly releaseRepo: Repository<PackRelease>,
    @InjectRepository(Instance)
    private readonly instanceRepo: Repository<Instance>,
    private readonly configService: ConfigService,
    private readonly auditService: AuditService,
    private readonly httpService: HttpService,
    @Inject(STORAGE_CLIENT)
    private readonly storageClient: StorageClient,
  ) {
    this.bucketName = this.configService.get<string>('S3_BUCKET_PACK_ARTIFACTS')
      || this.configService.get<string>('MINIO_BUCKET_PACK_ARTIFACTS')
      || this.configService.get<string>('STORAGE_BUCKET')
      || 'hw-pack-artifacts';
  }

  async onModuleInit(): Promise<void> {
    await this.storageClient.ensureBucket(this.bucketName);
  }

  async createUploadUrl(dto: PackUploadUrlDto) {
    const filename = dto.filename || 'pack.zip';
    if (!filename.toLowerCase().endsWith('.zip')) {
      throw new BadRequestException('Pack artifact must be a .zip file');
    }

    const key = `packs/${dto.code}/${dto.releaseId}/${filename}`;
    const url = await this.storageClient.getSignedUrl({
      bucket: this.bucketName,
      key,
      operation: 'put',
      expiresInSeconds: 900,
      contentType: 'application/zip',
    });

    return {
      bucket: this.bucketName,
      key,
      url,
      expiresInSeconds: 900,
    };
  }

  async registerPack(dto: PackRegisterDto, actorId?: string) {
    const artifactBucket = dto.artifactBucket || this.bucketName;
    this.assertSafeKey(dto.artifactKey);

    const artifact = await this.loadArtifact(artifactBucket, dto.artifactKey);
    const manifest = artifact.manifest;
    this.assertArtifactKeyMatches(dto.artifactKey, manifest.pack.code, manifest.pack.release_id);

    const existingPack = await this.packRepo.findOne({ where: { code: manifest.pack.code } });
    if (!existingPack) {
      const created = this.packRepo.create({
        code: manifest.pack.code,
        name: manifest.pack.name,
        description: manifest.pack.description,
        publisher: manifest.pack.publisher,
        license: manifest.pack.license,
        metadata: {},
        createdBy: actorId,
        updatedBy: actorId,
      });
      await this.packRepo.save(created);
    } else {
      existingPack.name = manifest.pack.name;
      existingPack.description = manifest.pack.description;
      existingPack.publisher = manifest.pack.publisher;
      existingPack.license = manifest.pack.license;
      existingPack.updatedBy = actorId;
      await this.packRepo.save(existingPack);
    }

    const pack = await this.packRepo.findOne({ where: { code: manifest.pack.code } });
    if (!pack) {
      throw new BadRequestException('Pack registry not available');
    }

    const existingRelease = await this.releaseRepo.findOne({
      where: { packId: pack.id, releaseId: manifest.pack.release_id },
    });
    if (existingRelease) {
      if (existingRelease.artifactSha256 !== artifact.artifactSha256) {
        throw new ConflictException('Pack release already exists with a different artifact');
      }
      return existingRelease;
    }

    const latestRelease = await this.releaseRepo.findOne({
      where: { packId: pack.id },
      order: { releaseId: 'DESC' },
    });
    if (latestRelease && this.compareReleaseId(manifest.pack.release_id, latestRelease.releaseId) <= 0) {
      throw new ConflictException('Pack release_id must be greater than the latest registered release');
    }

    const release: DeepPartial<PackRelease> = {
      packId: pack.id,
      releaseId: manifest.pack.release_id,
      manifestRevision: manifest.manifest_revision,
      manifest,
      dependencies: manifest.dependencies || null,
      compatibility: manifest.compatibility || null,
      assets: manifest.assets,
      artifactBucket,
      artifactKey: dto.artifactKey,
      artifactSha256: artifact.artifactSha256,
      signature: artifact.signature,
      signatureKeyId: manifest.signing.public_key_id,
      isActive: true,
      isInstallableByClient: manifest.pack.installable_by_client === true,
      createdBy: actorId,
    };
    const saved = await this.releaseRepo.save(release);

    await this.auditService.log('pack.registered', `Registered pack ${manifest.pack.code}@${manifest.pack.release_id}`, {
      actor: actorId || 'system',
      actorType: actorId ? 'user' : 'system',
      target: saved.id,
      targetType: 'config',
      metadata: {
        packCode: manifest.pack.code,
        releaseId: manifest.pack.release_id,
        artifactKey: dto.artifactKey,
      },
    });

    return saved;
  }

  async listPacks() {
    const packs = await this.packRepo.find({ order: { createdAt: 'DESC' } });
    const releases = await this.releaseRepo.find({ order: { createdAt: 'DESC' } });

    const releasesByPack = releases.reduce<Record<string, PackRelease[]>>((acc, release) => {
      acc[release.packId] = acc[release.packId] || [];
      acc[release.packId].push(release);
      return acc;
    }, {});

    return packs.map((pack) => ({
      ...pack,
      releases: releasesByPack[pack.id] || [],
    }));
  }

  async getPack(code: string) {
    const pack = await this.packRepo.findOne({ where: { code } });
    if (!pack) {
      throw new NotFoundException(`Pack ${code} not found`);
    }
    const releases = await this.releaseRepo.find({
      where: { packId: pack.id },
      order: { createdAt: 'DESC' },
    });
    return { ...pack, releases };
  }

  async getRelease(code: string, releaseId: string) {
    const pack = await this.packRepo.findOne({ where: { code } });
    if (!pack) {
      throw new NotFoundException(`Pack ${code} not found`);
    }
    const release = await this.releaseRepo.findOne({
      where: { packId: pack.id, releaseId },
    });
    if (!release) {
      throw new NotFoundException(`Release ${releaseId} not found for pack ${code}`);
    }
    return release;
  }

  async listInstallableCatalog() {
    const releases = await this.releaseRepo.find({
      where: { isActive: true },
      relations: ['pack'],
      order: { releaseId: 'DESC' },
    });

    const latestByPack = new Map<string, PackRelease>();
    for (const release of releases) {
      const manifestPack = (release.manifest as { pack?: Record<string, unknown> } | null)?.pack || {};
      const installableByClient = release.isInstallableByClient
        || (manifestPack.installable_by_client as boolean | undefined) === true;
      if (!installableByClient) {
        continue;
      }
      if (!release.packId || latestByPack.has(release.packId)) {
        continue;
      }
      latestByPack.set(release.packId, release);
    }

    return Array.from(latestByPack.values()).map((release) => ({
      pack: (() => {
        const manifestPack = (release.manifest as { pack?: Record<string, unknown> } | null)?.pack || {};
        return {
          code: release.pack?.code || (manifestPack.code as string | undefined) || '',
          name: release.pack?.name || (manifestPack.name as string | undefined) || '',
          description: release.pack?.description || (manifestPack.description as string | undefined) || null,
          publisher: release.pack?.publisher || (manifestPack.publisher as string | undefined),
          license: release.pack?.license || (manifestPack.license as string | undefined) || null,
        };
      })(),
      release: {
        releaseId: release.releaseId,
        manifestRevision: release.manifestRevision,
        compatibility: release.compatibility,
        assets: release.assets,
        isInstallableByClient: release.isInstallableByClient,
      },
    }));
  }

  async createInstallableArtifactBundle(code: string, releaseId: string, expiresInSeconds = 600) {
    const release = await this.getInstallableRelease(code, releaseId);
    const manifest = release.manifest as PackManifest;
    const url = await this.storageClient.getSignedUrl({
      bucket: release.artifactBucket,
      key: release.artifactKey,
      operation: 'get',
      expiresInSeconds,
    });

    return {
      packCode: manifest.pack.code,
      releaseId: release.releaseId,
      manifest,
      artifactUrl: url,
      expiresInSeconds,
    };
  }

  async createDownloadUrl(code: string, releaseId: string, expiresInSeconds = 600) {
    const release = await this.getRelease(code, releaseId);
    if (!release.isActive) {
      throw new BadRequestException('Pack release is not active');
    }
    const url = await this.storageClient.getSignedUrl({
      bucket: release.artifactBucket,
      key: release.artifactKey,
      operation: 'get',
      expiresInSeconds,
    });

    return {
      url,
      expiresInSeconds,
    };
  }

  async triggerInstall(dto: PackInstallDto, actorId?: string) {
    const instance = await this.instanceRepo.findOne({
      where: { id: dto.instanceId },
    });
    if (!instance) {
      throw new NotFoundException(`Instance ${dto.instanceId} not found`);
    }
    if (instance.status !== 'active') {
      throw new BadRequestException(`Instance ${dto.instanceId} is not active`);
    }

    const release = await this.getRelease(dto.packCode, dto.releaseId);
    if (!release.isActive) {
      throw new BadRequestException('Pack release is not active');
    }
    this.assertInstanceCompatibility(instance, release);

    const urlResponse = await this.createDownloadUrl(dto.packCode, dto.releaseId, 900);
    const baseUrl = this.resolveInstanceBaseUrl(instance);
    const token = this.resolveInstanceToken(instance);
    const manifest = release.manifest as PackManifest;

    const payload = {
      packCode: manifest.pack.code,
      releaseId: release.releaseId,
      manifest,
      artifactUrl: urlResponse.url,
    };

    try {
      await firstValueFrom(
        this.httpService.post(`${baseUrl}/api/packs/install`, payload, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
          timeout: 30000,
        })
      );
    } catch (error: unknown) {
      const message = (error as { message?: string }).message || 'Failed to trigger pack install';
      this.logger.error(message);
      throw new BadRequestException(message);
    }

    await this.auditService.log('pack.install.triggered', `Triggered pack install ${dto.packCode}@${dto.releaseId}`, {
      actor: actorId || 'system',
      actorType: actorId ? 'user' : 'system',
      target: instance.id,
      targetType: 'instance',
      metadata: {
        packCode: dto.packCode,
        releaseId: dto.releaseId,
      },
    });

    return { triggered: true };
  }

  async triggerRollback(dto: PackRollbackDto, actorId?: string) {
    const instance = await this.instanceRepo.findOne({
      where: { id: dto.instanceId },
    });
    if (!instance) {
      throw new NotFoundException(`Instance ${dto.instanceId} not found`);
    }
    if (instance.status !== 'active') {
      throw new BadRequestException(`Instance ${dto.instanceId} is not active`);
    }

    const baseUrl = this.resolveInstanceBaseUrl(instance);
    const token = this.resolveInstanceToken(instance);

    const payload = {
      packCode: dto.packCode,
      releaseId: dto.releaseId,
    };

    try {
      await firstValueFrom(
        this.httpService.post(`${baseUrl}/api/packs/rollback`, payload, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
          timeout: 30000,
        })
      );
    } catch (error: unknown) {
      const message = (error as { message?: string }).message || 'Failed to trigger pack rollback';
      this.logger.error(message);
      throw new BadRequestException(message);
    }

    await this.auditService.log('pack.rollback.triggered', `Triggered pack rollback ${dto.packCode}@${dto.releaseId}`, {
      actor: actorId || 'system',
      actorType: actorId ? 'user' : 'system',
      target: instance.id,
      targetType: 'instance',
      metadata: {
        packCode: dto.packCode,
        releaseId: dto.releaseId,
      },
    });

    return { triggered: true };
  }

  async getInstallStatus(query: PackInstallStatusDto) {
    const instance = await this.instanceRepo.findOne({
      where: { id: query.instanceId },
    });
    if (!instance) {
      throw new NotFoundException(`Instance ${query.instanceId} not found`);
    }

    const baseUrl = this.resolveInstanceBaseUrl(instance);
    const token = this.resolveInstanceToken(instance);
    const limit = this.normalizeLimit(query.limit);

    const params: Record<string, string> = {};
    if (query.packCode) {
      params.packCode = query.packCode;
    }
    if (query.status) {
      params.status = query.status;
    }
    if (limit) {
      params.limit = String(limit);
    }

    try {
      const response = await firstValueFrom(
        this.httpService.get(`${baseUrl}/api/packs/releases`, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
          params,
          timeout: 15000,
        })
      );
      const records = Array.isArray(response.data) ? response.data : [];
      if (query.releaseId) {
        return records.filter((record) => record.packReleaseId === query.releaseId);
      }
      return records;
    } catch (error: unknown) {
      const message = (error as { message?: string }).message || 'Failed to load pack install status';
      this.logger.error(message);
      throw new BadRequestException(message);
    }
  }

  private resolveInstanceToken(instance: Instance): string {
    const config = (instance.config || {}) as Record<string, unknown>;
    const tokenFromConfig = typeof config['packInstallToken'] === 'string'
      ? (config['packInstallToken'] as string)
      : undefined;
    const token = tokenFromConfig || this.configService.get<string>('CONTROL_PLANE_INSTANCE_TOKEN');
    if (!token) {
      throw new BadRequestException('Instance pack install token is not configured');
    }
    return token;
  }

  private resolveInstanceBaseUrl(instance: Instance): string {
    const domain = instance.customDomain || instance.domain;
    if (!domain) {
      throw new BadRequestException('Instance domain is not configured');
    }
    if (domain.startsWith('http://') || domain.startsWith('https://')) {
      return domain;
    }
    const scheme = this.configService.get<string>('CONTROL_PLANE_INSTANCE_SCHEME') || 'https';
    return `${scheme}://${domain}`;
  }

  private normalizeLimit(limit?: string): number | null {
    if (!limit) {
      return null;
    }
    const parsed = Number(limit);
    if (!Number.isFinite(parsed)) {
      throw new BadRequestException('limit must be a number');
    }
    const bounded = Math.max(1, Math.min(parsed, 200));
    return Math.floor(bounded);
  }

  private async loadArtifact(bucket: string, key: string): Promise<PackArtifact> {
    const buffer = await this.storageClient.getObject({ bucket, key });
    const artifactSha256 = sha256(buffer);
    const directory = await unzipper.Open.buffer(buffer);
    const fileMap = new Map<string, Buffer>();

    for (const file of directory.files) {
      if (file.type !== 'File') {
        continue;
      }
      const content = await file.buffer();
      fileMap.set(file.path, content);
    }

    const manifestRaw = this.requireFile(fileMap, 'pack/manifest.yaml');
    const checksumsRaw = this.requireFile(fileMap, 'pack/checksums/assets.sha256');
    const signatureRaw = this.requireFile(fileMap, 'pack/signatures/pack.sig');

    const manifest = validatePackManifest(parseYaml(manifestRaw.toString('utf8')));
    const checksums = this.parseChecksums(checksumsRaw.toString('utf8'));
    const signature = signatureRaw.toString('utf8').trim();

    this.validateArtifactSignature(manifest.signing.public_key_id, checksumsRaw, signature);
    this.validateChecksums(manifest, fileMap, checksums);

    return { manifest, checksums, signature, artifactSha256 };
  }

  private validateChecksums(
    manifest: ReturnType<typeof validatePackManifest>,
    files: Map<string, Buffer>,
    checksums: Map<string, string>,
  ) {
    for (const asset of manifest.assets) {
      const assetPath = `pack/${asset.path}`;
      const file = files.get(assetPath);
      if (!file) {
        throw new BadRequestException(`Missing asset file: ${asset.path}`);
      }
      const actualSha = sha256(file);
      if (actualSha !== asset.sha256) {
        throw new BadRequestException(`Checksum mismatch for asset: ${asset.path}`);
      }
      const checksumEntry = checksums.get(asset.path);
      if (checksumEntry !== asset.sha256) {
        throw new BadRequestException(`Checksum entry mismatch for asset: ${asset.path}`);
      }
    }

    for (const assetPath of checksums.keys()) {
      const assetFile = files.get(`pack/${assetPath}`);
      if (!assetFile) {
        throw new BadRequestException(`Checksum refers to missing asset: ${assetPath}`);
      }
    }
  }

  private validateArtifactSignature(publicKeyId: string, payload: Buffer, signature: string) {
    const publicKeys = this.loadPublicKeys();
    const publicKey = publicKeys[publicKeyId];
    if (!publicKey) {
      throw new BadRequestException(`Unknown pack signing key: ${publicKeyId}`);
    }
    const verified = verifyEd25519(payload, signature, publicKey);
    if (!verified) {
      throw new BadRequestException('Pack signature verification failed');
    }
  }

  private parseChecksums(content: string): Map<string, string> {
    const map = new Map<string, string>();
    const lines = content.split('\n').map((line) => line.trim()).filter(Boolean);
    for (const line of lines) {
      const parts = line.split(/\s+/);
      if (parts.length < 2) {
        throw new BadRequestException('Invalid checksum entry');
      }
      const [sha, ...pathParts] = parts;
      const path = pathParts.join(' ');
      map.set(path, sha);
    }
    return map;
  }

  private requireFile(files: Map<string, Buffer>, path: string): Buffer {
    const file = files.get(path);
    if (!file) {
      throw new BadRequestException(`Missing required artifact file: ${path}`);
    }
    return file;
  }

  private loadPublicKeys(): Record<string, string> {
    const raw = this.configService.get<string>('PACK_SIGNING_PUBLIC_KEYS');
    if (!raw) {
      throw new BadRequestException('PACK_SIGNING_PUBLIC_KEYS is not configured');
    }
    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch (error: unknown) {
      throw new BadRequestException('PACK_SIGNING_PUBLIC_KEYS must be valid JSON');
    }
    if (!parsed || typeof parsed !== 'object') {
      throw new BadRequestException('PACK_SIGNING_PUBLIC_KEYS must be a key map');
    }
    return parsed as Record<string, string>;
  }

  private assertSafeKey(key: string): void {
    if (!key || key.includes('..') || key.includes('\\') || key.includes(':')) {
      throw new BadRequestException('Invalid artifact key');
    }
  }

  private compareReleaseId(a: string, b: string): number {
    if (!RELEASE_ID_PATTERN.test(a) || !RELEASE_ID_PATTERN.test(b)) {
      return a.localeCompare(b);
    }
    const [aDate, aSeq] = a.split('.');
    const [bDate, bSeq] = b.split('.');
    if (aDate !== bDate) {
      return Number(aDate) - Number(bDate);
    }
    return Number(aSeq) - Number(bSeq);
  }

  private assertArtifactKeyMatches(key: string, packCode: string, releaseId: string): void {
    const normalized = key.replace(/\\/g, '/');
    const expectedPrefix = `packs/${packCode}/${releaseId}/`;
    if (!normalized.startsWith(expectedPrefix)) {
      throw new BadRequestException(
        `artifactKey must start with ${expectedPrefix}`
      );
    }
  }

  private assertInstanceCompatibility(instance: Instance, release: PackRelease): void {
    const compatibility = release.compatibility;
    if (!compatibility || typeof compatibility !== 'object') {
      throw new BadRequestException('Pack compatibility is not defined');
    }
    const min = (compatibility as { platform_min_release_id?: string }).platform_min_release_id;
    const max = (compatibility as { platform_max_release_id?: string }).platform_max_release_id;
    if (!min || !max) {
      throw new BadRequestException('Pack compatibility bounds are not defined');
    }
    const instanceReleaseId = instance.version;
    if (!instanceReleaseId) {
      throw new BadRequestException('Instance platform release is not configured');
    }
    if (
      this.compareReleaseId(instanceReleaseId, min) < 0 ||
      this.compareReleaseId(instanceReleaseId, max) > 0
    ) {
      throw new BadRequestException(
        `Pack compatibility ${min}..${max} does not include instance release ${instanceReleaseId}`
      );
    }
  }

  private async getInstallableRelease(code: string, releaseId: string): Promise<PackRelease> {
    const pack = await this.packRepo.findOne({ where: { code } });
    if (!pack) {
      throw new NotFoundException(`Pack ${code} not found`);
    }
    const release = await this.releaseRepo.findOne({
      where: { packId: pack.id, releaseId },
      relations: ['pack'],
    });
    if (!release) {
      throw new NotFoundException(`Release ${releaseId} not found for pack ${code}`);
    }
    if (!release.isActive) {
      throw new BadRequestException('Pack release is not active');
    }
    const manifestPack = (release.manifest as { pack?: Record<string, unknown> } | null)?.pack || {};
    const installableByClient = release.isInstallableByClient
      || (manifestPack.installable_by_client as boolean | undefined) === true;
    if (!installableByClient) {
      throw new BadRequestException('Pack release is not installable by clients');
    }
    return release;
  }
}
