# Phase 2: Schema & Views - Implementation Guide

## Technical Architecture

### System Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                     Phase 2 Architecture                         │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │                    Frontend Layer                          │  │
│  │  ┌──────────────┐ ┌──────────────┐ ┌──────────────┐       │  │
│  │  │   Schema     │ │    Form      │ │    View      │       │  │
│  │  │  Designer    │ │   Builder    │ │ Configurator │       │  │
│  │  └──────────────┘ └──────────────┘ └──────────────┘       │  │
│  │  ┌──────────────┐ ┌──────────────┐ ┌──────────────┐       │  │
│  │  │   Formula    │ │ Relationship │ │   Property   │       │  │
│  │  │   Editor     │ │   Mapper     │ │   Config     │       │  │
│  │  └──────────────┘ └──────────────┘ └──────────────┘       │  │
│  └───────────────────────────────────────────────────────────┘  │
│                              │                                   │
│                              ▼                                   │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │                    API Gateway                             │  │
│  └───────────────────────────────────────────────────────────┘  │
│                              │                                   │
│       ┌──────────────────────┼──────────────────────┐           │
│       │                      │                      │           │
│       ▼                      ▼                      ▼           │
│  ┌──────────┐          ┌──────────┐          ┌──────────┐      │
│  │   svc-   │          │   svc-   │          │   svc-   │      │
│  │  schema  │◀────────▶│ formula  │◀────────▶│  view-   │      │
│  │          │          │          │          │  engine  │      │
│  └────┬─────┘          └────┬─────┘          └────┬─────┘      │
│       │                     │                     │             │
│       └─────────────────────┼─────────────────────┘             │
│                             │                                    │
│                             ▼                                    │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │                    Data Layer                              │  │
│  │  ┌──────────────┐ ┌──────────────┐ ┌──────────────┐       │  │
│  │  │  PostgreSQL  │ │    Redis     │ │ Elasticsearch│       │  │
│  │  │   (Schema)   │ │  (Formula    │ │  (Complex    │       │  │
│  │  │              │ │   Cache)     │ │   Queries)   │       │  │
│  │  └──────────────┘ └──────────────┘ └──────────────┘       │  │
│  └───────────────────────────────────────────────────────────┘  │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

---

## Advanced Property Types

### Property Type Definitions

```typescript
// libs/schema-types/src/property-types.ts

export type PropertyType =
  | 'text'
  | 'number'
  | 'date'
  | 'datetime'
  | 'boolean'
  | 'choice'
  | 'multi-choice'
  | 'reference'
  | 'multi-reference'
  | 'user'
  | 'multi-user'
  | 'attachment'
  | 'rich-text'
  | 'formula'
  | 'rollup'
  | 'lookup'
  | 'geolocation'
  | 'duration'
  | 'currency'
  | 'json'
  | 'hierarchical';

export interface PropertyDefinition {
  id: string;
  name: string;
  displayName: string;
  type: PropertyType;
  description?: string;
  required: boolean;
  unique: boolean;
  indexed: boolean;
  readonly: boolean;
  hidden: boolean;
  defaultValue?: unknown;
  validation?: ValidationRule[];
  ui: PropertyUIConfig;
  typeConfig: PropertyTypeConfig;
  dependencies?: PropertyDependency[];
  permissions?: PropertyPermissions;
}

// Type-specific configurations
export type PropertyTypeConfig =
  | TextPropertyConfig
  | NumberPropertyConfig
  | DatePropertyConfig
  | ChoicePropertyConfig
  | ReferencePropertyConfig
  | FormulaPropertyConfig
  | RollupPropertyConfig
  | LookupPropertyConfig
  | GeolocationPropertyConfig
  | DurationPropertyConfig
  | CurrencyPropertyConfig
  | JsonPropertyConfig
  | HierarchicalPropertyConfig;

export interface FormulaPropertyConfig {
  type: 'formula';
  formula: string;
  resultType: 'text' | 'number' | 'date' | 'boolean';
  dependencies: string[]; // Property names this formula depends on
  cacheStrategy: 'never' | 'on_save' | 'periodic';
  cacheTtl?: number; // In seconds, for periodic caching
}

export interface RollupPropertyConfig {
  type: 'rollup';
  sourceCollection: string;
  sourceProperty: string;
  relationshipProperty: string;
  aggregation: 'sum' | 'count' | 'avg' | 'min' | 'max' | 'concat';
  filter?: FilterCondition[];
}

export interface LookupPropertyConfig {
  type: 'lookup';
  sourceReference: string; // Reference property name
  targetProperty: string; // Property to look up from referenced record
}

export interface GeolocationPropertyConfig {
  type: 'geolocation';
  format: 'coordinates' | 'address' | 'both';
  defaultMapZoom?: number;
  geocodingEnabled: boolean;
}

export interface DurationPropertyConfig {
  type: 'duration';
  unit: 'seconds' | 'minutes' | 'hours' | 'days' | 'weeks';
  displayFormat: 'short' | 'long' | 'decimal';
  allowNegative: boolean;
}

export interface CurrencyPropertyConfig {
  type: 'currency';
  currencyProperty?: string; // Property containing currency code
  defaultCurrency: string;
  precision: number;
  allowedCurrencies?: string[];
}

export interface HierarchicalPropertyConfig {
  type: 'hierarchical';
  parentProperty: string; // Reference to same collection
  maxDepth?: number;
  orderProperty?: string; // Property for sibling ordering
}
```

### Formula System

