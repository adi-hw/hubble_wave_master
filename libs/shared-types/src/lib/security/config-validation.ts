/**
 * Security Configuration Validation
 *
 * CRITICAL: This module validates that production deployments don't use
 * default/development secrets that could compromise security.
 */

/**
 * Known insecure default secrets that MUST NOT be used in production
 */
const KNOWN_INSECURE_SECRETS = [
  // JWT secrets
  'acme-dev-jwt-secret-change-in-production',
  'hubblewave-control-plane-dev-secret-change-in-production',
  'your-jwt-secret-here',
  'change-me-in-production',
  'development-secret',
  'test-secret',
  'secret',
  'jwt-secret',

  // Database passwords
  'hubblewave_dev_password',
  'password',
  'postgres',
  'admin',
  'root',
  '123456',
  'changeme',
];

/**
 * Environment variable names that contain secrets
 */
const SECRET_ENV_VARS = [
  'JWT_SECRET',
  'DB_PASSWORD',
  'REDIS_PASSWORD',
  'SMTP_PASSWORD',
  'API_SECRET',
  'ENCRYPTION_KEY',
  'SESSION_SECRET',
  'CONTROL_PLANE_DB_PASSWORD',
];

export interface SecurityValidationResult {
  isSecure: boolean;
  errors: string[];
  warnings: string[];
}

/**
 * Validate that secrets are not using known insecure defaults
 *
 * @param env - Environment variables to validate (defaults to process.env)
 * @returns Validation result with errors and warnings
 *
 * @example
 * ```typescript
 * const result = validateSecurityConfig();
 * if (!result.isSecure) {
 *   console.error('Security configuration errors:', result.errors);
 *   process.exit(1);
 * }
 * ```
 */
export function validateSecurityConfig(
  env: Record<string, string | undefined> = process.env
): SecurityValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  const nodeEnv = env['NODE_ENV'] || 'development';
  const isProduction = nodeEnv === 'production';

  for (const varName of SECRET_ENV_VARS) {
    const value = env[varName];

    if (!value) {
      if (isProduction && varName === 'JWT_SECRET') {
        errors.push(`CRITICAL: ${varName} is not set. This is required in production.`);
      }
      continue;
    }

    // Check against known insecure values
    const normalizedValue = value.toLowerCase().trim();
    for (const insecure of KNOWN_INSECURE_SECRETS) {
      if (normalizedValue === insecure.toLowerCase() || normalizedValue.includes(insecure.toLowerCase())) {
        if (isProduction) {
          errors.push(
            `CRITICAL: ${varName} contains a known insecure default value. ` +
            `Generate a secure secret with: node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"`
          );
        } else {
          warnings.push(
            `WARNING: ${varName} uses a development default. ` +
            `This is acceptable for development but MUST be changed for production.`
          );
        }
        break;
      }
    }

    // Check for weak secrets (too short or common patterns)
    if (isProduction && varName === 'JWT_SECRET') {
      if (value.length < 32) {
        errors.push(`CRITICAL: ${varName} is too short (${value.length} chars). Minimum 32 characters required for production.`);
      }
    }
  }

  // Check for missing required env vars in production
  if (isProduction) {
    if (!env['JWT_SECRET']) {
      errors.push('CRITICAL: JWT_SECRET must be set in production');
    }
  }

  return {
    isSecure: errors.length === 0,
    errors,
    warnings,
  };
}

/**
 * Validate security config and throw if critical issues found (for use in bootstrap)
 *
 * @throws Error if security configuration is invalid in production
 *
 * @example
 * ```typescript
 * // In main.ts
 * import { assertSecureConfig } from '@hubblewave/shared-types';
 *
 * async function bootstrap() {
 *   assertSecureConfig(); // Throws in production if insecure
 *   // ... rest of bootstrap
 * }
 * ```
 */
export function assertSecureConfig(): void {
  const result = validateSecurityConfig();

  // Always log warnings
  for (const warning of result.warnings) {
    console.warn(`[SECURITY] ${warning}`);
  }

  // In production, errors are fatal
  if (!result.isSecure) {
    for (const error of result.errors) {
      console.error(`[SECURITY] ${error}`);
    }
    throw new Error(
      'Security configuration validation failed. ' +
      'See above errors and update your environment configuration.'
    );
  }
}

/**
 * Get security recommendations for a given environment
 */
export function getSecurityRecommendations(): string[] {
  return [
    'Generate strong secrets: node -e "console.log(require(\'crypto\').randomBytes(64).toString(\'hex\'))"',
    'Use environment-specific .env files (never commit production secrets)',
    'Consider using a secrets manager (HashiCorp Vault, AWS Secrets Manager, etc.)',
    'Rotate secrets periodically (at least annually)',
    'Use different secrets for each environment (dev, staging, production)',
    'Never log or expose secrets in error messages',
  ];
}
