/**
 * Shared types used across multiple entity files.
 * Centralized here to avoid naming conflicts in exports.
 */

/**
 * Declarative condition expression used in business rules and field protection.
 * Supports nested boolean logic with field comparisons.
 */
export interface ConditionExpression {
  operator: 'and' | 'or' | 'not';
  conditions?: ConditionExpression[];
  field?: string;
  comparison?:
    | 'eq'
    | 'ne'
    | 'gt'
    | 'gte'
    | 'lt'
    | 'lte'
    | 'in'
    | 'nin'
    | 'contains'
    | 'starts_with'
    | 'ends_with'
    | 'is_null'
    | 'is_not_null'
    | 'changed'
    | 'changed_to'
    | 'changed_from';
  value?: any;
}