```typescript
// libs/formula-parser/src/formula-engine.ts

export interface FormulaContext {
  record: Record<string, unknown>;
  relatedRecords: Map<string, Record<string, unknown>[]>;
  currentUser: User;
  instanceConfig: InstanceConfig;
  now: Date;
}

export interface FormulaFunction {
  name: string;
  category: 'math' | 'text' | 'date' | 'logic' | 'reference' | 'aggregate';
  description: string;
  syntax: string;
  parameters: FormulaParameter[];
  returnType: FormulaValueType;
  evaluate: (args: unknown[], context: FormulaContext) => unknown;
}

// Built-in formula functions
export const FORMULA_FUNCTIONS: FormulaFunction[] = [
  // Math functions
  {
    name: 'SUM',
    category: 'math',
    description: 'Sum of numeric values',
    syntax: 'SUM(value1, value2, ...)',
    parameters: [{ name: 'values', type: 'number', variadic: true }],
    returnType: 'number',
    evaluate: (args) => args.reduce((a: number, b: number) => a + b, 0),
  },
  {
    name: 'ROUND',
    category: 'math',
    description: 'Round to specified decimal places',
    syntax: 'ROUND(value, decimals)',
    parameters: [
      { name: 'value', type: 'number' },
      { name: 'decimals', type: 'number', default: 0 }
    ],
    returnType: 'number',
    evaluate: (args) => {
      const [value, decimals = 0] = args as [number, number];
      return Math.round(value * Math.pow(10, decimals)) / Math.pow(10, decimals);
    },
  },

  // Text functions
  {
    name: 'CONCAT',
    category: 'text',
    description: 'Concatenate text values',
    syntax: 'CONCAT(text1, text2, ...)',
    parameters: [{ name: 'texts', type: 'text', variadic: true }],
    returnType: 'text',
    evaluate: (args) => args.join(''),
  },
  {
    name: 'LEFT',
    category: 'text',
    description: 'Get leftmost characters',
    syntax: 'LEFT(text, count)',
    parameters: [
      { name: 'text', type: 'text' },
      { name: 'count', type: 'number' }
    ],
    returnType: 'text',
    evaluate: (args) => {
      const [text, count] = args as [string, number];
      return text.substring(0, count);
    },
  },

  // Date functions
  {
    name: 'TODAY',
    category: 'date',
    description: 'Current date',
    syntax: 'TODAY()',
    parameters: [],
    returnType: 'date',
    evaluate: (_, context) => new Date(context.now.toDateString()),
  },
  {
    name: 'DATEDIFF',
    category: 'date',
    description: 'Difference between dates',
    syntax: 'DATEDIFF(date1, date2, unit)',
    parameters: [
      { name: 'date1', type: 'date' },
      { name: 'date2', type: 'date' },
      { name: 'unit', type: 'text', values: ['days', 'months', 'years'] }
    ],
    returnType: 'number',
    evaluate: (args) => {
      const [date1, date2, unit] = args as [Date, Date, string];
      const diff = date2.getTime() - date1.getTime();
      switch (unit) {
        case 'days': return Math.floor(diff / (1000 * 60 * 60 * 24));
        case 'months': return Math.floor(diff / (1000 * 60 * 60 * 24 * 30));
        case 'years': return Math.floor(diff / (1000 * 60 * 60 * 24 * 365));
        default: return diff;
      }
    },
  },
  {
    name: 'DATEADD',
    category: 'date',
    description: 'Add time to a date',
    syntax: 'DATEADD(date, amount, unit)',
    parameters: [
      { name: 'date', type: 'date' },
      { name: 'amount', type: 'number' },
      { name: 'unit', type: 'text', values: ['days', 'months', 'years'] }
    ],
    returnType: 'date',
    evaluate: (args) => {
      const [date, amount, unit] = args as [Date, number, string];
      const result = new Date(date);
      switch (unit) {
        case 'days': result.setDate(result.getDate() + amount); break;
        case 'months': result.setMonth(result.getMonth() + amount); break;
        case 'years': result.setFullYear(result.getFullYear() + amount); break;
      }
      return result;
    },
  },

  // Logic functions
  {
    name: 'IF',
    category: 'logic',
    description: 'Conditional value',
    syntax: 'IF(condition, valueIfTrue, valueIfFalse)',
    parameters: [
      { name: 'condition', type: 'boolean' },
      { name: 'valueIfTrue', type: 'any' },
      { name: 'valueIfFalse', type: 'any' }
    ],
    returnType: 'any',
    evaluate: (args) => args[0] ? args[1] : args[2],
  },
  {
    name: 'SWITCH',
    category: 'logic',
    description: 'Match value to result',
    syntax: 'SWITCH(value, case1, result1, case2, result2, ..., default)',
    parameters: [
      { name: 'value', type: 'any' },
      { name: 'casePairs', type: 'any', variadic: true }
    ],
    returnType: 'any',
    evaluate: (args) => {
      const [value, ...pairs] = args;
      for (let i = 0; i < pairs.length - 1; i += 2) {
        if (value === pairs[i]) return pairs[i + 1];
      }
      return pairs.length % 2 === 1 ? pairs[pairs.length - 1] : null;
    },
  },

  // Reference functions
  {
    name: 'LOOKUP',
    category: 'reference',
    description: 'Get value from related record',
    syntax: 'LOOKUP(referenceProperty, targetProperty)',
    parameters: [
      { name: 'referenceProperty', type: 'reference' },
      { name: 'targetProperty', type: 'text' }
    ],
    returnType: 'any',
    evaluate: (args, context) => {
      const [refProp, targetProp] = args as [string, string];
      const relatedRecords = context.relatedRecords.get(refProp);
      if (relatedRecords && relatedRecords.length > 0) {
        return relatedRecords[0][targetProp];
      }
      return null;
    },
  },

  // Aggregate functions (for rollups)
  {
    name: 'COUNTIF',
    category: 'aggregate',
    description: 'Count records matching condition',
    syntax: 'COUNTIF(collection, condition)',
    parameters: [
      { name: 'collection', type: 'collection' },
      { name: 'condition', type: 'condition' }
    ],
    returnType: 'number',
    evaluate: (args, context) => {
      // Implementation handled by rollup engine
      return 0;
    },
  },
];

// Formula parser
export class FormulaParser {
  private tokens: Token[] = [];
  private position = 0;

  parse(formula: string): FormulaAST {
    this.tokens = this.tokenize(formula);
    this.position = 0;
    return this.parseExpression();
  }

  private tokenize(formula: string): Token[] {
    const tokens: Token[] = [];
    let pos = 0;

    while (pos < formula.length) {
      const char = formula[pos];

      // Skip whitespace
      if (/\s/.test(char)) {
        pos++;
        continue;
      }

      // Numbers
      if (/\d/.test(char)) {
        let num = '';
        while (pos < formula.length && /[\d.]/.test(formula[pos])) {
          num += formula[pos++];
        }
        tokens.push({ type: 'NUMBER', value: parseFloat(num) });
        continue;
      }

      // Strings
      if (char === '"' || char === "'") {
        const quote = char;
        pos++;
        let str = '';
        while (pos < formula.length && formula[pos] !== quote) {
          str += formula[pos++];
        }
        pos++; // Skip closing quote
        tokens.push({ type: 'STRING', value: str });
        continue;
      }

      // Identifiers and functions
      if (/[a-zA-Z_]/.test(char)) {
        let ident = '';
        while (pos < formula.length && /[a-zA-Z0-9_.]/.test(formula[pos])) {
          ident += formula[pos++];
        }
        tokens.push({
          type: FORMULA_FUNCTIONS.some(f => f.name === ident.toUpperCase())
            ? 'FUNCTION'
            : 'IDENTIFIER',
          value: ident
        });
        continue;
      }

      // Operators and punctuation
      const operators = ['(', ')', ',', '+', '-', '*', '/', '=', '<', '>', '!', '&', '|'];
      if (operators.includes(char)) {
        // Handle multi-character operators
        const twoChar = formula.substring(pos, pos + 2);
        if (['==', '!=', '<=', '>=', '&&', '||'].includes(twoChar)) {
          tokens.push({ type: 'OPERATOR', value: twoChar });
          pos += 2;
        } else {
          tokens.push({ type: 'OPERATOR', value: char });
          pos++;
        }
        continue;
      }

      throw new Error(`Unexpected character: ${char} at position ${pos}`);
    }

    return tokens;
  }

  private parseExpression(): FormulaAST {
    // Implement recursive descent parser
    // Returns AST node structure
    return this.parseOr();
  }

  // ... Additional parsing methods for operator precedence
}

// Formula evaluator
export class FormulaEvaluator {
  constructor(private functions: Map<string, FormulaFunction>) {}

  evaluate(ast: FormulaAST, context: FormulaContext): unknown {
    switch (ast.type) {
      case 'literal':
        return ast.value;

      case 'identifier':
        // Property reference
        return this.resolveProperty(ast.name, context);

      case 'function':
        const fn = this.functions.get(ast.name.toUpperCase());
        if (!fn) throw new Error(`Unknown function: ${ast.name}`);
        const args = ast.arguments.map(arg => this.evaluate(arg, context));
        return fn.evaluate(args, context);

      case 'binary':
        const left = this.evaluate(ast.left, context);
        const right = this.evaluate(ast.right, context);
        return this.evaluateBinaryOp(ast.operator, left, right);

      case 'unary':
        const operand = this.evaluate(ast.operand, context);
        return this.evaluateUnaryOp(ast.operator, operand);

      default:
        throw new Error(`Unknown AST node type`);
    }
  }

  private resolveProperty(path: string, context: FormulaContext): unknown {
    const parts = path.split('.');
    let value: unknown = context.record;

    for (const part of parts) {
      if (value === null || value === undefined) return null;
      value = (value as Record<string, unknown>)[part];
    }

    return value;
  }

  private evaluateBinaryOp(op: string, left: unknown, right: unknown): unknown {
    switch (op) {
      case '+':
        if (typeof left === 'string' || typeof right === 'string') {
          return String(left) + String(right);
        }
        return (left as number) + (right as number);
      case '-': return (left as number) - (right as number);
      case '*': return (left as number) * (right as number);
      case '/': return (left as number) / (right as number);
      case '==': return left === right;
      case '!=': return left !== right;
      case '<': return (left as number) < (right as number);
      case '>': return (left as number) > (right as number);
      case '<=': return (left as number) <= (right as number);
      case '>=': return (left as number) >= (right as number);
      case '&&': return Boolean(left) && Boolean(right);
      case '||': return Boolean(left) || Boolean(right);
      default: throw new Error(`Unknown operator: ${op}`);
    }
  }

  private evaluateUnaryOp(op: string, operand: unknown): unknown {
    switch (op) {
      case '-': return -(operand as number);
      case '!': return !operand;
      default: throw new Error(`Unknown operator: ${op}`);
    }
  }
}
```

