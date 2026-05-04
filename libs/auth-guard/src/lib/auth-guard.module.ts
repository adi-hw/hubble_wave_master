import { Global, Module, Logger } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { JwtAuthGuard } from './jwt.guard';
import { RolesGuard } from './roles.guard';
import { PermissionsGuard } from './permissions.guard';

@Global()
@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => {
        const jwtSecret =
          configService.get<string>('JWT_SECRET') ||
          configService.get<string>('IDENTITY_JWT_SECRET');

        if (!jwtSecret) {
          throw new Error(
            'REQUIRED env var JWT_SECRET (or IDENTITY_JWT_SECRET) not set. ' +
            'Generate a secure secret with: node -e "console.log(require(\'crypto\').randomBytes(64).toString(\'hex\'))"'
          );
        }

        return { secret: jwtSecret };
      },
      inject: [ConfigService],
    }),
  ],
  providers: [
    JwtAuthGuard,
    RolesGuard,
    PermissionsGuard,
    {
      provide: Logger,
      useValue: new Logger('JwtAuthGuard'),
    },
  ],
  exports: [JwtAuthGuard, RolesGuard, PermissionsGuard, JwtModule, Logger],
})
export class AuthGuardModule {}
