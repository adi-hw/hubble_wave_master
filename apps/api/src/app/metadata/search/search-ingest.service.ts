import { BadRequestException, ConflictException, Injectable } from '@nestjs/common';
import { EntityManager } from 'typeorm';
import {
  CollectionDefinition,
  SearchDictionary,
  SearchExperience,
  SearchScope,
  SearchSource,
} from '@hubblewave/instance-db';

type SearchAsset = {
  experiences?: SearchExperienceAsset[];
  sources?: SearchSourceAsset[];
  dictionaries?: SearchDictionaryAsset[];
};

type SearchExperienceAsset = {
  code: string;
  name: string;
  description?: string;
  scope: SearchScope;
  scope_key?: string;
  config?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
};

type SearchSourceAsset = {
  code: string;
  name: string;
  description?: string;
  collection_code: string;
  config?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
};

type SearchDictionaryAsset = {
  code: string;
  name: string;
  locale?: string;
  entries?: Array<{ term: string; synonyms: string[] }>;
  metadata?: Record<string, unknown>;
};

@Injectable()
export class SearchIngestService {
  async applyAsset(
    manager: EntityManager,
    rawAsset: unknown,
    context: { packCode: string; releaseId: string; actorId?: string; status?: 'draft' | 'published' | 'deprecated' },
  ): Promise<void> {
    const asset = this.parseAsset(rawAsset);
    const experienceRepo = manager.getRepository(SearchExperience);
    const sourceRepo = manager.getRepository(SearchSource);
    const dictionaryRepo = manager.getRepository(SearchDictionary);
    const collectionRepo = manager.getRepository(CollectionDefinition);

    for (const experience of asset.experiences || []) {
      const existing = await experienceRepo.findOne({ where: { code: experience.code } });
      if (existing) {
        this.assertPackOwnership(existing.metadata, context.packCode, 'experience', experience.code);
        existing.name = experience.name;
        existing.description = experience.description || null;
        existing.scope = experience.scope;
        existing.scopeKey = experience.scope_key || null;
        existing.config = experience.config || {};
        existing.metadata = this.mergeMetadata(experience.metadata, context, existing.metadata);
        existing.isActive = true;
        existing.updatedBy = context.actorId;
        await experienceRepo.save(existing);
      } else {
        const created = experienceRepo.create({
          code: experience.code,
          name: experience.name,
          description: experience.description || null,
          scope: experience.scope,
          scopeKey: experience.scope_key || null,
          config: experience.config || {},
          metadata: this.mergeMetadata(experience.metadata, context),
          isActive: true,
          createdBy: context.actorId,
          updatedBy: context.actorId,
        });
        await experienceRepo.save(created);
      }
    }

    for (const source of asset.sources || []) {
      const collection = await collectionRepo.findOne({ where: { code: source.collection_code, isActive: true } });
      if (!collection) {
        throw new BadRequestException(`Unknown collection ${source.collection_code} for search source ${source.code}`);
      }
      const existing = await sourceRepo.findOne({ where: { code: source.code } });
      if (existing) {
        this.assertPackOwnership(existing.metadata, context.packCode, 'source', source.code);
        existing.name = source.name;
        existing.description = source.description || null;
        existing.collectionCode = source.collection_code;
        existing.config = source.config || {};
        existing.metadata = this.mergeMetadata(source.metadata, context, existing.metadata);
        existing.isActive = true;
        existing.updatedBy = context.actorId;
        await sourceRepo.save(existing);
      } else {
        const created = sourceRepo.create({
          code: source.code,
          name: source.name,
          description: source.description || null,
          collectionCode: source.collection_code,
          config: source.config || {},
          metadata: this.mergeMetadata(source.metadata, context),
          isActive: true,
          createdBy: context.actorId,
          updatedBy: context.actorId,
        });
        await sourceRepo.save(created);
      }
    }

    for (const dictionary of asset.dictionaries || []) {
      const existing = await dictionaryRepo.findOne({ where: { code: dictionary.code } });
      if (existing) {
        this.assertPackOwnership(existing.metadata, context.packCode, 'dictionary', dictionary.code);
        existing.name = dictionary.name;
        existing.locale = dictionary.locale || 'en';
        existing.entries = dictionary.entries || [];
        existing.metadata = this.mergeMetadata(dictionary.metadata, context, existing.metadata);
        existing.isActive = true;
        existing.updatedBy = context.actorId;
        await dictionaryRepo.save(existing);
      } else {
        const created = dictionaryRepo.create({
          code: dictionary.code,
          name: dictionary.name,
          locale: dictionary.locale || 'en',
          entries: dictionary.entries || [],
          metadata: this.mergeMetadata(dictionary.metadata, context),
          isActive: true,
          createdBy: context.actorId,
          updatedBy: context.actorId,
        });
        await dictionaryRepo.save(created);
      }
    }
  }

