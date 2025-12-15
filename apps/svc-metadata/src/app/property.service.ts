import { Injectable, NotFoundException, ConflictException, BadRequestException } from '@nestjs/common';
import {
  TenantDbService,
  PropertyDefinition,
  PropertyType,
  ChoiceType,
  UiWidth,
  ChoiceOption,
  PropertyDependency,
  DependencyType,
  DependencyCondition,
} from '@eam-platform/tenant-db';
import { IsNull } from 'typeorm';
import { CollectionService } from './collection.service';

export interface CreatePropertyDto {
  collectionId: string;
  code: string;
  label: string;
  description?: string;
  propertyType: PropertyType;
  storageColumn: string;
  isSystem?: boolean;
  isRequired?: boolean;
  isUnique?: boolean;
  isIndexed?: boolean;
  isSearchable?: boolean;
  isFilterable?: boolean;
  isSortable?: boolean;
  isReadonly?: boolean;
  isComputed?: boolean;
  isEncrypted?: boolean;
  isInternal?: boolean;
  maxLength?: number;
  minValue?: number;
  maxValue?: number;
  precisionValue?: number;
  scaleValue?: number;
  defaultValue?: unknown;
  computedFormula?: string;
  validationRegex?: string;
  validationMessage?: string;
  hintText?: string;
  placeholder?: string;
  referenceCollectionId?: string;
  referenceDisplayProperty?: string;
  referenceFilter?: Record<string, unknown>;
  choiceList?: ChoiceOption[];
  choiceType?: ChoiceType;
  choiceDependentOn?: string;
  sortOrder?: number;
  groupName?: string;
  uiWidth?: UiWidth;
  uiComponent?: string;
  uiOptions?: Record<string, unknown>;
}

export interface UpdatePropertyDto {
  label?: string;
  description?: string;
  isRequired?: boolean;
  isIndexed?: boolean;
  isSearchable?: boolean;
  isFilterable?: boolean;
  isSortable?: boolean;
  isReadonly?: boolean;
  maxLength?: number;
  minValue?: number;
  maxValue?: number;
  precisionValue?: number;
  scaleValue?: number;
  defaultValue?: unknown;
  computedFormula?: string;
  validationRegex?: string;
  validationMessage?: string;
  hintText?: string;
  placeholder?: string;
  referenceDisplayProperty?: string;
  referenceFilter?: Record<string, unknown>;
  choiceList?: ChoiceOption[];
  sortOrder?: number;
  groupName?: string;
  uiWidth?: UiWidth;
  uiComponent?: string;
  uiOptions?: Record<string, unknown>;
}

export interface CreateDependencyDto {
  dependentPropertyId: string;
  dependsOnPropertyId: string;
  condition: DependencyCondition;
  dependencyType?: DependencyType;
}

@Injectable()
export class PropertyService {
  constructor(
    private readonly tenantDb: TenantDbService,
    private readonly collectionService: CollectionService
  ) {}

  private async propertyRepo(tenantId: string) {
    const ds = await this.tenantDb.getDataSource(tenantId);
    return ds.getRepository(PropertyDefinition);
  }

  private async dependencyRepo(tenantId: string) {
    const ds = await this.tenantDb.getDataSource(tenantId);
    return ds.getRepository(PropertyDependency);
  }

  /**
   * List all properties across all collections
   */
  async listAllProperties(tenantId: string) {
    const repo = await this.propertyRepo(tenantId);

    return repo.find({
      where: { deletedAt: IsNull() },
      order: { collectionId: 'ASC', groupName: 'ASC', sortOrder: 'ASC' },
    });
  }

  /**
   * Get a single property by ID
   */
  async getProperty(tenantId: string, propertyId: string) {
    const repo = await this.propertyRepo(tenantId);
    const property = await repo.findOne({
      where: { id: propertyId, deletedAt: IsNull() },
    });

    if (!property) {
      throw new NotFoundException(`Property ${propertyId} not found`);
    }

    return property;
  }

  /**
   * Get property by collection and code
   */
  async getPropertyByCode(tenantId: string, collectionId: string, code: string) {
    const repo = await this.propertyRepo(tenantId);
    const property = await repo.findOne({
      where: { collectionId, code, deletedAt: IsNull() },
    });

    if (!property) {
      throw new NotFoundException(`Property '${code}' not found in collection`);
    }

    return property;
  }

