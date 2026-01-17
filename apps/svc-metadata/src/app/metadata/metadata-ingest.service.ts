import { BadRequestException, ConflictException, Injectable } from '@nestjs/common';
import { EntityManager, Repository } from 'typeorm';
import {
  ChoiceList,
  CollectionDefinition,
  PropertyDefinition,
  PropertyType,
} from '@hubblewave/instance-db';

type MetadataAsset = {
  collections: MetadataCollection[];
};

type MetadataCollection = {
  code: string;
  name: string;
  plural_name?: string;
  description?: string;
  category?: string;
  table_name?: string;
  label_property?: string;
  secondary_label_property?: string;
  icon?: string;
  color?: string;
  default_access?: string;
  flags?: {
    is_extensible?: boolean;
    is_audited?: boolean;
    enable_versioning?: boolean;
    enable_attachments?: boolean;
    enable_activity_log?: boolean;
    enable_search?: boolean;
  };
  metadata?: Record<string, unknown>;
  properties?: MetadataProperty[];
};

type MetadataProperty = {
  code: string;
  name?: string;
  description?: string;
  type: string;
  column_name?: string;
  config?: Record<string, unknown>;
  is_required?: boolean;
  is_unique?: boolean;
  is_indexed?: boolean;
  validation_rules?: Record<string, unknown>;
  default_value?: string;
  default_value_type?: PropertyDefinition['defaultValueType'];
  position?: number;
  is_visible?: boolean;
  is_readonly?: boolean;
  display_format?: string;
  placeholder?: string;
  help_text?: string;
  reference_collection_code?: string;
  reference_display_property?: string;
  reference_filter?: Record<string, unknown>;
  choice_list_code?: string;
  is_searchable?: boolean;
  is_sortable?: boolean;
  is_filterable?: boolean;
  metadata?: Record<string, unknown>;
};

@Injectable()
export class MetadataIngestService {
  async applyAsset(
    manager: EntityManager,
    rawAsset: unknown,
    context: { packCode: string; releaseId: string; actorId?: string; status?: 'draft' | 'published' | 'deprecated' },
  ): Promise<void> {
    const asset = this.parseAsset(rawAsset);
    const collectionRepo = manager.getRepository(CollectionDefinition);
    const propertyRepo = manager.getRepository(PropertyDefinition);
    const propertyTypeRepo = manager.getRepository(PropertyType);
    const choiceListRepo = manager.getRepository(ChoiceList);

    const collectionMap = new Map<string, CollectionDefinition>();

    for (const collection of asset.collections) {
      const existing = await collectionRepo.findOne({ where: { code: collection.code } });
      if (existing) {
        this.assertPackOwnership(existing.metadata, context.packCode, 'collection', collection.code);
        this.applyCollectionUpdate(existing, collection, context);
        const saved = await collectionRepo.save(existing);
        collectionMap.set(saved.code, saved);
      } else {
        const created = collectionRepo.create(this.buildCollectionCreate(collection, context));
        const saved = await collectionRepo.save(created);
        collectionMap.set(saved.code, saved);
      }
    }

    for (const collection of asset.collections) {
      const parent = collectionMap.get(collection.code);
      if (!parent) {
        throw new BadRequestException(`Collection not available for ${collection.code}`);
      }
      if (!collection.properties || collection.properties.length === 0) {
        continue;
      }

      for (const property of collection.properties) {
        const propertyType = await propertyTypeRepo.findOne({ where: { code: property.type } });
        if (!propertyType) {
          throw new BadRequestException(`Unknown property type ${property.type} for ${collection.code}.${property.code}`);
        }

        const referenceCollectionId = property.reference_collection_code
          ? this.resolveCollectionId(collectionMap, property.reference_collection_code)
          : undefined;
        const choiceListId = property.choice_list_code
          ? await this.resolveChoiceList(choiceListRepo, property.choice_list_code)
          : undefined;

        const existingProperty = await propertyRepo.findOne({
          where: { collectionId: parent.id, code: property.code },
        });

        if (existingProperty) {
          this.assertPackOwnership(existingProperty.metadata, context.packCode, 'property', property.code);
          this.applyPropertyUpdate(existingProperty, property, propertyType.id, referenceCollectionId, choiceListId, context);
          await propertyRepo.save(existingProperty);
          continue;
        }

        const createdProperty = propertyRepo.create(
          this.buildPropertyCreate(property, parent.id, propertyType.id, referenceCollectionId, choiceListId, context),
        );
        await propertyRepo.save(createdProperty);
      }
    }
  }

