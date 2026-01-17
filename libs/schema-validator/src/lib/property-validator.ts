/**
 * Property Validator
 * HubbleWave Platform - Phase 2
 *
 * Validates property definitions and configurations.
 */

import {
  PropertyDefinition,
  PropertyConfig,
  ValidationResult,
  ValidationError,
  ValidationWarning,
  ChoiceOption,
  RollupConfig,
  LookupConfig,
  SchemaContext,
} from './types';
import {
  ALL_PROPERTY_TYPES,
  isLegacyPropertyType,
  normalizePropertyType,
} from '@hubblewave/shared-types';

const RESERVED_CODES = new Set([
  'id',
  'created_at',
  'updated_at',
  'deleted_at',
  'created_by',
  'updated_by',
  'tenant_id',
  'version',
]);

const CODE_PATTERN = /^[a-z][a-z0-9_]*$/;
const MAX_CODE_LENGTH = 63;
const MAX_NAME_LENGTH = 255;

export class PropertyValidator {
  validateProperty(
    property: PropertyDefinition,
    context?: SchemaContext
  ): ValidationResult {
    const errors: ValidationError[] = [];
    const warnings: ValidationWarning[] = [];

    this.validateCode(property, errors);
    this.validateName(property, errors);
    this.validateType(property, errors, warnings);
    this.validateConfig(property, errors, warnings, context);

    return {
      valid: errors.length === 0,
      errors,
      warnings,
    };
  }

  private validateCode(property: PropertyDefinition, errors: ValidationError[]): void {
    const { code } = property;

    if (!code || code.trim() === '') {
      errors.push({
        path: 'code',
        code: 'REQUIRED',
        message: 'Property code is required',
      });
      return;
    }

    if (RESERVED_CODES.has(code.toLowerCase())) {
      errors.push({
        path: 'code',
        code: 'RESERVED',
        message: `Property code "${code}" is reserved`,
        details: { reservedCodes: Array.from(RESERVED_CODES) },
      });
    }

    if (!CODE_PATTERN.test(code)) {
      errors.push({
        path: 'code',
        code: 'INVALID_FORMAT',
        message: 'Property code must start with a letter and contain only lowercase letters, numbers, and underscores',
      });
    }

    if (code.length > MAX_CODE_LENGTH) {
      errors.push({
        path: 'code',
        code: 'TOO_LONG',
        message: `Property code must not exceed ${MAX_CODE_LENGTH} characters`,
        details: { maxLength: MAX_CODE_LENGTH, actualLength: code.length },
      });
    }
  }

  private validateName(property: PropertyDefinition, errors: ValidationError[]): void {
    const { name } = property;

    if (!name || name.trim() === '') {
      errors.push({
        path: 'name',
        code: 'REQUIRED',
        message: 'Property name is required',
      });
      return;
    }

    if (name.length > MAX_NAME_LENGTH) {
      errors.push({
        path: 'name',
        code: 'TOO_LONG',
        message: `Property name must not exceed ${MAX_NAME_LENGTH} characters`,
        details: { maxLength: MAX_NAME_LENGTH, actualLength: name.length },
      });
    }
  }

  private validateType(
    property: PropertyDefinition,
    errors: ValidationError[],
    warnings: ValidationWarning[]
  ): void {
    const validTypes = Array.from(ALL_PROPERTY_TYPES);

    if (!validTypes.includes(property.type)) {
      errors.push({
        path: 'type',
        code: 'INVALID_TYPE',
        message: `Invalid property type: ${property.type}`,
        details: { validTypes },
      });
    }

    if (isLegacyPropertyType(property.type)) {
      const normalized = normalizePropertyType(property.type);
      warnings.push({
        path: 'type',
        code: 'LEGACY_TYPE',
        message: `Property type "${property.type}" is legacy and will be normalized to "${normalized}"`,
        suggestion: `Use "${normalized}" when defining new properties`,
      });
    }

    if (property.type === 'json') {
      warnings.push({
        path: 'type',
        code: 'JSON_TYPE',
        message: 'JSON properties are not queryable and should be used sparingly',
        suggestion: 'Consider using structured properties instead',
      });
    }
  }