---

## Schema Designer

### Schema Service

```typescript
// apps/svc-schema/src/schema.service.ts

@Injectable()
export class SchemaService {
  constructor(
    @InjectRepository(CollectionSchema)
    private schemaRepo: Repository<CollectionSchema>,
    @InjectRepository(SchemaVersion)
    private versionRepo: Repository<SchemaVersion>,
    private eventEmitter: EventEmitter2,
    private migrationService: SchemaMigrationService,
    private validationService: SchemaValidationService,
  ) {}

  async createCollection(
    instanceId: string,
    definition: CreateCollectionDto,
  ): Promise<CollectionSchema> {
    // Validate schema
    const validation = await this.validationService.validateSchema(definition);
    if (!validation.valid) {
      throw new SchemaValidationError(validation.errors);
    }

    // Create initial version
    const schema = this.schemaRepo.create({
      instanceId,
      name: definition.name,
      displayName: definition.displayName,
      description: definition.description,
      properties: definition.properties,
      relationships: definition.relationships,
      behaviors: definition.behaviors,
      version: 1,
      status: 'active',
    });

    await this.schemaRepo.save(schema);

    // Create version record
    await this.versionRepo.save({
      schemaId: schema.id,
      version: 1,
      definition: schema,
      createdBy: definition.createdBy,
      changeDescription: 'Initial creation',
    });

    // Generate database migration
    await this.migrationService.generateMigration(instanceId, schema);

    // Emit event for cache invalidation
    this.eventEmitter.emit('schema.created', { instanceId, schemaId: schema.id });

    return schema;
  }

  async updateSchema(
    instanceId: string,
    schemaId: string,
    changes: UpdateSchemaDto,
  ): Promise<CollectionSchema> {
    const currentSchema = await this.schemaRepo.findOneOrFail({
      where: { id: schemaId, instanceId },
    });

    // Validate changes against existing data
    const impact = await this.migrationService.assessImpact(
      instanceId,
      currentSchema,
      changes,
    );

    if (impact.hasBreakingChanges && !changes.forceBreaking) {
      throw new BreakingChangeError(impact.breakingChanges);
    }

    // Apply changes
    const updatedSchema = {
      ...currentSchema,
      ...changes,
      version: currentSchema.version + 1,
    };

    await this.schemaRepo.save(updatedSchema);

    // Create version record
    await this.versionRepo.save({
      schemaId: schemaId,
      version: updatedSchema.version,
      definition: updatedSchema,
      previousVersion: currentSchema.version,
      createdBy: changes.updatedBy,
      changeDescription: changes.changeDescription,
      impact: impact,
    });

    // Generate and apply migration
    const migration = await this.migrationService.generateMigration(
      instanceId,
      updatedSchema,
      currentSchema,
    );

    if (migration.requiresDataMigration) {
      // Queue background data migration
      await this.migrationService.queueDataMigration(migration);
    }

    // Emit event
    this.eventEmitter.emit('schema.updated', {
      instanceId,
      schemaId,
      version: updatedSchema.version,
    });

    return updatedSchema;
  }

  async addProperty(
    instanceId: string,
    schemaId: string,
    property: PropertyDefinition,
  ): Promise<CollectionSchema> {
    const schema = await this.schemaRepo.findOneOrFail({
      where: { id: schemaId, instanceId },
    });

    // Validate property
    const validation = await this.validationService.validateProperty(
      property,
      schema,
    );

    if (!validation.valid) {
      throw new SchemaValidationError(validation.errors);
    }

    // Check for circular dependencies in formulas
    if (property.type === 'formula') {
      const circularCheck = this.checkCircularDependencies(
        property.name,
        property.typeConfig.dependencies,
        schema.properties,
      );
      if (circularCheck.hasCircular) {
        throw new CircularDependencyError(circularCheck.chain);
      }
    }

    // Add property
    schema.properties.push(property);
    schema.version++;

    await this.schemaRepo.save(schema);

    // Generate column migration
    await this.migrationService.addColumn(instanceId, schema.name, property);

    this.eventEmitter.emit('schema.property.added', {
      instanceId,
      schemaId,
      propertyName: property.name,
    });

    return schema;
  }

  async getSchemaHistory(
    instanceId: string,
    schemaId: string,
  ): Promise<SchemaVersion[]> {
    return this.versionRepo.find({
      where: { schemaId },
      order: { version: 'DESC' },
    });
  }

  async rollbackSchema(
    instanceId: string,
    schemaId: string,
    targetVersion: number,
  ): Promise<CollectionSchema> {
    const targetVersionRecord = await this.versionRepo.findOneOrFail({
      where: { schemaId, version: targetVersion },
    });

    const currentSchema = await this.schemaRepo.findOneOrFail({
      where: { id: schemaId, instanceId },
    });

    // Generate rollback migration
    const rollbackMigration = await this.migrationService.generateRollback(
      instanceId,
      currentSchema,
      targetVersionRecord.definition,
    );

    if (rollbackMigration.dataLoss) {
      throw new DataLossError(rollbackMigration.affectedRecords);
    }

    // Apply rollback
    const rolledBackSchema = {
      ...targetVersionRecord.definition,
      version: currentSchema.version + 1,
    };

    await this.schemaRepo.save(rolledBackSchema);
    await this.migrationService.applyMigration(rollbackMigration);

    return rolledBackSchema;
  }

  private checkCircularDependencies(
    propertyName: string,
    dependencies: string[],
    allProperties: PropertyDefinition[],
    visited: Set<string> = new Set(),
    chain: string[] = [],
  ): { hasCircular: boolean; chain: string[] } {
    if (visited.has(propertyName)) {
      return { hasCircular: true, chain: [...chain, propertyName] };
    }

    visited.add(propertyName);
    chain.push(propertyName);

    for (const dep of dependencies) {
      const depProperty = allProperties.find(p => p.name === dep);
      if (depProperty?.type === 'formula') {
        const result = this.checkCircularDependencies(
          dep,
          depProperty.typeConfig.dependencies,
          allProperties,
          new Set(visited),
          [...chain],
        );
        if (result.hasCircular) return result;
      }
    }

    return { hasCircular: false, chain: [] };
  }
}
```

