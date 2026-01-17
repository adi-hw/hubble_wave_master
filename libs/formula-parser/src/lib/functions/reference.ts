/**
 * Reference functions for formulas
 *
 * These functions handle lookups and references to related records.
 */

import { FormulaFunction } from '../function-registry';
import { FormulaValue } from '../types';
import { FormulaContext, RecordData } from '../context';

const toString = (value: FormulaValue): string => {
  if (value === null || value === undefined) return '';
  if (typeof value === 'string') return value;
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

export const referenceFunctions: FormulaFunction[] = [
  {
    name: 'LOOKUP',
    category: 'reference',
    description: 'Looks up a value from a related record',
    args: [
      { name: 'collectionCode', type: 'string', required: true },
      { name: 'referenceProperty', type: 'string', required: true },
      { name: 'sourceProperty', type: 'string', required: true },
    ],
    returnType: 'string',
    implementation: (args, context: FormulaContext) => {
      const collectionCode = toString(args[0]);
      const referenceProperty = toString(args[1]);
      const sourceProperty = toString(args[2]);

      // Get the reference value from current record
      const referenceId = context.record[referenceProperty];
      if (!referenceId) return null;

      // Look up in related records
      const relatedRecords = context.relatedRecords?.[collectionCode];
      if (!relatedRecords) return null;

      const refIdStr = toString(referenceId);
      const records = relatedRecords[refIdStr];
      if (!records || records.length === 0) return null;

      // Return the property value from the first matching record
      return records[0][sourceProperty] ?? null;
    },
    examples: ['LOOKUP("users", "assigned_to", "full_name")'],
  },
  {
    name: 'ROLLUP',
    category: 'reference',
    description: 'Aggregates values from related records',
    args: [
      { name: 'collectionCode', type: 'string', required: true },
      { name: 'referenceProperty', type: 'string', required: true },
      { name: 'sourceProperty', type: 'string', required: true },
      { name: 'aggregation', type: 'string', required: true, description: 'SUM, AVG, COUNT, MIN, MAX, CONCAT' },
      { name: 'filter', type: 'string', required: false },
    ],
    returnType: 'number',
    implementation: (args, context: FormulaContext) => {
      const collectionCode = toString(args[0]);
      const referenceProperty = toString(args[1]);
      const sourceProperty = toString(args[2]);
      const aggregation = toString(args[3]).toUpperCase();

      // Get the reference value from current record
      const referenceId = context.record[referenceProperty];
      if (!referenceId) {
        return aggregation === 'COUNT' || aggregation === 'COUNTA' || aggregation === 'COUNTALL' ? 0 : null;
      }

      // Look up in related records
      const relatedRecords = context.relatedRecords?.[collectionCode];
      if (!relatedRecords) {
        return aggregation === 'COUNT' || aggregation === 'COUNTA' || aggregation === 'COUNTALL' ? 0 : null;
      }

      const refIdStr = toString(referenceId);
      const records = relatedRecords[refIdStr] || [];

      // Extract values
      const values = records.map((r: RecordData) => r[sourceProperty]).filter((v) => v !== null && v !== undefined);

      switch (aggregation) {
        case 'SUM':
          return values.reduce((sum: number, v) => sum + toNumber(v), 0);

        case 'AVG':
        case 'AVERAGE':
          if (values.length === 0) return 0;
          return values.reduce((sum: number, v) => sum + toNumber(v), 0) / values.length;

        case 'COUNT':
          return values.filter((v) => typeof v === 'number').length;

        case 'COUNTA':
          return values.length;

        case 'COUNTALL':
          return records.length;

        case 'MIN':
          if (values.length === 0) return null;
          return Math.min(...values.map(toNumber));

        case 'MAX':
          if (values.length === 0) return null;
          return Math.max(...values.map(toNumber));

        case 'FIRST':
          return values.length > 0 ? values[0] : null;

        case 'LAST':
          return values.length > 0 ? values[values.length - 1] : null;

        case 'CONCAT':
          return values.map(toString).join(', ');

        case 'CONCAT_UNIQUE':
          return [...new Set(values.map(toString))].join(', ');

        default:
          return null;
      }
    },
    examples: [
      'ROLLUP("line_items", "order_id", "amount", "SUM")',
      'ROLLUP("tasks", "project_id", "status", "COUNT")',
    ],
  },
  {
    name: 'RELATED',
    category: 'reference',
    description: 'Returns an array of values from related records',
    args: [
      { name: 'collectionCode', type: 'string', required: true },
      { name: 'referenceProperty', type: 'string', required: true },
      { name: 'sourceProperty', type: 'string', required: true },
    ],
    returnType: 'array',
    implementation: (args, context: FormulaContext) => {
      const collectionCode = toString(args[0]);
      const referenceProperty = toString(args[1]);
      const sourceProperty = toString(args[2]);

      const referenceId = context.record[referenceProperty];
      if (!referenceId) return [];

      const relatedRecords = context.relatedRecords?.[collectionCode];
      if (!relatedRecords) return [];

      const refIdStr = toString(referenceId);
      const records = relatedRecords[refIdStr] || [];

      return records.map((r: RecordData) => r[sourceProperty]);
    },
    examples: ['RELATED("comments", "task_id", "text")'],
  },
  {
    name: 'RECORDID',
    category: 'reference',
    description: 'Returns the ID of the current record',
    args: [],
    returnType: 'string',
    implementation: (_args, context: FormulaContext) => {
      return context.record.id ?? context.record._id ?? null;
    },
    examples: ['RECORDID()'],
  },
  {
    name: 'AUTONUMBER',
    category: 'reference',
    description: 'Returns an auto-incrementing number (based on record count)',
    args: [{ name: 'prefix', type: 'string', required: false }],
    returnType: 'string',
    implementation: (args, context: FormulaContext) => {
      const prefix = args[0] !== undefined ? toString(args[0]) : '';
      const count = context.record._count ?? context.record.id ?? 1;
      const number = typeof count === 'number' ? count : parseInt(toString(count), 10) || 1;
      return `${prefix}${number.toString().padStart(6, '0')}`;
    },
    examples: ['AUTONUMBER("INV-") → "INV-000001"'],
  },
  {
    name: 'CREATED_BY',
    category: 'reference',
    description: 'Returns the user who created the record',
    args: [],
    returnType: 'string',
    implementation: (_args, context: FormulaContext) => {
      return context.record.created_by ?? context.record.createdBy ?? null;
    },
    examples: ['CREATED_BY()'],
  },
  {
    name: 'MODIFIED_BY',
    category: 'reference',
    description: 'Returns the user who last modified the record',
    args: [],
    returnType: 'string',
    implementation: (_args, context: FormulaContext) => {
      return context.record.modified_by ?? context.record.modifiedBy ?? context.record.updated_by ?? null;
    },
    examples: ['MODIFIED_BY()'],
  },
  {
    name: 'CREATED_AT',
    category: 'reference',
    description: 'Returns the creation timestamp',
    args: [],
    returnType: 'datetime',
    implementation: (_args, context: FormulaContext) => {
      const value = context.record.created_at ?? context.record.createdAt;
      if (!value) return null;
      if (value instanceof Date) return value;
      return new Date(String(value));
    },
    examples: ['CREATED_AT()'],
  },
  {
    name: 'MODIFIED_AT',
    category: 'reference',
    description: 'Returns the last modification timestamp',
    args: [],
    returnType: 'datetime',
    implementation: (_args, context: FormulaContext) => {
      const value = context.record.modified_at ?? context.record.modifiedAt ?? context.record.updated_at;
      if (!value) return null;
      if (value instanceof Date) return value;
      return new Date(String(value));
    },
    examples: ['MODIFIED_AT()'],
  },
  {
    name: 'CURRENTUSER',
    category: 'reference',
    description: 'Returns information about the current user',
    args: [{ name: 'property', type: 'string', required: false, defaultValue: 'id' }],
    returnType: 'string',
    implementation: (args, context: FormulaContext) => {
      if (!context.currentUser) return null;
      const property = args[0] !== undefined ? toString(args[0]) : 'id';

      switch (property.toLowerCase()) {
        case 'id':
          return context.currentUser.id;
        case 'username':
          return context.currentUser.username ?? null;
        case 'email':
          return context.currentUser.email ?? null;
        case 'timezone':
          return context.currentUser.timezone ?? null;
        default:
          return null;
      }
    },
    examples: ['CURRENTUSER() → user ID', 'CURRENTUSER("email") → user email'],
  },
  {
    name: 'HASROLE',
    category: 'reference',
    description: 'Checks if current user has a specific role',
    args: [{ name: 'role', type: 'string', required: true }],
    returnType: 'boolean',
    implementation: (args, context: FormulaContext) => {
      if (!context.currentUser?.roles) return false;
      const role = toString(args[0]);
      return context.currentUser.roles.includes(role);
    },
    examples: ['HASROLE("admin")'],
  },
  {
    name: 'INGROUP',
    category: 'reference',
    description: 'Checks if current user is in a specific group',
    args: [{ name: 'group', type: 'string', required: true }],
    returnType: 'boolean',
    implementation: (args, context: FormulaContext) => {
      if (!context.currentUser?.groups) return false;
      const group = toString(args[0]);
      return context.currentUser.groups.includes(group);
    },
    examples: ['INGROUP("engineering")'],
  },
];
