# Phase 2: Test Plan - Schema & Views

## Testing Strategy Overview

Phase 2 testing focuses on validating the advanced schema management, formula engine, view rendering, and form builder capabilities. This includes comprehensive validation of complex property types, formula calculations, schema migrations, and dynamic view configurations.

### Testing Pyramid for Phase 2

```
                    ┌──────────────────┐
                   │  E2E Tests (8%)   │  ← Complex workflows, schema migrations
                  └──────────┬──────────┘
                 ┌───────────┴────────────┐
                │ Integration Tests (22%) │  ← Formula engine, view rendering, migrations
               └────────────┬─────────────┘
              ┌─────────────┴──────────────┐
             │   Unit Tests (70%)          │  ← Formula parser, validators, utilities
            └─────────────────────────────┘
```

### Quality Gates

| Gate | Criteria | Blocking? |
|------|----------|-----------|
| Unit Tests | > 85% coverage | Yes |
| Formula Parser Tests | 100% coverage | Yes |
| Integration Tests | All API tests pass | Yes |
| Schema Migration Tests | All scenarios pass | Yes |
| E2E Critical Paths | All pass | Yes |
| Performance Benchmarks | Meet targets | Yes |
| Formula Performance | < 100ms simple, < 1s complex | Yes |
| View Render Performance | < 500ms | Yes |
| Accessibility | Score > 95 | Yes |
| Security | No critical vulnerabilities | Yes |

---

## 1. Schema Validation Tests

### 1.1 Property Type Validation

```typescript
// libs/schema-validator/src/__tests__/property-validation.spec.ts

import { PropertyValidator } from '../property-validator';
import { PropertyDefinition } from '@hubblewave/schema-types';

describe('PropertyValidator', () => {
  let validator: PropertyValidator;

  beforeEach(() => {
    validator = new PropertyValidator();
  });

  describe('Formula Property Validation', () => {
    it('validates formula syntax', () => {
      const property: PropertyDefinition = {
        name: 'total',
        type: 'formula',
        typeConfig: {
          type: 'formula',
          formula: 'SUM(line_items.amount)',
          resultType: 'number',
          dependencies: ['line_items.amount'],
          cacheStrategy: 'on_save',
        },
      };

      const result = validator.validate(property);

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('detects invalid formula syntax', () => {
      const property: PropertyDefinition = {
        name: 'invalid',
        type: 'formula',
        typeConfig: {
          type: 'formula',
          formula: 'SUM(', // Unclosed parenthesis
          resultType: 'number',
          dependencies: [],
          cacheStrategy: 'never',
        },
      };

      const result = validator.validate(property);

      expect(result.valid).toBe(false);
      expect(result.errors).toContainEqual(
        expect.objectContaining({
          code: 'FORMULA_SYNTAX_ERROR',
          message: expect.stringContaining('Unclosed parenthesis'),
        })
      );
    });

    it('validates formula dependencies are declared', () => {
      const property: PropertyDefinition = {
        name: 'calculated',
        type: 'formula',
        typeConfig: {
          type: 'formula',
          formula: 'price * quantity', // Uses price and quantity
          resultType: 'number',
          dependencies: ['price'], // Missing quantity
          cacheStrategy: 'on_save',
        },
      };

      const result = validator.validate(property);

      expect(result.valid).toBe(false);
      expect(result.errors).toContainEqual(
        expect.objectContaining({
          code: 'MISSING_DEPENDENCY',
          message: expect.stringContaining('quantity'),
        })
      );
    });

    it('detects circular dependencies', () => {
      const properties: PropertyDefinition[] = [
        {
          name: 'field_a',
          type: 'formula',
          typeConfig: {
            type: 'formula',
            formula: 'field_b + 1',
            resultType: 'number',
            dependencies: ['field_b'],
            cacheStrategy: 'on_save',
          },
        },
        {
          name: 'field_b',
          type: 'formula',
          typeConfig: {
            type: 'formula',
            formula: 'field_c * 2',
            resultType: 'number',
            dependencies: ['field_c'],
            cacheStrategy: 'on_save',
          },
        },
        {
          name: 'field_c',
          type: 'formula',
          typeConfig: {
            type: 'formula',
            formula: 'field_a + 10', // Circular!
            resultType: 'number',
            dependencies: ['field_a'],
            cacheStrategy: 'on_save',
          },
        },
      ];

      const result = validator.validateCollection({ properties });

      expect(result.valid).toBe(false);
      expect(result.errors).toContainEqual(
        expect.objectContaining({
          code: 'CIRCULAR_DEPENDENCY',
          chain: ['field_a', 'field_b', 'field_c', 'field_a'],
        })
      );
    });

    it('validates result type matches formula output', () => {
      const property: PropertyDefinition = {
        name: 'status_text',
        type: 'formula',
        typeConfig: {
          type: 'formula',
          formula: 'IF(amount > 100, "High", "Low")', // Returns text
          resultType: 'number', // Wrong type
          dependencies: ['amount'],
          cacheStrategy: 'on_save',
        },
      };

      const result = validator.validate(property);

      expect(result.valid).toBe(false);
      expect(result.errors).toContainEqual(
        expect.objectContaining({
          code: 'TYPE_MISMATCH',
          message: expect.stringContaining('Expected number, formula returns text'),
        })
      );
    });
  });

  describe('Rollup Property Validation', () => {
    it('validates rollup configuration', () => {
      const property: PropertyDefinition = {
        name: 'total_line_items',
        type: 'rollup',
        typeConfig: {
          type: 'rollup',
          sourceCollection: 'order_items',
          sourceProperty: 'amount',
          relationshipProperty: 'order',
          aggregation: 'sum',
        },
      };

      const result = validator.validate(property);

      expect(result.valid).toBe(true);
    });

    it('validates source collection exists', () => {
      const property: PropertyDefinition = {
        name: 'total',
        type: 'rollup',
        typeConfig: {
          type: 'rollup',
          sourceCollection: 'nonexistent_collection',
          sourceProperty: 'amount',
          relationshipProperty: 'order',
          aggregation: 'sum',
        },
      };

      const result = validator.validate(property, {
        availableCollections: ['orders', 'customers'],
      });

      expect(result.valid).toBe(false);
      expect(result.errors).toContainEqual(
        expect.objectContaining({
          code: 'INVALID_COLLECTION',
          message: expect.stringContaining('nonexistent_collection'),
        })
      );
    });

    it('validates aggregation type for property type', () => {
      const property: PropertyDefinition = {
        name: 'text_sum',
        type: 'rollup',
        typeConfig: {
          type: 'rollup',
          sourceCollection: 'items',
          sourceProperty: 'description', // Text field
          relationshipProperty: 'parent',
          aggregation: 'sum', // Can't sum text
        },
      };

      const result = validator.validate(property, {
        sourceCollectionSchema: {
          properties: [
            { name: 'description', type: 'text' },
          ],
        },
      });

      expect(result.valid).toBe(false);
      expect(result.errors).toContainEqual(
        expect.objectContaining({
          code: 'INVALID_AGGREGATION',
          message: expect.stringContaining('Cannot sum text property'),
        })
      );
    });
  });

  describe('Lookup Property Validation', () => {
    it('validates lookup configuration', () => {
      const property: PropertyDefinition = {
        name: 'customer_name',
        type: 'lookup',
        typeConfig: {
          type: 'lookup',
          sourceReference: 'customer',
          targetProperty: 'name',
        },
      };

      const result = validator.validate(property, {
        collectionProperties: [
          { name: 'customer', type: 'reference', targetCollection: 'customers' },
        ],
      });

      expect(result.valid).toBe(true);
    });

    it('validates source reference exists and is reference type', () => {
      const property: PropertyDefinition = {
        name: 'lookup_field',
        type: 'lookup',
        typeConfig: {
          type: 'lookup',
          sourceReference: 'non_reference_field',
          targetProperty: 'name',
        },
      };

      const result = validator.validate(property, {
        collectionProperties: [
          { name: 'non_reference_field', type: 'text' }, // Not a reference
        ],
      });

      expect(result.valid).toBe(false);
      expect(result.errors).toContainEqual(
        expect.objectContaining({
          code: 'INVALID_REFERENCE',
          message: expect.stringContaining('must be reference type'),
        })
      );
    });
  });

  describe('Hierarchical Property Validation', () => {
    it('validates hierarchical property configuration', () => {
      const property: PropertyDefinition = {
        name: 'parent',
        type: 'hierarchical',
        typeConfig: {
          type: 'hierarchical',
          parentProperty: 'parent',
          maxDepth: 5,
          orderProperty: 'sort_order',
        },
      };

      const result = validator.validate(property);

      expect(result.valid).toBe(true);
    });

    it('prevents infinite depth', () => {
      const property: PropertyDefinition = {
        name: 'parent',
        type: 'hierarchical',
        typeConfig: {
          type: 'hierarchical',
          parentProperty: 'parent',
          maxDepth: 1000, // Too deep
        },
      };

      const result = validator.validate(property);

      expect(result.valid).toBe(false);
      expect(result.errors).toContainEqual(
        expect.objectContaining({
          code: 'INVALID_MAX_DEPTH',
          message: expect.stringContaining('Maximum depth cannot exceed 100'),
        })
      );
    });
  });

  describe('Currency Property Validation', () => {
    it('validates currency configuration', () => {
      const property: PropertyDefinition = {
        name: 'price',
        type: 'currency',
        typeConfig: {
          type: 'currency',
          defaultCurrency: 'USD',
          precision: 2,
          allowedCurrencies: ['USD', 'EUR', 'GBP'],
        },
      };

      const result = validator.validate(property);

      expect(result.valid).toBe(true);
    });

    it('validates currency codes', () => {
      const property: PropertyDefinition = {
        name: 'price',
        type: 'currency',
        typeConfig: {
          type: 'currency',
          defaultCurrency: 'INVALID',
          precision: 2,
        },
      };

      const result = validator.validate(property);

      expect(result.valid).toBe(false);
      expect(result.errors).toContainEqual(
        expect.objectContaining({
          code: 'INVALID_CURRENCY_CODE',
        })
      );
    });
  });

  describe('Geolocation Property Validation', () => {
    it('validates geolocation configuration', () => {
      const property: PropertyDefinition = {
        name: 'location',
        type: 'geolocation',
        typeConfig: {
          type: 'geolocation',
          format: 'coordinates',
          defaultMapZoom: 12,
          geocodingEnabled: true,
        },
      };

      const result = validator.validate(property);

      expect(result.valid).toBe(true);
    });
  });
});
```

