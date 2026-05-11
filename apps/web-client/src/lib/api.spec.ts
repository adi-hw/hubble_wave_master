/**
 * F102 — fetch wrapper 403 handling.
 *
 * The wrapper at apps/web-client/src/lib/api.ts now surfaces a toast on
 * HTTP 403 before throwing the rejection. Other status codes preserve
 * existing throw-with-details behavior; success returns parsed JSON
 * without any toast side-effect.
 */

import { describe, expect, it, vi, beforeEach } from 'vitest';

const mocks = vi.hoisted(() => ({
  toastError: vi.fn(),
}));

vi.mock('../components/ui/Toast', () => ({
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

vi.mock('../services/token', () => ({
  __esModule: true,
  getStoredToken: () => 'access-token-v1',
}));

import { apiFetch } from './api';
import { FORBIDDEN_TOAST_MESSAGE } from '../services/api';

function mockFetchResponse(opts: {
  ok: boolean;
  status: number;
  body?: string;
}): void {
  const body = opts.body ?? '';
  const response = {
    ok: opts.ok,
    status: opts.status,
    text: vi.fn().mockResolvedValue(body),
  } as unknown as Response;
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(response));
}

describe('F102: fetch wrapper surfaces 403 to user via toast', () => {
  beforeEach(() => {
    mocks.toastError.mockClear();
    vi.unstubAllGlobals();
  });

  it('shows toast.error exactly once on a 403 response and throws', async () => {
    mockFetchResponse({
      ok: false,
      status: 403,
      body: JSON.stringify({ message: 'forbidden' }),
    });

    await expect(apiFetch('/data/collections')).rejects.toThrow();

    expect(mocks.toastError).toHaveBeenCalledTimes(1);
    expect(mocks.toastError).toHaveBeenCalledWith(FORBIDDEN_TOAST_MESSAGE);
  });

  it('does not fire a toast on a 200 success response', async () => {
    mockFetchResponse({
      ok: true,
      status: 200,
      body: JSON.stringify({ data: 'ok' }),
    });

    const result = await apiFetch<{ data: string }>('/data/collections');
    expect(result.data).toBe('ok');
    expect(mocks.toastError).not.toHaveBeenCalled();
  });

  it('does not fire a toast on a 500 error (still throws)', async () => {
    mockFetchResponse({
      ok: false,
      status: 500,
      body: JSON.stringify({ message: 'boom' }),
    });

    await expect(apiFetch('/data/collections')).rejects.toThrow();
    expect(mocks.toastError).not.toHaveBeenCalled();
  });

  it('does not fire a toast on a 401 error (still throws)', async () => {
    mockFetchResponse({
      ok: false,
      status: 401,
      body: JSON.stringify({ message: 'unauthorized' }),
    });

    await expect(apiFetch('/data/collections')).rejects.toThrow();
    expect(mocks.toastError).not.toHaveBeenCalled();
  });
});
