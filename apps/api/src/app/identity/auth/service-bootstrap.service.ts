import * as fs from 'fs';
import * as https from 'https';
import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { ConfigService } from '@nestjs/config';
import { Request } from 'express';
import { Repository } from 'typeorm';
import { ServicePrincipal } from '@hubblewave/instance-db';

/**
 * Canon §29.7 expected audience presented to the K8s TokenReview API
 * when validating a projected service-account token. The receiving
 * pod (apps/api) is the authentication authority for service-to-
 * service tokens, so it MUST present itself as the expected audience
 * to TokenReview — otherwise any pod could trade its own SA token
 * for a HubbleWave service token (privilege escalation).
 */
const K8S_TOKENREVIEW_AUDIENCE = 'hubblewave-auth-service';

/**
 * Path inside the pod where Kubernetes mounts the pod's own
 * ServiceAccount token. Used to authorize the TokenReview call back
 * to the API server.
 */
const POD_SA_TOKEN_PATH =
  '/var/run/secrets/kubernetes.io/serviceaccount/token';
const POD_SA_CA_PATH =
  '/var/run/secrets/kubernetes.io/serviceaccount/ca.crt';

/**
 * Canon §29.7 service-bootstrap authenticator.
 *
 * The `POST /internal/service-token` endpoint (see
 * `service-token.controller.ts`) hands the incoming request to this
 * service. We resolve which `ServicePrincipal` is presenting itself
 * and return the row — or null when authentication fails.
 *
 * Two distinct paths:
 *
 *   1. **Production** (`NODE_ENV === 'production'`)
 *      The caller MUST present a Kubernetes projected SA token in
 *      `Authorization: Bearer <jwt>`. We validate it via the K8s
 *      TokenReview API (the same surface kubelet uses for pod auth)
 *      and look up the matching principal by `k8s_service_account`.
 *
 *      Cluster trust anchors:
 *        - apps/api's own pod SA authorizes the TokenReview call
 *          (`POD_SA_TOKEN_PATH`).
 *        - The cluster CA validates the API server's TLS
 *          (`POD_SA_CA_PATH`).
 *        - The expected audience presented to TokenReview is
 *          `K8S_TOKENREVIEW_AUDIENCE` so a token minted for a
 *          different service cannot be replayed here.
 *
 *   2. **Non-production** (any other NODE_ENV)
 *      The caller presents `X-Bootstrap-Secret: <value>` matching
 *      `JWT_BOOTSTRAP_SECRET` and `X-Service-Id: <service-id>`
 *      naming itself. We look up the principal by `service_id`.
 *
 *      Production startup MUST fail fast if `JWT_BOOTSTRAP_SECRET`
 *      is set (PR-A's hard guard). The presence of the secret in
 *      production is itself an architectural failure.
 *
 * Failure modes — unknown principal, inactive principal, missing
 * headers, signature mismatch, TokenReview failure — ALL return
 * `null`. The mint endpoint then surfaces a single 401 to the
 * caller so probes cannot enumerate which bootstrap kind succeeded.
 */
@Injectable()
export class ServiceBootstrapService {
  private readonly logger = new Logger(ServiceBootstrapService.name);

  constructor(
    @InjectRepository(ServicePrincipal)
    private readonly principalRepo: Repository<ServicePrincipal>,
    private readonly configService: ConfigService,
  ) {}

  /**
   * Authenticate a bootstrap request and return the matching
   * `ServicePrincipal`. Returns null when authentication fails for
   * any reason — the caller turns null into a 401.
   */
  async authenticate(req: Request): Promise<ServicePrincipal | null> {
    const nodeEnv = process.env['NODE_ENV'] ?? 'development';
    if (nodeEnv === 'production') {
      return this.authenticateViaK8sTokenReview(req);
    }
    return this.authenticateViaBootstrapSecret(req);
  }

  /**
   * Production path: validate the caller's projected SA token by
   * round-tripping it through the K8s `TokenReview` API. The cluster
   * is the source of truth for "is this pod really that
   * ServiceAccount", so the platform does not duplicate that check
   * locally.
   */
  private async authenticateViaK8sTokenReview(
    req: Request,
  ): Promise<ServicePrincipal | null> {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      this.logger.warn(
        'Service bootstrap rejected: missing or non-Bearer Authorization header',
      );
      return null;
    }
    const k8sToken = authHeader.slice('Bearer '.length).trim();
    if (!k8sToken) {
      return null;
    }

    const apiServerHost = process.env['KUBERNETES_SERVICE_HOST'];
    const apiServerPort =
      process.env['KUBERNETES_SERVICE_PORT_HTTPS'] ?? '443';
    if (!apiServerHost) {
      this.logger.error(
        'Service bootstrap unavailable: not running in a Kubernetes pod ' +
          '(KUBERNETES_SERVICE_HOST unset). Production canon §29.7 requires ' +
          'in-cluster TokenReview attestation.',
      );
      return null;
    }
    const apiServer = `https://${apiServerHost}:${apiServerPort}`;

    let podSaToken: string;
    let caCert: Buffer;
    try {
      podSaToken = fs.readFileSync(POD_SA_TOKEN_PATH, 'utf8');
      caCert = fs.readFileSync(POD_SA_CA_PATH);
    } catch (err) {
      this.logger.error(
        `Service bootstrap unavailable: cannot read pod SA credentials ` +
          `(${(err as Error).message})`,
      );
      return null;
    }

