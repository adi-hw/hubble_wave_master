/**
 * Schema Validator Service
 * HubbleWave Platform - Phase 2
 *
 * Main service for validating schema definitions.
 */

import { Injectable } from '@nestjs/common';
import {
  CollectionDefinition,
  PropertyDefinition,
  RelationshipDefinition,
  ValidationResult,
  SchemaContext,
} from './types';
import { normalizePropertyType } from '@hubblewave/shared-types';
import { CollectionValidator } from './collection-validator';
import { PropertyValidator } from './property-validator';
import { RelationshipValidator } from './relationship-validator';
import { DataValidator } from './data-validator';

@Injectable()
export class SchemaValidatorService {
  private collectionValidator = new CollectionValidator();
  private propertyValidator = new PropertyValidator();
  private relationshipValidator = new RelationshipValidator();
  private dataValidator = new DataValidator();

  /**
   * Validate a complete schema definition
   */
  validateSchema(
    collections: CollectionDefinition[],
    relationships: RelationshipDefinition[]
  ): ValidationResult {
    const context: SchemaContext = {
      collections: new Map(collections.map((c) => [c.code, c])),
      relationships,
    };

    const allErrors: ValidationResult['errors'] = [];
    const allWarnings: ValidationResult['warnings'] = [];

    collections.forEach((collection, index) => {
      const result = this.collectionValidator.validateCollection(collection, context);
      result.errors.forEach((error) => {
        allErrors.push({
          ...error,
          path: `collections[${index}].${error.path}`,
        });
      });
      result.warnings.forEach((warning) => {
        allWarnings.push({
          ...warning,
          path: `collections[${index}].${warning.path}`,
        });
      });
    });

    const relationshipResult = this.relationshipValidator.validateRelationships(
      relationships,
      context
    );
    allErrors.push(...relationshipResult.errors);
    allWarnings.push(...relationshipResult.warnings);

    return {
      valid: allErrors.length === 0,
      errors: allErrors,
      warnings: allWarnings,
    };
  }

  /**
   * Validate a single collection definition
   */
  validateCollection(
    collection: CollectionDefinition,
    context?: SchemaContext
  ): ValidationResult {
    return this.collectionValidator.validateCollection(collection, context);
  }

  /**
   * Validate a single property definition
   */
  validateProperty(
    property: PropertyDefinition,
    context?: SchemaContext
  ): ValidationResult {
    return this.propertyValidator.validateProperty(property, context);
  }

  /**
   * Validate a relationship definition
   */
  validateRelationship(
    relationship: RelationshipDefinition,
    context: SchemaContext
  ): ValidationResult {
    return this.relationshipValidator.validateRelationship(relationship, context);
  }

  /**
   * Validate a data value against a property definition
   */
  validateValue(value: unknown, property: PropertyDefinition): ValidationResult {
    return this.dataValidator.validateValue(value, property);
  }

  /**
   * Validate a complete record against property definitions
   */
  validateRecord(
    record: Record<string, unknown>,
    properties: PropertyDefinition[]
  ): ValidationResult {
    return this.dataValidator.validateRecord(record, properties);
  }

  /**
   * Check if a schema change is safe (won't cause data loss)
   */
  validateSchemaChange(
    oldCollection: CollectionDefinition,
    newCollection: CollectionDefinition
  ): ValidationResult {
    const errors: ValidationResult['errors'] = [];
    const warnings: ValidationResult['warnings'] = [];

    const oldProperties = new Map(oldCollection.properties.map((p) => [p.code, p]));
    const newProperties = new Map(newCollection.properties.map((p) => [p.code, p]));

    for (const [code, oldProp] of oldProperties) {
      const newProp = newProperties.get(code);

      if (!newProp) {
        warnings.push({
          path: `properties.${code}`,
          code: 'PROPERTY_REMOVED',
          message: `Property "${oldProp.name}" will be removed`,
          suggestion: 'Ensure data in this property is no longer needed',
        });
        continue;
      }

      const oldType = normalizePropertyType(oldProp.type);
      const newType = normalizePropertyType(newProp.type);

      if (oldType !== newType) {
        const safeConversions: Record<string, string[]> = {
          text: ['rich-text'],
          number: ['text'],
          date: ['datetime', 'text'],
          choice: ['multi-choice', 'text'],
        };

        const isSafe = safeConversions[oldType]?.includes(newType);
        if (!isSafe) {
          errors.push({
            path: `properties.${code}.type`,
            code: 'UNSAFE_TYPE_CHANGE',
            message: `Changing "${oldProp.name}" from ${oldType} to ${newType} may cause data loss`,
            details: { oldType, newType },
          });
        } else {
          warnings.push({
            path: `properties.${code}.type`,
            code: 'TYPE_CONVERSION',
            message: `Property "${oldProp.name}" will be converted from ${oldType} to ${newType}`,
          });
        }
      }

      if (!oldProp.isRequired && newProp.isRequired) {
        warnings.push({
          path: `properties.${code}.isRequired`,
          code: 'REQUIRED_CHANGE',
          message: `Property "${oldProp.name}" will become required`,
          suggestion: 'Existing records with null values will need to be updated',
        });
      }

      if (oldProp.isUnique !== newProp.isUnique && newProp.isUnique) {
        warnings.push({
          path: `properties.${code}.isUnique`,
          code: 'UNIQUE_CONSTRAINT',
          message: `Property "${oldProp.name}" will become unique`,
          suggestion: 'Ensure no duplicate values exist in this property',
        });
      }

      const oldConfig = oldProp.config || {};
      const newConfig = newProp.config || {};

      if (
        (oldConfig.maxLength ?? Infinity) > (newConfig.maxLength ?? Infinity)
      ) {
        warnings.push({
          path: `properties.${code}.config.maxLength`,
          code: 'LENGTH_REDUCED',
          message: `Maximum length of "${oldProp.name}" will be reduced`,
          suggestion: 'Existing values exceeding the new limit will be truncated',
        });
      }
    }

    for (const [code] of newProperties) {
      if (!oldProperties.has(code)) {
        const newProp = newProperties.get(code)!;
        if (newProp.isRequired && newProp.defaultValue === undefined) {
          warnings.push({
            path: `properties.${code}`,
            code: 'NEW_REQUIRED_PROPERTY',
            message: `New required property "${newProp.name}" has no default value`,
            suggestion: 'Existing records will need values for this property',
          });
        }
      }
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
    };
  }
}