### Schema Migration Service

```typescript
// apps/svc-schema/src/migration.service.ts

@Injectable()
export class SchemaMigrationService {
  constructor(
    private dataSource: DataSource,
    private queueService: QueueService,
    private logger: Logger,
  ) {}

  async generateMigration(
    instanceId: string,
    newSchema: CollectionSchema,
    oldSchema?: CollectionSchema,
  ): Promise<SchemaMigration> {
    const migration: SchemaMigration = {
      id: generateId(),
      instanceId,
      collectionName: newSchema.name,
      fromVersion: oldSchema?.version,
      toVersion: newSchema.version,
      statements: [],
      requiresDataMigration: false,
      estimatedDuration: 0,
    };

    const schemaName = `tenant_${instanceId}`;
    const tableName = `records_${newSchema.name}`;

    if (!oldSchema) {
      // New collection - create table
      migration.statements.push(
        this.generateCreateTable(schemaName, tableName, newSchema.properties),
      );
    } else {
      // Schema update - generate alter statements
      const { added, removed, modified } = this.diffProperties(
        oldSchema.properties,
        newSchema.properties,
      );

      // Add new columns
      for (const prop of added) {
        migration.statements.push(
          this.generateAddColumn(schemaName, tableName, prop),
        );
      }

      // Modify existing columns
      for (const { old: oldProp, new: newProp } of modified) {
        const columnChanges = this.generateModifyColumn(
          schemaName,
          tableName,
          oldProp,
          newProp,
        );
        migration.statements.push(...columnChanges);

        if (this.requiresDataConversion(oldProp, newProp)) {
          migration.requiresDataMigration = true;
        }
      }

      // Drop removed columns (queue for later deletion)
      for (const prop of removed) {
        migration.statements.push(
          this.generateRenameColumn(
            schemaName,
            tableName,
            prop.name,
            `_deleted_${Date.now()}_${prop.name}`,
          ),
        );
      }
    }

    // Generate index statements
    for (const prop of newSchema.properties.filter(p => p.indexed)) {
      if (!oldSchema?.properties.find(p => p.name === prop.name)?.indexed) {
        migration.statements.push(
          this.generateCreateIndex(schemaName, tableName, prop),
        );
      }
    }

    return migration;
  }

  private generateCreateTable(
    schemaName: string,
    tableName: string,
    properties: PropertyDefinition[],
  ): string {
    const columns = [
      'id UUID PRIMARY KEY DEFAULT gen_random_uuid()',
      ...properties.map(p => this.propertyToColumn(p)),
      'created_at TIMESTAMPTZ DEFAULT NOW()',
      'updated_at TIMESTAMPTZ DEFAULT NOW()',
      'created_by UUID REFERENCES users(id)',
      'updated_by UUID REFERENCES users(id)',
      'deleted_at TIMESTAMPTZ',
    ];

    return `
      CREATE TABLE "${schemaName}"."${tableName}" (
        ${columns.join(',\n        ')}
      );
    `;
  }

  private propertyToColumn(prop: PropertyDefinition): string {
    const type = this.getPostgresType(prop);
    const nullable = prop.required ? 'NOT NULL' : '';
    const defaultVal = prop.defaultValue
      ? `DEFAULT ${this.formatDefault(prop.defaultValue)}`
      : '';

    return `"${prop.name}" ${type} ${nullable} ${defaultVal}`.trim();
  }

  private getPostgresType(prop: PropertyDefinition): string {
    switch (prop.type) {
      case 'text':
        const textConfig = prop.typeConfig as TextPropertyConfig;
        return textConfig.maxLength ? `VARCHAR(${textConfig.maxLength})` : 'TEXT';

      case 'rich-text':
        return 'TEXT'; // Store as HTML or Markdown

      case 'number':
        const numConfig = prop.typeConfig as NumberPropertyConfig;
        return numConfig.precision ? `NUMERIC(${numConfig.precision}, ${numConfig.scale || 0})` : 'NUMERIC';

      case 'date':
        return 'DATE';

      case 'datetime':
        return 'TIMESTAMPTZ';

      case 'boolean':
        return 'BOOLEAN';

      case 'choice':
      case 'multi-choice':
        return 'TEXT'; // Store choice ID, validate against metadata

      case 'reference':
        return 'UUID';

      case 'multi-reference':
        return 'UUID[]';

      case 'user':
        return 'UUID';

      case 'multi-user':
        return 'UUID[]';

      case 'attachment':
        return 'JSONB'; // Array of attachment metadata

      case 'formula':
        // Formula results stored based on result type
        const formulaConfig = prop.typeConfig as FormulaPropertyConfig;
        return this.getPostgresType({ type: formulaConfig.resultType } as PropertyDefinition);

      case 'rollup':
        const rollupConfig = prop.typeConfig as RollupPropertyConfig;
        return rollupConfig.aggregation === 'concat' ? 'TEXT' : 'NUMERIC';

      case 'lookup':
        return 'JSONB'; // Store looked-up value

      case 'geolocation':
        return 'GEOGRAPHY(POINT, 4326)';

      case 'duration':
        return 'INTERVAL';

      case 'currency':
        return 'JSONB'; // {amount: number, currency: string}

      case 'json':
        return 'JSONB';

      case 'hierarchical':
        return 'UUID'; // Reference to parent

      default:
        return 'TEXT';
    }
  }

  async applyMigration(migration: SchemaMigration): Promise<void> {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      for (const statement of migration.statements) {
        this.logger.debug(`Executing: ${statement}`);
        await queryRunner.query(statement);
      }

      await queryRunner.commitTransaction();
      this.logger.log(`Migration ${migration.id} applied successfully`);
    } catch (error) {
      await queryRunner.rollbackTransaction();
      this.logger.error(`Migration ${migration.id} failed: ${error.message}`);
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  async queueDataMigration(migration: SchemaMigration): Promise<void> {
    await this.queueService.addJob('schema-data-migration', {
      migrationId: migration.id,
      instanceId: migration.instanceId,
      collectionName: migration.collectionName,
    });
  }
}
```

