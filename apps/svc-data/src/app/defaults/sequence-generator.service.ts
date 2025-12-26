import { Injectable, Logger } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { SequenceDefinition } from './default-value.types';

/**
 * SequenceGeneratorService - Generates auto-incrementing sequence numbers
 *
 * Used for fields like:
 * - Work Order numbers (WO-00001)
 * - Asset IDs (ASSET-2025-00001)
 * - Invoice numbers (INV-00001)
 * - Ticket numbers (TKT-00001)
 *
 * Supports:
 * - Prefixes and suffixes
 * - Zero-padded numbers
 * - Reset frequencies (daily, monthly, yearly)
 * - Custom format patterns
 */
@Injectable()
export class SequenceGeneratorService {
  private readonly logger = new Logger(SequenceGeneratorService.name);

  constructor(private readonly dataSource: DataSource) {}

  /**
   * Get the next value for a sequence
   *
   * This uses PostgreSQL sequences for atomic increment
   */
  async getNextValue(sequenceCode: string): Promise<string> {
    // Ensure sequence table and state exist
    await this.ensureSequenceState(sequenceCode);

    // Get sequence definition
    const definition = await this.getSequenceDefinition(sequenceCode);
    if (!definition) {
      // Create a default definition if not found
      return await this.generateWithDefaults(sequenceCode);
    }

    // Check if reset is needed
    const needsReset = await this.checkAndResetIfNeeded(sequenceCode, definition);
    if (needsReset) {
      this.logger.log(`Sequence ${sequenceCode} reset due to ${definition.resetFrequency} policy`);
    }

    // Atomically increment and get the next value
    const nextNumber = await this.incrementSequence(sequenceCode, definition.incrementBy || 1);

    // Format the sequence value
    return this.formatSequenceValue(nextNumber, definition);
  }

  /**
   * Get the current value without incrementing
   */
  async getCurrentValue(sequenceCode: string): Promise<string | null> {
    const result = await this.dataSource.query(
      `SELECT current_value FROM sequence_states WHERE code = $1`,
      [sequenceCode]
    );

    if (result.length === 0) {
      return null;
    }

    const definition = await this.getSequenceDefinition(sequenceCode);
    if (!definition) {
      return String(result[0].current_value);
    }

    return this.formatSequenceValue(result[0].current_value, definition);
  }

  /**
   * Create or update a sequence definition
   */
  async createOrUpdateSequence(definition: SequenceDefinition): Promise<void> {
    await this.dataSource.query(
      `
      INSERT INTO sequence_definitions (
        code, name, prefix, suffix, pad_length, start_value,
        increment_by, reset_frequency, format, updated_at
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW())
      ON CONFLICT (code) DO UPDATE SET
        name = EXCLUDED.name,
        prefix = EXCLUDED.prefix,
        suffix = EXCLUDED.suffix,
        pad_length = EXCLUDED.pad_length,
        start_value = EXCLUDED.start_value,
        increment_by = EXCLUDED.increment_by,
        reset_frequency = EXCLUDED.reset_frequency,
        format = EXCLUDED.format,
        updated_at = NOW()
      `,
      [
        definition.code,
        definition.name,
        definition.prefix || null,
        definition.suffix || null,
        definition.padLength || 5,
        definition.startValue || 1,
        definition.incrementBy || 1,
        definition.resetFrequency || 'never',
        definition.format || null,
      ]
    );
  }

  /**
   * Ensure sequence tables exist
   */
  async ensureSequenceTables(): Promise<void> {
    // Check if tables exist
    const tableExists = await this.dataSource.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables
        WHERE table_schema = 'public'
        AND table_name = 'sequence_definitions'
      )
    `);

    if (!tableExists[0].exists) {
      await this.createSequenceTables();
    }
  }

  /**
   * Create sequence management tables
   */
  private async createSequenceTables(): Promise<void> {
    await this.dataSource.query(`
      CREATE TABLE IF NOT EXISTS sequence_definitions (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        code VARCHAR(100) UNIQUE NOT NULL,
        name VARCHAR(255) NOT NULL,
        prefix VARCHAR(50),
        suffix VARCHAR(50),
        pad_length INTEGER DEFAULT 5,
        start_value INTEGER DEFAULT 1,
        increment_by INTEGER DEFAULT 1,
        reset_frequency VARCHAR(20) DEFAULT 'never',
        format VARCHAR(255),
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);

