/**
 * Formula Validator
 *
 * Validates formula syntax, type compatibility, and dependency resolution.
 */

import {
  ASTNode,
  ASTNodeType,
  FunctionCallNode,
  PropertyRefNode,
  BinaryExprNode,
  LogicalExprNode,
} from './parser';
import { FunctionRegistry } from './function-registry';
import { FormulaValueType, DependencyAnalysis, SourceRange } from './types';
import { CollectionMetadata } from './context';

/**
 * Validation error severity
 */
export type ValidationSeverity = 'error' | 'warning' | 'info';

/**
 * A single validation error
 */
export interface ValidationError {
  message: string;
  severity: ValidationSeverity;
  range?: SourceRange;
  code: string;
  suggestion?: string;
}

/**
 * Result of formula validation
 */
export interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
  warnings: ValidationError[];
  inferredType?: FormulaValueType;
  dependencies: DependencyAnalysis;
}

/**
 * Validation context
 */
interface ValidationContext {
  collections: Record<string, CollectionMetadata>;
  currentCollection: string;
  functionRegistry: FunctionRegistry;
  visitedProperties: Set<string>;
  errors: ValidationError[];
  warnings: ValidationError[];
}

/**
 * Formula validator
 */
export class FormulaValidator {
  private functionRegistry: FunctionRegistry;

  constructor(functionRegistry: FunctionRegistry) {
    this.functionRegistry = functionRegistry;
  }

  /**
   * Validate a formula AST
   */
  validate(
    ast: ASTNode,
    collections: Record<string, CollectionMetadata>,
    currentCollection: string
  ): ValidationResult {
    const context: ValidationContext = {
      collections,
      currentCollection,
      functionRegistry: this.functionRegistry,
      visitedProperties: new Set(),
      errors: [],
      warnings: [],
    };

    const inferredType = this.validateNode(ast, context);
    const dependencies = this.analyzeDependencies(ast);

    return {
      valid: context.errors.length === 0,
      errors: context.errors,
      warnings: context.warnings,
      inferredType,
      dependencies,
    };
  }

  private validateNode(node: ASTNode, context: ValidationContext): FormulaValueType | undefined {
    switch (node.type) {
      case ASTNodeType.NUMBER_LITERAL:
        return 'number';

      case ASTNodeType.STRING_LITERAL:
        return 'string';

      case ASTNodeType.BOOLEAN_LITERAL:
        return 'boolean';

      case ASTNodeType.NULL_LITERAL:
        return 'null';

      case ASTNodeType.PROPERTY_REF:
        return this.validatePropertyRef(node as PropertyRefNode, context);

      case ASTNodeType.IDENTIFIER:
        return this.validateIdentifier(node, context);

      case ASTNodeType.FUNCTION_CALL:
        return this.validateFunctionCall(node as FunctionCallNode, context);

      case ASTNodeType.BINARY_EXPR:
        return this.validateBinaryExpr(node as BinaryExprNode, context);

      case ASTNodeType.LOGICAL_EXPR:
        return this.validateLogicalExpr(node as LogicalExprNode, context);

      case ASTNodeType.UNARY_EXPR:
        return this.validateNode(node.argument, context);

      case ASTNodeType.MEMBER_ACCESS:
        this.validateNode(node.object, context);
        return undefined; // Type depends on the property

      case ASTNodeType.INDEX_ACCESS:
        this.validateNode(node.object, context);
        this.validateNode(node.index, context);
        return undefined;

      case ASTNodeType.ARRAY_LITERAL:
        node.elements.forEach((el) => this.validateNode(el, context));
        return 'array';

      case ASTNodeType.PROGRAM:
        return this.validateNode(node.body, context);

      default:
        return undefined;
    }
  }

  private validatePropertyRef(node: PropertyRefNode, context: ValidationContext): FormulaValueType | undefined {
    const propertyPath = node.property;
    const parts = propertyPath.split('.');
    const propertyCode = parts[0];

    context.visitedProperties.add(propertyCode);

    const collection = context.collections[context.currentCollection];
    if (!collection) {
      context.warnings.push({
        message: `Unable to validate property: collection metadata not available`,
        severity: 'warning',
        range: node.range,
        code: 'COLLECTION_METADATA_MISSING',
      });
      return undefined;
    }

    const property = collection.properties.find((p) => p.code === propertyCode);
    if (!property) {
      context.errors.push({
        message: `Property "${propertyCode}" not found in collection "${collection.name}"`,
        severity: 'error',
        range: node.range,
        code: 'PROPERTY_NOT_FOUND',
        suggestion: this.findSimilarProperty(propertyCode, collection.properties),
      });
      return undefined;
    }

    return this.typeCodeToValueType(property.propertyTypeCode);
  }