---

## View Engine

### View Configuration Types

```typescript
// libs/view-types/src/view-config.ts

export type ViewType =
  | 'list'
  | 'card'
  | 'calendar'
  | 'kanban'
  | 'timeline'
  | 'map'
  | 'gallery'
  | 'gantt'
  | 'pivot';

export interface ViewConfiguration {
  id: string;
  name: string;
  type: ViewType;
  collectionId: string;
  isDefault: boolean;
  visibility: 'personal' | 'shared' | 'public';
  sharedWith?: string[]; // User or group IDs
  config: ViewTypeConfig;
  filters: FilterGroup;
  sorting: SortConfig[];
  grouping?: GroupingConfig;
  aggregations?: AggregationConfig[];
  conditionalFormatting?: ConditionalFormat[];
  permissions: ViewPermissions;
}

export type ViewTypeConfig =
  | ListViewConfig
  | CardViewConfig
  | CalendarViewConfig
  | KanbanViewConfig
  | TimelineViewConfig
  | MapViewConfig
  | GalleryViewConfig
  | GanttViewConfig
  | PivotViewConfig;

export interface ListViewConfig {
  type: 'list';
  columns: ColumnConfig[];
  rowHeight: 'compact' | 'default' | 'comfortable';
  showRowNumbers: boolean;
  frozenColumns: number;
  enableInlineEdit: boolean;
  showTotals: boolean;
  totalsConfig?: TotalsConfig;
}

export interface KanbanViewConfig {
  type: 'kanban';
  columnProperty: string; // Choice property to use for columns
  cardProperties: string[]; // Properties to show on cards
  cardColorProperty?: string; // Property for card color
  swimlaneProperty?: string; // Optional horizontal grouping
  wipLimits?: Record<string, number>; // Work-in-progress limits per column
  showEmptyColumns: boolean;
}

export interface CalendarViewConfig {
  type: 'calendar';
  dateProperty: string;
  endDateProperty?: string; // For events with duration
  titleProperty: string;
  colorProperty?: string;
  defaultView: 'month' | 'week' | 'day';
  showWeekNumbers: boolean;
  firstDayOfWeek: 0 | 1 | 6; // Sunday, Monday, Saturday
}

export interface TimelineViewConfig {
  type: 'timeline';
  startDateProperty: string;
  endDateProperty: string;
  titleProperty: string;
  groupProperty?: string;
  colorProperty?: string;
  milestoneProperty?: string;
  showDependencies: boolean;
  dependencyProperty?: string;
}

export interface MapViewConfig {
  type: 'map';
  locationProperty: string; // Geolocation property
  titleProperty: string;
  popupProperties: string[];
  clusterMarkers: boolean;
  mapStyle: 'standard' | 'satellite' | 'hybrid';
  defaultCenter?: [number, number];
  defaultZoom?: number;
}

export interface PivotViewConfig {
  type: 'pivot';
  rows: string[]; // Properties for row grouping
  columns: string[]; // Properties for column grouping
  values: PivotValue[];
  showTotals: boolean;
  showGrandTotals: boolean;
  expandByDefault: boolean;
}

export interface PivotValue {
  property: string;
  aggregation: 'sum' | 'count' | 'avg' | 'min' | 'max';
  format?: string;
}

// Conditional formatting
export interface ConditionalFormat {
  id: string;
  name: string;
  conditions: FilterGroup;
  style: FormatStyle;
  appliesTo: 'row' | 'cell' | string; // 'cell' applies to specific property
}

export interface FormatStyle {
  backgroundColor?: string; // Token reference, e.g., 'semantic.error.subtle'
  textColor?: string;
  fontWeight?: 'normal' | 'bold';
  fontStyle?: 'normal' | 'italic';
  icon?: string;
  iconColor?: string;
}

// Aggregations
export interface AggregationConfig {
  property: string;
  type: 'sum' | 'avg' | 'min' | 'max' | 'count' | 'countDistinct';
  label?: string;
  format?: string;
}

export interface TotalsConfig {
  position: 'top' | 'bottom' | 'both';
  properties: Record<string, AggregationConfig['type']>;
}
```