  async deactivateAsset(
    manager: EntityManager,
    rawAsset: unknown,
    context: { packCode: string; releaseId: string; actorId?: string },
  ): Promise<void> {
    const asset = this.parseAsset(rawAsset);
    const collectionRepo = manager.getRepository(CollectionDefinition);
    const propertyRepo = manager.getRepository(PropertyDefinition);

    const collectionMap = new Map<string, CollectionDefinition>();

    for (const collection of asset.collections) {
      const existing = await collectionRepo.findOne({ where: { code: collection.code } });
      if (!existing) {
        continue;
      }
      this.assertPackOwnership(existing.metadata, context.packCode, 'collection', collection.code);
      existing.isActive = false;
      existing.metadata = this.mergeMetadata(
        collection.metadata,
        { packCode: context.packCode, releaseId: context.releaseId, status: 'deprecated' },
        existing.metadata,
      );
      existing.updatedBy = context.actorId;
      const saved = await collectionRepo.save(existing);
      collectionMap.set(saved.code, saved);
    }

    for (const collection of asset.collections) {
      if (!collection.properties || collection.properties.length === 0) {
        continue;
      }
      const parent = collectionMap.get(collection.code)
        || await collectionRepo.findOne({ where: { code: collection.code } });
      if (!parent) {
        continue;
      }

      for (const property of collection.properties) {
        const existingProperty = await propertyRepo.findOne({
          where: { collectionId: parent.id, code: property.code },
        });
        if (!existingProperty) {
          continue;
        }
        this.assertPackOwnership(existingProperty.metadata, context.packCode, 'property', property.code);
        existingProperty.isActive = false;
        existingProperty.metadata = this.mergeMetadata(
          property.metadata,
          { packCode: context.packCode, releaseId: context.releaseId, status: 'deprecated' },
          existingProperty.metadata,
        );
        await propertyRepo.save(existingProperty);
      }
    }
  }

  private parseAsset(raw: unknown): MetadataAsset {
    if (!raw || typeof raw !== 'object') {
      throw new BadRequestException('Metadata asset must be an object');
    }
    const collections = (raw as { collections?: unknown }).collections;
    if (!Array.isArray(collections) || collections.length === 0) {
      throw new BadRequestException('Metadata asset must include collections');
    }

    const parsedCollections: MetadataCollection[] = collections.map((collection, index) => {
      if (!collection || typeof collection !== 'object') {
        throw new BadRequestException(`Collection at index ${index} is invalid`);
      }
      const candidate = collection as MetadataCollection;
      if (!candidate.code || typeof candidate.code !== 'string') {
        throw new BadRequestException(`Collection at index ${index} is missing code`);
      }
      if (!candidate.name || typeof candidate.name !== 'string') {
        throw new BadRequestException(`Collection ${candidate.code} is missing name`);
      }
      return candidate;
    });

    this.validateUniqueCollectionCodes(parsedCollections);
    for (const collection of parsedCollections) {
      this.validateCollectionCode(collection.code);
      if (collection.properties) {
        this.validateProperties(collection.code, collection.properties);
      }
    }

    return { collections: parsedCollections };
  }

