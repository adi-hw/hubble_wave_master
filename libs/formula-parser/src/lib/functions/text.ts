/**
 * Text functions for formulas
 */

import { FormulaFunction } from '../function-registry';
import { FormulaValue } from '../types';

const toString = (value: FormulaValue): string => {
  if (value === null || value === undefined) return '';
  if (typeof value === 'string') return value;
  if (value instanceof Date) return value.toISOString();
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

export const textFunctions: FormulaFunction[] = [
  {
    name: 'CONCAT',
    category: 'text',
    description: 'Concatenates multiple values into a single string',
    args: [{ name: 'values', type: 'string', required: true }],
    returnType: 'string',
    minArgs: 1,
    maxArgs: -1,
    implementation: (args) => args.map(toString).join(''),
    examples: ['CONCAT("Hello", " ", "World") → "Hello World"'],
  },
  {
    name: 'CONCATENATE',
    category: 'text',
    description: 'Concatenates multiple values into a single string (alias for CONCAT)',
    args: [{ name: 'values', type: 'string', required: true }],
    returnType: 'string',
    minArgs: 1,
    maxArgs: -1,
    implementation: (args) => args.map(toString).join(''),
    examples: ['CONCATENATE("A", "B", "C") → "ABC"'],
  },
  {
    name: 'LEFT',
    category: 'text',
    description: 'Returns the leftmost characters from a string',
    args: [
      { name: 'text', type: 'string', required: true },
      { name: 'count', type: 'number', required: true },
    ],
    returnType: 'string',
    implementation: (args) => toString(args[0]).slice(0, toNumber(args[1])),
    examples: ['LEFT("Hello", 2) → "He"'],
  },
  {
    name: 'RIGHT',
    category: 'text',
    description: 'Returns the rightmost characters from a string',
    args: [
      { name: 'text', type: 'string', required: true },
      { name: 'count', type: 'number', required: true },
    ],
    returnType: 'string',
    implementation: (args) => {
      const str = toString(args[0]);
      const count = toNumber(args[1]);
      return str.slice(-count);
    },
    examples: ['RIGHT("Hello", 2) → "lo"'],
  },
  {
    name: 'MID',
    category: 'text',
    description: 'Returns a substring from the middle of a string',
    args: [
      { name: 'text', type: 'string', required: true },
      { name: 'start', type: 'number', required: true, description: '1-based start position' },
      { name: 'length', type: 'number', required: true },
    ],
    returnType: 'string',
    implementation: (args) => {
      const str = toString(args[0]);
      const start = toNumber(args[1]) - 1; // Convert to 0-based
      const length = toNumber(args[2]);
      return str.slice(start, start + length);
    },
    examples: ['MID("Hello", 2, 3) → "ell"'],
  },
  {
    name: 'LEN',
    category: 'text',
    description: 'Returns the length of a string',
    args: [{ name: 'text', type: 'string', required: true }],
    returnType: 'number',
    implementation: (args) => toString(args[0]).length,
    examples: ['LEN("Hello") → 5'],
  },
  {
    name: 'UPPER',
    category: 'text',
    description: 'Converts text to uppercase',
    args: [{ name: 'text', type: 'string', required: true }],
    returnType: 'string',
    implementation: (args) => toString(args[0]).toUpperCase(),
    examples: ['UPPER("hello") → "HELLO"'],
  },
  {
    name: 'LOWER',
    category: 'text',
    description: 'Converts text to lowercase',
    args: [{ name: 'text', type: 'string', required: true }],
    returnType: 'string',
    implementation: (args) => toString(args[0]).toLowerCase(),
    examples: ['LOWER("HELLO") → "hello"'],
  },
  {
    name: 'PROPER',
    category: 'text',
    description: 'Capitalizes the first letter of each word',
    args: [{ name: 'text', type: 'string', required: true }],
    returnType: 'string',
    implementation: (args) =>
      toString(args[0])
        .toLowerCase()
        .replace(/\b\w/g, (c) => c.toUpperCase()),
    examples: ['PROPER("hello world") → "Hello World"'],
  },
  {
    name: 'TRIM',
    category: 'text',
    description: 'Removes leading and trailing whitespace',
    args: [{ name: 'text', type: 'string', required: true }],
    returnType: 'string',
    implementation: (args) => toString(args[0]).trim(),
    examples: ['TRIM("  hello  ") → "hello"'],
  },
  {
    name: 'REPLACE',
    category: 'text',
    description: 'Replaces occurrences of a substring',
    args: [
      { name: 'text', type: 'string', required: true },
      { name: 'search', type: 'string', required: true },
      { name: 'replacement', type: 'string', required: true },
    ],
    returnType: 'string',
    implementation: (args) =>
      toString(args[0]).split(toString(args[1])).join(toString(args[2])),
    examples: ['REPLACE("Hello World", "World", "Universe") → "Hello Universe"'],
  },
  {
    name: 'SUBSTITUTE',
    category: 'text',
    description: 'Replaces specific occurrences of a substring',
    args: [
      { name: 'text', type: 'string', required: true },
      { name: 'search', type: 'string', required: true },
      { name: 'replacement', type: 'string', required: true },
      { name: 'occurrence', type: 'number', required: false },
    ],
    returnType: 'string',
    implementation: (args) => {
      const text = toString(args[0]);
      const search = toString(args[1]);
      const replacement = toString(args[2]);
      const occurrence = args[3] !== undefined ? toNumber(args[3]) : 0;

      if (occurrence === 0) {
        return text.split(search).join(replacement);
      }

      let count = 0;
      return text.replace(new RegExp(search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'), (match) => {
        count++;
        return count === occurrence ? replacement : match;
      });
    },
    examples: ['SUBSTITUTE("a-b-c", "-", "/") → "a/b/c"'],
  },
  {
    name: 'FIND',
    category: 'text',
    description: 'Finds the position of a substring (case-sensitive)',
    args: [
      { name: 'search', type: 'string', required: true },
      { name: 'text', type: 'string', required: true },
      { name: 'start', type: 'number', required: false, defaultValue: 1 },
    ],
    returnType: 'number',
    implementation: (args) => {
      const search = toString(args[0]);
      const text = toString(args[1]);
      const start = args[2] !== undefined ? toNumber(args[2]) - 1 : 0;
      const pos = text.indexOf(search, start);
      return pos === -1 ? 0 : pos + 1; // Return 1-based position or 0 if not found
    },
    examples: ['FIND("o", "Hello") → 5'],
  },
  {
    name: 'SEARCH',
    category: 'text',
    description: 'Finds the position of a substring (case-insensitive)',
    args: [
      { name: 'search', type: 'string', required: true },
      { name: 'text', type: 'string', required: true },
      { name: 'start', type: 'number', required: false, defaultValue: 1 },
    ],
    returnType: 'number',
    implementation: (args) => {
      const search = toString(args[0]).toLowerCase();
      const text = toString(args[1]).toLowerCase();
      const start = args[2] !== undefined ? toNumber(args[2]) - 1 : 0;
      const pos = text.indexOf(search, start);
      return pos === -1 ? 0 : pos + 1;
    },
    examples: ['SEARCH("O", "Hello") → 5'],
  },
  {
    name: 'REPT',
    category: 'text',
    description: 'Repeats text a specified number of times',
    args: [
      { name: 'text', type: 'string', required: true },
      { name: 'count', type: 'number', required: true },
    ],
    returnType: 'string',
    implementation: (args) => toString(args[0]).repeat(Math.max(0, toNumber(args[1]))),
    examples: ['REPT("*", 5) → "*****"'],
  },
  {
    name: 'TEXT',
    category: 'text',
    description: 'Formats a value as text using a format string',
    args: [
      { name: 'value', type: ['number', 'date'], required: true },
      { name: 'format', type: 'string', required: true },
    ],
    returnType: 'string',
    implementation: (args) => {
      const value = args[0];
      const format = toString(args[1]);

      if (value instanceof Date) {
        // Basic date formatting
        const pad = (n: number) => n.toString().padStart(2, '0');
        return format
          .replace('YYYY', value.getFullYear().toString())
          .replace('YY', value.getFullYear().toString().slice(-2))
          .replace('MM', pad(value.getMonth() + 1))
          .replace('DD', pad(value.getDate()))
          .replace('HH', pad(value.getHours()))
          .replace('mm', pad(value.getMinutes()))
          .replace('ss', pad(value.getSeconds()));
      }

      if (typeof value === 'number') {
        // Basic number formatting
        if (format.includes('.')) {
          const decimals = format.split('.')[1]?.length || 0;
          return value.toFixed(decimals);
        }
        return value.toString();
      }

      return toString(value);
    },
    examples: ['TEXT(1234.5, "0.00") → "1234.50"'],
  },
  {
    name: 'VALUE',
    category: 'text',
    description: 'Converts text to a number',
    args: [{ name: 'text', type: 'string', required: true }],
    returnType: 'number',
    implementation: (args) => {
      const num = parseFloat(toString(args[0]));
      return isNaN(num) ? 0 : num;
    },
    examples: ['VALUE("123.45") → 123.45'],
  },
  {
    name: 'SPLIT',
    category: 'text',
    description: 'Splits text by a delimiter into an array',
    args: [
      { name: 'text', type: 'string', required: true },
      { name: 'delimiter', type: 'string', required: true },
    ],
    returnType: 'array',
    implementation: (args) => toString(args[0]).split(toString(args[1])),
    examples: ['SPLIT("a,b,c", ",") → ["a", "b", "c"]'],
  },
  {
    name: 'JOIN',
    category: 'text',
    description: 'Joins array elements into a string',
    args: [
      { name: 'array', type: 'array', required: true },
      { name: 'delimiter', type: 'string', required: false, defaultValue: ',' },
    ],
    returnType: 'string',
    implementation: (args) => {
      const arr = Array.isArray(args[0]) ? args[0] : [args[0]];
      const delimiter = args[1] !== undefined ? toString(args[1]) : ',';
      return arr.map(toString).join(delimiter);
    },
    examples: ['JOIN(["a", "b", "c"], "-") → "a-b-c"'],
  },
  {
    name: 'CONTAINS',
    category: 'text',
    description: 'Checks if text contains a substring',
    args: [
      { name: 'text', type: 'string', required: true },
      { name: 'search', type: 'string', required: true },
    ],
    returnType: 'boolean',
    implementation: (args) => toString(args[0]).includes(toString(args[1])),
    examples: ['CONTAINS("Hello World", "World") → TRUE'],
  },
  {
    name: 'STARTSWITH',
    category: 'text',
    description: 'Checks if text starts with a substring',
    args: [
      { name: 'text', type: 'string', required: true },
      { name: 'search', type: 'string', required: true },
    ],
    returnType: 'boolean',
    implementation: (args) => toString(args[0]).startsWith(toString(args[1])),
    examples: ['STARTSWITH("Hello", "He") → TRUE'],
  },
  {
    name: 'ENDSWITH',
    category: 'text',
    description: 'Checks if text ends with a substring',
    args: [
      { name: 'text', type: 'string', required: true },
      { name: 'search', type: 'string', required: true },
    ],
    returnType: 'boolean',
    implementation: (args) => toString(args[0]).endsWith(toString(args[1])),
    examples: ['ENDSWITH("Hello", "lo") → TRUE'],
  },
  {
    name: 'REGEX',
    category: 'text',
    description: 'Tests if text matches a regular expression',
    args: [
      { name: 'text', type: 'string', required: true },
      { name: 'pattern', type: 'string', required: true },
    ],
    returnType: 'boolean',
    implementation: (args) => {
      try {
        const regex = new RegExp(toString(args[1]));
        return regex.test(toString(args[0]));
      } catch {
        return false;
      }
    },
    examples: ['REGEX("test123", "^[a-z]+\\d+$") → TRUE'],
  },
];
