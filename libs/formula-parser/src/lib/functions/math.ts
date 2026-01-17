/**
 * Math functions for formulas
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

export const mathFunctions: FormulaFunction[] = [
  {
    name: 'ABS',
    category: 'math',
    description: 'Returns the absolute value of a number',
    args: [{ name: 'value', type: 'number', required: true }],
    returnType: 'number',
    implementation: (args) => Math.abs(toNumber(args[0])),
    examples: ['ABS(-5) → 5', 'ABS(3.14) → 3.14'],
  },
  {
    name: 'ROUND',
    category: 'math',
    description: 'Rounds a number to a specified number of decimal places',
    args: [
      { name: 'value', type: 'number', required: true },
      { name: 'decimals', type: 'number', required: false, defaultValue: 0 },
    ],
    returnType: 'number',
    implementation: (args) => {
      const value = toNumber(args[0]);
      const decimals = args[1] !== undefined ? toNumber(args[1]) : 0;
      const factor = Math.pow(10, decimals);
      return Math.round(value * factor) / factor;
    },
    examples: ['ROUND(3.14159, 2) → 3.14', 'ROUND(2.5) → 3'],
  },
  {
    name: 'FLOOR',
    category: 'math',
    description: 'Rounds a number down to the nearest integer',
    args: [{ name: 'value', type: 'number', required: true }],
    returnType: 'number',
    implementation: (args) => Math.floor(toNumber(args[0])),
    examples: ['FLOOR(3.7) → 3', 'FLOOR(-2.1) → -3'],
  },
  {
    name: 'CEIL',
    category: 'math',
    description: 'Rounds a number up to the nearest integer',
    args: [{ name: 'value', type: 'number', required: true }],
    returnType: 'number',
    implementation: (args) => Math.ceil(toNumber(args[0])),
    examples: ['CEIL(3.2) → 4', 'CEIL(-2.9) → -2'],
  },
  {
    name: 'SQRT',
    category: 'math',
    description: 'Returns the square root of a number',
    args: [{ name: 'value', type: 'number', required: true }],
    returnType: 'number',
    implementation: (args) => Math.sqrt(toNumber(args[0])),
    examples: ['SQRT(16) → 4', 'SQRT(2) → 1.414...'],
  },
  {
    name: 'POWER',
    category: 'math',
    description: 'Returns a number raised to a power',
    args: [
      { name: 'base', type: 'number', required: true },
      { name: 'exponent', type: 'number', required: true },
    ],
    returnType: 'number',
    implementation: (args) => Math.pow(toNumber(args[0]), toNumber(args[1])),
    examples: ['POWER(2, 3) → 8', 'POWER(10, -1) → 0.1'],
  },
  {
    name: 'MOD',
    category: 'math',
    description: 'Returns the remainder of division',
    args: [
      { name: 'dividend', type: 'number', required: true },
      { name: 'divisor', type: 'number', required: true },
    ],
    returnType: 'number',
    implementation: (args) => toNumber(args[0]) % toNumber(args[1]),
    examples: ['MOD(10, 3) → 1', 'MOD(7, 2) → 1'],
  },
  {
    name: 'LOG',
    category: 'math',
    description: 'Returns the natural logarithm of a number',
    args: [{ name: 'value', type: 'number', required: true }],
    returnType: 'number',
    implementation: (args) => Math.log(toNumber(args[0])),
    examples: ['LOG(E) → 1', 'LOG(10) → 2.302...'],
  },
  {
    name: 'LOG10',
    category: 'math',
    description: 'Returns the base-10 logarithm of a number',
    args: [{ name: 'value', type: 'number', required: true }],
    returnType: 'number',
    implementation: (args) => Math.log10(toNumber(args[0])),
    examples: ['LOG10(100) → 2', 'LOG10(1000) → 3'],
  },
  {
    name: 'EXP',
    category: 'math',
    description: 'Returns e raised to a power',
    args: [{ name: 'exponent', type: 'number', required: true }],
    returnType: 'number',
    implementation: (args) => Math.exp(toNumber(args[0])),
    examples: ['EXP(1) → 2.718...', 'EXP(0) → 1'],
  },
  {
    name: 'SIN',
    category: 'math',
    description: 'Returns the sine of an angle in radians',
    args: [{ name: 'angle', type: 'number', required: true }],
    returnType: 'number',
    implementation: (args) => Math.sin(toNumber(args[0])),
    examples: ['SIN(0) → 0', 'SIN(PI/2) → 1'],
  },
  {
    name: 'COS',
    category: 'math',
    description: 'Returns the cosine of an angle in radians',
    args: [{ name: 'angle', type: 'number', required: true }],
    returnType: 'number',
    implementation: (args) => Math.cos(toNumber(args[0])),
    examples: ['COS(0) → 1', 'COS(PI) → -1'],
  },
  {
    name: 'TAN',
    category: 'math',
    description: 'Returns the tangent of an angle in radians',
    args: [{ name: 'angle', type: 'number', required: true }],
    returnType: 'number',
    implementation: (args) => Math.tan(toNumber(args[0])),
    examples: ['TAN(0) → 0', 'TAN(PI/4) → 1'],
  },
  {
    name: 'RADIANS',
    category: 'math',
    description: 'Converts degrees to radians',
    args: [{ name: 'degrees', type: 'number', required: true }],
    returnType: 'number',
    implementation: (args) => (toNumber(args[0]) * Math.PI) / 180,
    examples: ['RADIANS(180) → 3.14159...', 'RADIANS(90) → 1.5707...'],
  },
  {
    name: 'DEGREES',
    category: 'math',
    description: 'Converts radians to degrees',
    args: [{ name: 'radians', type: 'number', required: true }],
    returnType: 'number',
    implementation: (args) => (toNumber(args[0]) * 180) / Math.PI,
    examples: ['DEGREES(PI) → 180', 'DEGREES(PI/2) → 90'],
  },
  {
    name: 'RANDOM',
    category: 'math',
    description: 'Returns a random number between 0 and 1',
    args: [],
    returnType: 'number',
    implementation: () => Math.random(),
    examples: ['RANDOM() → 0.123... (varies)'],
  },
  {
    name: 'RANDBETWEEN',
    category: 'math',
    description: 'Returns a random integer between min and max (inclusive)',
    args: [
      { name: 'min', type: 'number', required: true },
      { name: 'max', type: 'number', required: true },
    ],
    returnType: 'number',
    implementation: (args) => {
      const min = Math.ceil(toNumber(args[0]));
      const max = Math.floor(toNumber(args[1]));
      return Math.floor(Math.random() * (max - min + 1)) + min;
    },
    examples: ['RANDBETWEEN(1, 10) → 7 (varies)'],
  },
  {
    name: 'SIGN',
    category: 'math',
    description: 'Returns the sign of a number (-1, 0, or 1)',
    args: [{ name: 'value', type: 'number', required: true }],
    returnType: 'number',
    implementation: (args) => Math.sign(toNumber(args[0])),
    examples: ['SIGN(-5) → -1', 'SIGN(0) → 0', 'SIGN(3) → 1'],
  },
  {
    name: 'TRUNC',
    category: 'math',
    description: 'Truncates a number to a specified number of decimal places',
    args: [
      { name: 'value', type: 'number', required: true },
      { name: 'decimals', type: 'number', required: false, defaultValue: 0 },
    ],
    returnType: 'number',
    implementation: (args) => {
      const value = toNumber(args[0]);
      const decimals = args[1] !== undefined ? toNumber(args[1]) : 0;
      const factor = Math.pow(10, decimals);
      return Math.trunc(value * factor) / factor;
    },
    examples: ['TRUNC(3.14159, 2) → 3.14', 'TRUNC(-2.7) → -2'],
  },
];
