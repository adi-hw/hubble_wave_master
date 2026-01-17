/**
 * Data Validator
 * HubbleWave Platform - Phase 2
 *
 * Validates data values against property constraints.
 */

import {
  PropertyDefinition,
  ValidationResult,
  ValidationError,
  ValidationWarning,
} from './types';
import { normalizePropertyType } from '@hubblewave/shared-types';

export class DataValidator {
  validateValue(
    value: unknown,
    property: PropertyDefinition
  ): ValidationResult {
    const errors: ValidationError[] = [];
    const warnings: ValidationWarning[] = [];
    const path = property.code;

    if (value === null || value === undefined) {
      if (property.isRequired) {
        errors.push({
          path,
          code: 'REQUIRED',
          message: `${property.name} is required`,
        });
      }
      return { valid: errors.length === 0, errors, warnings };
    }

    const normalizedType = normalizePropertyType(property.type);

    switch (normalizedType) {
      case 'text':
      case 'rich-text':
        this.validateString(value, property, errors, path);
        if (property.type === 'email' && typeof value === 'string') {
          this.validateEmail(value, errors, path);
        }
        if (property.type === 'url' && typeof value === 'string') {
          this.validateUrl(value, errors, path);
        }
        if (property.type === 'phone' && typeof value === 'string') {
          this.validatePhone(value, errors, warnings, path);
        }
        break;
      case 'number':
        if (property.type === 'integer' || property.type === 'long') {
          this.validateInteger(value, property, errors, path);
        } else {
          this.validateDecimal(value, property, errors, path);
        }
        break;
      case 'currency':
        this.validateCurrency(value, property, errors, path);
        break;
      case 'boolean':
        this.validateBoolean(value, errors, path);
        break;
      case 'date':
        this.validateDate(value, errors, path);
        break;
      case 'datetime':
        if (property.type === 'time') {
          this.validateTime(value, errors, path);
          break;
        }
        this.validateDateTime(value, errors, path);
        break;
      case 'duration':
        this.validateDuration(value, property, errors, path);
        break;
      case 'choice':
        this.validateChoice(value, property, errors, path);
        break;
      case 'multi-choice':
        this.validateMultiChoice(value, property, errors, path);
        break;
      case 'reference':
      case 'user':
      case 'hierarchical':
        this.validateReference(value, errors, path);
        break;
      case 'multi-reference':
      case 'multi-user':
        this.validateMultiReference(value, errors, path);
        break;
      case 'geolocation':
        this.validateGeolocation(value, errors, path);
        break;
      case 'json':
        this.validateJson(value, errors, path);
        break;
      case 'attachment':
        this.validateAttachment(value, property, errors, path);
        break;
    }

    return { valid: errors.length === 0, errors, warnings };
  }

  validateRecord(
    record: Record<string, unknown>,
    properties: PropertyDefinition[]
  ): ValidationResult {
    const errors: ValidationError[] = [];
    const warnings: ValidationWarning[] = [];

    for (const property of properties) {
      const value = record[property.code];
      const result = this.validateValue(value, property);
      errors.push(...result.errors);
      warnings.push(...result.warnings);
    }

    return { valid: errors.length === 0, errors, warnings };
  }

  private validateString(
    value: unknown,
    property: PropertyDefinition,
    errors: ValidationError[],
    path: string
  ): void {
    if (typeof value !== 'string') {
      errors.push({
        path,
        code: 'INVALID_TYPE',
        message: `${property.name} must be a string`,
      });
      return;
    }

    const config = property.config;
    if (config?.minLength !== undefined && value.length < config.minLength) {
      errors.push({
        path,
        code: 'TOO_SHORT',
        message: `${property.name} must be at least ${config.minLength} characters`,
        details: { minLength: config.minLength, actualLength: value.length },
      });
    }

    if (config?.maxLength !== undefined && value.length > config.maxLength) {
      errors.push({
        path,
        code: 'TOO_LONG',
        message: `${property.name} must not exceed ${config.maxLength} characters`,
        details: { maxLength: config.maxLength, actualLength: value.length },
      });
    }

    if (config?.pattern) {
      const regex = new RegExp(config.pattern);
      if (!regex.test(value)) {
        errors.push({
          path,
          code: 'PATTERN_MISMATCH',
          message: `${property.name} does not match required pattern`,
          details: { pattern: config.pattern },
        });
      }
    }
  }

