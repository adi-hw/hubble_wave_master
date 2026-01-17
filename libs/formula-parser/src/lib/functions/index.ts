/**
 * Built-in formula functions
 *
 * Exports all function categories for registration.
 */

export { mathFunctions } from './math';
export { textFunctions } from './text';
export { dateFunctions } from './date';
export { logicFunctions } from './logic';
export { aggregateFunctions } from './aggregate';
export { referenceFunctions } from './reference';
export { utilityFunctions } from './utility';

import { FormulaFunction } from '../function-registry';
import { mathFunctions } from './math';
import { textFunctions } from './text';
import { dateFunctions } from './date';
import { logicFunctions } from './logic';
import { aggregateFunctions } from './aggregate';
import { referenceFunctions } from './reference';
import { utilityFunctions } from './utility';

/**
 * Get all built-in functions
 */
export function getAllBuiltinFunctions(): FormulaFunction[] {
  return [
    ...mathFunctions,
    ...textFunctions,
    ...dateFunctions,
    ...logicFunctions,
    ...aggregateFunctions,
    ...referenceFunctions,
    ...utilityFunctions,
  ];
}