  private validateConfig(
    property: PropertyDefinition,
    errors: ValidationError[],
    warnings: ValidationWarning[],
    context?: SchemaContext
  ): void {
    const { type, config } = property;
    const normalizedType = normalizePropertyType(type);

    switch (normalizedType) {
      case 'text':
      case 'rich-text':
        this.validateStringConfig(config, errors);
        break;
      case 'number':
      case 'currency':
        this.validateNumericConfig(config, errors);
        break;
      case 'choice':
      case 'multi-choice':
        this.validateChoiceConfig(config, errors);
        break;
      case 'reference':
      case 'multi-reference':
      case 'user':
      case 'multi-user':
        this.validateReferenceConfig(config, errors, context);
        break;
      case 'formula':
        this.validateFormulaConfig(config, errors);
        break;
      case 'rollup':
        this.validateRollupConfig(config, errors, context);
        break;
      case 'lookup':
        this.validateLookupConfig(config, errors, context);
        break;
      case 'geolocation':
        this.validateGeolocationConfig(config, errors);
        break;
      case 'duration':
        this.validateDurationConfig(config, errors);
        break;
      case 'attachment':
        this.validateFileConfig(config, errors, warnings);
        break;
    }
  }

  private validateStringConfig(
    config: PropertyConfig | undefined,
    errors: ValidationError[]
  ): void {
    if (!config) return;

    if (config.minLength !== undefined && config.minLength < 0) {
      errors.push({
        path: 'config.minLength',
        code: 'INVALID_VALUE',
        message: 'Minimum length must be non-negative',
      });
    }

    if (config.maxLength !== undefined && config.maxLength < 1) {
      errors.push({
        path: 'config.maxLength',
        code: 'INVALID_VALUE',
        message: 'Maximum length must be at least 1',
      });
    }

    if (
      config.minLength !== undefined &&
      config.maxLength !== undefined &&
      config.minLength > config.maxLength
    ) {
      errors.push({
        path: 'config',
        code: 'INVALID_RANGE',
        message: 'Minimum length cannot exceed maximum length',
      });
    }

    if (config.pattern) {
      try {
        new RegExp(config.pattern);
      } catch {
        errors.push({
          path: 'config.pattern',
          code: 'INVALID_REGEX',
          message: 'Invalid regular expression pattern',
        });
      }
    }
  }

  private validateNumericConfig(
    config: PropertyConfig | undefined,
    errors: ValidationError[]
  ): void {
    if (!config) return;

    if (
      config.minValue !== undefined &&
      config.maxValue !== undefined &&
      config.minValue > config.maxValue
    ) {
      errors.push({
        path: 'config',
        code: 'INVALID_RANGE',
        message: 'Minimum value cannot exceed maximum value',
      });
    }

    if (config.precision !== undefined && (config.precision < 1 || config.precision > 38)) {
      errors.push({
        path: 'config.precision',
        code: 'INVALID_VALUE',
        message: 'Precision must be between 1 and 38',
      });
    }

    if (config.scale !== undefined && config.scale < 0) {
      errors.push({
        path: 'config.scale',
        code: 'INVALID_VALUE',
        message: 'Scale must be non-negative',
      });
    }

    if (
      config.precision !== undefined &&
      config.scale !== undefined &&
      config.scale > config.precision
    ) {
      errors.push({
        path: 'config',
        code: 'INVALID_PRECISION_SCALE',
        message: 'Scale cannot exceed precision',
      });
    }
  }

  private validateChoiceConfig(
    config: PropertyConfig | undefined,
    errors: ValidationError[]
  ): void {
    if (!config?.choices || config.choices.length === 0) {
      errors.push({
        path: 'config.choices',
        code: 'REQUIRED',
        message: 'Choice properties require at least one choice option',
      });
      return;
    }

    const values = new Set<string>();
    config.choices.forEach((choice: ChoiceOption, index: number) => {
      if (!choice.value || choice.value.trim() === '') {
        errors.push({
          path: `config.choices[${index}].value`,
          code: 'REQUIRED',
          message: 'Choice value is required',
        });
      } else if (values.has(choice.value)) {
        errors.push({
          path: `config.choices[${index}].value`,
          code: 'DUPLICATE',
          message: `Duplicate choice value: ${choice.value}`,
        });
      } else {
        values.add(choice.value);
      }

      if (!choice.label || choice.label.trim() === '') {
        errors.push({
          path: `config.choices[${index}].label`,
          code: 'REQUIRED',
          message: 'Choice label is required',
        });
      }
    });
  }

