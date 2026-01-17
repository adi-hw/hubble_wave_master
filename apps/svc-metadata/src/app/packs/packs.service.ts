import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, IsNull, LessThan, Raw, Repository } from 'typeorm';
import {
  PackInstallLock,
  PackObjectRevision,
  PackObjectState,
  PackReleaseRecord,
  AuditLog,
  ViewDefinition,
  ViewDefinitionRevision,
  ViewRevisionStatus,
  ViewScope,
  ViewVariant,
  NavigationModule,
  NavigationModuleRevision,
  NavigationRevisionStatus,
  NavigationScope,
  NavigationVariant,
  AutomationRule,
  AutomationAction,
  AutomationActionType,
  AutomationConditionType,
  TriggerTiming,
  TriggerOperation,
  ProcessFlowDefinition,
  ProcessFlowRunAs,
  TriggerType,
  CollectionDefinition,
} from '@hubblewave/instance-db';
import { parseYaml, validatePackManifest, verifyEd25519, sha256 } from '@hubblewave/packs';
import * as unzipper from 'unzipper';
import { randomUUID } from 'crypto';
import { PackInstallRequest, PackReleaseQuery, PackRollbackRequest } from './packs.dto';
import { MetadataIngestService } from '../metadata/metadata-ingest.service';
import { AccessIngestService } from '../access/services/access-ingest.service';
import { SearchIngestService } from '../search/search-ingest.service';
import { AvaIngestService } from '../ava/ava-ingest.service';
import { InsightsIngestService } from '../insights/insights-ingest.service';
import { ConnectorsIngestService } from '../connectors/connectors-ingest.service';
import { LocalizationIngestService } from '../localization/localization-ingest.service';

const RELEASE_ID_PATTERN = /^\d{8}\.\d{3,}$/;

type PackArtifact = {
  manifest: ReturnType<typeof validatePackManifest>;
  checksums: Map<string, string>;
  signature: string;
  artifactSha256: string;
  files: Map<string, Buffer>;
};

type ApplySummary = {
  totalAssets: number;
  appliedAssets: number;
  unchangedAssets: number;
  byType: Record<string, { total: number; applied: number; unchanged: number }>;
};

type PackManager = ReturnType<DataSource['createQueryRunner']>['manager'];

@Injectable()
export class PacksService {
  private readonly logger = new Logger(PacksService.name);

  constructor(
    @InjectRepository(PackReleaseRecord)
    private readonly releaseRepo: Repository<PackReleaseRecord>,
    @InjectRepository(AuditLog)
    private readonly auditRepo: Repository<AuditLog>,
    private readonly dataSource: DataSource,
    private readonly configService: ConfigService,
    private readonly eventEmitter: EventEmitter2,
    private readonly metadataIngestService: MetadataIngestService,
    private readonly accessIngestService: AccessIngestService,
    private readonly searchIngestService: SearchIngestService,
    private readonly avaIngestService: AvaIngestService,
    private readonly insightsIngestService: InsightsIngestService,
    private readonly connectorsIngestService: ConnectorsIngestService,
    private readonly localizationIngestService: LocalizationIngestService,
  ) {}

  async listReleases(query: PackReleaseQuery) {
    const qb = this.releaseRepo.createQueryBuilder('r').orderBy('r.createdAt', 'DESC');
    if (query.packCode) {
      qb.andWhere('r.packCode = :packCode', { packCode: query.packCode });
    }
    if (query.status) {
      qb.andWhere('r.status = :status', { status: query.status });
    }
    const limit = query.limit ? Math.min(Math.max(query.limit, 1), 200) : 50;
    qb.take(limit);
    return qb.getMany();
  }

  async installPack(
    request: PackInstallRequest,
    actorId?: string,
    context?: { ipAddress?: string; userAgent?: string },
  ) {
    const artifact = await this.loadArtifact(request.artifactUrl);
    const manifest = artifact.manifest;
    this.assertManifestMatches(request, manifest);
    this.assertCompatibility(manifest);
    await this.assertDependencies(manifest);

    const lockKey = manifest.install.lock_key;
    const lockHolder = randomUUID();

    await this.acquireLock(lockKey, lockHolder);

    let releaseRecord: PackReleaseRecord | null = null;
    try {
      const existingApplied = await this.releaseRepo.findOne({
        where: {
          packCode: manifest.pack.code,
          packReleaseId: manifest.pack.release_id,
          status: 'applied',
        },
        order: { completedAt: 'DESC' },
      });

      if (existingApplied && existingApplied.artifactSha256 === artifact.artifactSha256) {
        releaseRecord = await this.releaseRepo.save(
          this.releaseRepo.create({
            packCode: manifest.pack.code,
            packReleaseId: manifest.pack.release_id,
            status: 'skipped',
            manifest,
            artifactSha256: artifact.artifactSha256,
            installSummary: { reason: 'already-applied' },
            appliedBy: actorId || null,
            appliedByType: actorId ? 'user' : 'system',
            completedAt: new Date(),
          })
        );
        await this.logAudit('pack.install', actorId, context, {
          packCode: manifest.pack.code,
          releaseId: manifest.pack.release_id,
          status: 'skipped',
          releaseRecordId: releaseRecord.id,
        });
        return { releaseRecord, summary: releaseRecord.installSummary };
      }

      releaseRecord = await this.releaseRepo.save(
        this.releaseRepo.create({
          packCode: manifest.pack.code,
          packReleaseId: manifest.pack.release_id,
          status: 'applying',
          manifest,
          artifactSha256: artifact.artifactSha256,
          warnings: [],
          appliedBy: actorId || null,
          appliedByType: actorId ? 'user' : 'system',
        })
      );

      const summary = await this.applyAssets(releaseRecord, manifest, artifact.files);

      releaseRecord.status = 'applied';
      releaseRecord.installSummary = summary;
      releaseRecord.completedAt = new Date();
      await this.releaseRepo.save(releaseRecord);

      this.eventEmitter.emit('pack.applied', {
        packCode: manifest.pack.code,
        releaseId: manifest.pack.release_id,
        releaseRecordId: releaseRecord.id,
      });

      await this.logAudit('pack.install', actorId, context, {
        packCode: manifest.pack.code,
        releaseId: manifest.pack.release_id,
        status: 'applied',
        releaseRecordId: releaseRecord.id,
      });

      return { releaseRecord, summary };
    } catch (error) {
      const message = (error as Error).message || 'Pack install failed';
      if (releaseRecord) {
        releaseRecord.status = 'failed';
        releaseRecord.completedAt = new Date();
        releaseRecord.warnings = [{ message }];
        await this.releaseRepo.save(releaseRecord);
      }
      this.logger.error(message, (error as Error).stack);
      throw error;
    } finally {
      await this.releaseLock(lockKey, lockHolder);
    }
  }

  async rollbackPack(
    request: PackRollbackRequest,
    actorId?: string,
    context?: { ipAddress?: string; userAgent?: string },
  ) {
    const target = await this.resolveRollbackTarget(request);
    if (target.status !== 'applied') {
      throw new ConflictException('Only applied releases can be rolled back');
    }

    const lockKey = this.resolveLockKey(target);
    const lockHolder = randomUUID();

    await this.acquireLock(lockKey, lockHolder);

    let rollbackRecord: PackReleaseRecord | null = null;
    try {
      rollbackRecord = await this.releaseRepo.save(
        this.releaseRepo.create({
          packCode: target.packCode,
          packReleaseId: target.packReleaseId,
          status: 'applying',
          manifest: target.manifest,
          artifactSha256: target.artifactSha256 || null,
          rollbackOfReleaseId: target.id,
          appliedBy: actorId || null,
          appliedByType: actorId ? 'user' : 'system',
        })
      );

      const summary = await this.applyRollback(target, rollbackRecord);

      rollbackRecord.status = 'applied';
      rollbackRecord.installSummary = summary;
      rollbackRecord.completedAt = new Date();
      await this.releaseRepo.save(rollbackRecord);

      target.status = 'rolled_back';
      target.completedAt = target.completedAt || new Date();
      await this.releaseRepo.save(target);

      this.eventEmitter.emit('pack.rolled_back', {
        packCode: target.packCode,
        releaseId: target.packReleaseId,
        releaseRecordId: target.id,
      });

      await this.logAudit('pack.rollback', actorId, context, {
        packCode: target.packCode,
        releaseId: target.packReleaseId,
        status: 'rolled_back',
        releaseRecordId: target.id,
      });

      return { releaseRecord: rollbackRecord, summary };
    } catch (error) {
      const message = (error as Error).message || 'Pack rollback failed';
      if (rollbackRecord) {
        rollbackRecord.status = 'failed';
        rollbackRecord.completedAt = new Date();
        rollbackRecord.warnings = [{ message }];
        await this.releaseRepo.save(rollbackRecord);
      }
      this.logger.error(message, (error as Error).stack);
      throw error;
    } finally {
      await this.releaseLock(lockKey, lockHolder);
    }
  }

