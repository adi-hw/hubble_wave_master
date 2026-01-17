/**
 * @hubblewave/formula-parser
 *
 * The Formula Parser is a comprehensive formula evaluation engine for HubbleWave.
 * It provides tokenization, parsing, validation, and evaluation of formulas
 * used in computed properties.
 *
 * ## Core Components
 *
 * **Tokenizer**: Converts formula strings into token streams
 * **Parser**: Builds Abstract Syntax Trees (AST) from tokens
 * **Validator**: Validates formula syntax and type compatibility
 * **Evaluator**: Executes formulas against record data
 * **FunctionRegistry**: Manages built-in and custom functions
 *
 * ## Supported Operations
 *
 * - Arithmetic: +, -, *, /, %, ^
 * - Comparison: =, !=, <, <=, >, >=
 * - Logical: AND, OR, NOT
 * - String: CONCAT, LEFT, RIGHT, MID, LEN, UPPER, LOWER, TRIM
 * - Math: SUM, AVG, MIN, MAX, ABS, ROUND, FLOOR, CEIL
 * - Date: NOW, TODAY, YEAR, MONTH, DAY, DATEADD, DATEDIFF
 * - Reference: LOOKUP, ROLLUP, RELATED
 * - Conditional: IF, SWITCH, ISBLANK, ISNUMBER, ISTEXT
 *
 * @example
 * ```typescript
 * import { FormulaEngine, FormulaContext } from '@hubblewave/formula-parser';
 *
 * const engine = new FormulaEngine();
 * const formula = 'IF(Status = "Completed", Price * Quantity, 0)';
 *
 * const result = engine.evaluate(formula, {
 *   record: { Status: 'Completed', Price: 100, Quantity: 5 },
 *   collections: {},
 *   currentUser: { id: 'user-1' }
 * });
 * // result = 500
 * ```
 *
 * @packageDocumentation
 */

// Core types
export * from './lib/types';

// Tokenizer
export { Tokenizer, Token, TokenType } from './lib/tokenizer';

// Parser
export { Parser, ASTNode, ASTNodeType } from './lib/parser';

// Validator
export { FormulaValidator, ValidationResult, ValidationError } from './lib/validator';

// Evaluator
export { Evaluator, EvaluationResult } from './lib/evaluator';

// Function Registry
export { FunctionRegistry, FormulaFunction, FunctionCategory } from './lib/function-registry';

// Built-in Functions
export * from './lib/functions';

// Main Engine
export { FormulaEngine, FormulaEngineOptions } from './lib/formula-engine';

// Context Types
export { FormulaContext, RecordData, RelatedRecords } from './lib/context';