  private validateInteger(
    value: unknown,
    property: PropertyDefinition,
    errors: ValidationError[],
    path: string
  ): void {
    if (typeof value !== 'number' || !Number.isInteger(value)) {
      errors.push({
        path,
        code: 'INVALID_TYPE',
        message: `${property.name} must be an integer`,
      });
      return;
    }

    this.validateNumericRange(value, property, errors, path);
  }

  private validateDecimal(
    value: unknown,
    property: PropertyDefinition,
    errors: ValidationError[],
    path: string
  ): void {
    if (typeof value !== 'number' || !Number.isFinite(value)) {
      errors.push({
        path,
        code: 'INVALID_TYPE',
        message: `${property.name} must be a number`,
      });
      return;
    }

    this.validateNumericRange(value, property, errors, path);

    const config = property.config;
    if (config?.scale !== undefined) {
      const decimalPlaces = (value.toString().split('.')[1] || '').length;
      if (decimalPlaces > config.scale) {
        errors.push({
          path,
          code: 'PRECISION_EXCEEDED',
          message: `${property.name} cannot have more than ${config.scale} decimal places`,
          details: { maxScale: config.scale, actualScale: decimalPlaces },
        });
      }
    }
  }

  private validateCurrency(
    value: unknown,
    property: PropertyDefinition,
    errors: ValidationError[],
    path: string
  ): void {
    if (typeof value === 'number' && Number.isFinite(value)) {
      this.validateNumericRange(value, property, errors, path);
      return;
    }

    if (typeof value !== 'object' || value === null) {
      errors.push({
        path,
        code: 'INVALID_TYPE',
        message: `${property.name} must be a number or currency object`,
      });
      return;
    }

    const currency = value as Record<string, unknown>;
    const amount = currency.amount;

    if (typeof amount !== 'number' || !Number.isFinite(amount)) {
      errors.push({
        path: `${path}.amount`,
        code: 'INVALID_TYPE',
        message: `${property.name} amount must be a number`,
      });
      return;
    }

    this.validateNumericRange(amount, property, errors, path);
  }

  private validateNumericRange(
    value: number,
    property: PropertyDefinition,
    errors: ValidationError[],
    path: string
  ): void {
    const config = property.config;

    if (config?.minValue !== undefined && value < config.minValue) {
      errors.push({
        path,
        code: 'TOO_SMALL',
        message: `${property.name} must be at least ${config.minValue}`,
        details: { minValue: config.minValue, actualValue: value },
      });
    }

    if (config?.maxValue !== undefined && value > config.maxValue) {
      errors.push({
        path,
        code: 'TOO_LARGE',
        message: `${property.name} must not exceed ${config.maxValue}`,
        details: { maxValue: config.maxValue, actualValue: value },
      });
    }
  }

  private validateBoolean(
    value: unknown,
    errors: ValidationError[],
    path: string
  ): void {
    if (typeof value !== 'boolean') {
      errors.push({
        path,
        code: 'INVALID_TYPE',
        message: 'Value must be a boolean',
      });
    }
  }

  private validateDate(
    value: unknown,
    errors: ValidationError[],
    path: string
  ): void {
    if (typeof value === 'string') {
      const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
      if (!dateRegex.test(value)) {
        errors.push({
          path,
          code: 'INVALID_FORMAT',
          message: 'Date must be in YYYY-MM-DD format',
        });
        return;
      }
      const date = new Date(value);
      if (isNaN(date.getTime())) {
        errors.push({
          path,
          code: 'INVALID_DATE',
          message: 'Invalid date value',
        });
      }
    } else if (!(value instanceof Date) || isNaN(value.getTime())) {
      errors.push({
        path,
        code: 'INVALID_TYPE',
        message: 'Value must be a valid date',
      });
    }
  }

  private validateDateTime(
    value: unknown,
    errors: ValidationError[],
    path: string
  ): void {
    if (typeof value === 'string') {
      const date = new Date(value);
      if (isNaN(date.getTime())) {
        errors.push({
          path,
          code: 'INVALID_DATETIME',
          message: 'Invalid datetime value',
        });
      }
    } else if (!(value instanceof Date) || isNaN(value.getTime())) {
      errors.push({
        path,
        code: 'INVALID_TYPE',
        message: 'Value must be a valid datetime',
      });
    }
  }

