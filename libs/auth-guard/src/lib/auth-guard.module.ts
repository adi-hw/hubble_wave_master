import { Global, Module, Logger } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { JwtAuthGuard } from './jwt.guard';

@Global()
@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => {
        const isProd = configService.get('NODE_ENV') === 'production';
        const jwtSecret =
          configService.get('JWT_SECRET') ||
          configService.get('IDENTITY_JWT_SECRET') ||
          (isProd ? undefined : 'dev-only-insecure-secret');

        if (!jwtSecret) {
          throw new Error(
            'JWT_SECRET environment variable must be set in production. ' +
            'Generate a secure secret with: node -e "console.log(require(\'crypto\').randomBytes(64).toString(\'hex\'))"'
          );
        }

        if (!isProd && jwtSecret === 'dev-only-insecure-secret') {
          Logger.warn('AuthGuardModule using insecure dev JWT secret', 'AuthGuardModule');
        }

        return { secret: jwtSecret };
      },
      inject: [ConfigService],
    }),
  ],
  providers: [
    JwtAuthGuard,
    {
      provide: Logger,
      useValue: new Logger('JwtAuthGuard'),
    },
  ],
  exports: [JwtAuthGuard, JwtModule, Logger],
})
export class AuthGuardModule {}
