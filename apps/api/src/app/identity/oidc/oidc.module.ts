/**
 * OidcModule — SSO configuration management and stub OIDC/SAML controllers.
 *
 * `JwtModule` (HS256 / JWT_SECRET) was removed in Plan Fix 36 (canon §29.9).
 * Neither `OidcService` nor `SsoAdminController` inject or use `JwtService`.
 * All HubbleWave-internal token issuance flows through `TokenIssuerService`
 * → `KeySigningService` (ES256) in `apps/api/src/app/identity/auth/`.
 */
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

