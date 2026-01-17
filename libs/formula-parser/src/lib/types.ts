/**
 * Core types for the formula parser system
 */

/**
 * All supported data types in formulas
 */
export type FormulaValueType =
  | 'string'
  | 'number'
  | 'boolean'
  | 'date'
  | 'datetime'
  | 'null'
  | 'array'
  | 'object'
  | 'reference';

/**
 * Primitive formula values
 */
export type FormulaPrimitive = string | number | boolean | Date | null;

/**
 * A formula value can be any of these types
 */
export type FormulaValue =
  | FormulaPrimitive
  | FormulaArray
  | FormulaObject;

/**
 * Array of formula values
 */
export interface FormulaArray extends Array<FormulaValue> {}

/**
 * Object containing formula values
 */
export interface FormulaObject {
  [key: string]: FormulaValue;
}

/**
 * Configuration for a formula property
 */
export interface FormulaPropertyConfig {
  /** The formula expression */
  formula: string;
  /** Expected return type */
  returnType: FormulaValueType;
  /** When to recalculate: 'never' | 'on_save' | 'periodic' | 'real_time' */
  cacheStrategy: FormulaCacheStrategy;
  /** For periodic caching, interval in seconds */
  cacheInterval?: number;
  /** Property codes this formula depends on */
  dependencies: string[];
  /** Whether formula errors should block save */
  errorHandling: FormulaErrorHandling;
  /** Default value when formula fails */
  fallbackValue?: FormulaValue;
}

/**
 * Cache strategy for formula values
 */
export type FormulaCacheStrategy = 'never' | 'on_save' | 'periodic' | 'real_time';

/**
 * Error handling mode for formulas
 */
export type FormulaErrorHandling = 'block' | 'warn' | 'ignore';

/**
 * Rollup property configuration
 */
export interface RollupPropertyConfig {
  /** Source collection code */
  sourceCollection: string;
  /** Reference property linking to source */
  referenceProperty: string;
  /** Property to aggregate */
  sourceProperty: string;
  /** Aggregation function */
  aggregation: RollupAggregation;
  /** Optional filter expression */
  filter?: string;
  /** Cache strategy */
  cacheStrategy: FormulaCacheStrategy;
}

/**
 * Supported rollup aggregation functions
 */
export type RollupAggregation =
  | 'SUM'
  | 'AVG'
  | 'COUNT'
  | 'COUNTA'
  | 'COUNTALL'
  | 'MIN'
  | 'MAX'
  | 'FIRST'
  | 'LAST'
  | 'CONCAT'
  | 'CONCAT_UNIQUE';

/**
 * Lookup property configuration
 */
export interface LookupPropertyConfig {
  /** Source collection code */
  sourceCollection: string;
  /** Reference property linking to source */
  referenceProperty: string;
  /** Property to fetch from source */
  sourceProperty: string;
  /** Whether to cache the lookup value */
  cache: boolean;
}

/**
 * Hierarchical property configuration
 */
export interface HierarchicalPropertyConfig {
  /** Self-reference property code */
  parentProperty: string;
  /** Maximum depth allowed */
  maxDepth: number;
  /** How to display the hierarchy */
  displayMode: HierarchicalDisplayMode;
  /** Separator for path display */
  pathSeparator: string;
}

/**
 * Hierarchical display modes
 */
export type HierarchicalDisplayMode = 'tree' | 'path' | 'breadcrumb' | 'flat';

/**
 * Result of formula dependency analysis
 */
export interface DependencyAnalysis {
  /** Direct property dependencies */
  properties: string[];
  /** Related collection dependencies */
  relatedCollections: string[];
  /** Function calls used */
  functions: string[];
  /** Whether formula has circular dependencies */
  hasCircularDependency: boolean;
  /** Circular dependency path if found */
  circularPath?: string[];
}

/**
 * Formula execution metrics
 */
export interface FormulaMetrics {
  /** Time to parse in ms */
  parseTime: number;
  /** Time to evaluate in ms */
  evaluateTime: number;
  /** Total execution time in ms */
  totalTime: number;
  /** Number of property accesses */
  propertyAccesses: number;
  /** Number of related record lookups */
  relatedLookups: number;
  /** Number of function calls */
  functionCalls: number;
  /** Whether result was cached */
  fromCache: boolean;
}

/**
 * Position in source formula for error reporting
 */
export interface SourcePosition {
  line: number;
  column: number;
  offset: number;
}

/**
 * Source range for AST nodes
 */
export interface SourceRange {
  start: SourcePosition;
  end: SourcePosition;
}
