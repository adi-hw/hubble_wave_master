import { Injectable, Logger } from '@nestjs/common';
import { PropertyDefinition } from '@hubblewave/instance-db';
import { v4 as uuidv4 } from 'uuid';
import {
  DefaultValueConfig,
  DefaultValueContext,
  DefaultValueResult,
} from './default-value.types';
import { SequenceGeneratorService } from './sequence-generator.service';

/**
 * DefaultValueService - Evaluates and applies default values for properties
 *
 * Supports the following default value types:
 * - static: Simple static value
 * - expression: JavaScript expression evaluated at runtime
 * - script: Reference to a PlatformScript for complex logic
 * - sequence: Auto-incrementing sequence number
 * - current_user: Current user's ID
 * - current_datetime: Current timestamp
 * - current_date: Current date only
 * - uuid: Generate new UUID
 * - null: Explicit null value
 */
@Injectable()
export class DefaultValueService {
  private readonly logger = new Logger(DefaultValueService.name);

  constructor(private readonly sequenceGenerator: SequenceGeneratorService) {}

  /**
   * Apply default values to a record for properties that are not set
   */
  async applyDefaults(
    data: Record<string, unknown>,
    properties: PropertyDefinition[],
    context: DefaultValueContext
  ): Promise<Record<string, unknown>> {
    const result = { ...data };

    for (const property of properties) {
      // Skip if value is already set
      if (result[property.code] !== undefined && result[property.code] !== null) {
        continue;
      }

      // Check if property has a default value configuration
      const defaultConfig = this.getDefaultConfig(property);
      if (!defaultConfig) {
        continue;
      }

      // Evaluate the default value
      const evaluated = await this.evaluateDefault(defaultConfig, context);

      if (evaluated.success) {
        result[property.code] = evaluated.value;
        this.logger.debug(
          `Applied default value for ${property.code}: ${JSON.stringify(evaluated.value)}`
        );
      } else if (evaluated.error) {
        this.logger.warn(
          `Failed to evaluate default for ${property.code}: ${evaluated.error}`
        );
      }
    }

    return result;
  }

  /**
   * Evaluate a single default value
   */
  async evaluateDefault(
    config: DefaultValueConfig,
    context: DefaultValueContext
  ): Promise<DefaultValueResult> {
    try {
      switch (config.type) {
        case 'static':
          return this.evaluateStatic(config);

        case 'expression':
          return this.evaluateExpression(config, context);

        case 'script':
          return this.evaluateScript(config, context);

        case 'sequence':
          return await this.evaluateSequence(config);

        case 'current_user':
          return this.evaluateCurrentUser(context);

        case 'current_datetime':
          return this.evaluateCurrentDatetime(config);

        case 'current_date':
          return this.evaluateCurrentDate(config);

        case 'uuid':
          return this.evaluateUuid();

        case 'null':
          return { success: true, value: null };

        default:
          return {
            success: false,
            value: null,
            error: `Unknown default value type: ${config.type}`,
          };
      }
    } catch (error) {
      return {
        success: false,
        value: null,
        error: (error as Error).message,
      };
    }
  }

  /**
   * Get default value configuration from property
   */
  private getDefaultConfig(property: PropertyDefinition): DefaultValueConfig | null {
    // Check for structured config
    const config = property.config as Record<string, unknown> | undefined;
    if (config?.defaultValueConfig) {
      return config.defaultValueConfig as DefaultValueConfig;
    }

    // Check for simple default value
    if (property.defaultValue !== undefined && property.defaultValue !== null) {
      // Determine type from defaultValueType or infer it
      const type = (property.defaultValueType as string) || 'static';

      if (type === 'static') {
        return {
          type: 'static',
          value: property.defaultValue as string | number | boolean,
        };
      }

      // For non-static types, the defaultValue is the configuration
      return {
        type: type as DefaultValueConfig['type'],
        expression: type === 'expression' ? (property.defaultValue as string) : undefined,
        sequenceCode: type === 'sequence' ? (property.defaultValue as string) : undefined,
        format: (config?.defaultFormat as string) || undefined,
      };
    }

    return null;
  }

  /**
   * Evaluate static default value
   */
  private evaluateStatic(config: DefaultValueConfig): DefaultValueResult {
    return {
      success: true,
      value: config.value ?? null,
    };
  }