  private validateTime(
    value: unknown,
    errors: ValidationError[],
    path: string
  ): void {
    if (typeof value !== 'string') {
      errors.push({
        path,
        code: 'INVALID_TYPE',
        message: 'Time must be a string',
      });
      return;
    }

    const timeRegex = /^([01]\d|2[0-3]):([0-5]\d)(:([0-5]\d))?$/;
    if (!timeRegex.test(value)) {
      errors.push({
        path,
        code: 'INVALID_FORMAT',
        message: 'Time must be in HH:MM or HH:MM:SS format',
      });
    }
  }

  private validateDuration(
    value: unknown,
    property: PropertyDefinition,
    errors: ValidationError[],
    path: string
  ): void {
    if (typeof value !== 'number' || !Number.isFinite(value)) {
      errors.push({
        path,
        code: 'INVALID_TYPE',
        message: `${property.name} must be a number`,
      });
      return;
    }

    if (value < 0) {
      errors.push({
        path,
        code: 'NEGATIVE_DURATION',
        message: `${property.name} cannot be negative`,
      });
    }

    const config = property.config?.durationConfig;
    if (config) {
      if (config.minValue !== undefined && value < config.minValue) {
        errors.push({
          path,
          code: 'TOO_SMALL',
          message: `${property.name} must be at least ${config.minValue} ${config.unit}`,
        });
      }
      if (config.maxValue !== undefined && value > config.maxValue) {
        errors.push({
          path,
          code: 'TOO_LARGE',
          message: `${property.name} must not exceed ${config.maxValue} ${config.unit}`,
        });
      }
    }
  }

  private validateEmail(
    value: unknown,
    errors: ValidationError[],
    path: string
  ): void {
    if (typeof value !== 'string') {
      errors.push({
        path,
        code: 'INVALID_TYPE',
        message: 'Email must be a string',
      });
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(value)) {
      errors.push({
        path,
        code: 'INVALID_EMAIL',
        message: 'Invalid email address',
      });
    }
  }

  private validateUrl(
    value: unknown,
    errors: ValidationError[],
    path: string
  ): void {
    if (typeof value !== 'string') {
      errors.push({
        path,
        code: 'INVALID_TYPE',
        message: 'URL must be a string',
      });
      return;
    }

    try {
      new URL(value);
    } catch {
      errors.push({
        path,
        code: 'INVALID_URL',
        message: 'Invalid URL',
      });
    }
  }

  private validatePhone(
    value: unknown,
    errors: ValidationError[],
    warnings: ValidationWarning[],
    path: string
  ): void {
    if (typeof value !== 'string') {
      errors.push({
        path,
        code: 'INVALID_TYPE',
        message: 'Phone number must be a string',
      });
      return;
    }

    const digitsOnly = value.replace(/\D/g, '');
    if (digitsOnly.length < 7 || digitsOnly.length > 15) {
      errors.push({
        path,
        code: 'INVALID_PHONE',
        message: 'Phone number must have between 7 and 15 digits',
      });
    }

    if (!value.startsWith('+')) {
      warnings.push({
        path,
        code: 'NO_COUNTRY_CODE',
        message: 'Phone number does not include country code',
        suggestion: 'Consider using international format (e.g., +1234567890)',
      });
    }
  }

  private validateChoice(
    value: unknown,
    property: PropertyDefinition,
    errors: ValidationError[],
    path: string
  ): void {
    if (typeof value !== 'string') {
      errors.push({
        path,
        code: 'INVALID_TYPE',
        message: `${property.name} must be a string`,
      });
      return;
    }

    const choices = property.config?.choices || [];
    const validValues = choices.map((c) => c.value);
    if (!validValues.includes(value)) {
      errors.push({
        path,
        code: 'INVALID_CHOICE',
        message: `${property.name} must be one of: ${validValues.join(', ')}`,
        details: { validValues, actualValue: value },
      });
    }
  }

