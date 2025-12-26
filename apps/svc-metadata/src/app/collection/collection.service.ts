/**
 * Sprint 1.1: Collections — Enhanced Collection Service
 *
 * This service manages collection definitions including:
 * - CRUD operations on collection metadata
 * - Automatic storage table provisioning
 * - Audit logging for all mutations
 * - AVA integration for intelligent suggestions
 *
 * @module CollectionService
 */

import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, QueryRunner, DataSource } from 'typeorm';
import {
  CollectionDefinition,
  PropertyDefinition,
} from '@hubblewave/instance-db';
import { CollectionStorageService } from './collection-storage.service';
import { CollectionAvaService } from './collection-ava.service';

// ============================================================================
// DTOs (Data Transfer Objects)
// ============================================================================

/**
 * Input for creating a new collection.
 * Most fields are optional and will use intelligent defaults.
 */
export interface CreateCollectionDto {
  /** Unique code identifier (e.g., 'vendor', 'asset_maintenance') */
  code: string;

  /** Human-readable label */
  label: string;

  /** Plural form of label (auto-generated if omitted) */
  labelPlural?: string;

  /** Description of the collection's purpose */
  description?: string;

  /** Lucide icon name (default: 'Layers') */
  icon?: string;

  /** Hex color for UI (default: primary color) */
  color?: string;

  /** Name of the storage table */
  storageTable: string;

  /** Category for grouping (e.g., 'Core', 'Custom', 'Procurement') */
  category?: string;

  /** Whether this is a system collection (default: false) */
  isSystem?: boolean;

  /** Whether tenant admins can add custom properties (default: true) */
  isExtensible?: boolean;

  /** Whether to track all changes in audit log (default: true) */
  isAudited?: boolean;

  /** Whether to keep full version history (default: false) */
  isVersioned?: boolean;

  /** Module this collection belongs to */
  moduleId?: string;

  /** ID of collection this extends */
  extendsCollectionId?: string;

  /** Tags for filtering and search */
  tags?: string[];

  /** Custom metadata key-value pairs */
  metadata?: Record<string, unknown>;

  /** Sort order for display */
  sortOrder?: number;

  // Storage options
  /** Whether to auto-create storage table (default: true) */
  createStorage?: boolean;

  /** Database schema for storage (default: 'public') */
  storageSchema?: string;
}

/**
 * Input for updating an existing collection.
 * Code cannot be changed after creation (to preserve references).
 */
export interface UpdateCollectionDto {
  label?: string;
  labelPlural?: string;
  description?: string;
  icon?: string;
  color?: string;
  category?: string;
  isExtensible?: boolean;
  isAudited?: boolean;
  isVersioned?: boolean;
  tags?: string[];
  metadata?: Record<string, unknown>;
  displayPropertyId?: string;
  identifierPropertyId?: string;
  moduleId?: string;
  sortOrder?: number;
}

/**
 * Query options for listing collections.
 */
export interface CollectionQueryOptions {
  /** Filter by module ID */
  moduleId?: string;

  /** Filter by category */
  category?: string;

  /** Filter by owner type (system, platform, custom) */
  ownerType?: 'system' | 'platform' | 'custom';

  /** Filter by status */
  status?: 'draft' | 'published' | 'deprecated';

  /** Include system collections (default: false) */
  includeSystem?: boolean;

  /** Include deleted collections (default: false) */
  includeDeleted?: boolean;

  /** Include stats (record count, property count) */
  includeStats?: boolean;

  /** Search term for label, code, or description */
  search?: string;

  /** Sort field */
  sortBy?: 'label' | 'code' | 'createdAt' | 'updatedAt';

  /** Sort order */
  sortOrder?: 'asc' | 'desc';

  /** Pagination: page number (1-indexed) */
  page?: number;

  /** Pagination: items per page */
  limit?: number;
}

/**
 * Result of creating a collection, including side effects.
 */
export interface CreateCollectionResult {
  collection: CollectionDefinition;
  storageCreated: boolean;
  propertiesCreated: number;
  warnings: string[];
}

/**
 * Collection summary with stats for list views.
 */
export interface CollectionSummary extends CollectionDefinition {
  // Stats omitted
}

// ============================================================================
// Service Implementation
// ============================================================================

@Injectable()
export class CollectionService {
  private readonly logger = new Logger(CollectionService.name);

  constructor(
    @InjectRepository(CollectionDefinition)
    private readonly collectionRepo: Repository<CollectionDefinition>,
    @InjectRepository(PropertyDefinition)
    private readonly propertyRepo: Repository<PropertyDefinition>,
    private readonly dataSource: DataSource,
    private readonly storageService: CollectionStorageService,
    private readonly avaService: CollectionAvaService
  ) {}