### View Rendering Service

```typescript
// apps/svc-view-engine/src/view.service.ts

@Injectable()
export class ViewService {
  constructor(
    @InjectRepository(ViewConfiguration)
    private viewRepo: Repository<ViewConfiguration>,
    private recordService: RecordService,
    private formulaService: FormulaService,
    private cacheService: CacheService,
  ) {}

  async renderView(
    instanceId: string,
    viewId: string,
    options: RenderOptions,
  ): Promise<ViewRenderResult> {
    const view = await this.getView(instanceId, viewId);
    const schema = await this.getCollectionSchema(instanceId, view.collectionId);

    // Build query from view configuration
    const query = this.buildQuery(view, options);

    // Execute query with pagination
    const { records, total } = await this.recordService.query(instanceId, query);

    // Apply formula calculations
    const enrichedRecords = await this.enrichWithFormulas(
      records,
      schema.properties.filter(p => p.type === 'formula' || p.type === 'rollup'),
      instanceId,
    );

    // Apply conditional formatting
    const formattedRecords = this.applyConditionalFormatting(
      enrichedRecords,
      view.conditionalFormatting,
    );

    // Calculate aggregations
    const aggregations = view.aggregations
      ? await this.calculateAggregations(instanceId, query, view.aggregations)
      : undefined;

    // Group records if configured
    const groupedData = view.grouping
      ? this.groupRecords(formattedRecords, view.grouping)
      : undefined;

    return {
      view,
      schema,
      records: groupedData ?? formattedRecords,
      total,
      aggregations,
      meta: {
        page: options.page,
        pageSize: options.pageSize,
        totalPages: Math.ceil(total / options.pageSize),
      },
    };
  }

  async renderPivotView(
    instanceId: string,
    viewId: string,
    options: RenderOptions,
  ): Promise<PivotRenderResult> {
    const view = await this.getView(instanceId, viewId);
    const config = view.config as PivotViewConfig;

    // Get all records (pivot needs full dataset)
    const query = this.buildQuery(view, { ...options, page: 1, pageSize: 100000 });
    const { records } = await this.recordService.query(instanceId, query);

    // Build pivot structure
    const pivotData = this.buildPivotData(records, config);

    return {
      view,
      pivotData,
      totals: config.showTotals ? this.calculatePivotTotals(pivotData, config) : undefined,
    };
  }

  private buildQuery(view: ViewConfiguration, options: RenderOptions): RecordQuery {
    return {
      collectionId: view.collectionId,
      filters: this.mergeFilters(view.filters, options.additionalFilters),
      sorting: options.sorting ?? view.sorting,
      pagination: {
        page: options.page,
        pageSize: options.pageSize,
      },
      includes: this.getRequiredIncludes(view),
    };
  }

  private async enrichWithFormulas(
    records: Record<string, unknown>[],
    formulaProperties: PropertyDefinition[],
    instanceId: string,
  ): Promise<Record<string, unknown>[]> {
    if (formulaProperties.length === 0) return records;

    // Batch calculate formulas for performance
    return Promise.all(
      records.map(async (record) => {
        const enriched = { ...record };

        for (const prop of formulaProperties) {
          if (prop.type === 'formula') {
            const config = prop.typeConfig as FormulaPropertyConfig;

            // Check cache first
            const cacheKey = `formula:${record.id}:${prop.name}`;
            const cached = await this.cacheService.get(cacheKey);

            if (cached !== undefined) {
              enriched[prop.name] = cached;
            } else {
              const result = await this.formulaService.evaluate(
                config.formula,
                {
                  record,
                  instanceId,
                },
              );
              enriched[prop.name] = result;

              // Cache if configured
              if (config.cacheStrategy !== 'never') {
                await this.cacheService.set(cacheKey, result, config.cacheTtl);
              }
            }
          } else if (prop.type === 'rollup') {
            enriched[prop.name] = await this.calculateRollup(
              record,
              prop.typeConfig as RollupPropertyConfig,
              instanceId,
            );
          }
        }

        return enriched;
      }),
    );
  }

  private applyConditionalFormatting(
    records: Record<string, unknown>[],
    formats?: ConditionalFormat[],
  ): FormattedRecord[] {
    if (!formats || formats.length === 0) {
      return records.map(r => ({ data: r, formatting: {} }));
    }

    return records.map((record) => {
      const formatting: RecordFormatting = {};

      for (const format of formats) {
        if (this.evaluateConditions(record, format.conditions)) {
          if (format.appliesTo === 'row') {
            formatting.row = format.style;
          } else if (format.appliesTo === 'cell') {
            // Apply to all cells
            formatting.cells = formatting.cells ?? {};
          } else {
            // Apply to specific property
            formatting.cells = formatting.cells ?? {};
            formatting.cells[format.appliesTo] = format.style;
          }
        }
      }

      return { data: record, formatting };
    });
  }

  private async calculateAggregations(
    instanceId: string,
    baseQuery: RecordQuery,
    aggregations: AggregationConfig[],
  ): Promise<Record<string, number>> {
    const result: Record<string, number> = {};

    // Use database aggregation for efficiency
    for (const agg of aggregations) {
      const aggregationQuery = {
        ...baseQuery,
        aggregation: {
          property: agg.property,
          type: agg.type,
        },
      };

      const value = await this.recordService.aggregate(instanceId, aggregationQuery);
      result[agg.label ?? `${agg.property}_${agg.type}`] = value;
    }

    return result;
  }

  private groupRecords(
    records: FormattedRecord[],
    grouping: GroupingConfig,
  ): GroupedRecords {
    const groups = new Map<string, FormattedRecord[]>();

    for (const record of records) {
      const groupValue = String(record.data[grouping.property] ?? 'Ungrouped');

      if (!groups.has(groupValue)) {
        groups.set(groupValue, []);
      }
      groups.get(groupValue)!.push(record);
    }

    // Sort groups
    const sortedGroups = Array.from(groups.entries())
      .sort((a, b) => {
        if (grouping.sortDirection === 'desc') {
          return b[0].localeCompare(a[0]);
        }
        return a[0].localeCompare(b[0]);
      });

    return {
      groups: sortedGroups.map(([value, items]) => ({
        value,
        count: items.length,
        records: items,
        collapsed: !grouping.expandByDefault,
      })),
    };
  }

  private buildPivotData(
    records: Record<string, unknown>[],
    config: PivotViewConfig,
  ): PivotData {
    // Build row and column hierarchies
    const rowTree = this.buildHierarchy(records, config.rows);
    const columnTree = this.buildHierarchy(records, config.columns);

    // Calculate cell values
    const cells = new Map<string, PivotCell>();

    for (const record of records) {
      const rowKey = config.rows.map(r => record[r]).join('|');
      const colKey = config.columns.map(c => record[c]).join('|');
      const cellKey = `${rowKey}::${colKey}`;

      if (!cells.has(cellKey)) {
        cells.set(cellKey, {
          rowKey,
          colKey,
          values: config.values.map(() => ({ items: [], result: 0 })),
        });
      }

      const cell = cells.get(cellKey)!;
      config.values.forEach((valueConfig, index) => {
        cell.values[index].items.push(record[valueConfig.property] as number);
      });
    }

    // Calculate aggregations for each cell
    cells.forEach((cell) => {
      cell.values.forEach((value, index) => {
        value.result = this.aggregateValues(
          value.items,
          config.values[index].aggregation,
        );
      });
    });

    return {
      rowTree,
      columnTree,
      cells: Object.fromEntries(cells),
    };
  }

  private aggregateValues(
    values: number[],
    aggregation: string,
  ): number {
    if (values.length === 0) return 0;

    switch (aggregation) {
      case 'sum':
        return values.reduce((a, b) => a + b, 0);
      case 'avg':
        return values.reduce((a, b) => a + b, 0) / values.length;
      case 'min':
        return Math.min(...values);
      case 'max':
        return Math.max(...values);
      case 'count':
        return values.length;
      default:
        return 0;
    }
  }
}
```