  async deactivateAsset(
    manager: EntityManager,
    rawAsset: unknown,
    context: { packCode: string; releaseId: string; actorId?: string },
  ): Promise<void> {
    const asset = this.parseAsset(rawAsset);
    const experienceRepo = manager.getRepository(SearchExperience);
    const sourceRepo = manager.getRepository(SearchSource);
    const dictionaryRepo = manager.getRepository(SearchDictionary);

    for (const experience of asset.experiences || []) {
      const existing = await experienceRepo.findOne({ where: { code: experience.code } });
      if (!existing) {
        continue;
      }
      this.assertPackOwnership(existing.metadata, context.packCode, 'experience', experience.code);
      existing.isActive = false;
      existing.metadata = this.mergeMetadata(experience.metadata, { ...context, status: 'deprecated' }, existing.metadata);
      existing.updatedBy = context.actorId;
      await experienceRepo.save(existing);
    }

    for (const source of asset.sources || []) {
      const existing = await sourceRepo.findOne({ where: { code: source.code } });
      if (!existing) {
        continue;
      }
      this.assertPackOwnership(existing.metadata, context.packCode, 'source', source.code);
      existing.isActive = false;
      existing.metadata = this.mergeMetadata(source.metadata, { ...context, status: 'deprecated' }, existing.metadata);
      existing.updatedBy = context.actorId;
      await sourceRepo.save(existing);
    }

    for (const dictionary of asset.dictionaries || []) {
      const existing = await dictionaryRepo.findOne({ where: { code: dictionary.code } });
      if (!existing) {
        continue;
      }
      this.assertPackOwnership(existing.metadata, context.packCode, 'dictionary', dictionary.code);
      existing.isActive = false;
      existing.metadata = this.mergeMetadata(dictionary.metadata, { ...context, status: 'deprecated' }, existing.metadata);
      existing.updatedBy = context.actorId;
      await dictionaryRepo.save(existing);
    }
  }

  private parseAsset(raw: unknown): SearchAsset {
    if (!raw || typeof raw !== 'object') {
      throw new BadRequestException('Search asset must be an object');
    }
    const asset = raw as SearchAsset;
    const hasContent =
      (asset.experiences && asset.experiences.length) ||
      (asset.sources && asset.sources.length) ||
      (asset.dictionaries && asset.dictionaries.length);
    if (!hasContent) {
      throw new BadRequestException('Search asset must include experiences, sources, or dictionaries');
    }

    this.validateExperiences(asset.experiences || []);
    this.validateSources(asset.sources || []);
    this.validateDictionaries(asset.dictionaries || []);

    return asset;
  }