### 1.2 Schema Migration Validation

```typescript
// apps/svc-schema/src/__tests__/migration-validation.spec.ts

describe('Schema Migration Validation', () => {
  let migrationService: SchemaMigrationService;
  let validationService: SchemaValidationService;

  beforeEach(() => {
    migrationService = new SchemaMigrationService();
    validationService = new SchemaValidationService();
  });

  describe('Breaking Change Detection', () => {
    it('detects property type change as breaking', async () => {
      const oldSchema = {
        properties: [
          { name: 'status', type: 'choice', choices: ['A', 'B', 'C'] },
        ],
      };

      const newSchema = {
        properties: [
          { name: 'status', type: 'text' },
        ],
      };

      const result = await validationService.validateMigration(oldSchema, newSchema);

      expect(result.hasBreakingChanges).toBe(true);
      expect(result.breakingChanges).toContainEqual(
        expect.objectContaining({
          type: 'PROPERTY_TYPE_CHANGE',
          property: 'status',
          from: 'choice',
          to: 'text',
        })
      );
    });

    it('detects property removal as breaking', async () => {
      const oldSchema = {
        properties: [
          { name: 'required_field', type: 'text', required: true },
        ],
      };

      const newSchema = {
        properties: [],
      };

      const result = await validationService.validateMigration(oldSchema, newSchema);

      expect(result.hasBreakingChanges).toBe(true);
      expect(result.breakingChanges).toContainEqual(
        expect.objectContaining({
          type: 'PROPERTY_REMOVED',
          property: 'required_field',
        })
      );
    });

    it('allows adding new optional properties', async () => {
      const oldSchema = {
        properties: [
          { name: 'existing', type: 'text' },
        ],
      };

      const newSchema = {
        properties: [
          { name: 'existing', type: 'text' },
          { name: 'new_optional', type: 'number', required: false },
        ],
      };

      const result = await validationService.validateMigration(oldSchema, newSchema);

      expect(result.hasBreakingChanges).toBe(false);
    });

    it('detects adding required property as breaking', async () => {
      const oldSchema = {
        properties: [
          { name: 'existing', type: 'text' },
        ],
      };

      const newSchema = {
        properties: [
          { name: 'existing', type: 'text' },
          { name: 'new_required', type: 'text', required: true },
        ],
      };

      const result = await validationService.validateMigration(oldSchema, newSchema);

      expect(result.hasBreakingChanges).toBe(true);
      expect(result.breakingChanges).toContainEqual(
        expect.objectContaining({
          type: 'REQUIRED_PROPERTY_ADDED',
          property: 'new_required',
          suggestion: 'Provide default value or make optional',
        })
      );
    });
  });

  describe('Data Migration Planning', () => {
    it('generates migration for property type change', async () => {
      const oldSchema = {
        name: 'orders',
        properties: [
          { name: 'amount', type: 'text' },
        ],
      };

      const newSchema = {
        name: 'orders',
        properties: [
          { name: 'amount', type: 'number' },
        ],
      };

      const migration = await migrationService.generateMigration(
        'instance-123',
        newSchema,
        oldSchema
      );

      expect(migration.requiresDataMigration).toBe(true);
      expect(migration.statements).toContainEqual(
        expect.stringContaining('ALTER COLUMN')
      );
    });

    it('estimates migration duration based on record count', async () => {
      const migration = await migrationService.estimateMigration({
        collectionName: 'orders',
        recordCount: 100000,
        changes: [
          { type: 'add_column', property: 'new_field' },
        ],
      });

      expect(migration.estimatedDuration).toBeGreaterThan(0);
      expect(migration.estimatedDuration).toBeLessThan(300000); // < 5 minutes
    });

    it('validates data conversion feasibility', async () => {
      const result = await validationService.validateDataConversion({
        property: 'amount',
        fromType: 'text',
        toType: 'number',
        sampleData: ['123', '456.78', 'invalid', '999'],
      });

      expect(result.canConvert).toBe(true);
      expect(result.conversionRate).toBe(0.75); // 3 out of 4
      expect(result.invalidRecords).toHaveLength(1);
      expect(result.invalidRecords[0]).toContain('invalid');
    });
  });

  describe('Impact Assessment', () => {
    it('identifies affected formulas', async () => {
      const schema = {
        properties: [
          { name: 'price', type: 'number' },
          {
            name: 'total',
            type: 'formula',
            typeConfig: {
              formula: 'price * quantity',
              dependencies: ['price', 'quantity'],
            },
          },
        ],
      };

      const impact = await migrationService.assessImpact(
        'instance-123',
        schema,
        { removeProperty: 'price' }
      );

      expect(impact.affectedProperties).toContainEqual(
        expect.objectContaining({
          name: 'total',
          type: 'formula',
          reason: 'Depends on removed property: price',
        })
      );
    });

    it('identifies affected views', async () => {
      const views = [
        {
          id: 'view-1',
          type: 'kanban',
          config: { columnProperty: 'status' },
        },
      ];

      const impact = await migrationService.assessImpact(
        'instance-123',
        { properties: [{ name: 'status', type: 'choice' }] },
        { changePropertyType: { name: 'status', toType: 'text' } },
        { views }
      );

      expect(impact.affectedViews).toContainEqual(
        expect.objectContaining({
          viewId: 'view-1',
          viewName: expect.any(String),
          reason: 'Kanban view requires choice property for columns',
        })
      );
    });

    it('estimates record update count', async () => {
      const impact = await migrationService.assessImpact(
        'instance-123',
        { properties: [{ name: 'status', type: 'text' }] },
        { updateProperty: { name: 'status', addValidation: true } },
        { recordCount: 50000 }
      );

      expect(impact.estimatedRecordsAffected).toBe(50000);
      expect(impact.estimatedDuration).toBeGreaterThan(0);
    });
  });
});
```

