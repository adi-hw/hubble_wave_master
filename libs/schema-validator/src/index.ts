/**
 * @hubblewave/schema-validator
 *
 * Schema validation library for HubbleWave Platform. Provides comprehensive
 * validation for collection definitions, property configurations, relationships,
 * and data values.
 *
 * ## Features
 *
 * - Property type validation with full config support
 * - Collection validation with duplicate detection
 * - Relationship validation with cycle detection
 * - Data validation against property constraints
 * - Schema change impact analysis
 *
 * ## Quick Start
 *
 * ```typescript
 * import { SchemaValidatorModule, SchemaValidatorService } from '@hubblewave/schema-validator';
 *
 * @Module({
 *   imports: [SchemaValidatorModule],
 * })
 * export class AppModule {}
 *
 * // Use the service
 * @Injectable()
 * export class MyService {
 *   constructor(private validator: SchemaValidatorService) {}
 *
 *   async validateCollection(collection: CollectionDefinition) {
 *     const result = this.validator.validateCollection(collection);
 *     if (!result.valid) {
 *       throw new Error(result.errors.map(e => e.message).join(', '));
 *     }
 *   }
 * }
 * ```
 *
 * @packageDocumentation
 */

export { SchemaValidatorModule } from './lib/schema-validator.module';
export { SchemaValidatorService } from './lib/schema-validator.service';
export { CollectionValidator } from './lib/collection-validator';
export { PropertyValidator } from './lib/property-validator';
export { RelationshipValidator } from './lib/relationship-validator';
export { DataValidator } from './lib/data-validator';

export {
  PropertyType,
  AggregationType,
  ValidationResult,
  ValidationError,
  ValidationWarning,
  PropertyDefinition,
  PropertyConfig,
  ChoiceOption,
  RollupConfig,
  LookupConfig,
  HierarchyConfig,
  GeolocationConfig,
  DurationConfig,
  FileConfig,
  CollectionDefinition,
  IndexDefinition,
  RelationshipDefinition,
  SchemaContext,
} from './lib/types';
