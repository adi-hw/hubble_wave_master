import { Injectable, CanActivate, ExecutionContext, UnauthorizedException, Logger } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ApiKeyService } from './api-key.service';

/**
 * API Key Guard
 *
 * Validates API keys passed in the `x-api-key` header.
 * If valid, attaches user context with tenant information.
 * If not present, passes through to allow JWT authentication.
 *
 * Guard execution order: ApiKeyGuard runs BEFORE JwtAuthGuard
 */
@Injectable()
export class ApiKeyGuard implements CanActivate {
  private readonly logger = new Logger(ApiKeyGuard.name);

  constructor(
    private readonly apiKeyService: ApiKeyService,
    private readonly reflector: Reflector,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    // Check if route is marked as public
    const isPublic = this.reflector.getAllAndOverride<boolean>('isPublic', [
      context.getHandler(),
      context.getClass(),
    ]);

    if (isPublic) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const apiKeyHeader = request.headers['x-api-key'];

    // If no API key header, pass through to let JwtAuthGuard handle it
    if (!apiKeyHeader) {
      return true;
    }

    // Validate the API key
    const validatedKey = await this.apiKeyService.validateKey(apiKeyHeader as string);

    if (!validatedKey) {
      this.logger.warn(`Invalid API key attempt from IP: ${request.ip}`);
      throw new UnauthorizedException('Invalid API Key');
    }

    // Attach user context (similar structure to JWT payload)
    request.user = {
      userId: `api-key:${validatedKey.id}`, // Prefixed to distinguish from user IDs
      tenantId: validatedKey.tenantId,
      username: validatedKey.name,
      email: null,
      roles: ['api-integration'], // Special role for API integrations
      permissions: validatedKey.scopes, // API key scopes map to permissions
      groupIds: [],
      isApiKey: true,
      apiKeyId: validatedKey.id,
    };

    // Also set tenantId directly on request for TenantGuard compatibility
    request.tenantId = validatedKey.tenantId;

    // Mark auth type for downstream guards/middleware
    request.authType = 'api-key';

    this.logger.debug(`API key authenticated: ${validatedKey.name} for tenant ${validatedKey.tenantId}`);

    return true;
  }
}
