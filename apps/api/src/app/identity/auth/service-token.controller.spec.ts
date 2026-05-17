import { ForbiddenException, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { InstanceRequest } from '@hubblewave/auth-guard';
import { ServicePrincipal } from '@hubblewave/instance-db';
import { ServiceTokenController } from './service-token.controller';
import { ServiceBootstrapService } from './service-bootstrap.service';
import { TokenIssuerService } from './token-issuer.service';

/**
 * `ServiceTokenController` spec — canon §29.7 mint endpoint.
 *
 * Validates the request-handling glue: principal authentication via
 * `ServiceBootstrapService`, audience validation via
 * `TokenIssuerService.issueServiceToken`, and the 401-on-any-failure
 * posture that makes probes uninformative.
 */
describe('ServiceTokenController', () => {
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

  function buildController(deps: {
    bootstrapResult: ServicePrincipal | null;
    issueImpl?: (params: {
      serviceId: string;
      audience: string;
      instanceId: string;
    }) => Promise<{ token: string; expiresIn: number }>;
  }) {
    const bootstrap = {
      authenticate: jest.fn().mockResolvedValue(deps.bootstrapResult),
    } as unknown as ServiceBootstrapService;
    const issuer = {
      issueServiceToken:
        deps.issueImpl ??
        jest
          .fn()
          .mockResolvedValue({ token: 'jwt.signature', expiresIn: 300 }),
    } as unknown as TokenIssuerService;
    const config = {
      get: jest.fn((key: string) => {
        if (key === 'INSTANCE_ID') return 'test-instance';
        return undefined;
      }),
    } as unknown as ConfigService;
    return new ServiceTokenController(bootstrap, issuer, config);
  }

  function buildRequest(): InstanceRequest {
    return {
      headers: { authorization: 'Bearer some.k8s.token' },
    } as unknown as InstanceRequest;
  }

  it('returns the minted token + expiresIn on success', async () => {
    const ctrl = buildController({ bootstrapResult: buildPrincipal() });
    const result = await ctrl.mintServiceToken(
      { audience: 'svc-api' },
      buildRequest(),
    );
    expect(result.token).toBe('jwt.signature');
    expect(result.expiresIn).toBe(300);
    expect(result.tokenType).toBe('Bearer');
  });

  it('throws UnauthorizedException when bootstrap returns null', async () => {
    const ctrl = buildController({ bootstrapResult: null });
    await expect(
      ctrl.mintServiceToken({ audience: 'svc-api' }, buildRequest()),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('propagates ForbiddenException when audience is not in allowed_audiences', async () => {
    const ctrl = buildController({
      bootstrapResult: buildPrincipal(),
      issueImpl: jest.fn().mockImplementation(async () => {
        throw new ForbiddenException(
          'Service svc-worker is not allowed to call audience svc-attacker',
        );
      }),
    });
    await expect(
      ctrl.mintServiceToken({ audience: 'svc-attacker' }, buildRequest()),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('uses the configured INSTANCE_ID when minting', async () => {
    const issueMock = jest
      .fn()
      .mockResolvedValue({ token: 'jwt.signature', expiresIn: 300 });
    const ctrl = buildController({
      bootstrapResult: buildPrincipal(),
      issueImpl: issueMock,
    });
    await ctrl.mintServiceToken({ audience: 'svc-api' }, buildRequest());
    expect(issueMock).toHaveBeenCalledWith({
      serviceId: 'svc-worker',
      audience: 'svc-api',
      instanceId: 'test-instance',
    });
  });
});
