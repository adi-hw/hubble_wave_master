import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  AuditLog,
  SearchDictionary,
  SearchExperience,
  SearchIndexState,
  SearchScope,
  SearchSource,
} from '@hubblewave/instance-db';

export type CreateSearchExperienceRequest = {
  code: string;
  name: string;
  description?: string;
  scope: SearchScope;
  scope_key?: string;
  config?: Record<string, unknown>;
};

export type UpdateSearchExperienceRequest = Partial<Omit<CreateSearchExperienceRequest, 'code'>>;

export type CreateSearchSourceRequest = {
  code: string;
  name: string;
  description?: string;
  collection_code: string;
  config?: Record<string, unknown>;
};

export type UpdateSearchSourceRequest = Partial<Omit<CreateSearchSourceRequest, 'code'>>;

export type CreateSearchDictionaryRequest = {
  code: string;
  name: string;
  locale?: string;
  entries?: Array<{ term: string; synonyms: string[] }>;
};

export type UpdateSearchDictionaryRequest = Partial<Omit<CreateSearchDictionaryRequest, 'code'>>;

@Injectable()
export class SearchService {
  constructor(
    @InjectRepository(SearchExperience)
    private readonly experienceRepo: Repository<SearchExperience>,
    @InjectRepository(SearchSource)
    private readonly sourceRepo: Repository<SearchSource>,
    @InjectRepository(SearchDictionary)
    private readonly dictionaryRepo: Repository<SearchDictionary>,
    @InjectRepository(SearchIndexState)
    private readonly indexStateRepo: Repository<SearchIndexState>,
    @InjectRepository(AuditLog)
    private readonly auditRepo: Repository<AuditLog>,
  ) {}

  async listExperiences() {
    return this.experienceRepo.find({ where: { isActive: true }, order: { createdAt: 'DESC' } });
  }

  async createExperience(request: CreateSearchExperienceRequest, actorId?: string) {
    this.assertValidCode(request.code);
    const normalized = this.normalizeScope(request.scope, request.scope_key, actorId);
    const existing = await this.experienceRepo.findOne({ where: { code: request.code } });
    if (existing) {
      throw new BadRequestException(`Search experience ${request.code} already exists`);
    }
    const experience = this.experienceRepo.create({
      code: request.code,
      name: request.name.trim(),
      description: request.description?.trim() || null,
      scope: normalized.scope,
      scopeKey: normalized.scopeKey,
      config: this.ensureObject(request.config),
      metadata: { status: 'published' },
      isActive: true,
      createdBy: actorId || null,
      updatedBy: actorId || null,
    });
    const saved = await this.experienceRepo.save(experience);
    await this.logAudit('search.experience.create', actorId, saved.id, {
      code: saved.code,
      scope: saved.scope,
    });
    return saved;
  }

  async updateExperience(code: string, request: UpdateSearchExperienceRequest, actorId?: string) {
    const experience = await this.experienceRepo.findOne({ where: { code } });
    if (!experience) {
      throw new NotFoundException(`Search experience ${code} not found`);
    }
    if (request.name) {
      experience.name = request.name.trim();
    }
    if (request.description !== undefined) {
      experience.description = request.description?.trim() || null;
    }
    if (request.scope) {
      const normalized = this.normalizeScope(request.scope, request.scope_key, actorId);
      experience.scope = normalized.scope;
      experience.scopeKey = normalized.scopeKey;
    }
    if (request.config) {
      experience.config = this.ensureObject(request.config);
    }
    experience.updatedBy = actorId || null;
    const saved = await this.experienceRepo.save(experience);
    await this.logAudit('search.experience.update', actorId, saved.id, { code: saved.code });
    return saved;
  }

  async publishExperience(code: string, actorId?: string) {
    const experience = await this.experienceRepo.findOne({ where: { code } });
    if (!experience) {
      throw new NotFoundException(`Search experience ${code} not found`);
    }
    experience.isActive = true;
    experience.metadata = this.mergeMetadata(experience.metadata, 'published');
    experience.updatedBy = actorId || null;
    const saved = await this.experienceRepo.save(experience);
    await this.logAudit('search.experience.publish', actorId, saved.id, { code: saved.code });
    return saved;
  }

  async listSources() {
    return this.sourceRepo.find({ where: { isActive: true }, order: { createdAt: 'DESC' } });
  }

  async createSource(request: CreateSearchSourceRequest, actorId?: string) {
    this.assertValidCode(request.code);
    if (!request.collection_code) {
      throw new BadRequestException('collection_code is required');
    }
    const existing = await this.sourceRepo.findOne({ where: { code: request.code } });
    if (existing) {
      throw new BadRequestException(`Search source ${request.code} already exists`);
    }
    const source = this.sourceRepo.create({
      code: request.code,
      name: request.name.trim(),
      description: request.description?.trim() || null,
      collectionCode: request.collection_code,
      config: this.ensureObject(request.config),
      metadata: { status: 'published' },
      isActive: true,
      createdBy: actorId || null,
      updatedBy: actorId || null,
    });
    const saved = await this.sourceRepo.save(source);
    await this.logAudit('search.source.create', actorId, saved.id, {
      code: saved.code,
      collectionCode: saved.collectionCode,
    });
    return saved;
  }

