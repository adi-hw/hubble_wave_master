import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  AuditLog,
  Locale,
  TranslationKey,
  TranslationValue,
  TranslationRequest,
  TranslationStatus,
  TranslationRequestStatus,
} from '@hubblewave/instance-db';

export type UpsertTranslationValue = {
  locale_code: string;
  namespace: string;
  key: string;
  text: string;
  status?: TranslationStatus;
};

export type UpdateTranslationValue = {
  text?: string;
  status?: TranslationStatus;
};

export type UpdateTranslationRequest = {
  status?: TranslationRequestStatus;
  notes?: string;
};

@Injectable()
export class LocalizationStudioService {
  constructor(
    @InjectRepository(Locale)
    private readonly localeRepo: Repository<Locale>,
    @InjectRepository(TranslationKey)
    private readonly keyRepo: Repository<TranslationKey>,
    @InjectRepository(TranslationValue)
    private readonly valueRepo: Repository<TranslationValue>,
    @InjectRepository(TranslationRequest)
    private readonly requestRepo: Repository<TranslationRequest>,
    @InjectRepository(AuditLog)
    private readonly auditRepo: Repository<AuditLog>,
  ) {}

  async listLocales() {
    return this.localeRepo.find({
      where: { isActive: true },
      order: { code: 'ASC' },
    });
  }

  async listKeys(namespace?: string) {
    const where: Record<string, unknown> = { isActive: true };
    if (namespace) {
      where.namespace = namespace;
    }
    return this.keyRepo.find({
      where,
      order: { namespace: 'ASC', key: 'ASC' },
    });
  }

  async listValues(localeCode: string, namespace?: string) {
    const locale = await this.localeRepo.findOne({
      where: { code: localeCode, isActive: true },
    });
    if (!locale) {
      throw new NotFoundException(`Locale ${localeCode} not found`);
    }

    const query = this.valueRepo
      .createQueryBuilder('value')
      .leftJoinAndSelect('value.translationKey', 'key')
      .where('value.localeId = :localeId', { localeId: locale.id })
      .andWhere('value.isActive = :isActive', { isActive: true });

    if (namespace) {
      query.andWhere('key.namespace = :namespace', { namespace });
    }

    query.orderBy('key.namespace', 'ASC').addOrderBy('key.key', 'ASC');

    return query.getMany();
  }

  async upsertValue(payload: UpsertTranslationValue, actorId?: string) {
    const locale = await this.localeRepo.findOne({
      where: { code: payload.locale_code, isActive: true },
    });
    if (!locale) {
      throw new NotFoundException(`Locale ${payload.locale_code} not found`);
    }

    const key = await this.keyRepo.findOne({
      where: { namespace: payload.namespace, key: payload.key, isActive: true },
    });
    if (!key) {
      throw new NotFoundException(
        `Translation key ${payload.namespace}.${payload.key} not found`,
      );
    }

    const existing = await this.valueRepo.findOne({
      where: { localeId: locale.id, translationKeyId: key.id },
    });

    const status: TranslationStatus = payload.status || 'draft';

    if (existing) {
      existing.text = payload.text;
      existing.status = status;
      existing.updatedBy = actorId;
      const saved = await this.valueRepo.save(existing);

      await this.logAudit('localization.value.update', actorId, saved.id, {
        locale: locale.code,
        namespace: key.namespace,
        key: key.key,
        status,
      });

      return saved;
    }

    const created = this.valueRepo.create({
      localeId: locale.id,
      translationKeyId: key.id,
      text: payload.text,
      status,
      isActive: true,
      createdBy: actorId,
      updatedBy: actorId,
    });
    const saved = await this.valueRepo.save(created);

    await this.logAudit('localization.value.create', actorId, saved.id, {
      locale: locale.code,
      namespace: key.namespace,
      key: key.key,
      status,
    });

    return saved;
  }

  async updateValue(id: string, payload: UpdateTranslationValue, actorId?: string) {
    const value = await this.valueRepo.findOne({
      where: { id },
      relations: ['translationKey'],
    });
    if (!value) {
      throw new NotFoundException(`Translation value ${id} not found`);
    }

    if (payload.text !== undefined) {
      value.text = payload.text;
    }
    if (payload.status !== undefined) {
      value.status = payload.status;
    }
    value.updatedBy = actorId;

    const saved = await this.valueRepo.save(value);

    await this.logAudit('localization.value.update', actorId, saved.id, {
      text: payload.text !== undefined,
      status: payload.status,
    });

    return saved;
  }

  async listRequests(status?: string) {
    const where: Record<string, unknown> = {};
    if (status) {
      where.status = status;
    }

    return this.requestRepo.find({
      where,
      relations: ['locale', 'translationKey'],
      order: { createdAt: 'DESC' },
    });
  }

  async updateRequest(id: string, payload: UpdateTranslationRequest, actorId?: string) {
    const request = await this.requestRepo.findOne({ where: { id } });
    if (!request) {
      throw new NotFoundException(`Translation request ${id} not found`);
    }

    if (payload.status !== undefined) {
      request.status = payload.status;
    }
    if (payload.notes !== undefined) {
      request.metadata = {
        ...request.metadata,
        notes: payload.notes,
      };
    }
    request.updatedBy = actorId;

    const saved = await this.requestRepo.save(request);

    await this.logAudit('localization.request.update', actorId, saved.id, {
      status: payload.status,
      notes: payload.notes !== undefined,
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
      collectionCode: 'translation_values',
      recordId,
      newValues: payload,
    });
    await this.auditRepo.save(log);
  }
}
