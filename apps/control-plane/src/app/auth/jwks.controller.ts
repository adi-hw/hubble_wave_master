import { Controller, Get, Inject } from '@nestjs/common';
import {
  KEY_SIGNING_SERVICE,
  KeySigningService,
  PublicJwk,
} from '@hubblewave/auth-guard';
import { Public } from './public.decorator';

/**
 * JSON Web Key Set publication for the control plane per canon §29.2.
 *
 * Mirrors `apps/api/src/app/identity/auth/jwks.controller.ts` but lives in
 * the control-plane app so the control-plane signing key is independently
 * discoverable. Pending / retired / compromised keys are excluded — only
 * active + retiring keys are JWKS-eligible (§29.2).
 *
 * The endpoint is intentionally public (no auth required) — RFC 7517
 * standard pattern. The control plane's `@Public()` decorator marks the
 * route so the global JwtAuthGuard does not reject it.
 */
@Controller('.well-known')
export class JwksController {
  constructor(
    @Inject(KEY_SIGNING_SERVICE)
    private readonly keySigning: KeySigningService,
  ) {}

  @Public()
  @Get('jwks.json')
  async getJwks(): Promise<{ keys: PublicJwk[] }> {
    const keys = await this.keySigning.getVerifyingKeys();
    const jwks = await Promise.all(
      keys.map((k) => this.keySigning.getPublicJwk(k.kid)),
    );
    return { keys: jwks };
  }
}