  async updateSource(code: string, request: UpdateSearchSourceRequest, actorId?: string) {
    const source = await this.sourceRepo.findOne({ where: { code } });
    if (!source) {
      throw new NotFoundException(`Search source ${code} not found`);
    }
    if (request.name) {
      source.name = request.name.trim();
    }
    if (request.description !== undefined) {
      source.description = request.description?.trim() || null;
    }
    if (request.collection_code) {
      source.collectionCode = request.collection_code;
    }
    if (request.config) {
      source.config = this.ensureObject(request.config);
    }
    source.updatedBy = actorId || null;
    const saved = await this.sourceRepo.save(source);
    await this.logAudit('search.source.update', actorId, saved.id, { code: saved.code });
    return saved;
  }

  async listDictionaries() {
    return this.dictionaryRepo.find({ where: { isActive: true }, order: { createdAt: 'DESC' } });
  }

  async createDictionary(request: CreateSearchDictionaryRequest, actorId?: string) {
    this.assertValidCode(request.code);
    const existing = await this.dictionaryRepo.findOne({ where: { code: request.code } });
    if (existing) {
      throw new BadRequestException(`Search dictionary ${request.code} already exists`);
    }
    const dictionary = this.dictionaryRepo.create({
      code: request.code,
      name: request.name.trim(),
      locale: request.locale || 'en',
      entries: Array.isArray(request.entries) ? request.entries : [],
      metadata: { status: 'published' },
      isActive: true,
      createdBy: actorId || null,
      updatedBy: actorId || null,
    });
    const saved = await this.dictionaryRepo.save(dictionary);
    await this.logAudit('search.dictionary.create', actorId, saved.id, { code: saved.code });
    return saved;
  }

  async updateDictionary(code: string, request: UpdateSearchDictionaryRequest, actorId?: string) {
    const dictionary = await this.dictionaryRepo.findOne({ where: { code } });
    if (!dictionary) {
      throw new NotFoundException(`Search dictionary ${code} not found`);
    }
    if (request.name) {
      dictionary.name = request.name.trim();
    }
    if (request.locale) {
      dictionary.locale = request.locale;
    }
    if (request.entries) {
      dictionary.entries = request.entries;
    }
    dictionary.updatedBy = actorId || null;
    const saved = await this.dictionaryRepo.save(dictionary);
    await this.logAudit('search.dictionary.update', actorId, saved.id, { code: saved.code });
    return saved;
  }

  async listIndexState(collectionCode?: string) {
    if (collectionCode) {
      const record = await this.indexStateRepo.findOne({ where: { collectionCode } });
      return record ? [record] : [];
    }
    return this.indexStateRepo.find({ order: { updatedAt: 'DESC' } });
  }

  private normalizeScope(
    scope: SearchScope,
    scopeKey?: string,
    actorId?: string,
  ): { scope: SearchScope; scopeKey: string | null } {
    if (scope === 'system' || scope === 'instance') {
      if (scopeKey) {
        throw new BadRequestException('scope_key is not allowed for system or instance scope');
      }
      return { scope, scopeKey: null };
    }
    if (scope === 'role' || scope === 'group') {
      if (!scopeKey) {
        throw new BadRequestException(`scope_key is required for ${scope} scope`);
      }
      return { scope, scopeKey };
    }
    if (scope === 'personal') {
      const key = scopeKey || actorId;
      if (!key) {
        throw new BadRequestException('scope_key is required for personal scope');
      }
      return { scope, scopeKey: key };
    }
    throw new BadRequestException('Invalid search scope');
  }

  private ensureObject(value?: Record<string, unknown>): Record<string, unknown> {
    if (!value) {
      return {};
    }
    if (typeof value !== 'object' || Array.isArray(value)) {
      throw new BadRequestException('config must be an object');
    }
    return value;
  }

  private assertValidCode(code: string) {
    if (!code || !/^[a-z0-9_]+$/.test(code)) {
      throw new BadRequestException('code must be lowercase letters, numbers, or underscore');
    }
  }

  private mergeMetadata(
    existing: Record<string, unknown> = {},
    status: 'draft' | 'published' | 'deprecated',
  ): Record<string, unknown> {
    return {
      ...existing,
      status,
    };
  }

  private async logAudit(
    action: string,
    actorId: string | undefined,
    recordId: string | undefined,
    payload: Record<string, unknown>,
  ) {
    const log = this.auditRepo.create({
      userId: actorId || null,
      action,
      collectionCode: 'search',
      recordId,
      newValues: payload,
    });
    await this.auditRepo.save(log);
  }
}
