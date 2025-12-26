import { describe, expect, it, vi } from 'vitest';

vi.mock('../api', () => {
  const get = vi.fn().mockResolvedValue({ data: [{ id: '1' }] });
  const post = vi.fn().mockResolvedValue({});
  const del = vi.fn().mockResolvedValue({});
  return {
    __esModule: true,
    default: { get, post, delete: del },
  };
});

import { notificationService } from '../notification.service';
import api from '../api';

describe('notificationService', () => {
  it('lists notifications', async () => {
    const data = await notificationService.list();
    expect(api.get).toHaveBeenCalledWith('/notifications');
    expect(data).toEqual([{ id: '1' }]);
  });

  it('marks notification as read', async () => {
    await notificationService.markRead('n1');
    expect(api.post).toHaveBeenCalledWith('/notifications/n1/read');
  });

  it('marks all as read', async () => {
    await notificationService.markAllRead();
    expect(api.post).toHaveBeenCalledWith('/notifications/read-all');
  });

  it('dismisses notification', async () => {
    await notificationService.dismiss('n2');
    expect(api.delete).toHaveBeenCalledWith('/notifications/n2');
  });

  it('clears all notifications', async () => {
    await notificationService.clearAll();
    expect(api.delete).toHaveBeenCalledWith('/notifications');
  });
});

