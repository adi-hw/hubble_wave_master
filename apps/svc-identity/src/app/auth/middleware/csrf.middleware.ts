import { Injectable, NestMiddleware, ForbiddenException, Logger } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import * as crypto from 'crypto';

/**
 * CSRF Protection Middleware
 *
 * Implements double-submit cookie pattern:
 * 1. Server sets a CSRF token in a readable cookie (XSRF-TOKEN)
 * 2. Client must send this token back in X-XSRF-TOKEN header for state-changing requests
 * 3. Server verifies cookie value matches header value
 *
 * Combined with SameSite=Strict cookies for refresh tokens, this provides defense-in-depth.
 */
@Injectable()
export class CsrfMiddleware implements NestMiddleware {
  private readonly logger = new Logger(CsrfMiddleware.name);
  private readonly CSRF_COOKIE_NAME = 'XSRF-TOKEN';
  private readonly CSRF_HEADER_NAME = 'x-xsrf-token';

  // Methods that require CSRF protection
  private readonly protectedMethods = ['POST', 'PUT', 'PATCH', 'DELETE'];

  // Path patterns that are exempt from CSRF (public/stateless endpoints)
  // Uses pattern matching to handle paths with or without /api prefix
  private readonly exemptPatterns = [
    /^\/(?:api\/)?auth\/login$/,
    /^\/(?:api\/)?auth\/refresh$/,
    /^\/(?:api\/)?auth\/logout$/,
    /^\/(?:api\/)?auth\/change-password-expired$/,
    /^\/(?:api\/)?auth\/password-reset\/.*/,
    /^\/(?:api\/)?auth\/email-verification\/.*/,
    /^\/(?:api\/)?auth\/sso\/.*/,
    /^\/(?:api\/)?auth\/api-keys/,
    /^\/(?:api\/)?auth\/mfa\/.*/,
    /^\/(?:api\/)?health$/,
  ];

  use(req: Request, res: Response, next: NextFunction) {
    const path = req.path;
    const originalUrl = req.originalUrl;
    const method = req.method.toUpperCase();

    // Generate or refresh CSRF token cookie for all requests
    this.ensureCsrfCookie(req, res);

    // Skip CSRF check for safe methods
    if (!this.protectedMethods.includes(method)) {
      return next();
    }

    // Skip CSRF check for exempt paths (check both path and originalUrl)
    if (this.isExemptPath(path) || this.isExemptPath(originalUrl)) {
      this.logger.debug(`CSRF exempt: ${method} ${path} (originalUrl: ${originalUrl})`);
      return next();
    }

    // Skip CSRF check for API key authenticated requests
    if (req.headers['x-api-key']) {
      return next();
    }

    // Validate CSRF token for protected methods
    const cookieToken = this.getCsrfCookieValue(req);
    const headerToken = req.headers[this.CSRF_HEADER_NAME] as string | undefined;

    if (!cookieToken || !headerToken) {
      this.logger.warn(`CSRF validation failed: missing token for ${method} ${path} (originalUrl: ${originalUrl})`);
      throw new ForbiddenException('CSRF token missing');
    }

    // Constant-time comparison to prevent timing attacks
    if (!this.secureCompare(cookieToken, headerToken)) {
      this.logger.warn(`CSRF validation failed: token mismatch for ${method} ${path}`);
      throw new ForbiddenException('CSRF token mismatch');
    }

    next();
  }

  private isExemptPath(path: string): boolean {
    // Strip query string if present
    const cleanPath = path.split('?')[0];
    return this.exemptPatterns.some(pattern => pattern.test(cleanPath));
  }

  private ensureCsrfCookie(req: Request, res: Response): void {
    const existingToken = this.getCsrfCookieValue(req);

    // If no token exists, generate a new one
    if (!existingToken) {
      const token = this.generateCsrfToken();
      res.cookie(this.CSRF_COOKIE_NAME, token, {
        httpOnly: false, // Must be readable by JavaScript
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        path: '/',
        maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
      });
    }
  }

  private getCsrfCookieValue(req: Request): string | undefined {
    const cookies = req.cookies || {};
    return cookies[this.CSRF_COOKIE_NAME];
  }

  private generateCsrfToken(): string {
    return crypto.randomBytes(32).toString('hex');
  }

  private secureCompare(a: string, b: string): boolean {
    // Use constant-time comparison to prevent timing attacks
    if (a.length !== b.length) {
      return false;
    }
    return crypto.timingSafeEqual(Buffer.from(a), Buffer.from(b));
  }
}
