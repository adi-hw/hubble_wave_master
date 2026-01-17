/**
 * Logic functions for formulas
 */

import { FormulaFunction } from '../function-registry';
import { FormulaValue } from '../types';

const toBool = (value: FormulaValue): boolean => {
  if (value === null || value === undefined) return false;
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') return value !== 0;
  if (typeof value === 'string') return value.length > 0;
  if (Array.isArray(value)) return value.length > 0;
  return true;
};

const isBlank = (value: FormulaValue): boolean => {
  if (value === null || value === undefined) return true;
  if (typeof value === 'string') return value.trim() === '';
  return false;
};

export const logicFunctions: FormulaFunction[] = [
  {
    name: 'IF',
    category: 'logic',
    description: 'Returns one value if condition is true, another if false',
    args: [
      { name: 'condition', type: 'boolean', required: true },
      { name: 'trueValue', type: ['string', 'number', 'boolean', 'date', 'null'], required: true },
      { name: 'falseValue', type: ['string', 'number', 'boolean', 'date', 'null'], required: false, defaultValue: null },
    ],
    returnType: 'string',
    implementation: (args) => {
      const condition = toBool(args[0]);
      return condition ? args[1] : (args[2] ?? null);
    },
    examples: ['IF(Status = "Active", "Yes", "No")'],
  },
  {
    name: 'IFS',
    category: 'logic',
    description: 'Evaluates multiple conditions and returns the value for the first true condition',
    args: [{ name: 'condition_value_pairs', type: ['boolean', 'string'], required: true }],
    returnType: 'string',
    minArgs: 2,
    maxArgs: -1,
    implementation: (args) => {
      for (let i = 0; i < args.length; i += 2) {
        if (toBool(args[i])) {
          return args[i + 1] ?? null;
        }
      }
      return null;
    },
    examples: ['IFS(Score >= 90, "A", Score >= 80, "B", TRUE, "C")'],
  },
  {
    name: 'SWITCH',
    category: 'logic',
    description: 'Evaluates an expression against a list of values and returns the matching result',
    args: [
      { name: 'expression', type: ['string', 'number'], required: true },
      { name: 'value_result_pairs', type: ['string', 'number'], required: true },
    ],
    returnType: 'string',
    minArgs: 3,
    maxArgs: -1,
    implementation: (args) => {
      const expression = args[0];
      for (let i = 1; i < args.length - 1; i += 2) {
        if (expression === args[i]) {
          return args[i + 1];
        }
      }
      // If odd number of args, last one is default
      if (args.length % 2 === 0) {
        return args[args.length - 1];
      }
      return null;
    },
    examples: ['SWITCH(Status, "A", "Active", "I", "Inactive", "Unknown")'],
  },
  {
    name: 'AND',
    category: 'logic',
    description: 'Returns TRUE if all arguments are true',
    args: [{ name: 'conditions', type: 'boolean', required: true }],
    returnType: 'boolean',
    minArgs: 1,
    maxArgs: -1,
    implementation: (args) => args.every(toBool),
    examples: ['AND(A > 0, B > 0, C > 0)'],
  },
  {
    name: 'OR',
    category: 'logic',
    description: 'Returns TRUE if any argument is true',
    args: [{ name: 'conditions', type: 'boolean', required: true }],
    returnType: 'boolean',
    minArgs: 1,
    maxArgs: -1,
    implementation: (args) => args.some(toBool),
    examples: ['OR(Status = "Active", Status = "Pending")'],
  },
  {
    name: 'NOT',
    category: 'logic',
    description: 'Returns the logical opposite of a value',
    args: [{ name: 'value', type: 'boolean', required: true }],
    returnType: 'boolean',
    implementation: (args) => !toBool(args[0]),
    examples: ['NOT(IsComplete)'],
  },
  {
    name: 'XOR',
    category: 'logic',
    description: 'Returns TRUE if an odd number of arguments are true',
    args: [{ name: 'conditions', type: 'boolean', required: true }],
    returnType: 'boolean',
    minArgs: 2,
    maxArgs: -1,
    implementation: (args) => args.filter(toBool).length % 2 === 1,
    examples: ['XOR(A, B)'],
  },
  {
    name: 'ISBLANK',
    category: 'logic',
    description: 'Returns TRUE if value is blank/null',
    args: [{ name: 'value', type: ['string', 'number', 'null'], required: true }],
    returnType: 'boolean',
    implementation: (args) => isBlank(args[0]),
    examples: ['ISBLANK(Notes)'],
  },
  {
    name: 'ISNOTBLANK',
    category: 'logic',
    description: 'Returns TRUE if value is not blank/null',
    args: [{ name: 'value', type: ['string', 'number', 'null'], required: true }],
    returnType: 'boolean',
    implementation: (args) => !isBlank(args[0]),
    examples: ['ISNOTBLANK(Email)'],
  },
  {
    name: 'ISNUMBER',
    category: 'logic',
    description: 'Returns TRUE if value is a number',
    args: [{ name: 'value', type: ['string', 'number', 'null'], required: true }],
    returnType: 'boolean',
    implementation: (args) => {
      const value = args[0];
      if (typeof value === 'number') return !isNaN(value);
      if (typeof value === 'string') return !isNaN(parseFloat(value));
      return false;
    },
    examples: ['ISNUMBER(Price)'],
  },
  {
    name: 'ISTEXT',
    category: 'logic',
    description: 'Returns TRUE if value is text',
    args: [{ name: 'value', type: ['string', 'number', 'null'], required: true }],
    returnType: 'boolean',
    implementation: (args) => typeof args[0] === 'string',
    examples: ['ISTEXT(Name)'],
  },
  {
    name: 'ISLOGICAL',
    category: 'logic',
    description: 'Returns TRUE if value is a boolean',
    args: [{ name: 'value', type: ['string', 'number', 'boolean', 'null'], required: true }],
    returnType: 'boolean',
    implementation: (args) => typeof args[0] === 'boolean',
    examples: ['ISLOGICAL(IsActive)'],
  },
  {
    name: 'ISDATE',
    category: 'logic',
    description: 'Returns TRUE if value is a valid date',
    args: [{ name: 'value', type: ['string', 'date', 'null'], required: true }],
    returnType: 'boolean',
    implementation: (args) => {
      const value = args[0];
      if (value instanceof Date) return !isNaN(value.getTime());
      if (typeof value === 'string') {
        const date = new Date(value);
        return !isNaN(date.getTime());
      }
      return false;
    },
    examples: ['ISDATE(DueDate)'],
  },
  {
    name: 'IFERROR',
    category: 'logic',
    description: 'Returns a fallback value if the first argument results in an error',
    args: [
      { name: 'value', type: ['string', 'number', 'null'], required: true },
      { name: 'fallback', type: ['string', 'number', 'null'], required: true },
    ],
    returnType: 'string',
    implementation: (args) => {
      // In normal evaluation, if we get here, no error occurred
      // The evaluator handles errors at a higher level
      return args[0] ?? args[1];
    },
    examples: ['IFERROR(1/0, "Error")'],
  },
  {
    name: 'IFBLANK',
    category: 'logic',
    description: 'Returns a fallback value if the first argument is blank',
    args: [
      { name: 'value', type: ['string', 'number', 'null'], required: true },
      { name: 'fallback', type: ['string', 'number', 'null'], required: true },
    ],
    returnType: 'string',
    implementation: (args) => (isBlank(args[0]) ? args[1] : args[0]),
    examples: ['IFBLANK(Description, "No description provided")'],
  },
  {
    name: 'COALESCE',
    category: 'logic',
    description: 'Returns the first non-blank value',
    args: [{ name: 'values', type: ['string', 'number', 'null'], required: true }],
    returnType: 'string',
    minArgs: 1,
    maxArgs: -1,
    implementation: (args) => {
      for (const arg of args) {
        if (!isBlank(arg)) {
          return arg;
        }
      }
      return null;
    },
    examples: ['COALESCE(PreferredName, FirstName, "Unknown")'],
  },
  {
    name: 'TRUE',
    category: 'logic',
    description: 'Returns TRUE',
    args: [],
    returnType: 'boolean',
    implementation: () => true,
    examples: ['TRUE()'],
  },
  {
    name: 'FALSE',
    category: 'logic',
    description: 'Returns FALSE',
    args: [],
    returnType: 'boolean',
    implementation: () => false,
    examples: ['FALSE()'],
  },
  {
    name: 'CHOOSE',
    category: 'logic',
    description: 'Returns a value from a list based on index',
    args: [
      { name: 'index', type: 'number', required: true, description: '1-based index' },
      { name: 'values', type: ['string', 'number'], required: true },
    ],
    returnType: 'string',
    minArgs: 2,
    maxArgs: -1,
    implementation: (args) => {
      const index = typeof args[0] === 'number' ? Math.floor(args[0]) : 0;
      if (index < 1 || index >= args.length) {
        return null;
      }
      return args[index];
    },
    examples: ['CHOOSE(2, "A", "B", "C") → "B"'],
  },
  {
    name: 'BETWEEN',
    category: 'logic',
    description: 'Returns TRUE if value is between min and max (inclusive)',
    args: [
      { name: 'value', type: 'number', required: true },
      { name: 'min', type: 'number', required: true },
      { name: 'max', type: 'number', required: true },
    ],
    returnType: 'boolean',
    implementation: (args) => {
      const value = typeof args[0] === 'number' ? args[0] : parseFloat(String(args[0]));
      const min = typeof args[1] === 'number' ? args[1] : parseFloat(String(args[1]));
      const max = typeof args[2] === 'number' ? args[2] : parseFloat(String(args[2]));
      return value >= min && value <= max;
    },
    examples: ['BETWEEN(Score, 0, 100)'],
  },
  {
    name: 'IN',
    category: 'logic',
    description: 'Returns TRUE if value is in the list',
    args: [
      { name: 'value', type: ['string', 'number'], required: true },
      { name: 'list', type: ['string', 'number', 'array'], required: true },
    ],
    returnType: 'boolean',
    minArgs: 2,
    maxArgs: -1,
    implementation: (args) => {
      const value = args[0];
      const list = args.slice(1);
      // Flatten arrays in the list
      const flatList = list.flatMap((item) => (Array.isArray(item) ? item : [item]));
      return flatList.some((item) => item === value);
    },
    examples: ['IN(Status, "Active", "Pending", "Approved")'],
  },
];
