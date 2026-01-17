/**
 * Schema Provider Interface
 *
 * Abstraction for schema metadata access.
 */

/**
 * Property schema
 */
export interface PropertySchema {
  code: string;
  name: string;
  typeCode: string;
  isRequired: boolean;
  isUnique: boolean;
  typeConfig?: Record<string, unknown>;
}

/**
 * Reference property configuration
 */
export interface ReferenceConfig {
  targetCollection: string;
  displayProperty?: string;
  cascadeDelete?: boolean;
  cascadeUpdate?: boolean;
}

/**
 * Collection schema
 */
export interface CollectionSchema {
  code: string;
  name: string;
  tableName: string;
  properties: PropertySchema[];
  primaryKey: string;
}

/**
 * Schema provider interface
 */
export interface SchemaProvider {
  /**
   * Get collection schema
   */
  getCollection(code: string): Promise<CollectionSchema | null>;

  /**
   * Get property schema
   */
  getProperty(collectionCode: string, propertyCode: string): Promise<PropertySchema | null>;

  /**
   * Get all reference properties for a collection
   */
  getReferenceProperties(collectionCode: string): Promise<PropertySchema[]>;

  /**
   * Get reference configuration for a property
   */
  getReferenceConfig(collectionCode: string, propertyCode: string): Promise<ReferenceConfig | null>;

  /**
   * Get collections that reference a given collection
   */
  getReferencingCollections(collectionCode: string): Promise<Array<{
    collection: string;
    property: string;
  }>>;

  /**
   * Check if a property exists
   */
  hasProperty(collectionCode: string, propertyCode: string): Promise<boolean>;

  /**
   * Get property type
   */
  getPropertyType(collectionCode: string, propertyCode: string): Promise<string | null>;
}

/**
 * In-memory schema provider for testing
 */
export class InMemorySchemaProvider implements SchemaProvider {
  private schemas: Map<string, CollectionSchema> = new Map();
  private referenceConfigs: Map<string, ReferenceConfig> = new Map();

  /**
   * Register a collection schema
   */
  register(schema: CollectionSchema): void {
    this.schemas.set(schema.code, schema);
  }

  /**
   * Register a reference configuration
   */
  registerReference(collectionCode: string, propertyCode: string, config: ReferenceConfig): void {
    const key = `${collectionCode}.${propertyCode}`;
    this.referenceConfigs.set(key, config);
  }

  async getCollection(code: string): Promise<CollectionSchema | null> {
    return this.schemas.get(code) ?? null;
  }

  async getProperty(collectionCode: string, propertyCode: string): Promise<PropertySchema | null> {
    const collection = this.schemas.get(collectionCode);
    if (!collection) return null;
    return collection.properties.find((p) => p.code === propertyCode) ?? null;
  }

  async getReferenceProperties(collectionCode: string): Promise<PropertySchema[]> {
    const collection = this.schemas.get(collectionCode);
    if (!collection) return [];
    return collection.properties.filter(
      (p) => p.typeCode === 'reference' || p.typeCode === 'multi_reference'
    );
  }

  async getReferenceConfig(collectionCode: string, propertyCode: string): Promise<ReferenceConfig | null> {
    const key = `${collectionCode}.${propertyCode}`;
    return this.referenceConfigs.get(key) ?? null;
  }

  async getReferencingCollections(collectionCode: string): Promise<Array<{ collection: string; property: string }>> {
    const results: Array<{ collection: string; property: string }> = [];

    for (const [key, config] of this.referenceConfigs) {
      if (config.targetCollection === collectionCode) {
        const [collection, property] = key.split('.');
        results.push({ collection, property });
      }
    }

    return results;
  }

  async hasProperty(collectionCode: string, propertyCode: string): Promise<boolean> {
    const property = await this.getProperty(collectionCode, propertyCode);
    return property !== null;
  }

  async getPropertyType(collectionCode: string, propertyCode: string): Promise<string | null> {
    const property = await this.getProperty(collectionCode, propertyCode);
    return property?.typeCode ?? null;
  }
}
