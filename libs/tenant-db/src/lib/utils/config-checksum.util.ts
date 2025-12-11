import { createHash } from 'crypto';

/**
 * Generates a SHA-256 checksum for configuration data.
 * Used for change detection in platform configs and upgrade manifests.
 *
 * The checksum is computed on a canonical JSON representation to ensure
 * consistent hashes regardless of property order.
 */
export function generateConfigChecksum(data: Record<string, any>): string {
  const canonicalJson = canonicalizeJson(data);
  return createHash('sha256').update(canonicalJson).digest('hex');
}

/**
 * Compares two configurations and returns whether they are equivalent.
 * Uses checksum comparison for efficiency.
 */
export function configsAreEqual(
  config1: Record<string, any>,
  config2: Record<string, any>
): boolean {
  return generateConfigChecksum(config1) === generateConfigChecksum(config2);
}

/**
 * Verifies that a config's stored checksum matches its current content.
 * Returns true if valid, false if the content has been tampered with.
 */
export function verifyConfigChecksum(
  data: Record<string, any>,
  expectedChecksum: string
): boolean {
  const actualChecksum = generateConfigChecksum(data);
  return actualChecksum === expectedChecksum;
}

/**
 * Generates checksums for multiple configs in batch.
 * Useful for upgrade manifest generation.
 */
export function generateBatchChecksums(
  configs: Array<{ key: string; data: Record<string, any> }>
): Map<string, string> {
  const checksums = new Map<string, string>();
  for (const config of configs) {
    checksums.set(config.key, generateConfigChecksum(config.data));
  }
  return checksums;
}

/**
 * Converts a JSON object to a canonical string representation.
 * - Keys are sorted alphabetically at all levels
 * - Arrays maintain their order
 * - Undefined values are excluded
 * - Null values are preserved
 * - Numbers are normalized
 */
function canonicalizeJson(obj: any): string {
  return JSON.stringify(sortObjectKeys(obj));
}

/**
 * Recursively sorts object keys alphabetically.
 */
function sortObjectKeys(obj: any): any {
  if (obj === null || obj === undefined) {
    return obj;
  }

  if (Array.isArray(obj)) {
    return obj.map(sortObjectKeys);
  }

  if (typeof obj === 'object') {
    const sortedObj: Record<string, any> = {};
    const keys = Object.keys(obj).sort();

    for (const key of keys) {
      const value = obj[key];
      // Skip undefined values for consistent serialization
      if (value !== undefined) {
        sortedObj[key] = sortObjectKeys(value);
      }
    }

    return sortedObj;
  }

  return obj;
}

/**
 * Generates a short checksum (first 8 characters) for display purposes.
 * Not suitable for security-critical comparisons.
 */
export function generateShortChecksum(data: Record<string, any>): string {
  return generateConfigChecksum(data).substring(0, 8);
}

/**
 * Type guard to check if a value is a valid checksum format.
 */
export function isValidChecksum(value: unknown): value is string {
  if (typeof value !== 'string') return false;
  // SHA-256 produces 64 hex characters
  return /^[a-f0-9]{64}$/i.test(value);
}
