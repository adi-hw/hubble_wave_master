import { Injectable, NotFoundException, ConflictException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { PropertyDefinition, DefaultValueType, AuditLog } from '@hubblewave/instance-db';
import { PropertyReferenceScanner, PropertyReferenceReport } from './reference-scanner.service';

export interface CreatePropertyDto {
  code: string;
  name?: string;
  description?: string;
  propertyTypeId: string;
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
    @InjectRepository(AuditLog)
    private readonly auditRepo: Repository<AuditLog>,
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
      query.andWhere('property.is_system = :isSystem', { isSystem: false });
    }

    if (!includeInactive) {
      query.andWhere('property.is_active = :isActive', { isActive: true });
    }

    if (propertyTypeId) {
      query.andWhere('property.property_type_id = :propertyTypeId', { propertyTypeId });
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

    const columnName = dto.columnName || this.generateColumnName(dto.code);
    await this.assertColumnNameAvailable(collectionId, columnName);

    const maxPosition = await this.getMaxPosition(collectionId);

    const property = this.propertyRepo.create({
      collectionId,
      code: dto.code,
      name: dto.name || dto.code,
      description: dto.description,
      propertyTypeId: dto.propertyTypeId,
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
      metadata: this.mergeMetadata(dto.metadata, 'draft'),
      ownerType: 'custom',
      isSystem: false,
      isActive: true,
      createdBy: userId,
    });

    const saved = await this.propertyRepo.save(property);
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

    const codes = properties.map((p) => p.code);
    const existingCodes = await this.getExistingCodes(collectionId, codes);

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

        maxPosition++;
        const property = this.propertyRepo.create({
          collectionId,
          code: dto.code,
          name: dto.name || dto.code,
          description: dto.description,
          propertyTypeId: dto.propertyTypeId,
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
          metadata: this.mergeMetadata(dto.metadata, 'draft'),
          ownerType: 'custom',
          isSystem: false,
          isActive: true,
          createdBy: userId,
        });

        const saved = await this.propertyRepo.save(property);
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
    const currentStatus = this.getMetadataStatus(existing.metadata);
    const requestedStatus = (dto.metadata as { status?: string } | undefined)?.status;
    const targetStatus = this.normalizeStatus(requestedStatus) || currentStatus;
    if (currentStatus === 'published' && targetStatus !== 'draft') {
      throw new BadRequestException('Published properties are immutable');
    }

    if (existing.isSystem && dto.isRequired !== undefined) {
      throw new BadRequestException('Cannot modify system property required status');
    }

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
    if (dto.metadata !== undefined) {
      updateData.metadata = this.mergeMetadata(dto.metadata, targetStatus, existing.metadata);
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
      await this.propertyRepo.update(id, updateData);
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

  private getMetadataStatus(metadata?: Record<string, unknown>): 'draft' | 'published' | 'deprecated' {
    const status = (metadata as { status?: string } | undefined)?.status;
    return this.normalizeStatus(status) || 'published';
  }

  private normalizeStatus(value?: string): 'draft' | 'published' | 'deprecated' | null {
    if (value === 'draft' || value === 'published' || value === 'deprecated') {
      return value;
    }
    return null;
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
      propertyTypeId: property.propertyTypeId,
      isActive: property.isActive,
      metadata: property.metadata,
    };
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
