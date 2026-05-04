import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { timingSafeEqual } from 'crypto';

@Injectable()
export class InstanceTokenGuard implements CanActivate {
  constructor(private readonly configService: ConfigService) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const token = this.extractToken(request?.headers);
    if (!token) {
      return false;
    }

    const expected = this.configService.get<string>('CONTROL_PLANE_INSTANCE_TOKEN');
    if (!expected) {
      return false;
    }
    return this.tokensMatch(token, expected);
  }

  /**
   * Compare provided and expected tokens without short-circuiting on the
   * first differing byte. A naive `===` leaks the prefix length to a
   * remote attacker via response timing; the constant-time comparison
   * removes that channel. The length pre-check itself never feeds material
   * back into the timing-sensitive compare.
   */
  private tokensMatch(provided: string, expected: string): boolean {
    const providedBuf = Buffer.from(provided, 'utf8');
    const expectedBuf = Buffer.from(expected, 'utf8');
    if (providedBuf.length !== expectedBuf.length) {
      return false;
    }
    return timingSafeEqual(providedBuf, expectedBuf);
  }

  private extractToken(headers?: Record<string, unknown>): string | null {
    if (!headers) {
      return null;
    }
    const authHeader = headers['authorization'];
    if (typeof authHeader === 'string' && authHeader.startsWith('Bearer ')) {
      const token = authHeader.slice('Bearer '.length).trim();
      return token.length > 0 ? token : null;
    }
    const headerToken = headers['x-instance-token'];
    if (typeof headerToken === 'string' && headerToken.trim()) {
      return headerToken.trim();
    }
    return null;
  }
}
