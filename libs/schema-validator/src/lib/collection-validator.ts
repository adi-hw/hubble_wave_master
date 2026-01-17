/**
 * Collection Validator
 * HubbleWave Platform - Phase 2
 *
 * Validates collection definitions.
 */

import {
  CollectionDefinition,
  ValidationResult,
  ValidationError,
  ValidationWarning,
  SchemaContext,
} from './types';
import { PropertyValidator } from './property-validator';

const RESERVED_CODES = new Set([
  'users',
  'roles',
  'groups',
  'permissions',
  'audit_logs',
  'settings',
  'collections',
  'properties',
  'views',
  'forms',
]);

const CODE_PATTERN = /^[a-z][a-z0-9_]*$/;
const MAX_CODE_LENGTH = 63;
const MAX_NAME_LENGTH = 255;
const MAX_PROPERTIES = 500;

export class CollectionValidator {
  private propertyValidator = new PropertyValidator();

  validateCollection(
    collection: CollectionDefinition,
    context?: SchemaContext
  ): ValidationResult {
    const errors: ValidationError[] = [];
    const warnings: ValidationWarning[] = [];

    this.validateCode(collection, errors, context);
    this.validateName(collection, errors);
    this.validateProperties(collection, errors, warnings, context);
    this.validateIndexes(collection, errors);

    return {
      valid: errors.length === 0,
      errors,
      warnings,
    };
  }

  private validateCode(
    collection: CollectionDefinition,
    errors: ValidationError[],
    context?: SchemaContext
  ): void {
    const { code } = collection;

    if (!code || code.trim() === '') {
      errors.push({
        path: 'code',
        code: 'REQUIRED',
        message: 'Collection code is required',
      });
      return;
    }

    if (RESERVED_CODES.has(code.toLowerCase())) {
      errors.push({
        path: 'code',
        code: 'RESERVED',
        message: `Collection code "${code}" is reserved for system use`,
        details: { reservedCodes: Array.from(RESERVED_CODES) },
      });
    }

    if (!CODE_PATTERN.test(code)) {
      errors.push({
        path: 'code',
        code: 'INVALID_FORMAT',
        message: 'Collection code must start with a letter and contain only lowercase letters, numbers, and underscores',
      });
    }

    if (code.length > MAX_CODE_LENGTH) {
      errors.push({
        path: 'code',
        code: 'TOO_LONG',
        message: `Collection code must not exceed ${MAX_CODE_LENGTH} characters`,
        details: { maxLength: MAX_CODE_LENGTH, actualLength: code.length },
      });
    }

    if (context && context.collections.has(code)) {
      errors.push({
        path: 'code',
        code: 'DUPLICATE',
        message: `Collection with code "${code}" already exists`,
      });
    }
  }

  private validateName(collection: CollectionDefinition, errors: ValidationError[]): void {
    const { name } = collection;

    if (!name || name.trim() === '') {
      errors.push({
        path: 'name',
        code: 'REQUIRED',
        message: 'Collection name is required',
      });
      return;
    }

    if (name.length > MAX_NAME_LENGTH) {
      errors.push({
        path: 'name',
        code: 'TOO_LONG',
        message: `Collection name must not exceed ${MAX_NAME_LENGTH} characters`,
        details: { maxLength: MAX_NAME_LENGTH, actualLength: name.length },
      });
    }
  }

  private validateProperties(
    collection: CollectionDefinition,
    errors: ValidationError[],
    warnings: ValidationWarning[],
    context?: SchemaContext
  ): void {
    const { properties } = collection;

    if (!properties || properties.length === 0) {
      errors.push({
        path: 'properties',
        code: 'REQUIRED',
        message: 'Collection must have at least one property',
      });
      return;
    }

    if (properties.length > MAX_PROPERTIES) {
      errors.push({
        path: 'properties',
        code: 'TOO_MANY',
        message: `Collection cannot have more than ${MAX_PROPERTIES} properties`,
        details: { maxProperties: MAX_PROPERTIES, actualCount: properties.length },
      });
    }

    const codes = new Set<string>();
    const names = new Set<string>();

    properties.forEach((property, index) => {
      if (codes.has(property.code)) {
        errors.push({
          path: `properties[${index}].code`,
          code: 'DUPLICATE',
          message: `Duplicate property code: ${property.code}`,
        });
      } else {
        codes.add(property.code);
      }

      if (names.has(property.name.toLowerCase())) {
        warnings.push({
          path: `properties[${index}].name`,
          code: 'DUPLICATE_NAME',
          message: `Duplicate property name: ${property.name}`,
          suggestion: 'Consider using unique property names for clarity',
        });
      } else {
        names.add(property.name.toLowerCase());
      }

      const propResult = this.propertyValidator.validateProperty(property, context);
      propResult.errors.forEach((error) => {
        errors.push({
          ...error,
          path: `properties[${index}].${error.path}`,
        });
      });
      propResult.warnings.forEach((warning) => {
        warnings.push({
          ...warning,
          path: `properties[${index}].${warning.path}`,
        });
      });
    });

    this.validateComputedPropertyDependencies(collection, errors);
  }

