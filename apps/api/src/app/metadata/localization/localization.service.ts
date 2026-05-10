import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { createHash } from 'crypto';
import { In, Repository } from 'typeorm';
import {
  AuditLog,
  Locale,
  LocalizationBundle,
  TranslationKey,
  TranslationValue,
} from '@hubblewave/instance-db';

export type PublishLocalizationRequest = {
  locale_codes?: string[];
};

export type LocalizationBundleResponse = {
  locale: {
    code: string;
    name: string;
    direction: string;
  };
  entries: Record<string, Record<string, string>>;
  checksum: string;
  publishedAt?: string | null;
};

@Injectable()
export class LocalizationService {
  constructor(
    @InjectRepository(Locale)
    private readonly localeRepo: Repository<Locale>,
    @InjectRepository(TranslationKey)
    private readonly keyRepo: Repository<TranslationKey>,
    @InjectRepository(TranslationValue)
    private readonly valueRepo: Repository<TranslationValue>,
    @InjectRepository(LocalizationBundle)
    private readonly bundleRepo: Repository<LocalizationBundle>,
    @InjectRepository(AuditLog)
    private readonly auditRepo: Repository<AuditLog>,
  ) {}

  async publishBundles(request: PublishLocalizationRequest, actorId?: string) {
    const localeCodes = this.normalizeLocaleCodes(request.locale_codes);
    const locales = await this.resolveLocales(localeCodes);
    if (locales.length === 0) {
      throw new BadRequestException('No locales available for publishing');
    }

    const keys = await this.keyRepo.find({ where: { isActive: true } });
    const values = await this.valueRepo.find({
      where: {
        localeId: In(locales.map((locale) => locale.id)),
        status: 'published',
        isActive: true,
      },
    });

    const valuesByLocale = new Map<string, Map<string, string>>();
    for (const value of values) {
      if (!valuesByLocale.has(value.localeId)) {
        valuesByLocale.set(value.localeId, new Map());
      }
      valuesByLocale.get(value.localeId)?.set(value.translationKeyId, value.text);
    }

    const bundles: LocalizationBundle[] = [];
    for (const locale of locales) {
      const entries = this.buildEntries(keys, valuesByLocale.get(locale.id));
      const checksum = this.hashEntries(entries);
      const bundle = await this.upsertBundle(locale, entries, checksum, actorId);
      bundles.push(bundle);
    }

    return bundles.map((bundle) => {
      const locale = locales.find((entry) => entry.id === bundle.localeId);
      return this.toResponse(bundle, locale);
    });
  }

  async getBundle(localeCode: string): Promise<LocalizationBundleResponse> {
    const locale = await this.localeRepo.findOne({
      where: { code: localeCode, isActive: true },
    });
    if (!locale) {
      throw new NotFoundException(`Locale ${localeCode} not found`);
    }
    const bundle = await this.bundleRepo.findOne({ where: { localeId: locale.id } });
    if (!bundle) {
      throw new NotFoundException(`Localization bundle for ${localeCode} not found`);
    }
    return this.toResponse(bundle, locale);
  }

  private normalizeLocaleCodes(localeCodes?: string[]): string[] | undefined {
    if (!localeCodes) {
      return undefined;
    }
    const trimmed = localeCodes.map((code) => code.trim()).filter(Boolean);
    return trimmed.length > 0 ? trimmed : undefined;
  }

  private async resolveLocales(localeCodes?: string[]): Promise<Locale[]> {
    if (!localeCodes) {
      return this.localeRepo.find({ where: { isActive: true } });
    }
    const locales = await this.localeRepo.find({
      where: { code: In(localeCodes), isActive: true },
    });
    const foundCodes = new Set(locales.map((locale) => locale.code));
    const missing = localeCodes.filter((code) => !foundCodes.has(code));
    if (missing.length > 0) {
      throw new BadRequestException(`Unknown locales: ${missing.join(', ')}`);
    }
    return locales;
  }

  private buildEntries(
    keys: TranslationKey[],
    values?: Map<string, string>,
  ): Record<string, Record<string, string>> {
    const entries: Record<string, Record<string, string>> = {};
    const sortedKeys = [...keys].sort((a, b) => {
      const aComposite = `${a.namespace}.${a.key}`;
      const bComposite = `${b.namespace}.${b.key}`;
      return aComposite.localeCompare(bComposite);
    });

    for (const key of sortedKeys) {
      if (!entries[key.namespace]) {
        entries[key.namespace] = {};
      }
      const value = values?.get(key.id);
      entries[key.namespace][key.key] = value || key.defaultText;
    }

    return entries;
  }

  private hashEntries(entries: Record<string, Record<string, string>>): string {
    return createHash('sha256').update(JSON.stringify(entries)).digest('hex');
  }

  private async upsertBundle(
    locale: Locale,
    entries: Record<string, Record<string, string>>,
    checksum: string,
    actorId?: string,
  ): Promise<LocalizationBundle> {
    const existing = await this.bundleRepo.findOne({ where: { localeId: locale.id } });
    const payload = {
      entries,
      checksum,
      publishedBy: actorId || null,
      publishedAt: new Date(),
      metadata: {
        status: 'published',
        source: 'pipeline',
        key_count: Object.values(entries).reduce((sum, map) => sum + Object.keys(map).length, 0),
      },
    };

    if (existing) {
      existing.localeCode = locale.code;
      existing.entries = payload.entries;
      existing.checksum = payload.checksum;
      existing.publishedBy = payload.publishedBy;
      existing.publishedAt = payload.publishedAt;
      existing.metadata = payload.metadata;
      const saved = await this.bundleRepo.save(existing);
      await this.logAudit('localization.publish', actorId, saved.id, {
        locale: locale.code,
        checksum,
      });
      return saved;
    }

    const created = this.bundleRepo.create({
      localeId: locale.id,
      localeCode: locale.code,
      entries: payload.entries,
      checksum: payload.checksum,
      publishedBy: payload.publishedBy,
      publishedAt: payload.publishedAt,
      metadata: payload.metadata,
    });
    const saved = await this.bundleRepo.save(created);
    await this.logAudit('localization.publish', actorId, saved.id, {
      locale: locale.code,
      checksum,
    });
    return saved;
  }

  private async logAudit(
    action: string,
    actorId: string | undefined,
    recordId: string,
    payload: Record<string, unknown>,
  ) {
    const log = this.auditRepo.create({
      userId: actorId || null,
      action,
      collectionCode: 'localization_bundles',
      recordId,
      newValues: payload,
    });
    await this.auditRepo.save(log);
  }

  private toResponse(bundle: LocalizationBundle, localeOverride?: Locale): LocalizationBundleResponse {
    const locale = localeOverride;
    return {
      locale: {
        code: locale?.code || bundle.localeCode,
        name: locale?.name || bundle.localeCode,
        direction: locale?.direction || 'ltr',
      },
      entries: bundle.entries,
      checksum: bundle.checksum,
      publishedAt: bundle.publishedAt ? bundle.publishedAt.toISOString() : null,
    };
  }
}
