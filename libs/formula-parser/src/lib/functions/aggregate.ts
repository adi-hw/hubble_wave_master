/**
 * Aggregate functions for formulas
 */

import { FormulaFunction } from '../function-registry';
import { FormulaValue } from '../types';

const toNumber = (value: FormulaValue): number => {
  if (value === null || value === undefined) return 0;
  if (typeof value === 'number') return value;
  if (typeof value === 'string') {
    const num = parseFloat(value);
    return isNaN(num) ? 0 : num;
  }
  return 0;
};

const flattenToNumbers = (args: FormulaValue[]): number[] => {
  const result: number[] = [];
  for (const arg of args) {
    if (Array.isArray(arg)) {
      result.push(...flattenToNumbers(arg));
    } else if (arg !== null && arg !== undefined) {
      const num = toNumber(arg);
      if (!isNaN(num)) {
        result.push(num);
      }
    }
  }
  return result;
};

const flattenAll = (args: FormulaValue[]): FormulaValue[] => {
  const result: FormulaValue[] = [];
  for (const arg of args) {
    if (Array.isArray(arg)) {
      result.push(...flattenAll(arg));
    } else {
      result.push(arg);
    }
  }
  return result;
};

export const aggregateFunctions: FormulaFunction[] = [
  {
    name: 'SUM',
    category: 'aggregate',
    description: 'Returns the sum of all numeric values',
    args: [{ name: 'values', type: ['number', 'array'], required: true }],
    returnType: 'number',
    minArgs: 1,
    maxArgs: -1,
    implementation: (args) => {
      const numbers = flattenToNumbers(args);
      return numbers.reduce((sum, n) => sum + n, 0);
    },
    examples: ['SUM(1, 2, 3) → 6', 'SUM([1, 2, 3]) → 6'],
  },
  {
    name: 'AVERAGE',
    category: 'aggregate',
    description: 'Returns the average (mean) of all numeric values',
    args: [{ name: 'values', type: ['number', 'array'], required: true }],
    returnType: 'number',
    minArgs: 1,
    maxArgs: -1,
    implementation: (args) => {
      const numbers = flattenToNumbers(args);
      if (numbers.length === 0) return 0;
      return numbers.reduce((sum, n) => sum + n, 0) / numbers.length;
    },
    examples: ['AVERAGE(1, 2, 3) → 2'],
  },
  {
    name: 'AVG',
    category: 'aggregate',
    description: 'Alias for AVERAGE',
    args: [{ name: 'values', type: ['number', 'array'], required: true }],
    returnType: 'number',
    minArgs: 1,
    maxArgs: -1,
    implementation: (args) => {
      const numbers = flattenToNumbers(args);
      if (numbers.length === 0) return 0;
      return numbers.reduce((sum, n) => sum + n, 0) / numbers.length;
    },
    examples: ['AVG(10, 20, 30) → 20'],
  },
  {
    name: 'MIN',
    category: 'aggregate',
    description: 'Returns the minimum value',
    args: [{ name: 'values', type: ['number', 'array'], required: true }],
    returnType: 'number',
    minArgs: 1,
    maxArgs: -1,
    implementation: (args) => {
      const numbers = flattenToNumbers(args);
      if (numbers.length === 0) return 0;
      return Math.min(...numbers);
    },
    examples: ['MIN(1, 5, 3) → 1'],
  },
  {
    name: 'MAX',
    category: 'aggregate',
    description: 'Returns the maximum value',
    args: [{ name: 'values', type: ['number', 'array'], required: true }],
    returnType: 'number',
    minArgs: 1,
    maxArgs: -1,
    implementation: (args) => {
      const numbers = flattenToNumbers(args);
      if (numbers.length === 0) return 0;
      return Math.max(...numbers);
    },
    examples: ['MAX(1, 5, 3) → 5'],
  },
  {
    name: 'COUNT',
    category: 'aggregate',
    description: 'Returns the count of numeric values',
    args: [{ name: 'values', type: ['number', 'array', 'null'], required: true }],
    returnType: 'number',
    minArgs: 1,
    maxArgs: -1,
    implementation: (args) => {
      const all = flattenAll(args);
      return all.filter((v) => typeof v === 'number' && !isNaN(v)).length;
    },
    examples: ['COUNT(1, "a", 3) → 2'],
  },
  {
    name: 'COUNTA',
    category: 'aggregate',
    description: 'Returns the count of non-blank values',
    args: [{ name: 'values', type: ['string', 'number', 'array', 'null'], required: true }],
    returnType: 'number',
    minArgs: 1,
    maxArgs: -1,
    implementation: (args) => {
      const all = flattenAll(args);
      return all.filter((v) => v !== null && v !== undefined && v !== '').length;
    },
    examples: ['COUNTA(1, "", 3, null) → 2'],
  },
  {
    name: 'COUNTBLANK',
    category: 'aggregate',
    description: 'Returns the count of blank values',
    args: [{ name: 'values', type: ['string', 'number', 'array', 'null'], required: true }],
    returnType: 'number',
    minArgs: 1,
    maxArgs: -1,
    implementation: (args) => {
      const all = flattenAll(args);
      return all.filter((v) => v === null || v === undefined || v === '').length;
    },
    examples: ['COUNTBLANK(1, "", 3, null) → 2'],
  },
  {
    name: 'COUNTIF',
    category: 'aggregate',
    description: 'Returns the count of values that match a condition',
    args: [
      { name: 'values', type: 'array', required: true },
      { name: 'condition', type: ['string', 'number'], required: true },
    ],
    returnType: 'number',
    implementation: (args) => {
      const values = Array.isArray(args[0]) ? args[0] : [args[0]];
      const condition = args[1];

      // Simple condition matching
      if (typeof condition === 'string') {
        // Handle operators like ">5", ">=10", "<>0"
        const match = condition.match(/^(>=?|<=?|<>|=)?(.+)$/);
        if (match) {
          const [, op = '=', valueStr] = match;
          const compareValue = parseFloat(valueStr) || valueStr;

          return values.filter((v) => {
            const numV = typeof v === 'number' ? v : parseFloat(String(v));
            const numCompare = typeof compareValue === 'number' ? compareValue : parseFloat(String(compareValue));

            switch (op) {
              case '>':
                return numV > numCompare;
              case '>=':
                return numV >= numCompare;
              case '<':
                return numV < numCompare;
              case '<=':
                return numV <= numCompare;
              case '<>':
                return v !== compareValue;
              default:
                return v === compareValue || String(v) === String(compareValue);
            }
          }).length;
        }
      }

      return values.filter((v) => v === condition).length;
    },
    examples: ['COUNTIF([1, 2, 3, 4, 5], ">3") → 2'],
  },
  {
    name: 'SUMIF',
    category: 'aggregate',
    description: 'Returns the sum of values that match a condition',
    args: [
      { name: 'values', type: 'array', required: true },
      { name: 'condition', type: ['string', 'number'], required: true },
      { name: 'sumRange', type: 'array', required: false },
    ],
    returnType: 'number',
    implementation: (args) => {
      const values = Array.isArray(args[0]) ? args[0] : [args[0]];
      const condition = args[1];
      const sumRange = args[2] !== undefined && Array.isArray(args[2]) ? args[2] : values;

      const matchIndices: number[] = [];

      if (typeof condition === 'string') {
        const match = condition.match(/^(>=?|<=?|<>|=)?(.+)$/);
        if (match) {
          const [, op = '=', valueStr] = match;
          const compareValue = parseFloat(valueStr) || valueStr;

          values.forEach((v, i) => {
            const numV = typeof v === 'number' ? v : parseFloat(String(v));
            const numCompare = typeof compareValue === 'number' ? compareValue : parseFloat(String(compareValue));

            let matches = false;
            switch (op) {
              case '>':
                matches = numV > numCompare;
                break;
              case '>=':
                matches = numV >= numCompare;
                break;
              case '<':
                matches = numV < numCompare;
                break;
              case '<=':
                matches = numV <= numCompare;
                break;
              case '<>':
                matches = v !== compareValue;
                break;
              default:
                matches = v === compareValue || String(v) === String(compareValue);
            }

            if (matches) matchIndices.push(i);
          });
        }
      } else {
        values.forEach((v, i) => {
          if (v === condition) matchIndices.push(i);
        });
      }

      return matchIndices.reduce((sum, i) => sum + toNumber(sumRange[i]), 0);
    },
    examples: ['SUMIF([1, 2, 3], ">1") → 5'],
  },
  {
    name: 'AVERAGEIF',
    category: 'aggregate',
    description: 'Returns the average of values that match a condition',
    args: [
      { name: 'values', type: 'array', required: true },
      { name: 'condition', type: ['string', 'number'], required: true },
      { name: 'avgRange', type: 'array', required: false },
    ],
    returnType: 'number',
    implementation: (args) => {
      const values = Array.isArray(args[0]) ? args[0] : [args[0]];
      const condition = args[1];
      const avgRange = args[2] !== undefined && Array.isArray(args[2]) ? args[2] : values;

      const matchIndices: number[] = [];

      if (typeof condition === 'string') {
        const match = condition.match(/^(>=?|<=?|<>|=)?(.+)$/);
        if (match) {
          const [, op = '=', valueStr] = match;
          const compareValue = parseFloat(valueStr) || valueStr;

          values.forEach((v, i) => {
            const numV = typeof v === 'number' ? v : parseFloat(String(v));
            const numCompare = typeof compareValue === 'number' ? compareValue : parseFloat(String(compareValue));

            let matches = false;
            switch (op) {
              case '>':
                matches = numV > numCompare;
                break;
              case '>=':
                matches = numV >= numCompare;
                break;
              case '<':
                matches = numV < numCompare;
                break;
              case '<=':
                matches = numV <= numCompare;
                break;
              case '<>':
                matches = v !== compareValue;
                break;
              default:
                matches = v === compareValue || String(v) === String(compareValue);
            }

            if (matches) matchIndices.push(i);
          });
        }
      } else {
        values.forEach((v, i) => {
          if (v === condition) matchIndices.push(i);
        });
      }

      if (matchIndices.length === 0) return 0;
      const sum = matchIndices.reduce((s, i) => s + toNumber(avgRange[i]), 0);
      return sum / matchIndices.length;
    },
    examples: ['AVERAGEIF([1, 2, 3, 4], ">1") → 3'],
  },
  {
    name: 'MEDIAN',
    category: 'aggregate',
    description: 'Returns the median value',
    args: [{ name: 'values', type: ['number', 'array'], required: true }],
    returnType: 'number',
    minArgs: 1,
    maxArgs: -1,
    implementation: (args) => {
      const numbers = flattenToNumbers(args).sort((a, b) => a - b);
      if (numbers.length === 0) return 0;
      const mid = Math.floor(numbers.length / 2);
      if (numbers.length % 2 === 0) {
        return (numbers[mid - 1] + numbers[mid]) / 2;
      }
      return numbers[mid];
    },
    examples: ['MEDIAN(1, 2, 3, 4, 5) → 3'],
  },
  {
    name: 'MODE',
    category: 'aggregate',
    description: 'Returns the most frequent value',
    args: [{ name: 'values', type: ['number', 'array'], required: true }],
    returnType: 'number',
    minArgs: 1,
    maxArgs: -1,
    implementation: (args) => {
      const numbers = flattenToNumbers(args);
      if (numbers.length === 0) return 0;

      const counts = new Map<number, number>();
      for (const num of numbers) {
        counts.set(num, (counts.get(num) || 0) + 1);
      }

      let maxCount = 0;
      let mode = numbers[0];
      for (const [num, count] of counts) {
        if (count > maxCount) {
          maxCount = count;
          mode = num;
        }
      }

      return mode;
    },
    examples: ['MODE(1, 2, 2, 3, 3, 3) → 3'],
  },
  {
    name: 'STDEV',
    category: 'aggregate',
    description: 'Returns the standard deviation (sample)',
    args: [{ name: 'values', type: ['number', 'array'], required: true }],
    returnType: 'number',
    minArgs: 1,
    maxArgs: -1,
    implementation: (args) => {
      const numbers = flattenToNumbers(args);
      if (numbers.length < 2) return 0;

      const mean = numbers.reduce((s, n) => s + n, 0) / numbers.length;
      const squaredDiffs = numbers.map((n) => Math.pow(n - mean, 2));
      const variance = squaredDiffs.reduce((s, n) => s + n, 0) / (numbers.length - 1);
      return Math.sqrt(variance);
    },
    examples: ['STDEV(2, 4, 4, 4, 5, 5, 7, 9) → 2.138...'],
  },
  {
    name: 'VAR',
    category: 'aggregate',
    description: 'Returns the variance (sample)',
    args: [{ name: 'values', type: ['number', 'array'], required: true }],
    returnType: 'number',
    minArgs: 1,
    maxArgs: -1,
    implementation: (args) => {
      const numbers = flattenToNumbers(args);
      if (numbers.length < 2) return 0;

      const mean = numbers.reduce((s, n) => s + n, 0) / numbers.length;
      const squaredDiffs = numbers.map((n) => Math.pow(n - mean, 2));
      return squaredDiffs.reduce((s, n) => s + n, 0) / (numbers.length - 1);
    },
    examples: ['VAR(2, 4, 4, 4, 5, 5, 7, 9) → 4.571...'],
  },
  {
    name: 'PRODUCT',
    category: 'aggregate',
    description: 'Returns the product of all values',
    args: [{ name: 'values', type: ['number', 'array'], required: true }],
    returnType: 'number',
    minArgs: 1,
    maxArgs: -1,
    implementation: (args) => {
      const numbers = flattenToNumbers(args);
      if (numbers.length === 0) return 0;
      return numbers.reduce((product, n) => product * n, 1);
    },
    examples: ['PRODUCT(2, 3, 4) → 24'],
  },
  {
    name: 'LARGE',
    category: 'aggregate',
    description: 'Returns the k-th largest value',
    args: [
      { name: 'values', type: 'array', required: true },
      { name: 'k', type: 'number', required: true },
    ],
    returnType: 'number',
    implementation: (args) => {
      const numbers = flattenToNumbers([args[0]]).sort((a, b) => b - a);
      const k = Math.floor(toNumber(args[1]));
      if (k < 1 || k > numbers.length) return 0;
      return numbers[k - 1];
    },
    examples: ['LARGE([3, 1, 4, 1, 5], 2) → 4'],
  },
  {
    name: 'SMALL',
    category: 'aggregate',
    description: 'Returns the k-th smallest value',
    args: [
      { name: 'values', type: 'array', required: true },
      { name: 'k', type: 'number', required: true },
    ],
    returnType: 'number',
    implementation: (args) => {
      const numbers = flattenToNumbers([args[0]]).sort((a, b) => a - b);
      const k = Math.floor(toNumber(args[1]));
      if (k < 1 || k > numbers.length) return 0;
      return numbers[k - 1];
    },
    examples: ['SMALL([3, 1, 4, 1, 5], 2) → 1'],
  },
  {
    name: 'PERCENTILE',
    category: 'aggregate',
    description: 'Returns the k-th percentile value',
    args: [
      { name: 'values', type: 'array', required: true },
      { name: 'k', type: 'number', required: true, description: '0-1 range' },
    ],
    returnType: 'number',
    implementation: (args) => {
      const numbers = flattenToNumbers([args[0]]).sort((a, b) => a - b);
      if (numbers.length === 0) return 0;

      const k = Math.max(0, Math.min(1, toNumber(args[1])));
      const index = k * (numbers.length - 1);
      const lower = Math.floor(index);
      const upper = Math.ceil(index);

      if (lower === upper) return numbers[lower];

      const fraction = index - lower;
      return numbers[lower] * (1 - fraction) + numbers[upper] * fraction;
    },
    examples: ['PERCENTILE([1, 2, 3, 4, 5], 0.5) → 3'],
  },
];
