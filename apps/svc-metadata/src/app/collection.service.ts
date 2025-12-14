import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import {
  TenantDbService,
  CollectionDefinition,
  PropertyDefinition,
  PropertyTypeDefinition,
  CollectionRelationship,
} from '@eam-platform/tenant-db';
import { IsNull } from 'typeorm';

export interface CreateCollectionDto {
  code: string;
  label: string;
  labelPlural?: string;
  description?: string;
  icon?: string;
  color?: string;
  storageTable: string;
  isSystem?: boolean;
  isExtensible?: boolean;
  isAudited?: boolean;
  isVersioned?: boolean;
  extendsCollectionId?: string;
  moduleId?: string;
  category?: string;
  tags?: string[];
  metadata?: Record<string, unknown>;
  sortOrder?: number;
}

export interface UpdateCollectionDto {
  label?: string;
  labelPlural?: string;
  description?: string;
  icon?: string;
  color?: string;
  isExtensible?: boolean;
  isAudited?: boolean;
  isVersioned?: boolean;
  moduleId?: string;
  displayPropertyId?: string;
  identifierPropertyId?: string;
  category?: string;
  tags?: string[];
  metadata?: Record<string, unknown>;
  sortOrder?: number;
}

export interface CollectionQueryOptions {
  moduleId?: string;
  category?: string;
  includeSystem?: boolean;
  search?: string;
}

@Injectable()
export class CollectionService {
  constructor(private readonly tenantDb: TenantDbService) {}

  private async collectionRepo(tenantId: string) {
    const ds = await this.tenantDb.getDataSource(tenantId);
    return ds.getRepository(CollectionDefinition);
  }

  private async propertyRepo(tenantId: string) {
    const ds = await this.tenantDb.getDataSource(tenantId);
    return ds.getRepository(PropertyDefinition);
  }

  private async propertyTypeRepo(tenantId: string) {
    const ds = await this.tenantDb.getDataSource(tenantId);
    return ds.getRepository(PropertyTypeDefinition);
  }

  private async relationshipRepo(tenantId: string) {
    const ds = await this.tenantDb.getDataSource(tenantId);
    return ds.getRepository(CollectionRelationship);
  }

  /**
   * List all collections with optional filtering
   */
  async listCollections(tenantId: string, options: CollectionQueryOptions = {}) {
    const repo = await this.collectionRepo(tenantId);
    const qb = repo.createQueryBuilder('c').where('c.deleted_at IS NULL');

    if (options.moduleId) {
      qb.andWhere('c.module_id = :moduleId', { moduleId: options.moduleId });
    }

    if (options.category) {
      qb.andWhere('c.category = :category', { category: options.category });
    }

    if (!options.includeSystem) {
      qb.andWhere('c.is_system = false');
    }

    if (options.search) {
      qb.andWhere('(c.label ILIKE :search OR c.code ILIKE :search OR c.description ILIKE :search)', {
        search: `%${options.search}%`,
      });
    }

    qb.orderBy('c.sort_order', 'ASC').addOrderBy('c.label', 'ASC');

    return qb.getMany();
  }

  /**
   * Get a single collection by ID
   */
  async getCollection(tenantId: string, collectionId: string) {
    const repo = await this.collectionRepo(tenantId);
    const collection = await repo.findOne({
      where: { id: collectionId, deletedAt: IsNull() },
    });

    if (!collection) {
      throw new NotFoundException(`Collection ${collectionId} not found`);
    }

    return collection;
  }

  /**
   * Get a collection by its code
   */
  async getCollectionByCode(tenantId: string, code: string) {
    const repo = await this.collectionRepo(tenantId);
    const collection = await repo.findOne({
      where: { code, deletedAt: IsNull() },
    });

    if (!collection) {
      throw new NotFoundException(`Collection with code '${code}' not found`);
    }

    return collection;
  }

  /**
   * Create a new collection
   */
  async createCollection(tenantId: string, dto: CreateCollectionDto, createdBy?: string) {
    const repo = await this.collectionRepo(tenantId);

    // Check for duplicate code
    const existing = await repo.findOne({ where: { code: dto.code } });
    if (existing) {
      throw new ConflictException(`Collection with code '${dto.code}' already exists`);
    }

    const collection = repo.create({
      ...dto,
      tags: dto.tags || [],
      metadata: dto.metadata || {},
      isSystem: dto.isSystem ?? false,
      isExtensible: dto.isExtensible ?? true,
      isAudited: dto.isAudited ?? true,
      isVersioned: dto.isVersioned ?? false,
      sortOrder: dto.sortOrder ?? 0,
      createdBy,
      updatedBy: createdBy,
    });

    return repo.save(collection);
  }