---

## Form Builder

### Form Configuration Types

```typescript
// libs/form-types/src/form-config.ts

export interface FormConfiguration {
  id: string;
  name: string;
  collectionId: string;
  type: 'create' | 'edit' | 'view' | 'wizard';
  layout: FormLayout;
  sections: FormSection[];
  validation: FormValidation;
  conditionalLogic: ConditionalRule[];
  permissions: FormPermissions;
  styling: FormStyling;
}

export interface FormLayout {
  type: 'single-column' | 'two-column' | 'responsive-grid';
  gridConfig?: GridConfig;
  maxWidth?: string;
  padding?: string;
}

export interface FormSection {
  id: string;
  title: string;
  description?: string;
  collapsible: boolean;
  defaultCollapsed: boolean;
  fields: FormField[];
  condition?: ConditionalRule;
  layout?: 'vertical' | 'horizontal' | 'grid';
  gridColumns?: number;
}

export interface FormField {
  id: string;
  propertyName: string;
  label: string;
  placeholder?: string;
  helpText?: string;
  required: boolean;
  readonly: boolean;
  hidden: boolean;
  width?: 'full' | 'half' | 'third' | 'quarter';
  widget?: WidgetConfig;
  validation?: FieldValidation[];
  condition?: ConditionalRule;
}

export interface WidgetConfig {
  type: string; // 'text', 'textarea', 'select', 'radio', 'checkbox', 'date', 'custom'
  options?: Record<string, unknown>;
}

export interface ConditionalRule {
  conditions: ConditionGroup;
  action: 'show' | 'hide' | 'enable' | 'disable' | 'require' | 'optional' | 'set-value';
  value?: unknown; // For 'set-value' action
}

export interface ConditionGroup {
  operator: 'and' | 'or';
  conditions: (FieldCondition | ConditionGroup)[];
}

export interface FieldCondition {
  field: string;
  operator: 'eq' | 'neq' | 'gt' | 'gte' | 'lt' | 'lte' | 'contains' | 'empty' | 'not-empty';
  value?: unknown;
}

export interface FieldValidation {
  type: 'required' | 'pattern' | 'min' | 'max' | 'minLength' | 'maxLength' | 'custom';
  value?: unknown;
  message: string;
}
```

### Form Builder Component