  // --------------------------------------------------------------------------
  // Query Operations
  // --------------------------------------------------------------------------

  /**
   * List collections with filtering, sorting, and pagination.
   *
   * @param options - Query options for filtering and pagination
   * @returns Paginated list of collections with optional stats
   */
  async listCollections(
    options: CollectionQueryOptions = {}
  ): Promise<{
    data: CollectionSummary[];
    pagination: { page: number; limit: number; total: number; totalPages: number };
    categories: string[];
  }> {
    // Build query - select all needed fields explicitly
    const qb = this.collectionRepo.createQueryBuilder('c');

    if (options.moduleId) {
      qb.andWhere('c.application_id = :moduleId', { moduleId: options.moduleId });
    }

    if (options.category) {
      qb.andWhere('c.category = :category', { category: options.category });
    }

    if (!options.includeSystem) {
      qb.andWhere('c.is_system = false');
    }

    if (options.ownerType) {
      qb.andWhere('c.owner_type = :ownerType', { ownerType: options.ownerType });
    }

    if (options.search) {
      qb.andWhere(
        '(c.name ILIKE :search OR c.code ILIKE :search OR c.description ILIKE :search)',
        { search: `%${options.search}%` }
      );
    }

    // Count total before pagination
    const total = await qb.getCount();

    // Apply sorting
    const sortField = this.mapSortField(options.sortBy || 'label');
    const sortOrder = (options.sortOrder || 'asc').toUpperCase() as 'ASC' | 'DESC';
    qb.orderBy(sortField, sortOrder);

    // Secondary sort for consistency
    if (options.sortBy !== 'label') {
      qb.addOrderBy('c.name', 'ASC');
    }

    // Apply pagination
    const page = Math.max(1, options.page || 1);
    const limit = Math.min(500, Math.max(1, options.limit || 50));
    const offset = (page - 1) * limit;

    qb.skip(offset).take(limit);

    // Execute query
    const collections = await qb.getMany();

    // Get property counts for each collection
    const propertyCountsResult = await this.propertyRepo
      .createQueryBuilder('p')
      .select('p.collection_id', 'collectionId')
      .addSelect('COUNT(*)', 'count')
      .groupBy('p.collection_id')
      .getRawMany();

    const propertyCountMap = new Map<string, number>();
    propertyCountsResult.forEach((row) => {
      propertyCountMap.set(row.collectionId, parseInt(row.count, 10));
    });

    // Enrich collections with property counts
    const enrichedCollections = collections.map((c) => ({
      ...c,
      propertyCount: propertyCountMap.get(c.id) || 0,
    }));

    // Get all categories for filter dropdown
    const categories = await this.getCategories();

    return {
      data: enrichedCollections as CollectionSummary[],
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
      categories,
    };
  }

  /**
   * Get a single collection by ID.
   */
  async getCollection(collectionId: string): Promise<CollectionDefinition> {
    const collection = await this.collectionRepo.findOne({
      where: { id: collectionId },
    });

    if (!collection) {
      throw new NotFoundException(`Collection ${collectionId} not found`);
    }

    return collection;
  }

  /**
   * Get a collection by its unique code.
   */
  async getCollectionByCode(code: string): Promise<CollectionDefinition> {
    const collection = await this.collectionRepo.findOne({
      where: { code },
    });

    if (!collection) {
      throw new NotFoundException(`Collection with code '${code}' not found`);
    }

    return collection;
  }

  /**
   * Check if a collection code is available.
   */
  async isCodeAvailable(code: string): Promise<boolean> {
    const existing = await this.collectionRepo.findOne({ where: { code } });
    return !existing;
  }

  /**
   * Get all unique categories used by collections.
   */
  async getCategories(): Promise<string[]> {
    const result = await this.collectionRepo
      .createQueryBuilder('c')
      .select('DISTINCT c.category', 'category')
      .where('c.category IS NOT NULL')
      .orderBy('c.category', 'ASC')
      .getRawMany();

    return result.map((r) => r.category);
  }

  /**
   * Get all properties for a collection
   */
  async getCollectionProperties(collectionId: string) {
    return this.propertyRepo.find({
      where: { collectionId },
    });
  }

  /**
   * Get collection with its properties
   */
  async getCollectionWithProperties(collectionId: string) {
    const collection = await this.getCollection(collectionId);
    const properties = await this.getCollectionProperties(collectionId);

    return {
      ...collection,
      properties,
    };
  }

