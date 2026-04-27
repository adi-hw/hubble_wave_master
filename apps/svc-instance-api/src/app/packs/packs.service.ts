import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { isIP } from 'net';
import { createPublicKey, verify as cryptoVerify } from 'crypto';
import { PackReleaseRecord, PackReleaseStatus } from '@hubblewave/instance-db';
import { normalizePublicKey } from '@hubblewave/packs';
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
   * Validates the artifactUrl against the configured allowlist and refuses any
   * literal private-IP host. DNS-based SSRF protection is deferred to the
   * platform-wide validateOutboundUrl helper (Wave 3).
   */
  private assertArtifactUrlSafe(artifactUrl: string): void {
    let parsed: URL;
    try {
      parsed = new URL(artifactUrl);
    } catch {
      throw new BadRequestException('artifactUrl invalid: not a valid URL');
    }

    if (parsed.protocol !== 'https:') {
      throw new BadRequestException('artifactUrl invalid: must use https');
    }

    const hostname = parsed.hostname.toLowerCase();
    if (!hostname) {
      throw new BadRequestException('artifactUrl invalid: missing hostname');
    }

    if (this.isPrivateIpLiteral(hostname)) {
      throw new BadRequestException('artifactUrl invalid: hostname resolves to private network');
    }

    const allowlist = this.parseHostAllowlist(process.env.PACK_ARTIFACT_HOST_ALLOWLIST);
    if (!allowlist.some((pattern) => this.hostMatches(hostname, pattern))) {
      throw new BadRequestException('artifactUrl invalid: hostname not in allowlist');
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

  private hostMatches(hostname: string, pattern: string): boolean {
    if (pattern === hostname) {
      return true;
    }
    if (pattern.startsWith('*.')) {
      const suffix = pattern.slice(1); // includes the leading dot
      return hostname.endsWith(suffix) && hostname.length > suffix.length;
    }
    return false;
  }

  private isPrivateIpLiteral(hostname: string): boolean {
    // URL parser wraps IPv6 literals in brackets but new URL().hostname strips them.
    const candidate = hostname.startsWith('[') && hostname.endsWith(']')
      ? hostname.slice(1, -1)
      : hostname;
    const family = isIP(candidate);
    if (family === 0) {
      return false;
    }
    if (family === 4) {
      return this.isPrivateIPv4(candidate);
    }
    return this.isPrivateIPv6(candidate);
  }

  private isPrivateIPv4(ip: string): boolean {
    const parts = ip.split('.').map((p) => Number(p));
    if (parts.length !== 4 || parts.some((n) => Number.isNaN(n) || n < 0 || n > 255)) {
      return true; // malformed — treat as unsafe
    }
    const [a, b] = parts;
    if (a === 10) return true;                            // 10.0.0.0/8
    if (a === 127) return true;                           // 127.0.0.0/8
    if (a === 169 && b === 254) return true;              // 169.254.0.0/16
    if (a === 172 && b >= 16 && b <= 31) return true;     // 172.16.0.0/12
    if (a === 192 && b === 168) return true;              // 192.168.0.0/16
    return false;
  }

  private isPrivateIPv6(ip: string): boolean {
    const lowered = ip.toLowerCase();
    if (lowered === '::1') return true;                    // loopback
    if (lowered.startsWith('fe8') || lowered.startsWith('fe9') ||
        lowered.startsWith('fea') || lowered.startsWith('feb')) {
      return true;                                         // fe80::/10
    }
    if (lowered.startsWith('fc') || lowered.startsWith('fd')) {
      return true;                                         // fc00::/7 (unique local)
    }
    return false;
  }
}
