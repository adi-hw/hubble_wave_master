/**
 * DependencyService
 * HubbleWave Platform - Phase 2
 *
 * Service for managing property dependencies and calculation order.
 */

import { Injectable, Logger } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';

interface PropertyDefinition {
  code: string;
  name: string;
  type: string;
  config?: {
    formula?: string;
    rollupConfig?: {
      relationProperty: string;
      aggregation: string;
      aggregateProperty: string;
    };
    lookupConfig?: {
      referenceProperty: string;
      sourceProperty: string;
    };
  };
}

interface DependentRecord {
  collectionCode: string;
  recordId: string;
}

// Whitelist of safe SQL identifier characters
const SAFE_IDENTIFIER_REGEX = /^[a-zA-Z_][a-zA-Z0-9_]*$/;

@Injectable()
export class DependencyService {
  private readonly logger = new Logger(DependencyService.name);

  constructor(@InjectDataSource() private readonly dataSource: DataSource) {}

  /**
   * Validate SQL identifier to prevent SQL injection
   */
  private validateIdentifier(identifier: string): boolean {
    return SAFE_IDENTIFIER_REGEX.test(identifier);
  }

  /**
   * Get properties in the correct evaluation order based on dependencies
   */
  async getEvaluationOrder(
    _collectionCode: string,
    properties: PropertyDefinition[]
  ): Promise<PropertyDefinition[]> {
    const computedProps = properties.filter(
      (p) => p.type === 'formula' || p.type === 'rollup' || p.type === 'lookup'
    );

    if (computedProps.length === 0) {
      return [];
    }

    // Build dependency graph
    const dependencies = new Map<string, Set<string>>();
    for (const prop of computedProps) {
      dependencies.set(prop.code, this.extractDependencies(prop, properties));
    }

    // Topological sort
    const sorted: PropertyDefinition[] = [];
    const visited = new Set<string>();
    const visiting = new Set<string>();

    const visit = (propCode: string) => {
      if (visited.has(propCode)) return;
      if (visiting.has(propCode)) {
        throw new Error(`Circular dependency detected involving ${propCode}`);
      }

      visiting.add(propCode);

      const deps = dependencies.get(propCode) || new Set();
      for (const dep of deps) {
        if (dependencies.has(dep)) {
          visit(dep);
        }
      }

      visiting.delete(propCode);
      visited.add(propCode);

      const prop = computedProps.find((p) => p.code === propCode);
      if (prop) {
        sorted.push(prop);
      }
    };

    for (const prop of computedProps) {
      visit(prop.code);
    }

    return sorted;
  }

  /**
   * Extract dependencies from a property definition
   */
  private extractDependencies(
    prop: PropertyDefinition,
    _allProperties: PropertyDefinition[]
  ): Set<string> {
    const deps = new Set<string>();

    if (prop.type === 'formula' && prop.config?.formula) {
      // Find property references in formula
      const refs = prop.config.formula.match(/\{([^}]+)\}/g) || [];
      for (const ref of refs) {
        const propertyCode = ref.slice(1, -1);
        deps.add(propertyCode);
      }
    }

    if (prop.type === 'rollup' && prop.config?.rollupConfig) {
      deps.add(prop.config.rollupConfig.relationProperty);
    }

    if (prop.type === 'lookup' && prop.config?.lookupConfig) {
      deps.add(prop.config.lookupConfig.referenceProperty);
    }

    return deps;
  }

  /**
   * Get records that depend on a specific record (for cache invalidation)
   */
  async getDependentRecords(
    collectionCode: string,
    recordId: string
  ): Promise<DependentRecord[]> {
    const dependents: DependentRecord[] = [];

    try {
      // Find rollup and lookup properties that reference this collection
      const result = await this.dataSource.query(
        `SELECT pd.source_collection, pd.source_property, pd.dependency_type
         FROM property_dependencies pd
         WHERE pd.target_collection = $1`,
        [collectionCode]
      );

      for (const dep of result) {
        // SECURITY: Validate identifiers from database before using in query
        if (!this.validateIdentifier(dep.source_collection) || !this.validateIdentifier(dep.source_property)) {
          this.logger.warn(`SECURITY: Invalid identifier in property_dependencies: collection=${dep.source_collection}, property=${dep.source_property}`);
          continue;
        }

        // Find records in source collection that reference this record
        const records = await this.dataSource.query(
          `SELECT id FROM "${dep.source_collection}"
           WHERE "${dep.source_property}" = $1`,
          [recordId]
        );

        for (const record of records) {
          dependents.push({
            collectionCode: dep.source_collection,
            recordId: record.id,
          });
        }
      }
    } catch (error) {
      this.logger.debug(`Error finding dependents: ${(error as Error).message}`);
    }

    return dependents;
  }

  /**
   * Register property dependencies in the database
   */
  async registerDependencies(
    collectionCode: string,
    propertyCode: string,
    dependencies: Array<{
      targetCollection: string;
      targetProperty: string;
      dependencyType: 'formula' | 'rollup' | 'lookup';
    }>
  ): Promise<void> {
    // Clear existing dependencies
    await this.dataSource.query(
      `DELETE FROM property_dependencies
       WHERE source_collection = $1 AND source_property = $2`,
      [collectionCode, propertyCode]
    );

    // Insert new dependencies
    for (const dep of dependencies) {
      await this.dataSource.query(
        `INSERT INTO property_dependencies
         (source_collection, source_property, target_collection, target_property, dependency_type)
         VALUES ($1, $2, $3, $4, $5)`,
        [
          collectionCode,
          propertyCode,
          dep.targetCollection,
          dep.targetProperty,
          dep.dependencyType,
        ]
      );
    }
  }

  /**
   * Validate that adding a dependency won't create a cycle
   */
  async validateNoCycle(
    sourceCollection: string,
    sourceProperty: string,
    targetCollection: string,
    targetProperty: string
  ): Promise<boolean> {
    const visited = new Set<string>();
    const stack: string[] = [`${targetCollection}.${targetProperty}`];

    while (stack.length > 0) {
      const current = stack.pop()!;
      if (current === `${sourceCollection}.${sourceProperty}`) {
        return false; // Cycle detected
      }

      if (visited.has(current)) continue;
      visited.add(current);

      const [colCode, propCode] = current.split('.');

      try {
        const result = await this.dataSource.query(
          `SELECT target_collection, target_property
           FROM property_dependencies
           WHERE source_collection = $1 AND source_property = $2`,
          [colCode, propCode]
        );

        for (const dep of result) {
          stack.push(`${dep.target_collection}.${dep.target_property}`);
        }
      } catch {
        // Table might not exist yet
      }
    }

    return true; // No cycle
  }
}