---

## 2. Formula Parser Tests

### 2.1 Formula Syntax Parsing

```typescript
// libs/formula-parser/src/__tests__/parser.spec.ts

describe('FormulaParser', () => {
  let parser: FormulaParser;

  beforeEach(() => {
    parser = new FormulaParser();
  });

  describe('Token Parsing', () => {
    it('tokenizes simple arithmetic', () => {
      const tokens = parser.tokenize('1 + 2');

      expect(tokens).toEqual([
        { type: 'NUMBER', value: 1 },
        { type: 'OPERATOR', value: '+' },
        { type: 'NUMBER', value: 2 },
      ]);
    });

    it('tokenizes function calls', () => {
      const tokens = parser.tokenize('SUM(1, 2, 3)');

      expect(tokens).toEqual([
        { type: 'FUNCTION', value: 'SUM' },
        { type: 'OPERATOR', value: '(' },
        { type: 'NUMBER', value: 1 },
        { type: 'OPERATOR', value: ',' },
        { type: 'NUMBER', value: 2 },
        { type: 'OPERATOR', value: ',' },
        { type: 'NUMBER', value: 3 },
        { type: 'OPERATOR', value: ')' },
      ]);
    });

    it('tokenizes property references', () => {
      const tokens = parser.tokenize('customer.name');

      expect(tokens).toEqual([
        { type: 'IDENTIFIER', value: 'customer.name' },
      ]);
    });

    it('tokenizes string literals', () => {
      const tokens = parser.tokenize('"Hello World"');

      expect(tokens).toEqual([
        { type: 'STRING', value: 'Hello World' },
      ]);
    });

    it('handles escaped quotes in strings', () => {
      const tokens = parser.tokenize('"Say \\"Hello\\""');

      expect(tokens).toEqual([
        { type: 'STRING', value: 'Say "Hello"' },
      ]);
    });
  });

  describe('AST Generation', () => {
    it('parses arithmetic expression', () => {
      const ast = parser.parse('1 + 2 * 3');

      expect(ast).toEqual({
        type: 'binary',
        operator: '+',
        left: { type: 'literal', value: 1 },
        right: {
          type: 'binary',
          operator: '*',
          left: { type: 'literal', value: 2 },
          right: { type: 'literal', value: 3 },
        },
      });
    });

    it('respects operator precedence', () => {
      const ast = parser.parse('1 + 2 * 3');

      // Should be: 1 + (2 * 3), not (1 + 2) * 3
      expect(ast.type).toBe('binary');
      expect(ast.operator).toBe('+');
      expect(ast.right.type).toBe('binary');
      expect(ast.right.operator).toBe('*');
    });

    it('parses function calls', () => {
      const ast = parser.parse('SUM(1, 2)');

      expect(ast).toEqual({
        type: 'function',
        name: 'SUM',
        arguments: [
          { type: 'literal', value: 1 },
          { type: 'literal', value: 2 },
        ],
      });
    });

    it('parses nested functions', () => {
      const ast = parser.parse('ROUND(SUM(1, 2), 2)');

      expect(ast).toEqual({
        type: 'function',
        name: 'ROUND',
        arguments: [
          {
            type: 'function',
            name: 'SUM',
            arguments: [
              { type: 'literal', value: 1 },
              { type: 'literal', value: 2 },
            ],
          },
          { type: 'literal', value: 2 },
        ],
      });
    });

    it('parses conditional IF statements', () => {
      const ast = parser.parse('IF(amount > 100, "High", "Low")');

      expect(ast).toEqual({
        type: 'function',
        name: 'IF',
        arguments: [
          {
            type: 'binary',
            operator: '>',
            left: { type: 'identifier', name: 'amount' },
            right: { type: 'literal', value: 100 },
          },
          { type: 'literal', value: 'High' },
          { type: 'literal', value: 'Low' },
        ],
      });
    });
  });

  describe('Error Handling', () => {
    it('throws error on unclosed parenthesis', () => {
      expect(() => parser.parse('SUM(1, 2')).toThrow('Unclosed parenthesis');
    });

    it('throws error on unexpected token', () => {
      expect(() => parser.parse('1 + + 2')).toThrow('Unexpected token');
    });

    it('throws error on invalid function name', () => {
      expect(() => parser.parse('INVALID_FUNC()')).toThrow('Unknown function');
    });

    it('provides helpful error position', () => {
      try {
        parser.parse('1 + 2 * ');
      } catch (error) {
        expect(error.position).toBe(8);
        expect(error.message).toContain('position 8');
      }
    });
  });

  describe('Edge Cases', () => {
    it('handles empty formula', () => {
      expect(() => parser.parse('')).toThrow('Empty formula');
    });

    it('handles whitespace-only formula', () => {
      expect(() => parser.parse('   ')).toThrow('Empty formula');
    });

    it('handles very long formulas', () => {
      const longFormula = 'SUM(' + Array(1000).fill('1').join(', ') + ')';

      const ast = parser.parse(longFormula);

      expect(ast.type).toBe('function');
      expect(ast.arguments).toHaveLength(1000);
    });

    it('handles deeply nested expressions', () => {
      const nested = 'IF(IF(IF(a > 1, b, c), d, e), f, g)';

      const ast = parser.parse(nested);

      expect(ast.type).toBe('function');
      expect(ast.name).toBe('IF');
      expect(ast.arguments[0].type).toBe('function');
    });
  });
});
```

### 2.2 Formula Evaluation Tests

