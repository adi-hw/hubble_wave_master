import { Repository } from 'typeorm';
import { InjectRepository } from '@nestjs/typeorm';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { PassportStrategy } from '@nestjs/passport';
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { User } from '@hubblewave/instance-db';
import { PermissionResolverService } from '../roles/permission-resolver.service';
import { JwtPayload } from '@hubblewave/shared-types';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    configService: ConfigService,
    @InjectRepository(User) private readonly userRepo: Repository<User>,
    private readonly permissionResolver: PermissionResolverService,
  ) {
    const jwtSecret = configService.get<string>('JWT_SECRET');

    if (!jwtSecret) {
      throw new Error(
        'JWT_SECRET environment variable must be set. ' +
        'Generate a secure secret with: node -e "console.log(require(\'crypto\').randomBytes(64).toString(\'hex\'))"'
      );
    }

    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: jwtSecret,
    });
  }

  async validate(payload: JwtPayload) {
    const userId = payload.sub;

    const user = await this.userRepo.findOne({
      where: { id: userId },
    });

    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    if (user.status !== 'active') {
      throw new UnauthorizedException('User is inactive');
    }

    // Resolve permissions using the resolver service
    // This handles caching, role inheritance, and efficient lookup
    const { permissions, roles } = await this.permissionResolver.getUserPermissions(userId);

    return {
      userId: user.id,
      email: user.email,
      username: user.username,
      roles: roles.map(r => r.code), // Use code (slug)
      permissions: Array.from(permissions),
      sessionId: payload.session_id,
    };
  }
}
