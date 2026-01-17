/**
 * Formula Evaluator
 *
 * Evaluates parsed AST against record data.
 */

import {
  ASTNode,
  ASTNodeType,
  BinaryExprNode,
  LogicalExprNode,
  UnaryExprNode,
  PropertyRefNode,
  IdentifierNode,
  FunctionCallNode,
  MemberAccessNode,
  IndexAccessNode,
  ArrayLiteralNode,
  NumberLiteralNode,
  StringLiteralNode,
  BooleanLiteralNode,
  ProgramNode,
} from './parser';
import { FormulaValue, FormulaMetrics } from './types';
import { FormulaContext, RecordData } from './context';
import { FunctionRegistry } from './function-registry';

/**
 * Result of formula evaluation
 */
export interface EvaluationResult {
  value: FormulaValue;
  success: boolean;
  error?: string;
  metrics: FormulaMetrics;
}

/**
 * Evaluation error
 */
export class EvaluationError extends Error {
  constructor(
    message: string,
    public node?: ASTNode
  ) {
    super(message);
    this.name = 'EvaluationError';
  }
}

/**
 * Evaluation statistics tracker
 */
class EvaluationStats {
  propertyAccesses = 0;
  relatedLookups = 0;
  functionCalls = 0;

  reset(): void {
    this.propertyAccesses = 0;
    this.relatedLookups = 0;
    this.functionCalls = 0;
  }
}

/**
 * Formula evaluator
 */
export class Evaluator {
  private functionRegistry: FunctionRegistry;
  private stats: EvaluationStats;

  constructor(functionRegistry: FunctionRegistry) {
    this.functionRegistry = functionRegistry;
    this.stats = new EvaluationStats();
  }

  /**
   * Evaluate an AST against a context
   */
  evaluate(ast: ASTNode, context: FormulaContext): EvaluationResult {
    const startTime = performance.now();
    this.stats.reset();

    try {
      const value = this.evaluateNode(ast, context);
      const endTime = performance.now();

      return {
        value,
        success: true,
        metrics: {
          parseTime: 0,
          evaluateTime: endTime - startTime,
          totalTime: endTime - startTime,
          propertyAccesses: this.stats.propertyAccesses,
          relatedLookups: this.stats.relatedLookups,
          functionCalls: this.stats.functionCalls,
          fromCache: false,
        },
      };
    } catch (error) {
      const endTime = performance.now();
      return {
        value: null,
        success: false,
        error: error instanceof Error ? error.message : String(error),
        metrics: {
          parseTime: 0,
          evaluateTime: endTime - startTime,
          totalTime: endTime - startTime,
          propertyAccesses: this.stats.propertyAccesses,
          relatedLookups: this.stats.relatedLookups,
          functionCalls: this.stats.functionCalls,
          fromCache: false,
        },
      };
    }
  }

  private evaluateNode(node: ASTNode, context: FormulaContext): FormulaValue {
    switch (node.type) {
      case ASTNodeType.PROGRAM:
        return this.evaluateNode((node as ProgramNode).body, context);

      case ASTNodeType.NUMBER_LITERAL:
        return (node as NumberLiteralNode).value;

      case ASTNodeType.STRING_LITERAL:
        return (node as StringLiteralNode).value;

      case ASTNodeType.BOOLEAN_LITERAL:
        return (node as BooleanLiteralNode).value;

      case ASTNodeType.NULL_LITERAL:
        return null;

      case ASTNodeType.PROPERTY_REF:
        return this.evaluatePropertyRef(node as PropertyRefNode, context);

      case ASTNodeType.IDENTIFIER:
        return this.evaluateIdentifier(node as IdentifierNode, context);

      case ASTNodeType.FUNCTION_CALL:
        return this.evaluateFunctionCall(node as FunctionCallNode, context);

      case ASTNodeType.BINARY_EXPR:
        return this.evaluateBinaryExpr(node as BinaryExprNode, context);

      case ASTNodeType.LOGICAL_EXPR:
        return this.evaluateLogicalExpr(node as LogicalExprNode, context);

      case ASTNodeType.UNARY_EXPR:
        return this.evaluateUnaryExpr(node as UnaryExprNode, context);

      case ASTNodeType.MEMBER_ACCESS:
        return this.evaluateMemberAccess(node as MemberAccessNode, context);

      case ASTNodeType.INDEX_ACCESS:
        return this.evaluateIndexAccess(node as IndexAccessNode, context);

      case ASTNodeType.ARRAY_LITERAL:
        return this.evaluateArrayLiteral(node as ArrayLiteralNode, context);

      default:
        throw new EvaluationError(`Unknown node type: ${node.type}`, node);
    }
  }

