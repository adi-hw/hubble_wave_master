import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  Application,
  ApplicationRevision,
} from '@hubblewave/instance-db';
import { CreateApplicationDto, UpdateApplicationDto } from './application.dto';

/**
 * ApplicationService — CRUD + DRAFT/PUBLISHED lifecycle for the
 * Application registry. Pilots ADR-5 ahead of the broader rollout in
 * Phase 0 Slice C; the operations defined here (createDraft, publish,
 * listRevisions, getCurrent) are the template every other metadata
 * entity will adopt.
 */
@Injectable()
export class ApplicationService {
  constructor(
    @InjectRepository(Application)
    private readonly applicationRepo: Repository<Application>,
    @InjectRepository(ApplicationRevision)
    private readonly revisionRepo: Repository<ApplicationRevision>,
  ) {}

  list(): Promise<Application[]> {
    return this.applicationRepo.find({
      order: { createdAt: 'ASC' },
    });
  }

  async getById(id: string): Promise<Application> {
    const app = await this.applicationRepo.findOne({ where: { id } });
    if (!app) {
      throw new NotFoundException(`Application ${id} not found`);
    }
    return app;
  }

  async getByCode(code: string): Promise<Application> {
    const app = await this.applicationRepo.findOne({ where: { code } });
    if (!app) {
      throw new NotFoundException(`Application ${code} not found`);
    }
    return app;
  }

  /**
   * Creates a new Application in `draft` status with revision 1 (also
   * draft). Publishing is an explicit second call — see `publish`.
   */
  async create(dto: CreateApplicationDto, userId?: string): Promise<Application> {
    const existing = await this.applicationRepo.findOne({
      where: { code: dto.code },
    });
    if (existing) {
      throw new ConflictException(
        `Application with code '${dto.code}' already exists`,
      );
    }

    const application = this.applicationRepo.create({
      code: dto.code,
      name: dto.name,
      description: dto.description ?? null,
      scope: dto.scope ?? null,
      source: 'custom',
      status: 'draft',
      createdBy: userId ?? null,
      updatedBy: userId ?? null,
    });
    const saved = await this.applicationRepo.save(application);

    const revision = this.revisionRepo.create({
      applicationId: saved.id,
      revision: 1,
      status: 'draft',
      payload: this.snapshot(saved),
      createdBy: userId ?? null,
    });
    const savedRevision = await this.revisionRepo.save(revision);

    saved.currentRevisionId = savedRevision.id;
    await this.applicationRepo.save(saved);

    return this.getById(saved.id);
  }

  /**
   * Updates the authoring fields of the Application and creates a new
   * draft revision pointing at the new payload. Does NOT auto-publish;
   * call `publish` to move the revision (and the parent Application's
   * status) into the published state.
   */
  async update(
    id: string,
    dto: UpdateApplicationDto,
    userId?: string,
  ): Promise<Application> {
    const application = await this.getById(id);

    if (dto.name !== undefined) application.name = dto.name;
    if (dto.description !== undefined) {
      application.description = dto.description ?? null;
    }
    if (dto.scope !== undefined) application.scope = dto.scope ?? null;
    application.updatedBy = userId ?? application.updatedBy ?? null;
    await this.applicationRepo.save(application);

    const nextRevisionNumber = await this.nextRevisionNumber(id);
    const revision = this.revisionRepo.create({
      applicationId: id,
      revision: nextRevisionNumber,
      status: 'draft',
      payload: this.snapshot(application),
      createdBy: userId ?? null,
    });
    const savedRevision = await this.revisionRepo.save(revision);

    application.currentRevisionId = savedRevision.id;
    application.status = 'draft';
    await this.applicationRepo.save(application);

    return this.getById(id);
  }

  /**
   * Publishes the current draft revision. Sets the revision status to
   * `published`, stamps publishedBy/publishedAt, and bumps the parent
   * Application to `published`. Idempotent — publishing an already-
   * published revision is a no-op.
   */
  async publish(id: string, userId?: string): Promise<Application> {
    const application = await this.getById(id);
    if (!application.currentRevisionId) {
      throw new NotFoundException(
        `Application ${id} has no current revision to publish`,
      );
    }
    const revision = await this.revisionRepo.findOne({
      where: { id: application.currentRevisionId },
    });
    if (!revision) {
      throw new NotFoundException(
        `Current revision ${application.currentRevisionId} missing`,
      );
    }
    if (revision.status === 'published') {
      return application;
    }
    revision.status = 'published';
    revision.publishedBy = userId ?? null;
    revision.publishedAt = new Date();
    await this.revisionRepo.save(revision);

    application.status = 'published';
    application.updatedBy = userId ?? application.updatedBy ?? null;
    await this.applicationRepo.save(application);

    return this.getById(id);
  }

  listRevisions(applicationId: string): Promise<ApplicationRevision[]> {
    return this.revisionRepo.find({
      where: { applicationId },
      order: { revision: 'DESC' },
    });
  }

  /**
   * Soft-deprecate an Application. Does not cascade — Collections still
   * pointing at it will continue to function. Operators must move
   * Collections out of a deprecated Application before they can drop
   * it; the FK constraint enforces that on hard delete.
   */
  async deprecate(id: string, userId?: string): Promise<Application> {
    const application = await this.getById(id);
    application.status = 'deprecated';
    application.updatedBy = userId ?? application.updatedBy ?? null;
    await this.applicationRepo.save(application);
    return this.getById(id);
  }

  private snapshot(application: Application): Record<string, unknown> {
    return {
      code: application.code,
      name: application.name,
      description: application.description,
      scope: application.scope,
      source: application.source,
    };
  }

  private async nextRevisionNumber(applicationId: string): Promise<number> {
    const max: { max: number | string | null }[] = await this.revisionRepo
      .createQueryBuilder('rev')
      .select('MAX(rev.revision)', 'max')
      .where('rev.application_id = :applicationId', { applicationId })
      .getRawMany();
    const current = Number(max[0]?.max ?? 0);
    return Number.isFinite(current) ? current + 1 : 1;
  }
}