```typescript
// libs/formula-parser/src/__tests__/evaluator.spec.ts

describe('FormulaEvaluator', () => {
  let evaluator: FormulaEvaluator;

  beforeEach(() => {
    evaluator = new FormulaEvaluator(FORMULA_FUNCTIONS);
  });

  describe('Math Functions', () => {
    it('evaluates SUM', () => {
      const result = evaluator.evaluate('SUM(1, 2, 3, 4, 5)');

      expect(result).toBe(15);
    });

    it('evaluates ROUND', () => {
      expect(evaluator.evaluate('ROUND(3.14159, 2)')).toBe(3.14);
      expect(evaluator.evaluate('ROUND(3.5)')).toBe(4);
      expect(evaluator.evaluate('ROUND(3.4)')).toBe(3);
    });

    it('evaluates MIN and MAX', () => {
      expect(evaluator.evaluate('MIN(5, 2, 8, 1)')).toBe(1);
      expect(evaluator.evaluate('MAX(5, 2, 8, 1)')).toBe(8);
    });

    it('evaluates ABS', () => {
      expect(evaluator.evaluate('ABS(-5)')).toBe(5);
      expect(evaluator.evaluate('ABS(5)')).toBe(5);
    });
  });

  describe('Text Functions', () => {
    it('evaluates CONCAT', () => {
      const result = evaluator.evaluate('CONCAT("Hello", " ", "World")');

      expect(result).toBe('Hello World');
    });

    it('evaluates LEFT and RIGHT', () => {
      expect(evaluator.evaluate('LEFT("Hello", 2)')).toBe('He');
      expect(evaluator.evaluate('RIGHT("Hello", 2)')).toBe('lo');
    });

    it('evaluates UPPER and LOWER', () => {
      expect(evaluator.evaluate('UPPER("hello")')).toBe('HELLO');
      expect(evaluator.evaluate('LOWER("HELLO")')).toBe('hello');
    });

    it('evaluates TRIM', () => {
      expect(evaluator.evaluate('TRIM("  hello  ")')).toBe('hello');
    });
  });

  describe('Date Functions', () => {
    it('evaluates TODAY', () => {
      const context = {
        now: new Date('2024-01-15'),
      };

      const result = evaluator.evaluate('TODAY()', context);

      expect(result).toEqual(new Date('2024-01-15'));
    });

    it('evaluates DATEDIFF', () => {
      const context = {
        record: {
          start_date: new Date('2024-01-01'),
          end_date: new Date('2024-01-15'),
        },
      };

      const result = evaluator.evaluate(
        'DATEDIFF(start_date, end_date, "days")',
        context
      );

      expect(result).toBe(14);
    });

    it('evaluates DATEADD', () => {
      const context = {
        record: {
          order_date: new Date('2024-01-15'),
        },
      };

      const result = evaluator.evaluate(
        'DATEADD(order_date, 7, "days")',
        context
      );

      expect(result).toEqual(new Date('2024-01-22'));
    });
  });

  describe('Logic Functions', () => {
    it('evaluates IF', () => {
      expect(evaluator.evaluate('IF(TRUE, "yes", "no")')).toBe('yes');
      expect(evaluator.evaluate('IF(FALSE, "yes", "no")')).toBe('no');
    });

    it('evaluates nested IF', () => {
      const context = {
        record: { amount: 750 },
      };

      const result = evaluator.evaluate(
        'IF(amount > 1000, "High", IF(amount > 500, "Medium", "Low"))',
        context
      );

      expect(result).toBe('Medium');
    });

    it('evaluates SWITCH', () => {
      const context = {
        record: { status: 'pending' },
      };

      const result = evaluator.evaluate(
        'SWITCH(status, "new", "New Order", "pending", "Processing", "Unknown")',
        context
      );

      expect(result).toBe('Processing');
    });

    it('evaluates AND and OR', () => {
      expect(evaluator.evaluate('AND(TRUE, TRUE)')).toBe(true);
      expect(evaluator.evaluate('AND(TRUE, FALSE)')).toBe(false);
      expect(evaluator.evaluate('OR(TRUE, FALSE)')).toBe(true);
      expect(evaluator.evaluate('OR(FALSE, FALSE)')).toBe(false);
    });
  });

  describe('Property References', () => {
    it('resolves simple property', () => {
      const context = {
        record: { price: 100 },
      };

      const result = evaluator.evaluate('price * 2', context);

      expect(result).toBe(200);
    });

    it('resolves nested property', () => {
      const context = {
        record: {
          customer: { name: 'John Doe' },
        },
      };

      const result = evaluator.evaluate('customer.name', context);

      expect(result).toBe('John Doe');
    });

    it('handles missing properties gracefully', () => {
      const context = {
        record: {},
      };

      const result = evaluator.evaluate('nonexistent_field', context);

      expect(result).toBeNull();
    });
  });

  describe('Performance', () => {
    it('evaluates simple formula in < 1ms', () => {
      const start = performance.now();

      evaluator.evaluate('1 + 2 * 3');

      const duration = performance.now() - start;

      expect(duration).toBeLessThan(1);
    });

    it('evaluates complex formula in < 100ms', () => {
      const context = {
        record: {
          items: Array(100).fill({ price: 10, quantity: 2 }),
        },
      };

      const start = performance.now();

      evaluator.evaluate(
        'SUM(items.price * items.quantity) * 1.1',
        context
      );

      const duration = performance.now() - start;

      expect(duration).toBeLessThan(100);
    });

    it('caches parsed AST', () => {
      const formula = 'SUM(1, 2, 3)';

      const start1 = performance.now();
      evaluator.evaluate(formula);
      const duration1 = performance.now() - start1;

      const start2 = performance.now();
      evaluator.evaluate(formula);
      const duration2 = performance.now() - start2;

      // Second evaluation should be faster (cached)
      expect(duration2).toBeLessThan(duration1 * 0.5);
    });
  });

  describe('Error Handling', () => {
    it('handles division by zero', () => {
      expect(() => evaluator.evaluate('10 / 0')).toThrow('Division by zero');
    });

    it('handles invalid function arguments', () => {
      expect(() => evaluator.evaluate('SUM("text")')).toThrow(
        'Expected number'
      );
    });

    it('handles type mismatches', () => {
      expect(() => evaluator.evaluate('"text" + 5')).not.toThrow();
      expect(evaluator.evaluate('"text" + 5')).toBe('text5');
    });
  });
});
```

---

## 3. View Rendering Tests

### 3.1 View Configuration Tests

