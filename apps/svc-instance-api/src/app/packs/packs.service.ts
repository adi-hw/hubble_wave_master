import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { createPublicKey, verify as cryptoVerify } from 'crypto';
import { PackReleaseRecord, PackReleaseStatus } from '@hubblewave/instance-db';
import { normalizePublicKey } from '@hubblewave/packs';
import { validateOutboundUrl } from '@hubblewave/integrations';
import { PackInstallDto, PackRollbackDto } from './dto/pack-install.dto';

const DEFAULT_HOST_ALLOWLIST = [
  '*.hubblewave.com',
  's3.amazonaws.com',
  '*.s3.us-east-2.amazonaws.com',
];

@Injectable()
export class PacksService {
  private readonly logger = new Logger(PacksService.name);

  constructor(
    @InjectRepository(PackReleaseRecord)
    private readonly releaseRepo: Repository<PackReleaseRecord>,
  ) {}

  async install(payload: PackInstallDto) {
    this.logger.log(`Installing pack: ${payload.packCode}@${payload.releaseId}`);

    this.assertArtifactUrlSafe(payload.artifactUrl);

    const verifiedManifest = this.verifyManifestSignature(payload.manifest);

    const existing = await this.releaseRepo.findOne({
      where: {
        packCode: payload.packCode,
        packReleaseId: payload.releaseId,
      },
    });

    if (existing) {
      this.logger.log(`Pack already installed: ${payload.packCode}@${payload.releaseId}`);
      return { status: 'already_installed', packCode: payload.packCode, releaseId: payload.releaseId };
    }

    const status: PackReleaseStatus = 'applying';
    const record = this.releaseRepo.create({
      packCode: payload.packCode,
      packReleaseId: payload.releaseId,
      status,
      manifest: verifiedManifest,
      startedAt: new Date(),
      installSummary: {},
      warnings: [],
      appliedByType: 'system',
    });

    await this.releaseRepo.save(record);

    this.logger.log(`Pack installation started: ${payload.packCode}@${payload.releaseId}`);
    return { status: 'applying', packCode: payload.packCode, releaseId: payload.releaseId };
  }

  async rollback(payload: PackRollbackDto) {
    this.logger.log(`Rolling back pack: ${payload.packCode}@${payload.releaseId}`);

    const record = await this.releaseRepo.findOne({
      where: {
        packCode: payload.packCode,
        packReleaseId: payload.releaseId,
      },
    });

    if (!record) {
      return { status: 'not_found', packCode: payload.packCode, releaseId: payload.releaseId };
    }

    record.status = 'rolled_back';
    await this.releaseRepo.save(record);

    return { status: 'rolled_back', packCode: payload.packCode, releaseId: payload.releaseId };
  }

  async listReleases(query: { packCode?: string; status?: string; limit?: string }) {
    const qb = this.releaseRepo.createQueryBuilder('release');

    if (query.packCode) {
      qb.andWhere('release.packCode = :packCode', { packCode: query.packCode });
    }
    if (query.status) {
      qb.andWhere('release.status = :status', { status: query.status });
    }

    qb.orderBy('release.startedAt', 'DESC');

    if (query.limit) {
      const limitNum = parseInt(query.limit, 10);
      if (!isNaN(limitNum) && limitNum > 0) {
        qb.take(Math.min(limitNum, 200));
      }
    }

    return qb.getMany();
  }

  /**
   * Verifies the manifest's ed25519 signature against PACK_SIGNING_PUBLIC_KEY,
   * then returns the manifest with the `signature` field stripped so the
   * persisted record stores only the validated data.
   *
   * Fails closed: a missing signature, missing public key, or invalid
   * signature all raise BadRequestException. The only escape hatch is
   * PACK_SIGNING_DEV_SKIP=true in non-production environments.
   */
  private verifyManifestSignature(manifest: Record<string, unknown>): Record<string, unknown> {
    const isProd = process.env.NODE_ENV === 'production';
    const devSkip = process.env.PACK_SIGNING_DEV_SKIP === 'true';

    if (devSkip && !isProd) {
      this.logger.warn(
        '!!! PACK_SIGNING_DEV_SKIP=true — pack manifest signature verification is BYPASSED. ' +
          'This MUST NEVER be enabled in production. !!!',
      );
      return this.stripSignature(manifest);
    }

    const publicKey = process.env.PACK_SIGNING_PUBLIC_KEY;
    if (!publicKey) {
      this.logger.error('PACK_SIGNING_PUBLIC_KEY env var is not configured. Failing closed.');
      throw new BadRequestException('Pack manifest signature invalid');
    }

    const signature = manifest['signature'];
    if (typeof signature !== 'string' || signature.length === 0) {
      throw new BadRequestException('Pack manifest signature invalid');
    }

    const manifestWithoutSig = this.stripSignature(manifest);
    const payload = Buffer.from(JSON.stringify(manifestWithoutSig), 'utf8');

    let valid = false;
    try {
      const key = createPublicKey(normalizePublicKey(publicKey));
      valid = cryptoVerify(null, payload, key, Buffer.from(signature, 'base64'));
    } catch (err) {
      this.logger.error(
        `Pack manifest signature verification threw: ${(err as Error).message}`,
      );
      throw new BadRequestException('Pack manifest signature invalid');
    }

    if (!valid) {
      throw new BadRequestException('Pack manifest signature invalid');
    }

    return manifestWithoutSig;
  }

  private stripSignature(manifest: Record<string, unknown>): Record<string, unknown> {
    const out: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(manifest)) {
      if (key === 'signature') {
        continue;
      }
      out[key] = value;
    }
    return out;
  }

  /**
   * Validates the artifactUrl using the platform-wide outbound URL helper.
   * The pack-specific host allowlist is read from PACK_ARTIFACT_HOST_ALLOWLIST
   * (falling back to the platform default) and passed through to the helper.
   */
  private assertArtifactUrlSafe(artifactUrl: string): void {
    const allowlist = this.parseHostAllowlist(process.env.PACK_ARTIFACT_HOST_ALLOWLIST);
    try {
      validateOutboundUrl(artifactUrl, { allowedHosts: allowlist });
    } catch (err) {
      const detail = (err as Error).message.replace(/^Outbound URL invalid:\s*/, '');
      throw new BadRequestException(`artifactUrl invalid: ${detail}`);
    }
  }

  private parseHostAllowlist(raw: string | undefined): string[] {
    if (!raw || !raw.trim()) {
      return DEFAULT_HOST_ALLOWLIST;
    }
    return raw
      .split(',')
      .map((entry) => entry.trim().toLowerCase())
      .filter((entry) => entry.length > 0);
  }
}
