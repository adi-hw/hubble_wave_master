import {
  Injectable,
  BadRequestException,
  NotFoundException,
  Logger,
} from '@nestjs/common';
import { InjectRepository, InjectDataSource } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import {
  CollectionDefinition,
  PropertyDefinition,
  OwnerType,
} from '@hubblewave/instance-db';
import { SchemaGovernanceService, ActorType } from './schema-governance.service';
import { DdlExecutorService } from './ddl-executor.service';
import { SchemaSyncService } from './schema-sync.service';

/**
 * DTO for creating a new collection.
 */
export interface CreateCollectionDto {
  code: string;
  name: string;
  pluralName?: string;
  description?: string;
  icon?: string;
  color?: string;
  isExtensible?: boolean;
  enableAttachments?: boolean;
  enableActivityLog?: boolean;
  isAudited?: boolean;
  properties?: CreatePropertyDto[];
}

/**
 * DTO for updating an existing collection.
 */
export interface UpdateCollectionDto {
  name?: string;
  pluralName?: string;
  description?: string;
  icon?: string;
  color?: string;
  isExtensible?: boolean;
  enableAttachments?: boolean;
  enableActivityLog?: boolean;
  isAudited?: boolean;
}

/**
 * DTO for creating a new property within a collection.
 */
export interface CreatePropertyDto {
  code: string;
  name: string;
  propertyTypeId: string;
  description?: string;
  placeholder?: string;
  helpText?: string;
  isRequired?: boolean;
  isUnique?: boolean;
  isIndexed?: boolean;
  defaultValue?: string;
  validationRules?: Record<string, unknown>;
  referenceCollectionCode?: string;
  referenceDisplayProperty?: string;
  referenceFilter?: Record<string, unknown>;
  choiceListId?: string;
  position?: number;
  isVisible?: boolean;
  isReadonly?: boolean;
}

/**
 * DTO for updating an existing property.
 */
export interface UpdatePropertyDto {
  name?: string;
  description?: string;
  placeholder?: string;
  helpText?: string;
  isRequired?: boolean;
  defaultValue?: string;
  validationRules?: Record<string, unknown>;
  referenceDisplayProperty?: string;
  referenceFilter?: Record<string, unknown>;
  position?: number;
  isVisible?: boolean;
  isReadonly?: boolean;
}

/**
 * Context for tracking who is performing an operation.
 */
export interface OperationContext {
  userId: string;
  actorType?: ActorType;
}

/**
 * Options for listing collections.
 */
export interface ListCollectionsOptions {
  includeSystem?: boolean;
  includeInactive?: boolean;
  ownerType?: OwnerType;
  category?: string;
  includeProperties?: boolean;
}

/**
 * CollectionService
 *
 * Main orchestrator for all collection and property operations.
 */
@Injectable()
export class CollectionService {
  private readonly logger = new Logger(CollectionService.name);

  constructor(
    @InjectRepository(CollectionDefinition)
    private readonly collectionRepo: Repository<CollectionDefinition>,

    @InjectRepository(PropertyDefinition)
    private readonly propertyRepo: Repository<PropertyDefinition>,

    @InjectDataSource()
    private readonly dataSource: DataSource,

    private readonly governance: SchemaGovernanceService,
    private readonly ddlExecutor: DdlExecutorService,
    private readonly schemaSync: SchemaSyncService,
  ) {}