  private async applyAssets(
    releaseRecord: PackReleaseRecord,
    manifest: ReturnType<typeof validatePackManifest>,
    files: Map<string, Buffer>,
  ): Promise<ApplySummary> {
    const summary: ApplySummary = {
      totalAssets: 0,
      appliedAssets: 0,
      unchangedAssets: 0,
      byType: {},
    };

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      for (const assetType of manifest.install.apply_order) {
        const assets = manifest.assets.filter((asset) => asset.type === assetType);
        if (!summary.byType[assetType]) {
          summary.byType[assetType] = { total: 0, applied: 0, unchanged: 0 };
        }
        for (const asset of assets) {
          summary.totalAssets += 1;
          summary.byType[assetType].total += 1;

          const filePath = `pack/${asset.path}`;
          const file = files.get(filePath);
          if (!file) {
            throw new BadRequestException(`Missing asset file: ${asset.path}`);
          }
          const objectHash = sha256(file);
          const objectKey = `${asset.type}:${asset.path}`;
          const parsed = this.parseAssetContent(asset.type, file.toString('utf8'));
          const existingState = await queryRunner.manager.findOne(PackObjectState, {
            where: { objectType: asset.type, objectKey },
          });
          let objectId: string | null = existingState?.objectId || null;
          if (existingState && existingState.packCode !== manifest.pack.code) {
            throw new ConflictException(
              `Asset ${asset.path} is already owned by pack ${existingState.packCode}`
            );
          }
          if (existingState && existingState.currentHash === objectHash) {
            summary.unchangedAssets += 1;
            summary.byType[assetType].unchanged += 1;
            continue;
          }

          const revision = queryRunner.manager.create(PackObjectRevision, {
            releaseRecordId: releaseRecord.id,
            objectType: asset.type,
            objectKey,
            objectHash,
            content: parsed,
            createdBy: releaseRecord.appliedBy || null,
          });
          const savedRevision = await queryRunner.manager.save(PackObjectRevision, revision);

          if (asset.type === 'metadata') {
              await this.metadataIngestService.applyAsset(
                queryRunner.manager,
                parsed.data,
                {
                  packCode: manifest.pack.code,
                  releaseId: manifest.pack.release_id,
                  actorId: releaseRecord.appliedBy || undefined,
                  status: 'published',
                },
              );
          }
          if (asset.type === 'views') {
            objectId = await this.applyViewAsset(queryRunner.manager, parsed, {
              actorId: releaseRecord.appliedBy || undefined,
            });
          }
          if (asset.type === 'navigation') {
            objectId = await this.applyNavigationAsset(queryRunner.manager, parsed, {
              actorId: releaseRecord.appliedBy || undefined,
            });
          }
          if (asset.type === 'connectors') {
            await this.applyConnectorsAsset(queryRunner.manager, parsed, {
              packCode: manifest.pack.code,
              releaseId: manifest.pack.release_id,
              actorId: releaseRecord.appliedBy || undefined,
            });
          }
          if (asset.type === 'automation') {
            objectId = await this.applyAutomationAsset(
              queryRunner.manager,
              parsed,
              {
                packCode: manifest.pack.code,
                releaseId: manifest.pack.release_id,
                actorId: releaseRecord.appliedBy || undefined,
                existingObjectId: existingState?.objectId || null,
              },
            );
          }
          if (asset.type === 'workflows') {
            objectId = await this.applyWorkflowAsset(
              queryRunner.manager,
              parsed,
              {
                packCode: manifest.pack.code,
                releaseId: manifest.pack.release_id,
                actorId: releaseRecord.appliedBy || undefined,
                existingObjectId: existingState?.objectId || null,
              },
            );
          }
          if (asset.type === 'access') {
            await this.applyAccessAsset(queryRunner.manager, parsed, {
              packCode: manifest.pack.code,
              releaseId: manifest.pack.release_id,
              actorId: releaseRecord.appliedBy || undefined,
            });
          }
          if (asset.type === 'search') {
            await this.applySearchAsset(queryRunner.manager, parsed, {
              packCode: manifest.pack.code,
              releaseId: manifest.pack.release_id,
              actorId: releaseRecord.appliedBy || undefined,
            });
          }
          if (asset.type === 'localization') {
            await this.applyLocalizationAsset(queryRunner.manager, parsed, {
              packCode: manifest.pack.code,
              releaseId: manifest.pack.release_id,
              actorId: releaseRecord.appliedBy || undefined,
            });
          }
          if (asset.type === 'ava') {
            await this.applyAvaAsset(queryRunner.manager, parsed, {
              packCode: manifest.pack.code,
              releaseId: manifest.pack.release_id,
              actorId: releaseRecord.appliedBy || undefined,
            });
          }
          if (asset.type === 'insights') {
            await this.applyInsightsAsset(queryRunner.manager, parsed, {
              packCode: manifest.pack.code,
              releaseId: manifest.pack.release_id,
              actorId: releaseRecord.appliedBy || undefined,
            });
          }

          if (existingState) {
            existingState.currentRevisionId = savedRevision.id;
            existingState.currentHash = objectHash;
            existingState.objectId = objectId;
            existingState.isActive = true;
            await queryRunner.manager.save(PackObjectState, existingState);
          } else {
            const newState = queryRunner.manager.create(PackObjectState, {
              objectType: asset.type,
              objectKey,
              packCode: manifest.pack.code,
              currentRevisionId: savedRevision.id,
              currentHash: objectHash,
              objectId,
              isActive: true,
            });
            await queryRunner.manager.save(PackObjectState, newState);
          }

          summary.appliedAssets += 1;
          summary.byType[assetType].applied += 1;
        }
      }

      await queryRunner.commitTransaction();
      return summary;
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  private async applyRollback(
    target: PackReleaseRecord,
    rollbackRecord: PackReleaseRecord,
  ): Promise<ApplySummary> {
    const summary: ApplySummary = {
      totalAssets: 0,
      appliedAssets: 0,
      unchangedAssets: 0,
      byType: {},
    };

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const revisions = await queryRunner.manager.find(PackObjectRevision, {
        where: { releaseRecordId: target.id },
        order: { createdAt: 'DESC' },
      });

      for (const revision of revisions) {
        const assetType = revision.objectType;
        if (!summary.byType[assetType]) {
          summary.byType[assetType] = { total: 0, applied: 0, unchanged: 0 };
        }
        summary.totalAssets += 1;
        summary.byType[assetType].total += 1;

        const state = await queryRunner.manager.findOne(PackObjectState, {
          where: { objectType: revision.objectType, objectKey: revision.objectKey },
        });
        if (!state || state.currentRevisionId !== revision.id) {
          summary.unchangedAssets += 1;
          summary.byType[assetType].unchanged += 1;
          continue;
        }

        const previousRevision = await queryRunner.manager.findOne(PackObjectRevision, {
          where: {
            objectType: revision.objectType,
            objectKey: revision.objectKey,
            createdAt: LessThan(revision.createdAt),
          },
          order: { createdAt: 'DESC' },
        });

        if (revision.objectType === 'metadata') {
          if (previousRevision) {
            const releaseId = await this.resolveReleaseId(
              queryRunner.manager,
              previousRevision.releaseRecordId,
              target.packReleaseId
            );
            const payload = this.extractMetadataPayload(previousRevision.content);
              await this.metadataIngestService.applyAsset(queryRunner.manager, payload, {
                packCode: target.packCode,
                releaseId,
                actorId: rollbackRecord.appliedBy || undefined,
                status: 'published',
              });
          } else {
            const payload = this.extractMetadataPayload(revision.content);
            await this.metadataIngestService.deactivateAsset(queryRunner.manager, payload, {
              packCode: target.packCode,
              releaseId: target.packReleaseId,
              actorId: rollbackRecord.appliedBy || undefined,
            });
          }
        }
        if (revision.objectType === 'views') {
          if (previousRevision) {
            await this.applyViewAsset(queryRunner.manager, previousRevision.content, {
              actorId: rollbackRecord.appliedBy || undefined,
            });
          } else {
            await this.deactivateViewAsset(queryRunner.manager, revision.content, {
              actorId: rollbackRecord.appliedBy || undefined,
            });
          }
        }
        if (revision.objectType === 'navigation') {
          if (previousRevision) {
            await this.applyNavigationAsset(queryRunner.manager, previousRevision.content, {
              actorId: rollbackRecord.appliedBy || undefined,
            });
          } else {
            await this.deactivateNavigationAsset(queryRunner.manager, revision.content, {
              actorId: rollbackRecord.appliedBy || undefined,
            });
          }
        }
        if (revision.objectType === 'connectors') {
          if (previousRevision) {
            await this.applyConnectorsAsset(queryRunner.manager, previousRevision.content, {
              packCode: target.packCode,
              releaseId: target.packReleaseId,
              actorId: rollbackRecord.appliedBy || undefined,
            });
          } else {
            await this.deactivateConnectorsAsset(queryRunner.manager, revision.content, {
              packCode: target.packCode,
              releaseId: target.packReleaseId,
              actorId: rollbackRecord.appliedBy || undefined,
            });
          }
        }
        if (revision.objectType === 'automation') {
          if (previousRevision) {
            await this.applyAutomationAsset(queryRunner.manager, previousRevision.content, {
              packCode: target.packCode,
              releaseId: target.packReleaseId,
              actorId: rollbackRecord.appliedBy || undefined,
              existingObjectId: state?.objectId || null,
            });
          } else {
            await this.deactivateAutomationAsset(queryRunner.manager, revision.content, {
              actorId: rollbackRecord.appliedBy || undefined,
              existingObjectId: state?.objectId || null,
            });
          }
        }
        if (revision.objectType === 'workflows') {
          if (previousRevision) {
            await this.applyWorkflowAsset(queryRunner.manager, previousRevision.content, {
              packCode: target.packCode,
              releaseId: target.packReleaseId,
              actorId: rollbackRecord.appliedBy || undefined,
              existingObjectId: state?.objectId || null,
            });
          } else {
            await this.deactivateWorkflowAsset(queryRunner.manager, revision.content, {
              actorId: rollbackRecord.appliedBy || undefined,
              existingObjectId: state?.objectId || null,
            });
          }
        }
        if (revision.objectType === 'access') {
          if (previousRevision) {
            await this.applyAccessAsset(queryRunner.manager, previousRevision.content, {
              packCode: target.packCode,
              releaseId: target.packReleaseId,
              actorId: rollbackRecord.appliedBy || undefined,
            });
          } else {
            await this.deactivateAccessAsset(queryRunner.manager, revision.content, {
              packCode: target.packCode,
              releaseId: target.packReleaseId,
              actorId: rollbackRecord.appliedBy || undefined,
            });
          }
        }
        if (revision.objectType === 'search') {
          if (previousRevision) {
            await this.applySearchAsset(queryRunner.manager, previousRevision.content, {
              packCode: target.packCode,
              releaseId: target.packReleaseId,
              actorId: rollbackRecord.appliedBy || undefined,
            });
          } else {
            await this.deactivateSearchAsset(queryRunner.manager, revision.content, {
              packCode: target.packCode,
              releaseId: target.packReleaseId,
              actorId: rollbackRecord.appliedBy || undefined,
            });
          }
        }
        if (revision.objectType === 'localization') {
          if (previousRevision) {
            await this.applyLocalizationAsset(queryRunner.manager, previousRevision.content, {
              packCode: target.packCode,
              releaseId: target.packReleaseId,
              actorId: rollbackRecord.appliedBy || undefined,
            });
          } else {
            await this.deactivateLocalizationAsset(queryRunner.manager, revision.content, {
              packCode: target.packCode,
              releaseId: target.packReleaseId,
              actorId: rollbackRecord.appliedBy || undefined,
            });
          }
        }
        if (revision.objectType === 'ava') {
          if (previousRevision) {
            await this.applyAvaAsset(queryRunner.manager, previousRevision.content, {
              packCode: target.packCode,
              releaseId: target.packReleaseId,
              actorId: rollbackRecord.appliedBy || undefined,
            });
          } else {
            await this.deactivateAvaAsset(queryRunner.manager, revision.content, {
              packCode: target.packCode,
              releaseId: target.packReleaseId,
              actorId: rollbackRecord.appliedBy || undefined,
            });
          }
        }
        if (revision.objectType === 'insights') {
          if (previousRevision) {
            await this.applyInsightsAsset(queryRunner.manager, previousRevision.content, {
              packCode: target.packCode,
              releaseId: target.packReleaseId,
              actorId: rollbackRecord.appliedBy || undefined,
            });
          } else {
            await this.deactivateInsightsAsset(queryRunner.manager, revision.content, {
              packCode: target.packCode,
              releaseId: target.packReleaseId,
              actorId: rollbackRecord.appliedBy || undefined,
            });
          }
        }

        if (previousRevision) {
          state.currentRevisionId = previousRevision.id;
          state.currentHash = previousRevision.objectHash;
          state.isActive = true;
        } else {
          state.isActive = false;
        }
        await queryRunner.manager.save(PackObjectState, state);

        summary.appliedAssets += 1;
        summary.byType[assetType].applied += 1;
      }

      rollbackRecord.installSummary = summary;
      await queryRunner.manager.save(PackReleaseRecord, rollbackRecord);

      await queryRunner.commitTransaction();
      return summary;
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  private extractMetadataPayload(content: Record<string, unknown>): Record<string, unknown> {
    return this.extractPackPayload(content);
  }

  private extractPackPayload(content: Record<string, unknown>): Record<string, unknown> {
    const format = (content as { format?: string }).format;
    if (format === 'yaml' && (content as { data?: Record<string, unknown> }).data) {
      return (content as { data: Record<string, unknown> }).data;
    }
    if ((content as { data?: Record<string, unknown> }).data) {
      return (content as { data: Record<string, unknown> }).data;
    }
    return content;
  }

  private extractViewPayloads(content: Record<string, unknown>): Record<string, unknown>[] {
    const payload = this.extractPackPayload(content);
    const views = (payload as { views?: unknown }).views;
    if (Array.isArray(views)) {
      return views.filter((item): item is Record<string, unknown> => !!item && typeof item === 'object');
    }
    const view = (payload as { view?: unknown }).view;
    if (view && typeof view === 'object') {
      return [view as Record<string, unknown>];
    }
    if (payload && typeof payload === 'object') {
      return [payload];
    }
    return [];
  }

  private extractNavigationPayloads(content: Record<string, unknown>): Record<string, unknown>[] {
    const payload = this.extractPackPayload(content);
    const modules = (payload as { navigation?: unknown }).navigation;
    if (Array.isArray(modules)) {
      return modules.filter((item): item is Record<string, unknown> => !!item && typeof item === 'object');
    }
    if (payload && typeof payload === 'object') {
      return [payload];
    }
    return [];
  }

  private extractAutomationPayloads(content: Record<string, unknown>): Record<string, unknown>[] {
    const payload = this.extractPackPayload(content);
    const automations = (payload as { automations?: unknown }).automations;
    if (Array.isArray(automations)) {
      return automations.filter((item): item is Record<string, unknown> => !!item && typeof item === 'object');
    }
    const automation = (payload as { automation?: unknown }).automation;
    if (automation && typeof automation === 'object') {
      return [automation as Record<string, unknown>];
    }
    if (payload && typeof payload === 'object') {
      return [payload];
    }
    return [];
  }

  private extractWorkflowPayloads(content: Record<string, unknown>): Record<string, unknown>[] {
    const payload = this.extractPackPayload(content);
    const workflows = (payload as { workflows?: unknown }).workflows;
    if (Array.isArray(workflows)) {
      return workflows.filter((item): item is Record<string, unknown> => !!item && typeof item === 'object');
    }
    const workflow = (payload as { workflow?: unknown }).workflow;
    if (workflow && typeof workflow === 'object') {
      return [workflow as Record<string, unknown>];
    }
    if (payload && typeof payload === 'object') {
      return [payload];
    }
    return [];
  }

  private extractAccessPayload(content: Record<string, unknown>): Record<string, unknown> {
    const payload = this.extractPackPayload(content);
    const access = (payload as { access?: unknown }).access;
    if (access && typeof access === 'object') {
      return access as Record<string, unknown>;
    }
    return payload;
  }

  private extractSearchPayload(content: Record<string, unknown>): Record<string, unknown> {
    const payload = this.extractPackPayload(content);
    const search = (payload as { search?: unknown }).search;
    if (search && typeof search === 'object') {
      return search as Record<string, unknown>;
    }
    return payload;
  }

  private extractLocalizationPayload(content: Record<string, unknown>): Record<string, unknown> {
    const payload = this.extractPackPayload(content);
    const localization = (payload as { localization?: unknown }).localization;
    if (localization && typeof localization === 'object') {
      return localization as Record<string, unknown>;
    }
    return payload;
  }

  private extractAvaPayload(content: Record<string, unknown>): Record<string, unknown> {
    const payload = this.extractPackPayload(content);
    const ava = (payload as { ava?: unknown }).ava;
    if (ava && typeof ava === 'object') {
      return ava as Record<string, unknown>;
    }
    return payload;
  }

  private extractInsightsPayload(content: Record<string, unknown>): Record<string, unknown> {
    const payload = this.extractPackPayload(content);
    const insights = (payload as { insights?: unknown }).insights;
    if (insights && typeof insights === 'object') {
      return insights as Record<string, unknown>;
    }
    return payload;
  }

  private extractConnectorsPayload(content: Record<string, unknown>): Record<string, unknown> {
    const payload = this.extractPackPayload(content);
    const connectors = (payload as { connectors?: unknown }).connectors;
    if (connectors && typeof connectors === 'object') {
      return connectors as Record<string, unknown>;
    }
    return payload;
  }

  private async applyViewAsset(
    manager: PackManager,
    content: Record<string, unknown>,
    context: { actorId?: string }
  ): Promise<string | null> {
    const payloads = this.extractViewPayloads(content);
    if (payloads.length === 0) {
      throw new BadRequestException('View asset payload is empty');
    }

    let primaryId: string | null = null;
    for (const payload of payloads) {
      const normalized = this.normalizeViewPayload(payload);

      const existing = await manager.findOne(ViewDefinition, { where: { code: normalized.code } });
      const definition = existing
        ? await this.updateViewDefinition(manager, existing, normalized, context.actorId)
        : await this.createViewDefinition(manager, normalized, context.actorId);

      await this.ensureViewVariant(manager, definition, normalized.variant, context.actorId);
      await this.createViewRevision(manager, definition, normalized, context.actorId);

      if (!primaryId) {
        primaryId = definition.id;
      }
    }

    return payloads.length === 1 ? primaryId : null;
  }

  private async applyNavigationAsset(
    manager: PackManager,
    content: Record<string, unknown>,
    context: { actorId?: string }
  ): Promise<string | null> {
    const payloads = this.extractNavigationPayloads(content);
    if (payloads.length === 0) {
      throw new BadRequestException('Navigation asset payload is empty');
    }

    let primaryId: string | null = null;
    for (const payload of payloads) {
      const normalized = this.normalizeNavigationPayload(payload);

      const existing = await manager.findOne(NavigationModule, { where: { code: normalized.code } });
      const module = existing
        ? await this.updateNavigationModule(manager, existing, normalized, context.actorId)
        : await this.createNavigationModule(manager, normalized, context.actorId);

      await this.ensureNavigationVariant(manager, module, normalized.variant, context.actorId);
      await this.createNavigationRevision(manager, module, normalized, context.actorId);

      if (!primaryId) {
        primaryId = module.id;
      }
    }

    return payloads.length === 1 ? primaryId : null;
  }

  private async applyAutomationAsset(
    manager: PackManager,
    content: Record<string, unknown>,
    context: { packCode: string; releaseId: string; actorId?: string; existingObjectId?: string | null }
  ): Promise<string | null> {
    const payloads = this.extractAutomationPayloads(content);
    if (payloads.length === 0) {
      throw new BadRequestException('Automation asset payload is empty');
    }

    let primaryId: string | null = null;
    for (const payload of payloads) {
      const normalized = this.normalizeAutomationPayload(payload);
      const collection = await manager.findOne(CollectionDefinition, {
        where: { code: normalized.collectionCode, isActive: true },
      });
      if (!collection) {
        throw new BadRequestException(`Automation collection not found: ${normalized.collectionCode}`);
      }

      let rule: AutomationRule | null = null;
      if (context.existingObjectId && payloads.length === 1) {
        rule = await manager.findOne(AutomationRule, { where: { id: context.existingObjectId } });
      }
      if (!rule) {
        rule = await manager.findOne(AutomationRule, {
          where: {
            collectionId: collection.id,
            metadata: Raw((alias) => `${alias} ->> 'code' = :code`, { code: normalized.code }),
          },
        });
      }

      if (!rule) {
        rule = manager.create(AutomationRule, {
          name: normalized.name,
          description: normalized.description,
          collectionId: collection.id,
          triggerTiming: normalized.triggerTiming as TriggerTiming,
          triggerOperations: normalized.triggerOperations as TriggerOperation[],
          watchProperties: normalized.watchProperties,
          conditionType: normalized.conditionType as AutomationConditionType,
          condition: normalized.condition,
          conditionScript: normalized.conditionScript,
          actionType: normalized.actionType as AutomationActionType,
          actions: normalized.actions as AutomationAction[] | undefined,
          script: normalized.script,
          abortOnError: normalized.abortOnError,
          executionOrder: normalized.executionOrder,
          isActive: true,
          isSystem: true,
          metadata: {
            code: normalized.code,
            packCode: context.packCode,
            releaseId: context.releaseId,
            status: 'published',
          },
          createdBy: context.actorId || undefined,
          updatedBy: context.actorId || undefined,
        } as Partial<AutomationRule>);
      } else {
        rule.name = normalized.name;
        rule.description = normalized.description;
        rule.triggerTiming = normalized.triggerTiming as TriggerTiming;
        rule.triggerOperations = normalized.triggerOperations as TriggerOperation[];
        rule.watchProperties = normalized.watchProperties;
        rule.conditionType = normalized.conditionType as AutomationConditionType;
        rule.condition = normalized.condition;
        rule.conditionScript = normalized.conditionScript;
        rule.actionType = normalized.actionType as AutomationActionType;
        rule.actions = normalized.actions as AutomationAction[] | undefined;
        rule.script = normalized.script;
        rule.abortOnError = normalized.abortOnError;
        rule.executionOrder = normalized.executionOrder;
        rule.isActive = true;
        rule.metadata = this.mergeMetadata(rule.metadata || {}, {
          code: normalized.code,
          packCode: context.packCode,
          releaseId: context.releaseId,
          status: 'published',
        });
        rule.updatedBy = context.actorId || undefined;
      }

      const saved = await manager.save(AutomationRule, rule);
      if (!primaryId) {
        primaryId = saved.id;
      }
    }

    return payloads.length === 1 ? primaryId : null;
  }

  private async applyWorkflowAsset(
    manager: PackManager,
    content: Record<string, unknown>,
    context: { packCode: string; releaseId: string; actorId?: string; existingObjectId?: string | null }
  ): Promise<string | null> {
    const payloads = this.extractWorkflowPayloads(content);
    if (payloads.length === 0) {
      throw new BadRequestException('Workflow asset payload is empty');
    }

    let primaryId: string | null = null;
    for (const payload of payloads) {
      const normalized = this.normalizeWorkflowPayload(payload);

      let definition: ProcessFlowDefinition | null = null;
      if (context.existingObjectId && payloads.length === 1) {
        definition = await manager.findOne(ProcessFlowDefinition, {
          where: { id: context.existingObjectId },
        });
      }
      if (!definition) {
        definition = await manager.findOne(ProcessFlowDefinition, { where: { code: normalized.code } });
      }

      const collectionId = await this.resolveCollectionId(manager, normalized.collectionCode);
      if (!definition) {
        definition = manager.create(ProcessFlowDefinition, {
          code: normalized.code,
          name: normalized.name,
          description: normalized.description,
          collectionId: collectionId ?? undefined,
          triggerType: normalized.triggerType as TriggerType,
          triggerConditions: normalized.triggerConditions,
          triggerSchedule: normalized.triggerSchedule,
          triggerFilter: normalized.triggerFilter,
          runAs: normalized.runAs as ProcessFlowRunAs,
          timeoutMinutes: normalized.timeoutMinutes,
          maxRetries: normalized.maxRetries,
          canvas: normalized.canvas,
          version: 1,
          isActive: true,
          createdBy: context.actorId || undefined,
          updatedBy: context.actorId || undefined,
        } as Partial<ProcessFlowDefinition>);
      } else {
        definition.name = normalized.name;
        definition.description = normalized.description;
        definition.collectionId = collectionId ?? undefined;
        definition.triggerType = normalized.triggerType as TriggerType;
        definition.triggerConditions = normalized.triggerConditions;
        definition.triggerSchedule = normalized.triggerSchedule;
        definition.triggerFilter = normalized.triggerFilter;
        definition.runAs = normalized.runAs as ProcessFlowRunAs;
        definition.timeoutMinutes = normalized.timeoutMinutes;
        definition.maxRetries = normalized.maxRetries;
        definition.canvas = normalized.canvas;
        definition.version = definition.version + 1;
        definition.isActive = true;
        definition.updatedBy = context.actorId || undefined;
      }

      const saved = await manager.save(ProcessFlowDefinition, definition);
      if (!primaryId) {
        primaryId = saved.id;
      }
    }

    return payloads.length === 1 ? primaryId : null;
  }

  private async applyAccessAsset(
    manager: PackManager,
    content: Record<string, unknown>,
    context: { packCode: string; releaseId: string; actorId?: string }
  ): Promise<void> {
    const payload = this.extractAccessPayload(content);
    await this.accessIngestService.applyAsset(manager, payload, {
      packCode: context.packCode,
      releaseId: context.releaseId,
      actorId: context.actorId,
      status: 'published',
    });
  }

  private async applySearchAsset(
    manager: PackManager,
    content: Record<string, unknown>,
    context: { packCode: string; releaseId: string; actorId?: string }
  ): Promise<void> {
    const payload = this.extractSearchPayload(content);
    await this.searchIngestService.applyAsset(manager, payload, {
      packCode: context.packCode,
      releaseId: context.releaseId,
      actorId: context.actorId,
      status: 'published',
    });
  }

  private async applyLocalizationAsset(
    manager: PackManager,
    content: Record<string, unknown>,
    context: { packCode: string; releaseId: string; actorId?: string }
  ): Promise<void> {
    const payload = this.extractLocalizationPayload(content);
    await this.localizationIngestService.applyAsset(manager, payload, {
      packCode: context.packCode,
      releaseId: context.releaseId,
      actorId: context.actorId,
      status: 'published',
    });
  }

  private async applyAvaAsset(
    manager: PackManager,
    content: Record<string, unknown>,
    context: { packCode: string; releaseId: string; actorId?: string }
  ): Promise<void> {
    const payload = this.extractAvaPayload(content);
    await this.avaIngestService.applyAsset(manager, payload, {
      packCode: context.packCode,
      releaseId: context.releaseId,
      actorId: context.actorId,
      status: 'published',
    });
  }

  private async applyInsightsAsset(
    manager: PackManager,
    content: Record<string, unknown>,
    context: { packCode: string; releaseId: string; actorId?: string }
  ) {
    const payload = this.extractInsightsPayload(content);
    await this.insightsIngestService.applyAsset(manager, payload, {
      packCode: context.packCode,
      releaseId: context.releaseId,
      actorId: context.actorId,
      status: 'published',
    });
  }

  private async applyConnectorsAsset(
    manager: PackManager,
    content: Record<string, unknown>,
    context: { packCode: string; releaseId: string; actorId?: string }
  ) {
    const payload = this.extractConnectorsPayload(content);
    await this.connectorsIngestService.applyAsset(manager, payload, {
      packCode: context.packCode,
      releaseId: context.releaseId,
      actorId: context.actorId,
      status: 'published',
    });
  }

  private async deactivateViewAsset(
    manager: PackManager,
    content: Record<string, unknown>,
    context: { actorId?: string }
  ) {
    const payloads = this.extractViewPayloads(content);
    for (const payload of payloads) {
      const normalized = this.normalizeViewPayload(payload);
      const definition = await manager.findOne(ViewDefinition, { where: { code: normalized.code } });
      if (!definition) {
        continue;
      }
      definition.isActive = false;
      definition.updatedBy = context.actorId || undefined;
      definition.metadata = this.mergeMetadata(definition.metadata, { status: 'inactive' });
      await manager.save(ViewDefinition, definition);
      await manager.update(
        ViewVariant,
        { definitionId: definition.id },
        { isActive: false, updatedBy: context.actorId || null }
      );
    }
  }

  private async deactivateNavigationAsset(
    manager: PackManager,
    content: Record<string, unknown>,
    context: { actorId?: string }
  ) {
    const payloads = this.extractNavigationPayloads(content);
    for (const payload of payloads) {
      const normalized = this.normalizeNavigationPayload(payload);
      const module = await manager.findOne(NavigationModule, { where: { code: normalized.code } });
      if (!module) {
        continue;
      }
      module.isActive = false;
      module.updatedBy = context.actorId || null;
      module.metadata = this.mergeMetadata(module.metadata, { status: 'inactive' });
      await manager.save(NavigationModule, module);
      await manager.update(
        NavigationVariant,
        { moduleId: module.id },
        { isActive: false, updatedBy: context.actorId || null }
      );
    }
  }

  private async deactivateAutomationAsset(
    manager: PackManager,
    content: Record<string, unknown>,
    context: { actorId?: string; existingObjectId?: string | null }
  ) {
    const payloads = this.extractAutomationPayloads(content);
    for (const payload of payloads) {
      const normalized = this.normalizeAutomationPayload(payload);
      const rule = context.existingObjectId
        ? await manager.findOne(AutomationRule, { where: { id: context.existingObjectId } })
        : await manager.findOne(AutomationRule, {
            where: {
              metadata: Raw((alias) => `${alias} ->> 'code' = :code`, { code: normalized.code }),
            },
          });
      if (!rule) {
        continue;
      }
      rule.isActive = false;
      rule.updatedBy = context.actorId || undefined;
      rule.metadata = this.mergeMetadata(rule.metadata || {}, { status: 'inactive' });
      await manager.save(AutomationRule, rule);
    }
  }

  private async deactivateWorkflowAsset(
    manager: PackManager,
    content: Record<string, unknown>,
    context: { actorId?: string; existingObjectId?: string | null }
  ) {
    const payloads = this.extractWorkflowPayloads(content);
    for (const payload of payloads) {
      const normalized = this.normalizeWorkflowPayload(payload);
      const definition = context.existingObjectId
        ? await manager.findOne(ProcessFlowDefinition, { where: { id: context.existingObjectId } })
        : await manager.findOne(ProcessFlowDefinition, { where: { code: normalized.code } });
      if (!definition) {
        continue;
      }
      definition.isActive = false;
      definition.updatedBy = context.actorId || undefined;
      await manager.save(ProcessFlowDefinition, definition);
    }
  }

  private async deactivateAccessAsset(
    manager: PackManager,
    content: Record<string, unknown>,
    context: { packCode: string; releaseId: string; actorId?: string }
  ) {
    const payload = this.extractAccessPayload(content);
    await this.accessIngestService.deactivateAsset(manager, payload, {
      packCode: context.packCode,
      releaseId: context.releaseId,
      actorId: context.actorId,
    });
  }

  private async deactivateSearchAsset(
    manager: PackManager,
    content: Record<string, unknown>,
    context: { packCode: string; releaseId: string; actorId?: string }
  ) {
    const payload = this.extractSearchPayload(content);
    await this.searchIngestService.deactivateAsset(manager, payload, {
      packCode: context.packCode,
      releaseId: context.releaseId,
      actorId: context.actorId,
    });
  }

  private async deactivateLocalizationAsset(
    manager: PackManager,
    content: Record<string, unknown>,
    context: { packCode: string; releaseId: string; actorId?: string }
  ) {
    const payload = this.extractLocalizationPayload(content);
    await this.localizationIngestService.deactivateAsset(manager, payload, {
      packCode: context.packCode,
      releaseId: context.releaseId,
      actorId: context.actorId,
    });
  }

  private async deactivateAvaAsset(
    manager: PackManager,
    content: Record<string, unknown>,
    context: { packCode: string; releaseId: string; actorId?: string }
  ) {
    const payload = this.extractAvaPayload(content);
    await this.avaIngestService.deactivateAsset(manager, payload, {
      packCode: context.packCode,
      releaseId: context.releaseId,
      actorId: context.actorId,
    });
  }

  private async deactivateInsightsAsset(
    manager: PackManager,
    content: Record<string, unknown>,
    context: { packCode: string; releaseId: string; actorId?: string }
  ) {
    const payload = this.extractInsightsPayload(content);
    await this.insightsIngestService.deactivateAsset(manager, payload, {
      packCode: context.packCode,
      releaseId: context.releaseId,
      actorId: context.actorId,
    });
  }

  private async deactivateConnectorsAsset(
    manager: PackManager,
    content: Record<string, unknown>,
    context: { packCode: string; releaseId: string; actorId?: string }
  ) {
    const payload = this.extractConnectorsPayload(content);
    await this.connectorsIngestService.deactivateAsset(manager, payload, {
      packCode: context.packCode,
      releaseId: context.releaseId,
      actorId: context.actorId,
    });
  }

  private normalizeViewPayload(payload: Record<string, unknown>) {
    const code = this.readString(payload, 'code');
    const name = this.readString(payload, 'name');
    const kind = this.readString(payload, 'kind');
    const description = this.readOptionalString(payload, 'description');
    const targetCollectionCode =
      this.readOptionalString(payload, 'target_collection_code')
      || this.readOptionalString(payload, 'targetCollectionCode');
    const variant = payload['variant'];

    if (!code || !this.isValidCode(code)) {
      throw new BadRequestException('view.code must be lowercase letters, numbers, or underscore');
    }
    if (!name) {
      throw new BadRequestException('view.name is required');
    }
    if (!kind || !['form', 'list', 'page'].includes(kind)) {
      throw new BadRequestException('view.kind must be form, list, or page');
    }
    if ((kind === 'form' || kind === 'list') && !targetCollectionCode) {
      throw new BadRequestException('view.target_collection_code is required for form and list');
    }
    if (!variant || typeof variant !== 'object') {
      throw new BadRequestException('view.variant is required');
    }

    return {
      code,
      name,
      kind: kind as ViewDefinition['kind'],
      description,
      targetCollectionCode,
      layout: this.ensureObject(payload['layout']),
      widgetBindings: this.ensureObject(payload['widget_bindings']),
      actions: this.ensureObject(payload['actions']),
      variant: this.normalizeViewVariant(variant as Record<string, unknown>),
    };
  }

  private normalizeNavigationPayload(payload: Record<string, unknown>) {
    const code = this.readString(payload, 'code');
    const name = this.readString(payload, 'name');
    const description = this.readOptionalString(payload, 'description');
    const variant = payload['variant'];

    if (!code || !this.isValidCode(code)) {
      throw new BadRequestException('navigation.code must be lowercase letters, numbers, or underscore');
    }
    if (!name) {
      throw new BadRequestException('navigation.name is required');
    }
    if (!variant || typeof variant !== 'object') {
      throw new BadRequestException('navigation.variant is required');
    }

    return {
      code,
      name,
      description,
      layout: this.ensureObject(payload['layout']),
      variant: this.normalizeNavigationVariant(variant as Record<string, unknown>),
    };
  }

  private normalizeAutomationPayload(payload: Record<string, unknown>) {
    const code = this.readString(payload, 'code');
    const name = this.readString(payload, 'name');
    const description = this.readOptionalString(payload, 'description');
    const collectionCode =
      this.readOptionalString(payload, 'collection_code') ||
      this.readOptionalString(payload, 'collectionCode') ||
      this.readOptionalString(payload, 'collection');
    const triggerTiming =
      this.readOptionalString(payload, 'trigger_timing') ||
      this.readOptionalString(payload, 'triggerTiming') ||
      'after';
    const triggerOperations =
      this.readStringArray(payload, 'trigger_operations') ||
      this.readStringArray(payload, 'triggerOperations') ||
      ['insert', 'update'];
    const watchProperties =
      this.readStringArray(payload, 'watch_properties') ||
      this.readStringArray(payload, 'watchProperties') ||
      undefined;
    const conditionType =
      this.readOptionalString(payload, 'condition_type') ||
      this.readOptionalString(payload, 'conditionType') ||
      'always';
    const conditionScript =
      this.readOptionalString(payload, 'condition_script') ||
      this.readOptionalString(payload, 'conditionScript');
    const actionType =
      this.readOptionalString(payload, 'action_type') ||
      this.readOptionalString(payload, 'actionType') ||
      'no_code';
    const actions = Array.isArray(payload['actions']) ? payload['actions'] as Record<string, unknown>[] : undefined;
    const script = this.readOptionalString(payload, 'script');
    const abortOnError = this.readBoolean(payload, 'abort_on_error', false);
    const executionOrder = this.readOptionalNumber(payload, 'execution_order', 100);

    if (!code || !this.isValidCode(code)) {
      throw new BadRequestException('automation.code must be lowercase letters, numbers, or underscore');
    }
    if (!name) {
      throw new BadRequestException('automation.name is required');
    }
    if (!collectionCode) {
      throw new BadRequestException('automation.collection_code is required');
    }

    return {
      code,
      name,
      description,
      collectionCode,
      triggerTiming,
      triggerOperations,
      watchProperties,
      conditionType,
      condition: this.ensureObject(payload['condition']),
      conditionScript,
      actionType,
      actions,
      script,
      abortOnError,
      executionOrder,
    };
  }

  private normalizeWorkflowPayload(payload: Record<string, unknown>) {
    const code = this.readString(payload, 'code');
    const name = this.readString(payload, 'name');
    const description = this.readOptionalString(payload, 'description');
    const collectionCode =
      this.readOptionalString(payload, 'collection_code') ||
      this.readOptionalString(payload, 'collectionCode');
    const triggerType =
      this.readOptionalString(payload, 'trigger_type') ||
      this.readOptionalString(payload, 'triggerType') ||
      'manual';
    const runAs =
      this.readOptionalString(payload, 'run_as') ||
      this.readOptionalString(payload, 'runAs') ||
      'system';
    const timeoutMinutes = this.readOptionalNumber(payload, 'timeout_minutes', 60);
    const maxRetries = this.readOptionalNumber(payload, 'max_retries', 3);
    const canvas = this.readOptionalObject(payload, 'canvas') as ProcessFlowDefinition['canvas'] | undefined;

    if (!code || !this.isValidCode(code)) {
      throw new BadRequestException('workflow.code must be lowercase letters, numbers, or underscore');
    }
    if (!name) {
      throw new BadRequestException('workflow.name is required');
    }

    return {
      code,
      name,
      description,
      collectionCode,
      triggerType,
      triggerConditions: this.readOptionalObject(payload, 'trigger_conditions'),
      triggerSchedule: this.readOptionalString(payload, 'trigger_schedule'),
      triggerFilter: this.readOptionalObject(payload, 'trigger_filter'),
      runAs,
      timeoutMinutes,
      maxRetries,
      canvas: {
        nodes: Array.isArray(canvas?.nodes) ? canvas?.nodes || [] : [],
        connections: Array.isArray(canvas?.connections) ? canvas?.connections || [] : [],
      },
    };
  }

  private normalizeViewVariant(variant: Record<string, unknown>) {
    const scope = this.readString(variant, 'scope') as ViewScope;
    const scopeKey = this.readOptionalString(variant, 'scope_key') || null;
    const priority = this.readOptionalNumber(variant, 'priority', 100);

    if (!scope || !['system', 'instance', 'role', 'group', 'personal'].includes(scope)) {
      throw new BadRequestException('view.variant.scope must be a valid scope');
    }
    if (['role', 'group', 'personal'].includes(scope) && !scopeKey) {
      throw new BadRequestException('view.variant.scope_key is required for role, group, and personal scopes');
    }
    return { scope, scopeKey, priority };
  }

  private normalizeNavigationVariant(variant: Record<string, unknown>) {
    const scope = this.readString(variant, 'scope') as NavigationScope;
    const scopeKey = this.readOptionalString(variant, 'scope_key') || null;
    const priority = this.readOptionalNumber(variant, 'priority', 100);

    if (!scope || !['system', 'instance', 'role', 'group', 'personal'].includes(scope)) {
      throw new BadRequestException('navigation.variant.scope must be a valid scope');
    }
    if (['role', 'group', 'personal'].includes(scope) && !scopeKey) {
      throw new BadRequestException('navigation.variant.scope_key is required for role, group, and personal scopes');
    }
    return { scope, scopeKey, priority };
  }

  private async createViewDefinition(
    manager: PackManager,
    payload: ReturnType<typeof this.normalizeViewPayload>,
    actorId?: string
  ) {
    const definition = manager.create(ViewDefinition, {
      code: payload.code,
      name: payload.name,
      description: payload.description,
      kind: payload.kind,
      targetCollectionCode: payload.targetCollectionCode || null,
      metadata: this.mergeMetadata({}, { status: 'published' }),
      isActive: true,
      createdBy: actorId || null,
      updatedBy: actorId || null,
    });
    return manager.save(ViewDefinition, definition);
  }

  private async updateViewDefinition(
    manager: PackManager,
    existing: ViewDefinition,
    payload: ReturnType<typeof this.normalizeViewPayload>,
    actorId?: string
  ) {
    if (existing.kind !== payload.kind) {
      throw new ConflictException(`View ${payload.code} kind mismatch`);
    }
    if ((existing.targetCollectionCode || null) !== (payload.targetCollectionCode || null)) {
      throw new ConflictException(`View ${payload.code} target collection mismatch`);
    }
    existing.name = payload.name;
    existing.description = payload.description;
    existing.updatedBy = actorId || null;
    existing.metadata = this.mergeMetadata(existing.metadata, { status: 'published' });
    return manager.save(ViewDefinition, existing);
  }

  private async ensureViewVariant(
    manager: PackManager,
    definition: ViewDefinition,
    variant: { scope: ViewScope; scopeKey: string | null; priority: number },
    actorId?: string
  ) {
    const existing = await manager.findOne(ViewVariant, {
      where: {
        definitionId: definition.id,
        scope: variant.scope,
        scopeKey: variant.scopeKey === null ? IsNull() : variant.scopeKey,
        isActive: true,
      },
    });
    if (existing) {
      return existing;
    }
    const created = manager.create(ViewVariant, {
      definitionId: definition.id,
      scope: variant.scope,
      scopeKey: variant.scopeKey,
      priority: variant.priority,
      isActive: true,
      createdBy: actorId || null,
      updatedBy: actorId || null,
    });
    return manager.save(ViewVariant, created);
  }

  private async createViewRevision(
    manager: PackManager,
    definition: ViewDefinition,
    payload: ReturnType<typeof this.normalizeViewPayload>,
    actorId?: string
  ) {
    const latest = await manager.findOne(ViewDefinitionRevision, {
      where: { definitionId: definition.id },
      order: { revision: 'DESC' },
    });
    const revisionNumber = (latest?.revision || 0) + 1;
    const revision = manager.create(ViewDefinitionRevision, {
      definitionId: definition.id,
      revision: revisionNumber,
      status: 'published' as ViewRevisionStatus,
      layout: payload.layout,
      widgetBindings: payload.widgetBindings,
      actions: payload.actions,
      createdBy: actorId || null,
      publishedBy: actorId || null,
      publishedAt: new Date(),
    });
    return manager.save(ViewDefinitionRevision, revision);
  }

  private async createNavigationModule(
    manager: PackManager,
    payload: ReturnType<typeof this.normalizeNavigationPayload>,
    actorId?: string
  ) {
    const module = manager.create(NavigationModule, {
      code: payload.code,
      name: payload.name,
      description: payload.description,
      metadata: this.mergeMetadata({}, { status: 'published' }),
      isActive: true,
      createdBy: actorId || null,
      updatedBy: actorId || null,
    });
    return manager.save(NavigationModule, module);
  }

  private async updateNavigationModule(
    manager: PackManager,
    existing: NavigationModule,
    payload: ReturnType<typeof this.normalizeNavigationPayload>,
    actorId?: string
  ) {
    existing.name = payload.name;
    existing.description = payload.description;
    existing.updatedBy = actorId || null;
    existing.metadata = this.mergeMetadata(existing.metadata, { status: 'published' });
    return manager.save(NavigationModule, existing);
  }

  private async ensureNavigationVariant(
    manager: PackManager,
    module: NavigationModule,
    variant: { scope: NavigationScope; scopeKey: string | null; priority: number },
    actorId?: string
  ) {
    const existing = await manager.findOne(NavigationVariant, {
      where: {
        moduleId: module.id,
        scope: variant.scope,
        scopeKey: variant.scopeKey === null ? IsNull() : variant.scopeKey,
        isActive: true,
      },
    });
    if (existing) {
      return existing;
    }
    const created = manager.create(NavigationVariant, {
      moduleId: module.id,
      scope: variant.scope,
      scopeKey: variant.scopeKey,
      priority: variant.priority,
      isActive: true,
      createdBy: actorId || null,
      updatedBy: actorId || null,
    });
    return manager.save(NavigationVariant, created);
  }

  private async createNavigationRevision(
    manager: PackManager,
    module: NavigationModule,
    payload: ReturnType<typeof this.normalizeNavigationPayload>,
    actorId?: string
  ) {
    const latest = await manager.findOne(NavigationModuleRevision, {
      where: { moduleId: module.id },
      order: { revision: 'DESC' },
    });
    const revisionNumber = (latest?.revision || 0) + 1;
    const revision = manager.create(NavigationModuleRevision, {
      moduleId: module.id,
      revision: revisionNumber,
      status: 'published' as NavigationRevisionStatus,
      layout: payload.layout,
      createdBy: actorId || null,
      publishedBy: actorId || null,
      publishedAt: new Date(),
    });
    return manager.save(NavigationModuleRevision, revision);
  }

  private mergeMetadata(
    current: Record<string, unknown>,
    updates: Record<string, unknown>
  ): Record<string, unknown> {
    return { ...current, ...updates };
  }

  private readString(payload: Record<string, unknown>, key: string): string {
    const value = payload[key];
    if (typeof value === 'string') {
      return value.trim();
    }
    return '';
  }

  private readOptionalString(payload: Record<string, unknown>, key: string): string | undefined {
    const value = payload[key];
    if (typeof value === 'string') {
      const trimmed = value.trim();
      return trimmed.length > 0 ? trimmed : undefined;
    }
    return undefined;
  }

  private readOptionalNumber(payload: Record<string, unknown>, key: string, fallback: number): number {
    const value = payload[key];
    if (typeof value === 'number' && Number.isFinite(value)) {
      return value;
    }
    return fallback;
  }

  private readStringArray(payload: Record<string, unknown>, key: string): string[] | undefined {
    const value = payload[key];
    if (Array.isArray(value)) {
      const normalized = value
        .filter((entry) => typeof entry === 'string')
        .map((entry) => entry.trim())
        .filter(Boolean);
      return normalized.length > 0 ? normalized : undefined;
    }
    if (typeof value === 'string') {
      const normalized = value
        .split(',')
        .map((entry) => entry.trim())
        .filter(Boolean);
      return normalized.length > 0 ? normalized : undefined;
    }
    return undefined;
  }

  private readBoolean(payload: Record<string, unknown>, key: string, fallback: boolean): boolean {
    const value = payload[key];
    if (typeof value === 'boolean') {
      return value;
    }
    if (typeof value === 'string') {
      const normalized = value.trim().toLowerCase();
      if (normalized === 'true') {
        return true;
      }
      if (normalized === 'false') {
        return false;
      }
    }
    if (typeof value === 'number') {
      return value !== 0;
    }
    return fallback;
  }

  private readOptionalObject(
    payload: Record<string, unknown>,
    key: string
  ): Record<string, unknown> | undefined {
    const value = payload[key];
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      return value as Record<string, unknown>;
    }
    if (typeof value === 'string') {
      const trimmed = value.trim();
      if (!trimmed) {
        return undefined;
      }
      try {
        const parsed = JSON.parse(trimmed);
        if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
          return parsed as Record<string, unknown>;
        }
      } catch (error) {
        throw new BadRequestException(`Invalid ${key} JSON payload`);
      }
    }
    return undefined;
  }

