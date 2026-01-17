import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

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
    return token === expected;
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