```tsx
// libs/ui-components/src/form-builder/FormBuilder.tsx

interface FormBuilderProps {
  configuration: FormConfiguration;
  schema: CollectionSchema;
  onSave: (config: FormConfiguration) => void;
}

export function FormBuilder({ configuration, schema, onSave }: FormBuilderProps) {
  const [config, setConfig] = useState(configuration);
  const [selectedElement, setSelectedElement] = useState<string | null>(null);
  const [previewMode, setPreviewMode] = useState(false);

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  const handleDragEnd = useCallback((event: DragEndEvent) => {
    const { active, over } = event;

    if (!over || active.id === over.id) return;

    setConfig((prev) => {
      // Handle section reordering
      if (active.data.current?.type === 'section') {
        const oldIndex = prev.sections.findIndex((s) => s.id === active.id);
        const newIndex = prev.sections.findIndex((s) => s.id === over.id);
        return {
          ...prev,
          sections: arrayMove(prev.sections, oldIndex, newIndex),
        };
      }

      // Handle field reordering
      if (active.data.current?.type === 'field') {
        // ... field reordering logic
      }

      return prev;
    });
  }, []);

  return (
    <div className="form-builder" style={formBuilderStyles}>
      {/* Toolbar */}
      <div className="form-builder__toolbar">
        <div className="form-builder__toolbar-left">
          <Button
            variant="secondary"
            onClick={() => setPreviewMode(!previewMode)}
            aria-pressed={previewMode}
          >
            {previewMode ? 'Edit' : 'Preview'}
          </Button>
        </div>
        <div className="form-builder__toolbar-right">
          <Button variant="primary" onClick={() => onSave(config)}>
            Save Form
          </Button>
        </div>
      </div>

      <div className="form-builder__content">
        {/* Property Palette */}
        <div className="form-builder__palette">
          <h3>Available Properties</h3>
          <div className="form-builder__property-list">
            {schema.properties
              .filter((p) => !isPropertyInForm(p.name, config))
              .map((prop) => (
                <DraggableProperty
                  key={prop.name}
                  property={prop}
                  onAdd={() => handleAddProperty(prop)}
                />
              ))}
          </div>

          <h3>Layout Elements</h3>
          <div className="form-builder__element-list">
            <DraggableElement type="section" label="Section" icon="section" />
            <DraggableElement type="divider" label="Divider" icon="line" />
            <DraggableElement type="text" label="Static Text" icon="text" />
            <DraggableElement type="related" label="Related Records" icon="link" />
          </div>
        </div>

        {/* Form Canvas */}
        <div className="form-builder__canvas">
          {previewMode ? (
            <FormPreview configuration={config} schema={schema} />
          ) : (
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragEnd={handleDragEnd}
            >
              <SortableContext
                items={config.sections.map((s) => s.id)}
                strategy={verticalListSortingStrategy}
              >
                {config.sections.map((section) => (
                  <SortableSection
                    key={section.id}
                    section={section}
                    schema={schema}
                    isSelected={selectedElement === section.id}
                    onSelect={() => setSelectedElement(section.id)}
                    onUpdate={(updated) => updateSection(section.id, updated)}
                    onDelete={() => deleteSection(section.id)}
                  />
                ))}
              </SortableContext>

              <button
                className="form-builder__add-section"
                onClick={handleAddSection}
              >
                + Add Section
              </button>
            </DndContext>
          )}
        </div>

        {/* Properties Panel */}
        <div className="form-builder__properties">
          {selectedElement && (
            <ElementProperties
              element={findElement(selectedElement, config)}
              schema={schema}
              onChange={(updated) => updateElement(selectedElement, updated)}
            />
          )}
        </div>
      </div>
    </div>
  );
}

const formBuilderStyles = {
  '--form-builder-palette-width': '280px',
  '--form-builder-properties-width': '320px',
  display: 'grid',
  gridTemplateRows: 'auto 1fr',
  height: '100%',
} as React.CSSProperties;
```

---

## Database Schema

### Schema Migrations

```sql
-- migrations/phase-2/001-schema-versioning.sql

-- Schema version tracking
CREATE TABLE schema_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  schema_id UUID NOT NULL REFERENCES collection_schemas(id),
  version INTEGER NOT NULL,
  definition JSONB NOT NULL,
  previous_version INTEGER,
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  change_description TEXT,
  impact JSONB,

  UNIQUE(schema_id, version)
);

CREATE INDEX idx_schema_versions_schema ON schema_versions(schema_id);

-- View configurations
CREATE TABLE view_configurations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  instance_id UUID NOT NULL,
  collection_id UUID NOT NULL REFERENCES collection_schemas(id),
  name VARCHAR(255) NOT NULL,
  type VARCHAR(50) NOT NULL,
  config JSONB NOT NULL,
  filters JSONB,
  sorting JSONB,
  grouping JSONB,
  aggregations JSONB,
  conditional_formatting JSONB,
  visibility VARCHAR(20) DEFAULT 'personal',
  shared_with UUID[],
  is_default BOOLEAN DEFAULT FALSE,
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_view_configs_instance ON view_configurations(instance_id);
CREATE INDEX idx_view_configs_collection ON view_configurations(collection_id);
CREATE INDEX idx_view_configs_creator ON view_configurations(created_by);

-- Form configurations
CREATE TABLE form_configurations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  instance_id UUID NOT NULL,
  collection_id UUID NOT NULL REFERENCES collection_schemas(id),
  name VARCHAR(255) NOT NULL,
  type VARCHAR(20) NOT NULL,
  layout JSONB NOT NULL,
  sections JSONB NOT NULL,
  validation JSONB,
  conditional_logic JSONB,
  styling JSONB,
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_form_configs_instance ON form_configurations(instance_id);
CREATE INDEX idx_form_configs_collection ON form_configurations(collection_id);

-- Formula cache
CREATE TABLE formula_cache (
  record_id UUID NOT NULL,
  property_name VARCHAR(255) NOT NULL,
  value JSONB,
  computed_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ,

  PRIMARY KEY (record_id, property_name)
);

CREATE INDEX idx_formula_cache_expires ON formula_cache(expires_at);

-- Property dependencies for change propagation
CREATE TABLE property_dependencies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  collection_id UUID NOT NULL REFERENCES collection_schemas(id),
  property_name VARCHAR(255) NOT NULL,
  depends_on_property VARCHAR(255) NOT NULL,
  depends_on_collection UUID REFERENCES collection_schemas(id),
  dependency_type VARCHAR(50) NOT NULL, -- 'formula', 'rollup', 'lookup', 'cascade'

  UNIQUE(collection_id, property_name, depends_on_property, depends_on_collection)
);

CREATE INDEX idx_prop_deps_collection ON property_dependencies(collection_id);
CREATE INDEX idx_prop_deps_target ON property_dependencies(depends_on_collection, depends_on_property);
```

---

## API Endpoints

### Schema Management

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | /api/schemas | List all collection schemas |
| POST | /api/schemas | Create new collection schema |
| GET | /api/schemas/:id | Get schema by ID |
| PUT | /api/schemas/:id | Update schema |
| DELETE | /api/schemas/:id | Delete schema (soft) |
| GET | /api/schemas/:id/versions | Get schema version history |
| POST | /api/schemas/:id/rollback | Rollback to previous version |
| POST | /api/schemas/:id/properties | Add property |
| PUT | /api/schemas/:id/properties/:prop | Update property |
| DELETE | /api/schemas/:id/properties/:prop | Remove property |
| POST | /api/schemas/:id/validate | Validate schema changes |
| GET | /api/schemas/:id/impact | Assess change impact |

### View Management

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | /api/views | List views |
| POST | /api/views | Create view |
| GET | /api/views/:id | Get view configuration |
| PUT | /api/views/:id | Update view |
| DELETE | /api/views/:id | Delete view |
| GET | /api/views/:id/render | Render view data |
| POST | /api/views/:id/export | Export view data |

### Form Management

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | /api/forms | List form configurations |
| POST | /api/forms | Create form |
| GET | /api/forms/:id | Get form configuration |
| PUT | /api/forms/:id | Update form |
| DELETE | /api/forms/:id | Delete form |
| POST | /api/forms/:id/validate | Validate form data |

---

*Document Version: 1.0*
*Phase Status: Planning*
*Last Updated: Phase 2 Planning*
