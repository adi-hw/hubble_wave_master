import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { OidcService } from './oidc.service';
import { OidcController } from './oidc.controller';
import { SsoController } from './sso.controller';
import { AuthModule } from '../auth/auth.module';
import { TenantDbModule } from '@eam-platform/tenant-db';

@Module({
  imports: [
    TenantDbModule,
    JwtModule.registerAsync({
      imports: [ConfigModule],
      useFactory: async (configService: ConfigService) => ({
        secret: configService.get<string>('JWT_SECRET') || 'dev-secret-key',
        signOptions: { expiresIn: '15m' },
      }),
      inject: [ConfigService],
    }),
    AuthModule,
  ],
  controllers: [OidcController, SsoController],
  providers: [OidcService],
  exports: [OidcService],
})
export class OidcModule {}
