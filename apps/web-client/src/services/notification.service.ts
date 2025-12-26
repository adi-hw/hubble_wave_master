import api, { createApiClient } from './api';

export interface NotificationDTO {
  id: string;
  title: string;
  message: string;
  priority: 'low' | 'medium' | 'high' | 'critical';
  type: 'info' | 'warning' | 'danger' | 'success' | 'ava';
  isRead: boolean;
  createdAt: string;
  actionUrl?: string;
  actionLabel?: string;
}

const NOTIFICATIONS_API_URL = import.meta.env.VITE_NOTIFICATIONS_API_URL;
const notificationsApi = NOTIFICATIONS_API_URL ? createApiClient(NOTIFICATIONS_API_URL) : api;
const notificationsEnabled = Boolean(NOTIFICATIONS_API_URL);

export const notificationService = {
  enabled: notificationsEnabled,
  async list(): Promise<NotificationDTO[]> {
    if (!notificationsEnabled) return [];
    const res = await notificationsApi.get<NotificationDTO[]>('/notifications');
    return res.data;
  },
  async markRead(id: string): Promise<void> {
    if (!notificationsEnabled) return;
    await notificationsApi.post(`/notifications/${id}/read`);
  },
  async markAllRead(): Promise<void> {
    if (!notificationsEnabled) return;
    await notificationsApi.post('/notifications/read-all');
  },
  async dismiss(id: string): Promise<void> {
    if (!notificationsEnabled) return;
    await notificationsApi.delete(`/notifications/${id}`);
  },
  async clearAll(): Promise<void> {
    if (!notificationsEnabled) return;
    await notificationsApi.delete('/notifications');
  },
};
