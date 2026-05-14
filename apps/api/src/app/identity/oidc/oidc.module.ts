import { Module } from '@nestjs/common';
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
    AuthModule,
  ],
  controllers: [OidcController, SsoAdminController],
  providers: [OidcService],
  exports: [OidcService],
})
export class OidcModule {}
