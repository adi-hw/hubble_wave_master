/**
 * Date functions for formulas
 */

import { FormulaFunction } from '../function-registry';
import { FormulaValue } from '../types';
import { FormulaContext } from '../context';

const toDate = (value: FormulaValue): Date | null => {
  if (value === null || value === undefined) return null;
  if (value instanceof Date) return value;
  if (typeof value === 'string') {
    const date = new Date(value);
    return isNaN(date.getTime()) ? null : date;
  }
  if (typeof value === 'number') {
    return new Date(value);
  }
  return null;
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

const toString = (value: FormulaValue): string => {
  if (value === null || value === undefined) return '';
  if (typeof value === 'string') return value;
  return String(value);
};

export const dateFunctions: FormulaFunction[] = [
  {
    name: 'NOW',
    category: 'date',
    description: 'Returns the current date and time',
    args: [],
    returnType: 'datetime',
    implementation: (_args, context: FormulaContext) => context.now || new Date(),
    examples: ['NOW() → current datetime'],
  },
  {
    name: 'TODAY',
    category: 'date',
    description: 'Returns the current date (without time)',
    args: [],
    returnType: 'date',
    implementation: (_args, context: FormulaContext) => {
      const now = context.now || new Date();
      return new Date(now.getFullYear(), now.getMonth(), now.getDate());
    },
    examples: ['TODAY() → current date'],
  },
  {
    name: 'DATE',
    category: 'date',
    description: 'Creates a date from year, month, and day',
    args: [
      { name: 'year', type: 'number', required: true },
      { name: 'month', type: 'number', required: true, description: '1-12' },
      { name: 'day', type: 'number', required: true },
    ],
    returnType: 'date',
    implementation: (args) => {
      const year = toNumber(args[0]);
      const month = toNumber(args[1]) - 1; // JavaScript months are 0-indexed
      const day = toNumber(args[2]);
      return new Date(year, month, day);
    },
    examples: ['DATE(2025, 1, 15) → January 15, 2025'],
  },
  {
    name: 'DATETIME',
    category: 'date',
    description: 'Creates a datetime from components',
    args: [
      { name: 'year', type: 'number', required: true },
      { name: 'month', type: 'number', required: true },
      { name: 'day', type: 'number', required: true },
      { name: 'hour', type: 'number', required: false, defaultValue: 0 },
      { name: 'minute', type: 'number', required: false, defaultValue: 0 },
      { name: 'second', type: 'number', required: false, defaultValue: 0 },
    ],
    returnType: 'datetime',
    implementation: (args) => {
      const year = toNumber(args[0]);
      const month = toNumber(args[1]) - 1;
      const day = toNumber(args[2]);
      const hour = args[3] !== undefined ? toNumber(args[3]) : 0;
      const minute = args[4] !== undefined ? toNumber(args[4]) : 0;
      const second = args[5] !== undefined ? toNumber(args[5]) : 0;
      return new Date(year, month, day, hour, minute, second);
    },
    examples: ['DATETIME(2025, 1, 15, 14, 30, 0)'],
  },
  {
    name: 'YEAR',
    category: 'date',
    description: 'Extracts the year from a date',
    args: [{ name: 'date', type: 'date', required: true }],
    returnType: 'number',
    implementation: (args) => {
      const date = toDate(args[0]);
      return date ? date.getFullYear() : 0;
    },
    examples: ['YEAR(DATE(2025, 1, 15)) → 2025'],
  },
  {
    name: 'MONTH',
    category: 'date',
    description: 'Extracts the month from a date (1-12)',
    args: [{ name: 'date', type: 'date', required: true }],
    returnType: 'number',
    implementation: (args) => {
      const date = toDate(args[0]);
      return date ? date.getMonth() + 1 : 0;
    },
    examples: ['MONTH(DATE(2025, 1, 15)) → 1'],
  },
  {
    name: 'DAY',
    category: 'date',
    description: 'Extracts the day of the month from a date',
    args: [{ name: 'date', type: 'date', required: true }],
    returnType: 'number',
    implementation: (args) => {
      const date = toDate(args[0]);
      return date ? date.getDate() : 0;
    },
    examples: ['DAY(DATE(2025, 1, 15)) → 15'],
  },
  {
    name: 'HOUR',
    category: 'date',
    description: 'Extracts the hour from a datetime (0-23)',
    args: [{ name: 'datetime', type: 'datetime', required: true }],
    returnType: 'number',
    implementation: (args) => {
      const date = toDate(args[0]);
      return date ? date.getHours() : 0;
    },
    examples: ['HOUR(NOW()) → current hour'],
  },
  {
    name: 'MINUTE',
    category: 'date',
    description: 'Extracts the minute from a datetime (0-59)',
    args: [{ name: 'datetime', type: 'datetime', required: true }],
    returnType: 'number',
    implementation: (args) => {
      const date = toDate(args[0]);
      return date ? date.getMinutes() : 0;
    },
    examples: ['MINUTE(NOW()) → current minute'],
  },
  {
    name: 'SECOND',
    category: 'date',
    description: 'Extracts the second from a datetime (0-59)',
    args: [{ name: 'datetime', type: 'datetime', required: true }],
    returnType: 'number',
    implementation: (args) => {
      const date = toDate(args[0]);
      return date ? date.getSeconds() : 0;
    },
    examples: ['SECOND(NOW()) → current second'],
  },
  {
    name: 'WEEKDAY',
    category: 'date',
    description: 'Returns the day of the week (1=Sunday, 7=Saturday)',
    args: [
      { name: 'date', type: 'date', required: true },
      { name: 'startDay', type: 'number', required: false, defaultValue: 1, description: '1=Sunday, 2=Monday' },
    ],
    returnType: 'number',
    implementation: (args) => {
      const date = toDate(args[0]);
      if (!date) return 0;
      const startDay = args[1] !== undefined ? toNumber(args[1]) : 1;
      const day = date.getDay(); // 0=Sunday
      if (startDay === 1) {
        return day + 1; // 1=Sunday
      }
      return day === 0 ? 7 : day; // 1=Monday, 7=Sunday
    },
    examples: ['WEEKDAY(DATE(2025, 1, 15)) → 4 (Wednesday)'],
  },
  {
    name: 'WEEKNUM',
    category: 'date',
    description: 'Returns the week number of the year',
    args: [{ name: 'date', type: 'date', required: true }],
    returnType: 'number',
    implementation: (args) => {
      const date = toDate(args[0]);
      if (!date) return 0;
      const startOfYear = new Date(date.getFullYear(), 0, 1);
      const days = Math.floor((date.getTime() - startOfYear.getTime()) / (24 * 60 * 60 * 1000));
      return Math.ceil((days + startOfYear.getDay() + 1) / 7);
    },
    examples: ['WEEKNUM(DATE(2025, 1, 15)) → 3'],
  },
  {
    name: 'DATEADD',
    category: 'date',
    description: 'Adds a number of units to a date',
    args: [
      { name: 'date', type: 'date', required: true },
      { name: 'amount', type: 'number', required: true },
      { name: 'unit', type: 'string', required: true, description: 'years, months, days, hours, minutes, seconds' },
    ],
    returnType: 'date',
    implementation: (args) => {
      const date = toDate(args[0]);
      if (!date) return null;
      const amount = toNumber(args[1]);
      const unit = toString(args[2]).toLowerCase();
      const result = new Date(date);

      switch (unit) {
        case 'years':
        case 'year':
        case 'y':
          result.setFullYear(result.getFullYear() + amount);
          break;
        case 'months':
        case 'month':
        case 'm':
          result.setMonth(result.getMonth() + amount);
          break;
        case 'days':
        case 'day':
        case 'd':
          result.setDate(result.getDate() + amount);
          break;
        case 'hours':
        case 'hour':
        case 'h':
          result.setHours(result.getHours() + amount);
          break;
        case 'minutes':
        case 'minute':
        case 'min':
          result.setMinutes(result.getMinutes() + amount);
          break;
        case 'seconds':
        case 'second':
        case 's':
          result.setSeconds(result.getSeconds() + amount);
          break;
      }

      return result;
    },
    examples: ['DATEADD(TODAY(), 7, "days")'],
  },
  {
    name: 'DATEDIFF',
    category: 'date',
    description: 'Returns the difference between two dates in specified units',
    args: [
      { name: 'startDate', type: 'date', required: true },
      { name: 'endDate', type: 'date', required: true },
      { name: 'unit', type: 'string', required: true, description: 'years, months, days, hours, minutes, seconds' },
    ],
    returnType: 'number',
    implementation: (args) => {
      const start = toDate(args[0]);
      const end = toDate(args[1]);
      if (!start || !end) return 0;
      const unit = toString(args[2]).toLowerCase();
      const diffMs = end.getTime() - start.getTime();

      switch (unit) {
        case 'years':
        case 'year':
        case 'y':
          return end.getFullYear() - start.getFullYear();
        case 'months':
        case 'month':
        case 'm':
          return (end.getFullYear() - start.getFullYear()) * 12 + (end.getMonth() - start.getMonth());
        case 'days':
        case 'day':
        case 'd':
          return Math.floor(diffMs / (24 * 60 * 60 * 1000));
        case 'hours':
        case 'hour':
        case 'h':
          return Math.floor(diffMs / (60 * 60 * 1000));
        case 'minutes':
        case 'minute':
        case 'min':
          return Math.floor(diffMs / (60 * 1000));
        case 'seconds':
        case 'second':
        case 's':
          return Math.floor(diffMs / 1000);
        default:
          return Math.floor(diffMs / (24 * 60 * 60 * 1000));
      }
    },
    examples: ['DATEDIFF(DATE(2025, 1, 1), DATE(2025, 1, 15), "days") → 14'],
  },
  {
    name: 'EOMONTH',
    category: 'date',
    description: 'Returns the last day of the month, offset by a number of months',
    args: [
      { name: 'date', type: 'date', required: true },
      { name: 'months', type: 'number', required: false, defaultValue: 0 },
    ],
    returnType: 'date',
    implementation: (args) => {
      const date = toDate(args[0]);
      if (!date) return null;
      const months = args[1] !== undefined ? toNumber(args[1]) : 0;
      const result = new Date(date.getFullYear(), date.getMonth() + months + 1, 0);
      return result;
    },
    examples: ['EOMONTH(DATE(2025, 1, 15), 0) → January 31, 2025'],
  },
  {
    name: 'WORKDAY',
    category: 'date',
    description: 'Returns a date that is a specified number of workdays away',
    args: [
      { name: 'startDate', type: 'date', required: true },
      { name: 'days', type: 'number', required: true },
    ],
    returnType: 'date',
    implementation: (args) => {
      const start = toDate(args[0]);
      if (!start) return null;
      let days = toNumber(args[1]);
      const result = new Date(start);
      const direction = days > 0 ? 1 : -1;
      days = Math.abs(days);

      while (days > 0) {
        result.setDate(result.getDate() + direction);
        const dayOfWeek = result.getDay();
        if (dayOfWeek !== 0 && dayOfWeek !== 6) {
          days--;
        }
      }

      return result;
    },
    examples: ['WORKDAY(DATE(2025, 1, 15), 5) → 5 business days later'],
  },
  {
    name: 'NETWORKDAYS',
    category: 'date',
    description: 'Returns the number of workdays between two dates',
    args: [
      { name: 'startDate', type: 'date', required: true },
      { name: 'endDate', type: 'date', required: true },
    ],
    returnType: 'number',
    implementation: (args) => {
      const start = toDate(args[0]);
      const end = toDate(args[1]);
      if (!start || !end) return 0;

      let count = 0;
      const current = new Date(start);
      const direction = end >= start ? 1 : -1;
      const endTime = end.getTime();

      while ((direction > 0 && current.getTime() <= endTime) || (direction < 0 && current.getTime() >= endTime)) {
        const dayOfWeek = current.getDay();
        if (dayOfWeek !== 0 && dayOfWeek !== 6) {
          count++;
        }
        current.setDate(current.getDate() + direction);
      }

      return direction > 0 ? count : -count;
    },
    examples: ['NETWORKDAYS(DATE(2025, 1, 1), DATE(2025, 1, 31)) → 23'],
  },
  {
    name: 'ISOWEEKNUM',
    category: 'date',
    description: 'Returns the ISO week number of the year',
    args: [{ name: 'date', type: 'date', required: true }],
    returnType: 'number',
    implementation: (args) => {
      const date = toDate(args[0]);
      if (!date) return 0;
      const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
      const dayNum = d.getUTCDay() || 7;
      d.setUTCDate(d.getUTCDate() + 4 - dayNum);
      const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
      return Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
    },
    examples: ['ISOWEEKNUM(DATE(2025, 1, 15)) → 3'],
  },
  {
    name: 'FORMATDATE',
    category: 'date',
    description: 'Formats a date as a string',
    args: [
      { name: 'date', type: 'date', required: true },
      { name: 'format', type: 'string', required: false, defaultValue: 'YYYY-MM-DD' },
    ],
    returnType: 'string',
    implementation: (args) => {
      const date = toDate(args[0]);
      if (!date) return '';
      const format = args[1] !== undefined ? toString(args[1]) : 'YYYY-MM-DD';
      const pad = (n: number) => n.toString().padStart(2, '0');

      return format
        .replace('YYYY', date.getFullYear().toString())
        .replace('YY', date.getFullYear().toString().slice(-2))
        .replace('MM', pad(date.getMonth() + 1))
        .replace('DD', pad(date.getDate()))
        .replace('HH', pad(date.getHours()))
        .replace('mm', pad(date.getMinutes()))
        .replace('ss', pad(date.getSeconds()));
    },
    examples: ['FORMATDATE(NOW(), "YYYY-MM-DD HH:mm") → "2025-01-15 14:30"'],
  },
];
