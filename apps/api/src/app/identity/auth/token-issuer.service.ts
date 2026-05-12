import {
  Inject,
  Injectable,
  Logger,
  OnModuleInit,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'crypto';
import {
  IDENTITY_RESOLVER_PORT,
  IdentityResolverPort,
  KEY_SIGNING_SERVICE,
  KeySigningService,
} from '@hubblewave/auth-guard';

/**
 * Minimum and maximum allowed values for `JWT_ACCESS_TTL_SECONDS` per
 * canon §29.4 ("5/10/15 min range for access tokens"). Values outside
 * the range cause the service to throw at startup — stale permissions
 * are NOT solved with longer JWTs (canon §29.4 second sentence).
 */
const ACCESS_TOKEN_TTL_MIN_SECONDS = 300; // 5 minutes
const ACCESS_TOKEN_TTL_MAX_SECONDS = 900; // 15 minutes
const ACCESS_TOKEN_TTL_DEFAULT_SECONDS = 600; // 10 minutes (canon §29.4 default)

/**
 * Canonical issuer prefix per canon §29.3. The full issuer is
 * `hubblewave-{instance_id}`. Verifiers MUST validate that `iss` starts
 * with this prefix (the suffix carries the instance id).
 */
const ISSUER_PREFIX = 'hubblewave-';

/**
 * Default audience per canon §29.3 (human tokens). Service-to-service
 * tokens use `svc-{target}` and are minted by canon §29.7 work, not by
 * this service.
 */
const DEFAULT_AUDIENCE = 'hubblewave-instance';

/**
 * `TokenIssuerService` — single mint point for HubbleWave access tokens per
 * canon §29.3.
 *
 * Replaces all `jwtService.sign(...)` call sites in the identity flows
 * (login, refresh, MFA-verify, magic-link, SSO post-callback). The service
 * encapsulates four invariants every issued token MUST satisfy:
 *
 *   1. **Signature**: ES256 via `KeySigningService.sign()`. The kid is
 *      embedded in the JWT header; the private key never leaves its
 *      custodian (KMS HSM in prod, local 0600 file in dev — canon §29.9).
 *   2. **Claims contract** (canon §29.3): `iss`, `aud`, `sub`, `iat`,
 *      `exp`, `instance_id`, `session_id`, `token_version`. Every claim
 *      is set here; callers cannot omit any of them.
 *   3. **TTL bounds**: `JWT_ACCESS_TTL_SECONDS` must be in [300, 900].
 *      Out-of-range configuration is caught at `onModuleInit` — the
 *      service refuses to start so a misconfigured instance never mints
 *      a single bad token. Stale permissions are addressed by §29.6
 *      `security_stamp` bumps, not by stretching TTLs.
 *   4. **Token-version embedding** (canon §29.6): the current user's
 *      `security_stamp` is fetched from `IdentityResolverPort` and copied
 *      into `token_version`. Verifiers compare this on every request so a
 *      stamp bump invalidates every outstanding token for the user.
 *
 * The service is NOT a replacement for `KeySigningService` — that one
 * does the cryptographic work. This one shapes the payload.
 */
@Injectable()
export class TokenIssuerService implements OnModuleInit {
  private readonly logger = new Logger(TokenIssuerService.name);

  /**
   * Cached at startup so every issue call sees the same value (changing it
   * requires a process restart, matching the "fail fast" posture of all
   * canon §29 configuration).
   */
  private accessTokenTtlSeconds: number = ACCESS_TOKEN_TTL_DEFAULT_SECONDS;

  constructor(
    @Inject(KEY_SIGNING_SERVICE)
    private readonly keySigning: KeySigningService,
    @Inject(IDENTITY_RESOLVER_PORT)
    private readonly identityResolver: IdentityResolverPort,
    private readonly configService: ConfigService,
  ) {}

  onModuleInit(): void {
    // Canon §29.4 — the TTL window is enforced at startup, not per call.
    // A misconfigured instance must not boot.
    this.accessTokenTtlSeconds = this.loadAndValidateTtl();
    this.logger.log(
      `Access token TTL configured: ${this.accessTokenTtlSeconds}s (canon §29.4)`,
    );
  }

  /**
   * Mint a HubbleWave access token per canon §29.3.
   *
   * Fetches the user's current `security_stamp` via `IdentityResolverPort`
   * (so the stamp is fresh — a stale read here would defeat the kill-switch
   * the very thing this service is designed to enable). Throws
   * `UnauthorizedException` when the user resolves to null, the same shape
   * the guard surfaces for a deleted user; callers should never reach this
   * branch for an authenticated user.
   *
   * @param params.userId  the subject (without the `user:` prefix; the
   *                       service prepends it per canon §29.3).
   * @param params.sessionId  the persisted session row id used for
   *                          revocation lookups.
   * @returns `{ token, expiresIn }`. `expiresIn` is the configured TTL in
   *          seconds; callers expose it to clients so they know when to
   *          refresh.
   */
  async issueAccessToken(params: {
    userId: string;
    sessionId: string;
  }): Promise<{ token: string; expiresIn: number }> {
    const identity = await this.identityResolver.resolveIdentity(params.userId);
    if (!identity) {
      throw new UnauthorizedException('User not found');
    }
    if (identity.status !== 'active') {
      // The same posture JwtAuthGuard takes — a suspended user does not
      // get a fresh token mid-flow even if the calling endpoint somehow
      // bypassed the lifecycle check upstream.
      throw new UnauthorizedException('User is inactive');
    }

    const instanceId = this.resolveInstanceId();
    const audience = this.resolveAudience();
    const now = Math.floor(Date.now() / 1000);
    const ttl = this.accessTokenTtlSeconds;

    const payload: Record<string, unknown> = {
      // Canon §29.3 — every claim below is required, no optional fields.
      iss: `${ISSUER_PREFIX}${instanceId}`,
      aud: audience,
      sub: `user:${params.userId}`,
      iat: now,
      exp: now + ttl,
      instance_id: instanceId,
      session_id: params.sessionId,
      // Canon §29.6 — the cross-cutting kill-switch. Verifiers compare
      // this to the live DB value; mismatch → reject with 'Token version
      // stale'.
      token_version: identity.securityStamp,
      // Convenience claims that survive the migration unchanged. The
      // guard reads roles/permissions via IdentityResolverPort (F013) so
      // these are NOT authoritative; they exist so debugging tools that
      // decode the JWT still show the role context, and so test fixtures
      // that skip the resolver port stay functionally correct.
      roles: identity.roles,
      permissions: identity.permissions,
      is_admin: identity.isAdmin,
      username: identity.userId, // overridden by callers that have a real display name
    };

    const token = await this.keySigning.sign(payload);
    return { token, expiresIn: ttl };
  }

  /**
   * Generate a fresh session id for a new login. Callers may pass their
   * own session id (e.g. when binding to an existing UserSession row) —
   * this helper exists for paths that mint the JWT before they persist
   * the session.
   */
  generateSessionId(): string {
    return randomUUID();
  }

  /**
   * Surface the TTL to callers that need it for response shaping (e.g.
   * `{ expiresIn }` payloads) without re-reading config.
   */
  getAccessTokenTtlSeconds(): number {
    return this.accessTokenTtlSeconds;
  }

  // ───────────────────────────────────────────────────────────────────
  // Internals
  // ───────────────────────────────────────────────────────────────────

  private loadAndValidateTtl(): number {
    const raw = this.configService.get<string | number>('JWT_ACCESS_TTL_SECONDS');
    if (raw === undefined || raw === null || raw === '') {
      return ACCESS_TOKEN_TTL_DEFAULT_SECONDS;
    }
    const parsed = typeof raw === 'number' ? raw : parseInt(String(raw), 10);
    if (!Number.isFinite(parsed) || !Number.isInteger(parsed)) {
      throw new Error(
        `JWT_ACCESS_TTL_SECONDS must be an integer; got '${raw}' (canon §29.4)`,
      );
    }
    if (
      parsed < ACCESS_TOKEN_TTL_MIN_SECONDS ||
      parsed > ACCESS_TOKEN_TTL_MAX_SECONDS
    ) {
      throw new Error(
        `JWT_ACCESS_TTL_SECONDS must be in [${ACCESS_TOKEN_TTL_MIN_SECONDS}, ${ACCESS_TOKEN_TTL_MAX_SECONDS}]; ` +
          `got ${parsed} (canon §29.4). Stale permissions are solved with security_stamp, not longer TTLs.`,
      );
    }
    return parsed;
  }

  private resolveInstanceId(): string {
    // Canon §5: single-tenant deployments use the configured INSTANCE_ID
    // (or 'default-instance' for dev). Pooled-mode instances supply per
    // tenant via the same env var.
    return (
      this.configService.get<string>('INSTANCE_ID') ||
      process.env['INSTANCE_ID'] ||
      'default-instance'
    );
  }

  private resolveAudience(): string {
    return (
      this.configService.get<string>('JWT_AUDIENCE') ||
      process.env['JWT_AUDIENCE'] ||
      DEFAULT_AUDIENCE
    );
  }
}