  private validateIdentifier(node: ASTNode & { name: string }, context: ValidationContext): FormulaValueType | undefined {
    const name = node.name.toUpperCase();

    // Check if it's a known constant
    const constants: Record<string, FormulaValueType> = {
      PI: 'number',
      E: 'number',
      TRUE: 'boolean',
      FALSE: 'boolean',
    };

    if (constants[name]) {
      return constants[name];
    }

    // Assume it's a property reference without braces (lenient mode)
    context.visitedProperties.add(node.name);
    return undefined;
  }

  private validateFunctionCall(node: FunctionCallNode, context: ValidationContext): FormulaValueType | undefined {
    const funcName = node.name.toUpperCase();
    const func = context.functionRegistry.get(funcName);

    if (!func) {
      context.errors.push({
        message: `Unknown function: ${node.name}`,
        severity: 'error',
        range: node.range,
        code: 'UNKNOWN_FUNCTION',
        suggestion: this.findSimilarFunction(funcName, context.functionRegistry),
      });
      return undefined;
    }

    // Validate argument count
    const minArgs = func.minArgs ?? func.args.filter((a) => a.required !== false).length;
    const maxArgs = func.maxArgs ?? func.args.length;

    if (node.arguments.length < minArgs) {
      context.errors.push({
        message: `Function ${node.name} requires at least ${minArgs} argument(s), got ${node.arguments.length}`,
        severity: 'error',
        range: node.range,
        code: 'TOO_FEW_ARGUMENTS',
      });
    }

    if (maxArgs !== -1 && node.arguments.length > maxArgs) {
      context.errors.push({
        message: `Function ${node.name} accepts at most ${maxArgs} argument(s), got ${node.arguments.length}`,
        severity: 'error',
        range: node.range,
        code: 'TOO_MANY_ARGUMENTS',
      });
    }

    // Validate each argument
    node.arguments.forEach((arg) => {
      this.validateNode(arg, context);
    });

    return func.returnType;
  }

  private validateBinaryExpr(node: BinaryExprNode, context: ValidationContext): FormulaValueType | undefined {
    const leftType = this.validateNode(node.left, context);
    const rightType = this.validateNode(node.right, context);

    // Type compatibility checks
    const arithmeticOps = ['+', '-', '*', '/', '%', '^'];
    const comparisonOps = ['=', '!=', '<', '<=', '>', '>='];

    if (arithmeticOps.includes(node.operator)) {
      // + can be string concatenation
      if (node.operator === '+' && (leftType === 'string' || rightType === 'string')) {
        return 'string';
      }

      if (leftType && leftType !== 'number' && leftType !== 'null') {
        context.warnings.push({
          message: `Left operand of "${node.operator}" should be a number`,
          severity: 'warning',
          range: node.left.range,
          code: 'TYPE_MISMATCH',
        });
      }

      if (rightType && rightType !== 'number' && rightType !== 'null') {
        context.warnings.push({
          message: `Right operand of "${node.operator}" should be a number`,
          severity: 'warning',
          range: node.right.range,
          code: 'TYPE_MISMATCH',
        });
      }

      return 'number';
    }

    if (comparisonOps.includes(node.operator)) {
      return 'boolean';
    }

    return undefined;
  }

  private validateLogicalExpr(node: LogicalExprNode, context: ValidationContext): FormulaValueType {
    this.validateNode(node.left, context);
    this.validateNode(node.right, context);
    return 'boolean';
  }

