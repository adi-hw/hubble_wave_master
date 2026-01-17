import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PackReleaseRecord, PackReleaseStatus } from '@hubblewave/instance-db';
import { PackInstallPayload, PackRollbackPayload } from './packs.controller';

@Injectable()
export class PacksService {
  private readonly logger = new Logger(PacksService.name);

  constructor(
    @InjectRepository(PackReleaseRecord)
    private readonly releaseRepo: Repository<PackReleaseRecord>,
  ) {}

  async install(payload: PackInstallPayload) {
    this.logger.log(`Installing pack: ${payload.packCode}@${payload.releaseId}`);

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
      manifest: payload.manifest as Record<string, unknown>,
      startedAt: new Date(),
      installSummary: {},
      warnings: [],
      appliedByType: 'system',
    });

    await this.releaseRepo.save(record);

    this.logger.log(`Pack installation started: ${payload.packCode}@${payload.releaseId}`);
    return { status: 'applying', packCode: payload.packCode, releaseId: payload.releaseId };
  }

  async rollback(payload: PackRollbackPayload) {
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
}