  /**
   * List properties by collection, optionally grouped
   */
  async listProperties(tenantId: string, collectionId: string, grouped = false) {
    const repo = await this.propertyRepo(tenantId);

    const properties = await repo.find({
      where: { collectionId, deletedAt: IsNull() },
      order: { groupName: 'ASC', sortOrder: 'ASC' },
    });

    if (!grouped) {
      return properties;
    }

    // Group properties by groupName
    const groups: Record<string, PropertyDefinition[]> = {};
    for (const prop of properties) {
      const group = prop.groupName || 'General';
      if (!groups[group]) {
        groups[group] = [];
      }
      groups[group].push(prop);
    }

    return groups;
  }

  /**
   * Create a new property
   */
  async createProperty(tenantId: string, dto: CreatePropertyDto, createdBy?: string) {
    const repo = await this.propertyRepo(tenantId);

    // Validate collection exists
    await this.collectionService.getCollection(tenantId, dto.collectionId);

    // Check for duplicate code
    const existing = await repo.findOne({
      where: { collectionId: dto.collectionId, code: dto.code },
    });
    if (existing) {
      throw new ConflictException(`Property '${dto.code}' already exists in this collection`);
    }

    // Validate property type specific requirements
    this.validatePropertyTypeRequirements(dto);

    const property = repo.create({
      ...dto,
      isSystem: dto.isSystem ?? false,
      isRequired: dto.isRequired ?? false,
      isUnique: dto.isUnique ?? false,
      isIndexed: dto.isIndexed ?? false,
      isSearchable: dto.isSearchable ?? true,
      isFilterable: dto.isFilterable ?? true,
      isSortable: dto.isSortable ?? true,
      isReadonly: dto.isReadonly ?? false,
      isComputed: dto.isComputed ?? false,
      isEncrypted: dto.isEncrypted ?? false,
      isInternal: dto.isInternal ?? false,
      sortOrder: dto.sortOrder ?? 0,
      uiWidth: dto.uiWidth ?? 'full',
      uiOptions: dto.uiOptions ?? {},
      createdBy,
      updatedBy: createdBy,
    });

    return repo.save(property);
  }

  /**
   * Update a property
   */
  async updateProperty(tenantId: string, propertyId: string, dto: UpdatePropertyDto, updatedBy?: string) {
    const repo = await this.propertyRepo(tenantId);
    const property = await this.getProperty(tenantId, propertyId);

    // Cannot modify system properties (except display settings)
    if (
      property.isSystem &&
      Object.keys(dto).some((k) => !['label', 'description', 'hintText', 'placeholder', 'sortOrder', 'groupName', 'uiWidth', 'uiComponent', 'uiOptions'].includes(k))
    ) {
      throw new ConflictException('Cannot modify system property structure');
    }

    Object.assign(property, dto, {
      updatedBy,
      version: property.version + 1,
    });

    return repo.save(property);
  }

  /**
   * Soft delete a property
   */
  async deleteProperty(tenantId: string, propertyId: string, deletedBy?: string) {
    const repo = await this.propertyRepo(tenantId);
    const property = await this.getProperty(tenantId, propertyId);

    if (property.isSystem) {
      throw new ConflictException('Cannot delete system properties');
    }

    property.deletedAt = new Date();
    property.updatedBy = deletedBy;

    return repo.save(property);
  }

  /**
   * Deprecate a property (mark as deprecated but don't delete)
   */
  async deprecateProperty(tenantId: string, propertyId: string, message: string, deprecatedBy?: string) {
    const repo = await this.propertyRepo(tenantId);
    const property = await this.getProperty(tenantId, propertyId);

    property.deprecatedAt = new Date();
    property.deprecationMessage = message;
    property.updatedBy = deprecatedBy;

    return repo.save(property);
  }

  /**
   * Reorder properties within a collection
   */
  async reorderProperties(tenantId: string, collectionId: string, propertyOrders: { id: string; sortOrder: number }[]) {
    const repo = await this.propertyRepo(tenantId);

    await Promise.all(
      propertyOrders.map(({ id, sortOrder }) =>
        repo.update({ id, collectionId }, { sortOrder })
      )
    );

    return this.listProperties(tenantId, collectionId);
  }

  /**
   * Update choice list for a property
   */
  async updateChoiceList(tenantId: string, propertyId: string, choices: ChoiceOption[], updatedBy?: string) {
    const property = await this.getProperty(tenantId, propertyId);

    if (!['choice', 'multi_choice'].includes(property.propertyType)) {
      throw new BadRequestException('Choice list can only be set on choice properties');
    }

    return this.updateProperty(tenantId, propertyId, { choiceList: choices }, updatedBy);
  }

