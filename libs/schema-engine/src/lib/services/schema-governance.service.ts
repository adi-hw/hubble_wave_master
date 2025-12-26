import { Injectable, Logger, ForbiddenException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CollectionDefinition, PropertyDefinition, OwnerType } from '@hubblewave/instance-db';

/**
 * Type of actor performing a schema operation.
 *
 * - **user**: Regular user through the UI/API
 * - **system**: Automated system process
 * - **migration**: Database migration script
 */
export type ActorType = 'user' | 'system' | 'migration';

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
 * **Module Tier** (`module`):
 * - Platform feature collections that tenants may extend
 * - Metadata can be customized (labels, descriptions)
 * - Custom properties can be added with `x_` prefix
 * - Platform properties cannot be deleted or have types changed
 *
 * **Custom Tier** (`custom`):
 * - Collections created by tenants
 * - Full control over all aspects
 * - Can be deleted entirely if needed
 */
@Injectable()
export class SchemaGovernanceService {
  private readonly logger = new Logger(SchemaGovernanceService.name);

  constructor(
    @InjectRepository(CollectionDefinition)
    private readonly collectionRepo: Repository<CollectionDefinition>,

    @InjectRepository(PropertyDefinition)
    private readonly propertyRepo: Repository<PropertyDefinition>,
  ) {}

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
  ): Promise<void> {
    // For create operations, validate the code
    if (operation === 'create') {
      this.validateCollectionCode(collectionCode);
      return;
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

      // For module collections, custom properties must use x_ prefix
      if (collection.ownerType === 'module' && !propertyCode.startsWith('x_')) {
        throw new BadRequestException(
          `Custom properties on module collections must start with 'x_'. ` +
          `Try using 'x_${propertyCode}' instead.`
        );
      }

      return;
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

    // For module collections, check if x_ prefix is required
    if (collection.ownerType === 'module' && !propertyCode.startsWith('x_')) {
      return {
        available: false,
        reason: `Custom properties on module collections must start with 'x_'`,
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

      case 'module':
        return {
          canModifyMetadata: true,
          canAddProperties: true,
          canDelete: false,
          canModifySchema: false,
          owner,
          restrictions: [
            'Module entities cannot be deleted',
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
