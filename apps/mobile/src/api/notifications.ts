import { apiClient } from './client';
import { NotificationItem } from '../types';

export interface NotificationResponse {
  items: NotificationItem[];
  total: number;
  unread_count: number;
}

export const NotificationsApi = {
  async list(): Promise<NotificationResponse> {
    const res = await apiClient.get<NotificationResponse>('/notifications');
    return res.data;
  },

  async markRead(id: string): Promise<NotificationItem> {
    const res = await apiClient.patch<NotificationItem>(`/notifications/${id}/read`);
    return res.data;
  },

  async markAllRead(): Promise<{ message: string }> {
    const res = await apiClient.post<{ message: string }>('/notifications/read-all');
    return res.data;
  },
};
