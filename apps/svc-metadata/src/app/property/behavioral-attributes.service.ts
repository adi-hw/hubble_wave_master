import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import {
  PropertyDefinition,
  PropertyDefinitionRevision,
  type PropertyBehavioralAttributes,
} from '@hubblewave/instance-db';

/**
 * Plan §6.3 — typed accessor over the `behavioral_attributes` JSONB
 * column on PropertyDefinition. Consumers (encryption.service,
 * audit-log subscriber, notification.service.redactProviderError)
 * call into this service rather than poking at the JSONB directly,
 * so the recognized key set is centralized.
 *
 * The service caches nothing — each query hits the read replica and
 * the per-collection result sets are small (≤ ~30 properties each).
 * Adding a cache is straightforward but premature until profiling
 * shows it warrants the invalidation cost.
 */
@Injectable()
export class BehavioralAttributesService {
  constructor(
    @InjectRepository(PropertyDefinition)
    private readonly repo: Repository<PropertyDefinition>,
    @InjectRepository(PropertyDefinitionRevision)
    private readonly revisionRepo: Repository<PropertyDefinitionRevision>,
    private readonly dataSource: DataSource,
  ) {}

  async codesWithAttribute(
    collectionId: string,
    attribute: keyof PropertyBehavioralAttributes,
  ): Promise<string[]> {
    const rows = await this.repo
      .createQueryBuilder('p')
      .select(['p.code'])
      .where('p.collection_id = :collectionId', { collectionId })
      .andWhere(`p.behavioral_attributes ->> :key = 'true'`, { key: attribute })
      .andWhere('p.is_active = true')
      .getMany();
    return rows.map((r) => r.code);
  }

  async auditTrackedCodes(collectionId: string): Promise<string[]> {
    return this.codesWithAttribute(collectionId, 'audit');
  }

  async encryptAtRestCodes(collectionId: string): Promise<string[]> {
    return this.codesWithAttribute(collectionId, 'encrypt_at_rest');
  }

  async maskInLogsCodes(collectionId: string): Promise<string[]> {
    return this.codesWithAttribute(collectionId, 'mask_in_logs');
  }

  async getAttributes(propertyId: string): Promise<PropertyBehavioralAttributes> {
    const property = await this.repo.findOne({ where: { id: propertyId } });
    return property?.behavioralAttributes ?? {};
  }

  /**
   * Update the behavioral attributes for a property. Per ADR-5, the
   * change creates a draft revision and flips the property back to
   * `status='draft'` until the next publish — behavioral attribute
   * changes ARE meaningful runtime hooks and must participate in the
   * publish lifecycle alongside other property edits, not bypass it.
   *
   * Returns the new attribute bag after persistence.
   */
  async setAttributes(
    propertyId: string,
    attributes: PropertyBehavioralAttributes,
    userId?: string,
  ): Promise<PropertyBehavioralAttributes> {
    // ADR-5 invariant: parent.status, revision row, and
    // parent.currentRevisionId must move together. Wrap the three
    // writes in a single transaction so a failure between them
    // cannot leave the parent pointing at a stale revision while
    // the new draft sits orphaned.
    return this.dataSource.transaction(async (manager) => {
      const propertyRepo = manager.getRepository(PropertyDefinition);
      const revRepo = manager.getRepository(PropertyDefinitionRevision);

      const existing = await propertyRepo.findOne({ where: { id: propertyId } });
      if (!existing) {
        throw new NotFoundException(`Property ${propertyId} not found`);
      }

      existing.behavioralAttributes = attributes;
      existing.status = 'draft';
      await propertyRepo.save(existing);

      const nextRev = await this.nextRevisionNumber(propertyId, revRepo);
      const savedRevision = await revRepo.save(
        revRepo.create({
          propertyId,
          revision: nextRev,
          status: 'draft',
          payload: this.snapshotProperty(existing),
          createdBy: userId ?? null,
        }),
      );
      await propertyRepo.update(propertyId, { currentRevisionId: savedRevision.id });

      return attributes;
    });
  }

  private async nextRevisionNumber(
    propertyId: string,
    revRepo: Repository<PropertyDefinitionRevision> = this.revisionRepo,
  ): Promise<number> {
    const result: Array<{ max: number | string | null }> = await revRepo
      .createQueryBuilder('rev')
      .select('MAX(rev.revision)', 'max')
      .where('rev.property_id = :propertyId', { propertyId })
      .getRawMany();
    const max = result[0]?.max;
    return (typeof max === 'string' ? parseInt(max, 10) : max ?? 0) + 1;
  }

  /**
   * Mirrors PropertyService.snapshotProperty so revision payloads
   * have a uniform shape regardless of which service appended the
   * revision. Drift between this and PropertyService.snapshotProperty
   * would silently corrupt diffs in publish-impact comparisons.
   */
  private snapshotProperty(p: PropertyDefinition): Record<string, unknown> {
    return {
      code: p.code,
      name: p.name,
      description: p.description,
      collectionId: p.collectionId,
      applicationId: p.applicationId,
      propertyTypeId: p.propertyTypeId,
      columnName: p.columnName,
      config: p.config,
      isRequired: p.isRequired,
      isUnique: p.isUnique,
      isIndexed: p.isIndexed,
      validationRules: p.validationRules,
      defaultValue: p.defaultValue,
      defaultValueType: p.defaultValueType,
      position: p.position,
      isVisible: p.isVisible,
      isReadonly: p.isReadonly,
      displayFormat: p.displayFormat,
      placeholder: p.placeholder,
      helpText: p.helpText,
      referenceCollectionId: p.referenceCollectionId,
      referenceDisplayProperty: p.referenceDisplayProperty,
      referenceFilter: p.referenceFilter,
      choiceListId: p.choiceListId,
      ownerType: p.ownerType,
      isSystem: p.isSystem,
      isActive: p.isActive,
      isSearchable: p.isSearchable,
      isSortable: p.isSortable,
      isFilterable: p.isFilterable,
      isPhi: p.isPhi,
      isPii: p.isPii,
      isSensitive: p.isSensitive,
      maskingStrategy: p.maskingStrategy,
      maskValue: p.maskValue,
      requiresBreakGlass: p.requiresBreakGlass,
      behavioralAttributes: p.behavioralAttributes,
      metadata: p.metadata,
    };
  }
}
