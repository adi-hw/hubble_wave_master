/**
 * IdentityModule for the instance-api fold-in (InstanceApiModule).
 *
 * The previously-existing parallel HS256 auth path
 * (`instance-api/identity/auth/`) is deleted as part of Plan Fix 29
 * (canon §29.9 — HS256 forbidden everywhere). All token issuance now
 * flows through the canonical AuthService → TokenIssuerService → ES256
 * via KeySigningService (AwsKmsEs256KeySigningService in production,
 * LocalEs256KeySigningService in development).
 *
 * This module mounts a thin IdentityAuthAliasController at
 * `@Controller('identity/auth')` so the web client's base-URL convention
 * (`VITE_IDENTITY_API_URL = '/api/identity'` + `/auth/...` → effective
 * `/api/identity/auth/...`) continues to work without any client-side
 * changes. The alias controller has no business logic — it delegates
 * every call to the canonical AuthService.
 */
import { Module } from '@nestjs/common';
import { AuthModule } from '../../identity/auth/auth.module';
import { IdentityAuthAliasController } from './auth/identity-auth-alias.controller';

@Module({
  imports: [
    // AuthModule is the canonical ES256 token-issuance module. It exports
    // AuthService (which delegates signing to TokenIssuerService) and all
    // other auth-related services the alias controller needs.
    AuthModule,
  ],
  controllers: [IdentityAuthAliasController],
  exports: [],
})
export class IdentityModule {}
