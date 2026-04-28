/**
 * JWT Configuration Pre-flight Validation
 *
 * Verifies that JWT signing/verification env vars are present and consistent
 * across services in a deployment. Called from each service's bootstrap
 * before NestFactory.create so a misconfigured service fails fast at startup
 * rather than silently issuing tokens that downstream services cannot verify.
 */

export interface JwtConfigValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
}

/**
 * Validate JWT-related environment variables.
 *
 * Required in production (`NODE_ENV === 'production'`):
 *  - `JWT_SECRET` (already enforced by `validateSecurityConfig`)
 *  - `JWT_AUDIENCE`
 *  - `JWT_ISSUER`
 *
 * In non-production environments, missing `JWT_AUDIENCE` / `JWT_ISSUER` produce
 * warnings only - they default to `hubblewave-instance` / `hubblewave-identity`
 * inside the identity service for local dev.
 *
 * `JWT_AUDIENCE_EXPECTED`, when set on a service, is compared against
 * `JWT_AUDIENCE` and a mismatch is fatal in any environment. Operators set
 * this on every service to a single shared deployment-time value to catch
 * "I set audience=foo on identity but audience=bar on data" misconfigurations
 * before they reach a customer.
 */
export function validateJwtConfig(
  env: Record<string, string | undefined> = process.env,
): JwtConfigValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  const nodeEnv = env['NODE_ENV'] || 'development';
  const isProduction = nodeEnv === 'production';

  const audience = env['JWT_AUDIENCE'];
  const issuer = env['JWT_ISSUER'];
  const expectedAudience = env['JWT_AUDIENCE_EXPECTED'];
  const secret = env['JWT_SECRET'];

  if (!secret) {
    if (isProduction) {
      errors.push('CRITICAL: JWT_SECRET must be set in production');
    } else {
      warnings.push('WARNING: JWT_SECRET is not set; tokens cannot be signed or verified.');
    }
  }

  if (!audience) {
    if (isProduction) {
      errors.push(
        'CRITICAL: JWT_AUDIENCE must be set in production. ' +
        'Token audience claims will not validate without it.',
      );
    } else {
      warnings.push(
        'WARNING: JWT_AUDIENCE is not set; falling back to platform default. ' +
        'Set this explicitly before any production deploy.',
      );
    }
  }

  if (!issuer) {
    if (isProduction) {
      errors.push(
        'CRITICAL: JWT_ISSUER must be set in production. ' +
        'Token issuer claims will not validate without it.',
      );
    } else {
      warnings.push(
        'WARNING: JWT_ISSUER is not set; falling back to platform default. ' +
        'Set this explicitly before any production deploy.',
      );
    }
  }

  if (expectedAudience && audience && expectedAudience !== audience) {
    errors.push(
      `CRITICAL: JWT_AUDIENCE ("${audience}") does not match JWT_AUDIENCE_EXPECTED ` +
      `("${expectedAudience}"). This service was deployed with a JWT audience that ` +
      `differs from the deployment-wide expected value, so its tokens will be rejected ` +
      `by every other service. Resolve the mismatch before continuing.`,
    );
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings,
  };
}

/**
 * Validate JWT config and throw on any error. Designed for service bootstrap.
 *
 * @example
 * ```typescript
 * import { assertJwtConfig } from '@hubblewave/shared-types';
 *
 * async function bootstrap() {
 *   assertJwtConfig();
 *   // ... rest of bootstrap
 * }
 * ```
 */
export function assertJwtConfig(): void {
  const result = validateJwtConfig();

  for (const warning of result.warnings) {
    console.warn(`[JWT_CONFIG] ${warning}`);
  }

  if (!result.isValid) {
    for (const error of result.errors) {
      console.error(`[JWT_CONFIG] ${error}`);
    }
    throw new Error(
      'JWT configuration validation failed. ' +
      'See above errors and update your environment configuration.',
    );
  }
}
