/**
 * F102 — axios interceptor 403 handling.
 *
 * The interceptor at apps/web-client/src/services/api.ts previously fell
 * through any non-401 error to `Promise.reject(error)` silently. These
 * tests cover the F102 fix: 403 responses now surface a user-facing toast
 * via the module-level `toast` helper, while existing 401 refresh logic,
 * 200 success, and other error statuses remain untouched.
 */

import { describe, expect, it, vi, beforeEach } from 'vitest';
import type { AxiosError, AxiosInstance } from 'axios';

// ---- Module mocks -----------------------------------------------------
// Vitest hoists vi.mock() calls to the top of the file, so any external
// references must be set up via vi.hoisted() to be available when the
// mock factory runs.
const mocks = vi.hoisted(() => {
  return {
    toastError: vi.fn(),
    hardRedirectToLogin: vi.fn(),
    setStoredToken: vi.fn(),
    refreshAccessToken: vi.fn(async () => 'access-token-v2'),
    // Token state is mutable per test; the getStoredToken mock reads it.
    tokenState: { current: 'access-token-v1' as string | null },
  };
});

vi.mock('../../components/ui/Toast', () => ({
  __esModule: true,
  toast: {
    success: vi.fn(),
    error: mocks.toastError,
    warning: vi.fn(),
    info: vi.fn(),
    loading: vi.fn(),
    custom: vi.fn(),
  },
  setGlobalToast: vi.fn(),
}));

vi.mock('../navigation', () => ({
  __esModule: true,
  hardRedirectToLogin: mocks.hardRedirectToLogin,
}));

vi.mock('../token', () => ({
  __esModule: true,
  getStoredToken: () => mocks.tokenState.current,
  setStoredToken: mocks.setStoredToken,
  refreshAccessToken: mocks.refreshAccessToken,
}));

import { createApiClient, FORBIDDEN_TOAST_MESSAGE } from '../api';

// ---- Interceptor harness ---------------------------------------------
// We extract the response error handler that createApiClient registered
// on the axios instance and invoke it directly, simulating the response
// pipeline. This avoids depending on real network calls in jsdom.
type ResponseErrorHandler = (error: AxiosError) => Promise<unknown>;
type ResponseFulfilledHandler = (value: unknown) => unknown;

interface InterceptorHandlerEntry {
  fulfilled?: ResponseFulfilledHandler;
  rejected?: ResponseErrorHandler;
}

function getLastResponseHandler(api: AxiosInstance): InterceptorHandlerEntry {
  const handlers = (
    api.interceptors.response as unknown as {
      handlers: InterceptorHandlerEntry[];
    }
  ).handlers;
  const last = handlers[handlers.length - 1];
  if (!last?.rejected) {
    throw new Error('expected a response error handler to be registered');
  }
  return last;
}

function makeAxiosError(
  status: number,
  url = '/some-endpoint',
  overrides: Partial<AxiosError> = {}
): AxiosError {
  return {
    config: { url, headers: {} },
    isAxiosError: true,
    toJSON: () => ({}),
    name: 'AxiosError',
    message: `Request failed with status code ${status}`,
    response: {
      status,
      statusText: `HTTP ${status}`,
      data: {},
      headers: {},
      // axios accepts an opaque object for InternalAxiosRequestConfig in tests
      config: { url, headers: {} } as never,
    },
    ...overrides,
  } as AxiosError;
}

describe('F102: axios interceptor surfaces 403 to user via toast', () => {
  beforeEach(() => {
    mocks.toastError.mockClear();
    mocks.hardRedirectToLogin.mockClear();
    mocks.setStoredToken.mockClear();
    mocks.refreshAccessToken.mockClear();
    mocks.refreshAccessToken.mockImplementation(async () => 'access-token-v2');
    mocks.tokenState.current = 'access-token-v1';
  });

  it('shows toast.error exactly once on a 403 response and rejects', async () => {
    const api = createApiClient('/api/data');
    const { rejected } = getLastResponseHandler(api);
    const error = makeAxiosError(403);

    await expect(rejected!(error)).rejects.toBe(error);

    expect(mocks.toastError).toHaveBeenCalledTimes(1);
    expect(mocks.toastError).toHaveBeenCalledWith(FORBIDDEN_TOAST_MESSAGE);
  });

  it('does not show a toast on a 500 response (no 403 path triggered)', async () => {
    const api = createApiClient('/api/data');
    const { rejected } = getLastResponseHandler(api);
    const error = makeAxiosError(500);

    await expect(rejected!(error)).rejects.toBe(error);

    expect(mocks.toastError).not.toHaveBeenCalled();
  });

  it('does not show a toast on a 404 response (sanity check)', async () => {
    const api = createApiClient('/api/data');
    const { rejected } = getLastResponseHandler(api);
    const error = makeAxiosError(404);

    await expect(rejected!(error)).rejects.toBe(error);

    expect(mocks.toastError).not.toHaveBeenCalled();
  });

  it('routes 401 through the refresh path, not the 403 toast path', async () => {
    // A 401 with a token must call refreshAccessToken. If refresh throws,
    // the interceptor redirects to login. Importantly, the 403 toast
    // branch lives AFTER the 401 block and short-circuits via early
    // `return`, so it must not fire on the 401 path.
    mocks.refreshAccessToken.mockRejectedValueOnce(new Error('refresh failed'));
    const api = createApiClient('/api/data');
    const { rejected } = getLastResponseHandler(api);
    const error = makeAxiosError(401);

    await expect(rejected!(error)).rejects.toBeInstanceOf(Error);

    expect(mocks.refreshAccessToken).toHaveBeenCalledTimes(1);
    expect(mocks.hardRedirectToLogin).toHaveBeenCalledTimes(1);
    expect(mocks.toastError).not.toHaveBeenCalled();
  });

  it('redirects to login on 401 with no token, without showing 403 toast', async () => {
    mocks.tokenState.current = null;
    const api = createApiClient('/api/data');
    const { rejected } = getLastResponseHandler(api);
    const error = makeAxiosError(401);

    await expect(rejected!(error)).rejects.toBe(error);

    expect(mocks.hardRedirectToLogin).toHaveBeenCalledTimes(1);
    expect(mocks.refreshAccessToken).not.toHaveBeenCalled();
    expect(mocks.toastError).not.toHaveBeenCalled();
  });

  it('does not fire a toast on a 200 successful response', () => {
    const api = createApiClient('/api/data');
    const { fulfilled } = getLastResponseHandler(api);
    if (!fulfilled) {
      throw new Error('expected a fulfilled handler on the response interceptor');
    }

    const successResponse = { status: 200, data: { ok: true }, headers: {}, config: {} };
    const returned = fulfilled(successResponse);

    expect(returned).toBe(successResponse);
    expect(mocks.toastError).not.toHaveBeenCalled();
  });

  it('skips the 403 toast for /auth/login (skipAuthRefresh path also covers /auth/refresh)', async () => {
    // Per the interceptor, auth endpoints bypass the entire post-401
    // refresh block. The 403 toast lives AFTER that block, so for the
    // auth bypass path the toast should NOT fire even on a 403 — the
    // bypass calls `Promise.reject(error)` early.
    const api = createApiClient('/api/data');
    const { rejected } = getLastResponseHandler(api);
    const error = makeAxiosError(403, '/auth/login');

    await expect(rejected!(error)).rejects.toBe(error);

    expect(mocks.toastError).not.toHaveBeenCalled();
  });
});