  private validateMultiChoice(
    value: unknown,
    property: PropertyDefinition,
    errors: ValidationError[],
    path: string
  ): void {
    if (!Array.isArray(value)) {
      errors.push({
        path,
        code: 'INVALID_TYPE',
        message: `${property.name} must be an array`,
      });
      return;
    }

    const choices = property.config?.choices || [];
    const validValues = new Set(choices.map((c) => c.value));

    value.forEach((v, i) => {
      if (typeof v !== 'string') {
        errors.push({
          path: `${path}[${i}]`,
          code: 'INVALID_TYPE',
          message: 'Choice values must be strings',
        });
      } else if (!validValues.has(v)) {
        errors.push({
          path: `${path}[${i}]`,
          code: 'INVALID_CHOICE',
          message: `Invalid choice: ${v}`,
          details: { validValues: Array.from(validValues), actualValue: v },
        });
      }
    });
  }

  private validateReference(
    value: unknown,
    errors: ValidationError[],
    path: string
  ): void {
    if (typeof value !== 'string') {
      errors.push({
        path,
        code: 'INVALID_TYPE',
        message: 'Reference must be a string (UUID)',
      });
      return;
    }

    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(value)) {
      errors.push({
        path,
        code: 'INVALID_UUID',
        message: 'Reference must be a valid UUID',
      });
    }
  }

  private validateMultiReference(
    value: unknown,
    errors: ValidationError[],
    path: string
  ): void {
    if (!Array.isArray(value)) {
      errors.push({
        path,
        code: 'INVALID_TYPE',
        message: 'Multi-reference must be an array',
      });
      return;
    }

    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    value.forEach((v, i) => {
      if (typeof v !== 'string' || !uuidRegex.test(v)) {
        errors.push({
          path: `${path}[${i}]`,
          code: 'INVALID_UUID',
          message: 'Each reference must be a valid UUID',
        });
      }
    });
  }

  private validateGeolocation(
    value: unknown,
    errors: ValidationError[],
    path: string
  ): void {
    if (typeof value !== 'object' || value === null) {
      errors.push({
        path,
        code: 'INVALID_TYPE',
        message: 'Geolocation must be an object with lat and lng properties',
      });
      return;
    }

    const geo = value as Record<string, unknown>;

    if (typeof geo.lat !== 'number') {
      errors.push({
        path: `${path}.lat`,
        code: 'INVALID_TYPE',
        message: 'Latitude must be a number',
      });
    } else if (geo.lat < -90 || geo.lat > 90) {
      errors.push({
        path: `${path}.lat`,
        code: 'OUT_OF_RANGE',
        message: 'Latitude must be between -90 and 90',
      });
    }

    if (typeof geo.lng !== 'number') {
      errors.push({
        path: `${path}.lng`,
        code: 'INVALID_TYPE',
        message: 'Longitude must be a number',
      });
    } else if (geo.lng < -180 || geo.lng > 180) {
      errors.push({
        path: `${path}.lng`,
        code: 'OUT_OF_RANGE',
        message: 'Longitude must be between -180 and 180',
      });
    }
  }

  private validateAttachment(
    value: unknown,
    property: PropertyDefinition,
    errors: ValidationError[],
    path: string
  ): void {
    if (Array.isArray(value)) {
      const maxFiles = property.config?.fileConfig?.maxFiles;
      if (maxFiles !== undefined && value.length > maxFiles) {
        errors.push({
          path,
          code: 'TOO_MANY_FILES',
          message: `${property.name} cannot exceed ${maxFiles} attachments`,
        });
      }
      return;
    }

    if (typeof value !== 'object' || value === null) {
      errors.push({
        path,
        code: 'INVALID_TYPE',
        message: `${property.name} must be an attachment object or array`,
      });
    }
  }

  private validateJson(
    value: unknown,
    errors: ValidationError[],
    path: string
  ): void {
    if (typeof value === 'string') {
      try {
        JSON.parse(value);
      } catch {
        errors.push({
          path,
          code: 'INVALID_JSON',
          message: 'Invalid JSON string',
        });
      }
    } else if (typeof value !== 'object') {
      errors.push({
        path,
        code: 'INVALID_TYPE',
        message: 'JSON value must be an object, array, or JSON string',
      });
    }
  }
}
