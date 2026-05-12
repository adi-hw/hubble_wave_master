import * as fs from 'fs';
import { Injectable, Logger, Optional } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { firstValueFrom } from 'rxjs';

/**
 * Path inside a pod where Kubernetes mounts the projected SA token.
 * Same path the K8s clients (kubectl, kubelet) use; we read the file
 * fresh on every call because Kubernetes rotates projected tokens at
 * runtime (the file content changes without process restart).
 */
const POD_SA_TOKEN_PATH =
  '/var/run/secrets/kubernetes.io/serviceaccount/token';

/**
 * Skew applied to the cached token's expiry — we refresh this many
 * milliseconds before the real expiration to avoid the
 * mid-call-expiry race. 30s is generous given service-token TTL is
 * 5min (canon §29.4) — a refresh fires after 4min30s of life.
 */
const TOKEN_REFRESH_SKEW_MS = 30_000;

/**
 * `ServiceTokenClient` — canon §29.7 service-token client.
 *
 * Calls `POST /internal/service-token` on the receiver (apps/api) to
 * exchange the caller's K8s SA token (or dev bootstrap secret) for a
 * short-lived HubbleWave service JWT. Caches the result so the
 * mint round-trip happens roughly every 5 minutes per audience.
 *
 * Consumers register this provider in their root module, inject it
 * into outbound HTTP clients, and prepend the result to
 * `Authorization: Bearer <token>`:
 *
 * ```ts
 * const token = await this.serviceTokenClient.getToken('svc-api');
 * await httpClient.post('https://svc-api/internal/event', body, {
 *   headers: { Authorization: `Bearer ${token}` },
 * });
 * ```
 *
 * Configuration (per consuming service):
 *   - `SERVICE_TOKEN_ENDPOINT`  base URL of the mint endpoint host
 *                               (e.g. `http://svc-api:3000`).
 *   - `SERVICE_ID`              the caller's own service id (dev path).
 *   - `JWT_BOOTSTRAP_SECRET`    dev-only shared secret (production
 *                               uses K8s SA attestation; PR-A's
 *                               startup guard rejects this var in
 *                               production).
 *
 * Failure modes — network unreachable, mint endpoint 4xx/5xx, missing
 * bootstrap credentials — surface as `Error`. The consumer is
 * responsible for retry / circuit-breaker policy; this client itself
 * does not retry (idempotent retries on a 401 are dangerous).
 */
@Injectable()
export class ServiceTokenClient {
  // Logger surfaced via @nestjs/common when consumers wire structured
  // logging — kept available for future diagnostics; deliberately
  // unused today because the mint path either succeeds or throws.
  private readonly _logger = new Logger(ServiceTokenClient.name);
  // Reference for tooling — `_logger` would otherwise be flagged as
  // an unused private member by strict lint configurations.
  protected getLogger(): Logger { return this._logger; }

  /**
   * One cache entry per audience. Service tokens are audience-bound
   * per canon §29.7, so a caller that talks to two services needs
   * two distinct tokens.
   */
  private readonly cache = new Map<
    string,
    { token: string; expiresAt: number }
  >();

  constructor(
    private readonly httpService: HttpService,
    @Optional() private readonly configService?: ConfigService,
  ) {}

  /**
   * Fetch (or mint) a service token for the given audience. Returns
   * the bare token string — callers prefix `Bearer ` themselves at
   * the HTTP-call site so logs do not accidentally capture both
   * surfaces.
   */
  async getToken(audience: string): Promise<string> {
    if (!audience) {
      throw new Error('ServiceTokenClient.getToken: audience is required');
    }

    const cached = this.cache.get(audience);
    if (cached && cached.expiresAt > Date.now() + TOKEN_REFRESH_SKEW_MS) {
      return cached.token;
    }

    const endpoint = this.getConfig('SERVICE_TOKEN_ENDPOINT');
    if (!endpoint) {
      throw new Error(
        'SERVICE_TOKEN_ENDPOINT is not configured — set it to the mint endpoint URL',
      );
    }

    const headers = this.buildBootstrapHeaders();
    const url = joinPath(endpoint, '/internal/service-token');

    const response = await firstValueFrom(
      this.httpService.post<{ token: string; expiresIn: number }>(
        url,
        { audience },
        { headers, timeout: 5000 },
      ),
    );

    if (!response.data?.token || !response.data?.expiresIn) {
      throw new Error('Service-token mint endpoint returned malformed response');
    }

    const expiresAt = Date.now() + response.data.expiresIn * 1000;
    this.cache.set(audience, { token: response.data.token, expiresAt });
    return response.data.token;
  }

  /**
   * Drop the cached token for an audience (or all audiences when
   * called with no argument). Used by callers that detect their
   * cached token is stale (e.g. a 401 from the receiver) and want to
   * force a fresh mint on the retry.
   */
  invalidate(audience?: string): void {
    if (audience) {
      this.cache.delete(audience);
    } else {
      this.cache.clear();
    }
  }

  private buildBootstrapHeaders(): Record<string, string> {
    const nodeEnv = process.env['NODE_ENV'] ?? 'development';
    if (nodeEnv === 'production') {
      let podSaToken: string;
      try {
        podSaToken = fs.readFileSync(POD_SA_TOKEN_PATH, 'utf8').trim();
      } catch (err) {
        throw new Error(
          `Production service-token bootstrap requires a Kubernetes ` +
            `projected SA token at ${POD_SA_TOKEN_PATH} ` +
            `(${(err as Error).message})`,
        );
      }
      return {
        Authorization: `Bearer ${podSaToken}`,
      };
    }

    const secret = this.getConfig('JWT_BOOTSTRAP_SECRET');
    const serviceId = this.getConfig('SERVICE_ID');
    if (!secret || !serviceId) {
      throw new Error(
        'Dev service-token bootstrap requires JWT_BOOTSTRAP_SECRET and SERVICE_ID env vars',
      );
    }
    return {
      'X-Bootstrap-Secret': secret,
      'X-Service-Id': serviceId,
    };
  }

  private getConfig(key: string): string | undefined {
    return (
      this.configService?.get<string>(key) ||
      process.env[key] ||
      undefined
    );
  }
}

function joinPath(base: string, path: string): string {
  const trimmedBase = base.endsWith('/') ? base.slice(0, -1) : base;
  const trimmedPath = path.startsWith('/') ? path : `/${path}`;
  return `${trimmedBase}${trimmedPath}`;
}