  /**
   * Update a collection
   */
  async updateCollection(tenantId: string, collectionId: string, dto: UpdateCollectionDto, updatedBy?: string) {
    const repo = await this.collectionRepo(tenantId);
    const collection = await this.getCollection(tenantId, collectionId);

    // Cannot modify system collections (except metadata)
    if (collection.isSystem && Object.keys(dto).some((k) => !['metadata', 'tags', 'sortOrder'].includes(k))) {
      throw new ConflictException('Cannot modify system collection properties');
    }

    Object.assign(collection, dto, {
      updatedBy,
      version: collection.version + 1,
    });

    return repo.save(collection);
  }

  /**
   * Soft delete a collection
   */
  async deleteCollection(tenantId: string, collectionId: string, deletedBy?: string) {
    const repo = await this.collectionRepo(tenantId);
    const collection = await this.getCollection(tenantId, collectionId);

    if (collection.isSystem) {
      throw new ConflictException('Cannot delete system collections');
    }

    collection.deletedAt = new Date();
    collection.updatedBy = deletedBy;

    return repo.save(collection);
  }

  /**
   * Get all properties for a collection
   */
  async getCollectionProperties(tenantId: string, collectionId: string) {
    const propRepo = await this.propertyRepo(tenantId);

    return propRepo.find({
      where: { collectionId, deletedAt: IsNull() },
      order: { groupName: 'ASC', sortOrder: 'ASC' },
    });
  }

  /**
   * Get collection with its properties
   */
  async getCollectionWithProperties(tenantId: string, collectionId: string) {
    const collection = await this.getCollection(tenantId, collectionId);
    const properties = await this.getCollectionProperties(tenantId, collectionId);

    return {
      ...collection,
      properties,
    };
  }

  /**
   * Get all property types
   */
  async getPropertyTypes(tenantId: string) {
    const repo = await this.propertyTypeRepo(tenantId);
    return repo.find({ order: { category: 'ASC', sortOrder: 'ASC' } });
  }

  /**
   * Get relationships for a collection
   */
  async getCollectionRelationships(tenantId: string, collectionId: string) {
    const repo = await this.relationshipRepo(tenantId);

    const [outgoing, incoming] = await Promise.all([
      repo.find({
        where: { sourceCollectionId: collectionId },
        relations: ['targetCollection', 'sourceProperty'],
      }),
      repo.find({
        where: { targetCollectionId: collectionId },
        relations: ['sourceCollection', 'sourceProperty'],
      }),
    ]);

    return { outgoing, incoming };
  }

  /**
   * Get collection categories for grouping
   */
  async getCategories(tenantId: string) {
    const repo = await this.collectionRepo(tenantId);
    const result = await repo
      .createQueryBuilder('c')
      .select('DISTINCT c.category', 'category')
      .where('c.category IS NOT NULL')
      .andWhere('c.deleted_at IS NULL')
      .orderBy('c.category', 'ASC')
      .getRawMany();

    return result.map((r) => r.category);
  }

  /**
   * Publish a collection (mark as ready for use)
   */
  async publishCollection(tenantId: string, collectionId: string, publishedBy?: string) {
    const repo = await this.collectionRepo(tenantId);
    const collection = await this.getCollection(tenantId, collectionId);

    collection.publishedAt = new Date();
    collection.updatedBy = publishedBy;

    return repo.save(collection);
  }

  /**
   * Clone a collection (create a copy with new code)
   */
  async cloneCollection(
    tenantId: string,
    sourceCollectionId: string,
    newCode: string,
    newLabel: string,
    createdBy?: string
  ) {
    const source = await this.getCollectionWithProperties(tenantId, sourceCollectionId);

    // Create new collection
    const newCollection = await this.createCollection(
      tenantId,
      {
        code: newCode,
        label: newLabel,
        labelPlural: source.labelPlural ? `${newLabel}s` : undefined,
        description: source.description ?? undefined,
        icon: source.icon ?? undefined,
        color: source.color ?? undefined,
        storageTable: `u_${newCode}`,
        isSystem: false,
        isExtensible: source.isExtensible,
        isAudited: source.isAudited,
        isVersioned: source.isVersioned,
        moduleId: source.moduleId ?? undefined,
        category: source.category ?? undefined,
        tags: source.tags,
        metadata: { ...source.metadata, clonedFrom: sourceCollectionId },
      },
      createdBy
    );

    return newCollection;
  }
}
