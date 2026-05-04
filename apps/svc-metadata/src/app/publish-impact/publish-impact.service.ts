import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import {
  CollectionDefinition,
  PropertyDefinition,
  PropertyDefinitionRevision,
} from '@hubblewave/instance-db';
import { classifyPropertyChange } from './property-change-classifier';
import {
  type DependentSummary,
  type ImpactClassification,
  type PropertyImpactReport,
  type PublishImpactReport,
  worse,
} from './publish-impact.types';
import { ImpactAnalyzerRegistry } from './impact-analyzer.registry';

/**
 * Loads the current property state and the most recently published
 * revision payload for each property under a Collection, runs the
 * classifier, and aggregates per-property reports into a Collection-
 * scoped PublishImpactReport.
 *
 * The "previous" state is the most recent `PropertyDefinitionRevision`
 * with status='published'. The "next" state is the live
 * PropertyDefinition row, serialized to the same payload shape that
 * snapshotProperty() persists into draft revisions. Removed properties
 * are detected by published revisions that no longer have a matching
 * PropertyDefinition row.
 */
@Injectable()
export class PublishImpactService {
  constructor(
    @InjectRepository(CollectionDefinition)
    private readonly collectionRepo: Repository<CollectionDefinition>,
    @InjectRepository(PropertyDefinition)
    private readonly propertyRepo: Repository<PropertyDefinition>,
    @InjectRepository(PropertyDefinitionRevision)
    private readonly propertyRevisionRepo: Repository<PropertyDefinitionRevision>,
    private readonly analyzerRegistry: ImpactAnalyzerRegistry,
  ) {}

  async previewCollectionPublish(collectionId: string): Promise<PublishImpactReport> {
    const collection = await this.collectionRepo.findOne({ where: { id: collectionId } });
    if (!collection) {
      throw new NotFoundException(`Collection ${collectionId} not found`);
    }

    // Soft-deleted properties (`isActive=false`) must classify as
    // *removed*, not as a no-op modification. Filtering at load means
    // their codes are absent from `liveCodes`, so the loop over
    // `publishedByCode` below picks them up correctly.
    const properties = await this.propertyRepo.find({
      where: { collectionId, isActive: true },
    });

    const publishedRevisions = await this.loadLatestPublishedRevisions(
      properties.map((p) => p.id),
    );
    const publishedByCode = await this.loadAllPublishedByCode(collectionId);

    const propertyChanges: PropertyImpactReport[] = [];
    let worst: ImpactClassification | null = null;
    const liveCodes = new Set(properties.map((p) => p.code));

    for (const property of properties) {
      const oldPayload = publishedRevisions.get(property.id) ?? null;
      const newPayload = this.snapshotProperty(property);
      const report: PropertyImpactReport = {
        ...classifyPropertyChange(
          property.code,
          oldPayload,
          newPayload,
          property.name,
          property.id,
        ),
        dependents: [],
      };
      if (this.isNoOpChange(report)) {
        continue;
      }
      propertyChanges.push(report);
      worst = worst ? worse(worst, report.classification) : report.classification;
    }

    for (const [code, payload] of publishedByCode.entries()) {
      if (liveCodes.has(code)) continue;
      const report: PropertyImpactReport = {
        ...classifyPropertyChange(code, payload, null, undefined, undefined),
        dependents: [],
      };
      propertyChanges.push(report);
      worst = worst ? worse(worst, report.classification) : report.classification;
    }

    const eligibleChanges = propertyChanges.filter((p) => p.classification !== 'cosmetic');
    if (eligibleChanges.length > 0) {
      const matches = await this.analyzerRegistry.runAll({
        collectionId,
        collectionCode: collection.code,
        propertyChanges: eligibleChanges.map((p) => ({
          propertyCode: p.propertyCode,
          propertyId: p.propertyId,
          changeKind: p.changeKind,
          classification: p.classification,
        })),
      });
      const byCode = new Map<string, DependentSummary[]>();
      for (const match of matches) {
        const list = byCode.get(match.propertyCode) ?? [];
        list.push({
          entityType: match.entityType,
          entityId: match.entityId,
          entityLabel: match.entityLabel,
          href: match.href,
          reason: match.reason,
        });
        byCode.set(match.propertyCode, list);
      }
      for (const change of propertyChanges) {
        change.dependents = byCode.get(change.propertyCode) ?? [];
      }
    }

    return {
      collectionId,
      collectionCode: collection.code,
      classification: worst ?? 'no_changes',
      propertyChanges,
      generatedAt: new Date().toISOString(),
    };
  }

  /**
   * For each property id, fetches the most recent PropertyDefinitionRevision
   * row whose status is 'published'. Properties without a published
   * revision return null (treated as "added" by the classifier).
   */
  private async loadLatestPublishedRevisions(
    propertyIds: string[],
  ): Promise<Map<string, Record<string, unknown> | null>> {
    const result = new Map<string, Record<string, unknown> | null>();
    if (propertyIds.length === 0) return result;
    const rows = await this.propertyRevisionRepo.find({
      where: { propertyId: In(propertyIds), status: 'published' },
      order: { propertyId: 'ASC', revision: 'DESC' },
    });
    for (const row of rows) {
      if (!result.has(row.propertyId)) {
        result.set(row.propertyId, row.payload ?? null);
      }
    }
    for (const id of propertyIds) {
      if (!result.has(id)) result.set(id, null);
    }
    return result;
  }

  /**
   * Loads the most recent published revision payload per property
   * under the given collection. Used to detect removals — a code in
   * this set that has no live PropertyDefinition row was deleted.
   *
   * `DISTINCT ON (rev.property_id) ... ORDER BY rev.property_id,
   * rev.revision DESC` ensures we keep only the highest-revision
   * payload per property; without this, properties published multiple
   * times would have the older revisions overwriting the newer one
   * during Map.set, making the diff comparison unreliable.
   */
  private async loadAllPublishedByCode(
    collectionId: string,
  ): Promise<Map<string, Record<string, unknown>>> {
    const map = new Map<string, Record<string, unknown>>();
    const properties = await this.propertyRepo.find({
      where: { collectionId },
      select: ['id'],
    });
    if (properties.length === 0) return map;
    const rows = await this.propertyRevisionRepo.find({
      where: {
        propertyId: In(properties.map((property) => property.id)),
        status: 'published',
      },
      order: { propertyId: 'ASC', revision: 'DESC' },
    });
    const seenPropertyIds = new Set<string>();
    for (const row of rows) {
      if (seenPropertyIds.has(row.propertyId)) continue;
      seenPropertyIds.add(row.propertyId);
      const code = (row.payload as { code?: string })?.code;
      if (code) map.set(code, row.payload);
    }
    return map;
  }

  /**
   * Authoring snapshot — must mirror CollectionService.snapshotProperty
   * so the diff compares apples to apples.
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
      metadata: p.metadata,
    };
  }

  private isNoOpChange(report: PropertyImpactReport): boolean {
    return (
      report.changeKind === 'modified' &&
      report.fieldChanges.length === 0 &&
      report.reasons.length === 1 &&
      report.reasons[0] === 'No detectable changes between published and current state'
    );
  }
}