  private validateExperiences(experiences: SearchExperienceAsset[]): void {
    const seen = new Set<string>();
    for (const experience of experiences) {
      if (!experience.code || typeof experience.code !== 'string') {
        throw new BadRequestException('Search experience code is required');
      }
      if (!this.isValidCode(experience.code)) {
        throw new BadRequestException(`Search experience code ${experience.code} is invalid`);
      }
      if (seen.has(experience.code)) {
        throw new BadRequestException(`Duplicate search experience code ${experience.code}`);
      }
      seen.add(experience.code);
      if (!experience.name || typeof experience.name !== 'string') {
        throw new BadRequestException(`Search experience ${experience.code} is missing name`);
      }
      if (!this.isValidScope(experience.scope)) {
        throw new BadRequestException(`Search experience ${experience.code} has invalid scope`);
      }
    }
  }

  private validateSources(sources: SearchSourceAsset[]): void {
    const seen = new Set<string>();
    for (const source of sources) {
      if (!source.code || typeof source.code !== 'string') {
        throw new BadRequestException('Search source code is required');
      }
      if (!this.isValidCode(source.code)) {
        throw new BadRequestException(`Search source code ${source.code} is invalid`);
      }
      if (seen.has(source.code)) {
        throw new BadRequestException(`Duplicate search source code ${source.code}`);
      }
      seen.add(source.code);
      if (!source.name || typeof source.name !== 'string') {
        throw new BadRequestException(`Search source ${source.code} is missing name`);
      }
      if (!source.collection_code || typeof source.collection_code !== 'string') {
        throw new BadRequestException(`Search source ${source.code} is missing collection_code`);
      }
      if (!this.isValidCode(source.collection_code)) {
        throw new BadRequestException(`Search source ${source.code} has invalid collection_code`);
      }
    }
  }

  private validateDictionaries(dictionaries: SearchDictionaryAsset[]): void {
    const seen = new Set<string>();
    for (const dictionary of dictionaries) {
      if (!dictionary.code || typeof dictionary.code !== 'string') {
        throw new BadRequestException('Search dictionary code is required');
      }
      if (!this.isValidCode(dictionary.code)) {
        throw new BadRequestException(`Search dictionary code ${dictionary.code} is invalid`);
      }
      if (seen.has(dictionary.code)) {
        throw new BadRequestException(`Duplicate search dictionary code ${dictionary.code}`);
      }
      seen.add(dictionary.code);
      if (!dictionary.name || typeof dictionary.name !== 'string') {
        throw new BadRequestException(`Search dictionary ${dictionary.code} is missing name`);
      }
      if (dictionary.entries) {
        for (const entry of dictionary.entries) {
          if (!entry.term || typeof entry.term !== 'string') {
            throw new BadRequestException(`Search dictionary ${dictionary.code} has invalid entry term`);
          }
          if (!Array.isArray(entry.synonyms)) {
            throw new BadRequestException(`Search dictionary ${dictionary.code} has invalid synonyms`);
          }
        }
      }
    }
  }

  private mergeMetadata(
    incoming: Record<string, unknown> | undefined,
    context: { packCode: string; releaseId: string; status?: 'draft' | 'published' | 'deprecated' },
    existing: Record<string, unknown> = {},
  ): Record<string, unknown> {
    const existingStatus = (existing as { status?: string }).status;
    const status = context.status || (existingStatus as 'draft' | 'published' | 'deprecated' | undefined) || 'draft';
    return {
      ...existing,
      ...incoming,
      status,
      pack: {
        code: context.packCode,
        release_id: context.releaseId,
      },
    };
  }

  private assertPackOwnership(
    metadata: Record<string, unknown>,
    packCode: string,
    entityType: 'experience' | 'source' | 'dictionary',
    entityCode: string,
  ): void {
    const existingPack = (metadata as { pack?: { code?: string } }).pack?.code;
    if (existingPack && existingPack !== packCode) {
      throw new ConflictException(
        `${entityType} ${entityCode} is owned by pack ${existingPack}`,
      );
    }
  }

  private isValidCode(value: string): boolean {
    return /^[a-z0-9_]+$/.test(value);
  }

  private isValidScope(scope: SearchScope): boolean {
    return scope === 'system' ||
      scope === 'instance' ||
      scope === 'role' ||
      scope === 'group' ||
      scope === 'personal';
  }
}