  private buildCollectionCreate(
    collection: MetadataCollection,
    context: { packCode: string; releaseId: string; actorId?: string; status?: 'draft' | 'published' | 'deprecated' },
  ): Partial<CollectionDefinition> {
    return {
      code: collection.code,
      name: collection.name,
      pluralName: collection.plural_name || `${collection.name}s`,
      description: collection.description,
      category: collection.category,
      tableName: collection.table_name || this.normalizeTableName(collection.code),
      labelProperty: collection.label_property || 'name',
      secondaryLabelProperty: collection.secondary_label_property,
      icon: collection.icon,
      color: collection.color,
      defaultAccess: collection.default_access || 'read',
      ownerType: 'platform',
      isSystem: false,
      isActive: true,
      isExtensible: collection.flags?.is_extensible ?? true,
      isAudited: collection.flags?.is_audited ?? true,
      enableVersioning: collection.flags?.enable_versioning ?? false,
      enableAttachments: collection.flags?.enable_attachments ?? true,
      enableActivityLog: collection.flags?.enable_activity_log ?? true,
      enableSearch: collection.flags?.enable_search ?? true,
      metadata: this.mergeMetadata(collection.metadata, context),
      createdBy: context.actorId,
      updatedBy: context.actorId,
    };
  }

  private applyCollectionUpdate(
    existing: CollectionDefinition,
    collection: MetadataCollection,
    context: { packCode: string; releaseId: string; actorId?: string; status?: 'draft' | 'published' | 'deprecated' },
  ): void {
    existing.name = collection.name;
    existing.pluralName = collection.plural_name || existing.pluralName || `${collection.name}s`;
    existing.description = collection.description;
    existing.category = collection.category;
    existing.labelProperty = collection.label_property || existing.labelProperty;
    existing.secondaryLabelProperty = collection.secondary_label_property;
    existing.icon = collection.icon;
    existing.color = collection.color;
    existing.defaultAccess = collection.default_access || existing.defaultAccess;
    existing.isExtensible = collection.flags?.is_extensible ?? existing.isExtensible;
    existing.isAudited = collection.flags?.is_audited ?? existing.isAudited;
    existing.enableVersioning = collection.flags?.enable_versioning ?? existing.enableVersioning;
    existing.enableAttachments = collection.flags?.enable_attachments ?? existing.enableAttachments;
    existing.enableActivityLog = collection.flags?.enable_activity_log ?? existing.enableActivityLog;
    existing.enableSearch = collection.flags?.enable_search ?? existing.enableSearch;
    existing.metadata = this.mergeMetadata(collection.metadata, context, existing.metadata);
    existing.updatedBy = context.actorId;
  }

  private buildPropertyCreate(
    property: MetadataProperty,
    collectionId: string,
    propertyTypeId: string,
    referenceCollectionId: string | undefined,
    choiceListId: string | undefined,
    context: { packCode: string; releaseId: string; actorId?: string; status?: 'draft' | 'published' | 'deprecated' },
  ): Partial<PropertyDefinition> {
    return {
      collectionId,
      code: property.code,
      name: property.name || property.code,
      description: property.description,
      propertyTypeId,
      columnName: property.column_name || this.normalizeColumnName(property.code),
      config: property.config || {},
      isRequired: property.is_required ?? false,
      isUnique: property.is_unique ?? false,
      isIndexed: property.is_indexed ?? false,
      validationRules: property.validation_rules || {},
      defaultValue: property.default_value,
      defaultValueType: property.default_value_type || 'static',
      position: property.position || 0,
      isVisible: property.is_visible ?? true,
      isReadonly: property.is_readonly ?? false,
      displayFormat: property.display_format,
      placeholder: property.placeholder,
      helpText: property.help_text,
      referenceCollectionId: referenceCollectionId || null,
      referenceDisplayProperty: property.reference_display_property,
      referenceFilter: property.reference_filter,
      choiceListId: choiceListId || null,
      isSearchable: property.is_searchable ?? false,
      isSortable: property.is_sortable ?? true,
      isFilterable: property.is_filterable ?? true,
      metadata: this.mergeMetadata(property.metadata, context),
      ownerType: 'platform',
      isSystem: false,
      isActive: true,
      createdBy: context.actorId,
    };
  }

