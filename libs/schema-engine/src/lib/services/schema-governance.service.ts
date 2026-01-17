import { Injectable, Logger, ForbiddenException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { CollectionDefinition, PropertyDefinition, OwnerType, PropertyType } from '@hubblewave/instance-db';

/**
 * Type of actor performing a schema operation.
 *
 * - **user**: Regular user through the UI/API
 * - **system**: Automated system process
 * - **migration**: Database migration script
 */
export type ActorType = 'user' | 'system' | 'migration';

/**
 * Schema operation types that can be validated.
 */
export type SchemaOperationType = 'create' | 'update' | 'delete';

/**
 * Target of a schema operation.
 */
export type SchemaOperationTarget = 'collection' | 'property';

/**
 * Schema operation descriptor for validation.
 */
export interface SchemaOperation {
  /** Operation type being performed */
  type: SchemaOperationType;

  /** Target of the operation (collection or property) */
  target: SchemaOperationTarget;

  /** Collection code for the operation */
  collectionCode: string;

  /** Property code (required for property operations) */
  propertyCode?: string;

  /** Actor performing the operation */
  actorType: ActorType;

  /** New property type ID (for type change operations) */
  newPropertyTypeId?: string;

  /** Current property type ID (for type change operations) */
  currentPropertyTypeId?: string;

  /** Whether a NOT NULL constraint is being added */
  addingNotNullConstraint?: boolean;

  /** Default value being set (for NOT NULL constraint additions) */
  defaultValue?: string | null;

  /** Explicit approval flag for platform-tier deletions */
  explicitApproval?: boolean;
}

/**
 * Result of schema operation validation.
 */
export interface ValidationResult {
  /** Whether the operation is allowed to proceed */
  allowed: boolean;

  /** Non-fatal warnings about the operation */
  warnings: string[];

  /** Fatal errors that prevent the operation */
  errors: string[];
}

/**
 * Permission levels for schema operations.
 *
 * This interface represents what actions are allowed on a given
 * collection or property based on ownership rules.
 */
export interface SchemaPermissions {
  /** Whether metadata (label, description, icon, etc.) can be modified */
  canModifyMetadata: boolean;

  /** Whether new custom properties can be added */
  canAddProperties: boolean;

  /** Whether the collection/property can be deleted */
  canDelete: boolean;

  /** Whether the physical schema (table/column) can be modified */
  canModifySchema: boolean;

  /** The ownership level that determines these permissions */
  owner: OwnerType;

  /** Human-readable explanation of why certain actions may be restricted */
  restrictions: string[];
}

/**
 * Operations that require extra scrutiny due to potential data loss or system impact.
 */
export const DANGEROUS_OPERATIONS = {
  /** Dropping a column from a system or platform collection */
  DROP_SYSTEM_COLUMN: 'drop_system_column',
  /** Dropping a column from a platform collection */
  DROP_PLATFORM_COLUMN: 'drop_platform_column',
  /** Dropping a system collection/table */
  DROP_SYSTEM_TABLE: 'drop_system_table',
  /** Dropping a platform collection/table */
  DROP_PLATFORM_TABLE: 'drop_platform_table',
  /** Type conversion that may lose data */
  UNSAFE_TYPE_CONVERSION: 'unsafe_type_conversion',
  /** Adding NOT NULL constraint to populated column without default */
  ADD_NOT_NULL_WITHOUT_DEFAULT: 'add_not_null_without_default',
} as const;

export type DangerousOperation = typeof DANGEROUS_OPERATIONS[keyof typeof DANGEROUS_OPERATIONS];

/**
 * Safe type conversions that do not risk data loss.
 * Maps from source base type to allowed target base types.
 */
const SAFE_TYPE_CONVERSIONS: Record<string, Set<string>> = {
  // Text types can safely widen
  'varchar': new Set(['text', 'varchar']),
  'char': new Set(['varchar', 'text']),
  'text': new Set(['text']),

  // Integer types can widen to larger integer or decimal/numeric
  'smallint': new Set(['integer', 'bigint', 'numeric', 'decimal', 'real', 'double precision']),
  'integer': new Set(['bigint', 'numeric', 'decimal', 'real', 'double precision']),
  'bigint': new Set(['numeric', 'decimal', 'double precision']),

  // Numeric types can widen
  'real': new Set(['double precision', 'numeric', 'decimal']),
  'numeric': new Set(['numeric', 'decimal']),
  'decimal': new Set(['numeric', 'decimal']),

  // Boolean can only stay boolean
  'boolean': new Set(['boolean']),

  // Date/time types are generally not safely convertible to other types
  'date': new Set(['timestamp', 'timestamptz']),
  'time': new Set(['time', 'timetz']),
  'timetz': new Set(['timetz']),
  'timestamp': new Set(['timestamptz']),
  'timestamptz': new Set(['timestamptz']),

  // UUID can convert to text but not vice versa
  'uuid': new Set(['varchar', 'text']),

  // JSON types can convert between each other
  'json': new Set(['jsonb', 'text']),
  'jsonb': new Set(['json', 'text']),
};

/**
 * Reserved collection codes that cannot be used for custom collections.
 */
const RESERVED_COLLECTION_CODES = new Set([
  // Core platform tables
  'user', 'users', 'role', 'roles', 'permission', 'permissions',
  'group', 'groups', 'tenant', 'tenants', 'instance', 'instances',

  // Schema engine tables
  'collection_definition', 'collection_definitions',
  'property_definition', 'property_definitions',
  'property_type', 'property_types',
  'choice_list', 'choice_lists', 'choice_item', 'choice_items',
  'schema_change_log', 'schema_sync_state',

  // Access control tables
  'collection_access_rule', 'property_access_rule',
  'access_condition', 'access_condition_group',

  // System keywords
  'system', 'admin', 'api', 'auth', 'config', 'settings',
  'migration', 'migrations', 'audit', 'log', 'logs',
]);

/**
 * Reserved property codes that cannot be used on any collection.
 */
const RESERVED_PROPERTY_CODES = new Set([
  // Standard audit columns
  'id', 'uuid', 'created_at', 'updated_at', 'created_by', 'updated_by',
  'is_deleted', 'deleted_at', 'deleted_by',

  // TypeORM internal
  'version', '_version',

  // Reserved for future use
  'tenant_id', 'instance_id', 'organization_id',
]);

/**
 * SchemaGovernanceService
 *
 * This service enforces the rules that govern schema modifications in HubbleWave.
 * It implements a three-tier ownership model:
 *
 * **System Tier** (`system`):
 * - Core platform tables like users, roles, permissions
 * - Completely immutable - no modifications allowed
 * - Created and maintained by platform developers only
 *
 * **Platform Tier** (`platform`):
 * - Platform feature collections that instances may extend
 * - Metadata can be customized (labels, descriptions)
 * - Custom properties can be added with `x_` prefix
 * - Platform properties cannot be deleted or have types changed without explicit approval
 *
 * **Custom Tier** (`custom`):
 * - Collections created by instances
 * - Full control over all aspects
 * - Can be deleted entirely if needed
 *
 * Safety Gates:
 * This service includes safety gates to prevent dangerous operations:
 * - DROP COLUMN on system/platform collections
 * - DROP TABLE on system/platform collections
 * - Unsafe type conversions that could lose data
 * - Adding NOT NULL constraints to populated columns without defaults
 */
@Injectable()
export class SchemaGovernanceService {
  private readonly logger = new Logger(SchemaGovernanceService.name);

  constructor(
    @InjectRepository(CollectionDefinition)
    private readonly collectionRepo: Repository<CollectionDefinition>,

    @InjectRepository(PropertyDefinition)
    private readonly propertyRepo: Repository<PropertyDefinition>,

    @InjectRepository(PropertyType)
    private readonly propertyTypeRepo: Repository<PropertyType>,

    private readonly dataSource: DataSource,
  ) {}

  // ═══════════════════════════════════════════════════════════════════════════
  // SAFETY GATE VALIDATION
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Validates a schema operation against safety gates.
   *
   * This method performs comprehensive validation to prevent dangerous operations
   * that could cause data loss or system instability:
   *
   * - DROP COLUMN on system/platform collections
   * - DROP TABLE on system/platform collections
   * - Unsafe type conversions that could lose data
   * - Adding NOT NULL constraints to populated columns without defaults
   *
   * @param operation - The schema operation to validate
   * @returns ValidationResult indicating whether the operation is allowed
   */
  async validateSchemaOperation(operation: SchemaOperation): Promise<ValidationResult> {
    const result: ValidationResult = {
      allowed: true,
      warnings: [],
      errors: [],
    };

    // Route to appropriate validation based on target
    if (operation.target === 'collection') {
      await this.validateCollectionSchemaOperation(operation, result);
    } else if (operation.target === 'property') {
      await this.validatePropertySchemaOperation(operation, result);
    }

    // Final determination: any errors means not allowed
    if (result.errors.length > 0) {
      result.allowed = false;
    }

    // Log the validation result for audit purposes
    if (!result.allowed) {
      this.logger.warn(
        `Schema operation rejected: ${operation.type} ${operation.target} ` +
        `on ${operation.collectionCode}${operation.propertyCode ? '.' + operation.propertyCode : ''}. ` +
        `Errors: ${result.errors.join('; ')}`
      );
    } else if (result.warnings.length > 0) {
      this.logger.log(
        `Schema operation allowed with warnings: ${operation.type} ${operation.target} ` +
        `on ${operation.collectionCode}${operation.propertyCode ? '.' + operation.propertyCode : ''}. ` +
        `Warnings: ${result.warnings.join('; ')}`
      );
    }

    return result;
  }

  /**
   * Validates collection-level schema operations.
   */
  private async validateCollectionSchemaOperation(
    operation: SchemaOperation,
    result: ValidationResult,
  ): Promise<void> {
    if (operation.type === 'create') {
      return;
    }

    const collection = await this.collectionRepo.findOne({
      where: { code: operation.collectionCode },
    });

    if (!collection) {
      result.errors.push(`Collection '${operation.collectionCode}' not found`);
      return;
    }

    // Validate DELETE operations on collections
    if (operation.type === 'delete') {
      await this.validateCollectionDeletion(collection, operation, result);
    }
  }

  /**
   * Validates collection deletion against ownership rules.
   */
  private async validateCollectionDeletion(
    collection: CollectionDefinition,
    operation: SchemaOperation,
    result: ValidationResult,
  ): Promise<void> {
    switch (collection.ownerType) {
      case 'system':
        result.errors.push(
          `Cannot delete system collection '${collection.code}'. ` +
          `System collections are core platform infrastructure and cannot be removed. ` +
          `Operation type: ${DANGEROUS_OPERATIONS.DROP_SYSTEM_TABLE}`
        );
        break;

      case 'platform':
        if (!operation.explicitApproval) {
          result.errors.push(
            `Cannot delete platform collection '${collection.code}' without explicit approval. ` +
            `Platform collections are managed features that require explicit approval for deletion. ` +
            `Set explicitApproval=true to confirm this operation. ` +
            `Operation type: ${DANGEROUS_OPERATIONS.DROP_PLATFORM_TABLE}`
          );
        } else {
          result.warnings.push(
            `Deleting platform collection '${collection.code}'. ` +
            `This will remove all associated data and cannot be undone.`
          );
        }
        break;

      case 'custom':
        result.warnings.push(
          `Deleting custom collection '${collection.code}'. ` +
          `All data in this collection will be permanently removed.`
        );
        break;
    }
  }

  /**
   * Validates property-level schema operations.
   */
  private async validatePropertySchemaOperation(
    operation: SchemaOperation,
    result: ValidationResult,
  ): Promise<void> {
    if (operation.type === 'create') {
      return;
    }

    if (!operation.propertyCode) {
      result.errors.push('Property code is required for property operations');
      return;
    }

    const property = await this.propertyRepo.findOne({
      where: {
        code: operation.propertyCode,
        collection: { code: operation.collectionCode },
      },
      relations: ['collection', 'propertyType'],
    });

    if (!property) {
      result.errors.push(
        `Property '${operation.propertyCode}' not found in collection '${operation.collectionCode}'`
      );
      return;
    }

    // Validate DELETE operations on properties
    if (operation.type === 'delete') {
      await this.validatePropertyDeletion(property, operation, result);
    }

    // Validate UPDATE operations on properties
    if (operation.type === 'update') {
      await this.validatePropertyUpdate(property, operation, result);
    }
  }

  /**
   * Validates property deletion against ownership rules.
   */
  private async validatePropertyDeletion(
    property: PropertyDefinition,
    operation: SchemaOperation,
    result: ValidationResult,
  ): Promise<void> {
    const collectionOwnerType = property.collection?.ownerType ?? 'custom';
    const propertyOwnerType = property.ownerType;

    // Check property ownership
    switch (propertyOwnerType) {
      case 'system':
        result.errors.push(
          `Cannot delete system property '${property.code}' from collection '${operation.collectionCode}'. ` +
          `System properties are core platform fields and cannot be removed. ` +
          `Operation type: ${DANGEROUS_OPERATIONS.DROP_SYSTEM_COLUMN}`
        );
        return;

      case 'platform':
        if (!operation.explicitApproval) {
          result.errors.push(
            `Cannot delete platform property '${property.code}' from collection '${operation.collectionCode}' ` +
            `without explicit approval. Platform properties are managed features that require explicit approval. ` +
            `Set explicitApproval=true to confirm this operation. ` +
            `Operation type: ${DANGEROUS_OPERATIONS.DROP_PLATFORM_COLUMN}`
          );
          return;
        }
        result.warnings.push(
          `Deleting platform property '${property.code}'. This may affect platform features.`
        );
        break;
    }

    // Check collection ownership for additional restrictions
    if (collectionOwnerType === 'system' && propertyOwnerType !== 'system') {
      result.errors.push(
        `Cannot delete property '${property.code}' from system collection '${operation.collectionCode}'. ` +
        `System collections do not allow property deletion. ` +
        `Operation type: ${DANGEROUS_OPERATIONS.DROP_SYSTEM_COLUMN}`
      );
      return;
    }

    if (collectionOwnerType === 'platform' && propertyOwnerType === 'custom' && !operation.explicitApproval) {
      result.warnings.push(
        `Deleting custom property '${property.code}' from platform collection '${operation.collectionCode}'. ` +
        `Consider the impact on any dependent views or automations.`
      );
    }

    if (propertyOwnerType === 'custom') {
      result.warnings.push(
        `Deleting custom property '${property.code}'. All data in this column will be permanently removed.`
      );
    }
  }

  /**
   * Validates property updates including type changes and constraint additions.
   */
  private async validatePropertyUpdate(
    property: PropertyDefinition,
    operation: SchemaOperation,
    result: ValidationResult,
  ): Promise<void> {
    // Validate type changes
    if (operation.newPropertyTypeId && operation.newPropertyTypeId !== property.propertyTypeId) {
      await this.validateTypeConversion(property, operation, result);
    }

    // Validate NOT NULL constraint additions
    if (operation.addingNotNullConstraint) {
      await this.validateNotNullAddition(property, operation, result);
    }
  }

  /**
   * Validates that a type conversion is safe and will not lose data.
   */
  private async validateTypeConversion(
    property: PropertyDefinition,
    operation: SchemaOperation,
    result: ValidationResult,
  ): Promise<void> {
    const currentType = property.propertyType;
    const newType = await this.propertyTypeRepo.findOne({
      where: { id: operation.newPropertyTypeId },
    });

    if (!currentType || !newType) {
      result.errors.push(
        'Unable to validate type conversion: property type information not available'
      );
      return;
    }

    const currentBaseType = currentType.baseType.toLowerCase();
    const newBaseType = newType.baseType.toLowerCase();

    // Same base type is always safe
    if (currentBaseType === newBaseType) {
      return;
    }

    // Check if conversion is in the safe list
    const safeTargets = SAFE_TYPE_CONVERSIONS[currentBaseType];
    const isConversionSafe = safeTargets?.has(newBaseType) ?? false;

    if (!isConversionSafe) {
      result.errors.push(
        `Unsafe type conversion from '${currentType.code}' (${currentBaseType}) ` +
        `to '${newType.code}' (${newBaseType}) on property '${property.code}'. ` +
        `This conversion may result in data loss or conversion errors. ` +
        `Operation type: ${DANGEROUS_OPERATIONS.UNSAFE_TYPE_CONVERSION}`
      );
    } else {
      result.warnings.push(
        `Type conversion from '${currentType.code}' to '${newType.code}' on property '${property.code}'. ` +
        `This conversion is generally safe but verify data compatibility.`
      );
    }
  }

  /**
   * Validates adding a NOT NULL constraint to an existing column.
   */
  private async validateNotNullAddition(
    property: PropertyDefinition,
    operation: SchemaOperation,
    result: ValidationResult,
  ): Promise<void> {
    // If a default value is provided, the operation is safe
    if (operation.defaultValue !== undefined && operation.defaultValue !== null) {
      result.warnings.push(
        `Adding NOT NULL constraint to property '${property.code}' with default value. ` +
        `Existing NULL values will be updated to the default.`
      );
      return;
    }

    // Check if the column has any NULL values in the table
    const collection = property.collection;
    if (!collection) {
      result.warnings.push(
        `Unable to verify NULL values for property '${property.code}'. ` +
        `Ensure no NULL values exist before adding NOT NULL constraint.`
      );
      return;
    }

    const hasNullValues = await this.checkColumnHasNullValues(
      collection.tableName,
      property.columnName,
    );

    if (hasNullValues) {
      result.errors.push(
        `Cannot add NOT NULL constraint to property '${property.code}' in collection '${operation.collectionCode}'. ` +
        `The column contains NULL values. Provide a default value or update existing records first. ` +
        `Operation type: ${DANGEROUS_OPERATIONS.ADD_NOT_NULL_WITHOUT_DEFAULT}`
      );
    }
  }

  /**
   * Checks if a column in a table contains any NULL values.
   */
  private async checkColumnHasNullValues(
    tableName: string,
    columnName: string,
  ): Promise<boolean> {
    const result = await this.dataSource.query(
      `SELECT EXISTS (SELECT 1 FROM "${tableName}" WHERE "${columnName}" IS NULL) AS has_nulls`
    );
    return result[0]?.has_nulls === true;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // VALIDATION METHODS
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Validates that a collection operation is allowed based on governance rules.
   */
  async validateCollectionOperation(
    operation: 'create' | 'update' | 'delete',
    collectionCode: string,
    actorType: ActorType,
    updates?: Partial<CollectionDefinition>,
    options?: { explicitApproval?: boolean },
  ): Promise<void> {
    // For create operations, validate the code
    if (operation === 'create') {
      this.validateCollectionCode(collectionCode);
      return;
    }

    // Run safety gate validation first
    const safetyValidation = await this.validateSchemaOperation({
      type: operation,
      target: 'collection',
      collectionCode,
      actorType,
      explicitApproval: options?.explicitApproval,
    });

    if (!safetyValidation.allowed) {
      throw new ForbiddenException(safetyValidation.errors.join(' '));
    }

    // For update/delete, check existing collection
    const collection = await this.collectionRepo.findOne({
      where: { code: collectionCode },
    });

    if (!collection) {
      throw new BadRequestException(`Collection '${collectionCode}' not found`);
    }

    const permissions = this.getPermissionsForOwner(collection.ownerType);

    // Check delete permission
    if (operation === 'delete') {
      if (!permissions.canDelete) {
        throw new ForbiddenException(
          `Cannot delete ${collection.ownerType} collection '${collectionCode}'. ` +
          `Only custom collections can be deleted.`
        );
      }
      return;
    }

    // Check update permission
    if (operation === 'update') {
      if (!permissions.canModifyMetadata) {
        throw new ForbiddenException(
          `Cannot modify system collection '${collectionCode}'. ` +
          `System collections are managed by the platform.`
        );
      }

      // Check if trying to modify protected fields
      if (updates) {
        const protectedFields = ['code', 'tableName', 'ownerType'];
        const attemptedProtectedChanges = protectedFields.filter(
          field => updates[field as keyof CollectionDefinition] !== undefined
        );

        if (attemptedProtectedChanges.length > 0 && actorType !== 'migration') {
          throw new ForbiddenException(
            `Cannot modify protected fields: ${attemptedProtectedChanges.join(', ')}. ` +
            `These fields can only be changed through migrations.`
          );
        }
      }
    }
  }

  /**
   * Validates that a property operation is allowed based on governance rules.
   */
  async validatePropertyOperation(
    operation: 'create' | 'update' | 'delete',
    collectionCode: string,
    propertyCode: string,
    actorType: ActorType,
    updates?: Partial<PropertyDefinition>,
    options?: {
      explicitApproval?: boolean;
      newPropertyTypeId?: string;
      currentPropertyTypeId?: string;
      addingNotNullConstraint?: boolean;
      defaultValue?: string | null;
    },
  ): Promise<void> {
    // Get the collection first
    const collection = await this.collectionRepo.findOne({
      where: { code: collectionCode },
    });

    if (!collection) {
      throw new BadRequestException(`Collection '${collectionCode}' not found`);
    }

    // For create operations, validate the code and check extensibility
    if (operation === 'create') {
      this.validatePropertyCode(propertyCode, collection.ownerType);

      // Check if collection allows adding properties
      if (!collection.isExtensible && actorType !== 'migration') {
        throw new ForbiddenException(
          `Collection '${collectionCode}' is not extensible. ` +
          `New properties cannot be added to this collection.`
        );
      }

      // For platform collections, custom properties must use x_ prefix
      if (collection.ownerType === 'platform' && !propertyCode.startsWith('x_')) {
        throw new BadRequestException(
          `Custom properties on platform collections must start with 'x_'. ` +
          `Try using 'x_${propertyCode}' instead.`
        );
      }

      return;
    }

    // Run safety gate validation for update/delete operations
    const safetyValidation = await this.validateSchemaOperation({
      type: operation,
      target: 'property',
      collectionCode,
      propertyCode,
      actorType,
      explicitApproval: options?.explicitApproval,
      newPropertyTypeId: options?.newPropertyTypeId,
      currentPropertyTypeId: options?.currentPropertyTypeId,
      addingNotNullConstraint: options?.addingNotNullConstraint,
      defaultValue: options?.defaultValue,
    });

    if (!safetyValidation.allowed) {
      throw new ForbiddenException(safetyValidation.errors.join(' '));
    }

    // For update/delete, check existing property
    const property = await this.propertyRepo.findOne({
      where: {
        code: propertyCode,
        collection: { code: collectionCode },
      },
      relations: ['collection'],
    });

    if (!property) {
      throw new BadRequestException(
        `Property '${propertyCode}' not found in collection '${collectionCode}'`
      );
    }

    const permissions = this.getPermissionsForOwner(property.ownerType);

    // Check delete permission
    if (operation === 'delete') {
      if (!permissions.canDelete) {
        throw new ForbiddenException(
          `Cannot delete ${property.ownerType} property '${propertyCode}'. ` +
          `Only custom properties can be deleted.`
        );
      }
      return;
    }

    // Check update permission
    if (operation === 'update') {
      if (!permissions.canModifyMetadata && property.ownerType === 'system') {
        throw new ForbiddenException(
          `Cannot modify system property '${propertyCode}'. ` +
          `System properties are managed by the platform.`
        );
      }

      // Check if trying to modify protected fields
      if (updates && actorType !== 'migration') {
        const protectedFields = ['code', 'columnName', 'propertyTypeId', 'ownerType'];
        const attemptedProtectedChanges = protectedFields.filter(
          field => updates[field as keyof PropertyDefinition] !== undefined
        );

        if (attemptedProtectedChanges.length > 0) {
          throw new ForbiddenException(
            `Cannot modify protected fields: ${attemptedProtectedChanges.join(', ')}. ` +
            `These fields require schema migration to change.`
          );
        }
      }
    }
  }

  /**
   * Validates a collection code for naming conventions and reserved words.
   */
  validateCollectionCode(code: string): void {
    // Check format: lowercase alphanumeric with underscores
    if (!/^[a-z][a-z0-9_]*$/.test(code)) {
      throw new BadRequestException(
        `Invalid collection code '${code}'. ` +
        `Collection codes must start with a letter and contain only lowercase ` +
        `letters, numbers, and underscores.`
      );
    }

    // Check length
    if (code.length < 2 || code.length > 63) {
      throw new BadRequestException(
        `Invalid collection code '${code}'. ` +
        `Collection codes must be between 2 and 63 characters.`
      );
    }

    // Check reserved words
    if (RESERVED_COLLECTION_CODES.has(code)) {
      throw new BadRequestException(
        `Collection code '${code}' is reserved and cannot be used. ` +
        `Please choose a different name.`
      );
    }

    // Check for problematic prefixes
    if (code.startsWith('pg_') || code.startsWith('sql_')) {
      throw new BadRequestException(
        `Collection code '${code}' uses a reserved prefix. ` +
        `Codes cannot start with 'pg_' or 'sql_'.`
      );
    }
  }

  /**
   * Validates a property code for naming conventions and reserved words.
   */
  validatePropertyCode(code: string, collectionOwner: OwnerType): void {
    // Check format: lowercase alphanumeric with underscores
    if (!/^[a-z][a-z0-9_]*$/.test(code)) {
      throw new BadRequestException(
        `Invalid property code '${code}'. ` +
        `Property codes must start with a letter and contain only lowercase ` +
        `letters, numbers, and underscores.`
      );
    }

    // Check length
    if (code.length < 2 || code.length > 63) {
      throw new BadRequestException(
        `Invalid property code '${code}'. ` +
        `Property codes must be between 2 and 63 characters.`
      );
    }

    // Check reserved words
    if (RESERVED_PROPERTY_CODES.has(code)) {
      throw new BadRequestException(
        `Property code '${code}' is reserved and cannot be used. ` +
        `Please choose a different name.`
      );
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // PERMISSION QUERIES
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Gets the effective permissions for a collection.
   */
  async getCollectionPermissions(collectionCode: string): Promise<SchemaPermissions> {
    const collection = await this.collectionRepo.findOne({
      where: { code: collectionCode },
    });

    if (!collection) {
      throw new BadRequestException(`Collection '${collectionCode}' not found`);
    }

    const permissions = this.getPermissionsForOwner(collection.ownerType);

    return {
      ...permissions,
      owner: collection.ownerType,
    };
  }

  /**
   * Checks if a collection name is available for use.
   */
  async isCollectionNameAvailable(code: string): Promise<{
    available: boolean;
    reason?: string;
  }> {
    // Check reserved words first
    if (RESERVED_COLLECTION_CODES.has(code)) {
      return {
        available: false,
        reason: `'${code}' is a reserved collection name`,
      };
    }

    // Check format
    if (!/^[a-z][a-z0-9_]*$/.test(code)) {
      return {
        available: false,
        reason: 'Collection codes must start with a letter and contain only lowercase letters, numbers, and underscores',
      };
    }

    // Check if already exists
    const existing = await this.collectionRepo.findOne({
      where: { code },
    });

    if (existing) {
      return {
        available: false,
        reason: `A collection with code '${code}' already exists`,
      };
    }

    return { available: true };
  }

  /**
   * Checks if a property name is available within a collection.
   */
  async isPropertyNameAvailable(
    collectionCode: string,
    propertyCode: string,
  ): Promise<{
    available: boolean;
    reason?: string;
    suggestedCode?: string;
  }> {
    const collection = await this.collectionRepo.findOne({
      where: { code: collectionCode },
    });

    if (!collection) {
      return {
        available: false,
        reason: `Collection '${collectionCode}' not found`,
      };
    }

    // Check reserved words
    if (RESERVED_PROPERTY_CODES.has(propertyCode)) {
      return {
        available: false,
        reason: `'${propertyCode}' is a reserved property name`,
      };
    }

    // For platform collections, check if x_ prefix is required
    if (collection.ownerType === 'platform' && !propertyCode.startsWith('x_')) {
      return {
        available: false,
        reason: `Custom properties on platform collections must start with 'x_'`,
        suggestedCode: `x_${propertyCode}`,
      };
    }

    // Check if already exists
    const existing = await this.propertyRepo.findOne({
      where: {
        code: propertyCode,
        collection: { code: collectionCode },
      },
    });

    if (existing) {
      return {
        available: false,
        reason: `A property with code '${propertyCode}' already exists in this collection`,
      };
    }

    return { available: true };
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // HELPER METHODS
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Gets the permissions based on owner type.
   */
  private getPermissionsForOwner(owner: OwnerType): SchemaPermissions {
    switch (owner) {
      case 'system':
        return {
          canModifyMetadata: false,
          canAddProperties: false,
          canDelete: false,
          canModifySchema: false,
          owner,
          restrictions: [
            'System entities are completely immutable',
            'No modifications allowed',
            'Managed by platform developers only',
          ],
        };

      case 'platform':
        return {
          canModifyMetadata: true,
          canAddProperties: true,
          canDelete: false,
          canModifySchema: false,
          owner,
          restrictions: [
            'Platform entities cannot be deleted without explicit approval',
            'Schema changes require migrations',
            'Custom properties must use x_ prefix',
          ],
        };

      case 'custom':
      default:
        return {
          canModifyMetadata: true,
          canAddProperties: true,
          canDelete: true,
          canModifySchema: true,
          owner,
          restrictions: [],
        };
    }
  }
}
