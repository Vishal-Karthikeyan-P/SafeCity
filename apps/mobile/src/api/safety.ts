import { apiClient } from './client';
import { AreaSafetyScore } from '../types';

export const SafetyApi = {
  async getAreaScore(lat: number, lng: number, radiusKm: number = 1.0): Promise<AreaSafetyScore> {
    const res = await apiClient.get<AreaSafetyScore>('/safety/area', {
      params: {
        lat,
        lng,
        radius_km: radiusKm,
      },
    });
    return res.data;
  },

  async getCityOverview(cityLat: number = 11.0168, cityLng: number = 76.9558, radiusKm: number = 20.0) {
    const res = await apiClient.get('/safety/city', {
      params: {
        city_lat: cityLat,
        city_lng: cityLng,
        radius_km: radiusKm,
      },
    });
    return res.data;
  },
};