```typescript
// apps/svc-view-engine/src/__tests__/view-rendering.spec.ts

describe('View Rendering', () => {
  let viewService: ViewService;
  let recordService: RecordService;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [ViewService, RecordService, FormulaService, CacheService],
    }).compile();

    viewService = module.get(ViewService);
    recordService = module.get(RecordService);
  });

  describe('List View Rendering', () => {
    it('renders list view with columns', async () => {
      const viewConfig = {
        id: 'view-1',
        type: 'list',
        config: {
          type: 'list',
          columns: [
            { property: 'name', width: 200 },
            { property: 'status', width: 100 },
            { property: 'amount', width: 120 },
          ],
        },
        filters: {},
        sorting: [{ field: 'name', direction: 'asc' }],
      };

      jest.spyOn(recordService, 'query').mockResolvedValue({
        records: [
          { id: '1', name: 'Item 1', status: 'active', amount: 100 },
          { id: '2', name: 'Item 2', status: 'pending', amount: 200 },
        ],
        total: 2,
      });

      const result = await viewService.renderView('instance-1', 'view-1', {
        page: 1,
        pageSize: 10,
      });

      expect(result.records).toHaveLength(2);
      expect(result.total).toBe(2);
      expect(result.schema).toBeDefined();
    });

    it('applies filters correctly', async () => {
      const viewConfig = {
        filters: {
          operator: 'and',
          conditions: [
            { field: 'status', operator: 'eq', value: 'active' },
            { field: 'amount', operator: 'gte', value: 100 },
          ],
        },
      };

      const querySpy = jest.spyOn(recordService, 'query');

      await viewService.renderView('instance-1', 'view-1', {
        page: 1,
        pageSize: 10,
      });

      expect(querySpy).toHaveBeenCalledWith(
        'instance-1',
        expect.objectContaining({
          filters: viewConfig.filters,
        })
      );
    });

    it('calculates aggregations', async () => {
      const viewConfig = {
        aggregations: [
          { property: 'amount', type: 'sum', label: 'Total' },
          { property: 'amount', type: 'avg', label: 'Average' },
          { property: 'id', type: 'count', label: 'Count' },
        ],
      };

      jest.spyOn(recordService, 'aggregate').mockImplementation(
        async (_, query) => {
          if (query.aggregation.type === 'sum') return 1500;
          if (query.aggregation.type === 'avg') return 300;
          if (query.aggregation.type === 'count') return 5;
        }
      );

      const result = await viewService.renderView('instance-1', 'view-1', {
        page: 1,
        pageSize: 10,
      });

      expect(result.aggregations).toEqual({
        Total: 1500,
        Average: 300,
        Count: 5,
      });
    });
  });

  describe('Conditional Formatting', () => {
    it('applies row-level formatting', async () => {
      const viewConfig = {
        conditionalFormatting: [
          {
            id: 'high-amount',
            conditions: {
              operator: 'and',
              conditions: [{ field: 'amount', operator: 'gt', value: 500 }],
            },
            style: {
              backgroundColor: 'semantic.warning.subtle',
              fontWeight: 'bold',
            },
            appliesTo: 'row',
          },
        ],
      };

      const records = [
        { id: '1', amount: 100 },
        { id: '2', amount: 600 },
      ];

      jest.spyOn(recordService, 'query').mockResolvedValue({
        records,
        total: 2,
      });

      const result = await viewService.renderView('instance-1', 'view-1', {
        page: 1,
        pageSize: 10,
      });

      expect(result.records[0].formatting.row).toBeUndefined();
      expect(result.records[1].formatting.row).toEqual({
        backgroundColor: 'semantic.warning.subtle',
        fontWeight: 'bold',
      });
    });

    it('applies cell-level formatting', async () => {
      const viewConfig = {
        conditionalFormatting: [
          {
            id: 'negative-values',
            conditions: {
              operator: 'and',
              conditions: [{ field: 'balance', operator: 'lt', value: 0 }],
            },
            style: {
              textColor: 'semantic.error.default',
            },
            appliesTo: 'balance',
          },
        ],
      };

      const records = [
        { id: '1', balance: 100 },
        { id: '2', balance: -50 },
      ];

      jest.spyOn(recordService, 'query').mockResolvedValue({
        records,
        total: 2,
      });

      const result = await viewService.renderView('instance-1', 'view-1', {
        page: 1,
        pageSize: 10,
      });

      expect(result.records[0].formatting.cells).toBeUndefined();
      expect(result.records[1].formatting.cells.balance).toEqual({
        textColor: 'semantic.error.default',
      });
    });
  });

  describe('Kanban View', () => {
    it('groups records by column property', async () => {
      const viewConfig = {
        type: 'kanban',
        config: {
          columnProperty: 'status',
          cardProperties: ['name', 'amount'],
        },
      };

      const records = [
        { id: '1', status: 'new', name: 'Task 1', amount: 100 },
        { id: '2', status: 'in_progress', name: 'Task 2', amount: 200 },
        { id: '3', status: 'new', name: 'Task 3', amount: 150 },
      ];

      jest.spyOn(recordService, 'query').mockResolvedValue({
        records,
        total: 3,
      });

      const result = await viewService.renderKanbanView('instance-1', 'view-1');

      expect(result.columns).toContainEqual(
        expect.objectContaining({
          value: 'new',
          cards: expect.arrayContaining([
            expect.objectContaining({ id: '1' }),
            expect.objectContaining({ id: '3' }),
          ]),
        })
      );
    });

    it('enforces WIP limits', async () => {
      const viewConfig = {
        config: {
          columnProperty: 'status',
          wipLimits: {
            in_progress: 2,
          },
        },
      };

      const records = Array(5).fill(null).map((_, i) => ({
        id: String(i),
        status: 'in_progress',
      }));

      jest.spyOn(recordService, 'query').mockResolvedValue({
        records,
        total: 5,
      });

      const result = await viewService.renderKanbanView('instance-1', 'view-1');

      const inProgressColumn = result.columns.find(
        (c) => c.value === 'in_progress'
      );

      expect(inProgressColumn.limitExceeded).toBe(true);
      expect(inProgressColumn.limit).toBe(2);
      expect(inProgressColumn.cards.length).toBe(5);
    });
  });

  describe('Pivot View', () => {
    it('builds pivot structure', async () => {
      const viewConfig = {
        type: 'pivot',
        config: {
          rows: ['category'],
          columns: ['status'],
          values: [
            { property: 'amount', aggregation: 'sum' },
          ],
        },
      };

      const records = [
        { category: 'A', status: 'new', amount: 100 },
        { category: 'A', status: 'done', amount: 200 },
        { category: 'B', status: 'new', amount: 150 },
        { category: 'B', status: 'done', amount: 250 },
      ];

      jest.spyOn(recordService, 'query').mockResolvedValue({
        records,
        total: 4,
      });

      const result = await viewService.renderPivotView('instance-1', 'view-1');

      expect(result.pivotData.cells).toEqual({
        'A|new': { values: [{ result: 100 }] },
        'A|done': { values: [{ result: 200 }] },
        'B|new': { values: [{ result: 150 }] },
        'B|done': { values: [{ result: 250 }] },
      });
    });

    it('calculates totals', async () => {
      const viewConfig = {
        config: {
          rows: ['category'],
          columns: ['status'],
          values: [{ property: 'amount', aggregation: 'sum' }],
          showTotals: true,
        },
      };

      const result = await viewService.renderPivotView('instance-1', 'view-1');

      expect(result.totals).toBeDefined();
      expect(result.totals.rows).toBeDefined();
      expect(result.totals.columns).toBeDefined();
      expect(result.totals.grandTotal).toBeDefined();
    });
  });

  describe('Performance', () => {
    it('renders list view in < 500ms', async () => {
      jest.spyOn(recordService, 'query').mockResolvedValue({
        records: Array(100).fill(null).map((_, i) => ({ id: String(i) })),
        total: 100,
      });

      const start = performance.now();

      await viewService.renderView('instance-1', 'view-1', {
        page: 1,
        pageSize: 100,
      });

      const duration = performance.now() - start;

      expect(duration).toBeLessThan(500);
    });

    it('caches formula results', async () => {
      const schema = {
        properties: [
          {
            name: 'calculated',
            type: 'formula',
            typeConfig: {
              formula: 'price * quantity',
              cacheStrategy: 'on_save',
            },
          },
        ],
      };

      const cacheService = {
        get: jest.fn().mockResolvedValue(100),
        set: jest.fn(),
      };

      // Formula should not be evaluated (cache hit)
      const formulaService = {
        evaluate: jest.fn(),
      };

      const result = await viewService.renderView('instance-1', 'view-1', {
        page: 1,
        pageSize: 10,
      });

      expect(formulaService.evaluate).not.toHaveBeenCalled();
      expect(cacheService.get).toHaveBeenCalled();
    });
  });
});
```

---

## 4. Form Builder Tests

### 4.1 Form Validation Tests

```typescript
// apps/svc-data/src/__tests__/form-validation.spec.ts

describe('Form Validation', () => {
  let formService: FormService;

  beforeEach(() => {
    formService = new FormService();
  });

  describe('Required Field Validation', () => {
    it('validates required fields', () => {
      const formConfig = {
        sections: [
          {
            fields: [
              { propertyName: 'name', required: true },
              { propertyName: 'email', required: true },
            ],
          },
        ],
      };

      const data = {
        name: 'John',
        // Missing email
      };

      const result = formService.validateForm(formConfig, data);

      expect(result.valid).toBe(false);
      expect(result.errors).toContainEqual(
        expect.objectContaining({
          field: 'email',
          message: 'Required',
        })
      );
    });
  });

  describe('Conditional Field Validation', () => {
    it('validates conditionally required fields', () => {
      const formConfig = {
        sections: [
          {
            fields: [
              { propertyName: 'type', required: true },
              {
                propertyName: 'details',
                required: false,
                condition: {
                  conditions: {
                    operator: 'and',
                    conditions: [
                      { field: 'type', operator: 'eq', value: 'custom' },
                    ],
                  },
                  action: 'require',
                },
              },
            ],
          },
        ],
      };

      const data = {
        type: 'custom',
        // Missing details (required when type = custom)
      };

      const result = formService.validateForm(formConfig, data);

      expect(result.valid).toBe(false);
      expect(result.errors).toContainEqual(
        expect.objectContaining({
          field: 'details',
          message: 'Required',
        })
      );
    });

    it('skips validation for hidden fields', () => {
      const formConfig = {
        sections: [
          {
            fields: [
              { propertyName: 'type', required: true },
              {
                propertyName: 'hidden_field',
                required: true,
                condition: {
                  conditions: {
                    operator: 'and',
                    conditions: [
                      { field: 'type', operator: 'eq', value: 'show' },
                    ],
                  },
                  action: 'show',
                },
              },
            ],
          },
        ],
      };

      const data = {
        type: 'hide',
        // Missing hidden_field, but it's hidden
      };

      const result = formService.validateForm(formConfig, data);

      expect(result.valid).toBe(true);
    });
  });

  describe('Custom Validation Rules', () => {
    it('validates pattern', () => {
      const formConfig = {
        sections: [
          {
            fields: [
              {
                propertyName: 'email',
                validation: [
                  {
                    type: 'pattern',
                    value: '^[^@]+@[^@]+\\.[^@]+$',
                    message: 'Invalid email format',
                  },
                ],
              },
            ],
          },
        ],
      };

      const data = {
        email: 'invalid-email',
      };

      const result = formService.validateForm(formConfig, data);

      expect(result.valid).toBe(false);
      expect(result.errors[0].message).toBe('Invalid email format');
    });

    it('validates min/max length', () => {
      const formConfig = {
        sections: [
          {
            fields: [
              {
                propertyName: 'password',
                validation: [
                  { type: 'minLength', value: 8, message: 'Too short' },
                  { type: 'maxLength', value: 20, message: 'Too long' },
                ],
              },
            ],
          },
        ],
      };

      expect(
        formService.validateForm(formConfig, { password: '123' }).valid
      ).toBe(false);

      expect(
        formService.validateForm(formConfig, {
          password: '12345678901234567890123',
        }).valid
      ).toBe(false);

      expect(
        formService.validateForm(formConfig, { password: '12345678' }).valid
      ).toBe(true);
    });

    it('validates numeric min/max', () => {
      const formConfig = {
        sections: [
          {
            fields: [
              {
                propertyName: 'age',
                validation: [
                  { type: 'min', value: 18, message: 'Must be 18+' },
                  { type: 'max', value: 100, message: 'Invalid age' },
                ],
              },
            ],
          },
        ],
      };

      expect(formService.validateForm(formConfig, { age: 17 }).valid).toBe(
        false
      );
      expect(formService.validateForm(formConfig, { age: 101 }).valid).toBe(
        false
      );
      expect(formService.validateForm(formConfig, { age: 25 }).valid).toBe(
        true
      );
    });
  });

  describe('Cross-Field Validation', () => {
    it('validates dependent fields', () => {
      const formConfig = {
        sections: [
          {
            fields: [
              { propertyName: 'start_date' },
              { propertyName: 'end_date' },
            ],
          },
        ],
        validation: {
          crossFieldRules: [
            {
              fields: ['start_date', 'end_date'],
              rule: 'end_date_after_start_date',
              message: 'End date must be after start date',
            },
          ],
        },
      };

      const data = {
        start_date: new Date('2024-01-15'),
        end_date: new Date('2024-01-10'), // Before start
      };

      const result = formService.validateForm(formConfig, data);

      expect(result.valid).toBe(false);
      expect(result.errors[0].message).toContain('after start date');
    });
  });
});
```

