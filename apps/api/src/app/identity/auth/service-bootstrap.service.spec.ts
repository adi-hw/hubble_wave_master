import { ConfigService } from '@nestjs/config';
import { Request } from 'express';
import { Repository } from 'typeorm';
import { ServicePrincipal } from '@hubblewave/instance-db';
import { ServiceBootstrapService } from './service-bootstrap.service';

/**
 * `ServiceBootstrapService` spec — canon §29.7.
 *
 * Two paths under test:
 *   1. Production K8s TokenReview path: mocked global fetch (https
 *      module is patched by the bootstrap service; the spec runs the
 *      dev path because mocking the in-process https module across
 *      Jest module boundaries is brittle. Production behaviour is
 *      exercised at integration level with a kind cluster.)
 *   2. Non-production bootstrap-secret path: validates header
 *      matching, env var presence, principal lookup.
 *
 * Production-mode rejection of `JWT_BOOTSTRAP_SECRET` is enforced
 * upstream by PR-A's startup guard — the bootstrap service itself
 * only sees a request post-startup, so the rejection assertion lives
 * in PR-A's spec suite.
 */
describe('ServiceBootstrapService', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.resetModules();
    process.env = { ...originalEnv };
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  function buildPrincipalRepo(
    principals: ServicePrincipal[] = [],
  ): Repository<ServicePrincipal> {
    const store = new Map<string, ServicePrincipal>();
    for (const p of principals) {
      store.set(p.serviceId, p);
    }
    return {
      findOne: jest.fn(async (opts: { where: Record<string, unknown> }) => {
        const where = opts.where as {
          serviceId?: string;
          k8sServiceAccount?: string;
          active?: boolean;
        };
        for (const p of store.values()) {
          if (where.active !== undefined && p.active !== where.active) continue;
          if (where.serviceId !== undefined && p.serviceId !== where.serviceId)
            continue;
          if (
            where.k8sServiceAccount !== undefined &&
            p.k8sServiceAccount !== where.k8sServiceAccount
          )
            continue;
          return p;
        }
        return null;
      }),
    } as unknown as Repository<ServicePrincipal>;
  }

  function buildPrincipal(
    overrides: Partial<ServicePrincipal> = {},
  ): ServicePrincipal {
    return {
      serviceId: 'svc-worker',
      displayName: 'BullMQ worker',
      allowedAudiences: ['svc-api'],
      allowedScopes: ['work_order:read'],
      k8sServiceAccount: 'system:serviceaccount:hubblewave-system:svc-worker-sa',
      active: true,
      createdAt: new Date(),
      updatedAt: new Date(),
      ...overrides,
    } as ServicePrincipal;
  }

  function buildConfig(values: Record<string, string> = {}): ConfigService {
    return {
      get: jest.fn((key: string) => values[key]),
    } as unknown as ConfigService;
  }

  function buildRequest(headers: Record<string, string> = {}): Request {
    return { headers } as unknown as Request;
  }

  describe('non-production: bootstrap-secret path', () => {
    it('returns the principal when secret + service-id match', async () => {
      process.env.NODE_ENV = 'development';
      const repo = buildPrincipalRepo([buildPrincipal()]);
      const config = buildConfig({ JWT_BOOTSTRAP_SECRET: 'dev-secret-aaa' });
      const svc = new ServiceBootstrapService(repo, config);

      const principal = await svc.authenticate(
        buildRequest({
          'x-bootstrap-secret': 'dev-secret-aaa',
          'x-service-id': 'svc-worker',
        }),
      );

      expect(principal).not.toBeNull();
      expect(principal?.serviceId).toBe('svc-worker');
    });

    it('returns null when bootstrap secret mismatches', async () => {
      process.env.NODE_ENV = 'development';
      const repo = buildPrincipalRepo([buildPrincipal()]);
      const config = buildConfig({ JWT_BOOTSTRAP_SECRET: 'dev-secret-aaa' });
      const svc = new ServiceBootstrapService(repo, config);

      const principal = await svc.authenticate(
        buildRequest({
          'x-bootstrap-secret': 'wrong-secret',
          'x-service-id': 'svc-worker',
        }),
      );

      expect(principal).toBeNull();
    });

    it('returns null when JWT_BOOTSTRAP_SECRET is not configured', async () => {
      process.env.NODE_ENV = 'development';
      delete process.env.JWT_BOOTSTRAP_SECRET;
      const repo = buildPrincipalRepo([buildPrincipal()]);
      const config = buildConfig({});
      const svc = new ServiceBootstrapService(repo, config);

      const principal = await svc.authenticate(
        buildRequest({
          'x-bootstrap-secret': 'any',
          'x-service-id': 'svc-worker',
        }),
      );

      expect(principal).toBeNull();
    });

    it('returns null when x-service-id is missing', async () => {
      process.env.NODE_ENV = 'development';
      const repo = buildPrincipalRepo([buildPrincipal()]);
      const config = buildConfig({ JWT_BOOTSTRAP_SECRET: 'dev-secret-aaa' });
      const svc = new ServiceBootstrapService(repo, config);

      const principal = await svc.authenticate(
        buildRequest({
          'x-bootstrap-secret': 'dev-secret-aaa',
        }),
      );

      expect(principal).toBeNull();
    });

    it('returns null when the named principal is inactive', async () => {
      process.env.NODE_ENV = 'development';
      const repo = buildPrincipalRepo([
        buildPrincipal({ active: false }),
      ]);
      const config = buildConfig({ JWT_BOOTSTRAP_SECRET: 'dev-secret-aaa' });
      const svc = new ServiceBootstrapService(repo, config);

      const principal = await svc.authenticate(
        buildRequest({
          'x-bootstrap-secret': 'dev-secret-aaa',
          'x-service-id': 'svc-worker',
        }),
      );

      expect(principal).toBeNull();
    });
  });

  describe('production: K8s TokenReview path', () => {
    it('returns null when KUBERNETES_SERVICE_HOST is unset', async () => {
      process.env.NODE_ENV = 'production';
      delete process.env.KUBERNETES_SERVICE_HOST;
      const repo = buildPrincipalRepo([buildPrincipal()]);
      const svc = new ServiceBootstrapService(repo, buildConfig());

      const principal = await svc.authenticate(
        buildRequest({ authorization: 'Bearer some.k8s.jwt' }),
      );

      expect(principal).toBeNull();
    });

    it('returns null when the Authorization header is missing or non-Bearer', async () => {
      process.env.NODE_ENV = 'production';
      process.env.KUBERNETES_SERVICE_HOST = '10.0.0.1';
      const repo = buildPrincipalRepo([buildPrincipal()]);
      const svc = new ServiceBootstrapService(repo, buildConfig());

      const noHeader = await svc.authenticate(buildRequest({}));
      expect(noHeader).toBeNull();

      const wrongScheme = await svc.authenticate(
        buildRequest({ authorization: 'Basic abc' }),
      );
      expect(wrongScheme).toBeNull();
    });
  });
});