  private validateReferenceConfig(
    config: PropertyConfig | undefined,
    errors: ValidationError[],
    context?: SchemaContext
  ): void {
    if (!config?.referenceCollection) {
      errors.push({
        path: 'config.referenceCollection',
        code: 'REQUIRED',
        message: 'Reference collection is required',
      });
      return;
    }

    if (context && !context.collections.has(config.referenceCollection)) {
      errors.push({
        path: 'config.referenceCollection',
        code: 'NOT_FOUND',
        message: `Referenced collection not found: ${config.referenceCollection}`,
      });
    }
  }

  private validateFormulaConfig(
    config: PropertyConfig | undefined,
    errors: ValidationError[]
  ): void {
    if (!config?.formula || config.formula.trim() === '') {
      errors.push({
        path: 'config.formula',
        code: 'REQUIRED',
        message: 'Formula expression is required',
      });
      return;
    }

    const openBraces = (config.formula.match(/\{/g) || []).length;
    const closeBraces = (config.formula.match(/\}/g) || []).length;
    if (openBraces !== closeBraces) {
      errors.push({
        path: 'config.formula',
        code: 'SYNTAX_ERROR',
        message: 'Unbalanced braces in formula',
      });
    }

    const openParens = (config.formula.match(/\(/g) || []).length;
    const closeParens = (config.formula.match(/\)/g) || []).length;
    if (openParens !== closeParens) {
      errors.push({
        path: 'config.formula',
        code: 'SYNTAX_ERROR',
        message: 'Unbalanced parentheses in formula',
      });
    }
  }

  private validateRollupConfig(
    config: PropertyConfig | undefined,
    errors: ValidationError[],
    context?: SchemaContext
  ): void {
    const rollup = config?.rollupConfig;
    if (!rollup) {
      errors.push({
        path: 'config.rollupConfig',
        code: 'REQUIRED',
        message: 'Rollup configuration is required',
      });
      return;
    }

    if (!rollup.sourceCollection) {
      errors.push({
        path: 'config.rollupConfig.sourceCollection',
        code: 'REQUIRED',
        message: 'Source collection is required for rollup',
      });
    } else if (context && !context.collections.has(rollup.sourceCollection)) {
      errors.push({
        path: 'config.rollupConfig.sourceCollection',
        code: 'NOT_FOUND',
        message: `Source collection not found: ${rollup.sourceCollection}`,
      });
    }

    if (!rollup.relationProperty) {
      errors.push({
        path: 'config.rollupConfig.relationProperty',
        code: 'REQUIRED',
        message: 'Relation property is required for rollup',
      });
    }

    if (!rollup.aggregateProperty) {
      errors.push({
        path: 'config.rollupConfig.aggregateProperty',
        code: 'REQUIRED',
        message: 'Aggregate property is required for rollup',
      });
    }

    const validAggregations = ['sum', 'avg', 'count', 'min', 'max', 'first', 'last'];
    if (!rollup.aggregation || !validAggregations.includes(rollup.aggregation)) {
      errors.push({
        path: 'config.rollupConfig.aggregation',
        code: 'INVALID_VALUE',
        message: `Invalid aggregation type. Valid values: ${validAggregations.join(', ')}`,
      });
    }
  }

