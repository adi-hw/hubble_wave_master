import { CallHandler, ExecutionContext, HttpException, HttpStatus } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { firstValueFrom, of } from 'rxjs';
import { RedisService } from '@hubblewave/redis';
import {
  MAINTENANCE_MODE_FLAG_KEY,
  MaintenanceModeInterceptor,
} from './maintenance-mode.interceptor';
import { SKIP_MAINTENANCE_MODE_KEY } from './skip-maintenance-mode.decorator';

type RedisStub = Pick<RedisService, 'exists'>;

function buildContext(method: string): ExecutionContext {
  const request = { method };
  const handler = function handler() {
    /* noop */
  };
  const klass = class {};
  return {
    switchToHttp: () => ({
      getRequest: () => request,
      getResponse: () => ({}),
      getNext: () => () => undefined,
    }),
    getHandler: () => handler,
    getClass: () => klass,
    getArgs: () => [request],
    getArgByIndex: () => undefined,
    switchToRpc: () => ({}) as never,
    switchToWs: () => ({}) as never,
    getType: () => 'http',
  } as unknown as ExecutionContext;
}

function buildHandler(): CallHandler {
  return {
    handle: () => of('ok'),
  };
}

describe('MaintenanceModeInterceptor', () => {
  let redis: jest.Mocked<RedisStub>;
  let reflector: jest.Mocked<Pick<Reflector, 'getAllAndOverride'>>;
  let interceptor: MaintenanceModeInterceptor;

  beforeEach(() => {
    redis = {
      exists: jest.fn(),
    };
    reflector = {
      getAllAndOverride: jest.fn(),
    };
    interceptor = new MaintenanceModeInterceptor(
      redis as unknown as RedisService,
      reflector as unknown as Reflector,
    );
  });

  it('blocks POST when the Redis maintenance flag is set', async () => {
    redis.exists.mockResolvedValue(true);
    reflector.getAllAndOverride.mockReturnValue(undefined);

    await expect(
      interceptor.intercept(buildContext('POST'), buildHandler()),
    ).rejects.toBeInstanceOf(HttpException);

    expect(redis.exists).toHaveBeenCalledWith(MAINTENANCE_MODE_FLAG_KEY);
  });

  it('blocks PUT, PATCH, and DELETE when the Redis maintenance flag is set', async () => {
    redis.exists.mockResolvedValue(true);
    reflector.getAllAndOverride.mockReturnValue(undefined);

    for (const method of ['PUT', 'PATCH', 'DELETE']) {
      await expect(
        interceptor.intercept(buildContext(method), buildHandler()),
      ).rejects.toMatchObject({
        getStatus: expect.any(Function),
      });
    }
  });

  it('returns 503 with a clear message for blocked requests', async () => {
    redis.exists.mockResolvedValue(true);
    reflector.getAllAndOverride.mockReturnValue(undefined);

    let captured: HttpException | null = null;
    try {
      await interceptor.intercept(buildContext('POST'), buildHandler());
    } catch (error) {
      captured = error as HttpException;
    }

    expect(captured).not.toBeNull();
    expect(captured!.getStatus()).toBe(HttpStatus.SERVICE_UNAVAILABLE);
    const body = captured!.getResponse() as { message?: string; statusCode?: number };
    expect(body.statusCode).toBe(HttpStatus.SERVICE_UNAVAILABLE);
    expect(body.message).toMatch(/pack install/i);
    expect(body.message).toMatch(/read-only/i);
  });

  it('allows GET requests through even when the Redis flag is set', async () => {
    redis.exists.mockResolvedValue(true);
    reflector.getAllAndOverride.mockReturnValue(undefined);

    const result = await firstValueFrom(
      await interceptor.intercept(buildContext('GET'), buildHandler()),
    );

    expect(result).toBe('ok');
    // Did not need to consult Redis for safe methods.
    expect(redis.exists).not.toHaveBeenCalled();
  });

  it('allows HEAD and OPTIONS through without consulting Redis', async () => {
    redis.exists.mockResolvedValue(true);
    reflector.getAllAndOverride.mockReturnValue(undefined);

    for (const method of ['HEAD', 'OPTIONS']) {
      const result = await firstValueFrom(
        await interceptor.intercept(buildContext(method), buildHandler()),
      );
      expect(result).toBe('ok');
    }
    expect(redis.exists).not.toHaveBeenCalled();
  });

  it('passes state-changing requests through when the Redis flag is not set', async () => {
    redis.exists.mockResolvedValue(false);
    reflector.getAllAndOverride.mockReturnValue(undefined);

    const result = await firstValueFrom(
      await interceptor.intercept(buildContext('POST'), buildHandler()),
    );

    expect(result).toBe('ok');
    expect(redis.exists).toHaveBeenCalledWith(MAINTENANCE_MODE_FLAG_KEY);
  });

  it('respects @SkipMaintenanceMode() and bypasses the Redis check', async () => {
    redis.exists.mockResolvedValue(true);
    reflector.getAllAndOverride.mockImplementation((key) =>
      key === SKIP_MAINTENANCE_MODE_KEY ? true : undefined,
    );

    const result = await firstValueFrom(
      await interceptor.intercept(buildContext('POST'), buildHandler()),
    );

    expect(result).toBe('ok');
    // Skip decorator wins — Redis is never consulted.
    expect(redis.exists).not.toHaveBeenCalled();
  });
});