  private validateComputedPropertyDependencies(
    collection: CollectionDefinition,
    errors: ValidationError[]
  ): void {
    const propertyMap = new Map(
      collection.properties.map((p) => [p.code, p])
    );
    const computedTypes = ['formula', 'rollup', 'lookup'];

    for (const property of collection.properties) {
      if (!computedTypes.includes(property.type)) continue;

      if (property.type === 'formula' && property.config?.formula) {
        const refs = property.config.formula.match(/\{([^}]+)\}/g) || [];
        for (const ref of refs) {
          const refCode = ref.slice(1, -1);
          const refProp = propertyMap.get(refCode);
          if (refProp && computedTypes.includes(refProp.type)) {
            if (this.hasCircularDependency(property.code, refCode, propertyMap)) {
              errors.push({
                path: `properties.${property.code}.config.formula`,
                code: 'CIRCULAR_DEPENDENCY',
                message: `Circular dependency detected: ${property.code} references ${refCode}`,
              });
            }
          }
        }
      }

      if (property.type === 'lookup' && property.config?.lookupConfig) {
        const refProp = propertyMap.get(property.config.lookupConfig.referenceProperty);
        if (refProp && !['reference', 'multi_reference'].includes(refProp.type)) {
          errors.push({
            path: `properties.${property.code}.config.lookupConfig.referenceProperty`,
            code: 'INVALID_REFERENCE',
            message: `Lookup reference property "${property.config.lookupConfig.referenceProperty}" must be a reference type`,
          });
        }
      }
    }
  }

  private hasCircularDependency(
    sourceCode: string,
    targetCode: string,
    propertyMap: Map<string, { code: string; type: string; config?: { formula?: string } }>,
    visited: Set<string> = new Set()
  ): boolean {
    if (targetCode === sourceCode) return true;
    if (visited.has(targetCode)) return false;

    visited.add(targetCode);
    const targetProp = propertyMap.get(targetCode);

    if (!targetProp || targetProp.type !== 'formula' || !targetProp.config?.formula) {
      return false;
    }

    const refs = targetProp.config.formula.match(/\{([^}]+)\}/g) || [];
    for (const ref of refs) {
      const refCode = ref.slice(1, -1);
      if (this.hasCircularDependency(sourceCode, refCode, propertyMap, visited)) {
        return true;
      }
    }

    return false;
  }

  private validateIndexes(collection: CollectionDefinition, errors: ValidationError[]): void {
    const { indexes, properties } = collection;
    if (!indexes || indexes.length === 0) return;

    const propertyCodes = new Set(properties.map((p) => p.code));
    const indexNames = new Set<string>();

    indexes.forEach((index, i) => {
      if (!index.name || index.name.trim() === '') {
        errors.push({
          path: `indexes[${i}].name`,
          code: 'REQUIRED',
          message: 'Index name is required',
        });
      } else if (indexNames.has(index.name)) {
        errors.push({
          path: `indexes[${i}].name`,
          code: 'DUPLICATE',
          message: `Duplicate index name: ${index.name}`,
        });
      } else {
        indexNames.add(index.name);
      }

      if (!index.properties || index.properties.length === 0) {
        errors.push({
          path: `indexes[${i}].properties`,
          code: 'REQUIRED',
          message: 'Index must include at least one property',
        });
      } else {
        index.properties.forEach((propCode, j) => {
          if (!propertyCodes.has(propCode)) {
            errors.push({
              path: `indexes[${i}].properties[${j}]`,
              code: 'NOT_FOUND',
              message: `Index references unknown property: ${propCode}`,
            });
          }
        });
      }
    });
  }
}