  private applyPropertyUpdate(
    existing: PropertyDefinition,
    property: MetadataProperty,
    propertyTypeId: string,
    referenceCollectionId: string | undefined,
    choiceListId: string | undefined,
    context: { packCode: string; releaseId: string; actorId?: string; status?: 'draft' | 'published' | 'deprecated' },
  ): void {
    existing.name = property.name || existing.name;
    existing.description = property.description;
    existing.propertyTypeId = propertyTypeId;
    existing.columnName = property.column_name || existing.columnName;
    existing.config = property.config || {};
    existing.isRequired = property.is_required ?? existing.isRequired;
    existing.isUnique = property.is_unique ?? existing.isUnique;
    existing.isIndexed = property.is_indexed ?? existing.isIndexed;
    existing.validationRules = property.validation_rules || existing.validationRules;
    existing.defaultValue = property.default_value;
    existing.defaultValueType = property.default_value_type || existing.defaultValueType;
    existing.position = property.position ?? existing.position;
    existing.isVisible = property.is_visible ?? existing.isVisible;
    existing.isReadonly = property.is_readonly ?? existing.isReadonly;
    existing.displayFormat = property.display_format;
    existing.placeholder = property.placeholder;
    existing.helpText = property.help_text;
    existing.referenceCollectionId = referenceCollectionId || null;
    existing.referenceDisplayProperty = property.reference_display_property;
    existing.referenceFilter = property.reference_filter;
    existing.choiceListId = choiceListId || null;
    existing.isSearchable = property.is_searchable ?? existing.isSearchable;
    existing.isSortable = property.is_sortable ?? existing.isSortable;
    existing.isFilterable = property.is_filterable ?? existing.isFilterable;
    existing.metadata = this.mergeMetadata(property.metadata, context, existing.metadata);
  }

  private resolveCollectionId(collections: Map<string, CollectionDefinition>, code: string): string {
    const record = collections.get(code);
    if (!record) {
      throw new BadRequestException(`Unknown reference collection ${code}`);
    }
    return record.id;
  }

  private async resolveChoiceList(
    repo: Repository<ChoiceList>,
    code: string,
  ): Promise<string> {
    const list = await repo.findOne({ where: { code } });
    if (!list) {
      throw new BadRequestException(`Unknown choice list ${code}`);
    }
    return list.id;
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
    entityType: 'collection' | 'property',
    entityCode: string,
  ): void {
    const existingPack = (metadata as { pack?: { code?: string } }).pack?.code;
    if (existingPack && existingPack !== packCode) {
      throw new ConflictException(
        `${entityType} ${entityCode} is owned by pack ${existingPack}`
      );
    }
  }

  private validateUniqueCollectionCodes(collections: MetadataCollection[]): void {
    const seen = new Set<string>();
    for (const collection of collections) {
      if (seen.has(collection.code)) {
        throw new BadRequestException(`Duplicate collection code ${collection.code}`);
      }
      seen.add(collection.code);
    }
  }

  private validateCollectionCode(code: string): void {
    if (!/^[a-z0-9_]+$/.test(code)) {
      throw new BadRequestException(`Collection code ${code} is invalid`);
    }
  }

  private validateProperties(collectionCode: string, properties: MetadataProperty[]): void {
    const seen = new Set<string>();
    for (const property of properties) {
      if (!property.code || typeof property.code !== 'string') {
        throw new BadRequestException(`Property code missing in collection ${collectionCode}`);
      }
      if (!/^[a-z0-9_]+$/.test(property.code)) {
        throw new BadRequestException(`Property code ${property.code} is invalid`);
      }
      if (!property.type || typeof property.type !== 'string') {
        throw new BadRequestException(`Property ${collectionCode}.${property.code} is missing type`);
      }
      if (seen.has(property.code)) {
        throw new BadRequestException(`Duplicate property code ${property.code} in ${collectionCode}`);
      }
      seen.add(property.code);
    }
  }

  private normalizeColumnName(code: string): string {
    return code
      .toLowerCase()
      .replace(/[^a-z0-9_]/g, '_')
      .replace(/^_+|_+$/g, '')
      .substring(0, 63);
  }

  private normalizeTableName(code: string): string {
    const base = this.normalizeColumnName(code);
    return `u_${base}`;
  }
}