  /**
   * Create a property dependency
   */
  async createDependency(tenantId: string, dto: CreateDependencyDto) {
    const depRepo = await this.dependencyRepo(tenantId);

    // Validate both properties exist
    await this.getProperty(tenantId, dto.dependentPropertyId);
    await this.getProperty(tenantId, dto.dependsOnPropertyId);

    // Check for circular dependency
    const existingReverse = await depRepo.findOne({
      where: {
        dependentPropertyId: dto.dependsOnPropertyId,
        dependsOnPropertyId: dto.dependentPropertyId,
      },
    });
    if (existingReverse) {
      throw new BadRequestException('Circular dependency detected');
    }

    const dependency = depRepo.create({
      ...dto,
      dependencyType: dto.dependencyType ?? 'visibility',
    });

    return depRepo.save(dependency);
  }

  /**
   * Get dependencies for a property
   */
  async getPropertyDependencies(tenantId: string, propertyId: string) {
    const depRepo = await this.dependencyRepo(tenantId);

    const [dependsOn, dependents] = await Promise.all([
      depRepo.find({
        where: { dependentPropertyId: propertyId },
        relations: ['dependsOnProperty'],
      }),
      depRepo.find({
        where: { dependsOnPropertyId: propertyId },
        relations: ['dependentProperty'],
      }),
    ]);

    return { dependsOn, dependents };
  }

  /**
   * Delete a dependency
   */
  async deleteDependency(tenantId: string, dependencyId: string) {
    const depRepo = await this.dependencyRepo(tenantId);
    const result = await depRepo.delete(dependencyId);

    if (result.affected === 0) {
      throw new NotFoundException('Dependency not found');
    }

    return { deleted: true };
  }

  /**
   * Clone a property to another collection
   */
  async cloneProperty(
    tenantId: string,
    propertyId: string,
    targetCollectionId: string,
    newCode?: string,
    createdBy?: string
  ) {
    const source = await this.getProperty(tenantId, propertyId);

    // Clear reference-specific fields if cloning to a different collection
    const referenceFields =
      source.collectionId === targetCollectionId
        ? {}
        : {
            referenceCollectionId: undefined,
            referenceDisplayProperty: undefined,
            referenceFilter: undefined,
            choiceDependentOn: undefined,
          };

    const dto: CreatePropertyDto = {
      collectionId: targetCollectionId,
      code: newCode || source.code,
      label: source.label,
      description: source.description || undefined,
      propertyType: source.propertyType,
      storageColumn: newCode || source.storageColumn,
      isRequired: source.isRequired,
      isUnique: source.isUnique,
      isIndexed: source.isIndexed,
      isSearchable: source.isSearchable,
      isFilterable: source.isFilterable,
      isSortable: source.isSortable,
      isReadonly: source.isReadonly,
      isComputed: source.isComputed,
      isEncrypted: source.isEncrypted,
      maxLength: source.maxLength || undefined,
      minValue: source.minValue || undefined,
      maxValue: source.maxValue || undefined,
      precisionValue: source.precisionValue || undefined,
      scaleValue: source.scaleValue || undefined,
      defaultValue: source.defaultValue,
      computedFormula: source.computedFormula || undefined,
      validationRegex: source.validationRegex || undefined,
      validationMessage: source.validationMessage || undefined,
      hintText: source.hintText || undefined,
      placeholder: source.placeholder || undefined,
      choiceList: source.choiceList || undefined,
      choiceType: source.choiceType || undefined,
      groupName: source.groupName || undefined,
      uiWidth: source.uiWidth,
      uiComponent: source.uiComponent || undefined,
      uiOptions: source.uiOptions,
      ...referenceFields,
    };

    return this.createProperty(tenantId, dto, createdBy);
  }

  /**
   * Validate property type specific requirements
   */
  private validatePropertyTypeRequirements(dto: CreatePropertyDto) {
    const { propertyType } = dto;

    // Reference types require a target collection
    if (['reference', 'multi_reference', 'user', 'group'].includes(propertyType)) {
      if (!dto.referenceCollectionId && !['user', 'group'].includes(propertyType)) {
        throw new BadRequestException('Reference properties require a target collection');
      }
    }

    // Choice types can have a choice list
    if (['choice', 'multi_choice'].includes(propertyType)) {
      if (dto.choiceList && !Array.isArray(dto.choiceList)) {
        throw new BadRequestException('Choice list must be an array');
      }
    }

    // Computed fields require a formula
    if (dto.isComputed && !dto.computedFormula) {
      throw new BadRequestException('Computed properties require a formula');
    }

    // Decimal/currency types can have precision/scale
    if (['decimal', 'currency', 'percent'].includes(propertyType)) {
      if (dto.precisionValue !== undefined && dto.precisionValue < 1) {
        throw new BadRequestException('Precision must be at least 1');
      }
      if (dto.scaleValue !== undefined && dto.scaleValue < 0) {
        throw new BadRequestException('Scale cannot be negative');
      }
    }
  }
}
