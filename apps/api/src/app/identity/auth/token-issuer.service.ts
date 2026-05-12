import {
  ForbiddenException,
  Inject,
  Injectable,
  Logger,
  OnModuleInit,
  Optional,
  UnauthorizedException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { InjectDataSource } from '@nestjs/typeorm';
import { ConfigService } from '@nestjs/config';
import {
  createHash,
  randomBytes,
  randomUUID,
} from 'crypto';
import { DataSource, EntityManager, IsNull, Repository } from 'typeorm';
import {
  IDENTITY_RESOLVER_PORT,
  IdentityResolverPort,
  KEY_SIGNING_SERVICE,
  KeySigningService,
} from '@hubblewave/auth-guard';
import {
  ACCESS_AUDIT_PORT,
  type AccessAuditPort,
} from '@hubblewave/authorization';
import {
  RefreshToken,
  ServicePrincipal,
  type RefreshTokenRevokedReason,
} from '@hubblewave/instance-db';
import { JwtRevocationAdapter } from './jwt-revocation.adapter';

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
 * Refresh-token TTL bounds per canon §29.4 + §29.5. Founder-locked
 * defaults (PR-C amendment): default 14 days, configurable in [1, 30].
 * Values outside the range fail startup — same fail-fast posture as
 * `JWT_ACCESS_TTL_SECONDS`.
 */
const REFRESH_TOKEN_TTL_MIN_DAYS = 1;
const REFRESH_TOKEN_TTL_MAX_DAYS = 30;
const REFRESH_TOKEN_TTL_DEFAULT_DAYS = 14;

/**
 * Generic 401 message returned to the client on every refresh failure
 * mode. Canon §29.5 + founder direction explicitly require that
 * reuse-detection responses are indistinguishable from any other
 * "your session is gone" 401 — leaking the reuse signal trains
 * attackers on how to probe the revocation surface.
 */
const SESSION_EXPIRED_MESSAGE =
  'Your session has expired. Please sign in again.';

/**
 * Bytes of entropy in the opaque refresh-token string. 32 bytes = 256
 * bits, encoded as 43-char base64url. Matches OWASP guidance for
 * persistent session identifiers.
 */
const REFRESH_TOKEN_ENTROPY_BYTES = 32;

/**
 * Canonical issuer prefix per canon §29.3. The full issuer is
 * `hubblewave-{instance_id}`. Verifiers MUST validate that `iss` starts
 * with this prefix (the suffix carries the instance id).
 */
const ISSUER_PREFIX = 'hubblewave-';

/**
 * Default audience per canon §29.3 (human tokens). Service-to-service
 * tokens use `svc-{target}` per canon §29.7 — see
 * `issueServiceToken` below.
 */
const DEFAULT_AUDIENCE = 'hubblewave-instance';

/**
 * Service-token TTL per canon §29.4 — 5 minutes, fixed, no instance
 * override. Stale service permissions are addressed by rotating the
 * `service_principals` row + waiting at most 5 minutes for in-flight
 * tokens to expire, NOT by stretching TTL.
 */
const SERVICE_TOKEN_TTL_SECONDS = 300;

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

  /**
   * Refresh-token TTL in seconds, derived from `JWT_REFRESH_TTL_DAYS` at
   * startup. Cached so every issue call sees the same value.
   */
  private refreshTokenTtlSeconds: number =
    REFRESH_TOKEN_TTL_DEFAULT_DAYS * 24 * 60 * 60;

  constructor(
    @Inject(KEY_SIGNING_SERVICE)
    private readonly keySigning: KeySigningService,
    @Inject(IDENTITY_RESOLVER_PORT)
    private readonly identityResolver: IdentityResolverPort,
    private readonly configService: ConfigService,
    @InjectRepository(RefreshToken)
    private readonly refreshTokenRepo: Repository<RefreshToken>,
    @InjectRepository(ServicePrincipal)
    private readonly servicePrincipalRepo: Repository<ServicePrincipal>,
    @InjectDataSource()
    private readonly dataSource: DataSource,
    private readonly sessionRevoker: JwtRevocationAdapter,
    @Optional()
    @Inject(ACCESS_AUDIT_PORT)
    private readonly accessAudit: AccessAuditPort | null = null,
  ) {}

  onModuleInit(): void {
    // Canon §29.4 — the TTL window is enforced at startup, not per call.
    // A misconfigured instance must not boot.
    this.accessTokenTtlSeconds = this.loadAndValidateAccessTtl();
    this.refreshTokenTtlSeconds = this.loadAndValidateRefreshTtl();
    this.logger.log(
      `Access token TTL: ${this.accessTokenTtlSeconds}s | ` +
        `Refresh token TTL: ${this.refreshTokenTtlSeconds}s (canon §29.4)`,
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
   * Mint a HubbleWave service-to-service token per canon §29.7.
   *
   * Looks up the calling service in `service_principals`, validates the
   * requested audience is in `allowed_audiences`, and emits an ES256
   * JWT with `sub: service:<id>`, `aud: <audience>`, the principal's
   * `allowed_scopes` copied into the `scope` claim, and a fresh
   * `session_id` (every mint is its own session — service tokens do
   * not share session identity with prior mints).
   *
   * Service tokens deliberately OMIT the `token_version` claim per
   * canon §29.6 — services have no user identity, no `security_stamp`,
   * and no cross-cutting kill-switch through that mechanism. Killing
   * a service identity is done by flipping `active = false` on the
   * principal row, after which no new tokens mint; in-flight tokens
   * expire within `SERVICE_TOKEN_TTL_SECONDS` (5 minutes per canon
   * §29.4).
   *
   * @throws UnauthorizedException when the principal is absent or
   *   inactive — both surface the same generic message so the mint
   *   endpoint does not leak which case applies.
   * @throws ForbiddenException when the requested audience is not in
   *   the principal's `allowed_audiences`.
   */
  async issueServiceToken(params: {
    serviceId: string;
    audience: string;
    instanceId?: string;
  }): Promise<{ token: string; expiresIn: number }> {
    if (!params.serviceId) {
      throw new UnauthorizedException('Unknown or inactive service principal');
    }
    if (!params.audience) {
      throw new ForbiddenException('Audience is required');
    }

    const principal = await this.servicePrincipalRepo.findOne({
      where: { serviceId: params.serviceId, active: true },
    });
    if (!principal) {
      throw new UnauthorizedException('Unknown or inactive service principal');
    }

    if (!principal.allowedAudiences.includes(params.audience)) {
      throw new ForbiddenException(
        `Service ${params.serviceId} is not allowed to call audience ${params.audience}`,
      );
    }

    const instanceId = params.instanceId || this.resolveInstanceId();
    const now = Math.floor(Date.now() / 1000);
    const ttl = SERVICE_TOKEN_TTL_SECONDS;

    const payload: Record<string, unknown> = {
      iss: `${ISSUER_PREFIX}${instanceId}`,
      aud: params.audience,
      sub: `service:${params.serviceId}`,
      iat: now,
      exp: now + ttl,
      instance_id: instanceId,
      // Canon §29.7 — every service token gets a fresh session id per
      // mint. Service tokens do NOT share session identity with the
      // mint request that produced them; session_id is purely an
      // operational correlation handle for the audit log.
      session_id: randomUUID(),
      // Canon §29.7 — scopes copied verbatim from the principal.
      // The receiving service authorizes the call against these.
      scope: principal.allowedScopes,
      // NO token_version. Service tokens have no security_stamp per
      // canon §29.6 — services have no user identity.
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

  /**
   * Surface the refresh-token TTL to callers that need it for cookie
   * `Max-Age` calculation.
   */
  getRefreshTokenTtlSeconds(): number {
    return this.refreshTokenTtlSeconds;
  }

  // ───────────────────────────────────────────────────────────────────
  // Refresh tokens (canon §29.5)
  // ───────────────────────────────────────────────────────────────────

  /**
   * Issue a brand-new refresh-token family. Called on every login /
   * SSO callback / magic-link verification — each login gets its own
   * family (founder direction: unbounded concurrency per user).
   *
   * The returned token is the plaintext opaque string the client stores
   * in its `refreshToken` HttpOnly cookie. The DB row carries only the
   * SHA-256 hash; plaintext is forgotten the moment this method returns.
   */
  async issueRefreshTokenFamily(params: {
    userId: string;
    sessionId: string;
    instanceId: string | null;
    deviceLabel?: string;
    userAgent?: string;
    ipAddress?: string;
  }): Promise<{ refreshToken: string; expiresAt: Date; familyId: string }> {
    const token = generateRefreshToken();
    const familyId = randomUUID();
    const now = new Date();
    const expiresAt = new Date(
      now.getTime() + this.refreshTokenTtlSeconds * 1000,
    );

    await this.refreshTokenRepo.insert({
      tokenHash: hashToken(token),
      familyId,
      parentTokenId: null,
      userId: params.userId,
      instanceId: params.instanceId,
      sessionId: params.sessionId,
      deviceLabel:
        params.deviceLabel ??
        parseDeviceLabelFromUserAgent(params.userAgent),
      userAgentHash: params.userAgent ? hashUserAgent(params.userAgent) : null,
      ipAddressHash: params.ipAddress ? hashIp(params.ipAddress) : null,
      createdAt: now,
      expiresAt,
    });

    return { refreshToken: token, expiresAt, familyId };
  }

  /**
   * Rotate a refresh token in a single transaction. Canon §29.5 rules:
   *
   *   1. Happy path: consume the presented token (set last_used_at +
   *      replaced_by_token_id) and mint a successor with the same
   *      family_id and inherited expires_at (no extension via rotation).
   *   2. Already-used token presented → REUSE DETECTED. Revoke entire
   *      family, revoke session (so access tokens for the session also
   *      fail), emit high-severity audit event with plaintext IP/UA,
   *      raise a bland 401.
   *   3. Unknown token / revoked / expired → bland 401, no audit event
   *      (would be noisy from probes).
   *
   * The transaction uses SELECT FOR UPDATE so two concurrent rotations
   * cannot both treat the same token as fresh.
   */
  async rotateRefreshToken(params: {
    presentedToken: string;
    userAgent?: string;
    ipAddress?: string;
  }): Promise<RefreshTokenRotationResult> {
    const presentedHash = hashToken(params.presentedToken);

    return this.dataSource.transaction(async (manager) => {
      const repo = manager.getRepository(RefreshToken);

      const row = await repo
        .createQueryBuilder('rt')
        .where('rt.token_hash = :hash', { hash: presentedHash })
        .setLock('pessimistic_write')
        .getOne();

      if (!row) {
        // Token never existed (or evicted post-revocation). No audit
        // event — would be too noisy from probes.
        throw new UnauthorizedException(SESSION_EXPIRED_MESSAGE);
      }

      // Family expiry — anchored to the family root's created_at + TTL.
      // Successors inherit `expires_at` so the same check fires for
      // every member of an expired family.
      if (row.expiresAt < new Date()) {
        await this.revokeFamily(manager, row.familyId, 'family_expired');
        throw new UnauthorizedException(SESSION_EXPIRED_MESSAGE);
      }

      if (row.revokedAt !== null && row.revokedAt !== undefined) {
        throw new UnauthorizedException(SESSION_EXPIRED_MESSAGE);
      }

      if (row.lastUsedAt !== null && row.lastUsedAt !== undefined) {
        // Canon §29.5 rule 2: token already used → reuse detected.
        await this.handleReuseDetection({
          manager,
          familyId: row.familyId,
          userId: row.userId,
          sessionId: row.sessionId,
          userAgent: params.userAgent,
          ipAddress: params.ipAddress,
        });
        throw new UnauthorizedException(SESSION_EXPIRED_MESSAGE);
      }

      // Happy path — consume + mint successor.
      const newToken = generateRefreshToken();
      const newTokenHash = hashToken(newToken);
      const now = new Date();
      // Successor inherits the family root's expires_at (carried on
      // every row). Rotation does NOT extend the family lifetime.
      const newExpiresAt = row.expiresAt;

      await repo.update(
        { tokenHash: presentedHash },
        { lastUsedAt: now, replacedByTokenId: newTokenHash },
      );

      await repo.insert({
        tokenHash: newTokenHash,
        familyId: row.familyId,
        parentTokenId: presentedHash,
        userId: row.userId,
        instanceId: row.instanceId,
        sessionId: row.sessionId,
        deviceLabel: row.deviceLabel,
        userAgentHash: params.userAgent
          ? hashUserAgent(params.userAgent)
          : row.userAgentHash,
        ipAddressHash: params.ipAddress
          ? hashIp(params.ipAddress)
          : row.ipAddressHash,
        createdAt: now,
        expiresAt: newExpiresAt,
      });

      return {
        refreshToken: newToken,
        expiresAt: newExpiresAt,
        userId: row.userId,
        sessionId: row.sessionId,
        instanceId: row.instanceId ?? null,
      };
    });
  }

  /**
   * Logout path: revoke the family that backs `sessionId`. Called from
   * `AuthService.logout`. Canon §29.5 rule 4.
   */
  async revokeFamilyForSession(sessionId: string): Promise<void> {
    if (!sessionId) return;
    await this.refreshTokenRepo.update(
      { sessionId, revokedAt: IsNull() },
      { revokedAt: new Date(), revokedReason: 'logout' },
    );
  }

  /**
   * Password-change / admin-revoke / suspend: revoke every active refresh
   * family for the user. Pair with `security_stamp` bump (canon §29.6)
   * so both the issue path (refresh family) and the in-flight access
   * tokens are killed.
   */
  async revokeAllUserFamilies(
    userId: string,
    reason: RefreshTokenRevokedReason = 'password_change',
  ): Promise<void> {
    if (!userId) return;
    await this.refreshTokenRepo.update(
      { userId, revokedAt: IsNull() },
      { revokedAt: new Date(), revokedReason: reason },
    );
  }

  /**
   * Scheduled cleanup — delete rows whose `expires_at` is in the past.
   * Revoked rows past their natural expiry are also deleted; rows still
   * marked active but expired are deleted (the partial index on
   * `expires_at WHERE revoked_at IS NULL` keeps this scan cheap).
   *
   * Returns the count of rows removed for observability.
   */
  async cleanupExpiredRefreshTokens(): Promise<number> {
    const cutoff = new Date();
    const result = await this.refreshTokenRepo
      .createQueryBuilder()
      .delete()
      .from(RefreshToken)
      .where('expires_at < :cutoff', { cutoff })
      .execute();
    return result.affected ?? 0;
  }

  /**
   * Reuse-detection handler. Canon §29.5 rule 2:
   *   1. Revoke entire family with reason 'reuse_detected'.
   *   2. Revoke session via JwtRevocationPort so the access tokens
   *      already minted for this session also fail.
   *   3. Emit a high-severity AccessAuditPort security event. Plaintext
   *      IP and User-Agent flow into the audit payload — they are NEVER
   *      stored on the operational refresh_tokens row.
   *   4. Caller raises a generic 401 (handled by `rotateRefreshToken`).
   */
  private async handleReuseDetection(params: {
    manager: EntityManager;
    familyId: string;
    userId: string;
    sessionId: string;
    userAgent?: string;
    ipAddress?: string;
  }): Promise<void> {
    await this.revokeFamily(params.manager, params.familyId, 'reuse_detected');
    await this.sessionRevoker.revokeSession(params.sessionId);

    if (this.accessAudit) {
      try {
        this.accessAudit.logSecurityEvent({
          userId: params.userId,
          kind: 'reuse_detected',
          severity: 'high',
          context: {
            familyId: params.familyId,
            sessionId: params.sessionId,
            ipAddressAtReuse: params.ipAddress ?? null,
            userAgentAtReuse: params.userAgent ?? null,
          },
        });
      } catch (err) {
        // Belt-and-suspenders — the adapter already swallows save errors,
        // but a thrown audit must not regress the revocation path.
        this.logger.error(
          'AccessAuditPort.logSecurityEvent threw on reuse detection',
          err,
        );
      }
    } else {
      this.logger.warn(
        'AccessAuditPort unbound; reuse detection event not persisted ' +
          '(canon §29.5 / canon §10 audit gap)',
      );
    }
  }

  private async revokeFamily(
    manager: EntityManager,
    familyId: string,
    reason: RefreshTokenRevokedReason,
  ): Promise<void> {
    await manager.getRepository(RefreshToken).update(
      { familyId, revokedAt: IsNull() },
      { revokedAt: new Date(), revokedReason: reason },
    );
  }

  // ───────────────────────────────────────────────────────────────────
  // Internals
  // ───────────────────────────────────────────────────────────────────

  private loadAndValidateAccessTtl(): number {
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

  /**
   * Canon §29.4 / §29.5 + founder-locked PR-C defaults: refresh-token TTL
   * defaults to 14 days and must fall within `[1, 30]`. Out-of-range
   * values fail startup — same posture as `JWT_ACCESS_TTL_SECONDS`. A
   * misconfigured refresh-token TTL must not be allowed to silently mint
   * never-expiring or instantly-expiring tokens.
   */
  private loadAndValidateRefreshTtl(): number {
    const raw = this.configService.get<string | number>('JWT_REFRESH_TTL_DAYS');
    if (raw === undefined || raw === null || raw === '') {
      return REFRESH_TOKEN_TTL_DEFAULT_DAYS * 24 * 60 * 60;
    }
    const parsed = typeof raw === 'number' ? raw : parseInt(String(raw), 10);
    if (!Number.isFinite(parsed) || !Number.isInteger(parsed)) {
      throw new Error(
        `JWT_REFRESH_TTL_DAYS must be an integer; got '${raw}' (canon §29.4)`,
      );
    }
    if (
      parsed < REFRESH_TOKEN_TTL_MIN_DAYS ||
      parsed > REFRESH_TOKEN_TTL_MAX_DAYS
    ) {
      throw new Error(
        `JWT_REFRESH_TTL_DAYS must be in [${REFRESH_TOKEN_TTL_MIN_DAYS}, ${REFRESH_TOKEN_TTL_MAX_DAYS}]; ` +
          `got ${parsed} (canon §29.4 / §29.5).`,
      );
    }
    return parsed * 24 * 60 * 60;
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

// ─────────────────────────────────────────────────────────────────────
// Module-level helpers (canon §29.5)
// ─────────────────────────────────────────────────────────────────────

/**
 * Returned by `rotateRefreshToken` on the happy path. The caller mints a
 * fresh access token via `issueAccessToken({ userId, sessionId })` and
 * sends both back to the client.
 */
export interface RefreshTokenRotationResult {
  refreshToken: string;
  expiresAt: Date;
  userId: string;
  sessionId: string;
  instanceId: string | null;
}

/** 256 bits of entropy, base64url-encoded. Exported for test fixtures. */
export function generateRefreshToken(): string {
  return randomBytes(REFRESH_TOKEN_ENTROPY_BYTES).toString('base64url');
}

export function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

export function hashIp(ip: string): string {
  return createHash('sha256').update(ip).digest('hex');
}

export function hashUserAgent(ua: string): string {
  return createHash('sha256').update(ua).digest('hex');
}

/**
 * Derive a human-friendly device label from a raw User-Agent. The label
 * is the display string the user sees in their session list ("Chrome on
 * Mac"). When the client supplies its own `device_label` on the login
 * payload, that value wins.
 *
 * Conservative parser — we deliberately keep the result short because it
 * shows up in security UI. Matches the heuristic already used by
 * `SessionService.parseUserAgent` so the two surfaces produce identical
 * labels for identical UAs.
 */
export function parseDeviceLabelFromUserAgent(
  userAgent: string | undefined,
): string | null {
  if (!userAgent) return null;
  const ua = userAgent.toLowerCase();

  let browser = 'Browser';
  if (/edg\//.test(ua)) browser = 'Edge';
  else if (/chrome/.test(ua) && !/chromium/.test(ua)) browser = 'Chrome';
  else if (/firefox/.test(ua)) browser = 'Firefox';
  else if (/safari/.test(ua) && !/chrome/.test(ua)) browser = 'Safari';

  let os = 'device';
  if (/windows/.test(ua)) os = 'Windows';
  else if (/android/.test(ua)) os = 'Android';
  else if (/iphone|ipad|ipod/.test(ua)) os = 'iOS';
  else if (/mac os x/.test(ua)) os = 'Mac';
  else if (/linux/.test(ua)) os = 'Linux';

  return `${browser} on ${os}`;
}