---

## 5. Migration Testing

### 5.1 Schema Migration E2E Tests

```typescript
// apps/svc-schema/src/__tests__/migration.e2e-spec.ts

describe('Schema Migration (E2E)', () => {
  let app: INestApplication;
  let schemaService: SchemaService;
  let migrationService: SchemaMigrationService;

  beforeAll(async () => {
    const module = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = module.createNestApplication();
    await app.init();

    schemaService = module.get(SchemaService);
    migrationService = module.get(SchemaMigrationService);
  });

  describe('Add Property Migration', () => {
    it('adds new optional property without data loss', async () => {
      // Create collection with data
      const schema = await schemaService.createCollection('instance-1', {
        name: 'test_migration',
        properties: [
          { name: 'name', type: 'text', required: true },
        ],
      });

      await createTestRecords('test_migration', 100);

      // Add new optional property
      await schemaService.addProperty('instance-1', schema.id, {
        name: 'description',
        type: 'text',
        required: false,
      });

      // Verify data intact
      const records = await queryRecords('test_migration');
      expect(records).toHaveLength(100);
      expect(records[0]).toHaveProperty('description', null);
    });

    it('adds new required property with default value', async () => {
      const schema = await schemaService.createCollection('instance-1', {
        name: 'test_with_default',
        properties: [
          { name: 'name', type: 'text' },
        ],
      });

      await createTestRecords('test_with_default', 50);

      // Add required property with default
      await schemaService.addProperty('instance-1', schema.id, {
        name: 'status',
        type: 'choice',
        required: true,
        defaultValue: 'active',
        choices: ['active', 'inactive'],
      });

      const records = await queryRecords('test_with_default');
      expect(records.every(r => r.status === 'active')).toBe(true);
    });
  });

  describe('Property Type Change Migration', () => {
    it('converts text to number', async () => {
      const schema = await schemaService.createCollection('instance-1', {
        name: 'type_conversion',
        properties: [
          { name: 'amount', type: 'text' },
        ],
      });

      await createTestRecords('type_conversion', [
        { amount: '100' },
        { amount: '200.50' },
        { amount: '300' },
      ]);

      // Convert to number
      await schemaService.updateProperty('instance-1', schema.id, 'amount', {
        type: 'number',
      });

      const records = await queryRecords('type_conversion');
      expect(typeof records[0].amount).toBe('number');
      expect(records[0].amount).toBe(100);
      expect(records[1].amount).toBe(200.5);
    });

    it('handles invalid conversions gracefully', async () => {
      const schema = await schemaService.createCollection('instance-1', {
        name: 'invalid_conversion',
        properties: [
          { name: 'value', type: 'text' },
        ],
      });

      await createTestRecords('invalid_conversion', [
        { value: '100' },
        { value: 'not a number' },
        { value: '200' },
      ]);

      const migration = await migrationService.generateMigration(
        'instance-1',
        {
          ...schema,
          properties: [
            { name: 'value', type: 'number' },
          ],
        },
        schema
      );

      expect(migration.validationWarnings).toContainEqual(
        expect.objectContaining({
          type: 'INVALID_CONVERSION',
          recordCount: 1,
          sampleValues: ['not a number'],
        })
      );
    });
  });

  describe('Formula Property Migration', () => {
    it('recalculates formulas after dependency change', async () => {
      const schema = await schemaService.createCollection('instance-1', {
        name: 'formula_test',
        properties: [
          { name: 'price', type: 'number' },
          { name: 'quantity', type: 'number' },
          {
            name: 'total',
            type: 'formula',
            typeConfig: {
              formula: 'price * quantity',
              resultType: 'number',
              dependencies: ['price', 'quantity'],
              cacheStrategy: 'on_save',
            },
          },
        ],
      });

      await createTestRecords('formula_test', [
        { price: 10, quantity: 5 },
      ]);

      // Update price
      await updateRecord('formula_test', records[0].id, {
        price: 20,
      });

      const updated = await getRecord('formula_test', records[0].id);
      expect(updated.total).toBe(100); // 20 * 5
    });

    it('handles formula property removal', async () => {
      const schema = await schemaService.createCollection('instance-1', {
        name: 'remove_formula',
        properties: [
          { name: 'base', type: 'number' },
          {
            name: 'calculated',
            type: 'formula',
            typeConfig: {
              formula: 'base * 2',
              resultType: 'number',
              dependencies: ['base'],
              cacheStrategy: 'on_save',
            },
          },
        ],
      });

      await createTestRecords('remove_formula', 10);

      // Remove formula property
      await schemaService.removeProperty(
        'instance-1',
        schema.id,
        'calculated'
      );

      const records = await queryRecords('remove_formula');
      expect(records[0]).not.toHaveProperty('calculated');
    });
  });

  describe('Rollback Migration', () => {
    it('rolls back schema to previous version', async () => {
      const schema = await schemaService.createCollection('instance-1', {
        name: 'rollback_test',
        properties: [
          { name: 'field1', type: 'text' },
        ],
      });

      const version1 = schema.version;

      // Make changes
      await schemaService.addProperty('instance-1', schema.id, {
        name: 'field2',
        type: 'number',
      });

      await schemaService.addProperty('instance-1', schema.id, {
        name: 'field3',
        type: 'date',
      });

      const currentVersion = (await schemaService.getSchema(schema.id)).version;
      expect(currentVersion).toBe(version1 + 2);

      // Rollback to version 1
      await schemaService.rollbackSchema(
        'instance-1',
        schema.id,
        version1
      );

      const rolledBack = await schemaService.getSchema(schema.id);
      expect(rolledBack.properties).toHaveLength(1);
      expect(rolledBack.properties[0].name).toBe('field1');
    });
  });
});
```

---

## 6. Performance Benchmarks

### 6.1 Formula Performance Tests