    let reviewStatus: K8sTokenReviewStatus;
    try {
      reviewStatus = await postTokenReview({
        apiServer,
        podSaToken,
        caCert,
        token: k8sToken,
        audiences: [K8S_TOKENREVIEW_AUDIENCE],
      });
    } catch (err) {
      this.logger.warn(
        `K8s TokenReview call failed: ${(err as Error).message}`,
      );
      return null;
    }

    if (!reviewStatus.authenticated) {
      this.logger.warn(
        `K8s TokenReview rejected token: ${reviewStatus.error ?? 'not authenticated'}`,
      );
      return null;
    }

    const k8sUsername = reviewStatus.user?.username;
    if (!k8sUsername) {
      return null;
    }

    return this.principalRepo.findOne({
      where: { k8sServiceAccount: k8sUsername, active: true },
    });
  }

  /**
   * Non-production path: validate `X-Bootstrap-Secret` against
   * `JWT_BOOTSTRAP_SECRET` and identify the principal by
   * `X-Service-Id`. Constant-time compare on the secret to defeat
   * timing oracles even though this surface is dev-only.
   */
  private async authenticateViaBootstrapSecret(
    req: Request,
  ): Promise<ServicePrincipal | null> {
    const expectedSecret =
      this.configService.get<string>('JWT_BOOTSTRAP_SECRET') ||
      process.env['JWT_BOOTSTRAP_SECRET'];
    if (!expectedSecret) {
      this.logger.error(
        'JWT_BOOTSTRAP_SECRET not set in dev environment — ' +
          'service bootstrap is unavailable. Set the var or migrate to ' +
          'in-cluster K8s service-account attestation.',
      );
      return null;
    }

    const provided = req.headers['x-bootstrap-secret'];
    if (typeof provided !== 'string' || !provided) {
      return null;
    }
    if (!constantTimeEqual(provided, expectedSecret)) {
      this.logger.warn('Service bootstrap rejected: bootstrap secret mismatch');
      return null;
    }

    const serviceId = req.headers['x-service-id'];
    if (typeof serviceId !== 'string' || !serviceId) {
      return null;
    }

    return this.principalRepo.findOne({
      where: { serviceId, active: true },
    });
  }
}

/**
 * Subset of the K8s `TokenReview` response we care about.
 * https://kubernetes.io/docs/reference/generated/kubernetes-api/v1.29/#tokenreview-v1-authentication-k8s-io
 */
interface K8sTokenReviewStatus {
  authenticated: boolean;
  user?: {
    username?: string;
    uid?: string;
    groups?: string[];
  };
  error?: string;
}

/**
 * Post a `TokenReview` to the cluster API server using node's built-in
 * `https.request`. We deliberately avoid `@kubernetes/client-node` here
 * — it would pull a substantial dependency tree (and its own kubeconfig
 * loader) for a single HTTPS POST. Raw `https.request` keeps the
 * bootstrap path's dependency footprint minimal and the network
 * behavior auditable line-by-line.
 */
function postTokenReview(params: {
  apiServer: string;
  podSaToken: string;
  caCert: Buffer;
  token: string;
  audiences: string[];
}): Promise<K8sTokenReviewStatus> {
  return new Promise((resolve, reject) => {
    const url = new URL(
      '/apis/authentication.k8s.io/v1/tokenreviews',
      params.apiServer,
    );
    const body = JSON.stringify({
      kind: 'TokenReview',
      apiVersion: 'authentication.k8s.io/v1',
      spec: {
        token: params.token,
        audiences: params.audiences,
      },
    });

    const req = https.request(
      {
        method: 'POST',
        host: url.hostname,
        port: url.port,
        path: url.pathname,
        ca: params.caCert,
        headers: {
          'Authorization': `Bearer ${params.podSaToken}`,
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(body),
          'Accept': 'application/json',
        },
        timeout: 5000,
      },
      (res) => {
        const chunks: Buffer[] = [];
        res.on('data', (chunk: Buffer) => chunks.push(chunk));
        res.on('end', () => {
          const raw = Buffer.concat(chunks).toString('utf8');
          if (res.statusCode === undefined || res.statusCode >= 400) {
            reject(
              new Error(
                `TokenReview HTTP ${res.statusCode ?? 'unknown'}: ${raw.slice(0, 256)}`,
              ),
            );
            return;
          }
          try {
            const parsed = JSON.parse(raw) as {
              status?: K8sTokenReviewStatus;
            };
            resolve(parsed.status ?? { authenticated: false });
          } catch (err) {
            reject(
              new Error(`TokenReview response parse failed: ${(err as Error).message}`),
            );
          }
        });
      },
    );

    req.on('timeout', () => {
      req.destroy(new Error('TokenReview request timed out'));
    });
    req.on('error', (err) => reject(err));
    req.write(body);
    req.end();
  });
}

/**
 * Constant-time string equality. Returns false immediately when the
 * lengths differ — that leak is intrinsic to comparing variable-length
 * strings and is not a meaningful attack channel here (the secret is
 * a fixed length per deployment).
 */
function constantTimeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}
