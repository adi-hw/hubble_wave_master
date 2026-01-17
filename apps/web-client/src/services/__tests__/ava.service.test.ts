import { describe, expect, it, vi } from 'vitest';

vi.mock('../aiApi', () => {
  const post = vi.fn().mockResolvedValue({ data: { message: 'ok' } });
  return { __esModule: true, default: { post } };
});

import aiApi from '../aiApi';
import { avaService } from '../ava.service';

describe('avaService', () => {
  it('sends message payload to AVA endpoint', async () => {
    const res = await avaService.sendMessage({ message: 'hi', context: { page: '/' } });
    expect(aiApi.post).toHaveBeenCalledWith('/ava/chat', {
      message: 'hi',
      context: { page: '/' },
    });
    expect(res.message).toBe('ok');
  });
});
