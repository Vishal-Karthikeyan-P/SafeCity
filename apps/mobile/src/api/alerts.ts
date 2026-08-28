import { apiClient } from './client';
import { CommunityAlert, PaginatedList } from '../types';

export const AlertsApi = {
  async listActive(page: number = 1, limit: number = 10): Promise<PaginatedList<CommunityAlert>> {
    const res = await apiClient.get<PaginatedList<CommunityAlert>>('/alerts', {
      params: {
        page,
        limit,
      },
    });
    return res.data;
  },
};
