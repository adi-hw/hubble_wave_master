import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule, ConfigService } from '@nestjs/config';
import {
  User,
  AuthSettings,
  AuthEvent,
  RefreshToken,
  MfaMethod,
  SsoProvider,
  Role,
  Permission,
  RolePermission,
  UserRole,
  GroupRole,
  GroupMember,
} from '@hubblewave/instance-db';

import { AuthService } from './auth/auth.service';
import { AuthController } from './auth/auth.controller';
import { SsoConfigController } from './auth/sso-config.controller';
import { RefreshTokenService } from './auth/refresh-token.service';
import { AuthEventsService } from './auth/auth-events.service';
import { PermissionResolverService } from './auth/permission-resolver.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      User,
      AuthSettings,
      AuthEvent,
      RefreshToken,
      MfaMethod,
      SsoProvider,
      Role,
      Permission,
      RolePermission,
      UserRole,
      GroupRole,
      GroupMember,
    ]),
    PassportModule.register({ defaultStrategy: 'jwt' }),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => {
        const jwtSecret =
          configService.get<string>('JWT_SECRET') ||
          configService.get<string>('IDENTITY_JWT_SECRET');

        if (!jwtSecret) {
          throw new Error(
            'JWT_SECRET or IDENTITY_JWT_SECRET environment variable must be set.'
          );
        }

        const expiresIn = configService.get<string>('JWT_EXPIRY') || '15m';

        return {
          secret: jwtSecret,
          signOptions: {
            expiresIn: expiresIn as `${number}${'s' | 'm' | 'h' | 'd'}`,
          },
        };
      },
      inject: [ConfigService],
    }),
  ],
  controllers: [AuthController, SsoConfigController],
  providers: [
    AuthService,
    RefreshTokenService,
    AuthEventsService,
    PermissionResolverService,
  ],
  exports: [AuthService, PermissionResolverService],
})
export class IdentityModule {}
