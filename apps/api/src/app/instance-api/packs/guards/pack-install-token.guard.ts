import {
  CanActivate,
  ExecutionContext,
  Injectable,
  Logger,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { timingSafeEqual } from 'crypto';

const TOKEN_HEADER = 'x-pack-install-token';

/**
 * Verifies a service-token-style header on pack install/rollback endpoints.
 *
 * The header value is compared to `PACK_INSTALL_TOKEN` using timing-safe
 * equality. The token is rotated out-of-band (see SECRETS_ROTATION.md).
 */
@Injectable()
export class PackInstallTokenGuard implements CanActivate {
  private readonly logger = new Logger(PackInstallTokenGuard.name);

  canActivate(ctx: ExecutionContext): boolean {
    const expected = process.env.PACK_INSTALL_TOKEN;
    if (!expected) {
      this.logger.error(
        'PACK_INSTALL_TOKEN env var is not configured. Pack install endpoint is locked closed.',
      );
      throw new ServiceUnavailableException('Pack install endpoint not configured');
    }

    const request = ctx.switchToHttp().getRequest();
    const headers = (request?.headers ?? {}) as Record<string, unknown>;
    const raw = headers[TOKEN_HEADER];
    const provided = typeof raw === 'string' ? raw.trim() : '';

    if (!provided) {
      throw new UnauthorizedException(`Missing ${TOKEN_HEADER} header`);
    }

    const providedBuf = Buffer.from(provided, 'utf8');
    const expectedBuf = Buffer.from(expected, 'utf8');
    if (providedBuf.length !== expectedBuf.length) {
      throw new UnauthorizedException('Invalid pack install token');
    }
    if (!timingSafeEqual(providedBuf, expectedBuf)) {
      throw new UnauthorizedException('Invalid pack install token');
    }

    return true;
  }
}