    await this.dataSource.query(`
      CREATE TABLE IF NOT EXISTS sequence_states (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        code VARCHAR(100) UNIQUE NOT NULL REFERENCES sequence_definitions(code) ON DELETE CASCADE,
        current_value BIGINT DEFAULT 0,
        last_reset_date DATE,
        updated_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);

    this.logger.log('Sequence tables created');
  }

  /**
   * Ensure sequence state exists for a code
   */
  private async ensureSequenceState(sequenceCode: string): Promise<void> {
    await this.ensureSequenceTables();

    // Check if definition exists, create default if not
    const defExists = await this.dataSource.query(
      `SELECT 1 FROM sequence_definitions WHERE code = $1`,
      [sequenceCode]
    );

    if (defExists.length === 0) {
      await this.createOrUpdateSequence({
        code: sequenceCode,
        name: sequenceCode,
        padLength: 5,
        startValue: 1,
        incrementBy: 1,
        resetFrequency: 'never',
      });
    }

    // Ensure state exists
    await this.dataSource.query(
      `
      INSERT INTO sequence_states (code, current_value, updated_at)
      VALUES ($1, 0, NOW())
      ON CONFLICT (code) DO NOTHING
      `,
      [sequenceCode]
    );
  }

  /**
   * Get sequence definition
   */
  private async getSequenceDefinition(sequenceCode: string): Promise<SequenceDefinition | null> {
    const result = await this.dataSource.query(
      `SELECT * FROM sequence_definitions WHERE code = $1`,
      [sequenceCode]
    );

    if (result.length === 0) {
      return null;
    }

    const row = result[0];
    return {
      code: row.code,
      name: row.name,
      prefix: row.prefix,
      suffix: row.suffix,
      padLength: row.pad_length,
      startValue: row.start_value,
      incrementBy: row.increment_by,
      resetFrequency: row.reset_frequency,
      format: row.format,
    };
  }

  /**
   * Check if sequence needs reset and reset if necessary
   */
  private async checkAndResetIfNeeded(
    sequenceCode: string,
    definition: SequenceDefinition
  ): Promise<boolean> {
    if (definition.resetFrequency === 'never') {
      return false;
    }

    const stateResult = await this.dataSource.query(
      `SELECT last_reset_date FROM sequence_states WHERE code = $1`,
      [sequenceCode]
    );

    if (stateResult.length === 0) {
      return false;
    }

    const lastReset = stateResult[0].last_reset_date
      ? new Date(stateResult[0].last_reset_date)
      : null;
    const now = new Date();

    let needsReset = false;

    if (!lastReset) {
      needsReset = true;
    } else {
      switch (definition.resetFrequency) {
        case 'daily':
          needsReset = !this.isSameDay(lastReset, now);
          break;
        case 'monthly':
          needsReset = !this.isSameMonth(lastReset, now);
          break;
        case 'yearly':
          needsReset = !this.isSameYear(lastReset, now);
          break;
      }
    }

    if (needsReset) {
      await this.resetSequence(sequenceCode, definition.startValue || 1);
    }

    return needsReset;
  }

  /**
   * Reset sequence to start value
   */
  private async resetSequence(sequenceCode: string, startValue: number): Promise<void> {
    await this.dataSource.query(
      `
      UPDATE sequence_states
      SET current_value = $2 - 1, last_reset_date = CURRENT_DATE, updated_at = NOW()
      WHERE code = $1
      `,
      [sequenceCode, startValue]
    );
  }

  /**
   * Atomically increment sequence and return new value
   */
  private async incrementSequence(sequenceCode: string, incrementBy: number): Promise<number> {
    const result = await this.dataSource.query(
      `
      UPDATE sequence_states
      SET current_value = current_value + $2, updated_at = NOW()
      WHERE code = $1
      RETURNING current_value
      `,
      [sequenceCode, incrementBy]
    );

    return result[0].current_value;
  }

  /**
   * Format sequence value according to definition
   */
  private formatSequenceValue(value: number, definition: SequenceDefinition): string {
    if (definition.format) {
      return this.applyCustomFormat(value, definition);
    }

    // Default formatting: PREFIX + padded number + SUFFIX
    const padded = String(value).padStart(definition.padLength || 5, '0');
    return `${definition.prefix || ''}${padded}${definition.suffix || ''}`;
  }

  /**
   * Apply custom format pattern
   *
   * Supported placeholders:
   * - {N} or {NUMBER} - The sequence number
   * - {N:5} - Padded to 5 digits
   * - {YYYY} - 4-digit year
   * - {YY} - 2-digit year
   * - {MM} - 2-digit month
   * - {DD} - 2-digit day
   * - {PREFIX} - Configured prefix
   * - {SUFFIX} - Configured suffix
   */
  private applyCustomFormat(value: number, definition: SequenceDefinition): string {
    let format = definition.format || '{PREFIX}{N:5}{SUFFIX}';
    const now = new Date();

    // Replace date placeholders
    format = format.replace('{YYYY}', String(now.getFullYear()));
    format = format.replace('{YY}', String(now.getFullYear()).slice(-2));
    format = format.replace('{MM}', String(now.getMonth() + 1).padStart(2, '0'));
    format = format.replace('{DD}', String(now.getDate()).padStart(2, '0'));

    // Replace prefix/suffix
    format = format.replace('{PREFIX}', definition.prefix || '');
    format = format.replace('{SUFFIX}', definition.suffix || '');

    // Replace number with padding
    format = format.replace(/\{N:(\d+)\}/g, (_, padding) => {
      return String(value).padStart(Number(padding), '0');
    });
    format = format.replace('{N}', String(value));
    format = format.replace('{NUMBER}', String(value));

    return format;
  }

  /**
   * Generate with default settings
   */
  private async generateWithDefaults(sequenceCode: string): Promise<string> {
    const result = await this.dataSource.query(
      `
      UPDATE sequence_states
      SET current_value = current_value + 1, updated_at = NOW()
      WHERE code = $1
      RETURNING current_value
      `,
      [sequenceCode]
    );

    const value = result[0].current_value;
    return String(value).padStart(5, '0');
  }

  // Date comparison helpers
  private isSameDay(d1: Date, d2: Date): boolean {
    return (
      d1.getFullYear() === d2.getFullYear() &&
      d1.getMonth() === d2.getMonth() &&
      d1.getDate() === d2.getDate()
    );
  }

  private isSameMonth(d1: Date, d2: Date): boolean {
    return d1.getFullYear() === d2.getFullYear() && d1.getMonth() === d2.getMonth();
  }

  private isSameYear(d1: Date, d2: Date): boolean {
    return d1.getFullYear() === d2.getFullYear();
  }
}
