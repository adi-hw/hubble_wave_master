import { BadRequestException, ConflictException, Injectable } from '@nestjs/common';
import { EntityManager } from 'typeorm';
import {
  Locale,
  LocaleDirection,
  TranslationKey,
  TranslationStatus,
  TranslationValue,
} from '@hubblewave/instance-db';

type LocalizationAsset = {
  locales?: LocaleAsset[];
  keys?: TranslationKeyAsset[];
  values?: TranslationValueAsset[];
};

type LocaleAsset = {
  code: string;
  name: string;
  direction?: LocaleDirection;
  metadata?: Record<string, unknown>;
};

type TranslationKeyAsset = {
  namespace: string;
  key: string;
  default_text: string;
  description?: string;
  metadata?: Record<string, unknown>;
};

type TranslationValueAsset = {
  locale: string;
  namespace: string;
  key: string;
  text: string;
  status?: TranslationStatus;
  metadata?: Record<string, unknown>;
};

@Injectable()
export class LocalizationIngestService {
  async applyAsset(
    manager: EntityManager,
    rawAsset: unknown,
    context: { packCode: string; releaseId: string; actorId?: string; status?: 'draft' | 'published' | 'deprecated' },
  ): Promise<void> {
    const asset = this.parseAsset(rawAsset);
    const localeRepo = manager.getRepository(Locale);
    const keyRepo = manager.getRepository(TranslationKey);
    const valueRepo = manager.getRepository(TranslationValue);

    for (const locale of asset.locales || []) {
      const existing = await localeRepo.findOne({ where: { code: locale.code } });
      if (existing) {
        this.assertPackOwnership(existing.metadata, context.packCode, 'locale', locale.code);
        existing.name = locale.name;
        existing.direction = locale.direction || 'ltr';
        existing.metadata = this.mergeMetadata(locale.metadata, context, existing.metadata);
        existing.isActive = true;
        existing.updatedBy = context.actorId;
        await localeRepo.save(existing);
      } else {
        const created = localeRepo.create({
          code: locale.code,
          name: locale.name,
          direction: locale.direction || 'ltr',
          metadata: this.mergeMetadata(locale.metadata, context),
          isActive: true,
          createdBy: context.actorId,
          updatedBy: context.actorId,
        });
        await localeRepo.save(created);
      }
    }

    for (const key of asset.keys || []) {
      const existing = await keyRepo.findOne({
        where: { namespace: key.namespace, key: key.key },
      });
      if (existing) {
        this.assertPackOwnership(existing.metadata, context.packCode, 'translation_key', `${key.namespace}.${key.key}`);
        existing.defaultText = key.default_text;
        existing.description = key.description || null;
        existing.metadata = this.mergeMetadata(key.metadata, context, existing.metadata);
        existing.isActive = true;
        existing.updatedBy = context.actorId;
        await keyRepo.save(existing);
      } else {
        const created = keyRepo.create({
          namespace: key.namespace,
          key: key.key,
          defaultText: key.default_text,
          description: key.description || null,
          metadata: this.mergeMetadata(key.metadata, context),
          isActive: true,
          createdBy: context.actorId,
          updatedBy: context.actorId,
        });
        await keyRepo.save(created);
      }
    }

    for (const value of asset.values || []) {
      const locale = await localeRepo.findOne({ where: { code: value.locale } });
      if (!locale) {
        throw new BadRequestException(`Unknown locale ${value.locale} for translation value`);
      }
      const key = await keyRepo.findOne({
        where: { namespace: value.namespace, key: value.key },
      });
      if (!key) {
        throw new BadRequestException(
          `Unknown translation key ${value.namespace}.${value.key} for locale ${value.locale}`,
        );
      }

      const existing = await valueRepo.findOne({
        where: { localeId: locale.id, translationKeyId: key.id },
      });
      const status = value.status || 'published';
      if (existing) {
        this.assertPackOwnership(
          existing.metadata,
          context.packCode,
          'translation_value',
          `${value.namespace}.${value.key}:${value.locale}`,
        );
        existing.text = value.text;
        existing.status = status;
        existing.metadata = this.mergeMetadata(value.metadata, context, existing.metadata);
        existing.isActive = true;
        existing.updatedBy = context.actorId;
        await valueRepo.save(existing);
      } else {
        const created = valueRepo.create({
          localeId: locale.id,
          translationKeyId: key.id,
          text: value.text,
          status,
          metadata: this.mergeMetadata(value.metadata, context),
          isActive: true,
          createdBy: context.actorId,
          updatedBy: context.actorId,
        });
        await valueRepo.save(created);
      }
    }
  }

