import { Controller, Get, Inject } from '@nestjs/common';
import {
  KEY_SIGNING_SERVICE,
  KeySigningService,
  Public,
  PublicJwk,
} from '@hubblewave/auth-guard';

/**
 * JSON Web Key Set publication endpoint per canon §29.2.
 *
 * Exposes the public components of every `active` and `retiring` signing
 * key. Pending, retired, and compromised keys are excluded — the
 * `KeySigningService.getVerifyingKeys()` contract enforces this so the
 * controller is a thin renderer.
 *
 * The endpoint is intentionally public (no auth required) — this is the
 * standard JWKS pattern (RFC 7517) and the standard way relying parties
 * discover our signing keys. Per canon §29 PR-A, `apps/api/src/app/
 * identity/auth/jwks.controller.ts` is on the security-bypass
 * PUBLIC_ALLOWLIST.
 *
 * In pooled mode (canon §5 SOFTEN), this single-tenant root path is the
 * right answer for now. Multi-tenant routing (`/{tenant_id}/.well-known/
 * jwks.json` or vhost-based) is a follow-up.
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
