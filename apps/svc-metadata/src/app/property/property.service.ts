import { Injectable, NotFoundException, ConflictException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import {
  PropertyDefinition,
  PropertyDefinitionRevision,
  DefaultValueType,
  AuditLog,
  CollectionDefinition,
  PropertyType,
  type PropertyBehavioralAttributes,
} from '@hubblewave/instance-db';
import { PropertyReferenceScanner, PropertyReferenceReport } from './reference-scanner.service';

export interface CreatePropertyDto {
  code: string;
  name?: string;
  description?: string;
  /**
   * One of propertyTypeId (UUID FK) or propertyTypeCode (stable code
   * like 'text', 'choice', 'reference') must be provided. The service
   * resolves propertyTypeCode → propertyTypeId when only the code is
   * supplied, which lets the frontend speak in property-type codes
   * without caching the UUID lookup.
   */
  propertyTypeId?: string;
  propertyTypeCode?: string;
  columnName?: string;
  config?: Record<string, unknown>;
  isRequired?: boolean;
  isUnique?: boolean;
  isIndexed?: boolean;
  validationRules?: Record<string, unknown>;
  defaultValue?: string;
  defaultValueType?: DefaultValueType;
  position?: number;
  isVisible?: boolean;
  isReadonly?: boolean;
  displayFormat?: string;
  placeholder?: string;
  helpText?: string;
  referenceCollectionId?: string;
  referenceDisplayProperty?: string;
  referenceFilter?: Record<string, unknown>;
  choiceListId?: string;
  isSearchable?: boolean;
  isSortable?: boolean;
  isFilterable?: boolean;
  behavioralAttributes?: PropertyBehavioralAttributes;
  metadata?: Record<string, unknown>;
}

export interface UpdatePropertyDto extends Partial<Omit<CreatePropertyDto, 'code'>> {}

export interface PropertyListOptions {
  includeSystem?: boolean;
  includeInactive?: boolean;
  propertyTypeId?: string;
}

export interface PropertyListResult {
  data: PropertyDefinition[];
  meta: {
    collectionId: string;
    total: number;
    includeSystem: boolean;
    includeInactive: boolean;
  };
}

@Injectable()
export class PropertyService {
  constructor(
    @InjectRepository(PropertyDefinition)
    private readonly propertyRepo: Repository<PropertyDefinition>,
    @InjectRepository(PropertyDefinitionRevision)
    private readonly revisionRepo: Repository<PropertyDefinitionRevision>,
    @InjectRepository(AuditLog)
    private readonly auditRepo: Repository<AuditLog>,
    @InjectRepository(CollectionDefinition)
    private readonly collectionRepo: Repository<CollectionDefinition>,
    @InjectRepository(PropertyType)
    private readonly propertyTypeRepo: Repository<PropertyType>,
    private readonly referenceScanner: PropertyReferenceScanner,
  ) {}

  /**
   * Surface every reference to a property across the dictionary.
   * Backs the GET /properties/:id/references endpoint and also runs as a
   * pre-check in deleteProperty().
   */
  async findReferences(id: string): Promise<PropertyReferenceReport> {
    const property = await this.getProperty(id);
    return this.referenceScanner.findReferences(property);
  }

  /**
   * Resolve the property type to use. Caller may pass either
   * propertyTypeId (canonical FK) or propertyTypeCode (stable
   * developer-facing code). At least one must be provided.
   */
  private async resolvePropertyTypeId(dto: {
    propertyTypeId?: string;
    propertyTypeCode?: string;
  }): Promise<string> {
    if (dto.propertyTypeId) {
      return dto.propertyTypeId;
    }
    if (!dto.propertyTypeCode) {
      throw new BadRequestException(
        'One of propertyTypeId or propertyTypeCode is required',
      );
    }
    const type = await this.propertyTypeRepo.findOne({
      where: { code: dto.propertyTypeCode },
      select: ['id'],
    });
    if (!type) {
      throw new BadRequestException(
        `Unknown property type code: ${dto.propertyTypeCode}`,
      );
    }
    return type.id;
  }

  /**
   * Verify a referenced collection exists in this instance. Reference
   * collections must be present before a property can point at them.
   */
  private async assertReferenceCollectionExists(referenceCollectionId: string): Promise<void> {
    const exists = await this.collectionRepo.findOne({
      where: { id: referenceCollectionId },
      select: ['id'],
    });
    if (!exists) {
      throw new BadRequestException('Reference collection not found');
    }
  }

  /**
   * Look up the parent collection's applicationId. Used during property
   * creation to denormalize the FK so cross-application reference checks
   * don't have to traverse the parent collection (ADR-6).
   */
  private async getCollectionApplicationId(collectionId: string): Promise<string> {
    const parent = await this.collectionRepo.findOne({
      where: { id: collectionId },
      select: ['id', 'applicationId'],
    });
    if (!parent) {
      throw new NotFoundException(`Collection ${collectionId} not found`);
    }
    if (!parent.applicationId) {
      throw new ConflictException(
        `Collection ${collectionId} is not bound to an Application — assign it before creating properties.`,
      );
    }
    return parent.applicationId;
  }

  /**
   * List all properties for a collection
   */
  async listProperties(
    collectionId: string,
    options: PropertyListOptions = {},
  ): Promise<PropertyListResult> {
    const { includeSystem = false, includeInactive = false, propertyTypeId } = options;

    const query = this.propertyRepo.createQueryBuilder('property')
      .where('property.collection_id = :collectionId', { collectionId })
      .leftJoinAndSelect('property.propertyType', 'propertyType')
      .orderBy('property.position', 'ASC');

    if (!includeSystem) {
      query.andWhere('property.isSystem = :isSystem', { isSystem: false });
    }

    if (!includeInactive) {
      query.andWhere('property.isActive = :isActive', { isActive: true });
    }

    if (propertyTypeId) {
      query.andWhere('property.propertyTypeId = :propertyTypeId', { propertyTypeId });
    }

    const [data, total] = await query.getManyAndCount();

    return {
      data,
      meta: {
        collectionId,
        total,
        includeSystem,
        includeInactive,
      },
    };
  }

  /**
   * Get a property by its code within a collection
   */
  async getPropertyByCode(collectionId: string, code: string): Promise<PropertyDefinition> {
    const property = await this.propertyRepo.findOne({
      where: { collectionId, code },
      relations: ['propertyType', 'referenceCollection'],
    });

    if (!property) {
      throw new NotFoundException(`Property with code '${code}' not found in collection`);
    }

    return property;
  }

  /**
   * Check if a property code is available within a collection
   */
  async isCodeAvailable(collectionId: string, code: string, excludeId?: string): Promise<boolean> {
    const queryBuilder = this.propertyRepo.createQueryBuilder('property')
      .where('property.collection_id = :collectionId', { collectionId })
      .andWhere('property.code = :code', { code });

    if (excludeId) {
      queryBuilder.andWhere('property.id != :excludeId', { excludeId });
    }

    const existing = await queryBuilder.getOne();
    return !existing;
  }

  /**
   * Get a property by ID
   */
  async getProperty(id: string): Promise<PropertyDefinition> {
    const property = await this.propertyRepo.findOne({
      where: { id },
      relations: ['propertyType', 'referenceCollection', 'collection'],
    });

    if (!property) {
      throw new NotFoundException(`Property with ID '${id}' not found`);
    }

    return property;
  }

  /**
   * Create a new property for a collection
   */
  async createProperty(
    collectionId: string,
    dto: CreatePropertyDto,
    userId?: string,
    context?: { ipAddress?: string; userAgent?: string },
  ): Promise<PropertyDefinition> {
    const isAvailable = await this.isCodeAvailable(collectionId, dto.code);
    if (!isAvailable) {
      throw new ConflictException(`Property code '${dto.code}' already exists in this collection`);
    }

    if (dto.referenceCollectionId) {
      await this.assertReferenceCollectionExists(dto.referenceCollectionId);
    }

    const propertyTypeId = await this.resolvePropertyTypeId(dto);
    const applicationId = await this.getCollectionApplicationId(collectionId);

    const columnName = dto.columnName || this.generateColumnName(dto.code);
    await this.assertColumnNameAvailable(collectionId, columnName);

    const maxPosition = await this.getMaxPosition(collectionId);

    const property = this.propertyRepo.create({
      collectionId,
      applicationId,
      code: dto.code,
      name: dto.name || dto.code,
      description: dto.description,
      propertyTypeId,
      columnName,
      config: dto.config || {},
      isRequired: dto.isRequired ?? false,
      isUnique: dto.isUnique ?? false,
      isIndexed: dto.isIndexed ?? false,
      validationRules: dto.validationRules || {},
      defaultValue: dto.defaultValue,
      defaultValueType: dto.defaultValueType || 'static',
      position: dto.position ?? maxPosition + 1,
      isVisible: dto.isVisible ?? true,
      isReadonly: dto.isReadonly ?? false,
      displayFormat: dto.displayFormat,
      placeholder: dto.placeholder,
      helpText: dto.helpText,
      referenceCollectionId: dto.referenceCollectionId,
      referenceDisplayProperty: dto.referenceDisplayProperty,
      referenceFilter: dto.referenceFilter,
      choiceListId: dto.choiceListId,
      isSearchable: dto.isSearchable ?? false,
      isSortable: dto.isSortable ?? true,
      isFilterable: dto.isFilterable ?? true,
      behavioralAttributes: dto.behavioralAttributes || {},
      metadata: this.mergeMetadata(dto.metadata, 'draft'),
      ownerType: 'custom',
      isSystem: false,
      isActive: true,
      status: 'draft',
      createdBy: userId,
    });

    const saved = await this.propertyRepo.save(property);

    // Seed revision 1 (draft) so currentRevisionId is non-null from creation.
    const revision = this.revisionRepo.create({
      propertyId: saved.id,
      revision: 1,
      status: 'draft',
      payload: this.snapshotProperty(saved),
      createdBy: userId ?? null,
    });
    const savedRevision = await this.revisionRepo.save(revision);
    saved.currentRevisionId = savedRevision.id;
    await this.propertyRepo.save(saved);

    await this.logAudit({
      userId: userId || 'system',
      action: 'create',
      recordId: saved.id,
      newState: this.toAuditState(saved),
      ipAddress: context?.ipAddress,
      userAgent: context?.userAgent,
    });
    return saved;
  }

  /**
   * Bulk create properties for a collection
   */
  async bulkCreateProperties(
    collectionId: string,
    properties: CreatePropertyDto[],
    userId?: string,
    stopOnError = true,
    context?: { ipAddress?: string; userAgent?: string },
  ): Promise<{ created: PropertyDefinition[]; errors: Array<{ index: number; code: string; error: string }> }> {
    const created: PropertyDefinition[] = [];
    const errors: Array<{ index: number; code: string; error: string }> = [];

    if (!Array.isArray(properties) || properties.length === 0) {
      throw new BadRequestException('properties array is required and must not be empty');
    }

    // In-batch collision detection: any duplicates within the request itself
    // are caught up-front so we never silently insert one and reject the next.
    const codeCounts = new Map<string, number>();
    const columnCounts = new Map<string, number>();
    for (const p of properties) {
      if (p.code) {
        codeCounts.set(p.code, (codeCounts.get(p.code) || 0) + 1);
      }
      const columnName = p.columnName || (p.code ? this.generateColumnName(p.code) : null);
      if (columnName) {
        columnCounts.set(columnName, (columnCounts.get(columnName) || 0) + 1);
      }
    }
    const duplicateCodes = Array.from(codeCounts.entries())
      .filter(([, count]) => count > 1)
      .map(([code]) => code);
    const duplicateColumns = Array.from(columnCounts.entries())
      .filter(([, count]) => count > 1)
      .map(([col]) => col);
    if (duplicateCodes.length > 0 || duplicateColumns.length > 0) {
      const parts: string[] = [];
      if (duplicateCodes.length > 0) {
        parts.push(`duplicate codes in request: ${duplicateCodes.join(', ')}`);
      }
      if (duplicateColumns.length > 0) {
        parts.push(`duplicate columnNames in request: ${duplicateColumns.join(', ')}`);
      }
      throw new BadRequestException(parts.join('; '));
    }

    const codes = properties.map((p) => p.code);
    const existingCodes = await this.getExistingCodes(collectionId, codes);

    // Pre-flight: validate every distinct referenceCollectionId in one round-trip.
    const referenceIds = Array.from(
      new Set(
        properties
          .map((p) => p.referenceCollectionId)
          .filter((id): id is string => typeof id === 'string' && id.length > 0),
      ),
    );
    if (referenceIds.length > 0) {
      const found = await this.collectionRepo.find({
        where: { id: In(referenceIds) },
        select: ['id'],
      });
      const foundIds = new Set(found.map((c) => c.id));
      const missing = referenceIds.filter((id) => !foundIds.has(id));
      if (missing.length > 0) {
        throw new BadRequestException(
          `Reference collection not found: ${missing.join(', ')}`,
        );
      }
    }

    const applicationId = await this.getCollectionApplicationId(collectionId);

    // Per-request dedupe of computed column names — complementary to the
    // dictionary-wide check below; catches collisions inside a single payload
    // before they hit the database.
    const requestColumnNames = new Map<string, string>();

    let maxPosition = await this.getMaxPosition(collectionId);

    for (let i = 0; i < properties.length; i++) {
      const dto = properties[i];

      if (existingCodes.includes(dto.code)) {
        const error = { index: i, code: dto.code, error: `Code '${dto.code}' already exists` };
        errors.push(error);
        if (stopOnError) {
          break;
        }
        continue;
      }

      try {
        const columnName = dto.columnName || this.generateColumnName(dto.code);

        const collidingCodeInRequest = requestColumnNames.get(columnName);
        if (collidingCodeInRequest) {
          throw new ConflictException(
            `Column name "${columnName}" collides with property "${collidingCodeInRequest}" in the same request after truncation. Use a shorter or more distinctive code.`,
          );
        }
        await this.assertColumnNameAvailable(collectionId, columnName);
        requestColumnNames.set(columnName, dto.code);

        const propertyTypeId = await this.resolvePropertyTypeId(dto);

        maxPosition++;
        const property = this.propertyRepo.create({
          collectionId,
          applicationId,
          code: dto.code,
          name: dto.name || dto.code,
          description: dto.description,
          propertyTypeId,
          columnName,
          config: dto.config || {},
          isRequired: dto.isRequired ?? false,
          isUnique: dto.isUnique ?? false,
          isIndexed: dto.isIndexed ?? false,
          validationRules: dto.validationRules || {},
          defaultValue: dto.defaultValue,
          defaultValueType: dto.defaultValueType || 'static',
          position: dto.position ?? maxPosition,
          isVisible: dto.isVisible ?? true,
          isReadonly: dto.isReadonly ?? false,
          displayFormat: dto.displayFormat,
          placeholder: dto.placeholder,
          helpText: dto.helpText,
          referenceCollectionId: dto.referenceCollectionId,
          referenceDisplayProperty: dto.referenceDisplayProperty,
          referenceFilter: dto.referenceFilter,
          choiceListId: dto.choiceListId,
          isSearchable: dto.isSearchable ?? false,
          isSortable: dto.isSortable ?? true,
          isFilterable: dto.isFilterable ?? true,
          behavioralAttributes: dto.behavioralAttributes || {},
          metadata: this.mergeMetadata(dto.metadata, 'draft'),
          ownerType: 'custom',
          isSystem: false,
          isActive: true,
          status: 'draft',
          createdBy: userId,
        });

        const saved = await this.propertyRepo.save(property);
        const savedRevision = await this.revisionRepo.save(
          this.revisionRepo.create({
            propertyId: saved.id,
            revision: 1,
            status: 'draft',
            payload: this.snapshotProperty(saved),
            createdBy: userId ?? null,
          }),
        );
        saved.currentRevisionId = savedRevision.id;
        await this.propertyRepo.save(saved);
        created.push(saved);
        await this.logAudit({
          userId: userId || 'system',
          action: 'create',
          recordId: saved.id,
          newState: this.toAuditState(saved),
          ipAddress: context?.ipAddress,
          userAgent: context?.userAgent,
        });
      } catch (err) {
        const error = {
          index: i,
          code: dto.code,
          error: err instanceof Error ? err.message : 'Unknown error',
        };
        errors.push(error);
        if (stopOnError) {
          break;
        }
      }
    }

    return { created, errors };
  }

  /**
   * Reorder properties within a collection
   */
  async reorderProperties(
    collectionId: string,
    order: Array<{ id: string; position: number }>,
    _userId?: string,
  ): Promise<{ success: boolean; updated: number }> {
    const propertyIds = order.map((o) => o.id);

    const properties = await this.propertyRepo.find({
      where: {
        id: In(propertyIds),
        collectionId,
      },
    });

    if (properties.length !== propertyIds.length) {
      throw new BadRequestException('Some property IDs do not belong to this collection');
    }

    const updates = order.map(({ id, position }) =>
      this.propertyRepo.update(id, { position }),
    );

    await Promise.all(updates);

    return { success: true, updated: order.length };
  }

  /**
   * Update a property
   */
  async updateProperty(
    id: string,
    dto: UpdatePropertyDto,
    _userId?: string,
    context?: { ipAddress?: string; userAgent?: string },
  ): Promise<PropertyDefinition> {
    const existing = await this.getProperty(id);

    if (existing.isSystem && dto.isRequired !== undefined) {
      throw new BadRequestException('Cannot modify system property required status');
    }

    if (dto.referenceCollectionId !== undefined && dto.referenceCollectionId !== null) {
      await this.assertReferenceCollectionExists(dto.referenceCollectionId);
    }

    // Per ADR-5 every edit becomes a new draft revision; the parent
    // flips back to draft regardless of its previous lifecycle state.
    const updateData: Record<string, unknown> = {};

    if (dto.name !== undefined) updateData.name = dto.name;
    if (dto.description !== undefined) updateData.description = dto.description;
    if (dto.config !== undefined) updateData.config = dto.config;
    if (dto.isRequired !== undefined) updateData.isRequired = dto.isRequired;
    if (dto.isUnique !== undefined) updateData.isUnique = dto.isUnique;
    if (dto.isIndexed !== undefined) updateData.isIndexed = dto.isIndexed;
    if (dto.validationRules !== undefined) updateData.validationRules = dto.validationRules;
    if (dto.defaultValue !== undefined) updateData.defaultValue = dto.defaultValue;
    if (dto.defaultValueType !== undefined) updateData.defaultValueType = dto.defaultValueType;
    if (dto.position !== undefined) updateData.position = dto.position;
    if (dto.isVisible !== undefined) updateData.isVisible = dto.isVisible;
    if (dto.isReadonly !== undefined) updateData.isReadonly = dto.isReadonly;
    if (dto.displayFormat !== undefined) updateData.displayFormat = dto.displayFormat;
    if (dto.placeholder !== undefined) updateData.placeholder = dto.placeholder;
    if (dto.helpText !== undefined) updateData.helpText = dto.helpText;
    if (dto.referenceCollectionId !== undefined) updateData.referenceCollectionId = dto.referenceCollectionId;
    if (dto.referenceDisplayProperty !== undefined) updateData.referenceDisplayProperty = dto.referenceDisplayProperty;
    if (dto.referenceFilter !== undefined) updateData.referenceFilter = dto.referenceFilter;
    if (dto.choiceListId !== undefined) updateData.choiceListId = dto.choiceListId;
    if (dto.isSearchable !== undefined) updateData.isSearchable = dto.isSearchable;
    if (dto.isSortable !== undefined) updateData.isSortable = dto.isSortable;
    if (dto.isFilterable !== undefined) updateData.isFilterable = dto.isFilterable;
    if (dto.behavioralAttributes !== undefined) {
      updateData.behavioralAttributes = dto.behavioralAttributes;
    }
    if (dto.metadata !== undefined) {
      updateData.metadata = this.mergeMetadata(dto.metadata, 'draft', existing.metadata);
    }
    if (dto.columnName !== undefined && dto.columnName !== existing.columnName) {
      await this.assertColumnNameAvailable(
        existing.collectionId,
        dto.columnName,
        existing.id,
      );
      updateData.columnName = dto.columnName;
    }

    if (Object.keys(updateData).length > 0) {
      updateData.status = 'draft';
      await this.propertyRepo.update(id, updateData);

      // Append a new draft revision capturing the post-edit snapshot.
      const refreshed = await this.getProperty(id);
      const nextRev = await this.nextRevisionNumber(id);
      const savedRevision = await this.revisionRepo.save(
        this.revisionRepo.create({
          propertyId: id,
          revision: nextRev,
          status: 'draft',
          payload: this.snapshotProperty(refreshed),
          createdBy: _userId ?? null,
        }),
      );
      await this.propertyRepo.update(id, { currentRevisionId: savedRevision.id });
    }

    const saved = await this.getProperty(id);
    if (Object.keys(updateData).length > 0) {
      await this.logAudit({
        userId: _userId || 'system',
        action: 'update',
        recordId: saved.id,
        previousState: this.toAuditState(existing),
        newState: this.toAuditState(saved),
        ipAddress: context?.ipAddress,
        userAgent: context?.userAgent,
      });
    }
    return saved;
  }

  /**
   * Publish the current draft revision of a property. Mirrors
   * CollectionService.publishCollection but scoped to a single property.
   */
  async publishProperty(
    id: string,
    userId?: string,
    context?: { ipAddress?: string; userAgent?: string },
  ): Promise<PropertyDefinition> {
    const property = await this.getProperty(id);
    const previousState = this.toAuditState(property);
    const now = new Date();

    if (property.currentRevisionId) {
      const revision = await this.revisionRepo.findOne({
        where: { id: property.currentRevisionId },
      });
      if (revision && revision.status !== 'published') {
        revision.status = 'published';
        revision.publishedBy = userId ?? null;
        revision.publishedAt = now;
        await this.revisionRepo.save(revision);
      }
    }

    await this.propertyRepo.update(id, {
      status: 'published',
      publishedAt: now,
      metadata: this.mergeMetadata(property.metadata, 'published', property.metadata) as Record<string, unknown>,
    } as Partial<PropertyDefinition> as never);

    const saved = await this.getProperty(id);
    await this.logAudit({
      userId: userId || 'system',
      action: 'publish',
      recordId: saved.id,
      previousState,
      newState: this.toAuditState(saved),
      ipAddress: context?.ipAddress,
      userAgent: context?.userAgent,
    });
    return saved;
  }

  /** Deprecate a property without deleting its records. */
  async deprecateProperty(
    id: string,
    userId?: string,
    context?: { ipAddress?: string; userAgent?: string },
  ): Promise<PropertyDefinition> {
    const property = await this.getProperty(id);
    const previousState = this.toAuditState(property);

    await this.propertyRepo.update(id, {
      status: 'deprecated',
      metadata: this.mergeMetadata(property.metadata, 'deprecated', property.metadata) as Record<string, unknown>,
    } as Partial<PropertyDefinition> as never);

    const saved = await this.getProperty(id);
    await this.logAudit({
      userId: userId || 'system',
      action: 'deprecate',
      recordId: saved.id,
      previousState,
      newState: this.toAuditState(saved),
      ipAddress: context?.ipAddress,
      userAgent: context?.userAgent,
    });
    return saved;
  }

  /** List revisions for a property, newest first. */
  listRevisions(propertyId: string): Promise<PropertyDefinitionRevision[]> {
    return this.revisionRepo.find({
      where: { propertyId },
      order: { revision: 'DESC' },
    });
  }

  /**
   * Delete a property.
   *
   * Surfaces dependents (formulas, views, automations, forms, validation
   * rules, display rules) before performing the soft-delete. Operators must
   * explicitly pass force=true to bypass — that path is also used to remove
   * system-flagged properties.
   */
  async deleteProperty(
    id: string,
    force = false,
    _userId?: string,
    context?: { ipAddress?: string; userAgent?: string },
  ): Promise<{ id: string; deleted: boolean }> {
    const property = await this.getProperty(id);

    if (property.isSystem && !force) {
      throw new BadRequestException('Cannot delete system property without force flag');
    }

    if (!force) {
      const refs = await this.referenceScanner.findReferences(property);
      if (refs.total > 0) {
        throw new ConflictException({
          kind: 'in-use',
          message: `Property '${property.code}' has ${refs.total} reference(s) and cannot be deleted. Use force=true to override.`,
          property: { id: property.id, code: property.code, collectionId: property.collectionId },
          refs,
        });
      }
    }

    if (force) {
      await this.propertyRepo.delete(id);
    } else {
      await this.propertyRepo.update(id, { isActive: false });
    }

    await this.logAudit({
      userId: _userId || 'system',
      action: force ? 'delete' : 'deactivate',
      recordId: property.id,
      previousState: this.toAuditState(property),
      newState: force ? null : this.toAuditState({ ...property, isActive: false }),
      ipAddress: context?.ipAddress,
      userAgent: context?.userAgent,
    });

    return { id, deleted: true };
  }

  /**
   * Get the maximum position value for properties in a collection
   */
  private async getMaxPosition(collectionId: string): Promise<number> {
    const result = await this.propertyRepo
      .createQueryBuilder('property')
      .select('MAX(property.position)', 'maxPosition')
      .where('property.collection_id = :collectionId', { collectionId })
      .getRawOne();

    return result?.maxPosition || 0;
  }

  /**
   * Get existing property codes for a collection
   */
  private async getExistingCodes(collectionId: string, codes: string[]): Promise<string[]> {
    const existing = await this.propertyRepo.find({
      where: {
        collectionId,
        code: In(codes),
      },
      select: ['code'],
    });

    return existing.map((p) => p.code);
  }

  /**
   * Generate a database column name from a property code.
   * Postgres caps identifiers at 63 bytes — two long codes that share a prefix
   * collapse to the same physical column name. assertColumnNameAvailable()
   * guards against silent overwrite.
   */
  private generateColumnName(code: string): string {
    return code
      .toLowerCase()
      .replace(/[^a-z0-9_]/g, '_')
      .replace(/^_+|_+$/g, '')
      .substring(0, 63);
  }

  /**
   * Reject a column name that would collide with an existing active property
   * in the same collection. Catches the silent-corruption case where two long
   * property codes truncate to the same 63-byte physical column name.
   */
  private async assertColumnNameAvailable(
    collectionId: string,
    columnName: string,
    excludeId?: string,
  ): Promise<void> {
    const query = this.propertyRepo
      .createQueryBuilder('property')
      .where('property.collection_id = :collectionId', { collectionId })
      .andWhere('property.column_name = :columnName', { columnName })
      .andWhere('property.is_active = :isActive', { isActive: true });

    if (excludeId) {
      query.andWhere('property.id != :excludeId', { excludeId });
    }

    const colliding = await query.getOne();
    if (colliding) {
      throw new ConflictException(
        `Column name "${columnName}" collides with property "${colliding.code}" after truncation. Use a shorter or more distinctive code.`,
      );
    }
  }

  private mergeMetadata(
    incoming: Record<string, unknown> | undefined,
    status: 'draft' | 'published' | 'deprecated',
    existing: Record<string, unknown> = {},
  ): Record<string, unknown> {
    return {
      ...existing,
      ...incoming,
      status,
    };
  }

  private toAuditState(property: PropertyDefinition): Record<string, unknown> {
    return {
      id: property.id,
      code: property.code,
      name: property.name,
      collectionId: property.collectionId,
      applicationId: property.applicationId,
      status: property.status,
      propertyTypeId: property.propertyTypeId,
      isActive: property.isActive,
      behavioralAttributes: property.behavioralAttributes,
      metadata: property.metadata,
    };
  }

  /** Authoring snapshot persisted on every PropertyDefinitionRevision row. */
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

  private async nextRevisionNumber(propertyId: string): Promise<number> {
    const result: Array<{ max: number | string | null }> = await this.revisionRepo
      .createQueryBuilder('rev')
      .select('MAX(rev.revision)', 'max')
      .where('rev.property_id = :propertyId', { propertyId })
      .getRawMany();
    const current = Number(result[0]?.max ?? 0);
    return Number.isFinite(current) ? current + 1 : 1;
  }

  private async logAudit(data: {
    userId: string;
    action: string;
    recordId: string;
    previousState?: Record<string, unknown> | null;
    newState?: Record<string, unknown> | null;
    ipAddress?: string;
    userAgent?: string;
  }): Promise<void> {
    const log = this.auditRepo.create({
      userId: data.userId,
      collectionCode: 'property_definitions',
      recordId: data.recordId,
      action: data.action,
      oldValues: data.previousState || null,
      newValues: data.newState || null,
      ipAddress: data.ipAddress,
      userAgent: data.userAgent,
    });
    await this.auditRepo.save(log);
  }
}