  /**
   * Evaluate expression default value
   *
   * The expression has access to:
   * - record: Other fields in the record
   * - user: { id, name, email }
   * - now: Current Date object
   * - collection: { code, id }
   */
  private evaluateExpression(
    config: DefaultValueConfig,
    context: DefaultValueContext
  ): DefaultValueResult {
    if (!config.expression) {
      return {
        success: false,
        value: null,
        error: 'No expression configured',
      };
    }

    try {
      // Create evaluation context
      const evalContext = {
        record: context.record,
        user: {
          id: context.userId,
          name: context.userName || 'Unknown',
          email: context.userEmail || '',
        },
        now: new Date(),
        collection: {
          code: context.collectionCode,
          id: context.collectionId,
        },
        isCreate: context.isCreate,
      };

      // Create safe evaluator function
      // eslint-disable-next-line @typescript-eslint/no-implied-eval
      const evaluator = new Function(
        'record',
        'user',
        'now',
        'collection',
        'isCreate',
        `return (${config.expression})`
      );

      const result = evaluator(
        evalContext.record,
        evalContext.user,
        evalContext.now,
        evalContext.collection,
        evalContext.isCreate
      );

      return {
        success: true,
        value: result,
      };
    } catch (error) {
      return {
        success: false,
        value: null,
        error: `Expression evaluation failed: ${(error as Error).message}`,
      };
    }
  }

  /**
   * Evaluate script-based default value
   *
   * References a PlatformScript by ID
   */
  private evaluateScript(
    config: DefaultValueConfig,
    _context: DefaultValueContext
  ): DefaultValueResult {
    if (!config.scriptId) {
      return {
        success: false,
        value: null,
        error: 'No script ID configured',
      };
    }

    // TODO: Integrate with ScriptSandboxService for full script execution
    // For now, log a warning and return null
    this.logger.warn(
      `Script-based default values not yet fully implemented. Script ID: ${config.scriptId}`
    );

    return {
      success: false,
      value: null,
      error: 'Script execution not yet implemented',
    };
  }

  /**
   * Evaluate sequence default value
   */
  private async evaluateSequence(config: DefaultValueConfig): Promise<DefaultValueResult> {
    const sequenceCode = config.sequenceCode || config.value?.toString();

    if (!sequenceCode) {
      return {
        success: false,
        value: null,
        error: 'No sequence code configured',
      };
    }

    try {
      const nextValue = await this.sequenceGenerator.getNextValue(sequenceCode);
      return {
        success: true,
        value: nextValue,
      };
    } catch (error) {
      return {
        success: false,
        value: null,
        error: `Sequence generation failed: ${(error as Error).message}`,
      };
    }
  }

  /**
   * Evaluate current_user default value
   */
  private evaluateCurrentUser(context: DefaultValueContext): DefaultValueResult {
    return {
      success: true,
      value: context.userId,
    };
  }

  /**
   * Evaluate current_datetime default value
   */
  private evaluateCurrentDatetime(config: DefaultValueConfig): DefaultValueResult {
    const now = new Date();

    if (config.format) {
      return {
        success: true,
        value: this.formatDateTime(now, config.format),
      };
    }

    return {
      success: true,
      value: now.toISOString(),
    };
  }

  /**
   * Evaluate current_date default value
   */
  private evaluateCurrentDate(config: DefaultValueConfig): DefaultValueResult {
    const now = new Date();

    if (config.format) {
      return {
        success: true,
        value: this.formatDate(now, config.format),
      };
    }

    // Return ISO date string (YYYY-MM-DD)
    return {
      success: true,
      value: now.toISOString().split('T')[0],
    };
  }

  /**
   * Evaluate UUID default value
   */
  private evaluateUuid(): DefaultValueResult {
    return {
      success: true,
      value: uuidv4(),
    };
  }

  /**
   * Format date/time with a simple format string
   *
   * Supported placeholders:
   * - YYYY: 4-digit year
   * - YY: 2-digit year
   * - MM: 2-digit month
   * - DD: 2-digit day
   * - HH: 2-digit hour (24h)
   * - hh: 2-digit hour (12h)
   * - mm: 2-digit minute
   * - ss: 2-digit second
   * - SSS: 3-digit millisecond
   * - A: AM/PM
   */
  private formatDateTime(date: Date, format: string): string {
    const year = date.getFullYear();
    const month = date.getMonth() + 1;
    const day = date.getDate();
    const hours24 = date.getHours();
    const hours12 = hours24 % 12 || 12;
    const minutes = date.getMinutes();
    const seconds = date.getSeconds();
    const milliseconds = date.getMilliseconds();
    const ampm = hours24 >= 12 ? 'PM' : 'AM';

    return format
      .replace('YYYY', String(year))
      .replace('YY', String(year).slice(-2))
      .replace('MM', String(month).padStart(2, '0'))
      .replace('DD', String(day).padStart(2, '0'))
      .replace('HH', String(hours24).padStart(2, '0'))
      .replace('hh', String(hours12).padStart(2, '0'))
      .replace('mm', String(minutes).padStart(2, '0'))
      .replace('ss', String(seconds).padStart(2, '0'))
      .replace('SSS', String(milliseconds).padStart(3, '0'))
      .replace('A', ampm);
  }

  /**
   * Format date with a simple format string
   */
  private formatDate(date: Date, format: string): string {
    const year = date.getFullYear();
    const month = date.getMonth() + 1;
    const day = date.getDate();

    return format
      .replace('YYYY', String(year))
      .replace('YY', String(year).slice(-2))
      .replace('MM', String(month).padStart(2, '0'))
      .replace('DD', String(day).padStart(2, '0'));
  }
}