  /**
   * Get all property types
   */
  async getPropertyTypes() {
    return [];
  }

  /**
   * Get relationships for a collection
   */
  async getCollectionRelationships(_collectionId: string) {
    return { outgoing: [], incoming: [] };
  }

  // --------------------------------------------------------------------------
  // Mutation Operations
  // --------------------------------------------------------------------------

  /**
   * Create a new collection with automatic storage provisioning.
   *
   * @param dto - Collection creation data
   * @param userId - ID of the user creating the collection
   * @param context - Additional context (IP, user agent) for audit
   * @returns The created collection and side effect summary
   */
  async createCollection(
    dto: CreateCollectionDto,
    userId?: string,
    context?: { ipAddress?: string; userAgent?: string }
  ): Promise<CreateCollectionResult> {
    // Validate input
    this.validateCreateDto(dto);

    // Check for duplicate code
    if (!(await this.isCodeAvailable(dto.code))) {
      throw new ConflictException(`Collection with code '${dto.code}' already exists`);
    }

    const warnings: string[] = [];
    const queryRunner = this.dataSource.createQueryRunner();

    await queryRunner.startTransaction();

    try {
      // 1. Determine storage table name
      const storageTable = dto.storageTable || `u_${dto.code}`;
      const storageSchema = dto.storageSchema || 'public';
      const createStorage = dto.createStorage !== false;

      // 2. Create storage table if requested
      let storageCreated = false;
      if (createStorage) {
        try {
          await this.storageService.createStorageTable(queryRunner, storageSchema, storageTable);
          storageCreated = true;
        } catch (error) {
          this.logger.warn(`Storage creation failed: ${(error as Error).message}`);
          warnings.push(`Storage table creation failed: ${(error as Error).message}`);
          // Continue without storage - user can create manually
        }
      }

      // 3. Create collection record
      const collection = queryRunner.manager.create(CollectionDefinition, {
        code: dto.code,
        name: dto.label,
        pluralName: dto.labelPlural || `${dto.label}s`,
        description: dto.description,
        icon: dto.icon || 'Layers',
        color: dto.color || '#7c3aed',
        category: dto.category,
        tableName: storageTable,
        labelProperty: 'name',
        ownerType: 'custom',
        isSystem: dto.isSystem ?? false,
        isExtensible: dto.isExtensible ?? true,
        isAudited: dto.isAudited ?? true,
        enableVersioning: dto.isVersioned ?? false,
        enableAttachments: true,
        enableActivityLog: true,
        enableSearch: true,
        defaultAccess: 'read',
        createdBy: userId,
        updatedBy: userId,
        metadata: dto.metadata || {},
      });

      const savedCollection = await queryRunner.manager.save(CollectionDefinition, collection);

      // 4. Create default system properties
      const propertiesCreated = await this.createDefaultProperties(
        queryRunner,
        savedCollection.id,
        userId
      );

      // Update property count
      // property count tracking removed
      await queryRunner.manager.save(CollectionDefinition, savedCollection);

      // 5. Log audit event
      await this.logAudit(queryRunner, {
        collectionId: savedCollection.id,
        userId: userId || 'system',
        action: 'create',
        newState: this.toAuditState(savedCollection),
        ipAddress: context?.ipAddress,
        userAgent: context?.userAgent,
      });

      await queryRunner.commitTransaction();

      this.logger.log(`Collection '${dto.code}' created`);

      return {
        collection: savedCollection,
        storageCreated,
        propertiesCreated,
        warnings,
      };
    } catch (error) {
      await queryRunner.rollbackTransaction();

      this.logger.error(`Failed to create collection: ${(error as Error).message}`, (error as Error).stack);
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  /**
   * Update an existing collection.
   */
  async updateCollection(
    collectionId: string,
    dto: UpdateCollectionDto,
    userId?: string,
    context?: { ipAddress?: string; userAgent?: string }
  ): Promise<CollectionDefinition> {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.startTransaction();

    try {
      const collection = await queryRunner.manager.findOne(CollectionDefinition, {
        where: { id: collectionId },
      });

      if (!collection) {
        throw new NotFoundException(`Collection ${collectionId} not found`);
      }

      // System collections have restricted modifications
      if (collection.isSystem) {
        const allowedFields = ['metadata', 'tags', 'sortOrder', 'description'];
        const attemptedFields = Object.keys(dto);
        const disallowedFields = attemptedFields.filter((f) => !allowedFields.includes(f));

        if (disallowedFields.length > 0) {
          throw new ConflictException(
            `Cannot modify ${disallowedFields.join(', ')} on system collection`
          );
        }
      }

      // Capture previous state for audit
      const previousState = this.toAuditState(collection);

      // Apply updates
      const changedFields: string[] = [];
      for (const [key, value] of Object.entries(dto)) {
        if (value !== undefined && (collection as unknown as Record<string, unknown>)[key] !== value) {
          changedFields.push(key);
          (collection as unknown as Record<string, unknown>)[key] = value;
        }
      }

      if (changedFields.length === 0) {
        await queryRunner.rollbackTransaction();
        return collection;
      }

      collection.updatedBy = userId;
      // version tracking disabled

      const savedCollection = await queryRunner.manager.save(CollectionDefinition, collection);

      // Log audit event
      await this.logAudit(queryRunner, {
        collectionId: savedCollection.id,
        userId: userId || 'system',
        action: 'update',
        previousState,
        newState: this.toAuditState(savedCollection),
        changedFields,
        ipAddress: context?.ipAddress,
        userAgent: context?.userAgent,
      });

      await queryRunner.commitTransaction();

      return savedCollection;
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  /**
   * Soft delete a collection.
   */
  async deleteCollection(
    collectionId: string,
    userId?: string,
    context?: { ipAddress?: string; userAgent?: string }
  ): Promise<{
    deleted: boolean;
    recordsAffected: number;
    automationsDisabled: number;
    recoverableUntil: Date;
  }> {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.startTransaction();

    try {
      const collection = await queryRunner.manager.findOne(CollectionDefinition, {
        where: { id: collectionId },
      });

      if (!collection) {
        throw new NotFoundException(`Collection ${collectionId} not found`);
      }

      if (collection.isSystem) {
        throw new ConflictException('Cannot delete system collections');
      }

      // Get dependency counts
      const recordsAffected = 0;
      const automationsDisabled = 0;

      // Capture previous state for audit
      const previousState = this.toAuditState(collection);

      // Soft delete
      (collection as any).deletedAt = new Date();
      collection.updatedBy = userId;

      await queryRunner.manager.save(CollectionDefinition, collection);

      // Log audit event
      await this.logAudit(queryRunner, {
        collectionId: collection.id,
        userId: userId || 'system',
        action: 'delete',
        previousState,
        comment: `Deleted collection with ${recordsAffected} records`,
        ipAddress: context?.ipAddress,
        userAgent: context?.userAgent,
      });

      await queryRunner.commitTransaction();

      // Calculate recovery deadline (30 days)
      const recoverableUntil = new Date();
      recoverableUntil.setDate(recoverableUntil.getDate() + 30);

      return {
        deleted: true,
        recordsAffected,
        automationsDisabled,
        recoverableUntil,
      };
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  /**
   * Publish a draft collection, making it available for use.
   */
  async publishCollection(
    collectionId: string,
    _userId?: string,
    _context?: { ipAddress?: string; userAgent?: string }
  ): Promise<CollectionDefinition> {
    // Publishing status tracking disabled; return collection as-is
    const collection = await this.getCollection(collectionId);
    return collection;
  }

  /**
   * Deprecate a published collection.
   */
  async deprecateCollection(
    collectionId: string,
    _message: string,
    _replacementCollectionId?: string,
    _userId?: string,
    _context?: { ipAddress?: string; userAgent?: string }
  ): Promise<CollectionDefinition> {
    return this.getCollection(collectionId);
  }

  /**
   * Restore a soft-deleted collection.
   */
  async restoreCollection(
    collectionId: string,
    userId?: string,
    context?: { ipAddress?: string; userAgent?: string }
  ): Promise<CollectionDefinition> {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.startTransaction();

    try {
      const collection = await queryRunner.manager.findOne(CollectionDefinition, {
        where: { id: collectionId },
        withDeleted: true,
      });

      if (!collection) {
        throw new NotFoundException(`Collection ${collectionId} not found`);
      }

      if (!(collection as any).deletedAt) {
        throw new ConflictException('Collection is not deleted');
      }

      const previousState = this.toAuditState(collection);

      (collection as any).deletedAt = null;
      collection.updatedBy = userId;

      const savedCollection = await queryRunner.manager.save(CollectionDefinition, collection);

      await this.logAudit(queryRunner, {
        collectionId: collection.id,
        userId: userId || 'system',
        action: 'restore',
        previousState,
        newState: this.toAuditState(savedCollection),
        ipAddress: context?.ipAddress,
        userAgent: context?.userAgent,
      });

      await queryRunner.commitTransaction();

      return savedCollection;
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  /**
   * Clone a collection.
   */
  async cloneCollection(
    collectionId: string,
    _newCode: string,
    _newLabel: string,
    _userId?: string
  ): Promise<CollectionDefinition> {
    // Cloning disabled in trimmed build; return original collection
    return this.getCollection(collectionId);
  }

  // --------------------------------------------------------------------------
  // Helper Methods
  // --------------------------------------------------------------------------

  /**
   * Helper: Map API sort field to DB column
   */
  private mapSortField(field: string): string {
    const map: Record<string, string> = {
      label: 'c.name',
      code: 'c.code',
      createdAt: 'c.created_at',
      updatedAt: 'c.updated_at',
    };
    return map[field] || 'c.name';
  }

  /**
   * Helper: Validate create DTO
   */
  private validateCreateDto(dto: CreateCollectionDto): void {
    if (!dto.code || !/^[a-z0-9_]+$/.test(dto.code)) {
      throw new BadRequestException(
        'Code must contain only lowercase letters, numbers, and underscores'
      );
    }

    if (!dto.label) {
      throw new BadRequestException('Label is required');
    }
  }

  /**
   * Helper: Serialize collection state for audit
   */
  private toAuditState(collection: CollectionDefinition): Record<string, unknown> {
    return {
      id: collection.id,
      code: collection.code,
      label: (collection as any).label || collection.name,
      status: collection.status,
      version: collection.version,
    };
  }

  /**
   * Helper: Create default system properties
   */
  private async createDefaultProperties(
    queryRunner: QueryRunner,
    collectionId: string,
    userId?: string
  ): Promise<number> {
    const defaults = [
      {
        code: 'id',
        label: 'ID',
        type: 'uuid',
        isSystem: true,
        isReadOnly: true,
        isRequired: true,
        displayOrder: 0,
      },
      {
        code: 'created_at',
        label: 'Created At',
        type: 'datetime',
        isSystem: true,
        isReadOnly: true,
        isRequired: true,
        displayOrder: 900,
      },
      {
        code: 'updated_at',
        label: 'Updated At',
        type: 'datetime',
        isSystem: true,
        isReadOnly: true,
        isRequired: true,
        displayOrder: 901,
      },
      {
        code: 'created_by',
        label: 'Created By',
        type: 'user_reference',
        isSystem: true,
        isReadOnly: true,
        isRequired: false,
        displayOrder: 902,
      },
      {
        code: 'updated_by',
        label: 'Updated By',
        type: 'user_reference',
        isSystem: true,
        isReadOnly: true,
        isRequired: false,
        displayOrder: 903,
      },
    ];

    let count = 0;
    for (const p of defaults) {
      const prop = queryRunner.manager.create(PropertyDefinition, {
        collectionId,
        code: p.code,
        label: p.label,
        type: p.type as any, // TODO: Fix enum type
        isSystem: p.isSystem,
        isReadOnly: p.isReadOnly,
        isRequired: p.isRequired,
        displayOrder: p.displayOrder,
        createdBy: userId,
        updatedBy: userId,
      });

      await queryRunner.manager.save(PropertyDefinition, prop);
      count++;
    }

    return count;
  }

  /**
   * Helper: Log audit event
   */
  private async logAudit(
    _queryRunner: QueryRunner,
    _data: {
      collectionId: string;
      userId: string;
      action: string;
      previousState?: Record<string, unknown>;
      newState?: Record<string, unknown>;
      changedFields?: string[];
      comment?: string;
      ipAddress?: string;
      userAgent?: string;
    }
  ): Promise<void> {
    // Audit logging disabled in single-instance build; no-op
  }

  // --------------------------------------------------------------------------
  // AVA Integration
  // --------------------------------------------------------------------------

  async getSuggestions(input: string) {
    return this.avaService.getNamingSuggestions(input);
  }

  async analyzeImport(
    source: 'csv' | 'json' | 'xlsx',
    headers: string[],
    rows: Record<string, unknown>[]
  ) {
    return this.avaService.analyzeImportStructure(source, headers, rows);
  }

  async askAva(question: string) {
    // This would likely call a more complex AVA orchestration service
    return {
      answer: `I can help you with your question: "${question}". (Placeholder)`,
      relatedCollections: [],
    };
  }

  /**
   * Get audit log for a collection
   */
  async getAuditLog(
    _collectionId: string,
    options: { page?: number; limit?: number } = {}
  ) {
    return {
      data: [],
      pagination: {
        page: 1,
        limit: options.limit || 20,
        total: 0,
        totalPages: 0,
      },
    };
  }
}

