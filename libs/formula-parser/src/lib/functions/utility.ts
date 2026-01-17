/**
 * Utility functions for formulas
 */

import { FormulaFunction } from '../function-registry';
import { FormulaValue } from '../types';
import { FormulaContext } from '../context';

const toString = (value: FormulaValue): string => {
  if (value === null || value === undefined) return '';
  if (typeof value === 'string') return value;
  if (value instanceof Date) return value.toISOString();
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
};

const toNumber = (value: FormulaValue): number => {
  if (value === null || value === undefined) return 0;
  if (typeof value === 'number') return value;
  if (typeof value === 'string') {
    const num = parseFloat(value);
    return isNaN(num) ? 0 : num;
  }
  return 0;
};

export const utilityFunctions: FormulaFunction[] = [
  {
    name: 'TYPE',
    category: 'utility',
    description: 'Returns the type of a value',
    args: [{ name: 'value', type: ['string', 'number', 'boolean', 'null', 'array', 'object'], required: true }],
    returnType: 'string',
    implementation: (args) => {
      const value = args[0];
      if (value === null) return 'null';
      if (value === undefined) return 'undefined';
      if (Array.isArray(value)) return 'array';
      if (value instanceof Date) return 'date';
      return typeof value;
    },
    examples: ['TYPE(123) → "number"', 'TYPE("hello") → "string"'],
  },
  {
    name: 'TOSTRING',
    category: 'utility',
    description: 'Converts a value to string',
    args: [{ name: 'value', type: ['string', 'number', 'boolean', 'null'], required: true }],
    returnType: 'string',
    implementation: (args) => toString(args[0]),
    examples: ['TOSTRING(123) → "123"'],
  },
  {
    name: 'TONUMBER',
    category: 'utility',
    description: 'Converts a value to number',
    args: [{ name: 'value', type: ['string', 'number', 'null'], required: true }],
    returnType: 'number',
    implementation: (args) => toNumber(args[0]),
    examples: ['TONUMBER("123.45") → 123.45'],
  },
  {
    name: 'TOBOOLEAN',
    category: 'utility',
    description: 'Converts a value to boolean',
    args: [{ name: 'value', type: ['string', 'number', 'boolean', 'null'], required: true }],
    returnType: 'boolean',
    implementation: (args) => {
      const value = args[0];
      if (value === null || value === undefined) return false;
      if (typeof value === 'boolean') return value;
      if (typeof value === 'number') return value !== 0;
      if (typeof value === 'string') {
        const lower = value.toLowerCase().trim();
        return lower === 'true' || lower === '1' || lower === 'yes';
      }
      return Boolean(value);
    },
    examples: ['TOBOOLEAN("true") → TRUE', 'TOBOOLEAN(0) → FALSE'],
  },
  {
    name: 'TODATE',
    category: 'utility',
    description: 'Converts a value to date',
    args: [{ name: 'value', type: ['string', 'number', 'date'], required: true }],
    returnType: 'date',
    implementation: (args) => {
      const value = args[0];
      if (value === null || value === undefined) return null;
      if (value instanceof Date) return value;
      if (typeof value === 'number') return new Date(value);
      if (typeof value === 'string') {
        const date = new Date(value);
        return isNaN(date.getTime()) ? null : date;
      }
      return null;
    },
    examples: ['TODATE("2025-01-15") → January 15, 2025'],
  },
  {
    name: 'TOJSON',
    category: 'utility',
    description: 'Converts a value to JSON string',
    args: [{ name: 'value', type: ['string', 'number', 'boolean', 'null', 'array', 'object'], required: true }],
    returnType: 'string',
    implementation: (args) => {
      try {
        return JSON.stringify(args[0]);
      } catch {
        return 'null';
      }
    },
    examples: ['TOJSON({a: 1}) → \'{"a":1}\''],
  },
  {
    name: 'FROMJSON',
    category: 'utility',
    description: 'Parses a JSON string',
    args: [{ name: 'json', type: 'string', required: true }],
    returnType: 'object',
    implementation: (args) => {
      try {
        return JSON.parse(toString(args[0]));
      } catch {
        return null;
      }
    },
    examples: ['FROMJSON(\'{"a":1}\') → {a: 1}'],
  },
  {
    name: 'ENCODE',
    category: 'utility',
    description: 'URL-encodes a string',
    args: [{ name: 'text', type: 'string', required: true }],
    returnType: 'string',
    implementation: (args) => encodeURIComponent(toString(args[0])),
    examples: ['ENCODE("hello world") → "hello%20world"'],
  },
  {
    name: 'DECODE',
    category: 'utility',
    description: 'URL-decodes a string',
    args: [{ name: 'text', type: 'string', required: true }],
    returnType: 'string',
    implementation: (args) => {
      try {
        return decodeURIComponent(toString(args[0]));
      } catch {
        return toString(args[0]);
      }
    },
    examples: ['DECODE("hello%20world") → "hello world"'],
  },
  {
    name: 'UUID',
    category: 'utility',
    description: 'Generates a new UUID',
    args: [],
    returnType: 'string',
    implementation: () => {
      // Simple UUID v4 generation
      return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
        const r = (Math.random() * 16) | 0;
        const v = c === 'x' ? r : (r & 0x3) | 0x8;
        return v.toString(16);
      });
    },
    examples: ['UUID() → "f47ac10b-58cc-4372-a567-0e02b2c3d479"'],
  },
  {
    name: 'HASH',
    category: 'utility',
    description: 'Returns a simple hash of a string',
    args: [{ name: 'text', type: 'string', required: true }],
    returnType: 'string',
    implementation: (args) => {
      const str = toString(args[0]);
      let hash = 0;
      for (let i = 0; i < str.length; i++) {
        const char = str.charCodeAt(i);
        hash = (hash << 5) - hash + char;
        hash = hash & hash;
      }
      return Math.abs(hash).toString(16).padStart(8, '0');
    },
    examples: ['HASH("hello") → "5d41402a"'],
  },
  {
    name: 'BASE64ENCODE',
    category: 'utility',
    description: 'Encodes a string to Base64',
    args: [{ name: 'text', type: 'string', required: true }],
    returnType: 'string',
    implementation: (args) => {
      const str = toString(args[0]);
      if (typeof btoa !== 'undefined') {
        return btoa(unescape(encodeURIComponent(str)));
      }
      return Buffer.from(str).toString('base64');
    },
    examples: ['BASE64ENCODE("hello") → "aGVsbG8="'],
  },
  {
    name: 'BASE64DECODE',
    category: 'utility',
    description: 'Decodes a Base64 string',
    args: [{ name: 'encoded', type: 'string', required: true }],
    returnType: 'string',
    implementation: (args) => {
      try {
        const str = toString(args[0]);
        if (typeof atob !== 'undefined') {
          return decodeURIComponent(escape(atob(str)));
        }
        return Buffer.from(str, 'base64').toString('utf-8');
      } catch {
        return '';
      }
    },
    examples: ['BASE64DECODE("aGVsbG8=") → "hello"'],
  },
  {
    name: 'LET',
    category: 'utility',
    description: 'Defines named variables for use in a formula',
    args: [
      { name: 'name', type: 'string', required: true },
      { name: 'value', type: ['string', 'number', 'boolean', 'null'], required: true },
      { name: 'expression', type: ['string', 'number', 'boolean', 'null'], required: true },
    ],
    returnType: 'string',
    minArgs: 3,
    maxArgs: -1,
    implementation: (args, _context: FormulaContext) => {
      // LET function returns the result of the final expression.
      // Variable binding is handled at the parser level.
      return args[args.length - 1];
    },
    examples: ['LET("x", 10, x * 2) → 20'],
  },
  {
    name: 'UNIQUE',
    category: 'utility',
    description: 'Returns unique values from an array',
    args: [{ name: 'array', type: 'array', required: true }],
    returnType: 'array',
    implementation: (args) => {
      const arr = Array.isArray(args[0]) ? args[0] : [args[0]];
      return [...new Set(arr.map((v) => (typeof v === 'object' ? JSON.stringify(v) : v)))].map((v) => {
        try {
          return JSON.parse(String(v));
        } catch {
          return v;
        }
      });
    },
    examples: ['UNIQUE([1, 2, 2, 3]) → [1, 2, 3]'],
  },
  {
    name: 'SORT',
    category: 'utility',
    description: 'Sorts an array',
    args: [
      { name: 'array', type: 'array', required: true },
      { name: 'ascending', type: 'boolean', required: false, defaultValue: true },
    ],
    returnType: 'array',
    implementation: (args) => {
      const arr = Array.isArray(args[0]) ? [...args[0]] : [args[0]];
      const ascending = args[1] !== false;

      arr.sort((a, b) => {
        if (typeof a === 'number' && typeof b === 'number') {
          return ascending ? a - b : b - a;
        }
        const strA = toString(a);
        const strB = toString(b);
        return ascending ? strA.localeCompare(strB) : strB.localeCompare(strA);
      });

      return arr;
    },
    examples: ['SORT([3, 1, 2]) → [1, 2, 3]'],
  },
  {
    name: 'REVERSE',
    category: 'utility',
    description: 'Reverses an array',
    args: [{ name: 'array', type: 'array', required: true }],
    returnType: 'array',
    implementation: (args) => {
      const arr = Array.isArray(args[0]) ? [...args[0]] : [args[0]];
      return arr.reverse();
    },
    examples: ['REVERSE([1, 2, 3]) → [3, 2, 1]'],
  },
  {
    name: 'FIRST',
    category: 'utility',
    description: 'Returns the first element of an array',
    args: [{ name: 'array', type: 'array', required: true }],
    returnType: 'string',
    implementation: (args) => {
      const arr = Array.isArray(args[0]) ? args[0] : [args[0]];
      return arr.length > 0 ? arr[0] : null;
    },
    examples: ['FIRST([1, 2, 3]) → 1'],
  },
  {
    name: 'LAST',
    category: 'utility',
    description: 'Returns the last element of an array',
    args: [{ name: 'array', type: 'array', required: true }],
    returnType: 'string',
    implementation: (args) => {
      const arr = Array.isArray(args[0]) ? args[0] : [args[0]];
      return arr.length > 0 ? arr[arr.length - 1] : null;
    },
    examples: ['LAST([1, 2, 3]) → 3'],
  },
  {
    name: 'NTH',
    category: 'utility',
    description: 'Returns the nth element of an array (1-based)',
    args: [
      { name: 'array', type: 'array', required: true },
      { name: 'index', type: 'number', required: true },
    ],
    returnType: 'string',
    implementation: (args) => {
      const arr = Array.isArray(args[0]) ? args[0] : [args[0]];
      const index = Math.floor(toNumber(args[1])) - 1;
      return index >= 0 && index < arr.length ? arr[index] : null;
    },
    examples: ['NTH([1, 2, 3], 2) → 2'],
  },
  {
    name: 'SLICE',
    category: 'utility',
    description: 'Returns a portion of an array',
    args: [
      { name: 'array', type: 'array', required: true },
      { name: 'start', type: 'number', required: true, description: '1-based start' },
      { name: 'end', type: 'number', required: false },
    ],
    returnType: 'array',
    implementation: (args) => {
      const arr = Array.isArray(args[0]) ? args[0] : [args[0]];
      const start = Math.floor(toNumber(args[1])) - 1;
      const end = args[2] !== undefined ? Math.floor(toNumber(args[2])) : undefined;
      return arr.slice(start, end);
    },
    examples: ['SLICE([1, 2, 3, 4, 5], 2, 4) → [2, 3, 4]'],
  },
  {
    name: 'FILTER',
    category: 'utility',
    description: 'Filters an array (returns non-blank values)',
    args: [{ name: 'array', type: 'array', required: true }],
    returnType: 'array',
    implementation: (args) => {
      const arr = Array.isArray(args[0]) ? args[0] : [args[0]];
      return arr.filter((v) => v !== null && v !== undefined && v !== '');
    },
    examples: ['FILTER([1, null, 2, "", 3]) → [1, 2, 3]'],
  },
  {
    name: 'FLATTEN',
    category: 'utility',
    description: 'Flattens a nested array',
    args: [{ name: 'array', type: 'array', required: true }],
    returnType: 'array',
    implementation: (args) => {
      const arr = Array.isArray(args[0]) ? args[0] : [args[0]];
      const flatten = (a: FormulaValue[]): FormulaValue[] => {
        const result: FormulaValue[] = [];
        for (const item of a) {
          if (Array.isArray(item)) {
            result.push(...flatten(item));
          } else {
            result.push(item);
          }
        }
        return result;
      };
      return flatten(arr);
    },
    examples: ['FLATTEN([[1, 2], [3, [4, 5]]]) → [1, 2, 3, 4, 5]'],
  },
  {
    name: 'ARRAYLEN',
    category: 'utility',
    description: 'Returns the length of an array',
    args: [{ name: 'array', type: 'array', required: true }],
    returnType: 'number',
    implementation: (args) => {
      const arr = Array.isArray(args[0]) ? args[0] : [args[0]];
      return arr.length;
    },
    examples: ['ARRAYLEN([1, 2, 3]) → 3'],
  },
  {
    name: 'ERROR',
    category: 'utility',
    description: 'Throws a custom error',
    args: [{ name: 'message', type: 'string', required: true }],
    returnType: 'null',
    implementation: (args) => {
      throw new Error(toString(args[0]));
    },
    examples: ['IF(Amount < 0, ERROR("Amount cannot be negative"), Amount)'],
  },
];
