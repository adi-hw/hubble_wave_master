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
  NotImplementedException,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, QueryRunner, DataSource, IsNull, Not } from 'typeorm';
import {
  CollectionDefinition,
  CollectionDefinitionRevision,
  PropertyDefinition,
  PropertyDefinitionRevision,
  PropertyType,
  AuditLog,
} from '@hubblewave/instance-db';
import { CollectionStorageService } from './collection-storage.service';
import { CollectionAvaService } from './collection-ava.service';
import { PublishImpactService } from '../publish-impact/publish-impact.service';
import { DependentReviewQueueService } from '../publish-impact/dependent-review-queue.service';

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

  /** Whether instance admins can add custom properties (default: true) */
  isExtensible?: boolean;

  /** Whether to track all changes in audit log (default: true) */
  isAudited?: boolean;

  /** Whether to keep full version history (default: false) */
  isVersioned?: boolean;

  /**
   * Application this collection belongs to (ADR-6). When omitted the
   * collection is rolled into the `default` Application created during
   * Slice A backfill.
   */
  applicationId?: string;

  /**
   * Alias for `applicationId` accepted on incoming DTOs only. The
   * service normalizes it to `applicationId` immediately; downstream
   * code reads from `applicationId`.
   */
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
  sortBy?: 'label' | 'code' | 'ownerType' | 'category' | 'tableName' | 'createdAt' | 'updatedAt';

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
    @InjectRepository(CollectionDefinitionRevision)
    private readonly collectionRevisionRepo: Repository<CollectionDefinitionRevision>,
    @InjectRepository(PropertyDefinition)
    private readonly propertyRepo: Repository<PropertyDefinition>,
    @InjectRepository(PropertyType)
    private readonly propertyTypeRepo: Repository<PropertyType>,
    private readonly dataSource: DataSource,
    private readonly storageService: CollectionStorageService,
    private readonly avaService: CollectionAvaService,
    private readonly publishImpactService: PublishImpactService,
    private readonly dependentQueueService: DependentReviewQueueService,
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
      qb.andWhere('c.applicationId = :moduleId', { moduleId: options.moduleId });
    }

    if (options.category) {
      qb.andWhere('c.category = :category', { category: options.category });
    }

    if (!options.includeSystem) {
      qb.andWhere('c.isSystem = false');
    }

    if (options.ownerType) {
      qb.andWhere('c.ownerType = :ownerType', { ownerType: options.ownerType });
    }

    if (options.search) {
      qb.andWhere(
        '(c.name ILIKE :search OR c.code ILIKE :search OR c.description ILIKE :search)',
        { search: `%${options.search}%` }
      );
    }
    if (options.status) {
      qb.andWhere('c.status = :status', { status: options.status });
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
      .select('p.collectionId', 'collectionId')
      .addSelect('COUNT(*)', 'count')
      .groupBy('p.collectionId')
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
      relations: ['propertyType'],
      order: { position: 'ASC' },
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
    const types = await this.propertyTypeRepo.find({
      order: { category: 'ASC', name: 'ASC' },
    });

    return types.map((type) => ({
      id: type.id,
      code: type.code,
      name: type.name,
      category: type.category,
      description: type.description,
      baseType: type.baseType,
      defaultConfig: type.defaultConfig,
      validationRules: type.validationRules,
      defaultWidget: type.defaultWidget,
      icon: type.icon,
      isSystem: type.isSystem,
      createdAt: type.createdAt,
    }));
  }

  /**
   * Get relationships for a collection
   */
  async getCollectionRelationships(_collectionId: string) {
    const collection = await this.collectionRepo.findOne({
      where: { id: _collectionId },
    });

    if (!collection) {
      throw new NotFoundException(`Collection ${_collectionId} not found`);
    }

    const outgoingProps = await this.propertyRepo.find({
      where: {
        collectionId: _collectionId,
        referenceCollectionId: Not(IsNull()),
      },
      relations: ['referenceCollection', 'propertyType'],
    });

    const incomingProps = await this.propertyRepo.find({
      where: {
        referenceCollectionId: _collectionId,
      },
      relations: ['collection', 'propertyType'],
    });

    const outgoing = outgoingProps
      .filter((prop) => !!prop.referenceCollectionId)
      .map((prop) => {
        const targetCollection = prop.referenceCollection;
        const targetId = prop.referenceCollectionId as string;

        return {
          id: `rel_${prop.id}`,
          name: `${collection.code}_${prop.code}_to_${targetCollection?.code ?? targetId}`,
          sourceCollection: _collectionId,
          sourceProperty: prop.code,
          targetCollection: targetId,
          targetProperty: prop.referenceDisplayProperty || 'id',
          type: this.getRelationshipType(prop.propertyType?.code, prop.isUnique),
          required: prop.isRequired,
          cascadeDelete: false,
        };
      });

    const incoming = incomingProps.map((prop) => {
      const sourceCollection = prop.collection;
      const sourceId = prop.collectionId;

      return {
        id: `rel_${prop.id}`,
        name: `${sourceCollection?.code ?? sourceId}_${prop.code}_to_${collection.code}`,
        sourceCollection: sourceId,
        sourceProperty: prop.code,
        targetCollection: _collectionId,
        targetProperty: prop.referenceDisplayProperty || 'id',
        type: this.getRelationshipType(prop.propertyType?.code, prop.isUnique),
        required: prop.isRequired,
        cascadeDelete: false,
      };
    });

    return { outgoing, incoming };
  }

  private getRelationshipType(
    propertyType?: string,
    isUnique?: boolean,
  ): 'one_to_one' | 'one_to_many' | 'many_to_many' {
    const normalized = (propertyType || '').toLowerCase();
    if (normalized.includes('multi') || normalized === 'multi-reference') {
      return 'many_to_many';
    }
    if (isUnique) {
      return 'one_to_one';
    }
    return 'one_to_many';
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
        await queryRunner.query(
          'SELECT pg_advisory_xact_lock(hashtext($1))',
          [`collection-schema:${dto.code}`],
        );

        // Failure here aborts the outer transaction so no CollectionDefinition
        // row is committed without its backing physical table.
        await this.storageService.createStorageTable(queryRunner, storageSchema, storageTable);
        storageCreated = true;
      }

      // 3. Create collection record. application_id is NOT NULL post Slice A
      //    (migration 1833) — fall back to the `default` Application if
      //    the caller didn't supply one.
      const applicationId = await this.resolveApplicationId(
        queryRunner,
        dto.applicationId ?? dto.moduleId,
      );
      const collection = queryRunner.manager.create(CollectionDefinition, {
        code: dto.code,
        name: dto.label,
        pluralName: dto.labelPlural || `${dto.label}s`,
        description: dto.description,
        icon: dto.icon || 'Layers',
        color: dto.color || '#7c3aed',
        category: dto.category,
        applicationId,
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
        // Canon §28.2 default-deny posture (W2 Stream 2 PR4). The DB
        // column carries the same default; setting it explicitly here
        // makes the runtime entity value match the DB even on code paths
        // that read the entity before re-fetching the saved row.
        secureFieldsByDefault: true,
        createdBy: userId,
        updatedBy: userId,
        metadata: this.mergeMetadata(dto.metadata),
        status: 'draft',
      });

      const savedCollection = await queryRunner.manager.save(CollectionDefinition, collection);

      // 3b. Seed revision 1 (draft) so currentRevisionId is non-null from
      //     the start. Mirrors ApplicationService.create.
      const revision = queryRunner.manager.create(CollectionDefinitionRevision, {
        collectionId: savedCollection.id,
        revision: 1,
        status: 'draft',
        payload: this.snapshotCollection(savedCollection),
        createdBy: userId ?? null,
      });
      const savedRevision = await queryRunner.manager.save(
        CollectionDefinitionRevision,
        revision,
      );
      savedCollection.currentRevisionId = savedRevision.id;

      // 4. Create default system properties
      const propertiesCreated = await this.createDefaultProperties(
        queryRunner,
        savedCollection.id,
        savedCollection.applicationId ?? null,
        userId,
      );

      // Update property count + persist currentRevisionId.
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

      // Apply updates. Per ADR-5 every edit becomes a new draft revision;
      // the parent flips back to `draft` so consumers know the published
      // revision is no longer the freshest authoring state.
      const changedFields: string[] = [];
      for (const [key, value] of Object.entries(dto)) {
        if (value !== undefined && (collection as unknown as Record<string, unknown>)[key] !== value) {
          changedFields.push(key);
          if (key === 'metadata') {
            (collection as unknown as Record<string, unknown>)[key] = this.mergeMetadata(
              value as Record<string, unknown>,
              collection.metadata,
            );
          } else {
            (collection as unknown as Record<string, unknown>)[key] = value;
          }
        }
      }

      if (changedFields.length === 0) {
        await queryRunner.rollbackTransaction();
        return collection;
      }

      collection.updatedBy = userId;
      collection.status = 'draft';

      const savedCollection = await queryRunner.manager.save(CollectionDefinition, collection);

      // Append a new draft revision capturing the post-edit snapshot.
      const nextRev = await this.nextCollectionRevisionNumber(
        queryRunner,
        savedCollection.id,
      );
      const revision = queryRunner.manager.create(CollectionDefinitionRevision, {
        collectionId: savedCollection.id,
        revision: nextRev,
        status: 'draft',
        payload: this.snapshotCollection(savedCollection),
        createdBy: userId ?? null,
      });
      const savedRevision = await queryRunner.manager.save(
        CollectionDefinitionRevision,
        revision,
      );
      savedCollection.currentRevisionId = savedRevision.id;
      await queryRunner.manager.save(CollectionDefinition, savedCollection);

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
    // ADR-17: capture the impact report before mutating state. After
    // publish flips revisions to 'published', the diff against the
    // newly-published state is empty — so we snapshot the dependents
    // first, then enqueue them post-commit if any non-cosmetic
    // changes shipped.
    const impactReport = await this.publishImpactService
      .previewCollectionPublish(collectionId)
      .catch((err) => {
        this.logger.warn(
          `publish-impact preview failed for ${collectionId}: ${
            err instanceof Error ? err.message : String(err)
          }. Continuing without queue capture.`,
        );
        return null;
      });

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.startTransaction();

    try {
      const collection = await queryRunner.manager.findOne(CollectionDefinition, {
        where: { id: collectionId },
      });

      if (!collection) {
        throw new NotFoundException(`Collection ${collectionId} not found`);
      }

      const previousState = this.toAuditState(collection);
      const now = new Date();

      // Flip the current revision to published (idempotent if already so).
      if (collection.currentRevisionId) {
        const revision = await queryRunner.manager.findOne(
          CollectionDefinitionRevision,
          { where: { id: collection.currentRevisionId } },
        );
        if (revision && revision.status !== 'published') {
          revision.status = 'published';
          revision.publishedBy = _userId ?? null;
          revision.publishedAt = now;
          await queryRunner.manager.save(CollectionDefinitionRevision, revision);
        }
      }

      collection.metadata = this.mergeMetadata(
        collection.metadata,
        collection.metadata,
      );
      collection.status = 'published';
      collection.publishedAt = now;
      collection.updatedBy = _userId;
      const saved = await queryRunner.manager.save(CollectionDefinition, collection);

      // Cascade publish to current property revisions so the read-side
      // sees a coherent snapshot.
      const properties = await queryRunner.manager.find(PropertyDefinition, {
        where: { collectionId: collection.id },
      });
      for (const property of properties) {
        property.metadata = this.mergeMetadata(
          property.metadata,
          property.metadata,
        );
        property.status = 'published';
        property.publishedAt = now;
        if (property.currentRevisionId) {
          const propRev = await queryRunner.manager.findOne(
            PropertyDefinitionRevision,
            { where: { id: property.currentRevisionId } },
          );
          if (propRev && propRev.status !== 'published') {
            propRev.status = 'published';
            propRev.publishedBy = _userId ?? null;
            propRev.publishedAt = now;
            await queryRunner.manager.save(PropertyDefinitionRevision, propRev);
          }
        }
        await queryRunner.manager.save(PropertyDefinition, property);
      }

      await this.logAudit(queryRunner, {
        collectionId: saved.id,
        userId: _userId || 'system',
        action: 'publish',
        previousState,
        newState: this.toAuditState(saved),
        ipAddress: _context?.ipAddress,
        userAgent: _context?.userAgent,
      });

      await queryRunner.commitTransaction();

      // Post-commit: enqueue dependents flagged by the publish-impact
      // analyzers. Done outside the transaction so a queue write
      // failure cannot roll back a successful publish — the queue is
      // a follow-up surface, not part of the publish atomic unit.
      if (impactReport && impactReport.classification !== 'no_changes') {
        try {
          await this.dependentQueueService.enqueueFromImpactReport(impactReport, _userId);
        } catch (err) {
          this.logger.warn(
            `Failed to enqueue dependents for ${collectionId}: ${
              err instanceof Error ? err.message : String(err)
            }`,
          );
        }
      }

      return saved;
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
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
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.startTransaction();

    try {
      const collection = await queryRunner.manager.findOne(CollectionDefinition, {
        where: { id: collectionId },
      });

      if (!collection) {
        throw new NotFoundException(`Collection ${collectionId} not found`);
      }

      const previousState = this.toAuditState(collection);
      collection.metadata = this.mergeMetadata(collection.metadata, collection.metadata);
      collection.status = 'deprecated';
      collection.updatedBy = _userId;
      const saved = await queryRunner.manager.save(CollectionDefinition, collection);

      await this.logAudit(queryRunner, {
        collectionId: saved.id,
        userId: _userId || 'system',
        action: 'deprecate',
        previousState,
        newState: this.toAuditState(saved),
        ipAddress: _context?.ipAddress,
        userAgent: _context?.userAgent,
      });

      await queryRunner.commitTransaction();
      return saved;
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
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
    _collectionId: string,
    _newCode: string,
    _newLabel: string,
    _userId?: string
  ): Promise<CollectionDefinition> {
    throw new NotImplementedException('Collection cloning is not available');
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
      ownerType: 'c.ownerType',
      category: 'c.category',
      tableName: 'c.tableName',
      createdAt: 'c.createdAt',
      updatedAt: 'c.updatedAt',
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
   * Merge user-supplied metadata onto the existing JSONB blob. The
   * `status` lifecycle column is the typed source of truth and never
   * appears in the JSONB payload; this helper strips it defensively
   * in case any input carries it.
   */
  private mergeMetadata(
    incoming: Record<string, unknown> | undefined,
    existing: Record<string, unknown> = {},
  ): Record<string, unknown> {
    const merged: Record<string, unknown> = { ...existing, ...incoming };
    delete (merged as { status?: unknown }).status;
    return merged;
  }

  /**
   * Helper: Create default system properties.
   *
   * Resolves PropertyType records by code (seeded by
   * `1787000010002-seed-platform-collections`) so each row gets a
   * proper propertyTypeId. Uses canonical entity field names —
   * `name`, `position`, `isReadonly`, `columnName` — instead of the
   * older alias shape, dropping the previously suppressed cast.
   * If a PropertyType lookup fails, the create throws rather than
   * silently writing a row with a null FK; system properties are
   * load-bearing (forms, runtime queries reference them) and a
   * partial seed is worse than a failed create.
   */
  private async createDefaultProperties(
    queryRunner: QueryRunner,
    collectionId: string,
    applicationId: string | null,
    userId?: string,
  ): Promise<number> {
    const defaults: Array<{
      code: string;
      name: string;
      typeCode: string;
      isReadonly: boolean;
      isRequired: boolean;
      position: number;
      columnName: string;
    }> = [
      {
        code: 'id',
        name: 'ID',
        typeCode: 'uuid',
        isReadonly: true,
        isRequired: true,
        position: 0,
        columnName: 'id',
      },
      {
        code: 'created_at',
        name: 'Created At',
        typeCode: 'datetime',
        isReadonly: true,
        isRequired: true,
        position: 900,
        columnName: 'created_at',
      },
      {
        code: 'updated_at',
        name: 'Updated At',
        typeCode: 'datetime',
        isReadonly: true,
        isRequired: true,
        position: 901,
        columnName: 'updated_at',
      },
      {
        code: 'created_by',
        name: 'Created By',
        typeCode: 'user',
        isReadonly: true,
        isRequired: false,
        position: 902,
        columnName: 'created_by',
      },
      {
        code: 'updated_by',
        name: 'Updated By',
        typeCode: 'user',
        isReadonly: true,
        isRequired: false,
        position: 903,
        columnName: 'updated_by',
      },
    ];

    const typeCodes = Array.from(new Set(defaults.map((d) => d.typeCode)));
    const types = await queryRunner.manager.find(PropertyType, {
      where: typeCodes.map((c) => ({ code: c })),
    });
    const typeIdByCode = new Map<string, string>(types.map((t) => [t.code, t.id]));
    const missing = typeCodes.filter((c) => !typeIdByCode.has(c));
    if (missing.length > 0) {
      throw new Error(
        `Cannot seed default properties — PropertyType codes not found: ${missing.join(
          ', ',
        )}. Run migration 1787000010002-seed-platform-collections first.`,
      );
    }

    let count = 0;
    for (const p of defaults) {
      const prop = queryRunner.manager.create(PropertyDefinition, {
        collectionId,
        applicationId,
        code: p.code,
        name: p.name,
        propertyTypeId: typeIdByCode.get(p.typeCode),
        columnName: p.columnName,
        isSystem: true,
        isReadonly: p.isReadonly,
        isRequired: p.isRequired,
        position: p.position,
        ownerType: 'system',
        isActive: true,
        createdBy: userId,
        metadata: this.mergeMetadata({}),
        status: 'draft',
      });

      const savedProp = await queryRunner.manager.save(PropertyDefinition, prop);

      // Seed revision 1 (draft) for each default property so the
      // currentRevisionId pointer is non-null from the start.
      const propRev = queryRunner.manager.create(PropertyDefinitionRevision, {
        propertyId: savedProp.id,
        revision: 1,
        status: 'draft',
        payload: this.snapshotProperty(savedProp),
        createdBy: userId ?? null,
      });
      const savedPropRev = await queryRunner.manager.save(
        PropertyDefinitionRevision,
        propRev,
      );
      savedProp.currentRevisionId = savedPropRev.id;
      await queryRunner.manager.save(PropertyDefinition, savedProp);

      count++;
    }

    return count;
  }

  // --------------------------------------------------------------------------
  // Lifecycle helpers (ADR-5)
  // --------------------------------------------------------------------------

  /**
   * Resolve the Application a new collection should belong to. When the
   * caller supplies an explicit id we trust it; otherwise we fall back
   * to the `default` Application created during Slice A backfill.
   */
  private async resolveApplicationId(
    queryRunner: QueryRunner,
    requested?: string | null,
  ): Promise<string> {
    if (requested) {
      const exists: Array<{ id: string }> = await queryRunner.query(
        `SELECT id FROM applications WHERE id = $1 LIMIT 1`,
        [requested],
      );
      if (exists.length > 0) {
        return exists[0].id;
      }
      throw new NotFoundException(`Application ${requested} not found`);
    }
    const fallback: Array<{ id: string }> = await queryRunner.query(
      `SELECT id FROM applications WHERE code = 'default' LIMIT 1`,
    );
    if (fallback.length === 0) {
      throw new NotFoundException(
        'Default Application missing — applications-registry migration must run first.',
      );
    }
    return fallback[0].id;
  }

  /** Authoring snapshot persisted on every CollectionDefinitionRevision row. */
  private snapshotCollection(c: CollectionDefinition): Record<string, unknown> {
    return {
      code: c.code,
      name: c.name,
      pluralName: c.pluralName,
      description: c.description,
      category: c.category,
      applicationId: c.applicationId,
      tableName: c.tableName,
      labelProperty: c.labelProperty,
      secondaryLabelProperty: c.secondaryLabelProperty,
      isExtensible: c.isExtensible,
      isAudited: c.isAudited,
      enableVersioning: c.enableVersioning,
      enableAttachments: c.enableAttachments,
      enableActivityLog: c.enableActivityLog,
      enableSearch: c.enableSearch,
      icon: c.icon,
      color: c.color,
      defaultAccess: c.defaultAccess,
      metadata: c.metadata,
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
      metadata: p.metadata,
    };
  }

  private async nextCollectionRevisionNumber(
    queryRunner: QueryRunner,
    collectionId: string,
  ): Promise<number> {
    const result: Array<{ max: number | string | null }> = await queryRunner.manager
      .createQueryBuilder(CollectionDefinitionRevision, 'rev')
      .select('MAX(rev.revision)', 'max')
      .where('rev.collection_id = :collectionId', { collectionId })
      .getRawMany();
    const current = Number(result[0]?.max ?? 0);
    return Number.isFinite(current) ? current + 1 : 1;
  }

  /** List revisions for a collection, newest first. */
  listCollectionRevisions(collectionId: string): Promise<CollectionDefinitionRevision[]> {
    return this.collectionRevisionRepo.find({
      where: { collectionId },
      order: { revision: 'DESC' },
    });
  }

  /**
   * Helper: Log audit event
   */
  private async logAudit(
    queryRunner: QueryRunner,
    data: {
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
    const log = queryRunner.manager.create(AuditLog, {
      userId: data.userId,
      collectionCode: 'collection_definitions',
      recordId: data.collectionId,
      action: data.action,
      oldValues: data.previousState || null,
      newValues: data.newState || null,
      ipAddress: data.ipAddress,
      userAgent: data.userAgent,
    });
    await queryRunner.manager.save(AuditLog, log);
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
    // Route question to AVA orchestration service
    return {
      answer: `I can help you with your question: "${question}".`,
      relatedCollections: [],
    };
  }

  /**
   * Get audit log for a collection
   */
  async getAuditLog(
    collectionId: string,
    options: { page?: number; limit?: number } = {}
  ) {
    const page = options.page || 1;
    const limit = options.limit || 20;
    const skip = (page - 1) * limit;

    const auditRepo = this.dataSource.getRepository(AuditLog);

    const [data, total] = await auditRepo.findAndCount({
      where: {
        collectionCode: 'collection_definitions',
        recordId: collectionId,
      },
      order: { createdAt: 'DESC' },
      skip,
      take: limit,
    });

    return {
      data,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }
}