  private evaluatePropertyRef(node: PropertyRefNode, context: FormulaContext): FormulaValue {
    this.stats.propertyAccesses++;

    const propertyPath = node.property;
    const parts = propertyPath.split('.');

    let value: FormulaValue = context.record;

    for (const part of parts) {
      if (value === null || value === undefined) {
        return null;
      }

      if (typeof value === 'object' && !Array.isArray(value)) {
        value = (value as RecordData)[part];
      } else {
        return null;
      }
    }

    return value;
  }

  private evaluateIdentifier(node: IdentifierNode, context: FormulaContext): FormulaValue {
    const name = node.name;
    const upperName = name.toUpperCase();

    // Built-in constants
    const constants: Record<string, FormulaValue> = {
      PI: Math.PI,
      E: Math.E,
      TRUE: true,
      FALSE: false,
    };

    if (constants[upperName] !== undefined) {
      return constants[upperName];
    }

    // Check custom variables
    if (context.variables && name in context.variables) {
      return context.variables[name];
    }

    // Treat as property reference
    this.stats.propertyAccesses++;
    return context.record[name] ?? null;
  }

  private evaluateFunctionCall(node: FunctionCallNode, context: FormulaContext): FormulaValue {
    this.stats.functionCalls++;

    const funcName = node.name.toUpperCase();
    const func = this.functionRegistry.get(funcName);

    if (!func) {
      throw new EvaluationError(`Unknown function: ${node.name}`, node);
    }

    // Evaluate arguments
    const args = node.arguments.map((arg) => this.evaluateNode(arg, context));

    // Execute function
    return func.implementation(args, context);
  }

  private evaluateBinaryExpr(node: BinaryExprNode, context: FormulaContext): FormulaValue {
    const left = this.evaluateNode(node.left, context);
    const right = this.evaluateNode(node.right, context);

    switch (node.operator) {
      case '+':
        if (typeof left === 'string' || typeof right === 'string') {
          return String(left ?? '') + String(right ?? '');
        }
        return this.toNumber(left) + this.toNumber(right);

      case '-':
        return this.toNumber(left) - this.toNumber(right);

      case '*':
        return this.toNumber(left) * this.toNumber(right);

      case '/':
        const divisor = this.toNumber(right);
        if (divisor === 0) {
          throw new EvaluationError('Division by zero', node);
        }
        return this.toNumber(left) / divisor;

      case '%':
        return this.toNumber(left) % this.toNumber(right);

      case '^':
        return Math.pow(this.toNumber(left), this.toNumber(right));

      case '=':
        return this.isEqual(left, right);

      case '!=':
        return !this.isEqual(left, right);

      case '<':
        return this.compare(left, right) < 0;

      case '<=':
        return this.compare(left, right) <= 0;

      case '>':
        return this.compare(left, right) > 0;

      case '>=':
        return this.compare(left, right) >= 0;

      default:
        throw new EvaluationError(`Unknown operator: ${node.operator}`, node);
    }
  }

  private evaluateLogicalExpr(node: LogicalExprNode, context: FormulaContext): FormulaValue {
    const left = this.evaluateNode(node.left, context);

    // Short-circuit evaluation
    if (node.operator === 'AND') {
      if (!this.toBool(left)) return false;
      return this.toBool(this.evaluateNode(node.right, context));
    }

    if (node.operator === 'OR') {
      if (this.toBool(left)) return true;
      return this.toBool(this.evaluateNode(node.right, context));
    }

    throw new EvaluationError(`Unknown logical operator: ${node.operator}`, node);
  }

