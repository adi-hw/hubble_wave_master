import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { HttpModule } from '@nestjs/axios';
import { OidcService } from './oidc.service';
import { OidcController } from './oidc.controller';
import { SsoAdminController } from './sso.controller';
import { AuthModule } from '../auth/auth.module';
import { InstanceDbModule } from '@hubblewave/instance-db';

@Module({
  imports: [
    InstanceDbModule,
    HttpModule.register({
      timeout: 10000,
      maxRedirects: 5,
    }),
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
  controllers: [OidcController, SsoAdminController],
  providers: [OidcService],
  exports: [OidcService],
})
export class OidcModule {}