```typescript
// libs/formula-parser/src/__tests__/performance.spec.ts

describe('Formula Performance Benchmarks', () => {
  let evaluator: FormulaEvaluator;

  beforeEach(() => {
    evaluator = new FormulaEvaluator(FORMULA_FUNCTIONS);
  });

  describe('Simple Formula Performance', () => {
    it('evaluates arithmetic in < 1ms', () => {
      const iterations = 1000;

      const start = performance.now();

      for (let i = 0; i < iterations; i++) {
        evaluator.evaluate('(10 + 20) * 3 / 2');
      }

      const duration = performance.now() - start;
      const avgDuration = duration / iterations;

      expect(avgDuration).toBeLessThan(1);
    });

    it('evaluates simple IF in < 5ms', () => {
      const iterations = 1000;
      const context = { record: { amount: 100 } };

      const start = performance.now();

      for (let i = 0; i < iterations; i++) {
        evaluator.evaluate(
          'IF(amount > 50, "High", "Low")',
          context
        );
      }

      const duration = performance.now() - start;
      const avgDuration = duration / iterations;

      expect(avgDuration).toBeLessThan(5);
    });
  });

  describe('Complex Formula Performance', () => {
    it('evaluates nested functions in < 50ms', () => {
      const context = {
        record: {
          items: [
            { price: 10, quantity: 2 },
            { price: 20, quantity: 3 },
            { price: 30, quantity: 1 },
          ],
        },
      };

      const start = performance.now();

      evaluator.evaluate(
        'ROUND(SUM(items.price * items.quantity) * 1.1, 2)',
        context
      );

      const duration = performance.now() - start;

      expect(duration).toBeLessThan(50);
    });

    it('evaluates complex conditional in < 100ms', () => {
      const context = {
        record: {
          type: 'premium',
          amount: 1500,
          customer: { tier: 'gold' },
        },
      };

      const start = performance.now();

      evaluator.evaluate(
        `IF(
          AND(type == "premium", customer.tier == "gold"),
          amount * 0.85,
          IF(
            OR(type == "premium", amount > 1000),
            amount * 0.90,
            amount
          )
        )`,
        context
      );

      const duration = performance.now() - start;

      expect(duration).toBeLessThan(100);
    });
  });

  describe('Caching Performance', () => {
    it('uses cached AST for repeated evaluations', () => {
      const formula = 'SUM(1, 2, 3, 4, 5)';

      // First evaluation (no cache)
      const start1 = performance.now();
      evaluator.evaluate(formula);
      const duration1 = performance.now() - start1;

      // Subsequent evaluations (cached)
      const start2 = performance.now();
      for (let i = 0; i < 100; i++) {
        evaluator.evaluate(formula);
      }
      const duration2 = performance.now() - start2;
      const avgCached = duration2 / 100;

      // Cached should be at least 2x faster
      expect(avgCached).toBeLessThan(duration1 * 0.5);
    });
  });

  describe('Large Dataset Performance', () => {
    it('handles 1000+ records in < 1s', () => {
      const records = Array(1000).fill(null).map((_, i) => ({
        price: i * 10,
        quantity: i % 10 + 1,
      }));

      const start = performance.now();

      const totals = records.map(record =>
        evaluator.evaluate('price * quantity * 1.1', { record })
      );

      const duration = performance.now() - start;

      expect(duration).toBeLessThan(1000);
      expect(totals).toHaveLength(1000);
    });
  });
});
```

### 6.2 View Rendering Performance

```typescript
// apps/svc-view-engine/src/__tests__/view-performance.spec.ts

describe('View Rendering Performance', () => {
  let viewService: ViewService;

  describe('List View Performance', () => {
    it('renders 100 records with formulas in < 500ms', async () => {
      const records = Array(100).fill(null).map((_, i) => ({
        id: String(i),
        price: i * 10,
        quantity: i % 10 + 1,
      }));

      const schema = {
        properties: [
          { name: 'price', type: 'number' },
          { name: 'quantity', type: 'number' },
          {
            name: 'total',
            type: 'formula',
            typeConfig: {
              formula: 'price * quantity',
              resultType: 'number',
              cacheStrategy: 'on_save',
            },
          },
        ],
      };

      jest.spyOn(recordService, 'query').mockResolvedValue({
        records,
        total: 100,
      });

      const start = performance.now();

      await viewService.renderView('instance-1', 'view-1', {
        page: 1,
        pageSize: 100,
      });

      const duration = performance.now() - start;

      expect(duration).toBeLessThan(500);
    });

    it('renders aggregations efficiently', async () => {
      const viewConfig = {
        aggregations: [
          { property: 'amount', type: 'sum' },
          { property: 'amount', type: 'avg' },
          { property: 'amount', type: 'min' },
          { property: 'amount', type: 'max' },
          { property: 'id', type: 'count' },
        ],
      };

      const start = performance.now();

      await viewService.renderView('instance-1', 'view-1', {
        page: 1,
        pageSize: 10,
      });

      const duration = performance.now() - start;

      expect(duration).toBeLessThan(300);
    });
  });

  describe('Pivot View Performance', () => {
    it('builds pivot from 1000 records in < 2s', async () => {
      const records = [];
      const categories = ['A', 'B', 'C', 'D', 'E'];
      const statuses = ['new', 'active', 'done'];

      for (let i = 0; i < 1000; i++) {
        records.push({
          category: categories[i % categories.length],
          status: statuses[i % statuses.length],
          amount: Math.random() * 1000,
        });
      }

      jest.spyOn(recordService, 'query').mockResolvedValue({
        records,
        total: 1000,
      });

      const start = performance.now();

      await viewService.renderPivotView('instance-1', 'view-1');

      const duration = performance.now() - start;

      expect(duration).toBeLessThan(2000);
    });
  });
});
```

---

## 7. End-to-End Test Scenarios

### 7.1 Complete Schema Workflow

