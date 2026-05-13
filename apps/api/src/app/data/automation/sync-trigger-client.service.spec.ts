import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { Logger } from '@nestjs/common';
import { UserRequestContext } from '@hubblewave/auth-guard';
import { SyncTriggerClientService } from './sync-trigger-client.service';

/**
 * Tests for the HTTP client adapter to svc-automation's sync-trigger
 * endpoint. After Plan Fix 1 PR 4 the client is unconditionally on
 * (no feature flag); the contract these tests fix:
 *
 *  1. Missing bearer token: aborted result returned with a clear
 *     message, NEVER silently skipped.
 *  2. Network failure: aborted result returned, NEVER silently skipped.
 *  3. Timeout: aborted result returned with timeout message.
 *  4. Non-200: aborted result returned with status code.
 *  5. Success: parsed response forwarded as-is.
 */
describe('SyncTriggerClientService', () => {
  let service: SyncTriggerClientService;
  let config: { get: jest.Mock };
  let originalFetch: typeof fetch;
  let warnSpy: jest.SpyInstance;
  let errorSpy: jest.SpyInstance;

  const ctx = (overrides: Partial<UserRequestContext> = {}): UserRequestContext => ({
    kind: 'user',
    userId: 'user-1',
    roles: ['admin'],
    permissions: [],
    isAdmin: true,
    bearerToken: 'eyJtest.bearer.token',
    ...overrides,
  });

  beforeEach(async () => {
    config = {
      get: jest.fn((key: string, fallback?: string) => {
        if (key === 'SVC_AUTOMATION_URL') return 'http://svc-automation.test';
        return fallback;
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SyncTriggerClientService,
        { provide: ConfigService, useValue: config },
      ],
    }).compile();

    service = module.get<SyncTriggerClientService>(SyncTriggerClientService);

    originalFetch = global.fetch;
    warnSpy = jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
    errorSpy = jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
  });

  afterEach(() => {
    global.fetch = originalFetch;
    warnSpy.mockRestore();
    errorSpy.mockRestore();
    jest.clearAllMocks();
  });

  // ==========================================================================
  // Auth: missing bearer token
  // ==========================================================================

  it('returns aborted when ctx has no bearerToken', async () => {
    const noTokenCtx = ctx({ bearerToken: undefined });
    const result = await service.executeSyncTrigger(noTokenCtx, {
      collectionId: 'coll-1',
      timing: 'before',
      operation: 'insert',
      record: { id: 'rec-1' },
      userContext: { id: 'user-1' },
    });
    expect(result.aborted).toBe(true);
    expect(result.abortMessage).toContain('no caller credential');
    expect(result.modifiedRecord).toEqual({ id: 'rec-1' });
  });

  // ==========================================================================
  // Network paths
  // ==========================================================================

  it('returns parsed response on successful HTTP 200', async () => {
    const responseBody = {
      modifiedRecord: { id: 'rec-1', status: 'open' },
      errors: [],
      warnings: [],
      asyncQueue: [
        {
          action: { id: 'a1', type: 'send_notification', config: { templateId: 't1' } },
          executeAsync: true,
          executeAfterCommit: true,
          output: { recipient: 'u@x.com' },
        },
      ],
      aborted: false,
    };
    global.fetch = jest.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => responseBody,
    })) as unknown as typeof fetch;

    const result = await service.executeSyncTrigger(ctx(), {
      collectionId: 'coll-1',
      timing: 'before',
      operation: 'insert',
      record: { id: 'rec-1' },
      userContext: { id: 'user-1' },
    });

    expect(result.aborted).toBe(false);
    expect(result.modifiedRecord).toEqual({ id: 'rec-1', status: 'open' });
    expect(result.asyncQueue).toHaveLength(1);
    expect(result.asyncQueue[0].action.type).toBe('send_notification');
    expect(result.asyncQueue[0].executeAfterCommit).toBe(true);
  });

  it('forwards Authorization Bearer header from ctx.bearerToken', async () => {
    const fetchMock = jest.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => ({
        modifiedRecord: { id: 'rec-1' },
        errors: [],
        warnings: [],
        asyncQueue: [],
        aborted: false,
      }),
    })) as unknown as typeof fetch;
    global.fetch = fetchMock;

    await service.executeSyncTrigger(ctx({ bearerToken: 'token-xyz' }), {
      collectionId: 'coll-1',
      timing: 'before',
      operation: 'insert',
      record: { id: 'rec-1' },
      userContext: { id: 'user-1' },
    });

    const call = (fetchMock as jest.Mock).mock.calls[0];
    const init = call[1] as RequestInit;
    expect((init.headers as Record<string, string>)['Authorization']).toBe('Bearer token-xyz');
  });

  it('preserves abortMessage when response indicates aborted=true', async () => {
    global.fetch = jest.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => ({
        modifiedRecord: { id: 'rec-1' },
        errors: [],
        warnings: [],
        asyncQueue: [],
        aborted: true,
        abortMessage: 'Status not allowed',
      }),
    })) as unknown as typeof fetch;

    const result = await service.executeSyncTrigger(ctx(), {
      collectionId: 'coll-1',
      timing: 'before',
      operation: 'insert',
      record: { id: 'rec-1' },
      userContext: { id: 'user-1' },
    });

    expect(result.aborted).toBe(true);
    expect(result.abortMessage).toBe('Status not allowed');
  });

  it('returns aborted on HTTP 500', async () => {
    global.fetch = jest.fn(async () => ({
      ok: false,
      status: 500,
      text: async () => 'Internal Server Error',
    })) as unknown as typeof fetch;

    const result = await service.executeSyncTrigger(ctx(), {
      collectionId: 'coll-1',
      timing: 'before',
      operation: 'insert',
      record: { id: 'rec-1' },
      userContext: { id: 'user-1' },
    });

    expect(result.aborted).toBe(true);
    expect(result.abortMessage).toContain('500');
    expect(result.modifiedRecord).toEqual({ id: 'rec-1' });
  });

  it('returns aborted on network failure (fetch throws)', async () => {
    global.fetch = jest.fn(async () => {
      throw new Error('ECONNREFUSED');
    }) as unknown as typeof fetch;

    const result = await service.executeSyncTrigger(ctx(), {
      collectionId: 'coll-1',
      timing: 'before',
      operation: 'insert',
      record: { id: 'rec-1' },
      userContext: { id: 'user-1' },
    });

    expect(result.aborted).toBe(true);
    expect(result.abortMessage).toContain('Automation runtime unavailable');
  });

  it('returns aborted on AbortError (timeout)', async () => {
    global.fetch = jest.fn(async () => {
      const err = new Error('aborted');
      err.name = 'AbortError';
      throw err;
    }) as unknown as typeof fetch;

    const result = await service.executeSyncTrigger(ctx(), {
      collectionId: 'coll-1',
      timing: 'before',
      operation: 'insert',
      record: { id: 'rec-1' },
      userContext: { id: 'user-1' },
    });

    expect(result.aborted).toBe(true);
    expect(result.abortMessage).toContain('timeout');
  });

  // ==========================================================================
  // Request shape
  // ==========================================================================

  it('serializes parentAutomationContext into the request body', async () => {
    const fetchMock = jest.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => ({
        modifiedRecord: { id: 'rec-1' },
        errors: [],
        warnings: [],
        asyncQueue: [],
        aborted: false,
      }),
    })) as unknown as typeof fetch;
    global.fetch = fetchMock;

    await service.executeSyncTrigger(ctx(), {
      collectionId: 'coll-1',
      timing: 'before',
      operation: 'insert',
      record: { id: 'rec-1' },
      userContext: { id: 'user-1' },
      parentContext: { depth: 2, executionChain: ['auto-1:rec-0'] },
    });

    const call = (fetchMock as jest.Mock).mock.calls[0];
    const body = JSON.parse((call[1] as RequestInit).body as string);
    expect(body.parentAutomationContext).toEqual({
      depth: 2,
      executionChain: ['auto-1:rec-0'],
    });
  });
});
