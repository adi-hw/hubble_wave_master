/**
 * Relationship Validator
 * HubbleWave Platform - Phase 2
 *
 * Validates relationship definitions between collections.
 */

import {
  RelationshipDefinition,
  ValidationResult,
  ValidationError,
  ValidationWarning,
  SchemaContext,
} from './types';

export class RelationshipValidator {
  validateRelationship(
    relationship: RelationshipDefinition,
    context: SchemaContext
  ): ValidationResult {
    const errors: ValidationError[] = [];
    const warnings: ValidationWarning[] = [];

    this.validateName(relationship, errors);
    this.validateSourceCollection(relationship, errors, context);
    this.validateTargetCollection(relationship, errors, context);
    this.validateType(relationship, errors);
    this.validateProperties(relationship, errors, warnings, context);

    return {
      valid: errors.length === 0,
      errors,
      warnings,
    };
  }

  validateRelationships(
    relationships: RelationshipDefinition[],
    context: SchemaContext
  ): ValidationResult {
    const errors: ValidationError[] = [];
    const warnings: ValidationWarning[] = [];
    const names = new Set<string>();

    relationships.forEach((relationship, index) => {
      if (names.has(relationship.name)) {
        errors.push({
          path: `relationships[${index}].name`,
          code: 'DUPLICATE',
          message: `Duplicate relationship name: ${relationship.name}`,
        });
      } else {
        names.add(relationship.name);
      }

      const result = this.validateRelationship(relationship, context);
      result.errors.forEach((error) => {
        errors.push({
          ...error,
          path: `relationships[${index}].${error.path}`,
        });
      });
      result.warnings.forEach((warning) => {
        warnings.push({
          ...warning,
          path: `relationships[${index}].${warning.path}`,
        });
      });
    });

    this.detectCircularRelationships(relationships, errors);

    return {
      valid: errors.length === 0,
      errors,
      warnings,
    };
  }

  private validateName(
    relationship: RelationshipDefinition,
    errors: ValidationError[]
  ): void {
    if (!relationship.name || relationship.name.trim() === '') {
      errors.push({
        path: 'name',
        code: 'REQUIRED',
        message: 'Relationship name is required',
      });
    }
  }

  private validateSourceCollection(
    relationship: RelationshipDefinition,
    errors: ValidationError[],
    context: SchemaContext
  ): void {
    if (!relationship.sourceCollection) {
      errors.push({
        path: 'sourceCollection',
        code: 'REQUIRED',
        message: 'Source collection is required',
      });
      return;
    }

    if (!context.collections.has(relationship.sourceCollection)) {
      errors.push({
        path: 'sourceCollection',
        code: 'NOT_FOUND',
        message: `Source collection not found: ${relationship.sourceCollection}`,
      });
    }
  }

  private validateTargetCollection(
    relationship: RelationshipDefinition,
    errors: ValidationError[],
    context: SchemaContext
  ): void {
    if (!relationship.targetCollection) {
      errors.push({
        path: 'targetCollection',
        code: 'REQUIRED',
        message: 'Target collection is required',
      });
      return;
    }

    if (!context.collections.has(relationship.targetCollection)) {
      errors.push({
        path: 'targetCollection',
        code: 'NOT_FOUND',
        message: `Target collection not found: ${relationship.targetCollection}`,
      });
    }
  }

  private validateType(
    relationship: RelationshipDefinition,
    errors: ValidationError[]
  ): void {
    const validTypes = ['one_to_one', 'one_to_many', 'many_to_many'];
    if (!validTypes.includes(relationship.type)) {
      errors.push({
        path: 'type',
        code: 'INVALID_VALUE',
        message: `Invalid relationship type. Valid values: ${validTypes.join(', ')}`,
      });
    }
  }

  private validateProperties(
    relationship: RelationshipDefinition,
    errors: ValidationError[],
    warnings: ValidationWarning[],
    context: SchemaContext
  ): void {
    if (!relationship.sourceProperty) {
      errors.push({
        path: 'sourceProperty',
        code: 'REQUIRED',
        message: 'Source property is required',
      });
      return;
    }

    const sourceCollection = context.collections.get(relationship.sourceCollection);
    if (sourceCollection) {
      const sourceProp = sourceCollection.properties.find(
        (p) => p.code === relationship.sourceProperty
      );
      if (!sourceProp) {
        errors.push({
          path: 'sourceProperty',
          code: 'NOT_FOUND',
          message: `Source property not found in ${relationship.sourceCollection}: ${relationship.sourceProperty}`,
        });
      } else if (!['reference', 'multi_reference'].includes(sourceProp.type)) {
        errors.push({
          path: 'sourceProperty',
          code: 'INVALID_TYPE',
          message: `Source property must be a reference type, got: ${sourceProp.type}`,
        });
      }
    }

    if (relationship.targetProperty) {
      const targetCollection = context.collections.get(relationship.targetCollection);
      if (targetCollection) {
        const targetProp = targetCollection.properties.find(
          (p) => p.code === relationship.targetProperty
        );
        if (!targetProp) {
          errors.push({
            path: 'targetProperty',
            code: 'NOT_FOUND',
            message: `Target property not found in ${relationship.targetCollection}: ${relationship.targetProperty}`,
          });
        }
      }
    }

    if (relationship.onDelete) {
      const validActions = ['cascade', 'set_null', 'restrict'];
      if (!validActions.includes(relationship.onDelete)) {
        errors.push({
          path: 'onDelete',
          code: 'INVALID_VALUE',
          message: `Invalid onDelete action. Valid values: ${validActions.join(', ')}`,
        });
      }

      if (relationship.onDelete === 'cascade') {
        warnings.push({
          path: 'onDelete',
          code: 'CASCADE_WARNING',
          message: 'Cascade delete can cause unintended data loss',
          suggestion: 'Consider using set_null or restrict for safer data handling',
        });
      }
    }
  }

  private detectCircularRelationships(
    relationships: RelationshipDefinition[],
    errors: ValidationError[]
  ): void {
    const graph = new Map<string, string[]>();

    for (const rel of relationships) {
      if (!graph.has(rel.sourceCollection)) {
        graph.set(rel.sourceCollection, []);
      }
      graph.get(rel.sourceCollection)!.push(rel.targetCollection);
    }

    const visited = new Set<string>();
    const recursionStack = new Set<string>();

    const hasCycle = (node: string, path: string[]): string[] | null => {
      if (recursionStack.has(node)) {
        return [...path, node];
      }
      if (visited.has(node)) {
        return null;
      }

      visited.add(node);
      recursionStack.add(node);

      const neighbors = graph.get(node) || [];
      for (const neighbor of neighbors) {
        const cyclePath = hasCycle(neighbor, [...path, node]);
        if (cyclePath) {
          return cyclePath;
        }
      }

      recursionStack.delete(node);
      return null;
    };

    for (const node of graph.keys()) {
      const cyclePath = hasCycle(node, []);
      if (cyclePath) {
        errors.push({
          path: 'relationships',
          code: 'CIRCULAR_RELATIONSHIP',
          message: `Circular relationship detected: ${cyclePath.join(' -> ')}`,
          details: { path: cyclePath },
        });
        break;
      }
    }
  }
}