  // ═══════════════════════════════════════════════════════════════════════════
  // COLLECTION CRUD
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Creates a new custom collection with optional initial properties.
   */
  async createCollection(
    dto: CreateCollectionDto,
    context: OperationContext,
  ): Promise<CollectionDefinition> {
    const actorType = context.actorType || 'user';

    await this.governance.validateCollectionOperation('create', dto.code, actorType);

    const tableName = `t_${dto.code}`;

    const tableExists = await this.checkTableExists(tableName);
    if (tableExists) {
      throw new BadRequestException(
        `A table with name '${tableName}' already exists. ` +
        `Please choose a different collection code.`
      );
    }

    const existingCollection = await this.collectionRepo.findOne({
      where: { code: dto.code },
    });
    if (existingCollection) {
      throw new BadRequestException(
        `A collection with code '${dto.code}' already exists.`
      );
    }

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const collection = this.collectionRepo.create({
        code: dto.code,
        name: dto.name,
        pluralName: dto.pluralName || dto.name + 's',
        description: dto.description,
        icon: dto.icon || 'file',
        color: dto.color,
        tableName,
        ownerType: 'custom',
        category: 'custom',
        isExtensible: dto.isExtensible ?? true,
        enableAttachments: dto.enableAttachments ?? true,
        enableActivityLog: dto.enableActivityLog ?? true,
        isAudited: dto.isAudited ?? true,
        isSystem: false,
        isActive: true,
        createdBy: context.userId,
      });

      const savedCollection = await queryRunner.manager.save(collection);

      const propertyColumns: Array<{
        name: string;
        dataType: string;
        nullable: boolean;
        unique: boolean;
        references?: { table: string; column: string };
      }> = [];

      if (dto.properties && dto.properties.length > 0) {
        for (let i = 0; i < dto.properties.length; i++) {
          const propDto = dto.properties[i];
          const columnName = propDto.code;

          let referenceCollectionId: string | undefined;
          if (propDto.referenceCollectionCode) {
            const refCollection = await this.collectionRepo.findOne({
              where: { code: propDto.referenceCollectionCode },
            });
            if (refCollection) {
              referenceCollectionId = refCollection.id;
            }
          }

          const property = this.propertyRepo.create({
            collection: savedCollection,
            collectionId: savedCollection.id,
            code: propDto.code,
            name: propDto.name,
            description: propDto.description,
            placeholder: propDto.placeholder,
            helpText: propDto.helpText,
            propertyTypeId: propDto.propertyTypeId,
            columnName,
            isRequired: propDto.isRequired ?? false,
            isUnique: propDto.isUnique ?? false,
            isIndexed: propDto.isIndexed ?? false,
            defaultValue: propDto.defaultValue,
            validationRules: propDto.validationRules || {},
            referenceCollectionId,
            referenceDisplayProperty: propDto.referenceDisplayProperty,
            referenceFilter: propDto.referenceFilter,
            choiceListId: propDto.choiceListId,
            position: propDto.position ?? i,
            isVisible: propDto.isVisible ?? true,
            isReadonly: propDto.isReadonly ?? false,
            ownerType: 'custom',
            isSystem: false,
            isActive: true,
          });

          await queryRunner.manager.save(property);

          // Get the data type from propertyType
          const dataType = await this.getDataTypeFromPropertyType(propDto.propertyTypeId);

          propertyColumns.push({
            name: columnName,
            dataType,
            nullable: !propDto.isRequired,
            unique: propDto.isUnique ?? false,
            references: propDto.referenceCollectionCode
              ? {
                  table: `t_${propDto.referenceCollectionCode}`,
                  column: 'id'
                }
              : undefined,
          });
        }
      }

      const ddlResult = await this.ddlExecutor.createTable(
        {
          tableName,
          columns: propertyColumns,
          addStandardColumns: true,
        },
        {
          entityId: savedCollection.id,
          performedBy: context.userId,
          performedByType: actorType,
        },
      );

      if (!ddlResult.success) {
        throw new Error(`Failed to create table: ${ddlResult.error}`);
      }

      await queryRunner.commitTransaction();

      this.logger.log(
        `Created collection '${dto.code}' with table '${tableName}' ` +
        `and ${propertyColumns.length} properties`
      );

      return this.findByCode(dto.code) as Promise<CollectionDefinition>;
    } catch (error) {
      await queryRunner.rollbackTransaction();
      this.logger.error(`Failed to create collection '${dto.code}': ${(error as Error).message}`);
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  /**
   * Updates an existing collection's metadata.
   */
  async updateCollection(
    code: string,
    dto: UpdateCollectionDto,
    context: OperationContext,
  ): Promise<CollectionDefinition> {
    const actorType = context.actorType || 'user';

    await this.governance.validateCollectionOperation('update', code, actorType, dto as Partial<CollectionDefinition>);

    const collection = await this.collectionRepo.findOne({
      where: { code },
    });

    if (!collection) {
      throw new NotFoundException(`Collection '${code}' not found`);
    }

    Object.assign(collection, dto);

    await this.collectionRepo.save(collection);

    this.logger.log(`Updated collection '${code}'`);

    return this.findByCode(code) as Promise<CollectionDefinition>;
  }

  /**
   * Deletes a custom collection and its physical table.
   */
  async deleteCollection(
    code: string,
    context: OperationContext,
  ): Promise<void> {
    const actorType = context.actorType || 'user';

    await this.governance.validateCollectionOperation('delete', code, actorType);

    const collection = await this.collectionRepo.findOne({
      where: { code },
      relations: ['properties'],
    });

    if (!collection) {
      throw new NotFoundException(`Collection '${code}' not found`);
    }

    if (collection.properties?.length) {
      await this.propertyRepo.delete(
        collection.properties.map(p => p.id)
      );
    }

    await this.ddlExecutor.dropTable(
      collection.tableName,
      {
        entityId: collection.id,
        performedBy: context.userId,
        performedByType: actorType,
      },
    );

    await this.collectionRepo.delete(collection.id);

    this.logger.log(`Deleted collection '${code}' and its physical table`);
  }

  /**
   * Retrieves a collection by its code.
   */
  async findByCode(code: string): Promise<CollectionDefinition | null> {
    return this.collectionRepo.findOne({
      where: { code },
      relations: ['properties'],
      order: {
        properties: {
          position: 'ASC',
        },
      },
    });
  }

  /**
   * Lists all collections with optional filtering.
   */
  async findAll(options: ListCollectionsOptions = {}): Promise<CollectionDefinition[]> {
    const query = this.collectionRepo
      .createQueryBuilder('c')
      .orderBy('c.name', 'ASC');

    if (options.includeProperties) {
      query.leftJoinAndSelect('c.properties', 'p')
           .addOrderBy('p.position', 'ASC');
    }

    if (!options.includeSystem) {
      query.andWhere('c.is_system = false');
    }

    if (!options.includeInactive) {
      query.andWhere('c.is_active = true');
    }

    if (options.ownerType) {
      query.andWhere('c.owner_type = :ownerType', { ownerType: options.ownerType });
    }

    if (options.category) {
      query.andWhere('c.category = :category', { category: options.category });
    }

    return query.getMany();
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // PROPERTY CRUD
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Adds a new property to an existing collection.
   */
  async addProperty(
    collectionCode: string,
    dto: CreatePropertyDto,
    context: OperationContext,
  ): Promise<PropertyDefinition> {
    const actorType = context.actorType || 'user';

    const collection = await this.collectionRepo.findOne({
      where: { code: collectionCode },
    });

    if (!collection) {
      throw new NotFoundException(`Collection '${collectionCode}' not found`);
    }

    await this.governance.validatePropertyOperation(
      'create',
      collectionCode,
      dto.code,
      actorType,
    );

    let columnName = dto.code;
    if (collection.ownerType === 'module' && !dto.code.startsWith('x_')) {
      columnName = `x_${dto.code}`;
    }

    const columnExists = await this.checkColumnExists(
      collection.tableName,
      columnName
    );
    if (columnExists) {
      throw new BadRequestException(
        `Column '${columnName}' already exists in table '${collection.tableName}'.`
      );
    }

    const existingProperty = await this.propertyRepo.findOne({
      where: {
        code: dto.code,
        collection: { code: collectionCode },
      },
    });
    if (existingProperty) {
      throw new BadRequestException(
        `A property with code '${dto.code}' already exists in collection '${collectionCode}'.`
      );
    }

    let referenceCollectionId: string | undefined;
    if (dto.referenceCollectionCode) {
      const refCollection = await this.collectionRepo.findOne({
        where: { code: dto.referenceCollectionCode },
      });
      if (refCollection) {
        referenceCollectionId = refCollection.id;
      }
    }

    const maxPositionResult = await this.propertyRepo
      .createQueryBuilder('p')
      .select('MAX(p.position)', 'maxPosition')
      .where('p.collection_id = :collectionId', { collectionId: collection.id })
      .getRawOne();
    const nextPosition = (maxPositionResult?.maxPosition ?? -1) + 1;

    const property = this.propertyRepo.create({
      collection,
      collectionId: collection.id,
      code: dto.code,
      name: dto.name,
      description: dto.description,
      placeholder: dto.placeholder,
      helpText: dto.helpText,
      propertyTypeId: dto.propertyTypeId,
      columnName,
      isRequired: dto.isRequired ?? false,
      isUnique: dto.isUnique ?? false,
      isIndexed: dto.isIndexed ?? false,
      defaultValue: dto.defaultValue,
      validationRules: dto.validationRules || {},
      referenceCollectionId,
      referenceDisplayProperty: dto.referenceDisplayProperty,
      referenceFilter: dto.referenceFilter,
      choiceListId: dto.choiceListId,
      position: dto.position ?? nextPosition,
      isVisible: dto.isVisible ?? true,
      isReadonly: dto.isReadonly ?? false,
      ownerType: collection.ownerType === 'module' ? 'custom' : collection.ownerType,
      isSystem: false,
      isActive: true,
    });

    const savedProperty = await this.propertyRepo.save(property);

    const dataType = await this.getDataTypeFromPropertyType(dto.propertyTypeId);

    const ddlResult = await this.ddlExecutor.addColumn(
      collection.tableName,
      {
        name: columnName,
        dataType,
        nullable: !dto.isRequired,
        unique: dto.isUnique,
        references: dto.referenceCollectionCode
          ? { table: `t_${dto.referenceCollectionCode}`, column: 'id' }
          : undefined,
      },
      {
        entityId: savedProperty.id,
        performedBy: context.userId,
        performedByType: actorType,
      },
    );

    if (!ddlResult.success) {
      await this.propertyRepo.delete(savedProperty.id);
      throw new Error(`Failed to add column: ${ddlResult.error}`);
    }

    this.logger.log(
      `Added property '${dto.code}' to collection '${collectionCode}' ` +
      `(storage column: '${columnName}')`
    );

    return this.propertyRepo.findOne({
      where: { id: savedProperty.id },
      relations: ['collection'],
    }) as Promise<PropertyDefinition>;
  }

  /**
   * Updates an existing property's metadata.
   */
  async updateProperty(
    collectionCode: string,
    propertyCode: string,
    dto: UpdatePropertyDto,
    context: OperationContext,
  ): Promise<PropertyDefinition> {
    const actorType = context.actorType || 'user';

    await this.governance.validatePropertyOperation(
      'update',
      collectionCode,
      propertyCode,
      actorType,
      dto as Partial<PropertyDefinition>,
    );

    const property = await this.propertyRepo.findOne({
      where: {
        code: propertyCode,
        collection: { code: collectionCode },
      },
      relations: ['collection'],
    });

    if (!property) {
      throw new NotFoundException(
        `Property '${propertyCode}' not found in collection '${collectionCode}'`
      );
    }

    Object.assign(property, dto);

    await this.propertyRepo.save(property);

    this.logger.log(`Updated property '${propertyCode}' in collection '${collectionCode}'`);

    return this.propertyRepo.findOne({
      where: { id: property.id },
      relations: ['collection'],
    }) as Promise<PropertyDefinition>;
  }

  /**
   * Deletes a property from a collection.
   */
  async deleteProperty(
    collectionCode: string,
    propertyCode: string,
    context: OperationContext,
  ): Promise<void> {
    const actorType = context.actorType || 'user';

    await this.governance.validatePropertyOperation(
      'delete',
      collectionCode,
      propertyCode,
      actorType,
    );

    const property = await this.propertyRepo.findOne({
      where: {
        code: propertyCode,
        collection: { code: collectionCode },
      },
      relations: ['collection'],
    });

    if (!property) {
      throw new NotFoundException(
        `Property '${propertyCode}' not found in collection '${collectionCode}'`
      );
    }

    if (property.columnName) {
      await this.ddlExecutor.dropColumn(
        property.collection!.tableName,
        property.columnName,
        {
          entityId: property.id,
          performedBy: context.userId,
          performedByType: actorType,
        },
      );
    }

    await this.propertyRepo.delete(property.id);

    this.logger.log(`Deleted property '${propertyCode}' from collection '${collectionCode}'`);
  }

  /**
   * Retrieves all properties for a collection.
   */
  async getProperties(collectionCode: string): Promise<PropertyDefinition[]> {
    const collection = await this.collectionRepo.findOne({
      where: { code: collectionCode },
    });

    if (!collection) {
      throw new NotFoundException(`Collection '${collectionCode}' not found`);
    }

    return this.propertyRepo.find({
      where: { collection: { id: collection.id } },
      order: { position: 'ASC' },
    });
  }

  /**
   * Retrieves a single property by code.
   */
  async getProperty(
    collectionCode: string,
    propertyCode: string,
  ): Promise<PropertyDefinition | null> {
    return this.propertyRepo.findOne({
      where: {
        code: propertyCode,
        collection: { code: collectionCode },
      },
      relations: ['collection'],
    });
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // HELPER METHODS
  // ═══════════════════════════════════════════════════════════════════════════

  private async checkTableExists(
    tableName: string,
    schema: string = 'public',
  ): Promise<boolean> {
    const result = await this.dataSource.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables
        WHERE table_schema = $1 AND table_name = $2
      )
    `, [schema, tableName]);
    return result[0].exists;
  }

  private async checkColumnExists(
    tableName: string,
    columnName: string,
    schema: string = 'public',
  ): Promise<boolean> {
    const result = await this.dataSource.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.columns
        WHERE table_schema = $1 AND table_name = $2 AND column_name = $3
      )
    `, [schema, tableName, columnName]);
    return result[0].exists;
  }

  private async getDataTypeFromPropertyType(propertyTypeId: string): Promise<string> {
    const result = await this.dataSource.query(`
      SELECT code FROM property_types WHERE id = $1 LIMIT 1
    `, [propertyTypeId]);

    if (result.length === 0) {
      return 'text';
    }

    return result[0].code;
  }
}