  async deactivateAsset(
    manager: EntityManager,
    rawAsset: unknown,
    context: { packCode: string; releaseId: string; actorId?: string },
  ): Promise<void> {
    const asset = this.parseAsset(rawAsset);
    const localeRepo = manager.getRepository(Locale);
    const keyRepo = manager.getRepository(TranslationKey);
    const valueRepo = manager.getRepository(TranslationValue);

    for (const locale of asset.locales || []) {
      const existing = await localeRepo.findOne({ where: { code: locale.code } });
      if (!existing) {
        continue;
      }
      this.assertPackOwnership(existing.metadata, context.packCode, 'locale', locale.code);
      existing.isActive = false;
      existing.metadata = this.mergeMetadata(locale.metadata, { ...context, status: 'deprecated' }, existing.metadata);
      existing.updatedBy = context.actorId;
      await localeRepo.save(existing);
    }

    for (const key of asset.keys || []) {
      const existing = await keyRepo.findOne({ where: { namespace: key.namespace, key: key.key } });
      if (!existing) {
        continue;
      }
      this.assertPackOwnership(existing.metadata, context.packCode, 'translation_key', `${key.namespace}.${key.key}`);
      existing.isActive = false;
      existing.metadata = this.mergeMetadata(key.metadata, { ...context, status: 'deprecated' }, existing.metadata);
      existing.updatedBy = context.actorId;
      await keyRepo.save(existing);
    }

    for (const value of asset.values || []) {
      const locale = await localeRepo.findOne({ where: { code: value.locale } });
      const key = await keyRepo.findOne({ where: { namespace: value.namespace, key: value.key } });
      if (!locale || !key) {
        continue;
      }
      const existing = await valueRepo.findOne({
        where: { localeId: locale.id, translationKeyId: key.id },
      });
      if (!existing) {
        continue;
      }
      this.assertPackOwnership(
        existing.metadata,
        context.packCode,
        'translation_value',
        `${value.namespace}.${value.key}:${value.locale}`,
      );
      existing.isActive = false;
      existing.metadata = this.mergeMetadata(value.metadata, { ...context, status: 'deprecated' }, existing.metadata);
      existing.updatedBy = context.actorId;
      await valueRepo.save(existing);
    }
  }

  private parseAsset(raw: unknown): LocalizationAsset {
    if (!raw || typeof raw !== 'object') {
      throw new BadRequestException('Localization asset must be an object');
    }
    const asset = raw as LocalizationAsset;
    const hasContent =
      (asset.locales && asset.locales.length) ||
      (asset.keys && asset.keys.length) ||
      (asset.values && asset.values.length);
    if (!hasContent) {
      throw new BadRequestException('Localization asset must include locales, keys, or values');
    }

    this.validateLocales(asset.locales || []);
    this.validateKeys(asset.keys || []);
    this.validateValues(asset.values || []);

    return asset;
  }

  private validateLocales(locales: LocaleAsset[]): void {
    const seen = new Set<string>();
    for (const locale of locales) {
      if (!locale.code || typeof locale.code !== 'string') {
        throw new BadRequestException('Locale code is required');
      }
      if (seen.has(locale.code)) {
        throw new BadRequestException(`Duplicate locale code ${locale.code}`);
      }
      seen.add(locale.code);
      if (!locale.name || typeof locale.name !== 'string') {
        throw new BadRequestException(`Locale ${locale.code} is missing name`);
      }
      if (locale.direction && !this.isValidDirection(locale.direction)) {
        throw new BadRequestException(`Locale ${locale.code} has invalid direction`);
      }
    }
  }

  private validateKeys(keys: TranslationKeyAsset[]): void {
    const seen = new Set<string>();
    for (const key of keys) {
      if (!key.namespace || typeof key.namespace !== 'string') {
        throw new BadRequestException('Translation key namespace is required');
      }
      if (!key.key || typeof key.key !== 'string') {
        throw new BadRequestException('Translation key is required');
      }
      const composite = `${key.namespace}.${key.key}`;
      if (seen.has(composite)) {
        throw new BadRequestException(`Duplicate translation key ${composite}`);
      }
      seen.add(composite);
      if (!key.default_text || typeof key.default_text !== 'string') {
        throw new BadRequestException(`Translation key ${composite} is missing default_text`);
      }
    }
  }

  private validateValues(values: TranslationValueAsset[]): void {
    const seen = new Set<string>();
    for (const value of values) {
      if (!value.locale || typeof value.locale !== 'string') {
        throw new BadRequestException('Translation value locale is required');
      }
      if (!value.namespace || typeof value.namespace !== 'string') {
        throw new BadRequestException('Translation value namespace is required');
      }
      if (!value.key || typeof value.key !== 'string') {
        throw new BadRequestException('Translation value key is required');
      }
      const composite = `${value.namespace}.${value.key}:${value.locale}`;
      if (seen.has(composite)) {
        throw new BadRequestException(`Duplicate translation value ${composite}`);
      }
      seen.add(composite);
      if (!value.text || typeof value.text !== 'string') {
        throw new BadRequestException(`Translation value ${composite} is missing text`);
      }
      if (value.status && !this.isValidStatus(value.status)) {
        throw new BadRequestException(`Translation value ${composite} has invalid status`);
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
    entityType: 'locale' | 'translation_key' | 'translation_value',
    entityCode: string,
  ): void {
    const existingPack = (metadata as { pack?: { code?: string } }).pack?.code;
    if (existingPack && existingPack !== packCode) {
      throw new ConflictException(`${entityType} ${entityCode} is owned by pack ${existingPack}`);
    }
  }

  private isValidDirection(direction: LocaleDirection): boolean {
    return direction === 'ltr' || direction === 'rtl';
  }

  private isValidStatus(status: TranslationStatus): boolean {
    return status === 'draft' || status === 'approved' || status === 'published';
  }
}
