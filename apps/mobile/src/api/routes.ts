import { apiClient } from './client';
import { RoutePlanResponse } from '../types';

export const RoutesApi = {
  /**
   * Plan safe route alternatives between two coordinates using the backend Safe Route API.
   * Returns up to 3-5 distinct routes with safety scores, risk levels, and risk factors.
   */
  async planSafeRoute(
    startLat: number,
    startLng: number,
    destLat: number,
    destLng: number
  ): Promise<RoutePlanResponse> {
    const res = await apiClient.get<RoutePlanResponse>('/routes/plan', {
      params: {
        start_lat: startLat,
        start_lng: startLng,
        dest_lat: destLat,
        dest_lng: destLng,
      },
    });
    return res.data;
  },
};