  private ensureObject(value: unknown): Record<string, unknown> {
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      return value as Record<string, unknown>;
    }
    return {};
  }

  private isValidCode(value: string): boolean {
    return /^[a-z0-9_]+$/.test(value);
  }

  private async resolveCollectionId(
    manager: PackManager,
    collectionCode?: string
  ): Promise<string | null> {
    if (!collectionCode) {
      return null;
    }
    const collection = await manager.findOne(CollectionDefinition, {
      where: { code: collectionCode, isActive: true },
    });
    if (!collection) {
      throw new BadRequestException(`Unknown collection code: ${collectionCode}`);
    }
    return collection.id;
  }

  private async resolveReleaseId(
    manager: ReturnType<DataSource['createQueryRunner']>['manager'],
    releaseRecordId: string,
    fallbackReleaseId: string
  ): Promise<string> {
    const record = await manager.findOne(PackReleaseRecord, { where: { id: releaseRecordId } });
    return record?.packReleaseId || fallbackReleaseId;
  }

  private async resolveRollbackTarget(request: PackRollbackRequest): Promise<PackReleaseRecord> {
    if (request.releaseRecordId) {
      const record = await this.releaseRepo.findOne({ where: { id: request.releaseRecordId } });
      if (!record) {
        throw new NotFoundException('Pack release record not found');
      }
      return record;
    }
    if (!request.packCode || !request.releaseId) {
      throw new BadRequestException('packCode and releaseId are required for rollback');
    }
    const record = await this.releaseRepo.findOne({
      where: {
        packCode: request.packCode,
        packReleaseId: request.releaseId,
        status: 'applied',
      },
      order: { completedAt: 'DESC' },
    });
    if (!record) {
      throw new NotFoundException('Applied pack release not found');
    }
    const latest = await this.releaseRepo.findOne({
      where: { packCode: request.packCode, status: 'applied' },
      order: { completedAt: 'DESC' },
    });
    if (latest && latest.id !== record.id) {
      throw new ConflictException('Only the latest applied release can be rolled back');
    }
    return record;
  }

  private resolveLockKey(record: PackReleaseRecord): string {
    const manifest = record.manifest as ReturnType<typeof validatePackManifest>;
    const lockKey = manifest?.install?.lock_key;
    return typeof lockKey === 'string' && lockKey.length > 0 ? lockKey : 'packs.install';
  }

  private async acquireLock(lockKey: string, lockHolder: string) {
    const ttlSeconds = this.getLockTtlSeconds();
    const now = new Date();
    const expiresAt = new Date(now.getTime() + ttlSeconds * 1000);

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const existing = await queryRunner.manager.findOne(PackInstallLock, {
        where: { lockKey },
        lock: { mode: 'pessimistic_write' },
      });

      if (existing && existing.lockExpiresAt && existing.lockExpiresAt > now) {
        throw new ConflictException(`Pack install already in progress for ${lockKey}`);
      }

      if (existing) {
        existing.lockHolder = lockHolder;
        existing.lockAcquiredAt = now;
        existing.lockExpiresAt = expiresAt;
        await queryRunner.manager.save(PackInstallLock, existing);
      } else {
        const lock = queryRunner.manager.create(PackInstallLock, {
          lockKey,
          lockHolder,
          lockAcquiredAt: now,
          lockExpiresAt: expiresAt,
        });
        await queryRunner.manager.save(PackInstallLock, lock);
      }

      await queryRunner.commitTransaction();
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  private async releaseLock(lockKey: string, lockHolder: string) {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const existing = await queryRunner.manager.findOne(PackInstallLock, {
        where: { lockKey },
        lock: { mode: 'pessimistic_write' },
      });
      if (existing && existing.lockHolder === lockHolder) {
        existing.lockHolder = null;
        existing.lockAcquiredAt = null;
        existing.lockExpiresAt = null;
        await queryRunner.manager.save(PackInstallLock, existing);
      }
      await queryRunner.commitTransaction();
    } catch (error) {
      await queryRunner.rollbackTransaction();
      this.logger.warn(`Failed to release lock ${lockKey}: ${(error as Error).message}`);
    } finally {
      await queryRunner.release();
    }
  }

  private getLockTtlSeconds(): number {
    const raw = this.configService.get<string>('PACK_INSTALL_LOCK_TTL_SECONDS') || '600';
    const parsed = Number(raw);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : 600;
  }

  private parseAssetContent(type: string, raw: string): Record<string, unknown> {
    if (type === 'seed') {
      const entries = raw
        .split('\n')
        .map((line) => line.trim())
        .filter(Boolean)
        .map((line) => {
          try {
            return JSON.parse(line) as Record<string, unknown>;
          } catch (error) {
            throw new BadRequestException(`Invalid seed JSONL entry: ${(error as Error).message}`);
          }
        });
      return { format: 'jsonl', entries };
    }
    return { format: 'yaml', data: parseYaml(raw) };
  }

  private async loadArtifact(url: string): Promise<PackArtifact> {
    if (!url || typeof url !== 'string') {
      throw new BadRequestException('artifactUrl is required');
    }
    const timeoutMs = this.getDownloadTimeoutMs();
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetch(url, { signal: controller.signal });
      if (!response.ok) {
        throw new BadRequestException(`Failed to download pack artifact: ${response.status}`);
      }
      const buffer = Buffer.from(await response.arrayBuffer());
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

      return { manifest, checksums, signature, artifactSha256, files: fileMap };
    } catch (error) {
      if ((error as Error).name === 'AbortError') {
        throw new BadRequestException('Pack artifact download timed out');
      }
      throw error;
    } finally {
      clearTimeout(timeoutId);
    }
  }

  private getDownloadTimeoutMs(): number {
    const raw = this.configService.get<string>('PACK_ARTIFACT_DOWNLOAD_TIMEOUT_MS') || '60000';
    const parsed = Number(raw);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : 60000;
  }

  private requireFile(files: Map<string, Buffer>, path: string): Buffer {
    const file = files.get(path);
    if (!file) {
      throw new BadRequestException(`Missing required artifact file: ${path}`);
    }
    return file;
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

  private loadPublicKeys(): Record<string, string> {
    const raw = this.configService.get<string>('PACK_SIGNING_PUBLIC_KEYS');
    if (!raw) {
      throw new BadRequestException('PACK_SIGNING_PUBLIC_KEYS is not configured');
    }
    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch (error) {
      throw new BadRequestException('PACK_SIGNING_PUBLIC_KEYS must be valid JSON');
    }
    if (!parsed || typeof parsed !== 'object') {
      throw new BadRequestException('PACK_SIGNING_PUBLIC_KEYS must be a key map');
    }
    return parsed as Record<string, string>;
  }

  private assertManifestMatches(
    request: PackInstallRequest,
    manifest: ReturnType<typeof validatePackManifest>,
  ) {
    if (request.packCode !== manifest.pack.code) {
      throw new BadRequestException('Pack code does not match manifest');
    }
    if (request.releaseId !== manifest.pack.release_id) {
      throw new BadRequestException('Release id does not match manifest');
    }
    const requestManifest = request.manifest as Record<string, unknown> | undefined;
    const requestPack = requestManifest && (requestManifest as any).pack;
    if (requestPack) {
      const requestPackCode = (requestPack as any).code;
      const requestReleaseId = (requestPack as any).release_id;
      if (requestPackCode && requestPackCode !== manifest.pack.code) {
        throw new BadRequestException('Request manifest pack code does not match artifact');
      }
      if (requestReleaseId && requestReleaseId !== manifest.pack.release_id) {
        throw new BadRequestException('Request manifest release id does not match artifact');
      }
    }
  }

  private assertCompatibility(manifest: ReturnType<typeof validatePackManifest>) {
    const platformReleaseId = this.configService.get<string>('PLATFORM_RELEASE_ID');
    if (!platformReleaseId) {
      throw new BadRequestException('PLATFORM_RELEASE_ID is not configured');
    }
    if (
      this.compareReleaseId(platformReleaseId, manifest.compatibility.platform_min_release_id) < 0 ||
      this.compareReleaseId(platformReleaseId, manifest.compatibility.platform_max_release_id) > 0
    ) {
      throw new BadRequestException('Pack compatibility does not include this platform release');
    }
  }

  private async assertDependencies(manifest: ReturnType<typeof validatePackManifest>) {
    if (!manifest.dependencies || manifest.dependencies.length === 0) {
      return;
    }
    for (const dep of manifest.dependencies) {
      const latest = await this.releaseRepo.findOne({
        where: { packCode: dep.code, status: 'applied' },
        order: { completedAt: 'DESC' },
      });
      if (!latest) {
        throw new ConflictException(`Missing dependency pack ${dep.code}`);
      }
      if (this.compareReleaseId(latest.packReleaseId, dep.min_release_id) < 0) {
        throw new ConflictException(
          `Dependency ${dep.code} requires ${dep.min_release_id} or higher`
        );
      }
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

  private async logAudit(
    action: string,
    actorId: string | undefined,
    context: { ipAddress?: string; userAgent?: string } | undefined,
    payload: Record<string, unknown>,
  ) {
    const log = this.auditRepo.create({
      userId: actorId || null,
      action,
      collectionCode: 'pack_release_records',
      recordId: payload.releaseRecordId as string | undefined,
      newValues: payload,
      ipAddress: context?.ipAddress,
      userAgent: context?.userAgent,
    });
    await this.auditRepo.save(log);
  }
}