  private analyzeDependencies(ast: ASTNode): DependencyAnalysis {
    const properties = new Set<string>();
    const relatedCollections = new Set<string>();
    const functions = new Set<string>();

    const visit = (node: ASTNode): void => {
      switch (node.type) {
        case ASTNodeType.PROPERTY_REF:
          properties.add((node as PropertyRefNode).property.split('.')[0]);
          break;

        case ASTNodeType.IDENTIFIER:
          properties.add((node as { name: string }).name);
          break;

        case ASTNodeType.FUNCTION_CALL:
          const funcNode = node as FunctionCallNode;
          functions.add(funcNode.name.toUpperCase());

          // Check for LOOKUP, ROLLUP, RELATED functions
          if (['LOOKUP', 'ROLLUP', 'RELATED'].includes(funcNode.name.toUpperCase())) {
            if (funcNode.arguments[0]?.type === ASTNodeType.STRING_LITERAL) {
              relatedCollections.add((funcNode.arguments[0] as { value: string }).value);
            }
          }

          funcNode.arguments.forEach(visit);
          break;

        case ASTNodeType.BINARY_EXPR:
        case ASTNodeType.LOGICAL_EXPR:
          visit((node as BinaryExprNode).left);
          visit((node as BinaryExprNode).right);
          break;

        case ASTNodeType.UNARY_EXPR:
          visit((node as { argument: ASTNode }).argument);
          break;

        case ASTNodeType.MEMBER_ACCESS:
        case ASTNodeType.INDEX_ACCESS:
          visit((node as { object: ASTNode }).object);
          if (node.type === ASTNodeType.INDEX_ACCESS) {
            visit((node as { index: ASTNode }).index);
          }
          break;

        case ASTNodeType.ARRAY_LITERAL:
          (node as { elements: ASTNode[] }).elements.forEach(visit);
          break;

        case ASTNodeType.PROGRAM:
          visit((node as { body: ASTNode }).body);
          break;
      }
    };

    visit(ast);

    return {
      properties: Array.from(properties),
      relatedCollections: Array.from(relatedCollections),
      functions: Array.from(functions),
      hasCircularDependency: false,
      circularPath: undefined,
    };
  }

  private typeCodeToValueType(typeCode: string): FormulaValueType | undefined {
    const typeMap: Record<string, FormulaValueType> = {
      text: 'string',
      long_text: 'string',
      rich_text: 'string',
      number: 'number',
      integer: 'number',
      decimal: 'number',
      currency: 'number',
      boolean: 'boolean',
      date: 'date',
      datetime: 'datetime',
      time: 'string',
      reference: 'reference',
      multi_reference: 'array',
      choice: 'string',
      multi_choice: 'array',
      json: 'object',
      email: 'string',
      phone: 'string',
      url: 'string',
      uuid: 'string',
    };

    return typeMap[typeCode];
  }

  private findSimilarProperty(propertyCode: string, properties: { code: string }[]): string | undefined {
    const similar = properties
      .map((p) => ({
        code: p.code,
        distance: this.levenshteinDistance(propertyCode.toLowerCase(), p.code.toLowerCase()),
      }))
      .filter((p) => p.distance <= 3)
      .sort((a, b) => a.distance - b.distance);

    return similar[0]?.code ? `Did you mean "${similar[0].code}"?` : undefined;
  }

  private findSimilarFunction(funcName: string, registry: FunctionRegistry): string | undefined {
    const allFunctions = registry.list();
    const similar = allFunctions
      .map((f) => ({
        name: f.name,
        distance: this.levenshteinDistance(funcName.toLowerCase(), f.name.toLowerCase()),
      }))
      .filter((f) => f.distance <= 3)
      .sort((a, b) => a.distance - b.distance);

    return similar[0]?.name ? `Did you mean "${similar[0].name}"?` : undefined;
  }

  private levenshteinDistance(a: string, b: string): number {
    const matrix: number[][] = [];

    for (let i = 0; i <= b.length; i++) {
      matrix[i] = [i];
    }

    for (let j = 0; j <= a.length; j++) {
      matrix[0][j] = j;
    }

    for (let i = 1; i <= b.length; i++) {
      for (let j = 1; j <= a.length; j++) {
        if (b[i - 1] === a[j - 1]) {
          matrix[i][j] = matrix[i - 1][j - 1];
        } else {
          matrix[i][j] = Math.min(
            matrix[i - 1][j - 1] + 1,
            matrix[i][j - 1] + 1,
            matrix[i - 1][j] + 1
          );
        }
      }
    }

    return matrix[b.length][a.length];
  }
}