```typescript
// apps/web-client-e2e/src/schema-workflow.spec.ts

import { test, expect } from '@playwright/test';

test.describe('Schema Management E2E', () => {
  test('create collection with advanced properties', async ({ page }) => {
    await loginAsAdmin(page);
    await page.goto('/admin/schema');

    // Create collection
    await page.click('[data-testid=new-collection]');
    await page.fill('[data-testid=collection-name]', 'project_tasks');
    await page.fill('[data-testid=collection-label]', 'Project Tasks');

    // Add basic properties
    await page.click('[data-testid=add-property]');
    await page.fill('[data-testid=property-name]', 'title');
    await page.selectOption('[data-testid=property-type]', 'text');
    await page.check('[data-testid=property-required]');
    await page.click('[data-testid=save-property]');

    // Add reference property
    await page.click('[data-testid=add-property]');
    await page.fill('[data-testid=property-name]', 'project');
    await page.selectOption('[data-testid=property-type]', 'reference');
    await page.selectOption('[data-testid=target-collection]', 'projects');
    await page.click('[data-testid=save-property]');

    // Add formula property
    await page.click('[data-testid=add-property]');
    await page.fill('[data-testid=property-name]', 'days_open');
    await page.selectOption('[data-testid=property-type]', 'formula');

    // Use AVA to generate formula
    await page.click('[data-testid=ava-assist-button]');
    await page.fill(
      '[data-testid=ava-input]',
      'Calculate days between created date and today'
    );
    await page.click('[data-testid=generate-formula]');

    // Wait for AVA suggestion
    await expect(page.locator('[data-testid=formula-suggestion]')).toBeVisible();
    await page.click('[data-testid=use-formula]');

    await page.click('[data-testid=save-property]');

    // Save collection
    await page.click('[data-testid=create-collection]');

    // Verify success
    await expect(page.locator('[data-testid=success-toast]')).toHaveText(
      /Collection created/
    );
  });

  test('modify schema with migration', async ({ page }) => {
    await loginAsAdmin(page);
    await page.goto('/admin/schema/project_tasks');

    // Add new required property with default
    await page.click('[data-testid=add-property]');
    await page.fill('[data-testid=property-name]', 'priority');
    await page.selectOption('[data-testid=property-type]', 'choice');
    await page.check('[data-testid=property-required]');

    // Set default value
    await page.fill('[data-testid=default-value]', 'Medium');

    // Add choices
    await page.click('[data-testid=add-choice]');
    await page.fill('[data-testid=choice-0]', 'Low');
    await page.click('[data-testid=add-choice]');
    await page.fill('[data-testid=choice-1]', 'Medium');
    await page.click('[data-testid=add-choice]');
    await page.fill('[data-testid=choice-2]', 'High');

    await page.click('[data-testid=save-property]');

    // Check impact assessment
    await expect(page.locator('[data-testid=impact-summary]')).toContainText(
      /0 breaking changes/
    );
    await expect(page.locator('[data-testid=affected-records]')).toContainText(
      /will receive default value/
    );

    // Apply migration
    await page.click('[data-testid=apply-migration]');

    await expect(page.locator('[data-testid=migration-success]')).toBeVisible();
  });
});

test.describe('View Configuration E2E', () => {
  test('create and configure kanban view', async ({ page }) => {
    await loginAsUser(page);
    await page.goto('/collections/project_tasks');

    // Create new view
    await page.click('[data-testid=new-view]');
    await page.selectOption('[data-testid=view-type]', 'kanban');

    // Configure kanban
    await page.fill('[data-testid=view-name]', 'Task Board');
    await page.selectOption('[data-testid=column-property]', 'status');

    // Select card properties
    await page.check('[data-testid=card-property-title]');
    await page.check('[data-testid=card-property-priority]');
    await page.check('[data-testid=card-property-assignee]');

    // Set WIP limits
    await page.fill('[data-testid=wip-limit-in_progress]', '5');
    await page.fill('[data-testid=wip-limit-review]', '3');

    // Save view
    await page.click('[data-testid=save-view]');

    // Verify kanban board
    await expect(page.locator('[data-testid=kanban-board]')).toBeVisible();
    await expect(page.locator('[data-testid=kanban-column-new]')).toBeVisible();

    // Test drag and drop
    const card = page.locator('[data-testid=kanban-card-1]');
    const targetColumn = page.locator('[data-testid=kanban-column-in_progress]');

    await card.dragTo(targetColumn);

    // Verify status updated
    await expect(card).toHaveAttribute('data-status', 'in_progress');
  });

  test('create pivot table view', async ({ page }) => {
    await loginAsUser(page);
    await page.goto('/collections/sales');

    await page.click('[data-testid=new-view]');
    await page.selectOption('[data-testid=view-type]', 'pivot');

    // Configure pivot
    await page.fill('[data-testid=view-name]', 'Sales Analysis');

    // Row grouping
    await page.selectOption('[data-testid=add-row-group]', 'region');
    await page.selectOption('[data-testid=add-row-group]', 'product_category');

    // Column grouping
    await page.selectOption('[data-testid=add-column-group]', 'quarter');

    // Values
    await page.click('[data-testid=add-value]');
    await page.selectOption('[data-testid=value-property-0]', 'revenue');
    await page.selectOption('[data-testid=value-aggregation-0]', 'sum');

    await page.click('[data-testid=add-value]');
    await page.selectOption('[data-testid=value-property-1]', 'units_sold');
    await page.selectOption('[data-testid=value-aggregation-1]', 'sum');

    // Options
    await page.check('[data-testid=show-totals]');
    await page.check('[data-testid=show-grand-total]');

    await page.click('[data-testid=save-view]');

    // Verify pivot table
    await expect(page.locator('[data-testid=pivot-table]')).toBeVisible();
    await expect(page.locator('[data-testid=pivot-grand-total]')).toBeVisible();
  });
});
```

---

## 8. Test Data Management

### 8.1 Test Data Factory for Phase 2

```typescript
// apps/web-client-e2e/src/support/phase2-test-data.ts

export class Phase2TestDataFactory {
  async createCollectionWithFormulas(
    name: string,
    properties: PropertyDefinition[]
  ): Promise<Collection> {
    return this.api.post('/api/test/collections/with-formulas', {
      name,
      properties,
    });
  }

  async createTestViewConfiguration(
    collectionId: string,
    viewType: ViewType
  ): Promise<ViewConfiguration> {
    return this.api.post('/api/test/views', {
      collectionId,
      type: viewType,
      config: this.getDefaultViewConfig(viewType),
    });
  }

  async createTestFormConfiguration(
    collectionId: string
  ): Promise<FormConfiguration> {
    return this.api.post('/api/test/forms', {
      collectionId,
      sections: [
        {
          title: 'Main Information',
          fields: [
            { propertyName: 'name', required: true },
            { propertyName: 'description', required: false },
          ],
        },
      ],
    });
  }

  async seedFormulaTestData(
    collectionName: string,
    count: number
  ): Promise<void> {
    const records = Array.from({ length: count }, (_, i) => ({
      base_value: i * 10,
      multiplier: i % 5 + 1,
    }));

    await this.api.post(`/api/test/records/${collectionName}/bulk`, {
      records,
    });
  }

  async cleanupFormulas(instanceId: string): Promise<void> {
    await this.api.delete(`/api/test/formulas/${instanceId}`);
  }

  private getDefaultViewConfig(viewType: ViewType): ViewTypeConfig {
    switch (viewType) {
      case 'list':
        return {
          type: 'list',
          columns: [],
          rowHeight: 'default',
          showRowNumbers: true,
        };
      case 'kanban':
        return {
          type: 'kanban',
          columnProperty: 'status',
          cardProperties: [],
          showEmptyColumns: true,
        };
      case 'pivot':
        return {
          type: 'pivot',
          rows: [],
          columns: [],
          values: [],
          showTotals: true,
        };
      default:
        throw new Error(`Unsupported view type: ${viewType}`);
    }
  }
}
```

---

## 9. Test Execution Plan

### 9.1 Local Development Testing

```bash
# Unit tests
npm run test

# Unit tests with coverage
npm run test:cov

# Watch mode for development
npm run test:watch

# Specific test suite
npm run test -- formula-parser

# Integration tests
npm run test:integration

# E2E tests
npm run test:e2e

# Performance benchmarks
npm run test:performance
```

### 9.2 CI/CD Testing Pipeline

```yaml
# .github/workflows/phase2-tests.yml

name: Phase 2 Tests

on:
  pull_request:
    paths:
      - 'libs/formula-parser/**'
      - 'libs/schema-validator/**'
      - 'apps/svc-schema/**'
      - 'apps/svc-view-engine/**'

jobs:
  unit-tests:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
      - run: npm ci
      - run: npm run test:cov
      - run: npm run test:upload-coverage

  formula-tests:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
      - run: npm ci
      - run: npm run test -- libs/formula-parser
      - name: Check formula coverage
        run: |
          if [ $(cat coverage/formula-parser/coverage-summary.json | jq '.total.lines.pct') -lt 100 ]; then
            echo "Formula parser must have 100% coverage"
            exit 1
          fi

  migration-tests:
    runs-on: ubuntu-latest
    services:
      postgres:
        image: postgis/postgis:15
        env:
          POSTGRES_PASSWORD: postgres
        options: >-
          --health-cmd pg_isready
          --health-interval 10s
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
      - run: npm ci
      - run: npm run test:migration
      - name: Verify no data loss
        run: npm run test:migration:verify

  performance-tests:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
      - run: npm ci
      - run: npm run test:performance
      - name: Check performance benchmarks
        run: |
          npm run test:performance:check-thresholds

  e2e-tests:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
      - run: npm ci
      - run: npx playwright install --with-deps
      - run: npm run test:e2e
      - uses: actions/upload-artifact@v3
        if: failure()
        with:
          name: playwright-screenshots
          path: apps/web-client-e2e/screenshots/
```

---

## 10. Success Metrics

### Test Coverage Targets

| Component | Target Coverage | Current |
|-----------|----------------|---------|
| Formula Parser | 100% | - |
| Schema Validator | > 90% | - |
| Migration Service | > 85% | - |
| View Service | > 80% | - |
| Form Service | > 85% | - |

### Performance Targets

| Operation | Target | Acceptable |
|-----------|--------|-----------|
| Simple Formula Eval | < 1ms | < 5ms |
| Complex Formula Eval | < 100ms | < 500ms |
| View Render (100 records) | < 300ms | < 500ms |
| Schema Migration | < 30s | < 60s |
| Pivot Build (1000 records) | < 1s | < 2s |

---

*Document Version: 1.0*
*Phase Status: Planning*
*Last Updated: Phase 2 Planning*