  private validateLookupConfig(
    config: PropertyConfig | undefined,
    errors: ValidationError[],
    context?: SchemaContext
  ): void {
    const lookup = config?.lookupConfig;
    if (!lookup) {
      errors.push({
        path: 'config.lookupConfig',
        code: 'REQUIRED',
        message: 'Lookup configuration is required',
      });
      return;
    }

    if (!lookup.sourceCollection) {
      errors.push({
        path: 'config.lookupConfig.sourceCollection',
        code: 'REQUIRED',
        message: 'Source collection is required for lookup',
      });
    } else if (context && !context.collections.has(lookup.sourceCollection)) {
      errors.push({
        path: 'config.lookupConfig.sourceCollection',
        code: 'NOT_FOUND',
        message: `Source collection not found: ${lookup.sourceCollection}`,
      });
    }

    if (!lookup.referenceProperty) {
      errors.push({
        path: 'config.lookupConfig.referenceProperty',
        code: 'REQUIRED',
        message: 'Reference property is required for lookup',
      });
    }

    if (!lookup.sourceProperty) {
      errors.push({
        path: 'config.lookupConfig.sourceProperty',
        code: 'REQUIRED',
        message: 'Source property is required for lookup',
      });
    }
  }

  private validateGeolocationConfig(
    config: PropertyConfig | undefined,
    errors: ValidationError[]
  ): void {
    const geo = config?.geolocationConfig;
    if (!geo) return;

    if (geo.defaultZoom !== undefined && (geo.defaultZoom < 0 || geo.defaultZoom > 22)) {
      errors.push({
        path: 'config.geolocationConfig.defaultZoom',
        code: 'INVALID_VALUE',
        message: 'Default zoom must be between 0 and 22',
      });
    }

    if (geo.defaultCenter) {
      if (geo.defaultCenter.lat < -90 || geo.defaultCenter.lat > 90) {
        errors.push({
          path: 'config.geolocationConfig.defaultCenter.lat',
          code: 'INVALID_VALUE',
          message: 'Latitude must be between -90 and 90',
        });
      }
      if (geo.defaultCenter.lng < -180 || geo.defaultCenter.lng > 180) {
        errors.push({
          path: 'config.geolocationConfig.defaultCenter.lng',
          code: 'INVALID_VALUE',
          message: 'Longitude must be between -180 and 180',
        });
      }
    }
  }

  private validateDurationConfig(
    config: PropertyConfig | undefined,
    errors: ValidationError[]
  ): void {
    const duration = config?.durationConfig;
    if (!duration) {
      errors.push({
        path: 'config.durationConfig',
        code: 'REQUIRED',
        message: 'Duration configuration is required',
      });
      return;
    }

    const validUnits = ['seconds', 'minutes', 'hours', 'days'];
    if (!validUnits.includes(duration.unit)) {
      errors.push({
        path: 'config.durationConfig.unit',
        code: 'INVALID_VALUE',
        message: `Invalid duration unit. Valid values: ${validUnits.join(', ')}`,
      });
    }

    if (
      duration.minValue !== undefined &&
      duration.maxValue !== undefined &&
      duration.minValue > duration.maxValue
    ) {
      errors.push({
        path: 'config.durationConfig',
        code: 'INVALID_RANGE',
        message: 'Minimum value cannot exceed maximum value',
      });
    }
  }

  private validateFileConfig(
    config: PropertyConfig | undefined,
    errors: ValidationError[],
    warnings: ValidationWarning[]
  ): void {
    const file = config?.fileConfig;
    if (!file) return;

    if (file.maxSize !== undefined && file.maxSize <= 0) {
      errors.push({
        path: 'config.fileConfig.maxSize',
        code: 'INVALID_VALUE',
        message: 'Maximum file size must be positive',
      });
    }

    if (file.maxFiles !== undefined && file.maxFiles < 1) {
      errors.push({
        path: 'config.fileConfig.maxFiles',
        code: 'INVALID_VALUE',
        message: 'Maximum files must be at least 1',
      });
    }

    if (file.allowedTypes && file.allowedTypes.length === 0) {
      warnings.push({
        path: 'config.fileConfig.allowedTypes',
        code: 'EMPTY_ALLOWED_TYPES',
        message: 'Attachment allowedTypes is empty and will block all uploads',
        suggestion: 'Remove allowedTypes or include at least one type',
      });
    }
  }
}