  private evaluateUnaryExpr(node: UnaryExprNode, context: FormulaContext): FormulaValue {
    const argument = this.evaluateNode(node.argument, context);

    switch (node.operator) {
      case '-':
        return -this.toNumber(argument);

      case 'NOT':
        return !this.toBool(argument);

      default:
        throw new EvaluationError(`Unknown unary operator: ${node.operator}`, node);
    }
  }

  private evaluateMemberAccess(node: MemberAccessNode, context: FormulaContext): FormulaValue {
    const object = this.evaluateNode(node.object, context);

    if (object === null || object === undefined) {
      return null;
    }

    if (typeof object === 'object' && !Array.isArray(object)) {
      return (object as Record<string, FormulaValue>)[node.property] ?? null;
    }

    throw new EvaluationError('Cannot access property on non-object', node);
  }

  private evaluateIndexAccess(node: IndexAccessNode, context: FormulaContext): FormulaValue {
    const object = this.evaluateNode(node.object, context);
    const index = this.evaluateNode(node.index, context);

    if (object === null || object === undefined) {
      return null;
    }

    if (Array.isArray(object)) {
      const idx = this.toNumber(index);
      if (idx < 0 || idx >= object.length || !Number.isInteger(idx)) {
        return null;
      }
      return object[idx];
    }

    if (typeof object === 'object') {
      return (object as Record<string, FormulaValue>)[String(index)] ?? null;
    }

    throw new EvaluationError('Cannot index non-array/object', node);
  }

  private evaluateArrayLiteral(node: ArrayLiteralNode, context: FormulaContext): FormulaValue {
    return node.elements.map((el) => this.evaluateNode(el, context));
  }

  private toNumber(value: FormulaValue): number {
    if (value === null || value === undefined) return 0;
    if (typeof value === 'number') return value;
    if (typeof value === 'boolean') return value ? 1 : 0;
    if (typeof value === 'string') {
      const num = parseFloat(value);
      return isNaN(num) ? 0 : num;
    }
    if (value instanceof Date) return value.getTime();
    return 0;
  }

  private toBool(value: FormulaValue): boolean {
    if (value === null || value === undefined) return false;
    if (typeof value === 'boolean') return value;
    if (typeof value === 'number') return value !== 0;
    if (typeof value === 'string') return value.length > 0;
    if (Array.isArray(value)) return value.length > 0;
    if (typeof value === 'object') return Object.keys(value).length > 0;
    return true;
  }

  private isEqual(left: FormulaValue, right: FormulaValue): boolean {
    if (left === null && right === null) return true;
    if (left === null || right === null) return false;

    if (left instanceof Date && right instanceof Date) {
      return left.getTime() === right.getTime();
    }

    if (Array.isArray(left) && Array.isArray(right)) {
      if (left.length !== right.length) return false;
      return left.every((v, i) => this.isEqual(v, right[i]));
    }

    if (typeof left === 'object' && typeof right === 'object') {
      const leftKeys = Object.keys(left);
      const rightKeys = Object.keys(right);
      if (leftKeys.length !== rightKeys.length) return false;
      return leftKeys.every((k) =>
        this.isEqual(
          (left as Record<string, FormulaValue>)[k],
          (right as Record<string, FormulaValue>)[k]
        )
      );
    }

    return left === right;
  }

  private compare(left: FormulaValue, right: FormulaValue): number {
    if (left === null && right === null) return 0;
    if (left === null) return -1;
    if (right === null) return 1;

    if (left instanceof Date && right instanceof Date) {
      return left.getTime() - right.getTime();
    }

    if (typeof left === 'number' && typeof right === 'number') {
      return left - right;
    }

    if (typeof left === 'string' && typeof right === 'string') {
      return left.localeCompare(right);
    }

    // Convert to numbers for comparison
    return this.toNumber(left) - this.toNumber(right);
  }
}
