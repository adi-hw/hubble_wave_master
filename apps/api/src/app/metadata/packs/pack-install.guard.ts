import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtAuthGuard } from '@hubblewave/auth-guard';
import { isObservable, lastValueFrom } from 'rxjs';

type PackAuthContext = {
  userId: string;
  roles: string[];
  permissions: string[];
  isAdmin: boolean;
  sessionId: string;
  username: string;
  attributes: Record<string, unknown>;
  raw: Record<string, unknown>;
};

@Injectable()
export class PackInstallGuard implements CanActivate {
  constructor(
    private readonly configService: ConfigService,
    private readonly jwtAuthGuard: JwtAuthGuard,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const authHeader = request.headers?.authorization;
    const token = this.parseBearer(authHeader);

    if (token && this.isPackToken(token)) {
      const packContext: PackAuthContext = {
        userId: 'system',
        roles: ['system'],
        permissions: [],
        isAdmin: true,
        sessionId: 'pack-install',
        username: 'pack-install',
        attributes: {},
        raw: { source: 'control-plane' },
      };
      request.user = packContext;
      request.context = packContext;
      return true;
    }

    // JwtAuthGuard.canActivate returns Promise<boolean> after the
    // F002/F013/F016 fix introduced async identity + revocation lookups.
    // The widening for boolean / Observable preserves tolerance to the
    // broader CanActivate contract, but the common path is a single await.
    const result = this.jwtAuthGuard.canActivate(context) as
      | boolean
      | Promise<boolean>
      | ReturnType<JwtAuthGuard['canActivate']>;
    if (typeof result === 'boolean') {
      return result;
    }
    if (isObservable(result)) {
      return lastValueFrom(result) as Promise<boolean>;
    }
    return result;
  }

  private parseBearer(authHeader?: string): string | null {
    if (!authHeader || typeof authHeader !== 'string') {
      return null;
    }
    if (!authHeader.startsWith('Bearer ')) {
      return null;
    }
    const token = authHeader.slice('Bearer '.length).trim();
    return token.length > 0 ? token : null;
  }

  private isPackToken(token: string): boolean {
    const configured =
      this.configService.get<string>('PACK_INSTALL_TOKEN') ||
      this.configService.get<string>('INSTANCE_PACK_INSTALL_TOKEN') ||
      this.configService.get<string>('CONTROL_PLANE_INSTANCE_TOKEN');
    if (!configured) {
      return false;
    }
    return token === configured;
  }
}
